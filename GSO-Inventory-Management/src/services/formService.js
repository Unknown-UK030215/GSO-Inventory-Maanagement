import ExcelJS from 'exceljs';
import { ASSET_FORMS } from '../data/assetForms';

// El Nido logo, inlined as a base64 data URI so it can be embedded in exports.
import STICKER_LOGO from '../assets/Elnido-Logo.png?inline';

// ============================================================
// SHARED STYLES & HELPERS
// ============================================================
const BOX = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
};

const HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF5' } };
const FONT = { name: 'Calibri' };

const usd = '#,##0.00';

// Every data table is rendered with at least this many rows (empty bordered rows
// pad the rest); rows are only added beyond this limit when there are more records.
const MIN_DATA_ROWS = 16;

// Set worksheet column widths
function widths(ws, list) {
    ws.columns = list.map(w => ({ width: w }));
}

// Apply a thin border around a rectangular range
function border(ws, r1, c1, r2, c2) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            ws.getCell(r, c).border = BOX;
        }
    }
}

// Fill `count` empty, bordered rows so the data area always spans at least
// MIN_DATA_ROWS. Used to keep government forms a consistent printable height.
function padRows(ws, r, colCount, count) {
    for (let i = 0; i < count; i++) {
        for (let c = 1; c <= colCount; c++) {
            const cell = ws.getCell(r + i, c);
            cell.value = '';
            cell.border = BOX;
            cell.font = FONT;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        ws.getRow(r + i).height = 20;
    }
}

// Number of padding rows needed to reach MIN_DATA_ROWS for a given record count.
function padCount(count) {
    return Math.max(0, MIN_DATA_ROWS - count);
}

// Write a single styled cell
function put(ws, row, col, value, opts = {}) {
    const {
        bold = false,
        size = 10,
        align = 'left',
        fill = false,
        wrap = true,
        numFmt = null
    } = opts;

    const cell = ws.getCell(row, col);
    cell.value = value ?? '';
    cell.font = { ...FONT, bold, size };
    cell.alignment = { horizontal: align, vertical: 'middle', wrapText: wrap };

    if (fill) cell.fill = HEAD_FILL;
    if (numFmt) cell.numFmt = numFmt;

    return cell;
}

// Centered merged title across `span` columns
function title(ws, row, span, text, size = 13, height = 22) {
    ws.mergeCells(row, 1, row, span);
    const cell = ws.getCell(row, 1);
    cell.value = text;
    cell.font = { ...FONT, bold: true, size };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    ws.getRow(row).height = height;

    return row + 1;
}

// Left merged label line across `span` columns
function line(ws, row, span, text, bold = false) {
    ws.mergeCells(row, 1, row, span);
    const cell = ws.getCell(row, 1);
    cell.value = text;
    cell.font = { ...FONT, bold, size: 10 };
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

    return row + 1;
}

// Header row (adds fill + border + height)
function head(ws, row, cols) {
    cols.forEach((h, i) => put(ws, row, i + 1, h, { bold: true, align: 'center', fill: true }));
    ws.getRow(row).height = 28;
    border(ws, row, 1, row, cols.length);

    return row + 1;
}

// Stack of free-text lines (used for signature blocks)
function block(ws, row, colStart, lines) {
    lines.forEach((text, i) => {
        const cell = ws.getCell(row + i, colStart);
        cell.value = text ?? '';
        cell.font = { ...FONT, size: 10, bold: i === 0 };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    return row + lines.length;
}

// Standard three-column certification block used by all RPC forms:
// Certified Correct by / Approved by / Verified by.
function rpcSignatures(ws, r, colCount) {
    const c1 = 1;
    const c2 = Math.ceil(colCount * 0.4);
    const c3 = Math.ceil(colCount * 0.72);

    block(ws, r, c1, [
        'Certified Correct by:',
        'ENGR. REMEDIOS A. ULANDAY',
        'Signature over Printed Name of',
        'Inventory Committee Chair and Members'
    ]);
    block(ws, r, c2, [
        'Approved by:',
        'HON. EDNA GACOT-LIM',
        'Municipal Mayor',
        'Signature over Printed Name of Head of',
        'Agency/Entity or Authorized Representative'
    ]);
    block(ws, r, c3, [
        'Verified by:',
        '____________________________',
        'Signature over Printed Name of',
        'COA Representative'
    ]);

    return r + 5;
}

// Print-ready page setup (A4, fit to one page wide)
function page(ws, { landscape = false, titles = null } = {}) {
    ws.pageSetup = {
        paperSize: 9,
        orientation: landscape ? 'landscape' : 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        horizontalCentered: true,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
    };

    if (titles) ws.pageSetup.printTitlesRow = titles;
}

const ENTITY = 'Municipal Government of El Nido';

// ============================================================
// 1) ICS — INVENTORY CUSTODIAN SLIP (Appendix 59)
// ============================================================
function buildICS(wb, assets) {
    const ws = wb.addWorksheet('ICS');
    const columnCount = 7;
    const firstItemRow = 12;
    const itemRows = Math.max(24, assets.length);
    const lastItemRow = firstItemRow + itemRows - 1;
    const signatureRow = lastItemRow + 1;
    widths(ws, [12, 11, 15, 16, 48, 22, 22]);
    ws.views = [{ showGridLines: false }];
    ws.properties.defaultRowHeight = 15;

    ws.mergeCells(4, 1, 4, columnCount);
    put(ws, 4, 1, 'Appendix 59', { italic: true, size: 9, align: 'center' });
    ws.mergeCells(6, 1, 6, columnCount);
    put(ws, 6, 1, 'INVENTORY CUSTODIAN SLIP', { bold: true, size: 12, align: 'center' });
    ws.getRow(6).height = 22;

    put(ws, 8, 1, 'Entity Name:', { size: 9 });
    ws.mergeCells(8, 2, 8, columnCount);
    ws.getCell(8, 2).border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } };

    put(ws, 9, 1, 'Fund Cluster:', { size: 9 });
    ws.mergeCells(9, 2, 9, 3);
    put(ws, 9, 2, assets[0]?.fundCluster || '', { size: 9 });
    ws.getCell(9, 2).border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } };
    put(ws, 9, 4, 'ICS No.:', { size: 9 });
    ws.mergeCells(9, 5, 9, columnCount);
    put(ws, 9, 5, assets[0]?.icsNo || '', { size: 9 });
    ws.getCell(9, 5).border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } };

    ws.mergeCells(10, 1, 11, 1);
    ws.mergeCells(10, 2, 11, 2);
    ws.mergeCells(10, 3, 10, 4);
    ws.mergeCells(10, 5, 11, 5);
    ws.mergeCells(10, 6, 11, 6);
    ws.mergeCells(10, 7, 11, 7);
    put(ws, 10, 1, 'Quantity', { align: 'center', fill: true });
    put(ws, 10, 2, 'Unit', { align: 'center', fill: true });
    put(ws, 10, 3, 'Amount', { bold: true, align: 'center', fill: true });
    put(ws, 10, 5, 'Description', { align: 'center', fill: true });
    put(ws, 10, 6, 'Inventory Item No.', { align: 'center', fill: true });
    put(ws, 10, 7, 'Estimated Useful Life', { align: 'center', fill: true });
    put(ws, 11, 3, 'Unit Cost', { align: 'center', fill: true });
    put(ws, 11, 4, 'Total Cost', { align: 'center', fill: true });
    border(ws, 10, 1, 11, columnCount);
    ws.getRow(10).height = 28;
    ws.getRow(11).height = 25;

    const verticalBorder = { style: 'thin', color: { argb: 'FF000000' } };
    for (let i = 0; i < itemRows; i++) {
        const row = firstItemRow + i;
        const asset = assets[i];
        const qty = Number(asset?.quantity || 0);
        const cost = Number(asset?.cost || 0);
        put(ws, row, 1, asset ? qty : '', { align: 'center', size: 9 });
        put(ws, row, 2, asset?.unit || '', { align: 'center', size: 9 });
        put(ws, row, 3, asset ? cost : '', { align: 'right', size: 9, numFmt: usd });
        put(ws, row, 4, asset ? qty * cost : '', { align: 'right', size: 9, numFmt: usd });
        put(ws, row, 5, asset?.description || '', { align: 'left', size: 9 });
        put(ws, row, 6, asset?.propertyNo || '', { align: 'center', size: 9 });
        put(ws, row, 7, asset?.estimatedLife || '', { align: 'center', size: 9 });
        for (let column = 1; column <= columnCount; column++) {
            const cell = ws.getCell(row, column);
            cell.border = {
                left: verticalBorder,
                right: verticalBorder,
                ...(i === 0 ? { top: verticalBorder } : {}),
                ...(i === itemRows - 1 ? { bottom: verticalBorder } : {})
            };
        }
        ws.getRow(row).height = 17;
    }

    const leftLabels = [
        ['Received from:', false],
        ['Engr. REMEDIOS A. ULANDAY', true],
        ['Signature Over Printed Name', false],
        ['MGDH-I / GSO', true],
        ['Position/Office', false],
        ['____________________________', false],
        ['Date', false]
    ];
    const rightLabels = [
        ['Received by:', false],
        ['____________________________', false],
        ['Signature Over Printed Name', false],
        ['____________________________', false],
        ['Position/Office', false],
        ['____________________________', false],
        ['Date', false]
    ];
    leftLabels.forEach(([label, bold], index) => {
        const row = signatureRow + index;
        ws.mergeCells(row, 1, row, 4);
        ws.mergeCells(row, 5, row, 7);
        put(ws, row, 1, label, { bold, align: index === 0 ? 'left' : 'center', size: 9 });
        put(ws, row, 5, rightLabels[index][0], {
            bold: rightLabels[index][1],
            align: index === 0 ? 'left' : 'center',
            size: 9
        });
        if (index === 1 || index === 5) {
            ws.getCell(row, 1).border = { bottom: verticalBorder };
            ws.getCell(row, 5).border = { bottom: verticalBorder };
        }
        ws.getRow(row).height = index === 0 ? 18 : 17;
    });

    const footerRow = signatureRow + leftLabels.length;
    put(ws, footerRow, 1, 'P.O Number:', { size: 8 });
    ws.mergeCells(footerRow, 2, footerRow, 4);
    put(ws, footerRow, 2, '', { size: 8 });
    ws.getCell(footerRow, 2).border = { bottom: verticalBorder };
    put(ws, footerRow + 1, 1, 'Supplier:', { size: 8 });
    ws.mergeCells(footerRow + 1, 2, footerRow + 1, 4);
    put(ws, footerRow + 1, 2, '', { size: 8 });
    ws.getCell(footerRow + 1, 2).border = { bottom: verticalBorder };

    page(ws, { landscape: true });
    ws.pageSetup.fitToHeight = 1;
    ws.pageSetup.printArea = `A1:G${footerRow + 1}`;
}

