import { useState } from 'react';

import PageHeader from '../components/common/PageHeader';
import { useInventory } from '../context/InventoryContext';
import { useSupply } from '../context/SupplyContext';
import { peso } from '../services/formatService';

export default function Rpci() {
    const { warehouseAssets } = useInventory();
    const { rpci, lowStock, releaseRis, setReorderLevel, isReleased, releaseInfo } = useSupply();
    const [status, setStatus] = useState({ type: '', message: '' });

    // RIS records filed by the warehouse/supply staff that still need releasing.
    const risRecords = warehouseAssets.filter(item => item.formType === 'ris');
    const pendingRis = risRecords.filter(item => !isReleased(item.id));
    const releasedRis = risRecords.filter(item => isReleased(item.id));

    const totalUnits = rpci.reduce((sum, item) => sum + Number(item.onHand || 0), 0);
    const totalValue = rpci.reduce(
        (sum, item) => sum + Number(item.onHand || 0) * Number(item.unitCost || 0),
        0
    );

    const isLow = item =>
        Number(item.minLevel || 0) > 0 && Number(item.onHand || 0) <= Number(item.minLevel || 0);

    function handleRelease(ris) {
        setStatus({ type: '', message: '' });
        try {
            const result = releaseRis(ris);
            setStatus({
                type: 'success',
                message: result.deducted
                    ? `RIS ${ris.risNo || ris.id} released — stock reduced by ${ris.quantity} ${ris.unit || 'unit(s)'}.`
                    : `RIS ${ris.risNo || ris.id} released. No matching stock item was found to deduct.`
            });
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        }
    }

    return (
        <>
            <PageHeader
                title="Stock on Hand (RPCI)"
                description="Live quantity of supplies in the stockroom. Receiving raises the RPCI; releasing a RIS lowers it."
            />

            <div className="cards">
                <article><small>Stock Items</small><strong>{rpci.length}</strong></article>
                <article><small>Total Units on Hand</small><strong>{totalUnits}</strong></article>
                <article><small>Stock Value</small><strong>{peso(totalValue)}</strong></article>
                <article className={lowStock.length ? 'card-alert' : ''}>
                    <small>Low Stock Alerts</small><strong>{lowStock.length}</strong>
                </article>
            </div>

            {lowStock.length > 0 && (
                <article className="panel panel-warning">
                    <h3>Reorder Soon</h3>
                    <p className="result-count">
                        These supplies have reached their minimum level. Prepare a purchase request
                        before stock runs out.
                    </p>
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr><th>Stock No.</th><th>Description</th><th>On Hand</th><th>Min Level</th><th>Suggested Reorder</th></tr>
                            </thead>
                            <tbody>
                                {lowStock.map(item => (
                                    <tr key={item.id}>
                                        <td>{item.stockNo || '—'}</td>
                                        <td>{item.description}</td>
                                        <td><b>{item.onHand}</b> {item.unit || ''}</td>
                                        <td>{item.minLevel}</td>
                                        <td>
                                            <span className="activity-tag tone-delete">
                                                {Math.max(1, Number(item.minLevel || 0) - Number(item.onHand || 0))} {item.unit || 'unit(s)'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}

            <article className="panel">
                <div className="panel-head">
                    <div>
                        <h3>Stock on Hand</h3>
                        <p className="result-count">
                            Set a <b>Min Level</b> per item to get a reorder alert. Quantities rise when a
                            delivery is added to stock and fall when a RIS is released.
                        </p>
                    </div>
                </div>
                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Stock No.</th>
                                <th>Description</th>
                                <th>Unit</th>
                                <th>On Hand</th>
                                <th>Min Level</th>
                                <th>Unit Cost</th>
                                <th>Value</th>
                                <th>Last Updated</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rpci.map(item => (
                                <tr key={item.id} className={isLow(item) ? 'row-low-stock' : ''}>
                                    <td>{item.stockNo || '—'}</td>
                                    <td>
                                        {item.description}
                                        {isLow(item) && <span className="activity-tag tone-delete low-tag">Low</span>}
                                    </td>
                                    <td>{item.unit || '—'}</td>
                                    <td><b>{item.onHand}</b></td>
                                    <td>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            defaultValue={item.minLevel ?? 0}
                                            onBlur={event => setReorderLevel(item.id, event.target.value)}
                                            aria-label={`Minimum level for ${item.description}`}
                                        />
                                    </td>
                                    <td>{peso(item.unitCost)}</td>
                                    <td>{peso(Number(item.onHand || 0) * Number(item.unitCost || 0))}</td>
                                    <td>{item.updatedAt}</td>
                                </tr>
                            ))}
                            {!rpci.length && (
                                <tr><td colSpan="8">No stock on hand yet. Record a delivery marked for stock.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </article>

            <article className="panel">
                <h3>RIS Pending Release</h3>
                <p className="result-count">
                    {pendingRis.length} RIS waiting · releasing a RIS automatically deducts the issued
                    quantity from the RPCI.
                </p>
                {status.message && (
                    <p className={`form-status ${status.type}`} role="status">{status.message}</p>
                )}
                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>RIS No.</th>
                                <th>Office / Dept.</th>
                                <th>Stock No.</th>
                                <th>Description</th>
                                <th>Qty</th>
                                <th>Status</th>
                                <th /></tr>
                        </thead>
                        <tbody>
                            {pendingRis.map(ris => (
                                <tr key={ris.id}>
                                    <td>{ris.risNo || '—'}</td>
                                    <td>{ris.officeDept || '—'}</td>
                                    <td>{ris.propertyNo || '—'}</td>
                                    <td>{ris.description || '—'}</td>
                                    <td>{ris.quantity} {ris.unit || ''}</td>
                                    <td>
                                        <span className="activity-tag tone-inspection">Pending</span>
                                    </td>
                                    <td className="row-actions">
                                        <button type="button" onClick={() => handleRelease(ris)}>
                                            Release
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!pendingRis.length && (
                                <tr><td colSpan="7">No RIS waiting for release.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </article>

            {releasedRis.length > 0 && (
                <article className="panel">
                    <h3>Released RIS</h3>
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>RIS No.</th>
                                    <th>Description</th>
                                    <th>Qty</th>
                                    <th>Released</th>
                                    <th>Released By</th>
                                    <th>Stock Deducted</th>
                                </tr>
                            </thead>
                            <tbody>
                                {releasedRis.map(ris => {
                                    const info = releaseInfo(ris.id) || {};
                                    return (
                                        <tr key={ris.id}>
                                            <td>{ris.risNo || '—'}</td>
                                            <td>{ris.description || '—'}</td>
                                            <td>{ris.quantity} {ris.unit || ''}</td>
                                            <td>{info.releasedAt}</td>
                                            <td>{info.releasedBy}</td>
                                            <td>{info.deducted ? 'Yes' : 'No matching stock'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}
        </>
    );
}
