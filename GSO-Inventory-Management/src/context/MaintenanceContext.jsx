import { createContext, useContext, useEffect, useState } from 'react';

import { isSupabaseConfigured } from '../lib/supabase';
import { isAdminRole } from '../data/userRoles';
import {
    deleteStoredRecord,
    fetchOrSeedRecords,
    saveStoredRecords
} from '../services/supabaseService';
import { useAuth } from './useAuth';

const MaintenanceContext = createContext(null);
const KEY = 'gso-maintenance';

let idCounter = Date.now();
const nextId = () => idCounter++;
const now = () => new Date().toLocaleString();

function syncWarning(error) {
    console.warn('Supabase maintenance sync skipped:', error?.message || error);
}

function readList() {
    try {
        const items = JSON.parse(localStorage.getItem(KEY) || '[]');
        return Array.isArray(items) ? items : [];
    } catch {
        return [];
    }
}

export function MaintenanceProvider({ children }) {
    const { user } = useAuth();
    const [workOrders, setWorkOrders] = useState(readList);

    useEffect(() => {
        localStorage.setItem(KEY, JSON.stringify(workOrders));
    }, [workOrders]);

    useEffect(() => {
        if (!isSupabaseConfigured || !user?.id) return undefined;
        let cancelled = false;
        const localOrders = workOrders
            .filter(order => isAdminRole(user.role) || !order.recordedBy || order.recordedBy === user.username)
            .map(order => ({ ...order, recordedBy: order.recordedBy || user.username }));
        fetchOrSeedRecords('maintenance_work_orders', localOrders, { orderBy: 'recorded_at' })
            .then(remote => { if (!cancelled && remote.length) setWorkOrders(remote); })
            .catch(syncWarning);
        return () => { cancelled = true; };
        // Local records seed an empty table on the first authenticated load.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    // Log a repair request for a piece of equipment or an item.
    function createWorkOrder(entry) {
        const description = String(entry.description || '').trim();
        const fault = String(entry.fault || '').trim();
        if (!description) throw new Error('Describe the equipment or item to repair.');
        if (!fault) throw new Error('Describe the fault or repair needed.');

        const record = {
            id: nextId(),
            propertyNo: String(entry.propertyNo || '').trim(),
            description,
            office: String(entry.office || '').trim(),
            reportedBy: String(entry.reportedBy || '').trim(),
            dateReported: entry.dateReported || new Date().toISOString().slice(0, 10),
            fault,
            status: 'Pending',
            repairCost: 0,
            completedDate: '',
            notes: String(entry.notes || '').trim(),
            recordedAt: now(),
            recordedBy: user?.username || 'system',
            recordedByName: user?.displayName || 'System'
        };

        setWorkOrders(current => [record, ...current]);
        if (isSupabaseConfigured) saveStoredRecords('maintenance_work_orders', [record]).catch(syncWarning);
        return record;
    }

    function updateWorkOrder(id, changes) {
        const existing = workOrders.find(item => item.id === id);
        if (!existing) return;
        const updated = { ...existing, ...changes, updatedAt: now() };
        setWorkOrders(current => current.map(item => item.id === id ? updated : item));
        if (isSupabaseConfigured) saveStoredRecords('maintenance_work_orders', [updated]).catch(syncWarning);
    }

    function deleteWorkOrder(id) {
        setWorkOrders(current => current.filter(item => item.id !== id));
        if (isSupabaseConfigured) deleteStoredRecord('maintenance_work_orders', id).catch(syncWarning);
    }

    // Work orders that still need attention (not yet completed or cancelled).
    const openCount = workOrders.filter(item =>
        item.status === 'Pending' || item.status === 'In Repair'
    ).length;

    return (
        <MaintenanceContext.Provider value={{
            workOrders,
            openCount,
            createWorkOrder,
            updateWorkOrder,
            deleteWorkOrder
        }}>
            {children}
        </MaintenanceContext.Provider>
    );
}

// Shared hook export is intentionally kept beside the maintenance provider.
// eslint-disable-next-line react-refresh/only-export-components
export const useMaintenance = () => useContext(MaintenanceContext);
