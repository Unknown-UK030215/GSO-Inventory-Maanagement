import { departments } from './sampleAssets';

// ============================================================
// ASSET REGISTRATION FORMS
// ------------------------------------------------------------
// Each form tells the Register Asset modal which inputs to show,
// so the user only fills up the fields of the form they are
// filing (e.g. PARE, ICS, IIRUP) — no guessing required.
//
// Field shape:
//   { key, label, type: 'text'|'number'|'date'|'select'|'textarea',
//     options?, required?, min?, step?, span? (1|2) }
// ============================================================

// ----------------------------------------
// REUSABLE FIELD DEFINITIONS
// ----------------------------------------
const fQuantity = { key: 'quantity', label: 'Quantity', type: 'number', min: 1, step: 1, required: true };
const fUnit = { key: 'unit', label: 'Unit', type: 'text' };
const fDesc = { key: 'description', label: 'Description', type: 'text', required: true, span: 2 };
const fPropNo = { key: 'propertyNo', label: 'Property No.', type: 'text', required: true };
const fCost = { key: 'cost', label: 'Unit Cost', type: 'number', min: 0, step: 0.01 };
const fAcqDate = { key: 'acquisitionDate', label: 'Acquisition Date', type: 'date' };

// ----------------------------------------
// SHARED REGISTER FIELDS
// Always shown below the form-specific fields so that grouping,
// sorting and search across the register keep working.
// ----------------------------------------
export const REGISTER_FIELDS = [
    { key: 'classification', label: 'Classification', type: 'select', options: ['PPE', 'Semi-Expendable', 'Expendable', 'Land', 'Land Improvement'] },
    { key: 'category', label: 'Category', type: 'text' },
    { key: 'department', label: 'Department / Office', type: 'select', options: departments },
    { key: 'accountable', label: 'Accountable Person', type: 'text' },
    { key: 'location', label: 'Location', type: 'text' },
    { key: 'condition', label: 'Condition', type: 'select', options: ['Serviceable', 'For Inspection', 'Unserviceable'] },
    { key: 'status', label: 'Status', type: 'select', options: ['Unassigned', 'Assigned', 'Recorded', 'Under Inspection', 'Missing'] },
    { key: 'remarks', label: 'Remarks', type: 'textarea', span: 2 }
];

// ----------------------------------------
// PARE + PROPERTY CARD SHARED FIELDS
// Both forms collect the same inputs, so a single registration
// record can feed either document (and the property number sticker).
// ----------------------------------------
const fBrand = { key: 'brand', label: 'Brand', type: 'text' };
const fModel = { key: 'model', label: 'Model', type: 'text' };
const fSerial = { key: 'serialNo', label: 'Serial Number', type: 'text' };
const fPareIcsNo = { key: 'pareIcsNo', label: 'PARE / ICS No.', type: 'text' };

const pareCardFields = [
    fPropNo,
    fDesc,
    fQuantity,
    fUnit,
    fBrand,
    fModel,
    fSerial,
    { ...fCost, label: 'Unit Value' },
    { ...fAcqDate, label: 'Date Acquired' },
    fPareIcsNo
];

