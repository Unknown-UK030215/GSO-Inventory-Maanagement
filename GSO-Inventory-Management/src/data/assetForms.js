import { departments } from './sampleAssets';
import { getRole } from './userRoles';

// ============================================================
// WAREHOUSE TRANSACTION FORMS
// ------------------------------------------------------------
// AIR, RIS and SSMI are transactional warehouse records, not
// inventory property master records. They live in the warehouse's
// own register so they never collide with inventory property
// numbers, counts or duplicate checks.
// ============================================================
export const WAREHOUSE_TRANSACTION_FORMS = new Set(['air', 'ris', 'ssmi']);

export const isWarehouseTransaction = formType => WAREHOUSE_TRANSACTION_FORMS.has(formType);

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

// Article categories for the High Value registry. The export generates
// one sheet per article, matching the GSO's multi-sheet workbook. Names,
// spelling and order mirror the reference "High Value.xlsx" tabs exactly
// so the downloaded file lines up with the GSO's own workbook.
export const HIGH_VALUE_ARTICLES = [
    'Printer',
    'Photocopier',
    'Projector',
    'Refrigerator',
    'Speaker',
    'Aircondition',
    'Fan',
    'Camera',
    'Television',
    'Scanner',
    'Laminating',
    'Video Recorder',
    'Router',
    'Voice Recorder',
    'Paper Cutter',
    'Paper Shredder',
    'Side Car Housing',
    'Water Tank',
    'Tent',
    'Megaphone',
    'Microphone',
    'Cellphone',
    'AVR',
    'UPS',
    'Signature Pad',
    'Aircooler',
    'External HardDrive',
    'TypeWriter',
    'GPS',
    'Measuring Device',
    'Grass Cutter',
    'WaterDispenser',
    'Thermal Printer',
    'Tablet',
    'Laptop',
    'Netbook',
    'Desktop',
    'Paper Cutterx',
    'Brusk Cutter',
    'Notebook PC',
    'CPU',
    'Motor',
    'Sofa-Sala Set',
    'Bookshelves',
    'Computer Table',
    'Table',
    'Partition',
    'Cabinet',
    'Chair',
    'BillCountingMachine',
    'Board',
    'Air Compressor',
    'Electrical Drill',
    'Torque Wrench',
    'Cut Off Machine',
    'Water Pump',
    'Welding Machine',
    'Water Pu Wa',
    'Pressure Machine',
    'Spine Board',
    'Battery',
    'Generator',
    'Binding & Punching Machine',
    'Compact Wrench',
    'Power Sprayer',
    'Vacuum',
    'Floor Polisher',
    'Pocket Wifi',
    'Radio',
    'Tools-Power Tools',
    'Tank',
    'Ladder',
    'Measuring Tools',
    'Flashlight',
    'Sports Equipment',
    'Volleyball Post',
    'Medical Instrument',
    'Biometric',
    'Bundy Clock',
    'Book',
    'Electrical Equipment',
    'Sound Element',
    'Light',
    'Fire Fighting Equipment',
    'Kayak',
    'Monitor',
    'Rescue Accessories',
    'Unserviceable',
    'Network Hub Port',
    'FIber Glass Basketball Board',
    'Transparency Board',
    'BP MONITOR',
    'Solar Light',
    'Rostrum',
    'solar inverter',
    'sound system',
    'Salter  SCale',
    'SAFETY BOLT',
    'Sewing Machine',
    'Christmas Decor',
    'Audio Mixer',
    'MIX',
    'oximeter Digital',
    'HDMI CABLE',
    'Compressor',
    'CCTV',
    'GATE',
    'CLOTH',
    'TELA',
    'UTP CABLE',
    'AED',
    'BALL',
    'BED',
    'DIVIDER',
    'Double deck',
    'Shelves',
    'Submersible Pump',
    'Stand Fan',
    'AUDIO RECORDER',
    'INFATOMETER',
    'DIGITAL PULSE OXIMETER',
    'SWITCH',
    'AMPLIFIER (21)',
    'm (22)'
];

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
        roles: ['staff', 'fuel-vehicle', 'warehouse'],
        fields: [fPropNo, fDesc, fQuantity, fUnit, fCost]
    },
    {
        id: 'pare',
        short: 'PARE',
        name: 'PARE — Property Acknowledgement Receipt for Equipment',
        note: 'Appendix 9-8 · acknowledgement of equipment received',
        roles: ['staff', 'fuel-vehicle'],
        fields: [...pareCardFields]
    },
    {
        id: 'ics',
        short: 'ICS',
        name: 'ICS — Inventory Custodian Slip',
        note: 'Appendix 59 · issuance of items to an accountable person',
        roles: ['staff', 'fuel-vehicle'],
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
        roles: ['staff', 'fuel-vehicle'],
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
        roles: ['staff', 'fuel-vehicle'],
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
        roles: ['staff', 'fuel-vehicle'],
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
        roles: ['staff', 'fuel-vehicle'],
        fields: [...pareCardFields]
    },
    {
        id: 'rpcppe',
        short: 'RPCPPE',
        name: 'RPCPPE — Report on the Physical Count of PPE',
        note: 'Appendix 62–66 & 73 · physical count of PPE and infrastructure',
        roles: ['staff', 'fuel-vehicle'],
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
        roles: ['staff', 'fuel-vehicle'],
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
        roles: ['staff', 'fuel-vehicle'],
        fields: [
            fPropNo,
            fDesc,
            { ...fAcqDate, label: 'Acquisition Date' },
            { ...fCost, label: 'Acquisition Cost per Accounting' },
            { key: 'meoRecord', label: 'MEO Record', type: 'text' }
        ]
    },
    {
        id: 'high-value',
        short: 'High Value',
        name: 'Registry of Semi-Expendable Property Issued (High Value)',
        note: 'COA registry · semi-expendable HIGH VALUE property issued to offices/officers. One export sheet is generated per article.',
        roles: ['admin', 'super-admin'],
        fields: [
            { key: 'entryDate', label: 'Date', type: 'date' },
            { key: 'reference', label: 'ICS / RRSP No.', type: 'text' },
            { ...fPropNo, label: 'Semi-expendable Property No.', required: false },
            { key: 'article', label: 'Article', type: 'select', options: HIGH_VALUE_ARTICLES },
            { ...fDesc, label: 'Item Description' },
            { key: 'estimatedLife', label: 'Estimated Useful Life', type: 'number', min: 0, step: 1 },
            { ...fQuantity, label: 'Issued Qty.' },
            { ...fCost, label: 'Amount' }
        ]
    },
    // ========================================
    // WAREHOUSE OPERATIONS FORMS
    // ========================================
    {
        id: 'air',
        short: 'AIR',
        name: 'AIR — Acceptance and Inspection Report',
        note: 'Appendix 50 · acceptance and inspection of supplies delivered by supplier',
        roles: ['warehouse'],
        fields: [
            { key: 'supplier', label: 'Supplier', type: 'text', required: true, span: 2 },
            { key: 'poNo', label: 'PO No.', type: 'text' },
            { key: 'poDate', label: 'PO Date', type: 'date' },
            { key: 'officeDept', label: 'Office / Dept.', type: 'text' },
            { key: 'rcCode', label: 'RC Code', type: 'text' },
            { key: 'airNo', label: 'AIR No.', type: 'text' },
            { key: 'airDate', label: 'AIR Date', type: 'date' },
            { key: 'invoiceNo', label: 'Invoice No.', type: 'text' },
            { key: 'invoiceDate', label: 'Invoice Date', type: 'date' },
            { ...fPropNo, label: 'Stock / Property No.' },
            fDesc,
            fQuantity,
            fUnit,
            { ...fCost, label: 'Unit Cost' }
        ]
    },
    {
        id: 'ris',
        short: 'RIS',
        name: 'RIS — Requisition and Issue Slip',
        note: 'Appendix 59 · requisition and issuance of supplies to requesting office',
        roles: ['warehouse'],
        fields: [
            { key: 'fund', label: 'Fund', type: 'text' },
            { key: 'division', label: 'Division', type: 'text' },
            { key: 'officeDept', label: 'Office / Dept.', type: 'text' },
            { key: 'fppCode', label: 'FPP Code', type: 'text' },
            { key: 'risNo', label: 'RIS No.', type: 'text', required: true },
            { key: 'risDate', label: 'RIS Date', type: 'date' },
            { ...fPropNo, label: 'Stock No.' },
            fDesc,
            fQuantity,
            fUnit,
            { key: 'purpose', label: 'Purpose', type: 'textarea', span: 2 }
        ]
    },
    {
        id: 'ssmi',
        short: 'SSMI',
        name: 'SSMI — Summary of Supplies and Materials Issued',
        note: 'Monthly summary of issued supplies with attached RIS for the accounting office',
        roles: ['warehouse'],
        fields: [
            { key: 'ssmiMonth', label: 'Month / Year', type: 'text', required: true },
            { key: 'accountantName', label: 'Accountant Name', type: 'text' },
            { key: 'accountantTitle', label: 'Accountant Title', type: 'text' }
        ]
    }
];

