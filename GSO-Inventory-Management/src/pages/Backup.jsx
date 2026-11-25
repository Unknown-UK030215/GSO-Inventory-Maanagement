import { useRef, useState } from 'react';

import PageHeader from '../components/common/PageHeader';
import {
    BACKUP_STORES,
    daysSinceBackup,
    downloadBackup,
    lastBackupAt,
    restoreBackup,
    storageUsage,
    storeCount
} from '../services/backupService';

// Days without a fresh backup before the page nudges the user.
const REMINDER_DAYS = 7;

export default function Backup() {
    const fileRef = useRef(null);
    const [status, setStatus] = useState({ type: '', message: '' });

    function handleDownload() {
        setStatus({ type: '', message: '' });
        try {
            const stores = downloadBackup();
            setStatus({
                type: 'success',
                message: `Backup downloaded — ${stores} data store${stores === 1 ? '' : 's'} saved to your file.`
            });
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        }
    }

    function handleFile(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const ok = window.confirm(
                'Restoring will replace the records currently on this device with the contents of the backup file. Continue?'
            );
            if (!ok) {
                if (fileRef.current) fileRef.current.value = '';
                return;
            }
            try {
                const stores = restoreBackup(String(reader.result || ''));
                setStatus({
                    type: 'success',
                    message: `Restored ${stores} data store${stores === 1 ? '' : 's'}. Reloading to apply…`
                });
                setTimeout(() => window.location.reload(), 900);
            } catch (err) {
                setStatus({ type: 'error', message: err.message });
                if (fileRef.current) fileRef.current.value = '';
            }
        };
        reader.readAsText(file);
    }

    const totalRecords = BACKUP_STORES.reduce((sum, store) => sum + storeCount(store.key), 0);
    const usage = storageUsage();
    const since = daysSinceBackup();
    const lastAt = lastBackupAt();
    const needsReminder = since === null || since >= REMINDER_DAYS;

    return (
        <>
            <PageHeader
                title="Data Backup & Restore"
                description="Export the records currently cached on this device. Supabase Auth accounts and credentials are never included."
            />

            {/* FRESHNESS REMINDER — nudges staff when no recent copy exists */}
            {needsReminder && (
                <p className="notice warn" role="status">
                    {lastAt
                        ? `Last backup was ${since} day${since === 1 ? '' : 's'} ago. Download a fresh copy to keep the records safe.`
                        : 'No backup has been saved from this device yet. Download one now to protect the records.'}
                </p>
            )}

            <div className="cards">
                <article><small>Data Stores</small><strong>{BACKUP_STORES.length}</strong></article>
                <article><small>Records on this device</small><strong>{totalRecords.toLocaleString()}</strong></article>
                <article className={usage.percent >= 80 ? 'card-alert' : undefined}>
                    <small>Storage used</small>
                    <strong>{usage.kb.toLocaleString()} KB</strong>
                    <small>of about {usage.limitKb.toLocaleString()} KB ({usage.percent}%)</small>
                </article>
                <article>
                    <small>Last backup</small>
                    <strong>{lastAt ? lastAt.toLocaleDateString() : 'Never'}</strong>
                    <small>{since === null ? 'No copy saved yet' : `${since} day${since === 1 ? '' : 's'} ago`}</small>
                </article>
            </div>

            {/* STORAGE-CAPACITY WARNING */}
            {usage.percent >= 80 && (
                <p className="notice warn" role="status">
                    This device is using {usage.percent}% of the browser's storage. Download a backup,
                    then empty the Recycle Bin or remove old records to free space.
                </p>
            )}

            <div className="split">
                <article className="panel">
                    <h3>Download a Backup</h3>
                    <p className="result-count">
                        Saves the inventory, warehouse, supply, work orders, logs, reports,
                        notifications, and chat cache into one JSON file. Use Supabase's dashboard
                        backups for a full server-side database backup.
                    </p>
                    <div className="actions">
                        <button type="button" onClick={handleDownload}>Download Backup</button>
                    </div>
                </article>

                <article className="panel">
                    <h3>Restore from a Backup</h3>
                    <p className="result-count">
                        Use this on a new computer or after a reset. The records currently stored on
                        this device will be replaced by the file you choose.
                    </p>
                    <label className="file-field">
                        Backup file (.json)
                        <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleFile} />
                    </label>
                </article>
            </div>

            {status.message && (
                <p className={`form-status ${status.type}`} role="status">{status.message}</p>
            )}

            <article className="panel">
                <h3>What's Included</h3>
                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr><th>Data Store</th><th>Records</th></tr>
                        </thead>
                        <tbody>
                            {BACKUP_STORES.map(store => (
                                <tr key={store.key}>
                                    <td>{store.label}</td>
                                    <td>{storeCount(store.key).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </article>
        </>
    );
}
