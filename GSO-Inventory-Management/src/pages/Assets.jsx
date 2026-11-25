
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import PageHeader from '../components/common/PageHeader';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/useAuth';

import {
    classifyByCost,
    filterAssets,
    groupAssets,
    nextPropertyNo,
    sortAssets,
    validateAsset
} from '../services/assetService';

import { exportCSV } from '../services/reportService';
import {
    downloadTemplate,
    mapHeaders,
    parseTable,
    previewImport,
    previewWorkbook
} from '../services/bulkImportService';
import { departments } from '../data/sampleAssets';
import { ADMIN_FORM_ROLES, ASSET_FORMS, REGISTER_FIELDS, formOwnerLabel, formsForRole, isWarehouseTransaction } from '../data/assetForms';

// ========================================
// DEFAULT ASSET FORM
// ========================================
const blank = {
    formType: 'general',
    propertyNo: '',
    description: '',
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

// A new record starts with an auto-issued property number.
// Road Inventory uses that field as an optional Road Network ID,
// so it is left blank for that form. Warehouse forms (AIR, RIS,
// SSMI) also use their own reference numbers, so the property
// number is left blank for the user to fill in.
const autoPropertyForms = new Set(['air', 'ris', 'ssmi', 'road-inventory']);

function draftAsset(assets, formType = 'general') {
    return {
        ...blank,
        formType,
        propertyNo: autoPropertyForms.has(formType) ? '' : nextPropertyNo(assets)
    };
}

// ========================================
// BATCH CHANGE (assign / transfer many at once)
// ========================================
const BATCH_FIELDS = [
    { key: 'department', label: 'Department / Office', options: departments },
    { key: 'accountable', label: 'Accountable Person', options: null },
    { key: 'location', label: 'Location', options: null },
    { key: 'condition', label: 'Condition', options: ['Serviceable', 'For Inspection', 'Unserviceable'] },
    { key: 'status', label: 'Status', options: ['Unassigned', 'Assigned', 'Recorded', 'Under Inspection', 'Missing'] }
];

// Values that repeat between similar entries — reused by Save & Add Another.
const CARRY_FIELDS = [
    'classification',
    'category',
    'department',
    'accountable',
    'location',
    'condition',
    'status',
    'unit'
];

// ========================================
// GROUPING OPTIONS (organize the register)
// ========================================
const groupOptions = [
    ['Classification', 'classification'],
    ['Department / Office', 'department'],
    ['Category', 'category'],
    ['Condition', 'condition'],
    ['Status', 'status'],
    ['None', 'none']
];

// ========================================
// SORTING OPTIONS
// ========================================
const sortOptions = [
    ['Property Number', 'propertyNo'],
    ['Description', 'description'],
    ['Department', 'department'],
    ['Category', 'category'],
    ['Condition', 'condition'],
    ['Quantity', 'quantity'],
    ['Acquisition Cost', 'cost']
];

// ========================================
// ASSET MANAGEMENT COMPONENT
// ========================================
export default function Assets() {

    // ------------------------------------
    // INVENTORY CONTEXT + ROLE
    // ------------------------------------
    const {
        assets,
        warehouseAssets,
        addAsset,
        updateAsset,
        deleteAsset,
        undoLast,
        history,
        trash,
        restoreAsset,
        purgeTrash,
        emptyTrash
    } = useInventory();
    const { user } = useAuth();
    const [searchParams] = useSearchParams();

    // Each role works in one register: warehouse staff in the warehouse
    // pool, everyone else in the inventory pool.
    const role = user?.role || 'staff';
    const isWarehouseRole = role === 'warehouse';
    const isAdmin = ADMIN_FORM_ROLES.includes(role);
    const pool = isWarehouseRole ? warehouseAssets : assets;

    // A form only appears for the role(s) that own it — warehouse staff see
    // the stock + AIR / RIS / SSMI forms, inventory staff see the property
    // forms, and administrators file the High Value registry only. Admins
    // oversee the other forms from the Forms page, not by filing them.
    const availableForms = useMemo(() => formsForRole(role), [role]);

    // Where a filed record is stored, decided by the form: warehouse
    // transactions and warehouse staff go to the warehouse pool,
    // everything else to the inventory pool.
    const storagePool = formType =>
        isWarehouseTransaction(formType) || isWarehouseRole ? 'warehouse' : 'inventory';

    // ------------------------------------
    // LOCAL STATES
    // ------------------------------------
    // The search box starts from the ?q= term set by the global search box.
    const [q, setQ] = useState(searchParams.get('q') || '');
    const [cls, setCls] = useState('All');
    const [form, setForm] = useState(null);
    const [groupBy, setGroupBy] = useState('classification');
    const [sortKey, setSortKey] = useState('propertyNo');
    const [sortDir, setSortDir] = useState('asc');
    const [collapsed, setCollapsed] = useState([]);

    // Values carried over from the last saved record, so entering many
    // items in a row (Save & Add Another) does not repeat the same typing.
    const [lastEntry, setLastEntry] = useState(null);

    // Records ticked for a batch change, and the batch-change inputs.
    const [selected, setSelected] = useState([]);
    const [batchField, setBatchField] = useState('department');
    const [batchValue, setBatchValue] = useState('');

    // Recycle bin panel.
    const [recycleOpen, setRecycleOpen] = useState(false);

    // Bulk import state — paste/upload rows, preview, then save in one go.
    const [importOpen, setImportOpen] = useState(false);
    const [importText, setImportText] = useState('');
    const [importPreview, setImportPreview] = useState(null);
    const [importNote, setImportNote] = useState('');
    const [importMapping, setImportMapping] = useState([]);
    const [importSource, setImportSource] = useState('');

    // Keep the search box in step when the global search jumps to a term.
    // Adjusting during render (rather than in an effect) avoids a second
    // render pass and follows React's derived-state guidance.
    const urlQuery = searchParams.get('q') || '';
    const [appliedQuery, setAppliedQuery] = useState(urlQuery);
    if (urlQuery !== appliedQuery) {
        setAppliedQuery(urlQuery);
        setQ(urlQuery);
    }

    // ------------------------------------
    // FILTER ASSET RECORDS
    // ------------------------------------
    const rows = useMemo(() => {
        return filterAssets(pool, q, cls);
    }, [pool, q, cls]);

    // ------------------------------------
    // GROUP + SORT ASSET RECORDS
    // ------------------------------------
    const groups = useMemo(() => {
        const ordered = sortAssets(rows, sortKey, sortDir);

        return groupBy === 'none'
            ? [[null, ordered]]
            : groupAssets(ordered, groupBy);
    }, [rows, sortKey, sortDir, groupBy]);

    // ------------------------------------
    // COLLAPSE / EXPAND A GROUP
    // ------------------------------------
    const toggleGroup = name =>
        setCollapsed(v =>
            v.includes(name)
                ? v.filter(n => n !== name)
                : [...v, name]
        );

    // ------------------------------------
    // SELECTION + BATCH CHANGE
    // ------------------------------------
    const toggleSelect = id =>
        setSelected(current =>
            current.includes(id) ? current.filter(x => x !== id) : [...current, id]
        );

    const toggleGroupSelect = (items, checked) => {
        const ids = items.map(a => a.id);
        setSelected(current => checked
            ? [...new Set([...current, ...ids])]
            : current.filter(id => !ids.includes(id)));
    };

    function applyBatch() {
        const value = batchValue.trim();
        if (!selected.length || !value) return;

        selected.forEach(id =>
            updateAsset(id, { [batchField]: value }, {
                action: `Batch updated ${batchField}`,
                detail: value
            })
        );

        setSelected([]);
        setBatchValue('');
    }

    // ------------------------------------
    // DUPLICATE A RECORD (start a similar entry)
    // ------------------------------------
    function duplicateRow(asset) {
        const copy = { ...asset };
        delete copy.id;

        const formType = asset.formType || 'general';
        copy.formType = formType;
        copy.serialNo = '';
        copy.propertyNo = autoPropertyForms.has(formType) ? '' : nextPropertyNo(pool);

        setForm(copy);
    }

    // ------------------------------------
    // SAVE ASSET RECORD
    // ------------------------------------
    function save(e, options = {}) {
        e.preventDefault();
        const addAnother = Boolean(options.addAnother);

        try {
            validateAsset(form);
            const record = form.formType === 'road-inventory'
                ? {
                    ...form,
                    description: form.roadName.trim(),
                    classification: 'PPE',
                    category: 'Road Infrastructure',
                    quantity: Number(form.roadLength),
                    unit: 'km',
                    cost: 0,
                    condition: 'Serviceable',
                    status: 'Recorded',
                    remarks: ''
                }
                : form;

            // Transactional forms (AIR, RIS, SSMI) allow repeated stock
            // numbers across different transactions, so skip the unique
            // property number check for those forms.
            const targetPool = storagePool(form.formType);
            const targetRegister = targetPool === 'warehouse' ? warehouseAssets : assets;

            const skipDuplicateCheck = isWarehouseTransaction(form.formType);
            const duplicate = !skipDuplicateCheck &&
                Boolean(record.propertyNo?.trim()) &&
                targetRegister.some(
                    asset => asset.propertyNo === record.propertyNo && asset.id !== form.id
                );

            if (duplicate) {
                throw Error('Property number already exists');
            }

            // Same description and serial number almost always means the
            // same physical item is already on record.
            const description = String(record.description || '').trim().toLowerCase();
            const serial = String(record.serialNo || '').trim().toLowerCase();
            const duplicateItem = Boolean(description && serial) && targetRegister.some(asset =>
                String(asset.description || '').trim().toLowerCase() === description &&
                String(asset.serialNo || '').trim().toLowerCase() === serial &&
                asset.id !== form.id
            );

            if (duplicateItem) {
                throw Error('This item is already on record (same description and serial number)');
            }

            if (form.id) {
                updateAsset(form.id, record);
                setForm(null);
                return;
            }

            addAsset(record, targetPool);

            // Remember the repeating values for the next entry.
            const carry = {};
            CARRY_FIELDS.forEach(key => { carry[key] = record[key]; });
            setLastEntry(carry);

            if (addAnother) {
                // Keep the modal open: fresh blank record with the shared
                // values kept and the next property number issued.
                setForm({ ...draftAsset([...pool, record], record.formType), ...carry });
            } else {
                setForm(null);
            }

        } catch (err) {
            alert(err.message);
        }
    }

    // ------------------------------------
    // BULK IMPORT HANDLERS
    // ------------------------------------
    function openImport() {
        setImportText('');
        setImportPreview(null);
        setImportNote('');
        setImportMapping([]);
        setImportSource('');
        setImportOpen(true);
    }

    function handleImportFile(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        // Excel workbooks are read directly; CSV/text is put in the box
        // so it can still be tweaked before previewing.
        if (/\.xlsx?$/i.test(file.name)) {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const result = await previewWorkbook(reader.result, pool);
                    setImportText('');
                    setImportPreview(result.rows);
                    setImportMapping(result.mapping);
                    setImportSource(result.sheet ? `Sheet "${result.sheet}"` : file.name);
                    setImportNote(result.rows.length
                        ? ''
                        : 'No table with recognised columns was found in this workbook.');
                } catch (err) {
                    setImportNote(`Could not read the workbook: ${err.message}`);
                }
            };
            reader.readAsArrayBuffer(file);
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setImportPreview(null);
            setImportMapping([]);
            setImportSource('');
            setImportText(String(reader.result || ''));
        };
        reader.readAsText(file);
    }

    function runPreview() {
        const preview = previewImport(importText, pool);
        setImportPreview(preview);
        setImportMapping(mapHeaders(parseTable(importText)[0] || []));
        setImportSource('');
        setImportNote(preview.length
            ? ''
            : 'No rows were found. Paste rows copied from Excel, or choose a CSV / .xlsx file.');
    }

    function confirmImport() {
        const ready = (importPreview || []).filter(row => row.valid);
        if (!ready.length) return;

        ready.forEach(row =>
            addAsset(row.record, storagePool(row.record.formType || 'general'))
        );

        setImportOpen(false);
        setImportPreview(null);
        setImportMapping([]);
        alert(`Imported ${ready.length} record${ready.length === 1 ? '' : 's'}.`);
    }

    // ------------------------------------
    // ACTIVE FORM + REGISTER FIELDS
    // ------------------------------------
    const activeForm =
        ASSET_FORMS.find(f => f.id === (form?.formType || 'general')) ||
        ASSET_FORMS[0];

    // Editing an existing record keeps that record's own form available even
    // if the current role would not file it fresh, so the picker and the
    // fields always match the record being edited.
    const modalForms = availableForms.some(f => f.id === activeForm.id)
        ? availableForms
        : [...availableForms, activeForm];

    // Warehouse transaction forms (AIR, RIS, SSMI) and Road Inventory do
    // not use the shared register fields (classification, category,
    // department, etc.) — they are transactional records, not property
    // master records.
    const isTransactional = form?.formType === 'road-inventory' || isWarehouseTransaction(form?.formType);
    const fieldKeys = new Set(activeForm.fields.map(f => f.key));

    const registerFields = REGISTER_FIELDS.filter(f => !fieldKeys.has(f.key));

    const activeBatch = BATCH_FIELDS.find(f => f.key === batchField) || BATCH_FIELDS[0];

    // ------------------------------------
    // RENDER A SINGLE FORM FIELD
    // ------------------------------------
    function renderField(f) {

        const value = form[f.key] ?? '';

        const set = e => {

            const next = e.target.value;

            // Item value rule: ₱50,000 and above → Expendable, else Semi-Expendable.
            setForm(
                f.key === 'cost'
                    ? { ...form, cost: next, classification: classifyByCost(next) }
                    : { ...form, [f.key]: next }
            );
        };

        return (
            <label key={f.key} className={f.span === 2 ? 'span-2' : undefined}>

                {f.label}

                {f.type === 'select' ? (

                    <select required={f.required} value={value} onChange={set}>
                        {f.options.map(option => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>

                ) : f.type === 'textarea' ? (

                    <textarea value={value} onChange={set} />

                ) : (

                    <input
                        type={f.type}
                        required={f.required}
                        min={f.min}
                        step={f.step}
                        value={value}
                        onChange={set}
                    />

                )}

            </label>
        );
    }

    // ====================================
    // RENDER PAGE
    // ====================================
    return (
        <>
            {/* PAGE HEADER */}
            <PageHeader
                title="Asset Management"
                description="Register, search, sort and group property records by classification, office, category or condition."
                action={
                    <div className="head-actions">
                        {!isAdmin && (
                            <button type="button" className="secondary" onClick={openImport}>
                                ⇪ Bulk Import
                            </button>
                        )}
                        <button
                            onClick={() => setForm({
                                ...draftAsset(pool, availableForms[0]?.id),
                                ...(lastEntry || {})
                            })}
                        >
                            {isAdmin ? '＋ Register High Value' : '＋ Register Asset'}
                        </button>
                    </div>
                }
            />

            {/* =================================
                ASSET TABLE PANEL
            ================================= */}
            <article className="panel">

                {/* SEARCH, FILTER, GROUP AND SORT TOOLBAR */}
                <div className="toolbar">

                    <input
                        type="text"
                        placeholder="Search property number, description, office..."
                        value={q}
                        onChange={e => setQ(e.target.value)}
                    />

                    <label>
                        Classification
                        <select
                            value={cls}
                            onChange={e => setCls(e.target.value)}
                        >
                            <option value="All">All</option>
                            <option value="PPE">PPE</option>
                            <option value="Semi-Expendable">
                                Semi-Expendable
                            </option>
                            <option value="Expendable">Expendable</option>
                            <option value="Land">Land</option>
                            <option value="Land Improvement">
                                Land Improvement
                            </option>
                        </select>
                    </label>

                    <label>
                        Group by
                        <select
                            value={groupBy}
                            onChange={e => {
                                setGroupBy(e.target.value);
                                setCollapsed([]);
                            }}
                        >
                            {groupOptions.map(([label, key]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Sort by
                        <select
                            value={sortKey}
                            onChange={e => setSortKey(e.target.value)}
                        >
                            {sortOptions.map(([label, key]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                            setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
                        }
                    >
                        {sortDir === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
                    </button>

                    <button onClick={() => exportCSV(rows)}>
                        Export CSV
                    </button>

                    <button
                        type="button"
                        className="secondary"
                        onClick={undoLast}
                        disabled={!history.length}
                        title={history.length ? `Undo: ${history[0].label}` : 'Nothing to undo'}
                    >
                        ↶ Undo
                    </button>

                    <button
                        type="button"
                        className="secondary"
                        onClick={() => setRecycleOpen(true)}
                    >
                        Recycle Bin{trash.length ? ` (${trash.length})` : ''}
                    </button>

                </div>

                {/* RESULT SUMMARY */}
                <p className="result-count">
                    Showing {rows.length} of {pool.length} record
                    {pool.length === 1 ? '' : 's'}
                    {groupBy !== 'none' && groups.length > 0
                        ? ` · ${groups.length} group${groups.length === 1 ? '' : 's'}`
                        : ''}
                </p>

                {/* BATCH CHANGE BAR — appears once records are ticked */}
                {selected.length > 0 && (
                    <div className="batch-bar">
                        <strong>{selected.length} selected</strong>

                        <label>
                            Set
                            <select
                                value={batchField}
                                onChange={e => {
                                    setBatchField(e.target.value);
                                    setBatchValue('');
                                }}
                            >
                                {BATCH_FIELDS.map(f => (
                                    <option key={f.key} value={f.key}>{f.label}</option>
                                ))}
                            </select>
                        </label>

                        {activeBatch.options ? (
                            <select value={batchValue} onChange={e => setBatchValue(e.target.value)}>
                                <option value="">— choose —</option>
                                {activeBatch.options.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="text"
                                value={batchValue}
                                placeholder="New value"
                                onChange={e => setBatchValue(e.target.value)}
                            />
                        )}

                        <button type="button" onClick={applyBatch} disabled={!batchValue.trim()}>
                            Apply to {selected.length}
                        </button>

                        <button type="button" className="secondary" onClick={() => setSelected([])}>
                            Clear
                        </button>
                    </div>
                )}

                {/* ASSET RECORDS — GROUPED SECTIONS */}
                {rows.length === 0 ? (

                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Property No.</th>
                                    <th>Description</th>
                                    <th>Class</th>
                                    <th>Department</th>
                                    <th>Qty</th>
                                    <th>Condition</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center' }}>
                                        No asset records found.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                ) : (

                    groups.map(([name, items]) => (

                        <section className="asset-group" key={name ?? '__all__'}>

                            {/* GROUP HEADER — CLICK TO COLLAPSE / EXPAND */}
                            {groupBy !== 'none' && (
                                <button
                                    type="button"
                                    className="group-head"
                                    onClick={() => toggleGroup(name)}
                                >
                                    <span>{name}</span>

                                    <small>
                                        {items.length} record
                                        {items.length === 1 ? '' : 's'}
                                    </small>

                                    <em>
                                        {collapsed.includes(name) ? '＋' : '－'}
                                    </em>
                                </button>
                            )}

                            {/* GROUP RECORDS */}
                            {!collapsed.includes(name) && (
                                <div className="table-scroll">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th className="check-col">
                                                    <input
                                                        type="checkbox"
                                                        aria-label="Select all in group"
                                                        checked={items.every(a => selected.includes(a.id))}
                                                        onChange={e => toggleGroupSelect(items, e.target.checked)}
                                                    />
                                                </th>
                                                <th>Property No.</th>
                                                <th>Description</th>
                                                <th>Class</th>
                                                <th>Department</th>
                                                <th>Qty</th>
                                                <th>Condition</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {items.map(asset => (
                                                <tr key={asset.id}>

                                                    <td className="check-col">
                                                        <input
                                                            type="checkbox"
                                                            aria-label={`Select ${asset.propertyNo || asset.description}`}
                                                            checked={selected.includes(asset.id)}
                                                            onChange={() => toggleSelect(asset.id)}
                                                        />
                                                    </td>

                                                    <td>{asset.propertyNo}</td>

                                                    <td>{asset.description}</td>

                                                    <td>{asset.classification}</td>

                                                    <td>{asset.department}</td>

                                                    <td>
                                                        {asset.quantity} {asset.unit}
                                                    </td>

                                                    <td>{asset.condition}</td>

                                                    <td>
                                                        <button
                                                            onClick={() =>
                                                                setForm({
                                                                    ...asset,
                                                                    formType: asset.formType || 'general'
                                                                })
                                                            }
                                                        >
                                                            Edit
                                                        </button>

                                                        {' '}

                                                        {!isAdmin && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    className="secondary"
                                                                    onClick={() => duplicateRow(asset)}
                                                                >
                                                                    Duplicate
                                                                </button>

                                                                {' '}
                                                            </>
                                                        )}

                                                        <button
                                                            className="delete"
                                                            onClick={() => {
                                                                if (confirm('Delete this record?')) {
                                                                    deleteAsset(asset.id);
                                                                }
                                                            }}
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>

                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                        </section>
                    ))

                )}

            </article>

            {/* =================================
                REGISTER / EDIT ASSET MODAL
            ================================= */}
            {form && (

                <div className="overlay">

                    <form
                        className="modal"
                        onSubmit={save}
                    >

                        <h2>
                            {form.id
                                ? 'Edit Asset'
                                : isAdmin
                                    ? 'Register High Value Record'
                                    : 'Register Asset'}
                        </h2>

                        {/* FORM TYPE — WHAT THE USER IS FILLING UP */}
                        <div className="form-type">

                            <label>
                                Form Type — what are you filling up?

                                <select
                                    value={form.formType || 'general'}
                                    onChange={e => {
                                        const formType = e.target.value;

                                        setForm(prev => ({
                                            ...prev,
                                            formType,
                                            // Issue a number for a blank new record.
                                            propertyNo:
                                                !prev.id &&
                                                !prev.propertyNo &&
                                                !autoPropertyForms.has(formType)
                                                    ? nextPropertyNo(pool)
                                                    : prev.propertyNo
                                        }));
                                    }}
                                >
                                    {modalForms.map(f => (
                                        <option key={f.id} value={f.id}>
                                            {f.name}
                                        </option>
                                    ))}
                                </select>

                            </label>

                            <small className="form-note">
                                {activeForm.note}
                            </small>

                            <small className="form-note">
                                Filed by: <b>{formOwnerLabel(activeForm)}</b>
                            </small>

                        </div>

                        {/* FIELDS REQUIRED BY THE SELECTED FORM */}
                        <h3 className="section-title">
                            {activeForm.short} fields
                        </h3>

                        <div className="form-grid">
                            {activeForm.fields.map(renderField)}
                        </div>

                        {!isTransactional && (
                            <>
                                <h3 className="section-title">
                                    Register details
                                </h3>

                                <div className="form-grid">
                                    {registerFields.map(renderField)}
                                </div>
                            </>
                        )}

                        {/* MODAL ACTION BUTTONS */}
                        <div className="actions">

                            <button
                                type="button"
                                className="secondary"
                                onClick={() => setForm(null)}
                            >
                                Cancel
                            </button>

                            {!form.id && (
                                <button
                                    type="button"
                                    className="secondary"
                                    onClick={e => save(e, { addAnother: true })}
                                    title="Save this record and keep the form open for the next one"
                                >
                                    Save &amp; Add Another
                                </button>
                            )}

                            <button type="submit">
                                Save Record
                            </button>

                        </div>

                    </form>

                </div>

            )}

            {/* =================================
                BULK IMPORT MODAL
            ================================= */}
            {importOpen && (

                <div className="overlay">

                    <div className="modal">

                        <h2>
                            Bulk Import — {isWarehouseRole ? 'Warehouse' : 'Inventory'} Register
                        </h2>

                        <p className="result-count">
                            Upload an Excel (.xlsx) or CSV file — or paste rows copied from Excel — then
                            preview before saving. Columns are matched to fields automatically and blank
                            property numbers are issued for you.
                        </p>

                        <div className="import-actions">

                            <button type="button" className="secondary" onClick={downloadTemplate}>
                                Download Template
                            </button>

                            <label className="file-field">
                                Choose Excel or CSV file
                                <input
                                    type="file"
                                    accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                    onChange={handleImportFile}
                                />
                            </label>

                        </div>

                        <label className="field-block">
                            Rows to import

                            <textarea
                                value={importText}
                                onChange={event => setImportText(event.target.value)}
                                placeholder="Property No.,Description,Quantity,Unit,Unit Cost,Department / Office,..."
                            />
                        </label>

                        <div className="import-actions">
                            <button type="button" onClick={runPreview}>
                                Preview Rows
                            </button>
                        </div>

                        {importNote && <p className="form-status error">{importNote}</p>}

                        {importMapping.length > 0 && (
                            <p className="mapping-list">
                                {importSource ? `${importSource} · ` : ''}
                                Matched: {importMapping.filter(m => m.to).map(m => `${m.header} → ${m.to}`).join(', ') || 'none'}
                                {importMapping.some(m => !m.to && m.header) && (
                                    <>
                                        {' · '}Ignored: {importMapping.filter(m => !m.to && m.header).map(m => m.header).join(', ')}
                                    </>
                                )}
                            </p>
                        )}

                        {importPreview && importPreview.length > 0 && (
                            <>
                                <p className="result-count">
                                    {importPreview.filter(row => row.valid).length} ready to import ·{' '}
                                    {importPreview.filter(row => !row.valid).length} with errors
                                </p>

                                <div className="table-scroll import-preview">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Row</th>
                                                <th>Property No.</th>
                                                <th>Description</th>
                                                <th>Qty</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {importPreview.map(row => (
                                                <tr key={row.line} className={row.valid ? '' : 'row-error'}>
                                                    <td>{row.line}</td>
                                                    <td>{row.record.propertyNo || '—'}</td>
                                                    <td>{row.record.description || '—'}</td>
                                                    <td>{row.record.quantity}</td>
                                                    <td>
                                                        {row.valid ? (
                                                            <span className="activity-tag tone-create">Ready</span>
                                                        ) : (
                                                            <span className="activity-tag tone-delete">
                                                                {row.errors.join('; ')}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        <div className="actions">

                            <button
                                type="button"
                                className="secondary"
                                onClick={() => setImportOpen(false)}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={confirmImport}
                                disabled={!importPreview?.some(row => row.valid)}
                            >
                                Import {importPreview ? importPreview.filter(row => row.valid).length : 0} Record
                                {importPreview && importPreview.filter(row => row.valid).length === 1 ? '' : 's'}
                            </button>

                        </div>

                    </div>

                </div>

            )}

            {/* =================================
                RECYCLE BIN MODAL
            ================================= */}
            {recycleOpen && (

                <div className="overlay">

                    <div className="modal">

                        <h2>Recycle Bin</h2>

                        <p className="result-count">
                            Deleted records are kept here so a mistake can be put back. Restore a
                            record to return it to its register, or remove it for good.
                        </p>

                        {trash.length === 0 ? (
                            <p className="result-count">The recycle bin is empty.</p>
                        ) : (
                            <div className="table-scroll">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Property No.</th>
                                            <th>Description</th>
                                            <th>Deleted By</th>
                                            <th>Deleted On</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {trash.map(item => (
                                            <tr key={item.trashId}>
                                                <td>{item.record?.propertyNo || '—'}</td>
                                                <td>{item.record?.description || '—'}</td>
                                                <td>{item.deletedBy}</td>
                                                <td>{item.deletedAt}</td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        onClick={() => restoreAsset(item.trashId)}
                                                    >
                                                        Restore
                                                    </button>

                                                    {' '}

                                                    <button
                                                        type="button"
                                                        className="delete"
                                                        onClick={() => purgeTrash(item.trashId)}
                                                    >
                                                        Delete Forever
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="actions">

                            {trash.length > 0 && (
                                <button
                                    type="button"
                                    className="delete"
                                    onClick={() => {
                                        if (confirm('Permanently remove every record in the recycle bin?')) {
                                            emptyTrash();
                                        }
                                    }}
                                >
                                    Empty Recycle Bin
                                </button>
                            )}

                            <button
                                type="button"
                                className="secondary"
                                onClick={() => setRecycleOpen(false)}
                            >
                                Close
                            </button>

                        </div>

                    </div>

                </div>

            )}

        </>
    );
}
