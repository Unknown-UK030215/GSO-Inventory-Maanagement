import { createContext, useContext, useEffect, useState } from 'react';
import { sampleAssets } from '../data/sampleAssets';

const InventoryContext = createContext(null);

export function InventoryProvider({ children }) {
    const [assets, setAssets] = useState(() =>
        JSON.parse(localStorage.getItem('gso-assets') || 'null') || sampleAssets
    );
    const [logs, setLogs] = useState(() =>
        JSON.parse(localStorage.getItem('gso-logs') || '[]')
    );

    useEffect(() => {
        localStorage.setItem('gso-assets', JSON.stringify(assets));
    }, [assets]);

    useEffect(() => {
        localStorage.setItem('gso-logs', JSON.stringify(logs));
    }, [logs]);

    const log = (action, detail) => {
        setLogs(current => [
            { id: Date.now(), date: new Date().toLocaleString(), action, detail },
            ...current
        ]);
    };

    const addAsset = asset => {
        setAssets(current => [{ ...asset, id: Date.now() }, ...current]);
        log('Created asset', asset.propertyNo);
    };

    const updateAsset = (id, changes, activity) => {
        setAssets(current => current.map(asset =>
            asset.id === id ? { ...asset, ...changes } : asset
        ));
        log(activity?.action || 'Updated asset', activity?.detail || String(id));
    };

    const deleteAsset = id => {
        setAssets(current => current.filter(asset => asset.id !== id));
        log('Deleted asset', String(id));
    };

    return (
        <InventoryContext.Provider value={{ assets, logs, addAsset, updateAsset, deleteAsset, log }}>
            {children}
        </InventoryContext.Provider>
    );
}

// Shared hook export is intentionally kept beside the inventory provider.
// eslint-disable-next-line react-refresh/only-export-components
export const useInventory = () => useContext(InventoryContext);
