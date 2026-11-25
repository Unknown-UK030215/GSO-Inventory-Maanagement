// ============================================================
// BULK ASSET IMPORT
// ------------------------------------------------------------
// Lets the GSO load many property records at once instead of
// registering them one by one: paste rows copied from Excel
// (tab-separated), upload a CSV, or upload an .xlsx workbook
// directly. Rows are validated first so bad entries can be
// fixed before anything is saved.
// ============================================================

import { departments } from '../data/sampleAssets';
import { classifyByCost, nextPropertyNo, validateAsset } from './assetService';

// Columns the importer accepts for a general asset record. The label is
// what appears in the downloadable template; the key is what gets stored.
export const IMPORT_COLUMNS = [
    { key: 'propertyNo', label: 'Property No.' },
    { key: 'description', label: 'Description' },
    { key: 'serialNo', label: 'Serial No.' },
    { key: 'article', label: 'Article' },
    { key: 'entryDate', label: 'Date' },
    { key: 'reference', label: 'ICS / RRSP No.' },
    { key: 'estimatedLife', label: 'Estimated Useful Life' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'unit', label: 'Unit' },
    { key: 'cost', label: 'Unit Cost' },
    { key: 'classification', label: 'Classification' },
    { key: 'category', label: 'Category' },
    { key: 'department', label: 'Department / Office' },
    { key: 'accountable', label: 'Accountable Person' },
    { key: 'location', label: 'Location' },
    { key: 'condition', label: 'Condition' },
    { key: 'status', label: 'Status' },
    { key: 'remarks', label: 'Remarks' }
];

// Defaults applied to any column left blank, matching the register form.
const DEFAULT_RECORD = {
    formType: 'general',
    propertyNo: '',
    description: '',
    serialNo: '',
    article: '',
    classification: 'Semi-Expendable',
    category: 'Office Equipment',
    quantity: 1,
    unit: 'Unit',
    cost: 0,
    department: departments[0],
    accountable: '',
    location: '',
    condition: 'Serviceable',
    status: 'Unassigned',
    remarks: ''
};

// Accept either the template label ("Property No.") or the raw key
// ("propertyNo"), ignoring case and punctuation.
const normalizeHeader = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Extra labels seen on the GSO's own Excel files (COA forms and other
// sheets) that should still land in the right field.
const HEADER_ALIASES = {
    semiexpendablepropertyno: 'propertyNo',
    propertynumber: 'propertyNo',
    itemdescription: 'description',
    particularsarticles: 'description',
    article: 'article',
    articlename: 'article',
    serialnumber: 'serialNo',
    serial: 'serialNo',
    date: 'entryDate',
    icsrrspno: 'reference',
    referenceno: 'reference',
    reference: 'reference',
    qty: 'quantity',
    quantity: 'quantity',
    unitcost: 'cost',
    amount: 'cost',
    value: 'cost',
    estimatedusefullife: 'estimatedLife',
    usefullife: 'estimatedLife',
    officeofficer: 'accountable',
    officerofficer: 'accountable',
    accountableperson: 'accountable',
    office: 'department',
    department: 'department',
    departmentoffice: 'department',
    condition: 'condition',
    status: 'status',
    remarks: 'remarks',
    location: 'location',
    category: 'category',
    classification: 'classification',
    unit: 'unit'
};

const HEADER_LOOKUP = new Map();
IMPORT_COLUMNS.forEach(column => {
    HEADER_LOOKUP.set(normalizeHeader(column.key), column.key);
    HEADER_LOOKUP.set(normalizeHeader(column.label), column.key);
});
Object.entries(HEADER_ALIASES).forEach(([alias, key]) => HEADER_LOOKUP.set(alias, key));

// Report which source columns were recognised, for the import preview.
export function mapHeaders(headerCells) {
    return (headerCells || []).map(cell => ({
        header: String(cell ?? '').trim(),
        to: HEADER_LOOKUP.get(normalizeHeader(cell)) || null
    }));
}

// Loose comparison key used for spotting near-duplicate records.
const norm = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const duplicateKey = record => {
    const description = norm(record.description);
    const serial = norm(record.serialNo);
    return description && serial ? `${description}|${serial}` : '';
};

// Split pasted or uploaded text into rows of cells. Handles CSV quoting and
// auto-detects tab-separated text copied straight out of a spreadsheet.
export function parseTable(text) {
    const clean = String(text || '').replace(/^\uFEFF/, '');
    if (!clean.trim()) return [];

    const firstLine = clean.split(/\r?\n/, 1)[0] || '';
    const delimiter = firstLine.includes('\t') ? '\t' : ',';

    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < clean.length; i += 1) {
        const char = clean[i];
        if (quoted) {
            if (char === '"') {
                if (clean[i + 1] === '"') {
                    field += '"';
                    i += 1;
                } else {
                    quoted = false;
                }
            } else {
                field += char;
            }
        } else if (char === '"') {
            quoted = true;
        } else if (char === delimiter) {
            row.push(field);
            field = '';
        } else if (char === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else if (char !== '\r') {
            field += char;
        }
    }

    if (field !== '' || row.length) {
        row.push(field);
        rows.push(row);
    }

    return rows;
}

