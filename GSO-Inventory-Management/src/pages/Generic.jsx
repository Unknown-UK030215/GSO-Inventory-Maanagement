import { useMemo, useState } from 'react';

import PageHeader from '../components/common/PageHeader';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/useAuth';
import { isWarehouseTransaction } from '../data/assetForms';
import { departments as defaultDepartments } from '../data/sampleAssets';
import { exportCSV } from '../services/reportService';

const titles = {
    'physical-inventory': 'Physical Inventory',
    assignments: 'Property Assignments',
    transfers: 'Property Transfers',
    inspection: 'Inspection & Repair',
    departments: 'Departments',
    reports: 'Reports',
    'activity-logs': 'Activity Logs'
};

function officesFor(assets) {
    return [...new Set([
        ...defaultDepartments,
        ...assets.map(asset => asset.department).filter(Boolean)
    ])].sort((a, b) => a.localeCompare(b));
}

function matchesQuery(asset, query) {
    const text = [
        asset.propertyNo,
        asset.description,
        asset.department,
        asset.accountable,
        asset.status,
        asset.condition
    ].join(' ').toLowerCase();
    return text.includes(query.trim().toLowerCase());
}

function AssignmentsPage({ assets, updateAsset }) {
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [selectedId, setSelectedId] = useState('');
    const [department, setDepartment] = useState('');
    const [accountable, setAccountable] = useState('');

    const selectedAsset = assets.find(asset => String(asset.id) === selectedId);
    const offices = officesFor(assets);
    const eligibleAssets = assets.filter(asset =>
        asset.status !== 'Missing' && asset.condition !== 'Unserviceable'
    );
    const filtered = assets.filter(asset =>
        matchesQuery(asset, query) &&
        (statusFilter === 'All' ||
            (statusFilter === 'Other'
                ? !['Assigned', 'Unassigned'].includes(asset.status)
                : asset.status === statusFilter))
    );
    const assignedCount = assets.filter(asset => asset.status === 'Assigned').length;
    const unassignedCount = assets.filter(asset => asset.status === 'Unassigned').length;
    const otherCount = assets.length - assignedCount - unassignedCount;

    function chooseAsset(id) {
        const asset = assets.find(item => String(item.id) === id);
        setSelectedId(id);
        setDepartment(asset?.department || '');
        setAccountable(asset?.accountable || '');
    }

    function saveAssignment(event) {
        event.preventDefault();
        if (!selectedAsset || !department || !accountable.trim()) return;

        const action = selectedAsset.status === 'Assigned' ? 'Updated assignment' : 'Assigned property';
        updateAsset(selectedAsset.id, {
            department,
            accountable: accountable.trim(),
            status: 'Assigned'
        }, {
            action,
            detail: `${selectedAsset.propertyNo} assigned to ${accountable.trim()} · ${department}`
        });
        chooseAsset('');
    }

    function unassign(asset) {
        updateAsset(asset.id, {
            accountable: '',
            status: 'Unassigned'
        }, {
            action: 'Unassigned property',
            detail: `${asset.propertyNo} removed from ${asset.accountable || 'its accountable person'}`
        });
    }

    return (
        <>
            <PageHeader
                title="Property Assignments"
                description="Assign property to an accountable person and office, or review current assignments."
            />

            <div className="cards workflow-cards">
                <article><small>Assigned</small><strong>{assignedCount}</strong></article>
                <article><small>Unassigned</small><strong>{unassignedCount}</strong></article>
                <article><small>Other Status</small><strong>{otherCount}</strong></article>
            </div>

            <div className="stack">
                <article className="panel">
                    <h3>Assign or Update Property</h3>
                    <p className="result-count">Choose a property, then set the responsible person and office.</p>

                    <form onSubmit={saveAssignment}>
                        <div className="form-grid">
                            <label className="span-2">
                                Property
                                <select value={selectedId} onChange={event => chooseAsset(event.target.value)} required>
                                    <option value="">Select a property…</option>
                                    {eligibleAssets.map(asset => (
                                        <option key={asset.id} value={asset.id}>
                                            {asset.propertyNo} — {asset.description}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Department / Office
                                <select value={department} onChange={event => setDepartment(event.target.value)} required>
                                    <option value="">Select an office…</option>
                                    {offices.map(office => <option key={office}>{office}</option>)}
                                </select>
                            </label>
                            <label>
                                Accountable Person
                                <input
                                    value={accountable}
                                    onChange={event => setAccountable(event.target.value)}
                                    placeholder="Enter the responsible person's name"
                                    required
                                />
                            </label>
                        </div>
                        <div className="actions">
                            <button type="submit" disabled={!selectedAsset}>Save Assignment</button>
                        </div>
                    </form>
                </article>

                <article className="panel">
                    <div className="panel-head">
                        <div>
                            <h3>Assignment Register</h3>
                            <p className="result-count">{filtered.length} of {assets.length} properties</p>
                        </div>
                    </div>
                    <div className="toolbar">
                        <input
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder="Search property, person, office…"
                            aria-label="Search assignments"
                        />
                        <label>
                            Status
                            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                                <option>All</option>
                                <option>Assigned</option>
                                <option>Unassigned</option>
                                <option value="Other">Other</option>
                            </select>
                        </label>
                    </div>
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Property No.</th>
                                    <th>Description</th>
                                    <th>Department</th>
                                    <th>Accountable Person</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(asset => (
                                    <tr key={asset.id}>
                                        <td>{asset.propertyNo || '—'}</td>
                                        <td>{asset.description || '—'}</td>
                                        <td>{asset.department || '—'}</td>
                                        <td>{asset.accountable || '—'}</td>
                                        <td>{asset.status || 'Unassigned'}</td>
                                        <td className="row-actions">
                                            <button type="button" className="secondary" onClick={() => chooseAsset(String(asset.id))}>
                                                Edit
                                            </button>
                                            {asset.status === 'Assigned' && (
                                                <button type="button" className="secondary" onClick={() => unassign(asset)}>
                                                    Unassign
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {!filtered.length && <tr><td colSpan="6">No matching properties.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </article>
            </div>
        </>
    );
}

function TransfersPage({ assets, logs, updateAsset }) {
    const [assetId, setAssetId] = useState('');
    const [toDepartment, setToDepartment] = useState('');
    const [toAccountable, setToAccountable] = useState('');
    const [remarks, setRemarks] = useState('');
    const selectedAsset = assets.find(asset => String(asset.id) === assetId);
    const offices = officesFor(assets);
    const transferable = assets.filter(asset =>
        asset.status !== 'Missing' && asset.condition !== 'Unserviceable'
    );
    const transferLogs = logs.filter(item => item.action === 'Transferred property').slice(0, 8);
    const canTransfer = selectedAsset && toDepartment && toAccountable.trim() &&
        (toDepartment !== selectedAsset.department || toAccountable.trim() !== selectedAsset.accountable);

    function submitTransfer(event) {
        event.preventDefault();
        if (!canTransfer) return;

        const transfer = {
            date: new Date().toISOString().slice(0, 10),
            fromDepartment: selectedAsset.department || '',
            toDepartment,
            fromAccountable: selectedAsset.accountable || '',
            toAccountable: toAccountable.trim(),
            remarks: remarks.trim()
        };
        const detail = `${selectedAsset.propertyNo}: ${transfer.fromDepartment || 'No office'} → ${toDepartment}; ${transfer.fromAccountable || 'No accountable person'} → ${transfer.toAccountable}`;

        updateAsset(selectedAsset.id, {
            department: toDepartment,
            accountable: toAccountable.trim(),
            status: 'Assigned',
            transferHistory: [transfer, ...(selectedAsset.transferHistory || [])]
        }, { action: 'Transferred property', detail });

        setAssetId('');
        setToDepartment('');
        setToAccountable('');
        setRemarks('');
    }

    function chooseProperty(id) {
        const asset = assets.find(item => String(item.id) === id);
        setAssetId(id);
        setToDepartment('');
        setToAccountable(asset?.accountable || '');
    }

    return (
        <>
            <PageHeader
                title="Property Transfers"
                description="Record a property handover and update its assigned office and accountable person."
            />

            <div className="cards workflow-cards">
                <article><small>Total Properties</small><strong>{assets.length}</strong></article>
                <article><small>Transfer Records</small><strong>{logs.filter(item => item.action === 'Transferred property').length}</strong></article>
                <article><small>Eligible to Transfer</small><strong>{transferable.length}</strong></article>
            </div>

            <div className="stack">
                <article className="panel">
                    <h3>Record a Transfer</h3>
                    <p className="result-count">The previous and new assignment are saved to the property's transfer history.</p>
                    <form onSubmit={submitTransfer}>
                        <div className="form-grid">
                            <label className="span-2">
                                Property to Transfer
                                <select value={assetId} onChange={event => chooseProperty(event.target.value)} required>
                                    <option value="">Select a property…</option>
                                    {transferable.map(asset => (
                                        <option key={asset.id} value={asset.id}>
                                            {asset.propertyNo} — {asset.description}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Current Office
                                <input value={selectedAsset?.department || 'Select a property first'} readOnly />
                            </label>
                            <label>
                                Current Accountable Person
                                <input value={selectedAsset?.accountable || '—'} readOnly />
                            </label>
                            <label>
                                Receiving Office
                                <select value={toDepartment} onChange={event => setToDepartment(event.target.value)} required>
                                    <option value="">Select receiving office…</option>
                                    {offices.map(office => <option key={office}>{office}</option>)}
                                </select>
                            </label>
                            <label>
                                Receiving Accountable Person
                                <input
                                    value={toAccountable}
                                    onChange={event => setToAccountable(event.target.value)}
                                    placeholder="Enter recipient name"
                                    required
                                />
                            </label>
                            <label className="span-2">
                                Transfer Notes
                                <textarea
                                    value={remarks}
                                    onChange={event => setRemarks(event.target.value)}
                                    placeholder="Optional handover or authorization details"
                                />
                            </label>
                        </div>
                        <div className="actions">
                            <button type="submit" disabled={!canTransfer}>Save Transfer</button>
                        </div>
                        {selectedAsset && !canTransfer && toDepartment === selectedAsset.department &&
                            toAccountable.trim() === selectedAsset.accountable && (
                                <p className="form-note">Choose a different office or accountable person to record a transfer.</p>
                            )}
                    </form>
                </article>

                <article className="panel">
                    <h3>Recent Transfer Activity</h3>
                    {transferLogs.length ? (
                        <div className="table-scroll">
                            <table>
                                <thead><tr><th>Date</th><th>Transfer</th></tr></thead>
                                <tbody>
                                    {transferLogs.map(item => (
                                        <tr key={item.id}><td>{item.date}</td><td>{item.detail}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <p className="result-count">No transfers have been recorded yet.</p>}
                </article>
            </div>
        </>
    );
}

function InspectionPage({ assets, updateAsset }) {
    const [query, setQuery] = useState('');
    const [conditionFilter, setConditionFilter] = useState('For Inspection');
    const [drafts, setDrafts] = useState({});
    const awaiting = assets.filter(asset => asset.condition === 'For Inspection').length;
    const unserviceable = assets.filter(asset => asset.condition === 'Unserviceable').length;
    const serviceable = assets.filter(asset => asset.condition === 'Serviceable').length;
    const filtered = assets.filter(asset =>
        matchesQuery(asset, query) &&
        (conditionFilter === 'All' || (asset.condition || 'Serviceable') === conditionFilter)
    );

    function changeDraft(asset, changes) {
        setDrafts(previous => ({
            ...previous,
            [asset.id]: {
                condition: previous[asset.id]?.condition ?? asset.condition ?? 'Serviceable',
                inspectionNotes: previous[asset.id]?.inspectionNotes ?? asset.inspectionNotes ?? asset.remarks ?? '',
                ...changes
            }
        }));
    }

    function saveInspection(asset) {
        const draft = drafts[asset.id];
        if (!draft) return;
        const action = draft.condition === 'Serviceable' ? 'Completed inspection' : 'Updated inspection status';
        const detail = `${asset.propertyNo} marked ${draft.condition}${draft.inspectionNotes ? ` · ${draft.inspectionNotes}` : ''}`;
        updateAsset(asset.id, {
            condition: draft.condition,
            inspectionNotes: draft.inspectionNotes
        }, { action, detail });
        setDrafts(previous => {
            const next = { ...previous };
            delete next[asset.id];
            return next;
        });
    }

    return (
        <>
            <PageHeader
                title="Inspection & Repair"
                description="Review inspection requests, record findings, and update property condition."
            />

            <div className="cards workflow-cards">
                <article><small>Awaiting Inspection</small><strong>{awaiting}</strong></article>
                <article><small>Unserviceable</small><strong>{unserviceable}</strong></article>
                <article><small>Serviceable</small><strong>{serviceable}</strong></article>
            </div>

            <article className="panel">
                <div className="panel-head">
                    <div>
                        <h3>Inspection Queue</h3>
                        <p className="result-count">{filtered.length} matching properties</p>
                    </div>
                </div>
                <div className="toolbar">
                    <input
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder="Search property, office, person…"
                        aria-label="Search inspection records"
                    />
                    <label>
                        Condition
                        <select value={conditionFilter} onChange={event => setConditionFilter(event.target.value)}>
                            <option>For Inspection</option>
                            <option>Unserviceable</option>
                            <option>Serviceable</option>
                            <option>All</option>
                        </select>
                    </label>
                </div>
                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Property No.</th>
                                <th>Description</th>
                                <th>Office / Accountable</th>
                                <th>Condition</th>
                                <th>Inspection Notes</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(asset => {
                                const draft = drafts[asset.id] || {
                                    condition: asset.condition || 'Serviceable',
                                    inspectionNotes: asset.inspectionNotes || asset.remarks || ''
                                };
                                const changed = draft.condition !== (asset.condition || 'Serviceable') ||
                                    draft.inspectionNotes !== (asset.inspectionNotes || asset.remarks || '');

                                return (
                                    <tr key={asset.id}>
                                        <td>{asset.propertyNo || '—'}</td>
                                        <td>{asset.description || '—'}</td>
                                        <td>{asset.department || '—'}<br /><small>{asset.accountable || 'No accountable person'}</small></td>
                                        <td>
                                            <select
                                                value={draft.condition}
                                                onChange={event => changeDraft(asset, { condition: event.target.value })}
                                                aria-label={`Condition for ${asset.propertyNo}`}
                                            >
                                                <option>Serviceable</option>
                                                <option>For Inspection</option>
                                                <option>Unserviceable</option>
                                            </select>
                                        </td>
                                        <td>
                                            <input
                                                value={draft.inspectionNotes}
                                                onChange={event => changeDraft(asset, { inspectionNotes: event.target.value })}
                                                placeholder="Findings or repair notes"
                                                aria-label={`Inspection notes for ${asset.propertyNo}`}
                                            />
                                        </td>
                                        <td>
                                            <button type="button" disabled={!changed} onClick={() => saveInspection(asset)}>
                                                Save
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!filtered.length && (
                                <tr><td colSpan="6">No properties match this inspection filter.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </article>
        </>
    );
}

function ActivityLogsPage({ logs }) {
    const [query, setQuery] = useState('');
    const [actionFilter, setActionFilter] = useState('All actions');
    const today = new Date().toDateString();
    const actions = [...new Set(logs.map(item => item.action || 'Other'))].sort();
    const orderedLogs = [...logs].sort((a, b) => {
        const timeA = Date.parse(a.date) || Number(a.id) || 0;
        const timeB = Date.parse(b.date) || Number(b.id) || 0;
        return timeB - timeA;
    });
    const filtered = orderedLogs.filter(item => {
        const text = `${item.date || ''} ${item.action || ''} ${item.detail || ''}`.toLowerCase();
        return text.includes(query.trim().toLowerCase()) &&
            (actionFilter === 'All actions' || item.action === actionFilter);
    });
    const todayCount = logs.filter(item =>
        new Date(item.date).toDateString() === today
    ).length;

    function formatDate(value) {
        const date = new Date(value);
        if (!value || Number.isNaN(date.getTime())) return { date: value || '—', time: '' };
        return {
            date: date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
            time: date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
        };
    }

    function actionTone(action = '') {
        const value = action.toLowerCase();
        if (/creat|add|register/.test(value)) return 'tone-create';
        if (/delet|remov/.test(value)) return 'tone-delete';
        if (/transfer/.test(value)) return 'tone-transfer';
        if (/assign/.test(value)) return 'tone-assignment';
        if (/inspect|repair|service/.test(value)) return 'tone-inspection';
        return 'tone-default';
    }

    return (
        <>
            <PageHeader
                title="Activity Logs"
                description="A searchable history of changes made in the inventory workspace."
            />
            <div className="cards workflow-cards">
                <article><small>Total Events</small><strong>{logs.length}</strong></article>
                <article><small>Action Types</small><strong>{actions.length}</strong></article>
                <article><small>Today</small><strong>{todayCount}</strong></article>
            </div>
            <article className="panel">
                <div className="panel-head">
                    <div>
                        <h3>Activity History</h3>
                        <p className="result-count">Showing {filtered.length} of {logs.length} events</p>
                    </div>
                    <button
                        type="button"
                        className="secondary"
                        disabled={!filtered.length}
                        onClick={() => exportCSV(filtered, 'gso-activity-logs.csv')}
                    >
                        Export CSV
                    </button>
                </div>
                <div className="toolbar">
                    <input
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder="Search action, property, or details…"
                        aria-label="Search activity logs"
                    />
                    <label>
                        Action
                        <select value={actionFilter} onChange={event => setActionFilter(event.target.value)}>
                            <option>All actions</option>
                            {actions.map(action => <option key={action}>{action}</option>)}
                        </select>
                    </label>
                </div>
                <div className="table-scroll">
                    <table className="activity-table">
                        <thead>
                            <tr><th>Date &amp; Time</th><th>Action</th><th>Details</th></tr>
                        </thead>
                        <tbody>
                            {filtered.map((item, index) => {
                                const stamp = formatDate(item.date);
                                return (
                                    <tr key={item.id ?? `${item.date}-${index}`}>
                                        <td className="activity-date">
                                            {stamp.date}
                                            {stamp.time && <small>{stamp.time}</small>}
                                        </td>
                                        <td>
                                            <span className={`activity-tag ${actionTone(item.action)}`}>
                                                {item.action || 'Other'}
                                            </span>
                                        </td>
                                        <td className="activity-detail">{item.detail || '—'}</td>
                                    </tr>
                                );
                            })}
                            {!filtered.length && (
                                <tr>
                                    <td className="activity-empty" colSpan="3">
                                        {logs.length ? 'No events match these filters.' : 'No activity has been recorded yet.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </article>
        </>
    );
}

export default function Generic({ page }) {
    const { assets, warehouseAssets, logs, updateAsset } = useInventory();
    const { user } = useAuth();
    const title = titles[page] || 'Inventory Records';

    // Warehouse staff work entirely within the warehouse register; every
    // other role works with the inventory property register. Transactional
    // warehouse forms are excluded because they are not property records.
    const pool = useMemo(
        () => (user?.role === 'warehouse'
            ? warehouseAssets.filter(asset => !isWarehouseTransaction(asset.formType))
            : assets),
        [user?.role, assets, warehouseAssets]
    );

    if (page === 'assignments') {
        return <AssignmentsPage assets={pool} updateAsset={updateAsset} />;
    }
    if (page === 'transfers') {
        return <TransfersPage assets={pool} logs={logs} updateAsset={updateAsset} />;
    }
    if (page === 'inspection') {
        return <InspectionPage assets={pool} updateAsset={updateAsset} />;
    }
    if (page === 'activity-logs') {
        return <ActivityLogsPage logs={logs} />;
    }

    return (
        <>
            <PageHeader title={title} description={`Manage ${title.toLowerCase()} records for the GSO.`} />
            <article className="panel">
                {page === 'reports' ? (
                    <>
                        <h3>Inventory Data Exports</h3>
                        <p>Download working data extracts for review.</p>
                        <button onClick={() => exportCSV(pool, 'gso-asset-register.csv')}>Export Asset Register CSV</button>
                    </>
                ) : page === 'physical-inventory' ? (
                    <>
                        <h3>Physical Count Worksheet</h3>
                        <p>Enter actual quantities and observed condition. Save updates to each property record.</p>
                        <div className="table-scroll">
                            <table>
                                <thead>
                                    <tr><th>Property</th><th>Description</th><th>Book Qty</th><th>Actual Qty</th><th>Condition</th></tr>
                                </thead>
                                <tbody>
                                    {pool.map(asset => (
                                        <tr key={asset.id}>
                                            <td>{asset.propertyNo}</td>
                                            <td>{asset.description}</td>
                                            <td>{asset.quantity}</td>
                                            <td>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    defaultValue={asset.quantity}
                                                    onBlur={event => updateAsset(asset.id, { countedQuantity: Number(event.target.value) })}
                                                />
                                            </td>
                                            <td>
                                                <select
                                                    defaultValue={asset.condition}
                                                    onChange={event => updateAsset(asset.id, { condition: event.target.value })}
                                                >
                                                    <option>Serviceable</option>
                                                    <option>For Inspection</option>
                                                    <option>Unserviceable</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                    {!pool.length && <tr><td colSpan="5">No properties registered.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <>
                        <h3>{title} Records</h3>
                        <div className="table-scroll">
                            <table>
                                <thead>
                                    <tr><th>Property No.</th><th>Description</th><th>Department</th><th>Accountable Person</th><th>Condition</th></tr>
                                </thead>
                                <tbody>
                                    {pool.map(asset => (
                                        <tr key={asset.id}>
                                            <td>{asset.propertyNo}</td>
                                            <td>{asset.description}</td>
                                            <td>{asset.department}</td>
                                            <td>{asset.accountable}</td>
                                            <td>{asset.condition}</td>
                                        </tr>
                                    ))}
                                    {!pool.length && <tr><td colSpan="5">No properties registered.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </article>
        </>
    );
}