// ============================================================
// 2) PARE — PROPERTY ACKNOWLEDGEMENT RECEIPT FOR EQUIPMENT (Appendix 9-8)
// ============================================================
function buildPARE(wb, assets) {
    const ws = wb.addWorksheet('PARE');
    widths(ws, [10, 10, 34, 16, 14, 20]);

    let r = 1;
    r = title(ws, r, 6, 'PROPERTY ACKNOWLEDGEMENT RECEIPT FOR EQUIPMENT');
    r = title(ws, r, 6, '(Appendix 9-8)', 9, 16);
    r = line(ws, r, 6, 'PARE Number: ____________________                                            Agency: ' + ENTITY);
    r++;

    r = head(ws, r, ['Quantity', 'Unit', 'Description', 'Acquisition Date', 'Unit Value', 'Property No.']);

    let total = 0;
    assets.forEach(a => {
        const qty = Number(a.quantity || 0);
        const cost = Number(a.cost || 0);
        total += qty * cost;

        put(ws, r, 1, qty, { align: 'center' });
        put(ws, r, 2, a.unit || '', { align: 'center' });
        put(ws, r, 3, a.description || '');
        put(ws, r, 4, '', { align: 'center' });
        put(ws, r, 5, cost, { align: 'right', numFmt: usd });
        put(ws, r, 6, a.propertyNo || '', { align: 'center' });
        border(ws, r, 1, r, 6);
        r++;
    });

    const pad = padCount(assets.length);
    padRows(ws, r, 6, pad);
    r += pad;

    put(ws, r, 5, 'TOTAL', { bold: true, align: 'right', fill: true });
    put(ws, r, 6, total, { bold: true, align: 'right', fill: true, numFmt: usd });
    border(ws, r, 1, r, 6);
    r += 2;

    block(ws, r, 1, ['Received by:', '____________________________', '____________________________', 'Signature Over Printed Name']);
    block(ws, r, 4, ['Received from:', 'Engr. REMEDIOS A. ULANDAY', 'MGDH-I / GSO', 'Signature Over Printed Name']);
    r += 4;
    r++;
    r = line(ws, r, 6, 'P.O number: ____________________                       Supplier: ____________________');

    page(ws);
}

// ============================================================
// 4/5) IIRUP (PPE) and IIRU-SP (Semi-Expendable)
// ============================================================
function writeIIRUP(ws, assets, { semi = false, office = null } = {}) {
    widths(ws, [13, 28, 18, 8, 12, 13, 15, 16, 13, 14, 10, 10, 11, 12, 11, 12, 10, 12]);

    const heading = semi
        ? 'INVENTORY AND INSPECTION REPORT OF UNSERVICEABLE SEMI-EXPENDABLE PROPERTY'
        : 'INVENTORY AND INSPECTION REPORT OF UNSERVICEABLE PROPERTY';
    const docRef = semi ? 'Annex A.10' : 'Appendix 67';
    const propCol = semi ? 'Semi-expendable Property No.' : 'Property No.';

    let r = 1;
    r = title(ws, r, 18, heading);
    r = title(ws, r, 18, `${docRef}      As at Year: __________`, 9, 16);
    const lgu = office ? `LGU: ${ENTITY}     Office: ${office}` : `LGU: ${ENTITY}`;
    r = line(ws, r, 18, lgu + '                                                  Fund: ____________________');
    r++;

    // Grouped header
    put(ws, r, 1, 'INVENTORY', { bold: true, align: 'center', fill: true });
    ws.mergeCells(r, 1, r, 10);
    put(ws, r, 11, 'INSPECTION and DISPOSAL', { bold: true, align: 'center', fill: true });
    ws.mergeCells(r, 11, r, 18);
    border(ws, r, 1, r, 18);
    r++;

    r = head(ws, r, [
        'Date Acquired', 'Particulars/Articles', propCol, 'Quantity', 'Unit Cost', 'Total Cost',
        'Accumulated Depreciation', 'Accumulated Impairment Losses', 'Carrying Amount', 'Remarks',
        'Sale', 'Transfer', 'Destruction', 'Others (Specify)', 'Total', 'Appraised Value', 'OR No.', 'Amount'
    ]);

    let totalCost = 0;
    assets.forEach(a => {
        const qty = Number(a.quantity || 0);
        const cost = Number(a.cost || 0);
        totalCost += qty * cost;

        put(ws, r, 1, '', { align: 'center' });
        put(ws, r, 2, a.description || '');
        put(ws, r, 3, a.propertyNo || '', { align: 'center' });
        put(ws, r, 4, qty, { align: 'center' });
        put(ws, r, 5, cost, { align: 'right', numFmt: usd });
        put(ws, r, 6, qty * cost, { align: 'right', numFmt: usd });
        put(ws, r, 7, '', { align: 'right' });
        put(ws, r, 8, '', { align: 'right' });
        put(ws, r, 9, qty * cost, { align: 'right', numFmt: usd });
        put(ws, r, 10, a.remarks || '');
        for (let c = 11; c <= 18; c++) put(ws, r, c, '', { align: 'center' });
        border(ws, r, 1, r, 18);
        r++;
    });

    const pad = padCount(assets.length);
    padRows(ws, r, 18, pad);
    r += pad;

    put(ws, r, 5, 'TOTAL', { bold: true, align: 'right', fill: true });
    put(ws, r, 6, totalCost, { bold: true, align: 'right', fill: true, numFmt: usd });
    put(ws, r, 9, totalCost, { bold: true, align: 'right', fill: true, numFmt: usd });
    border(ws, r, 1, r, 18);
    r += 2;

    ws.mergeCells(r, 1, r + 2, 6);
    put(ws, r, 1, 'I HEREBY request inspection and disposition, pursuant to Section 79 of PD 1445, of the property enumerated above.');
    ws.getCell(r, 1).alignment = { horizontal: 'left', vertical: 'top', wrapText: true };

    ws.mergeCells(r, 11, r + 2, 18);
    put(ws, r, 11, 'I CERTIFY that I have inspected each and every article enumerated in this report, and that the disposition made thereof was, in my judgment, the best for the public interest.');
    ws.getCell(r, 11).alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
    r += 4;

    block(ws, r, 1, ['Requested by:', '____________________________', 'Accountable Officer']);
    block(ws, r, 5, ['Approved by:', 'HON. EDNA GACOT-LIM', 'Municipal Mayor', 'Authorized Official']);
    block(ws, r, 11, ['Inspected by:', 'ROMEL N. CARO', 'Supply Officer - I', 'Inspection Officer']);
    block(ws, r, 16, ['Witness:', '____________________________', 'Witness']);

    page(ws, { landscape: true });
}