// ----------------------------------------
// FORM REGISTRY
// ----------------------------------------
export const ASSET_FORMS = [
    {
        id: 'general',
        short: 'General',
        name: 'General Asset Record',
        note: 'Standard PPE / semi-expendable register entry',
        fields: [fPropNo, fDesc, fQuantity, fUnit, fCost]
    },
    {
        id: 'pare',
        short: 'PARE',
        name: 'PARE — Property Acknowledgement Receipt for Equipment',
        note: 'Appendix 9-8 · acknowledgement of equipment received',
        fields: [...pareCardFields]
    },
    {
        id: 'ics',
        short: 'ICS',
        name: 'ICS — Inventory Custodian Slip',
        note: 'Appendix 59 · issuance of items to an accountable person',
        fields: [
            { key: 'fundCluster', label: 'Fund Cluster', type: 'text' },
            { key: 'icsNo', label: 'ICS No.', type: 'text' },
            fQuantity,
            fUnit,
            fDesc,
            { ...fPropNo, label: 'Inventory Item No.' },
            { key: 'estimatedLife', label: 'Estimated Useful Life', type: 'text' },
            { ...fCost, label: 'Unit Cost' }
        ]
    },
    {
        id: 'iirup',
        short: 'IIRUP',
        name: 'IIRUP — Unserviceable Property',
        note: 'Appendix 67 · inspection & disposal of unserviceable property',
        fields: [
            { ...fAcqDate, label: 'Date Acquired' },
            { ...fDesc, label: 'Particulars / Articles' },
            fPropNo,
            fQuantity,
            { ...fCost, label: 'Unit Cost' },
            { key: 'accumulatedDepreciation', label: 'Accumulated Depreciation', type: 'number', min: 0, step: 0.01 },
            { key: 'accumulatedImpairment', label: 'Accumulated Impairment Losses', type: 'number', min: 0, step: 0.01 },
            { key: 'carryingAmount', label: 'Carrying Amount', type: 'number', min: 0, step: 0.01 }
        ]
    },
    {
        id: 'iirup-sp',
        short: 'IIRU-SP',
        name: 'IIRU-SP — Unserviceable Semi-Expendable',
        note: 'Annex A.10 · inspection & disposal of unserviceable semi-expendable',
        fields: [
            { ...fAcqDate, label: 'Date Acquired' },
            { ...fDesc, label: 'Particulars / Articles' },
            fPropNo,
            fQuantity,
            { ...fCost, label: 'Unit Cost' },
            { key: 'accumulatedDepreciation', label: 'Accumulated Depreciation', type: 'number', min: 0, step: 0.01 },
            { key: 'accumulatedImpairment', label: 'Accumulated Impairment Losses', type: 'number', min: 0, step: 0.01 },
            { key: 'carryingAmount', label: 'Carrying Amount', type: 'number', min: 0, step: 0.01 }
        ]
    },
    {
        id: 'itr',
        short: 'ITR',
        name: 'ITR — Inventory Transfer Report',
        note: 'Annex A.5 · transfer of property between accountable officers',
        fields: [
            { ...fAcqDate, label: 'Date Acquired' },
            { ...fPropNo, label: 'Item No.' },
            { key: 'pareIcsNo', label: 'PARE / ICS No. & Date', type: 'text' },
            fDesc,
            { ...fCost, label: 'Amount' },
            { key: 'fromOfficer', label: 'From Accountable Officer', type: 'text' },
            { key: 'toOfficer', label: 'To Accountable Officer', type: 'text' },
            { key: 'transferType', label: 'Transfer Type', type: 'select', options: ['Donation', 'Reassignment', 'Relocate', 'Other'] }
        ]
    },
    {
        id: 'property-card',
        short: 'Property Card',
        name: 'Property Card (Annex 37)',
        note: 'Annex 37 · ledger card entry per property (same inputs as PARE)',
        fields: [...pareCardFields]
    },
    {
        id: 'rpcppe',
        short: 'RPCPPE',
        name: 'RPCPPE — Report on the Physical Count of PPE',
        note: 'Appendix 62–66 & 73 · physical count of PPE and infrastructure',
        fields: [
            { ...fPropNo, label: 'ID / Property No.' },
            { key: 'category', label: 'Article / Type', type: 'text' },
            fDesc,
            fQuantity,
            { ...fUnit, label: 'Unit of Measure' },
            { ...fCost, label: 'Carrying Amount / Cost' }
        ]
    },
    {
        id: 'road-inventory',
        short: 'Road Inventory',
        name: 'Road Inventory (2026)',
        note: 'Road classification, construction history, length, and surface details',
        fields: [
            { key: 'location', label: 'Barangay', type: 'text', required: true },
            {
                key: 'roadClass',
                label: 'Road Classification',
                type: 'select',
                required: true,
                options: ['National Road', 'Provincial Road', 'Municipal Road', 'Barangay Road']
            },
            { key: 'roadName', label: 'Road Network Name', type: 'text', span: 2, required: true },
            { ...fPropNo, label: 'Road Network ID No.', required: false },
            { key: 'yearOpened', label: 'Year Opened', type: 'text' },
            { key: 'yearConcreted', label: 'Year Concreted', type: 'text' },
            { key: 'yearRehabilitated', label: 'Year Rehabilitated', type: 'text' },
            { key: 'roadLength', label: 'Total Length (km)', type: 'number', min: 0.01, step: 0.01, required: true },
            {
                key: 'surfaceType',
                label: 'Road Surface Type',
                type: 'select',
                required: true,
                options: ['Concrete', 'Asphalt', 'Drainage Canal/RCPC/RCBC/Bridge', 'Gravel', 'Earth']
            },
            { key: 'surfaceLength', label: 'Surface Segment Length (km)', type: 'number', min: 0, step: 0.001 },
            { key: 'surfaceWidth', label: 'Surface Width (m)', type: 'number', min: 0, step: 0.01 },
            { key: 'surfaceThickness', label: 'Thickness / Height (m)', type: 'number', min: 0, step: 0.01 },
            { key: 'surfacePercent', label: 'Surface Share (%)', type: 'number', min: 0, max: 100, step: 0.01 },
            { key: 'surfaceCondition', label: 'Surface Condition', type: 'text' }
        ]
    },
    {
        id: 'meo',
        short: 'No MEO Record',
        name: 'Report on LRN with No MEO Record',
        note: 'Land records with no corresponding record in the MEO',
        fields: [
            fPropNo,
            fDesc,
            { ...fAcqDate, label: 'Acquisition Date' },
            { ...fCost, label: 'Acquisition Cost per Accounting' },
            { key: 'meoRecord', label: 'MEO Record', type: 'text' }
        ]
    }
];
