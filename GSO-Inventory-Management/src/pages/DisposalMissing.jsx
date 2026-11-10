import { useState } from 'react';

import PageHeader from '../components/common/PageHeader';
import { useInventory } from '../context/InventoryContext';

import { exportForm, missingList, unserviceableList } from '../services/formService';

// ========================================
// DISPOSAL & MISSING
// Both lists fill themselves from the register, so nothing is
// re-typed: set a record's Condition or Status and it lands here.
// ========================================
export default function DisposalMissing() {

    const { assets, updateAsset } = useInventory();
    const [busy, setBusy] = useState('');

    const unserviceable = unserviceableList(assets);
    const missing = missingList(assets);

    // Properties not yet on a list, offered by the quick "flag" pickers.
    const flaggableUnserviceable = assets.filter(a => a.condition !== 'Unserviceable');
    const flaggableMissing = assets.filter(a => a.status !== 'Missing');

    async function download(id) {
        try {
            setBusy(id);
            await exportForm(id, assets);
        } catch (err) {
            alert(err.message);
        } finally {
            setBusy('');
        }
    }

    return (
        <>
            <PageHeader
                title="Disposal & Missing"
                description="Lists generated from the asset register — no separate filing needed."
            />

            <div className="stack">

                <article className="panel">

                    <div className="panel-head">

                        <div>
                            <h3>List of Unserviceable / Disposed Equipment</h3>
                            <p className="result-count">
                                {unserviceable.length} record
                                {unserviceable.length === 1 ? '' : 's'} · sourced from
                                Condition = Unserviceable
                            </p>
                        </div>

                        <button
                            onClick={() => download('unserviceable')}
                            disabled={busy !== '' || unserviceable.length === 0}
                        >
                            {busy === 'unserviceable' ? 'Generating…' : 'Download .xlsx'}
                        </button>

                    </div>

                    <div className="toolbar">
                        <label>
                            Flag a property as unserviceable
                            <select
                                value=""
                                onChange={e => e.target.value && updateAsset(Number(e.target.value), { condition: 'Unserviceable' })}
                            >
                                <option value="">Select a property…</option>
                                {flaggableUnserviceable.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.propertyNo} — {a.description}
                                    </option>
                                ))}
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
                                    <th>Unit Cost</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {unserviceable.map(a => (
                                    <tr key={a.id}>
                                        <td>{a.propertyNo}</td>
                                        <td>{a.description}</td>
                                        <td>{a.department}</td>
                                        <td>{a.accountable}</td>
                                        <td>{a.cost}</td>
                                        <td>
                                            <button
                                                className="secondary"
                                                onClick={() => updateAsset(a.id, { condition: 'Serviceable' })}
                                            >
                                                Restore
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {unserviceable.length === 0 && (
                                    <tr>
                                        <td colSpan="6">No unserviceable records yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                </article>

                <article className="panel">

                    <div className="panel-head">

                        <div>
                            <h3>List of Non-Existing / Missing PPEs</h3>
                            <p className="result-count">
                                {missing.length} record
                                {missing.length === 1 ? '' : 's'} · sourced from
                                Status = Missing
                            </p>
                        </div>

                        <button
                            onClick={() => download('missing')}
                            disabled={busy !== '' || missing.length === 0}
                        >
                            {busy === 'missing' ? 'Generating…' : 'Download .xlsx'}
                        </button>

                    </div>

                    <div className="toolbar">
                        <label>
                            Flag a property as missing
                            <select
                                value=""
                                onChange={e => e.target.value && updateAsset(Number(e.target.value), { status: 'Missing' })}
                            >
                                <option value="">Select a property…</option>
                                {flaggableMissing.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.propertyNo} — {a.description}
                                    </option>
                                ))}
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
                                    <th>Unit Cost</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {missing.map(a => (
                                    <tr key={a.id}>
                                        <td>{a.propertyNo}</td>
                                        <td>{a.description}</td>
                                        <td>{a.department}</td>
                                        <td>{a.accountable}</td>
                                        <td>{a.cost}</td>
                                        <td>
                                            <button
                                                className="secondary"
                                                onClick={() => updateAsset(a.id, { status: 'Recorded' })}
                                            >
                                                Found
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {missing.length === 0 && (
                                    <tr>
                                        <td colSpan="6">No missing records yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                </article>

            </div>
        </>
    );
}