function buildIIRUP(wb, assets, opts = {}) {
    const ws = wb.addWorksheet(opts.semi ? 'IIRUP-SP' : 'IIRUP');
    writeIIRUP(ws, assets, opts);
}

// One sheet per accountable office (mirrors the per-office IIRUP files)
function buildIIRUPByOffice(wb, assets) {
    const groups = new Map();
    assets.forEach(a => {
        const key = a.department || 'Unassigned';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(a);
    });
    if (!groups.size) groups.set('Unassigned', []);

    const used = new Set();
    groups.forEach((items, dept) => {
        let name = String(dept).replace(/[\\/?*[\]:]/g, '-').slice(0, 28) || 'Office';
        while (used.has(name)) name = name.slice(0, 26) + '_' + used.size;
        used.add(name);

        const ws = wb.addWorksheet(name);
        writeIIRUP(ws, items, { semi: false, office: dept });
    });
}

// ============================================================
// 6) ITR — INVENTORY TRANSFER REPORT (Annex A.5)
// ============================================================
function buildITR(wb, assets) {
    const ws = wb.addWorksheet('ITR');
    widths(ws, [16, 9, 20, 34, 14, 20]);

    let r = 1;
    r = title(ws, r, 6, 'INVENTORY TRANSFER REPORT');
    r = title(ws, r, 6, '(Annex A.5)', 9, 16);
    r = line(ws, r, 6, `Entity Name: ${ENTITY}`);
    r = line(ws, r, 6, 'From Accountable Officer/Agency/Fund Cluster: ____________________     To Accountable Officer/Agency/Fund Cluster: ____________________');
    r = line(ws, r, 6, 'ITR No.: ______________                                   Date: ______________');
    r = line(ws, r, 6, 'Transfer Type (check one):  [  ] Donation    [  ] Reassignment    [  ] Relocate    [  ] Other (Specify): ____________');
    r++;

    r = head(ws, r, ['Date Acquired', 'Item No.', 'PARE/ICS No./Date', 'Description', 'Amount', 'Condition of Inventory']);

    let total = 0;
    assets.forEach((a, i) => {
        const amount = Number(a.cost || 0) * Number(a.quantity || 0);
        total += amount;

        put(ws, r, 1, '', { align: 'center' });
        put(ws, r, 2, i + 1, { align: 'center' });
        put(ws, r, 3, a.propertyNo || '', { align: 'center' });
        put(ws, r, 4, a.description || '');
        put(ws, r, 5, amount, { align: 'right', numFmt: usd });
        put(ws, r, 6, a.condition || '', { align: 'center' });
        border(ws, r, 1, r, 6);
        r++;
    });

    const pad = padCount(assets.length);
    padRows(ws, r, 6, pad);
    r += pad;

    put(ws, r, 4, 'TOTAL', { bold: true, align: 'right', fill: true });
    put(ws, r, 5, total, { bold: true, align: 'right', fill: true, numFmt: usd });
    put(ws, r, 6, '', { fill: true });
    border(ws, r, 1, r, 6);
    r += 2;

    r = line(ws, r, 6, 'Reason/s for Transfer:');
    r = line(ws, r, 6, '______________________________________________________________');
    r = line(ws, r, 6, '______________________________________________________________');
    r += 1;

    block(ws, r, 1, ['Approved by:', '____________________________', 'REMEDIOS A. ULANDAY', 'MGDH-I', 'Date: ____________']);
    block(ws, r, 3, ['Released/issued by:', '____________________________', 'ROMEL N. CARO', 'SUPPLY OFFICER-II', 'Date: ____________']);
    block(ws, r, 5, ['Received by:', '____________________________', '____________________________', '____________________________', 'Date: ____________']);

    page(ws);
}

// ============================================================
// 7) LIST OF NON-EXISTING / MISSING PPEs
// ============================================================
function buildMissing(wb, assets) {
    const ws = wb.addWorksheet('Missing PPEs');
    widths(ws, [24, 30, 22, 22, 14, 14, 20, 20]);

    let r = 1;
    r = title(ws, r, 8, 'LIST OF NON-EXISTING / MISSING PPEs');
    r = line(ws, r, 8, `Agency Name: ${ENTITY}`);
    r = line(ws, r, 8, 'PPE Account Group: ______________________________');
    r++;

    r = head(ws, r, ['Article/Item', 'Description', 'Old Property No. assigned', 'Person Accountable', 'Unit Cost Value', 'Total Cost Value', 'Remark', 'Location/Whereable']);

    let total = 0;
    assets.forEach(a => {
        const qty = Number(a.quantity || 0);
        const cost = Number(a.cost || 0);
        total += qty * cost;

        put(ws, r, 1, a.category || '');
        put(ws, r, 2, a.description || '');
        put(ws, r, 3, a.propertyNo || '', { align: 'center' });
        put(ws, r, 4, a.accountable || '');
        put(ws, r, 5, cost, { align: 'right', numFmt: usd });
        put(ws, r, 6, qty * cost, { align: 'right', numFmt: usd });
        put(ws, r, 7, a.remarks || '');
        put(ws, r, 8, a.location || '');
        border(ws, r, 1, r, 8);
        r++;
    });

    const pad = padCount(assets.length);
    padRows(ws, r, 8, pad);
    r += pad;

    put(ws, r, 5, 'TOTAL', { bold: true, align: 'right', fill: true });
    put(ws, r, 6, total, { bold: true, align: 'right', fill: true, numFmt: usd });
    border(ws, r, 1, r, 8);
    r += 2;

    block(ws, r, 1, ['Prepared by:', 'Engr. Remedios A. Ulanday', 'Property Officer / MGSO', 'Date: ____________']);

    page(ws, { landscape: true });
}

// ============================================================
// 8) LIST OF UNSERVICEABLE / DISPOSED EQUIPMENT
// ============================================================
function buildUnserviceable(wb, assets) {
    const ws = wb.addWorksheet('Unserviceable');
    widths(ws, [6, 34, 8, 14, 20, 22, 22, 12, 14]);

    let r = 1;
    r = title(ws, r, 9, 'Republic of the Philippines', 10, 16);
    r = title(ws, r, 9, 'Province of Palawan', 10, 16);
    r = title(ws, r, 9, 'Municipal Government of El Nido', 10, 16);
    r = title(ws, r, 9, 'LIST OF UNSERVICEABLE / DISPOSED PROPERTY OF LGU');
    r++;

    r = head(ws, r, ['NO', 'Name of Item/Description', 'QTY', 'Amount', 'Serial Number', 'Office', 'Accountable Officer', 'Year Acquired', 'Date of Returned']);

    let total = 0;
    assets.forEach((a, i) => {
        const amount = Number(a.cost || 0) * Number(a.quantity || 0);
        total += amount;

        put(ws, r, 1, i + 1, { align: 'center' });
        put(ws, r, 2, a.description || '');
        put(ws, r, 3, a.quantity ?? '', { align: 'center' });
        put(ws, r, 4, amount, { align: 'right', numFmt: usd });
        put(ws, r, 5, '', { align: 'center' });
        put(ws, r, 6, a.department || '');
        put(ws, r, 7, a.accountable || '');
        put(ws, r, 8, '', { align: 'center' });
        put(ws, r, 9, '', { align: 'center' });
        border(ws, r, 1, r, 9);
        r++;
    });

    const pad = padCount(assets.length);
    padRows(ws, r, 9, pad);
    r += pad;

    put(ws, r, 3, 'TOTAL', { bold: true, align: 'right', fill: true });
    put(ws, r, 4, total, { bold: true, align: 'right', fill: true, numFmt: usd });
    border(ws, r, 1, r, 9);

    page(ws, { landscape: true });
}

