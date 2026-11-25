import { useMemo, useState } from 'react';

import PageHeader from '../components/common/PageHeader';
import { useAuth } from '../context/useAuth';
import { useInventory } from '../context/InventoryContext';
import { useMaintenance } from '../context/MaintenanceContext';
import { isWarehouseTransaction } from '../data/assetForms';
import { departments as defaultDepartments } from '../data/sampleAssets';
import { peso } from '../services/formatService';

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY = {
    assetId: '',
    propertyNo: '',
    description: '',
    office: '',
    reportedBy: '',
    dateReported: today(),
    fault: '',
    notes: ''
};

const statusTone = status => {
    if (status === 'Completed') return 'tone-create';
    if (status === 'In Repair') return 'tone-inspection';
    if (status === 'Cancelled') return 'tone-delete';
    return 'tone-assignment';
};

export default function Maintenance() {
    const { user } = useAuth();
    const { assets, warehouseAssets } = useInventory();
    const { workOrders, createWorkOrder, updateWorkOrder, deleteWorkOrder } = useMaintenance();
    const [form, setForm] = useState(EMPTY);
    const [status, setStatus] = useState({ type: '', message: '' });
    const [costs, setCosts] = useState({});
    const [filter, setFilter] = useState('Open');

    // Match the register the signed-in role works in (inventory vs warehouse).
    const pool = useMemo(
        () => (user?.role === 'warehouse'
            ? warehouseAssets.filter(asset => !isWarehouseTransaction(asset.formType))
            : assets),
        [user?.role, assets, warehouseAssets]
    );

    const offices = useMemo(() => [...new Set([
        ...defaultDepartments,
        ...pool.map(asset => asset.department).filter(Boolean)
    ])].sort((a, b) => a.localeCompare(b)), [pool]);

    const open = workOrders.filter(item => item.status === 'Pending' || item.status === 'In Repair');
    const inRepair = workOrders.filter(item => item.status === 'In Repair');
    const completed = workOrders.filter(item => item.status === 'Completed');
    const totalCost = workOrders.reduce((sum, item) => sum + Number(item.repairCost || 0), 0);

    const visible = filter === 'Open'
        ? open
        : filter === 'All'
            ? workOrders
            : workOrders.filter(item => item.status === filter);

    function updateField(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    function chooseAsset(id) {
        const asset = pool.find(item => String(item.id) === id);
        setForm(prev => ({
            ...prev,
            assetId: id,
            propertyNo: asset?.propertyNo || '',
            description: asset?.description || '',
            office: prev.office || asset?.department || ''
        }));
    }

    function submit(event) {
        event.preventDefault();
        setStatus({ type: '', message: '' });
        try {
            createWorkOrder(form);
            setForm({ ...EMPTY, dateReported: form.dateReported });
            setStatus({ type: 'success', message: 'Repair request logged.' });
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        }
    }

    function startRepair(order) {
        updateWorkOrder(order.id, { status: 'In Repair' });
    }

    function complete(order) {
        updateWorkOrder(order.id, {
            status: 'Completed',
            repairCost: Number(costs[order.id] ?? order.repairCost ?? 0),
            completedDate: today()
        });
    }

    function remove(order) {
        if (!window.confirm(`Delete the work order for ${order.description}?`)) return;
        deleteWorkOrder(order.id);
    }

    return (
        <>
            <PageHeader
                title="Maintenance & Repair"
                description="Log repair requests for equipment and items, track their status, and record repair costs."
            />

            <div className="cards">
                <article><small>Open Work Orders</small><strong>{open.length}</strong></article>
                <article><small>In Repair</small><strong>{inRepair.length}</strong></article>
                <article><small>Completed</small><strong>{completed.length}</strong></article>
                <article><small>Total Repair Cost</small><strong>{peso(totalCost)}</strong></article>
            </div>

            <article className="panel">
                <h3>Log a Repair Request</h3>
                <p className="result-count">Pick a registered property or type the item, then describe the fault.</p>
                <form onSubmit={submit}>
                    <div className="form-grid">
                        <label className="span-2">
                            Registered Property (optional)
                            <select value={form.assetId} onChange={event => chooseAsset(event.target.value)}>
                                <option value="">Not listed / type manually below</option>
                                {pool.map(asset => (
                                    <option key={asset.id} value={asset.id}>
                                        {asset.propertyNo || 'No property no.'} — {asset.description}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Property No.
                            <input
                                value={form.propertyNo}
                                onChange={event => updateField('propertyNo', event.target.value)}
                                placeholder="e.g. 2026-01-0001"
                            />
                        </label>
                        <label>
                            Equipment / Item
                            <input
                                value={form.description}
                                onChange={event => updateField('description', event.target.value)}
                                placeholder="Item to repair"
                                required
                            />
                        </label>
                        <label>
                            Office / Department
                            <select value={form.office} onChange={event => updateField('office', event.target.value)}>
                                <option value="">Select an office…</option>
                                {offices.map(office => <option key={office}>{office}</option>)}
                            </select>
                        </label>
                        <label>
                            Reported By
                            <input
                                value={form.reportedBy}
                                onChange={event => updateField('reportedBy', event.target.value)}
                                placeholder="Person requesting the repair"
                            />
                        </label>
                        <label>
                            Date Reported
                            <input
                                type="date"
                                value={form.dateReported}
                                onChange={event => updateField('dateReported', event.target.value)}
                                required
                            />
                        </label>
                        <label className="span-2">
                            Fault / Repair Needed
                            <textarea
                                value={form.fault}
                                onChange={event => updateField('fault', event.target.value)}
                                placeholder="Describe the defect or work required"
                                required
                            />
                        </label>
                    </div>
                    <div className="actions">
                        <button type="submit">Log Work Order</button>
                    </div>
                    {status.message && (
                        <p className={`form-status ${status.type}`} role="status">{status.message}</p>
                    )}
                </form>
            </article>

            <article className="panel">
                <div className="panel-head">
                    <div>
                        <h3>Work Orders</h3>
                        <p className="result-count">{visible.length} of {workOrders.length} work orders</p>
                    </div>
                    <label>
                        Show
                        <select value={filter} onChange={event => setFilter(event.target.value)}>
                            <option>Open</option>
                            <option>Pending</option>
                            <option>In Repair</option>
                            <option>Completed</option>
                            <option>Cancelled</option>
                            <option value="All">All</option>
                        </select>
                    </label>
                </div>
                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Reported</th>
                                <th>Property</th>
                                <th>Fault</th>
                                <th>Reported By</th>
                                <th>Status</th>
                                <th>Repair Cost</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map(order => (
                                <tr key={order.id}>
                                    <td className="activity-date">{order.dateReported}</td>
                                    <td className="activity-detail">
                                        {order.description}
                                        <small>{order.propertyNo || 'No property no.'}{order.office ? ` · ${order.office}` : ''}</small>
                                    </td>
                                    <td className="activity-detail">
                                        {order.fault}
                                        {order.notes && <small>{order.notes}</small>}
                                    </td>
                                    <td>{order.reportedBy || '—'}</td>
                                    <td>
                                        <span className={`activity-tag ${statusTone(order.status)}`}>{order.status}</span>
                                    </td>
                                    <td>
                                        {order.status === 'In Repair' ? (
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={costs[order.id] ?? order.repairCost ?? ''}
                                                onChange={event => setCosts(prev => ({ ...prev, [order.id]: event.target.value }))}
                                                placeholder="0.00"
                                                aria-label={`Repair cost for ${order.description}`}
                                            />
                                        ) : order.repairCost > 0 ? peso(order.repairCost) : '—'}
                                    </td>
                                    <td className="row-actions">
                                        {order.status === 'Pending' && (
                                            <button type="button" onClick={() => startRepair(order)}>Start Repair</button>
                                        )}
                                        {order.status === 'In Repair' && (
                                            <button type="button" onClick={() => complete(order)}>Mark Completed</button>
                                        )}
                                        {(order.status === 'Completed' || order.status === 'Cancelled') && (
                                            <button type="button" className="secondary" onClick={() => remove(order)}>Delete</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {!visible.length && (
                                <tr><td colSpan="7">No work orders to show.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </article>
        </>
    );
}
