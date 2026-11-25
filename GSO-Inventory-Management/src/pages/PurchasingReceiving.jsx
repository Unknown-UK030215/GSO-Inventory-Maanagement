import { useState } from 'react';

import PageHeader from '../components/common/PageHeader';
import { useSupply } from '../context/SupplyContext';
import { peso } from '../services/formatService';

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY = {
    date: today(),
    poNo: '',
    poAmount: '',
    supplier: '',
    stockNo: '',
    description: '',
    unit: '',
    unitCost: '',
    orderedQty: '',
    deliveredQty: '',
    forStock: true
};

export default function PurchasingReceiving() {
    const { purchases, receivePurchase } = useSupply();
    const [form, setForm] = useState(EMPTY);
    const [status, setStatus] = useState({ type: '', message: '' });

    function updateField(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    function submit(event) {
        event.preventDefault();
        try {
            const record = receivePurchase(form);
            setForm({ ...EMPTY, date: form.date });
            setStatus({
                type: 'success',
                message: record.lacking > 0
                    ? `Delivery recorded and flagged Lacking by ${record.lacking} ${record.unit || 'unit(s)'}.`
                    : 'Delivery recorded — complete.'
            });
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        }
    }

    const lacking = purchases.filter(item => item.status === 'Lacking');
    const totalValue = purchases.reduce((sum, item) => sum + item.poAmount, 0);

    return (
        <>
            <PageHeader
                title="Purchasing & Receiving"
                description="Record deliveries against a purchase order, note the supplier and P.O. amount, and flag short deliveries."
            />

            <div className="cards">
                <article><small>Purchase Orders</small><strong>{purchases.length}</strong></article>
                <article><small>Total P.O. Amount</small><strong>{peso(totalValue)}</strong></article>
                <article><small>Lacking Deliveries</small><strong>{lacking.length}</strong></article>
            </div>

            <article className="panel">
                <h3>Record an Incoming Supply</h3>
                <form onSubmit={submit}>
                    <div className="form-grid">
                        <label>
                            Date Received
                            <input
                                type="date"
                                value={form.date}
                                onChange={event => updateField('date', event.target.value)}
                                required
                            />
                        </label>
                        <label>
                            P.O. Number
                            <input
                                value={form.poNo}
                                onChange={event => updateField('poNo', event.target.value)}
                                placeholder="e.g. 2026-01-1234"
                            />
                        </label>
                        <label>
                            P.O. Amount
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.poAmount}
                                onChange={event => updateField('poAmount', event.target.value)}
                                placeholder="0.00"
                            />
                        </label>
                        <label>
                            Supplier
                            <input
                                value={form.supplier}
                                onChange={event => updateField('supplier', event.target.value)}
                                placeholder="Supplier / dealer name"
                                required
                            />
                        </label>
                        <label>
                            Stock No.
                            <input
                                value={form.stockNo}
                                onChange={event => updateField('stockNo', event.target.value)}
                                placeholder="e.g. 101"
                            />
                        </label>
                        <label>
                            Description
                            <input
                                value={form.description}
                                onChange={event => updateField('description', event.target.value)}
                                placeholder="Item delivered"
                                required
                            />
                        </label>
                        <label>
                            Unit
                            <input
                                value={form.unit}
                                onChange={event => updateField('unit', event.target.value)}
                                placeholder="pc, box, ream"
                            />
                        </label>
                        <label>
                            Unit Cost
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.unitCost}
                                onChange={event => updateField('unitCost', event.target.value)}
                                placeholder="0.00"
                            />
                        </label>
                        <label>
                            Ordered Quantity
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={form.orderedQty}
                                onChange={event => updateField('orderedQty', event.target.value)}
                                placeholder="0"
                                required
                            />
                        </label>
                        <label>
                            Delivered Quantity
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={form.deliveredQty}
                                onChange={event => updateField('deliveredQty', event.target.value)}
                                placeholder="0"
                                required
                            />
                        </label>
                        <label className="span-2 checkbox-field">
                            <input
                                type="checkbox"
                                checked={form.forStock}
                                onChange={event => updateField('forStock', event.target.checked)}
                            />
                            Add the delivered quantity to stock (RPCI)
                        </label>
                    </div>
                    <div className="actions">
                        <button type="submit">Record Delivery</button>
                    </div>
                    {status.message && (
                        <p className={`form-status ${status.type}`} role="status">{status.message}</p>
                    )}
                </form>
            </article>

            <article className="panel">
                <h3>Deliveries Received</h3>
                <p className="result-count">
                    {purchases.length} purchase order{purchases.length === 1 ? '' : 's'} received
                    {lacking.length ? ` · ${lacking.length} lacking` : ''}.
                </p>
                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>P.O. No.</th>
                                <th>Supplier</th>
                                <th>P.O. Amount</th>
                                <th>Item</th>
                                <th>Ordered</th>
                                <th>Delivered</th>
                                <th>Lacking</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchases.map(item => (
                                <tr key={item.id}>
                                    <td>{item.date}</td>
                                    <td>{item.poNo || '—'}</td>
                                    <td>{item.supplier}</td>
                                    <td>{peso(item.poAmount)}</td>
                                    <td className="activity-detail">
                                        {item.description}
                                        <small>
                                            {item.stockNo ? `Stock No. ${item.stockNo}` : 'No stock no.'}
                                            {item.forStock ? ' · added to RPCI' : ' · not for stock'}
                                        </small>
                                    </td>
                                    <td>{item.orderedQty} {item.unit}</td>
                                    <td>{item.deliveredQty} {item.unit}</td>
                                    <td>{item.lacking}</td>
                                    <td>
                                        <span className={`activity-tag ${item.status === 'Lacking' ? 'tone-delete' : 'tone-assignment'}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {!purchases.length && (
                                <tr><td colSpan="9">No deliveries recorded yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </article>
        </>
    );
}
