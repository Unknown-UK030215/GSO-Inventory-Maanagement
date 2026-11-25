import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { sampleAssets } from '../data/sampleAssets';
import { isAdminRole } from '../data/userRoles';
import { isSupabaseConfigured } from '../lib/supabase';
import {
    clearTrashRows,
    deleteAssetRow,
    deleteTrashRow,
    fetchAssets,
    fetchLogs,
    fetchTrash,
    insertLog,
    insertTrash,
    upsertAsset
} from '../services/supabaseService';
import { useAuth } from './useAuth';

const InventoryContext = createContext(null);

// Monotonic numeric id source so a record added to one register can never
// share an id with a record in the other, even within the same millisecond.
let idCounter = Date.now();
const nextId = () => idCounter++;

// Mirroring to Supabase is best-effort: when the app is offline, the tables
// are missing, or no credentials are set, the browser stores keep working and
// the failure is only logged. It must never break the UI.
function syncWarning(error) {
    console.warn('Supabase sync skipped:', error?.message || error);
}

export function InventoryProvider({ children }) {
    // The signed-in user is stamped on every record and activity entry so
    // administrators can see exactly what each account encoded and did.
    const { user } = useAuth();
    const actor = user?.username || 'system';
    const actorName = user?.displayName || 'System';

    // Inventory and Warehouse keep separate registers. `assets` holds the
    // inventory property records; `warehouseAssets` holds the warehouse
    // records (its own stock items plus AIR / RIS / SSMI transactions). The
    // split keeps property numbers, counts and duplicate checks scoped to a
    // single register, so registering in one never conflicts with the other.
    const [assets, setAssets] = useState(() =>
        JSON.parse(localStorage.getItem('gso-assets') || 'null') || sampleAssets
    );
    const [warehouseAssets, setWarehouseAssets] = useState(() =>
        JSON.parse(localStorage.getItem('gso-warehouse-assets') || '[]')
    );
    const [logs, setLogs] = useState(() =>
        JSON.parse(localStorage.getItem('gso-logs') || '[]')
    );

    // Undo history: a short stack of full-register snapshots taken just
    // before each change, so a mistaken entry can be rolled back.
    const [history, setHistory] = useState([]);

    // Recycle bin: deleted records are kept here so they can be restored
    // instead of being lost for good.
    const [trash, setTrash] = useState(() =>
        JSON.parse(localStorage.getItem('gso-trash') || '[]')
    );

    useEffect(() => {
        localStorage.setItem('gso-assets', JSON.stringify(assets));
    }, [assets]);

    useEffect(() => {
        localStorage.setItem('gso-warehouse-assets', JSON.stringify(warehouseAssets));
    }, [warehouseAssets]);

    useEffect(() => {
        localStorage.setItem('gso-logs', JSON.stringify(logs));
    }, [logs]);

    useEffect(() => {
        localStorage.setItem('gso-trash', JSON.stringify(trash));
    }, [trash]);

    // On first load, pull the registers, activity log and recycle bin from
    // Supabase when it is configured. Remote data is only applied when it
    // actually has rows, so an empty table never wipes the local seed.
    useEffect(() => {
        if (!isSupabaseConfigured || !user?.id) return undefined;
        let cancelled = false;

        (async () => {
            try {
                const [remoteAssets, remoteWarehouse, remoteLogs, remoteTrash] = await Promise.all([
                    fetchAssets('inventory'),
                    fetchAssets('warehouse'),
                    fetchLogs(),
                    fetchTrash()
                ]);
                if (cancelled) return;
                const canSeedAll = isAdminRole(user.role);
                if (remoteAssets.length) {
                    setAssets(remoteAssets);
                } else {
                    const localInventory = assets.filter(asset =>
                        canSeedAll || !asset.registeredBy || asset.registeredBy === actor
                    );
                    await Promise.all(localInventory.map(asset => upsertAsset({
                        ...asset,
                        registeredBy: asset.registeredBy || actor,
                        registeredByName: asset.registeredByName || actorName
                    }, 'inventory')));
                }
                if (remoteWarehouse.length) {
                    setWarehouseAssets(remoteWarehouse);
                } else {
                    const localWarehouse = warehouseAssets.filter(asset =>
                        canSeedAll || !asset.registeredBy || asset.registeredBy === actor
                    );
                    await Promise.all(localWarehouse.map(asset => upsertAsset({
                        ...asset,
                        registeredBy: asset.registeredBy || actor,
                        registeredByName: asset.registeredByName || actorName
                    }, 'warehouse')));
                }
                if (remoteLogs.length) setLogs(remoteLogs);
                else {
                    const localLogs = logs.filter(entry =>
                        canSeedAll || !entry.actor || entry.actor === actor
                    );
                    await Promise.all(localLogs.map(entry => insertLog({
                        ...entry,
                        actor: entry.actor || actor,
                        actorName: entry.actorName || actorName
                    })));
                }
                if (remoteTrash.length) setTrash(remoteTrash);
                else {
                    const localTrash = trash.filter(entry =>
                        canSeedAll || !entry.deletedBy || entry.deletedBy === actor || entry.deletedBy === actorName
                    );
                    await Promise.all(localTrash.map(entry => insertTrash({
                    ...entry,
                    deletedBy: entry.deletedBy || actor
                    })));
                }
            } catch (error) {
                syncWarning(error);
            }
        })();

        return () => { cancelled = true; };
        // Seed data is captured when the authenticated account changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    const HISTORY_LIMIT = 20;
    const TRASH_LIMIT = 50;

    // Snapshot the two registers before a change so it can be undone.
    const snapshot = label => {
        setHistory(current => [
            { label, at: new Date().toLocaleString(), actor, actorName, assets, warehouseAssets },
            ...current
        ].slice(0, HISTORY_LIMIT));
    };

    // Combined pool for cross-form exports (e.g. SSMI pulls RIS records).
    const allAssets = useMemo(() => [...assets, ...warehouseAssets], [assets, warehouseAssets]);

    const log = (action, detail) => {
        const entry = {
            id: Date.now(),
            date: new Date().toLocaleString(),
            action,
            detail,
            actor,
            actorName
        };
        setLogs(current => [entry, ...current]);
        if (isSupabaseConfigured) insertLog(entry).catch(syncWarning);
    };

    // `pool` selects which register the record belongs to, so the calling
    // workspace (Inventory vs Warehouse) decides where it is stored.
    const addAsset = (asset, pool = 'inventory') => {
        const record = {
            ...asset,
            id: nextId(),
            registeredBy: actor,
            registeredByName: actorName
        };
        snapshot(`Added ${record.propertyNo || record.description || 'record'}`);
        if (pool === 'warehouse') {
            setWarehouseAssets(current => [record, ...current]);
        } else {
            setAssets(current => [record, ...current]);
        }
        if (isSupabaseConfigured) upsertAsset(record, pool).catch(syncWarning);
        log('Created asset', record.propertyNo || record.risNo || record.airNo || record.ssmiMonth || '');
    };

    const updateAsset = (id, changes, activity) => {
        // Search both pools; the record lives in exactly one of them.
        snapshot(activity?.action || 'Updated record');
        setAssets(current => current.map(asset =>
            asset.id === id ? { ...asset, ...changes } : asset
        ));
        setWarehouseAssets(current => current.map(asset =>
            asset.id === id ? { ...asset, ...changes } : asset
        ));
        if (isSupabaseConfigured) {
            const existing =
                assets.find(asset => asset.id === id) ||
                warehouseAssets.find(asset => asset.id === id);
            if (existing) {
                const register = assets.some(asset => asset.id === id) ? 'inventory' : 'warehouse';
                upsertAsset({ ...existing, ...changes }, register).catch(syncWarning);
            }
        }
        log(activity?.action || 'Updated asset', activity?.detail || String(id));
    };

    const deleteAsset = id => {
        const record =
            assets.find(asset => asset.id === id) ||
            warehouseAssets.find(asset => asset.id === id);
        const recordPool = assets.some(asset => asset.id === id) ? 'inventory' : 'warehouse';

        snapshot(`Deleted ${record?.propertyNo || id}`);

        // Keep the deleted record in the recycle bin so it can be restored.
        if (record) {
            const entry = {
                trashId: nextId(),
                record,
                pool: recordPool,
                deletedAt: new Date().toLocaleString(),
                deletedBy: actor
            };
            setTrash(current => [entry, ...current].slice(0, TRASH_LIMIT));
            if (isSupabaseConfigured) insertTrash(entry).catch(syncWarning);
        }

        setAssets(current => current.filter(asset => asset.id !== id));
        setWarehouseAssets(current => current.filter(asset => asset.id !== id));
        if (isSupabaseConfigured) deleteAssetRow(id).catch(syncWarning);
        log('Deleted asset', String(record?.propertyNo || id));
    };

    // Roll the registers back to the state captured before the last change.
    const undoLast = () => {
        if (!history.length) return false;
        const [entry, ...rest] = history;
        setAssets(entry.assets);
        setWarehouseAssets(entry.warehouseAssets);
        setHistory(rest);
        log('Undid action', entry.label);
        return true;
    };

    // Put a recycled record back into the register it came from.
    const restoreAsset = trashId => {
        const entry = trash.find(item => item.trashId === trashId);
        if (!entry) return;
        snapshot(`Restored ${entry.record?.propertyNo || 'record'}`);
        if (entry.pool === 'warehouse') {
            setWarehouseAssets(current => [entry.record, ...current]);
        } else {
            setAssets(current => [entry.record, ...current]);
        }
        setTrash(current => current.filter(item => item.trashId !== trashId));
        if (isSupabaseConfigured) {
            upsertAsset(entry.record, entry.pool).catch(syncWarning);
            deleteTrashRow(trashId).catch(syncWarning);
        }
        log('Restored asset', entry.record?.propertyNo || '');
    };

    const purgeTrash = trashId => {
        setTrash(current => current.filter(item => item.trashId !== trashId));
        if (isSupabaseConfigured) deleteTrashRow(trashId).catch(syncWarning);
    };

    const emptyTrash = () => {
        setTrash([]);
        if (isSupabaseConfigured) clearTrashRows().catch(syncWarning);
    };

    return (
        <InventoryContext.Provider value={{
            assets,
            warehouseAssets,
            allAssets,
            logs,
            history,
            trash,
            addAsset,
            updateAsset,
            deleteAsset,
            undoLast,
            restoreAsset,
            purgeTrash,
            emptyTrash,
            log
        }}>
            {children}
        </InventoryContext.Provider>
    );
}

// Shared hook export is intentionally kept beside the inventory provider.
// eslint-disable-next-line react-refresh/only-export-components
export const useInventory = () => useContext(InventoryContext);