// ============================================================
// 9) REPORT ON LRN WITH NO CORRESPONDING RECORD IN THE MEO
// ============================================================
function buildMEO(wb, assets) {
    const ws = wb.addWorksheet('No MEO Record');
    widths(ws, [30, 44, 16, 22, 14, 20]);

    let r = 1;
    r = title(ws, r, 6, 'REPORT ON LRN WITH NO CORRESPONDING RECORD IN THE MUNICIPAL ENGINEERING OFFICE');
    r++;

    // Group by location (barangay)
    const groups = new Map();
    assets.forEach(a => {
        const key = a.location || 'Unspecified';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(a);
    });

    [...groups.entries()]
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
        .forEach(([location, items]) => {
            r = line(ws, r, 6, '   ' + location, true);
            r = head(ws, r, ['Property Number', 'Description', 'Acquisition Date', 'Acquisition Cost per Accounting', 'MEO Record', 'Remarks']);

            let subtotal = 0;
            items.forEach(a => {
                subtotal += Number(a.cost || 0);

                put(ws, r, 1, a.propertyNo || '', { align: 'center' });
                put(ws, r, 2, a.description || '');
                put(ws, r, 3, '', { align: 'center' });
                put(ws, r, 4, Number(a.cost || 0), { align: 'right', numFmt: usd });
                put(ws, r, 5, 'No Record', { align: 'center' });
                put(ws, r, 6, a.remarks || '');
                border(ws, r, 1, r, 6);
                r++;
            });

            const pad = padCount(items.length);
            padRows(ws, r, 6, pad);
            r += pad;

            put(ws, r, 3, 'Subtotal', { bold: true, align: 'right', fill: true });
            put(ws, r, 4, subtotal, { bold: true, align: 'right', fill: true, numFmt: usd });
            border(ws, r, 1, r, 6);
            r += 2;
        });

    page(ws, { landscape: true });
}

// ============================================================
// 10) PROPERTY CARD (Annex 37) — one sheet per asset
// ============================================================
function buildPropertyCard(wb, assets) {
    const used = new Set();

    assets.forEach(a => {
        let name = String(a.propertyNo || 'Card').replace(/[\\/?*[\]:]/g, '-').slice(0, 28);
        while (used.has(name)) name = name.slice(0, 26) + '_' + used.size;
        used.add(name);

        const ws = wb.addWorksheet(name);
        widths(ws, [13, 22, 34, 10, 12, 22, 12]);

        let r = 1;
        r = title(ws, r, 7, 'PROPERTY CARD', 13);
        r = title(ws, r, 7, 'Annex 37 — El Nido, Palawan — LGU', 9, 16);
        r = line(ws, r, 7, `Plant, Property & Equipment: ${a.category || ''}        Property Classification No.: ${a.propertyNo || ''}`);
        r++;

        r = head(ws, r, ['Date', 'Reference/Property No.', 'Description', 'Receipt Qty.', 'Transfer/etc. Qty.', 'Office/Officer', 'Balance Qty.']);

        const qty = Number(a.quantity || 0);
        put(ws, r, 1, '', { align: 'center' });
        put(ws, r, 2, a.propertyNo || '', { align: 'center' });
        put(ws, r, 3, a.description || '');
        put(ws, r, 4, qty, { align: 'center' });
        put(ws, r, 5, '', { align: 'center' });
        put(ws, r, 6, `${a.department || ''}`, { align: 'center' });
        put(ws, r, 7, qty, { align: 'center' });
        border(ws, r, 1, r, 7);
        r++;

        padRows(ws, r, 7, MIN_DATA_ROWS - 1);
        r += MIN_DATA_ROWS - 1;

        r = line(ws, r, 7, 'For Property Office use', true);

        page(ws, { landscape: true });
    });
}

// ============================================================
// 11) RPC OF LAND & LAND IMPROVEMENTS (Appendix 62)
// ============================================================
function buildRPC62(wb, assets) {
    const ws = wb.addWorksheet('Appendix 62');
    widths(ws, [20, 22, 24, 36, 18, 16, 20]);

    let r = 1;
    r = title(ws, r, 7, 'REPORT ON THE PHYSICAL COUNT OF LAND & LAND IMPROVEMENTS');
    r = title(ws, r, 7, 'Appendix 62', 9, 16);
    r = line(ws, r, 7, 'As at ______________________');
    r = line(ws, r, 7, 'For which ______________________________ (Name of Accountable Officer/Designation)');
    r = line(ws, r, 7, '______________ (Date of Assumption)');
    r++;

    r = head(ws, r, ['ID No.', 'Classification', 'Location', 'Description', 'Carrying Amount', 'Condition', 'Remarks']);

    let total = 0;
    assets.forEach(a => {
        const amount = Number(a.cost || 0) * Number(a.quantity || 0);
        total += amount;

        put(ws, r, 1, a.propertyNo || '', { align: 'center' });
        put(ws, r, 2, a.classification || '');
        put(ws, r, 3, a.location || '');
        put(ws, r, 4, a.description || '');
        put(ws, r, 5, amount, { align: 'right', numFmt: usd });
        put(ws, r, 6, a.condition || '');
        put(ws, r, 7, a.remarks || '');
        border(ws, r, 1, r, 7);
        r++;
    });

    const pad = padCount(assets.length);
    padRows(ws, r, 7, pad);
    r += pad;

    put(ws, r, 4, 'TOTAL', { bold: true, align: 'right', fill: true });
    put(ws, r, 5, total, { bold: true, align: 'right', fill: true, numFmt: usd });
    border(ws, r, 1, r, 7);
    r += 2;

    rpcSignatures(ws, r, 7);

    page(ws, { landscape: true });
}

// ============================================================
// 12) RPC OF LOCAL ROAD NETWORK (Appendix 63)
// ============================================================
function buildRPC63(wb, assets) {
    const ws = wb.addWorksheet('Appendix 63');
    widths(ws, [20, 24, 20, 34, 18, 16, 16, 20]);

    let r = 1;
    r = title(ws, r, 8, 'REPORT ON THE PHYSICAL COUNT OF LOCAL ROAD NETWORK');
    r = title(ws, r, 8, 'Appendix 63', 9, 16);
    r = line(ws, r, 8, 'As at ______________________');
    r = line(ws, r, 8, 'For which ______________________________ (Name of Accountable Officer/Designation)');
    r = line(ws, r, 8, '______________ (Date of Assumption)');
    r++;

    r = head(ws, r, ['Road Network ID No.', 'Road Name', 'Components', 'Description', 'Date Constructed', 'Cost', 'Condition', 'Remarks']);

    let total = 0;
    assets.forEach(a => {
        const cost = Number(a.cost || 0) * Number(a.quantity || 0);
        total += cost;

        put(ws, r, 1, a.propertyNo || '', { align: 'center' });
        put(ws, r, 2, a.description || '');
        put(ws, r, 3, a.classification || '');
        put(ws, r, 4, a.category || '');
        put(ws, r, 5, '', { align: 'center' });
        put(ws, r, 6, cost, { align: 'right', numFmt: usd });
        put(ws, r, 7, a.condition || '');
        put(ws, r, 8, a.remarks || '');
        border(ws, r, 1, r, 8);
        r++;
    });

    const pad = padCount(assets.length);
    padRows(ws, r, 8, pad);
    r += pad;

    put(ws, r, 5, 'TOTAL', { bold: true, align: 'right', fill: true });
    put(ws, r, 6, total, { bold: true, align: 'right', fill: true, numFmt: usd });
    border(ws, r, 1, r, 8);
    r += 2;

    rpcSignatures(ws, r, 8);

    page(ws, { landscape: true });
}