// ============================================================
// FORM OWNERSHIP — "every form has a specific location"
// ------------------------------------------------------------
// Each registration form declares the role(s) that file it (its
// `roles` field). A form therefore only appears for the role that
// owns it, so the Register Asset picker shows warehouse staff the
// warehouse forms and inventory staff the inventory forms — and
// nothing else. Administrators are the exception: they may file
// every form, which is what lets the admin shortcut jump straight
// to a role's forms instead of scanning the whole list.
// ============================================================
export const ADMIN_FORM_ROLES = ['admin', 'super-admin'];

// Grouping used by the admin form-locator shortcut. Each group maps
// to a "location" the admin can filter by.
export const FORM_OWNER_GROUPS = [
    { id: 'inventory', label: 'Inventory Staff', roles: ['staff', 'fuel-vehicle'] },
    { id: 'warehouse', label: 'Warehouse Staff', roles: ['warehouse'] },
    { id: 'admin', label: 'Administrator', roles: ADMIN_FORM_ROLES }
];

export function isAdminFormRole(roleId) {
    return ADMIN_FORM_ROLES.includes(roleId);
}

// The forms a role may open and file. Each role gets only the forms it
// owns — administrators file the High Value registry only. Oversight of
// every other form happens from the Forms page; administrators do not
// file the staff's inventory or warehouse forms for them.
export function formsForRole(roleId) {
    return ASSET_FORMS.filter(form => (form.roles || []).includes(roleId));
}

// Human-readable "location" of a form — the role that files it.
export function formOwnerLabel(form) {
    const roles = form?.roles || [];
    if (!roles.length) return 'All roles';
    if (roles.every(isAdminFormRole)) return 'Administrator only';
    return roles.map(id => getRole(id).name).join(' / ');
}

// The owner group (location) a form type belongs to.
export function formTypeOwnerGroup(formType) {
    const ids = Array.isArray(formType) ? formType : [formType];
    const roles = new Set(
        ids
            .map(id => ASSET_FORMS.find(form => form.id === id))
            .filter(Boolean)
            .flatMap(form => form.roles || [])
    );

    if (roles.size && [...roles].every(isAdminFormRole)) return 'admin';
    if (roles.size === 1 && roles.has('warehouse')) return 'warehouse';
    return 'inventory';
}