// Turn parsed rows into records keyed by their canonical column keys,
// using the first row as the header.
export function rowsToObjects(rows) {
    if (!rows.length) return [];

    const [header, ...body] = rows;
    const keys = header.map(cell => HEADER_LOOKUP.get(normalizeHeader(cell)) || null);

    return body
        .filter(cells => cells.some(cell => String(cell).trim() !== ''))
        .map(cells => {
            const record = {};
            keys.forEach((key, index) => {
                if (key) record[key] = String(cells[index] ?? '').trim();
            });
            return record;
        });
}

// Build storable records from raw objects, flagging any row that would fail
// validation so the user can fix it before importing. Blank property numbers
// are issued automatically, continuing from the numbers already on record.
export function buildImportRows(rawObjects, existing) {
    const pool = Array.isArray(existing) ? existing : [];
    const usedNumbers = new Set(
        pool.map(asset => String(asset.propertyNo || '').trim()).filter(Boolean)
    );
    // Same description + serial number means the item is already on record.
    const usedKeys = new Set(pool.map(duplicateKey).filter(Boolean));
    const accepted = [];

    return rawObjects.map((raw, index) => {
        const record = { ...DEFAULT_RECORD };

        IMPORT_COLUMNS.forEach(column => {
            if (raw[column.key] !== undefined && raw[column.key] !== '') {
                record[column.key] = raw[column.key];
            }
        });

        const quantity = Number(record.quantity);
        if (Number.isFinite(quantity)) record.quantity = quantity;

        const cost = Number(record.cost);
        record.cost = Number.isFinite(cost) && cost >= 0 ? cost : 0;

        if (!record.classification) record.classification = classifyByCost(record.cost);

        const errors = [];
        const supplied = String(record.propertyNo || '').trim();

        if (supplied) {
            if (usedNumbers.has(supplied)) {
                errors.push(`Property number ${supplied} already exists in the register`);
            }
        } else {
            record.propertyNo = nextPropertyNo([...pool, ...accepted]);
        }

        const key = duplicateKey(record);
        if (key && usedKeys.has(key)) {
            errors.push('A record with the same description and serial number already exists');
        }

        try {
            validateAsset(record);
        } catch (err) {
            errors.push(err.message);
        }

        if (!errors.length) {
            usedNumbers.add(String(record.propertyNo).trim());
            if (key) usedKeys.add(key);
            accepted.push(record);
        }

        return { line: index + 1, record, errors, valid: errors.length === 0 };
    });
}

// Convenience: parse text straight into preview rows for the table.
export function previewImport(text, existing) {
    const rows = parseTable(text);
    return buildImportRows(rowsToObjects(rows), existing);
}

// Read a cell value into plain text (handles dates, formulas, rich text).
function cellText(cell) {
    const value = cell?.value;

    if (value == null) return '';
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }
    if (typeof value === 'object') {
        if (Array.isArray(value.richText)) {
            return value.richText.map(part => part.text).join('');
        }
        if (value.result != null) return String(value.result);
        if (value.text != null) return String(value.text);
        return '';
    }
    return String(value);
}

// Read an uploaded .xlsx workbook: pick the sheet/row that looks like a
// header (the COA forms carry several title rows above theirs) and turn
// the table under it into preview rows.
export async function previewWorkbook(buffer, existing) {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    let best = null;

    wb.eachSheet(ws => {
        const limit = Math.min(ws.rowCount, 12);
        for (let r = 1; r <= limit; r += 1) {
            const row = ws.getRow(r);
            const cells = [];
            for (let c = 1; c <= ws.columnCount; c += 1) {
                cells[c - 1] = cellText(row.getCell(c));
            }
            const mapped = cells.filter(cell => HEADER_LOOKUP.has(normalizeHeader(cell))).length;
            if (mapped >= 2 && (!best || mapped > best.mapped)) {
                best = { ws, headerRow: r, mapped };
            }
        }
    });

    if (!best) return { rows: [], headers: [], mapping: [], sheet: '' };

    const { ws, headerRow } = best;
    const table = [];
    for (let r = headerRow; r <= ws.rowCount; r += 1) {
        const row = ws.getRow(r);
        const cells = [];
        for (let c = 1; c <= ws.columnCount; c += 1) {
            cells[c - 1] = cellText(row.getCell(c));
        }
        table.push(cells);
    }

    const header = table[0] || [];
    const body = table.slice(1).filter(cells => cells.some(cell => String(cell).trim() !== ''));

    return {
        rows: buildImportRows(rowsToObjects([header, ...body]), existing),
        headers: header,
        mapping: mapHeaders(header),
        sheet: ws.name || ''
    };
}

// Download a blank template with the column headers and one sample row.
export function downloadTemplate() {
    const headers = IMPORT_COLUMNS.map(column => column.label);
    const sample = {
        'Property No.': '',
        Description: 'Sample: Folding Table',
        'Serial No.': '',
        Article: '',
        Date: '',
        'ICS / RRSP No.': '',
        'Estimated Useful Life': '',
        Quantity: '5',
        Unit: 'Unit',
        'Unit Cost': '1200',
        Classification: 'Semi-Expendable',
        Category: 'Furniture & Fixtures',
        'Department / Office': departments[0],
        'Accountable Person': '',
        Location: '',
        Condition: 'Serviceable',
        Status: 'Unassigned',
        Remarks: ''
    };

    const line = values => values
        .map(value => `"${String(value ?? '').replaceAll('"', '""')}"`)
        .join(',');
    const csv = [
        line(headers),
        line(headers.map(header => sample[header] ?? ''))
    ].join('\n');

    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gso-asset-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);

    return IMPORT_COLUMNS.length;
}