// ============================================================
// 13) RPC OF OTHER PUBLIC INFRASTRUCTURE (Appendix 64)
// ============================================================
function buildRPC64(wb, assets) {
    const ws = wb.addWorksheet('Appendix 64');
    widths(ws, [22, 26, 20, 22, 22, 18, 16, 20]);

    let r = 1;
    r = title(ws, r, 8, 'REPORT ON THE PHYSICAL COUNT OF OTHER PUBLIC INFRASTRUCTURE');
    r = title(ws, r, 8, 'Appendix 64', 9, 16);
    r = line(ws, r, 8, 'As at ______________________');
    r = line(ws, r, 8, 'For which ______________________________ (Name of Accountable Officer/Designation)');
    r = line(ws, r, 8, '______________ (Date of Assumption)');
    r++;

    r = head(ws, r, ['Public Infrastructure ID No.', 'Type of Public Infrastructure', 'Location', 'Component', 'Component Property No.', 'Carrying Amount', 'Condition', 'Remarks']);

    let total = 0;
    assets.forEach(a => {
        const amount = Number(a.cost || 0) * Number(a.quantity || 0);
        total += amount;

        put(ws, r, 1, a.propertyNo || '', { align: 'center' });
        put(ws, r, 2, a.category || '');
        put(ws, r, 3, a.location || '');
        put(ws, r, 4, a.description || '');
        put(ws, r, 5, '', { align: 'center' });
        put(ws, r, 6, amount, { align: 'right', numFmt: usd });
        put(ws, r, 7, a.condition || '');
        put(ws, r, 8, a.remarks || '');
        border(ws, r, 1, r, 8);
        r++;
    });

    const pad = padCount(assets.length);
    padRows(ws, r, 8, pad);
    r += pad;

    put(ws, r, 5, 'TOTAL', { bold: true, align: 'right', fill: true });
    put(ws, r, 6, total, { bold: true, align: 'right', fill: true, numFmt: usd });
    border(ws, r, 1, r, 8);
    r += 2;

    rpcSignatures(ws, r, 8);

    page(ws, { landscape: true });
}

// ============================================================
// 14) RPC OF BUILDINGS & STRUCTURES (Appendix 65)
// ============================================================
function buildRPC65(wb, assets) {
    const ws = wb.addWorksheet('Appendix 65');
    widths(ws, [22, 22, 22, 22, 18, 16, 20]);

    let r = 1;
    r = title(ws, r, 7, 'REPORT ON THE PHYSICAL COUNT OF BUILDINGS & STRUCTURES');
    r = title(ws, r, 7, 'Appendix 65', 9, 16);
    r = line(ws, r, 7, 'As at ______________________');
    r = line(ws, r, 7, 'For which ______________________________ (Name of Accountable Officer/Designation)');
    r = line(ws, r, 7, '______________ (Date of Assumption)');
    r++;

    r = head(ws, r, ['Building/Structure ID No.', 'Location', 'Component', 'Component Property No.', 'Carrying Amount', 'Condition', 'Remarks']);

    let total = 0;
    assets.forEach(a => {
        const amount = Number(a.cost || 0) * Number(a.quantity || 0);
        total += amount;

        put(ws, r, 1, a.propertyNo || '', { align: 'center' });
        put(ws, r, 2, a.location || '');
        put(ws, r, 3, a.category || '');
        put(ws, r, 4, '', { align: 'center' });
        put(ws, r, 5, amount, { align: 'right', numFmt: usd });
        put(ws, r, 6, a.condition || '');
        put(ws, r, 7, a.remarks || '');
        border(ws, r, 1, r, 7);
        r++;
    });

    const pad = padCount(assets.length);
    padRows(ws, r, 7, pad);
    r += pad;

    put(ws, r, 4, 'TOTAL', { bold: true, align: 'right', fill: true });
    put(ws, r, 5, total, { bold: true, align: 'right', fill: true, numFmt: usd });
    border(ws, r, 1, r, 7);
    r += 2;

    rpcSignatures(ws, r, 7);

    page(ws, { landscape: true });
}

// ============================================================
// 15) RPC OF EQUIPMENT, FURNITURE & FIXTURES (Appendix 66)
// ============================================================
function buildRPC66(wb, assets) {
    const ws = wb.addWorksheet('Appendix 66');
    widths(ws, [28, 40, 20, 16, 20, 16, 20]);

    let r = 1;
    r = title(ws, r, 7, 'REPORT ON THE PHYSICAL COUNT OF EQUIPMENT, FURNITURES AND FIXTURES, AND OTHER PPE');
    r = title(ws, r, 7, 'Appendix 66', 9, 16);
    r = line(ws, r, 7, 'As at ______________________');
    r = line(ws, r, 7, 'Fund: ______________________');
    r = line(ws, r, 7, 'For which ______________________________ (Name of Accountable Officer/Designation)');
    r++;

    r = head(ws, r, ['ARTICLE', 'DESCRIPTION', 'PROPERTY No.', 'COST', 'LOCATION', 'CONDITION', 'REMARKS']);

    let total = 0;
    assets.forEach(a => {
        const cost = Number(a.cost || 0);
        total += cost;

        put(ws, r, 1, a.category || '');
        put(ws, r, 2, a.description || '');
        put(ws, r, 3, a.propertyNo || '', { align: 'center' });
        put(ws, r, 4, cost, { align: 'right', numFmt: usd });
        put(ws, r, 5, a.location || '');
        put(ws, r, 6, a.condition || '');
        put(ws, r, 7, a.remarks || '');
        border(ws, r, 1, r, 7);
        r++;
    });

    const pad = padCount(assets.length);
    padRows(ws, r, 7, pad);
    r += pad;

    put(ws, r, 3, 'TOTAL', { bold: true, align: 'right', fill: true });
    put(ws, r, 4, total, { bold: true, align: 'right', fill: true, numFmt: usd });
    border(ws, r, 1, r, 7);
    r += 2;

    rpcSignatures(ws, r, 7);

    page(ws, { landscape: true });
}

