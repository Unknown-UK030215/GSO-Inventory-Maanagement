import { createContext, useContext, useEffect, useState } from 'react';

import { useAuth } from './useAuth';

const MaintenanceContext = createContext(null);
const KEY = 'gso-maintenance';

let idCounter = Date.now();
const nextId = () => idCounter++;
const now = () => new Date().toLocaleString();

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
        return record;
    }

    function updateWorkOrder(id, changes) {
        setWorkOrders(current => current.map(item =>
            item.id === id ? { ...item, ...changes, updatedAt: now() } : item
        ));
    }

    function deleteWorkOrder(id) {
        setWorkOrders(current => current.filter(item => item.id !== id));
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
