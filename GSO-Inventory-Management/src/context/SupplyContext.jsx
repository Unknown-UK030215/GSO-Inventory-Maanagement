import { createContext, useContext, useEffect, useState } from 'react';

import { isSupabaseConfigured } from '../lib/supabase';
import { isAdminRole } from '../data/userRoles';
import {
    fetchOrSeedRecords,
    fetchRisReleases,
    saveRisReleases,
    saveStoredRecords
} from '../services/supabaseService';
import { useAuth } from './useAuth';

const SupplyContext = createContext(null);
const PURCHASES_KEY = 'gso-purchases';
const RPCI_KEY = 'gso-rpci';
const RELEASES_KEY = 'gso-ris-releases';

let idCounter = Date.now();
const nextId = () => idCounter++;

function readList(key) {
    try {
        const items = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(items) ? items : [];
    } catch {
        return [];
    }
}

function readObject(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || '{}');
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
        return {};
    }
}

const stockKey = value => String(value || '').trim().toLowerCase();
const now = () => new Date().toLocaleString();

function syncWarning(error) {
    console.warn('Supabase supply sync skipped:', error?.message || error);
}

export function SupplyProvider({ children }) {
    const { user } = useAuth();
    const [purchases, setPurchases] = useState(() => readList(PURCHASES_KEY));
    const [rpci, setRpci] = useState(() => readList(RPCI_KEY));
    const [releases, setReleases] = useState(() => readObject(RELEASES_KEY));

    useEffect(() => {
        localStorage.setItem(PURCHASES_KEY, JSON.stringify(purchases));
    }, [purchases]);

    useEffect(() => {
        localStorage.setItem(RPCI_KEY, JSON.stringify(rpci));
    }, [rpci]);

    useEffect(() => {
        localStorage.setItem(RELEASES_KEY, JSON.stringify(releases));
    }, [releases]);

    useEffect(() => {
        if (!isSupabaseConfigured || !user?.id) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const localPurchases = purchases
                    .filter(item => isAdminRole(user.role) || !item.recordedBy || item.recordedBy === user.username)
                    .map(item => ({ ...item, recordedBy: item.recordedBy || user.username }));
                const [remotePurchases, remoteRpci, remoteReleases] = await Promise.all([
                    fetchOrSeedRecords('purchases', localPurchases, { orderBy: 'recorded_at' }),
                    fetchOrSeedRecords('rpci_stock', rpci, { orderBy: 'updated_at' }),
                    fetchRisReleases()
                ]);
                if (cancelled) return;
                if (remotePurchases.length) setPurchases(remotePurchases);
                if (remoteRpci.length) setRpci(remoteRpci);
                if (Object.keys(remoteReleases).length) setReleases(remoteReleases);
                else if (Object.keys(releases).length) await saveRisReleases(releases);
            } catch (error) {
                syncWarning(error);
            }
        })();
        return () => { cancelled = true; };
        // These local snapshots seed empty remote tables only when auth changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    // Raise a stock item, or grow the existing one for the same stock number.
    function addToStock(record) {
        const key = stockKey(record.stockNo || record.description);
        const existing = rpci.find(item =>
            stockKey(item.stockNo || item.description) === key
        );
        if (existing) {
            const updated = {
                ...existing,
                onHand: Number(existing.onHand || 0) + record.deliveredQty,
                unitCost: record.unitCost || existing.unitCost,
                updatedAt: now()
            };
            setRpci(current => current.map(item => item.id === existing.id ? updated : item));
            if (isSupabaseConfigured) saveStoredRecords('rpci_stock', [updated]).catch(syncWarning);
            return;
        }
        const added = {
                id: nextId(),
                stockNo: record.stockNo,
                description: record.description,
                unit: record.unit,
                unitCost: record.unitCost,
                onHand: record.deliveredQty,
                // Minimum on-hand level. 0 means no reorder alert for this item.
                minLevel: record.minLevel || 0,
                updatedAt: now()
            };
        setRpci(current => [added, ...current]);
        if (isSupabaseConfigured) saveStoredRecords('rpci_stock', [added]).catch(syncWarning);
    }

    // Record a delivery against a purchase order. When the supplier ships fewer
    // than ordered the entry is flagged Lacking with the shortfall quantity.
    // Supplies kept for stock (not for immediate release) raise the RPCI.
    function receivePurchase(entry) {
        const supplier = String(entry.supplier || '').trim();
        const description = String(entry.description || '').trim();
        const orderedQty = Number(entry.orderedQty);
        const deliveredQty = Number(entry.deliveredQty);

        if (!supplier) throw new Error('Supplier is required.');
        if (!description) throw new Error('Describe the item delivered.');
        if (!(orderedQty > 0)) throw new Error('Ordered quantity must be at least 1.');
        if (!(deliveredQty >= 0)) throw new Error('Delivered quantity cannot be negative.');

        const lacking = Math.max(0, orderedQty - deliveredQty);
        const record = {
            id: nextId(),
            date: entry.date || new Date().toISOString().slice(0, 10),
            recordedAt: now(),
            poNo: String(entry.poNo || '').trim(),
            poAmount: Number(entry.poAmount) || 0,
            supplier,
            stockNo: String(entry.stockNo || '').trim(),
            description,
            unit: String(entry.unit || '').trim(),
            unitCost: Number(entry.unitCost) || 0,
            orderedQty,
            deliveredQty,
            lacking,
            status: lacking > 0 ? 'Lacking' : 'Complete',
            forStock: entry.forStock !== false,
            recordedBy: user?.username || 'system',
            recordedByName: user?.displayName || 'System'
        };

        setPurchases(current => [record, ...current]);
        if (isSupabaseConfigured) saveStoredRecords('purchases', [record]).catch(syncWarning);
        if (record.forStock && deliveredQty > 0) {
            addToStock(record);
        }
        return record;
    }

    // Releasing an RIS deducts the issued quantity from the matching stock
    // item, and marks the RIS as released so it is not deducted twice.
    function releaseRis(ris) {
        if (releases[ris.id]) {
            throw new Error('This RIS has already been released.');
        }

        const quantity = Number(ris.quantity) || 0;
        const key = stockKey(ris.propertyNo || ris.description);
        const match = rpci.find(item => stockKey(item.stockNo || item.description) === key);

        if (match) {
            const updated = {
                ...match,
                onHand: Math.max(0, Number(match.onHand || 0) - quantity),
                updatedAt: now()
            };
            setRpci(current => current.map(item => item.id === match.id ? updated : item));
            if (isSupabaseConfigured) saveStoredRecords('rpci_stock', [updated]).catch(syncWarning);
        }

        const release = {
            releasedAt: new Date().toISOString(),
            releasedBy: user?.username || 'system',
            deducted: Boolean(match)
        };
        setReleases(current => ({ ...current, [ris.id]: release }));
        if (isSupabaseConfigured) {
            saveRisReleases({ [ris.id]: release }).catch(syncWarning);
        }

        return { deducted: Boolean(match) };
    }

    // Set the minimum on-hand level that triggers a reorder alert for an item.
    function setReorderLevel(id, minLevel) {
        const level = Math.max(0, Number(minLevel) || 0);
        const updated = rpci.find(item => item.id === id);
        if (!updated) return;
        const changed = { ...updated, minLevel: level, updatedAt: now() };
        setRpci(current => current.map(item => item.id === id ? changed : item));
        if (isSupabaseConfigured) saveStoredRecords('rpci_stock', [changed]).catch(syncWarning);
    }

    const isReleased = id => Boolean(releases[id]);
    const releaseInfo = id => releases[id] || null;

    // Items whose on-hand has fallen to (or below) their reorder level.
    const lowStock = rpci.filter(item =>
        Number(item.minLevel || 0) > 0 && Number(item.onHand || 0) <= Number(item.minLevel || 0)
    );

    return (
        <SupplyContext.Provider value={{
            purchases,
            rpci,
            lowStock,
            receivePurchase,
            releaseRis,
            setReorderLevel,
            isReleased,
            releaseInfo
        }}>
            {children}
        </SupplyContext.Provider>
    );
}

// Shared hook export is intentionally kept beside the supply provider.
// eslint-disable-next-line react-refresh/only-export-components
export const useSupply = () => useContext(SupplyContext);