// ============================================================
// 16) ROAD INVENTORY (2026)
// ============================================================
function buildRoadInventory(wb, assets) {
    const groups = new Map();
    assets.forEach(a => {
        const key = a.location?.trim() || 'Unspecified';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(a);
    });

    if (!groups.size) groups.set('Road Inventory', []);
    const usedSheetNames = new Set();
    const roadClasses = [
        'National Road',
        'Provincial Road',
        'Municipal Road',
        'Barangay Road'
    ];

    groups.forEach((items, barangay) => {
        const sheetBase = String(barangay).replace(/[\\/?*[\]:]/g, '-').slice(0, 31) || 'Road Inventory';
        let sheetName = sheetBase;
        let suffix = 1;
        while (usedSheetNames.has(sheetName.toLowerCase())) {
            const ending = ` ${suffix++}`;
            sheetName = `${sheetBase.slice(0, 31 - ending.length)}${ending}`;
        }
        usedSheetNames.add(sheetName.toLowerCase());

        const hasAsphalt = items.some(a => a.surfaceType === 'Asphalt');
        const hasDrainage = items.some(a => /drainage|rcpc|rcbc|bridge/i.test(a.surfaceType || ''));
        const surfaceGroups = [
            { key: 'Concrete', title: 'Concrete', labels: ['L (km)', 'W (m)', 'Thickness', '%', 'Condition'] }
        ];
        if (hasAsphalt) {
            surfaceGroups.push({
                key: 'Asphalt',
                title: 'Asphalt',
                labels: ['L (km)', 'W (m)', '%', 'Condition']
            });
        }
        if (hasDrainage || !hasAsphalt) {
            surfaceGroups.push({
                key: 'Drainage Canal/RCPC/RCBC/Bridge',
                title: 'Drainage Canal/RCPC/RCBC/Bridge',
                labels: ['L (km)', 'W (m)', 'Thickness/Height', 'Condition']
            });
        }
        surfaceGroups.push(
            { key: 'Gravel', title: 'Gravel', labels: ['L (km)', 'W (m)', '%', 'Condition'] },
            { key: 'Earth', title: 'Earth', labels: ['L (km)', 'W (m)', '%', 'Condition'] }
        );

        const columns = 5 + surfaceGroups.reduce((sum, group) => sum + group.labels.length, 0);
        const colWidths = [34, 8, 8, 10, 12];
        surfaceGroups.forEach(group => {
            colWidths.push(...(group.labels.length === 5
                ? [6, 6, 7, 6, 10]
                : [7, 7, 8, 10]));
        });

        const ws = wb.addWorksheet(sheetName);
        widths(ws, colWidths);
        ws.properties.defaultRowHeight = 15;
        ws.views = [{ showGridLines: false }];

        ws.mergeCells(3, 1, 3, columns);
        put(ws, 3, 1, 'ROAD INVENTORY', { bold: true, size: 12, align: 'center' });
        ws.getRow(3).height = 20;
        ws.mergeCells(4, 1, 4, columns);
        put(ws, 4, 1, 'As of ______________________________', { size: 8, align: 'center' });
        ws.mergeCells(5, 1, 5, columns);
        put(ws, 5, 1, `BARANGAY ${String(barangay).toUpperCase()}`, { bold: true, size: 8, align: 'center' });

        ws.mergeCells(6, 1, 8, 1);
        ws.mergeCells(6, 2, 6, 4);
        ws.mergeCells(6, 5, 8, 5);
        const lastSurfaceColumn = columns;
        ws.mergeCells(6, 6, 6, lastSurfaceColumn);
        put(ws, 6, 1, 'CLASSIFICATION, ROAD NETWORK NAME, & ID', { bold: true, size: 8, align: 'center', fill: true });
        put(ws, 6, 2, 'YEAR CONSTRUCTED', { bold: true, size: 8, align: 'center', fill: true });
        put(ws, 6, 5, 'TOTAL LENGTH (KM)', { bold: true, size: 8, align: 'center', fill: true });
        put(ws, 6, 6, 'ROAD SURFACE TYPE', { bold: true, size: 8, align: 'center', fill: true });
        ['Opened', 'Concreted', 'Rehabilitate'].forEach((label, index) =>
            put(ws, 7, index + 2, label, { bold: true, size: 8, align: 'center', fill: true }));

        let surfaceColumn = 6;
        surfaceGroups.forEach(group => {
            const end = surfaceColumn + group.labels.length - 1;
            ws.mergeCells(7, surfaceColumn, 7, end);
            put(ws, 7, surfaceColumn, group.title, { bold: true, size: 8, align: 'center', fill: true });
            group.startColumn = surfaceColumn;
            group.labels.forEach((label, index) =>
                put(ws, 8, surfaceColumn + index, label, { bold: true, size: 8, align: 'center', fill: true }));
            surfaceColumn = end + 1;
        });
        put(ws, 8, 1, `BARANGAY ${String(barangay).toUpperCase()}`, { bold: true, size: 8 });
        border(ws, 6, 1, 8, columns);
        [6, 7, 8].forEach(row => {
            ws.getRow(row).height = row === 6 ? 24 : 18;
            for (let column = 1; column <= columns; column++) {
                ws.getCell(row, column).alignment = {
                    ...ws.getCell(row, column).alignment,
                    vertical: 'middle',
                    wrapText: true
                };
            }
        });

        const valuesFor = (asset, group) => {
            if (asset.surfaceType !== group.key) return Array(group.labels.length).fill('');
            const totalLength = Number(asset.roadLength || 0);
            const segmentLength = asset.surfaceLength !== '' && asset.surfaceLength != null
                ? Number(asset.surfaceLength)
                : totalLength;
            const share = asset.surfacePercent !== '' && asset.surfacePercent != null
                ? Number(asset.surfacePercent) / 100
                : totalLength > 0 ? segmentLength / totalLength : '';
            const length = segmentLength ? segmentLength : '';
            const width = asset.surfaceWidth || '';
            const thickness = asset.surfaceThickness || '';
            const condition = asset.surfaceCondition || '';

            if (group.key === 'Concrete') return [length, width, thickness, share, condition];
            if (group.key === 'Drainage Canal/RCPC/RCBC/Bridge') return [length, width, thickness, condition];
            return [length, width, share, condition];
        };

        const writeRoad = (row, asset = {}) => {
            const roadName = asset.roadName || asset.description || '';
            const id = asset.propertyNo ? ` (${asset.propertyNo})` : '';
            put(ws, row, 1, `${roadName}${id}`, { size: 8 });
            put(ws, row, 2, asset.yearOpened || '', { size: 8, align: 'center' });
            put(ws, row, 3, asset.yearConcreted || (asset.surfaceType === 'Concrete' ? asset.yearConstructed : '') || '', { size: 8, align: 'center' });
            put(ws, row, 4, asset.yearRehabilitated || '', { size: 8, align: 'center' });
            put(ws, row, 5, Number(asset.roadLength || 0) || '', { size: 8, align: 'center', numFmt: '0.000 "km"' });

            surfaceGroups.forEach(group => {
                const values = valuesFor(asset, group);
                values.forEach((value, index) => {
                    const isLength = index === 0;
                    const isWidth = index === 1;
                    const isShare = group.key === 'Concrete' ? index === 3 : index === 2 && group.key !== 'Drainage Canal/RCPC/RCBC/Bridge';
                    const numberFormat = isLength
                        ? '0.000 "km"'
                        : isWidth || (group.key === 'Concrete' && index === 2) || (group.key === 'Drainage Canal/RCPC/RCBC/Bridge' && index === 2)
                            ? '0.00 "m"'
                            : isShare ? '0.000' : undefined;
                    put(ws, row, group.startColumn + index, value, {
                        size: 8,
                        align: isLength || isWidth || isShare ? 'center' : 'left',
                        numFmt: numberFormat
                    });
                });
            });
            border(ws, row, 1, row, columns);
            ws.getRow(row).height = 15;
        };

        let row = 9;
        roadClasses.forEach(roadClass => {
            put(ws, row, 1, `${roadClass}:`, { bold: true, size: 8, fill: true });
            border(ws, row, 1, row, columns);
            row++;

            const classAssets = items.filter(asset =>
                (asset.roadClass || 'Barangay Road') === roadClass
            );
            if (classAssets.length) {
                classAssets.forEach(asset => writeRoad(row++, asset));
            } else {
                writeRoad(row++);
            }
        });

        const signatureRow = Math.max(47, row + 1);
        while (row < signatureRow - 1) writeRoad(row++);
        const leftEnd = Math.floor(columns * 0.55);
        const rightStart = leftEnd + 1;
        put(ws, signatureRow, 1, 'Prepared by:', { size: 8 });
        put(ws, signatureRow + 1, rightStart, 'Approved by:', { size: 8 });
        [
            [signatureRow + 2, `__REYMARK O. RAMOS`, 1, leftEnd],
            [signatureRow + 3, 'COS', 1, leftEnd],
            [signatureRow + 4, 'Date: ____________________', 1, leftEnd],
            [signatureRow + 2, 'ENGR. REMEDIOS A. ULADAY', rightStart, columns],
            [signatureRow + 3, 'GSO', rightStart, columns],
            [signatureRow + 4, 'Date: ____________________', rightStart, columns]
        ].forEach(([signatureLine, value, startColumn, endColumn]) => {
            ws.mergeCells(signatureLine, startColumn, signatureLine, endColumn);
            put(ws, signatureLine, startColumn, value, { bold: signatureLine === signatureRow + 2, size: 8, align: 'center' });
        });

        page(ws, { landscape: true });
        ws.pageSetup.fitToHeight = 1;
        ws.pageSetup.printArea = `A1:${ws.getColumn(columns).letter}${signatureRow + 4}`;
        ws.pageSetup.showGridLines = false;
    });
}

// ============================================================
// 17) PROPERTY CARD — COA FORMAT (Appendix 69)
// ============================================================
function buildCOAPropertyCard(wb, assets) {
    const used = new Set();

    (assets.length ? assets : [{}]).forEach(a => {
        let name = String(a.propertyNo || 'PC').replace(/[\\/?*[\]:]/g, '-').slice(0, 28) || 'PC';
        while (used.has(name)) name = name.slice(0, 26) + '_' + used.size;
        used.add(name);

        const ws = wb.addWorksheet(name);
        widths(ws, [14, 22, 12, 20, 24, 12, 16, 20]);

        let r = 1;
        r = title(ws, r, 8, 'PROPERTY CARD');
        r = title(ws, r, 8, 'Appendix 69', 9, 16);
        r++;
        r = line(ws, r, 8, `Entity Name: ${ENTITY}                                       Fund Cluster: ____________________`);
        r = line(ws, r, 8, `Property, Plant and Equipment: ${a.category || '____________________'}`);
        r = line(ws, r, 8, `Property Number: ${a.propertyNo || '____________________'}`);
        r = line(ws, r, 8, `Description: ${a.description || '____________________'}`);
        r++;

        r = head(ws, r, ['Date', 'Reference/ PAR No.', 'Receipt Qty.', 'Issue/Transfer/ Disposal Qty.', 'Officer/Office', 'Balance Qty.', 'Amount', 'Remarks']);

        const qty = Number(a.quantity || 0);
        put(ws, r, 1, '', { align: 'center' });
        put(ws, r, 2, a.propertyNo || '', { align: 'center' });
        put(ws, r, 3, qty, { align: 'center' });
        put(ws, r, 4, '', { align: 'center' });
        put(ws, r, 5, a.accountable || a.department || '');
        put(ws, r, 6, qty, { align: 'center' });
        put(ws, r, 7, qty * Number(a.cost || 0), { align: 'right', numFmt: usd });
        put(ws, r, 8, a.remarks || '');
        border(ws, r, 1, r, 8);
        r++;

        padRows(ws, r, 8, MIN_DATA_ROWS - 1);
        r += MIN_DATA_ROWS - 1;

        r = line(ws, r, 8, 'For Property Office use', true);

        page(ws, { landscape: true });
    });
}

