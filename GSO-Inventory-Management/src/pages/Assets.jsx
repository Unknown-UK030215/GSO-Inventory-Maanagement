
import { useMemo, useState } from 'react';

import PageHeader from '../components/common/PageHeader';
import { useInventory } from '../context/InventoryContext';

import {
    classifyByCost,
    filterAssets,
    groupAssets,
    nextPropertyNo,
    sortAssets,
    validateAsset
} from '../services/assetService';

import { exportCSV } from '../services/reportService';
import { departments } from '../data/sampleAssets';
import { ASSET_FORMS, REGISTER_FIELDS } from '../data/assetForms';

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
// so it is left blank for that form.
function draftAsset(assets, formType = 'general') {
    return {
        ...blank,
        formType,
        propertyNo: formType === 'road-inventory' ? '' : nextPropertyNo(assets)
    };
}

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
    // INVENTORY CONTEXT
    // ------------------------------------
    const {
        assets,
        addAsset,
        updateAsset,
        deleteAsset
    } = useInventory();

    // ------------------------------------
    // LOCAL STATES
    // ------------------------------------
    const [q, setQ] = useState('');
    const [cls, setCls] = useState('All');
    const [form, setForm] = useState(null);
    const [groupBy, setGroupBy] = useState('classification');
    const [sortKey, setSortKey] = useState('propertyNo');
    const [sortDir, setSortDir] = useState('asc');
    const [collapsed, setCollapsed] = useState([]);

    // ------------------------------------
    // FILTER ASSET RECORDS
    // ------------------------------------
    const rows = useMemo(() => {
        return filterAssets(assets, q, cls);
    }, [assets, q, cls]);

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
    // SAVE ASSET RECORD
    // ------------------------------------
    function save(e) {
        e.preventDefault();

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

            const duplicate = Boolean(record.propertyNo?.trim()) && assets.some(
                asset => asset.propertyNo === record.propertyNo && asset.id !== form.id
            );

            if (duplicate) {
                throw Error('Property number already exists');
            }

            if (form.id) {
                updateAsset(form.id, record);
            } else {
                addAsset(record);
            }

            setForm(null);

        } catch (err) {
            alert(err.message);
        }
    }

    // ------------------------------------
    // ACTIVE FORM + REGISTER FIELDS
    // ------------------------------------
    const activeForm =
        ASSET_FORMS.find(f => f.id === (form?.formType || 'general')) ||
        ASSET_FORMS[0];

    const isRoadInventory = form?.formType === 'road-inventory';
    const fieldKeys = new Set(activeForm.fields.map(f => f.key));

    const registerFields = REGISTER_FIELDS.filter(f => !fieldKeys.has(f.key));

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
                    <button onClick={() => setForm(draftAsset(assets))}>
                        ＋ Register Asset
                    </button>
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

                </div>

                {/* RESULT SUMMARY */}
                <p className="result-count">
                    Showing {rows.length} of {assets.length} record
                    {assets.length === 1 ? '' : 's'}
                    {groupBy !== 'none' && groups.length > 0
                        ? ` · ${groups.length} group${groups.length === 1 ? '' : 's'}`
                        : ''}
                </p>

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
                            {form.id ? 'Edit Asset' : 'Register Asset'}
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
                                                formType !== 'road-inventory'
                                                    ? nextPropertyNo(assets)
                                                    : prev.propertyNo
                                        }));
                                    }}
                                >
                                    {ASSET_FORMS.map(f => (
                                        <option key={f.id} value={f.id}>
                                            {f.name}
                                        </option>
                                    ))}
                                </select>

                            </label>

                            <small className="form-note">
                                {activeForm.note}
                            </small>

                        </div>

                        {/* FIELDS REQUIRED BY THE SELECTED FORM */}
                        <h3 className="section-title">
                            {activeForm.short} fields
                        </h3>

                        <div className="form-grid">
                            {activeForm.fields.map(renderField)}
                        </div>

                        {!isRoadInventory && (
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

                            <button type="submit">
                                Save Record
                            </button>

                        </div>

                    </form>

                </div>

            )}

        </>
    );
}
