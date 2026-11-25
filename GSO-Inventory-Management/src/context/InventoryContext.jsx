import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { sampleAssets } from '../data/sampleAssets';
import { useAuth } from './useAuth';

const InventoryContext = createContext(null);

// Monotonic numeric id source so a record added to one register can never
// share an id with a record in the other, even within the same millisecond.
let idCounter = Date.now();
const nextId = () => idCounter++;

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
        setLogs(current => [
            {
                id: Date.now(),
                date: new Date().toLocaleString(),
                action,
                detail,
                actor,
                actorName
            },
            ...current
        ]);
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
            setTrash(current => [
                {
                    trashId: nextId(),
                    record,
                    pool: recordPool,
                    deletedAt: new Date().toLocaleString(),
                    deletedBy: actorName
                },
                ...current
            ].slice(0, TRASH_LIMIT));
        }

        setAssets(current => current.filter(asset => asset.id !== id));
        setWarehouseAssets(current => current.filter(asset => asset.id !== id));
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
        log('Restored asset', entry.record?.propertyNo || '');
    };

    const purgeTrash = trashId => {
        setTrash(current => current.filter(item => item.trashId !== trashId));
    };

    const emptyTrash = () => setTrash([]);

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
