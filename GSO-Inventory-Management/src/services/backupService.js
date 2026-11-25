// ============================================================
// DATA BACKUP & RESTORE
// ------------------------------------------------------------
// Every GSO register lives in the browser's local storage on this
// device. To protect official records from loss (cleared cache,
// new computer, browser reset) this service writes the whole set
// of GSO stores to a single downloadable file and reads it back.
// ============================================================

const PREFIX = 'gso-';

// The signed-in session is intentionally excluded so restoring a file
// never signs anyone in or overwrites who is currently logged on.
const EXCLUDE = new Set(['gso-auth-user']);

// Human-readable labels for the Backup page summary table.
export const BACKUP_STORES = [
    { key: 'gso-assets', label: 'Inventory property records' },
    { key: 'gso-warehouse-assets', label: 'Warehouse records (items, AIR/RIS/SSMI)' },
    { key: 'gso-logs', label: 'Activity logs' },
    { key: 'gso-local-users', label: 'Registered user accounts' },
    { key: 'gso-user-profiles', label: 'Profile settings & passwords' },
    { key: 'gso-purchases', label: 'Purchasing & receiving' },
    { key: 'gso-rpci', label: 'Stock on hand (RPCI)' },
    { key: 'gso-ris-releases', label: 'RIS releases' },
    { key: 'gso-maintenance', label: 'Maintenance work orders' },
    { key: 'gso-feedback', label: 'Feedback & bug reports' },
    { key: 'gso-notifications', label: 'System announcements' },
    { key: 'gso-notification-reads', label: 'Announcement read state' },
    { key: 'gso-chat-messages', label: 'Role chat messages' },
    { key: 'gso-trash', label: 'Recycle bin (deleted records)' }
];

function isBackupKey(key) {
    return Boolean(key) && key.startsWith(PREFIX) && !EXCLUDE.has(key);
}

// Number of entries held in a store (a list/object). 0 when empty.
export function storeCount(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        if (Array.isArray(value)) return value.length;
        if (value && typeof value === 'object') return Object.keys(value).length;
        return 0;
    } catch {
        return 0;
    }
}

// Rough estimate of how much room the GSO records use in this browser, so
// staff can be warned before the storage limit is reached. Browsers usually
// allow about 5 MB per site.
const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;

export function storageUsage() {
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!isBackupKey(key)) continue;
        const value = localStorage.getItem(key) || '';
        // Each character is stored as two bytes in most browsers.
        bytes += (key.length + value.length) * 2;
    }

    const percent = Math.min(100, Math.round((bytes / STORAGE_LIMIT_BYTES) * 100));
    return {
        bytes,
        kb: Math.round((bytes / 1024) * 10) / 10,
        limitKb: Math.round(STORAGE_LIMIT_BYTES / 1024),
        percent
    };
}

// Timestamp of the last downloaded backup, so the page can remind staff
// when no copy has been saved recently.
const LAST_BACKUP_KEY = 'gso-last-backup';

export function lastBackupAt() {
    const value = localStorage.getItem(LAST_BACKUP_KEY);
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

// Number of whole days since the last backup, or null if never backed up.
export function daysSinceBackup() {
    const at = lastBackupAt();
    if (!at) return null;
    return Math.floor((Date.now() - at.getTime()) / 86400000);
}

// Gather every GSO store as a plain object of raw strings.
export function collectBackup() {
    const data = {};
    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (isBackupKey(key)) {
            data[key] = localStorage.getItem(key);
        }
    }
    return data;
}

// Download all GSO records as a single JSON file.
export function downloadBackup() {
    const payload = {
        app: 'GSO Inventory Management',
        office: 'General Services Office — El Nido, Palawan',
        exportedAt: new Date().toISOString(),
        stores: Object.keys(collectBackup()).length,
        data: collectBackup()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gso-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);

    // Remember when a copy was last saved so the page can remind staff.
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());

    return Object.keys(payload.data).length;
}

// Restore GSO records from the text of a previously downloaded file.
// Returns how many stores were written back.
export function restoreBackup(text) {
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error('That file is not a valid backup file.');
    }

    const data = parsed && typeof parsed.data === 'object' ? parsed.data : parsed;
    const keys = Object.keys(data || {}).filter(isBackupKey);
    if (!keys.length) {
        throw new Error('No GSO records were found in this file.');
    }

    keys.forEach(key => {
        const value = data[key];
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    });

    return keys.length;
}
