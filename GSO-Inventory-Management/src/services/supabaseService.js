// ============================================================
// SUPABASE DATA SERVICE
// ------------------------------------------------------------
// Translates the app's records (the same objects kept in the
// `gso-*` localStorage stores) to and from the Supabase tables
// defined in supabase/schema.sql.
//
// Every function returns a promise and throws on a real error so
// the caller can fall back to localStorage. When Supabase is not
// configured the caller simply skips these calls.
// ============================================================
import { requireSupabase } from '../lib/supabase';

// ----------------------------------------
// ASSETS
// ----------------------------------------
// Fields that map to their own typed column. Everything else a form
// collects is stored in `extra_fields` (jsonb) so new forms need no
// database migration.
const ASSET_COLUMN_MAP = {
    formType: 'form_type',
    propertyNo: 'property_no',
    description: 'description',
    classification: 'classification',
    category: 'category',
    quantity: 'quantity',
    unit: 'unit',
    cost: 'cost',
    department: 'department',
    accountable: 'accountable',
    location: 'location',
    condition: 'condition',
    status: 'status',
    remarks: 'remarks',
    acquisitionDate: 'acquisition_date',
    registeredBy: 'registered_by',
    registeredByName: 'registered_by_name'
};

// App record → database row.
export function assetToRow(record, register = 'inventory') {
    const row = { id: record.id, register };
    const extra = {};

    Object.entries(record).forEach(([key, value]) => {
        if (key === 'id' || key === 'register') return;
        const column = ASSET_COLUMN_MAP[key];
        if (column) {
            row[column] = toColumnValue(column, value);
        } else {
            extra[key] = value;
        }
    });

    row.extra_fields = extra;
    return row;
}

// Columns typed numeric/date in the schema need real JSON numbers and a
// blank must become null, otherwise PostgREST rejects the row.
const NUMERIC_COLUMNS = new Set(['quantity', 'cost']);

function toColumnValue(column, value) {
    if (value === '' || value === undefined) return null;
    if (NUMERIC_COLUMNS.has(column)) {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }
    return value;
}

// Database row → app record.
export function rowToAsset(row) {
    const record = { id: row.id };
    Object.entries(ASSET_COLUMN_MAP).forEach(([key, column]) => {
        const value = row[column];
        if (value !== null && value !== undefined) record[key] = value;
    });
    return { ...record, ...(row.extra_fields || {}) };
}

// Load one register ('inventory' | 'warehouse').
export async function fetchAssets(register) {
    const { data, error } = await requireSupabase()
        .from('assets')
        .select('*')
        .eq('register', register)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToAsset);
}

// Insert or update one asset record.
export async function upsertAsset(record, register = 'inventory') {
    const { error } = await requireSupabase()
        .from('assets')
        .upsert(assetToRow(record, register));
    if (error) throw error;
}

export async function deleteAssetRow(id) {
    const { error } = await requireSupabase().from('assets').delete().eq('id', id);
    if (error) throw error;
}

// ----------------------------------------
// ACTIVITY LOGS
// ----------------------------------------
export function logToRow(entry) {
    return {
        id: entry.id,
        occurred_at: new Date().toISOString(),
        action: entry.action,
        detail: entry.detail || null,
        actor: entry.actor || null,
        actor_name: entry.actorName || null
    };
}

export function rowToLog(row) {
    return {
        id: row.id,
        date: row.occurred_at ? new Date(row.occurred_at).toLocaleString() : '',
        action: row.action,
        detail: row.detail || '',
        actor: row.actor || '',
        actorName: row.actor_name || ''
    };
}

export async function fetchLogs() {
    const { data, error } = await requireSupabase()
        .from('activity_logs')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(500);
    if (error) throw error;
    return (data || []).map(rowToLog);
}

export async function insertLog(entry) {
    const { error } = await requireSupabase().from('activity_logs').insert(logToRow(entry));
    if (error) throw error;
}

// ----------------------------------------
// RECYCLE BIN
// ----------------------------------------
export function trashToRow(entry) {
    return {
        trash_id: entry.trashId,
        record: entry.record,
        pool: entry.pool || 'inventory',
        deleted_by: entry.deletedBy || null
    };
}