// ============================================================
// 18) RPCPPE — COA FORMAT (Appendix 73)
// ============================================================
function buildRPC73(wb, assets) {
    const ws = wb.addWorksheet('Appendix 73');
    widths(ws, [24, 36, 20, 14, 16, 14, 14, 12, 16, 22]);

    let r = 1;
    r = title(ws, r, 10, 'REPORT ON THE PHYSICAL COUNT OF PROPERTY, PLANT AND EQUIPMENT');
    r = title(ws, r, 10, 'Appendix 73', 9, 16);
    r = line(ws, r, 10, '______________________________ (Type of Property, Plant and Equipment)');
    r = line(ws, r, 10, 'As at ______________________');
    r++;
    r = line(ws, r, 10, 'Fund Cluster: ______________________');
    r = line(ws, r, 10, 'For which ______________________________ (Name of Accountable Officer/Designation)');
    r++;

    const top = r;
    ['ARTICLE', 'DESCRIPTION', 'STOCK NUMBER', 'UNIT OF MEASURE', 'UNIT VALUE'].forEach((t, i) => {
        ws.mergeCells(r, i + 1, r + 2, i + 1);
        put(ws, r, i + 1, t, { bold: true, align: 'center', fill: true });
    });
    ws.mergeCells(r, 6, r + 1, 6);
    put(ws, r, 6, 'Balance Per Card', { bold: true, align: 'center', fill: true });
    ws.mergeCells(r, 7, r + 1, 7);
    put(ws, r, 7, 'On Hand Per Count', { bold: true, align: 'center', fill: true });
    ws.mergeCells(r, 8, r + 1, 9);
    put(ws, r, 8, 'SHORTAGE/OVERAGE', { bold: true, align: 'center', fill: true });
    ws.mergeCells(r, 10, r + 2, 10);
    put(ws, r, 10, 'REMARKS', { bold: true, align: 'center', fill: true });

    const mid = r + 1;
    put(ws, mid, 6, '', { bold: true, align: 'center', fill: true });
    put(ws, mid, 7, '', { bold: true, align: 'center', fill: true });
    border(ws, mid, 1, mid, 10);

    const bot = r + 2;
    put(ws, bot, 6, 'QUANTITY', { bold: true, align: 'center', fill: true });
    put(ws, bot, 7, 'QUANTITY', { bold: true, align: 'center', fill: true });
    put(ws, bot, 8, 'Quantity', { bold: true, align: 'center', fill: true });
    put(ws, bot, 9, 'Value', { bold: true, align: 'center', fill: true });
    border(ws, top, 1, bot, 10);
    ws.getRow(mid).height = 20;
    ws.getRow(bot).height = 24;
    r = bot + 1;

    let total = 0;
    assets.forEach(a => {
        const qty = Number(a.quantity || 0);
        const value = qty * Number(a.cost || 0);
        total += value;

        put(ws, r, 1, a.category || '');
        put(ws, r, 2, a.description || '');
        put(ws, r, 3, a.propertyNo || '', { align: 'center' });
        put(ws, r, 4, a.unit || '', { align: 'center' });
        put(ws, r, 5, Number(a.cost || 0), { align: 'right', numFmt: usd });
        put(ws, r, 6, qty, { align: 'center' });
        put(ws, r, 7, qty, { align: 'center' });
        put(ws, r, 8, '', { align: 'center' });
        put(ws, r, 9, '', { align: 'right' });
        put(ws, r, 10, a.remarks || '');
        border(ws, r, 1, r, 10);
        r++;
    });

    const pad = padCount(assets.length);
    padRows(ws, r, 10, pad);
    r += pad;

    put(ws, r, 4, 'TOTAL', { bold: true, align: 'right', fill: true });
    put(ws, r, 5, total, { bold: true, align: 'right', fill: true, numFmt: usd });
    border(ws, r, 1, r, 10);
    r += 2;

    rpcSignatures(ws, r, 10);

    page(ws, { landscape: true });
}

// ============================================================
// PROPERTY NUMBER STICKER
// One sticker per property. The left colour band identifies the
// classification: yellow = Expendable (₱50,000 and above),
// green = Semi-Expendable (below ₱50,000).
// ============================================================
const STICKER_YELLOW = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
const STICKER_GREEN = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B050' } };

// One worksheet per band colour; the sheet name states the colour.
function writeStickerSheet(wb, name, assets, band, logoId) {
    const ws = wb.addWorksheet(name);
    widths(ws, [18.55, 21.89, 35.44]);

    const docLabel = band === STICKER_YELLOW ? 'PARE NO' : 'ICS NO';
    const list = assets.length ? assets : [{}];

    list.forEach((a, i) => {
        const top = 1 + i * 14;                     // 13 sticker rows + 1 spacer

        // El Nido logo floating over the coloured band, near the top
        // of each sticker (same size/placement as the reference file).
        if (logoId !== null) {
            ws.addImage(logoId, {
                tl: { col: 0.024, row: top + 1.88 },
                ext: { width: 127, height: 127 }
            });
        }

        // Coloured classification band
        ws.mergeCells(top, 1, top + 12, 1);
        ws.getCell(top, 1).fill = band;
        border(ws, top, 1, top + 12, 1);

        const rows = [
            ['PROPERTY NUMBER', a.propertyNo],
            ['DESCRIPTION', a.description],
            ['BRAND', a.brand],
            ['MODEL', a.model],
            ['SERIAL NUMBER', a.serialNo],
            ['ACQUISITION COST', a.cost],
            ['DATE AQUIRED', a.acquisitionDate],
            ['PERSON ACCOUNTABLE', a.accountable],
            [docLabel, a.pareIcsNo],
            ['LOCATION/OFFICE', a.location || a.department],
            ['VALIDATION/SIGNATURE', '']
        ];

        rows.forEach(([label, value], k) => {
            const row = top + k;

            put(ws, row, 2, label, { align: 'left', wrap: false });
            ws.getCell(row, 2).font = { ...FONT, name: 'Times New Roman', size: 9, bold: true };

            put(ws, row, 3, value ?? '', { align: 'center', wrap: false });
            ws.getCell(row, 3).font = { ...FONT, size: 9, bold: true };

            border(ws, row, 2, row, 3);
        });

        // Footer warning spanning both columns and the last two rows
        ws.mergeCells(top + 11, 2, top + 12, 3);
        const foot = ws.getCell(top + 11, 2);
        foot.value = '"Removing or tampering of this sticker is Punishable by law"';
        foot.font = { ...FONT, name: 'Times New Roman', size: 11, bold: true };
        foot.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        border(ws, top + 11, 2, top + 12, 3);

        for (let k = 0; k < 13; k++) ws.getRow(top + k).height = 15;
    });

    page(ws);
}

function buildSticker(wb, assets) {
    // Register the logo once; it is stamped on every sticker.
    const logoB64 = STICKER_LOGO.replace(/^data:image\/\w+;base64,/, '');
    const logoId = logoB64 ? wb.addImage({ base64: logoB64, extension: 'png' }) : null;

    // Match the registration form tabs, with each classification color
    // separated into its own worksheet within that form.
    const formNames = new Map(ASSET_FORMS.map(form => [form.id, form.short]));
    const grouped = new Map(ASSET_FORMS.map(form => [form.id, []]));

    assets.forEach(asset => {
        const formType = asset.formType || 'general';
        if (!grouped.has(formType)) grouped.set(formType, []);
        grouped.get(formType).push(asset);
    });

    for (const [formType, formAssets] of grouped) {
        if (!formAssets.length) continue;

        const formName = formNames.get(formType) || formType;
        const expendable = formAssets.filter(a => a.classification === 'Expendable');
        const semiExpendable = formAssets.filter(a => a.classification !== 'Expendable');

        if (expendable.length) {
            writeStickerSheet(wb, `${formName} - Yellow`, expendable, STICKER_YELLOW, logoId);
        }
        if (semiExpendable.length) {
            writeStickerSheet(wb, `${formName} - Green`, semiExpendable, STICKER_GREEN, logoId);
        }
    }

    // Nothing on record yet — keep a blank template sheet.
    if (!assets.length) {
        writeStickerSheet(wb, 'General - Yellow', [], STICKER_YELLOW, logoId);
    }
}

