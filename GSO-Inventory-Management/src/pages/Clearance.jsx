import { useMemo, useState } from 'react';

import PageHeader from '../components/common/PageHeader';
import { useAuth } from '../context/useAuth';
import { useInventory } from '../context/InventoryContext';
import { isWarehouseTransaction } from '../data/assetForms';
import { exportCSV } from '../services/reportService';
import { peso } from '../services/formatService';

const normalize = value => String(value || '').trim().toLowerCase();

export default function Clearance() {
    const { user } = useAuth();
    const { assets, warehouseAssets } = useInventory();
    const [person, setPerson] = useState('');
    const [office, setOffice] = useState('');

    // Clearance applies to property records, matched to the role's register.
    const pool = useMemo(
        () => (user?.role === 'warehouse'
            ? warehouseAssets.filter(asset => !isWarehouseTransaction(asset.formType))
            : assets),
        [user?.role, assets, warehouseAssets]
    );

    // People who currently hold at least one accountable property.
    const people = useMemo(() => [...new Set(
        pool.map(asset => (asset.accountable || '').trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b)), [pool]);

    const selected = normalize(person);
    const held = selected
        ? pool.filter(asset =>
            normalize(asset.accountable) === selected &&
            (!office || asset.department === office)
        )
        : [];

    const totalValue = held.reduce(
        (sum, asset) => sum + Number(asset.cost || 0) * Number(asset.quantity || 1),
        0
    );
    const offices = [...new Set(held.map(asset => asset.department).filter(Boolean))];

    function print() {
        window.print();
    }

    function exportRows() {
        exportCSV(
            held.map(asset => ({
                PropertyNo: asset.propertyNo || '',
                Description: asset.description || '',
                Department: asset.department || '',
                Quantity: asset.quantity ?? 1,
                UnitCost: Number(asset.cost || 0),
                TotalValue: Number(asset.cost || 0) * Number(asset.quantity || 1),
                Condition: asset.condition || ''
            })),
            `gso-property-clearance-${(person || 'employee').replaceAll(/\s+/g, '-').toLowerCase()}.csv`
        );
    }

    return (
        <>
            <PageHeader
                title="Property Accountability Clearance"
                description="List every property held by an employee — for turnover, transfer, or retirement clearance."
            />

            <article className="panel no-print">
                <h3>Select an Accountable Person</h3>
                <div className="form-grid">
                    <label>
                        Accountable Person
                        <input
                            list="clearance-people"
                            value={person}
                            onChange={event => setPerson(event.target.value)}
                            placeholder="Type or choose a name"
                        />
                        <datalist id="clearance-people">
                            {people.map(name => <option key={name} value={name} />)}
                        </datalist>
                    </label>
                    <label>
                        Office / Department (optional)
                        <select value={office} onChange={event => setOffice(event.target.value)}>
                            <option value="">All offices</option>
                            {[...new Set(pool.map(asset => asset.department).filter(Boolean))]
                                .sort((a, b) => a.localeCompare(b))
                                .map(name => <option key={name}>{name}</option>)}
                        </select>
                    </label>
                </div>
                <div className="actions">
                    <button type="button" className="secondary" disabled={!held.length} onClick={exportRows}>
                        Export CSV
                    </button>
                    <button type="button" disabled={!held.length} onClick={print}>
                        Print Clearance
                    </button>
                </div>
            </article>

            {!selected && (
                <article className="panel no-print">
                    <p className="result-count">
                        Choose an accountable person above to generate their clearance list.
                        {people.length ? ` ${people.length} employees currently hold property.` : ' No assigned property yet.'}
                    </p>
                </article>
            )}

            {selected && (
                <article className="panel clearance-sheet">
                    <div className="clearance-head">
                        <div>
                            <small>REPUBLIC OF THE PHILIPPINES · MUNICIPALITY OF EL NIDO, PALAWAN</small>
                            <h2>Property Accountability Clearance</h2>
                            <p>General Services Office</p>
                        </div>
                        <div className="clearance-meta">
                            <div><span>Name</span><b>{person}</b></div>
                            <div><span>Office / Department</span><b>{offices.join(', ') || '—'}</b></div>
                            <div><span>Date Generated</span><b>{new Date().toLocaleDateString()}</b></div>
                        </div>
                    </div>

                    <div className="cards workflow-cards">
                        <article><small>Properties Held</small><strong>{held.length}</strong></article>
                        <article><small>Total Quantity</small><strong>{held.reduce((sum, asset) => sum + Number(asset.quantity || 1), 0)}</strong></article>
                        <article><small>Total Value</small><strong>{peso(totalValue)}</strong></article>
                    </div>

                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Property No.</th>
                                    <th>Description</th>
                                    <th>Department</th>
                                    <th>Qty</th>
                                    <th>Unit Cost</th>
                                    <th>Total Value</th>
                                    <th>Condition</th>
                                </tr>
                            </thead>
                            <tbody>
                                {held.map(asset => (
                                    <tr key={asset.id}>
                                        <td>{asset.propertyNo || '—'}</td>
                                        <td>{asset.description || '—'}</td>
                                        <td>{asset.department || '—'}</td>
                                        <td>{asset.quantity ?? 1}</td>
                                        <td>{peso(asset.cost)}</td>
                                        <td>{peso(Number(asset.cost || 0) * Number(asset.quantity || 1))}</td>
                                        <td>{asset.condition || '—'}</td>
                                    </tr>
                                ))}
                                {!held.length && (
                                    <tr><td colSpan="7">No property is currently assigned to this person.</td></tr>
                                )}
                            </tbody>
                            {held.length > 0 && (
                                <tfoot>
                                    <tr>
                                        <td colSpan="5" className="text-right"><b>Total Property Value</b></td>
                                        <td><b>{peso(totalValue)}</b></td>
                                        <td />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    <p className="clearance-note">
                        This certifies that the property listed above is hereby turned over and accounted
                        for by the undersigned accountable person, and that the General Services Office has
                        verified the items against its property records.
                    </p>

                    <div className="sign-block">
                        <div>
                            <span>Prepared by (GSO Staff)</span>
                            <b>{user?.displayName || ''}</b>
                        </div>
                        <div>
                            <span>Conforme (Accountable Person)</span>
                            <b>{person}</b>
                        </div>
                        <div>
                            <span>Noted by (GSO Officer)</span>
                            <b>&nbsp;</b>
                        </div>
                    </div>
                </article>
            )}
        </>
    );
}