export function rowToTrash(row) {
    return {
        trashId: row.trash_id,
        record: row.record,
        pool: row.pool,
        deletedAt: row.deleted_at ? new Date(row.deleted_at).toLocaleString() : '',
        deletedBy: row.deleted_by || ''
    };
}

export async function fetchTrash() {
    const { data, error } = await requireSupabase()
        .from('recycle_bin')
        .select('*')
        .order('deleted_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToTrash);
}

export async function insertTrash(entry) {
    const { error } = await requireSupabase().from('recycle_bin').insert(trashToRow(entry));
    if (error) throw error;
}

export async function deleteTrashRow(trashId) {
    const { error } = await requireSupabase().from('recycle_bin').delete().eq('trash_id', trashId);
    if (error) throw error;
}

export async function clearTrashRows() {
    const { error } = await requireSupabase()
        .from('recycle_bin')
        .delete()
        .neq('trash_id', 0);
    if (error) throw error;
}

// ----------------------------------------
// REMAINING APPLICATION STORES
// ----------------------------------------
const TABLE_KEYS = {
    purchases: 'id',
    rpci_stock: 'id',
    maintenance_work_orders: 'id',
    feedback_reports: 'id',
    announcements: 'id',
    chat_messages: 'id'
};

const READ_TABLES = {
    announcement_reads: 'announcement_id',
    chat_reads: 'message_id'
};

const camelToSnake = value => value.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const snakeToCamel = value => value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

function toDatabaseRecord(table, record) {
    if (table === 'ris_releases') {
        return {
            asset_id: Number(record.assetId),
            released_at: record.releasedAt ? new Date(record.releasedAt).toISOString() : new Date().toISOString(),
            released_by: record.releasedBy || null,
            deducted: Boolean(record.deducted)
        };
    }

    const row = {};
    Object.entries(record).forEach(([key, value]) => {
        if (value === undefined || key === 'updatedAt' && table !== 'rpci_stock') return;
        const column = table === 'purchases' && key === 'date'
            ? 'entry_date'
            : table === 'feedback_reports' && key === 'date'
                ? 'created_at'
                : table === 'announcements' && key === 'date'
                    ? 'published_at'
                    : table === 'chat_messages' && key === 'at'
                        ? 'created_at'
                        : camelToSnake(key);
        row[column] = value === '' ? null : value;
    });

    if (table === 'maintenance_work_orders') {
        row.recorded_at = new Date().toISOString();
        row.completed_date = row.completed_date || null;
    }
    if (table === 'purchases') {
        row.recorded_at = new Date().toISOString();
    }
    if (table === 'feedback_reports') {
        row.created_at = new Date().toISOString();
    }
    if (table === 'announcements') {
        row.published_at = new Date().toISOString();
    }
    if (table === 'rpci_stock') {
        row.updated_at = new Date().toISOString();
    }
    if (table === 'chat_messages') {
        row.created_at = new Date().toISOString();
    }
    return row;
}

function fromDatabaseRecord(table, row) {
    if (table === 'ris_releases') {
        return {
            assetId: row.asset_id,
            releasedAt: row.released_at ? new Date(row.released_at).toLocaleString() : '',
            releasedBy: row.released_by || '',
            deducted: Boolean(row.deducted)
        };
    }

    const record = {};
    Object.entries(row).forEach(([column, value]) => {
        const key = table === 'purchases' && column === 'entry_date'
            ? 'date'
            : table === 'feedback_reports' && column === 'created_at'
                ? 'date'
                : table === 'announcements' && column === 'published_at'
                    ? 'date'
                    : table === 'chat_messages' && column === 'created_at'
                        ? 'at'
                        : snakeToCamel(column);
        record[key] = value;
    });

    if (table === 'purchases' || table === 'maintenance_work_orders') {
        if (record.recordedAt) record.recordedAt = new Date(record.recordedAt).toLocaleString();
    }
    if (table === 'feedback_reports' && record.date) record.date = new Date(record.date).toLocaleString();
    if (table === 'announcements' && record.date) record.date = new Date(record.date).toLocaleString();
    if (table === 'chat_messages' && record.at) record.at = new Date(record.at).toLocaleString();
    if (table === 'maintenance_work_orders' && record.updatedAt) {
        record.updatedAt = new Date(record.updatedAt).toLocaleString();
    }
    if (table === 'rpci_stock' && record.updatedAt) {
        record.updatedAt = new Date(record.updatedAt).toLocaleString();
    }
    if (table === 'maintenance_work_orders' && record.completedDate === null) record.completedDate = '';
    return record;
}

export async function fetchStoredRecords(table, { orderBy = 'id', ascending = false, limit = 5000 } = {}) {
    const { data, error } = await requireSupabase()
        .from(table)
        .select('*')
        .order(orderBy, { ascending })
        .limit(limit);
    if (error) throw error;
    return (data || []).map(row => fromDatabaseRecord(table, row));
}

export async function fetchOrSeedRecords(
    table,
    localRecords,
    { orderBy = 'id', ascending = false, limit = 5000, insertOnly = false } = {}
) {
    const remoteRecords = await fetchStoredRecords(table, { orderBy, ascending, limit });
    if (remoteRecords.length) return remoteRecords;
    if (localRecords.length) {
        if (insertOnly) await insertStoredRecords(table, localRecords);
        else await saveStoredRecords(table, localRecords);
    }
    return localRecords;
}

export async function saveStoredRecords(table, records) {
    if (!records.length) return;
    const { error } = await requireSupabase()
        .from(table)
        .upsert(records.map(record => toDatabaseRecord(table, record)));
    if (error) throw error;
}

export async function insertStoredRecords(table, records) {
    if (!records.length) return;
    const { error } = await requireSupabase()
        .from(table)
        .insert(records.map(record => toDatabaseRecord(table, record)));
    if (error) throw error;
}

export async function deleteStoredRecord(table, id) {
    const key = TABLE_KEYS[table];
    if (!key) throw new Error(`No primary key is configured for ${table}.`);
    const { error } = await requireSupabase().from(table).delete().eq(key, id);
    if (error) throw error;
}

export async function fetchReadState(table, username) {
    const idColumn = READ_TABLES[table];
    if (!idColumn) throw new Error(`No read-state key is configured for ${table}.`);
    const { data, error } = await requireSupabase()
        .from(table)
        .select(idColumn)
        .eq('username', username);
    if (error) throw error;
    return (data || []).map(row => row[idColumn]);
}

export async function saveReadState(table, username, ids) {
    const idColumn = READ_TABLES[table];
    if (!idColumn) throw new Error(`No read-state key is configured for ${table}.`);
    const client = requireSupabase();
    const { error: deleteError } = await client.from(table).delete().eq('username', username);
    if (deleteError) throw deleteError;
    if (!ids.length) return;
    const rows = ids.map(id => ({ username, [idColumn]: id }));
    const { error } = await client.from(table).upsert(rows);
    if (error) throw error;
}

export async function fetchRisReleases() {
    const { data, error } = await requireSupabase().from('ris_releases').select('*');
    if (error) throw error;
    return Object.fromEntries((data || []).map(row => {
        const release = fromDatabaseRecord('ris_releases', { ...row, asset_id: row.asset_id });
        return [release.assetId, {
            releasedAt: release.releasedAt,
            releasedBy: release.releasedBy,
            deducted: release.deducted
        }];
    }));
}

export async function saveRisReleases(releases) {
    const records = Object.entries(releases).map(([assetId, release]) => ({
        assetId,
        ...release
    }));
    if (!records.length) return;
    const { error } = await requireSupabase()
        .from('ris_releases')
        .upsert(records.map(record => toDatabaseRecord('ris_releases', record)));
    if (error) throw error;
}

// ----------------------------------------
// AUTHENTICATED ACCOUNT PROFILE
// ----------------------------------------
export async function fetchAccountProfile(authUserId) {
    const { data, error } = await requireSupabase()
        .from('account_profiles')
        .select('*')
        .eq('id', authUserId)
        .single();
    if (error) throw error;
    return data;
}

export async function updateAccountProfile(authUserId, changes) {
    const columns = {
        username: changes.username,
        display_name: changes.displayName,
        email: changes.email,
        phone: changes.phone,
        department: changes.department,
        designation: changes.designation
    };
    const update = Object.fromEntries(
        Object.entries(columns).filter(([, value]) => value !== undefined)
    );
    const { data, error } = await requireSupabase()
        .from('account_profiles')
        .update(update)
        .eq('id', authUserId)
        .select('*')
        .single();
    if (error) throw error;
    return data;
}