// ============================================================
// FORM REGISTRY
// ============================================================
const unserviceablePPE = assets =>
    assets.filter(a => a.classification === 'PPE' && a.condition === 'Unserviceable');

const unserviceableSE = assets =>
    assets.filter(a => a.classification === 'Semi-Expendable' && a.condition === 'Unserviceable');

// Exported so the Disposal & Missing page and the exports share one definition.
export const unserviceableList = assets =>
    assets.filter(a => a.condition === 'Unserviceable');

export const missingList = assets =>
    assets.filter(a =>
        a.status === 'Missing' || /missing|non-?exist/i.test(a.remarks || '')
    );

// Each entry declares `formType` — the registration form(s) whose
// records it should display. Exporting a form therefore only ever
// contains the records the user filed under that form type.
export const FORMS = [
    {
        id: 'ics',
        name: 'ICS — Inventory Custodian Slip',
        note: 'Appendix 59 · issuance of items to an accountable person',
        file: 'ICS',
        formType: 'ics',
        build: (wb, assets) => buildICS(wb, assets)
    },
    {
        id: 'pare',
        name: 'PARE — Property Acknowledgement Receipt',
        note: 'Appendix 9-8 · acknowledgement of equipment received',
        file: 'PARE',
        formType: 'pare',
        build: (wb, assets) => buildPARE(wb, assets)
    },
    {
        id: 'iirup',
        name: 'IIRUP — Unserviceable PPE',
        note: 'Appendix 67 · inspection & disposal of unserviceable PPE',
        file: 'IIRUP',
        formType: 'iirup',
        build: (wb, assets) => buildIIRUP(wb, unserviceablePPE(assets).length ? unserviceablePPE(assets) : assets, { semi: false })
    },
    {
        id: 'iirup-sp',
        name: 'IIRU-SP — Unserviceable Semi-Expendable',
        note: 'Annex A.10 · inspection & disposal of unserviceable semi-expendable',
        file: 'IIRU-SP',
        formType: 'iirup-sp',
        build: (wb, assets) => buildIIRUP(wb, unserviceableSE(assets).length ? unserviceableSE(assets) : assets, { semi: true })
    },
    {
        id: 'itr',
        name: 'ITR — Inventory Transfer Report',
        note: 'Annex A.5 · transfer of property between accountable officers',
        file: 'Inventory Transfer Report',
        formType: 'itr',
        build: (wb, assets) => buildITR(wb, assets)
    },
    {
        id: 'missing',
        name: 'List of Non-Existing / Missing PPEs',
        note: 'Auto-generated from records flagged Missing / Non-Existing',
        file: 'List of Non-Existing Missing PPEs',
        build: (wb, assets) => buildMissing(wb, missingList(assets).length ? missingList(assets) : assets)
    },
    {
        id: 'unserviceable',
        name: 'List of Unserviceable / Disposed Equipment',
        note: 'Auto-generated from records with condition Unserviceable',
        file: 'List of Unserviceable Disposed Equipment',
        build: (wb, assets) => buildUnserviceable(wb, unserviceableList(assets).length ? unserviceableList(assets) : assets)
    },
    {
        id: 'meo',
        name: 'Report on LRN with No MEO Record',
        note: 'Grouped by barangay with acquisition costs',
        file: 'No Corresponding Record in the MEO',
        formType: 'meo',
        build: (wb, assets) => buildMEO(wb, assets)
    },
    {
        id: 'property-card',
        name: 'Property Card',
        note: 'Annex 37 · one ledger card sheet per property',
        file: 'Property Cards',
        formType: 'property-card',
        build: (wb, assets) => buildPropertyCard(wb, assets.length ? assets : [])
    },
    {
        id: 'rpc-66',
        name: 'Appendix 66 — RPC of Equipment, Furniture & Fixtures',
        note: 'Report on the Physical Count of PPE (equipment)',
        file: 'Appendix 66 - RPCEFFOPPE',
        formType: 'rpcppe',
        build: (wb, assets) => buildRPC66(wb, assets)
    },
    {
        id: 'rpc-62',
        name: 'Appendix 62 — RPC of Land & Land Improvements',
        note: 'Report on the Physical Count of Land & Land Improvements',
        file: 'Appendix 62 - RPCLLI',
        formType: 'rpcppe',
        build: (wb, assets) => buildRPC62(wb, assets)
    },
    {
        id: 'rpc-63',
        name: 'Appendix 63 — RPC of Local Road Network',
        note: 'Report on the Physical Count of Local Road Network',
        file: 'Appendix 63 - RPCLRN',
        formType: 'rpcppe',
        build: (wb, assets) => buildRPC63(wb, assets)
    },
    {
        id: 'rpc-64',
        name: 'Appendix 64 — RPC of Other Public Infrastructure',
        note: 'Report on the Physical Count of Other Public Infrastructure',
        file: 'Appendix 64 - RPCOPI',
        formType: 'rpcppe',
        build: (wb, assets) => buildRPC64(wb, assets)
    },
    {
        id: 'rpc-65',
        name: 'Appendix 65 — RPC of Buildings & Structures',
        note: 'Report on the Physical Count of Buildings & Structures',
        file: 'Appendix 65 - RPCBS',
        formType: 'rpcppe',
        build: (wb, assets) => buildRPC65(wb, assets)
    },
    {
        id: 'road-inventory',
        name: 'Road Inventory (2026)',
        note: 'Annual road inventory by barangay and road surface type',
        file: 'Road Inventory 2026',
        formType: 'road-inventory',
        build: (wb, assets) => buildRoadInventory(wb, assets)
    },
    {
        id: 'iirup-office',
        name: 'IIRUP by Office',
        note: 'Appendix 67 · one IIRUP sheet per accountable office/department',
        file: 'IIRUP by Office',
        formType: 'iirup',
        build: (wb, assets) => buildIIRUPByOffice(wb, assets)
    },
    {
        id: 'coa-property-card',
        name: 'Appendix 69 — Property Card (COA)',
        note: 'COA property card with receipts, disposal and running balance',
        file: 'Appendix 69 - Property Card',
        formType: 'property-card',
        build: (wb, assets) => buildCOAPropertyCard(wb, assets)
    },
    {
        id: 'rpc-73',
        name: 'Appendix 73 — RPCPPE',
        note: 'Report on the Physical Count of PPE with shortage/overage',
        file: 'Appendix 73 - RPCPPE',
        formType: 'rpcppe',
        build: (wb, assets) => buildRPC73(wb, assets)
    },
    {
        id: 'sticker',
        name: 'Property Number Sticker',
        note: 'Grouped by registration form · separate yellow Expendable and green Semi-Expendable sheets',
        file: 'Property Number Stickers',
        build: (wb, assets) => buildSticker(wb, assets)
    }
];

// Records filed under a given form's registration type.
function filterFor(form, assets) {
    if (!form.formType) return assets;

    const types = Array.isArray(form.formType) ? form.formType : [form.formType];

    return assets.filter(a => types.includes(a.formType || 'general'));
}

// ============================================================
// BUILD A FORM WORKBOOK
// ============================================================
export function buildForm(id, assets) {
    const form = FORMS.find(f => f.id === id);
    if (!form) throw Error('Unknown form: ' + id);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Inventory Dashboard';

    form.build(wb, filterFor(form, assets || []));

    return wb;
}

// Number of registered records that belong to a form's type.
export function formRecordCount(id, assets) {
    const form = FORMS.find(f => f.id === id);
    if (!form) return 0;

    return filterFor(form, assets || []).length;
}

// ============================================================
// EXPORT A FORM TO .XLSX
// ============================================================
export async function exportForm(id, assets) {
    const form = FORMS.find(f => f.id === id);
    if (!form) throw Error('Unknown form: ' + id);

    const wb = buildForm(id, assets);

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.file}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}
