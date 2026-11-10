import { Link } from 'react-router-dom';

import PageHeader from '../components/common/PageHeader';
import { useAuth } from '../context/useAuth';
import { useInventory } from '../context/InventoryContext';
import { getRole } from '../data/userRoles';

import { missingList, unserviceableList } from '../services/formService';

// Full peso amount for the welcome line.
const peso = n =>
    '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Compact peso for the KPI cards.
function pesoShort(n) {
    const v = Number(n || 0);
    if (v >= 1e9) return '₱' + (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '₱' + (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return '₱' + (v / 1e3).toFixed(1) + 'K';
    return '₱' + v.toFixed(2);
}

// Horizontal bar breakdown used by the dashboard panels.
function Breakdown({ title, rows, total, tone }) {
    return (
        <article className="panel">

            <h3>{title}</h3>

            {!rows.length && <p>No records yet.</p>}

            {rows.map(([label, value]) => (
                <div className="bar-row" key={label}>

                    <span className="bar-label" title={label}>{label}</span>

                    <div className="bar-track">
                        <div
                            className="bar-fill"
                            style={{
                                width: total ? `${(value / total) * 100}%` : 0,
                                background: tone
                            }}
                        />
                    </div>

                    <b className="bar-value">{value}</b>

                </div>
            ))}

        </article>
    );
}

function RoleDashboard({ roleId, assets, logs }) {
    const role = getRole(roleId);

    if (role.id === 'fuel-vehicle') {
        const vehiclePattern = /vehicle|fleet|fuel|diesel|gasoline|petrol|motorcycle|motor|truck|car|van|bus|pickup|plate|engine|lubricant/i;
        const fleetAssets = assets.filter(asset =>
            vehiclePattern.test([
                asset.description,
                asset.category,
                asset.propertyNo,
                asset.location
            ].join(' '))
        );
        const fuelAssets = fleetAssets.filter(asset =>
            /fuel|diesel|gasoline|petrol|lubricant/i.test([
                asset.description,
                asset.category
            ].join(' '))
        );
        const awaiting = fleetAssets.filter(asset => asset.condition === 'For Inspection').length;
        const assigned = fleetAssets.filter(asset => asset.status === 'Assigned').length;
        const value = fleetAssets.reduce(
            (sum, asset) => sum + Number(asset.cost || 0) * Number(asset.quantity || 1),
            0
        );
        const transfers = logs.filter(item => item.action === 'Transferred property').slice(0, 5);

        return (
            <>
                <PageHeader
                    title="Fuel/Vehicle Dashboard"
                    description="Fleet and fuel overview from the shared property register."
                />
                <div className="cards">
                    <article><small>Vehicle / Fuel Records</small><strong>{fleetAssets.length}</strong></article>
                    <article><small>Fuel-Tagged Items</small><strong>{fuelAssets.length}</strong></article>
                    <article><small>Assigned</small><strong>{assigned}</strong></article>
                    <article><small>Awaiting Inspection</small><strong>{awaiting}</strong></article>
                </div>
                <div className="split">
                    <article className="panel">
                        <h3>Fleet Register</h3>
                        <p className="result-count">Tracked property value: {peso(value)}</p>
                        <div className="table-scroll">
                            <table>
                                <thead>
                                    <tr><th>Property No.</th><th>Vehicle / Item</th><th>Office</th><th>Condition</th></tr>
                                </thead>
                                <tbody>
                                    {fleetAssets.map(asset => (
                                        <tr key={asset.id}>
                                            <td>{asset.propertyNo || '—'}</td>
                                            <td>{asset.description || '—'}</td>
                                            <td>{asset.department || '—'}</td>
                                            <td>{asset.condition || '—'}</td>
                                        </tr>
                                    ))}
                                    {!fleetAssets.length && (
                                        <tr>
                                            <td colSpan="4">No matching records. Add vehicle or fuel keywords to an asset description or category to include it here.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </article>
                    <article className="panel">
                        <h3>Recent Vehicle Transfers</h3>
                        {transfers.length ? transfers.map(item => (
                            <p className="log-line" key={item.id}>
                                {item.date} — <b>{item.action}</b>: {item.detail}
                            </p>
                        )) : <p>No vehicle transfers have been recorded yet.</p>}
                    </article>
                </div>
            </>
        );
    }

    const units = assets.reduce((sum, asset) => sum + Number(asset.quantity || 1), 0);
    const categories = [...new Set(assets.map(asset => asset.category || 'Uncategorized'))]
        .map(category => [
            category,
            assets.reduce((count, asset) =>
                count + ((asset.category || 'Uncategorized') === category ? Number(asset.quantity || 1) : 0), 0)
        ])
        .sort((a, b) => b[1] - a[1]);
    const unassigned = assets.filter(asset => asset.status === 'Unassigned').length;
    const awaiting = assets.filter(asset =>
        asset.condition === 'For Inspection' || asset.condition === 'Unserviceable'
    ).length;

    return (
        <>
            <PageHeader
                title="Warehouse Staff Dashboard"
                description="Stock quantities, item categories, and inventory follow-up from the shared register."
            />
            <div className="cards">
                <article><small>Registered Items</small><strong>{assets.length}</strong></article>
                <article><small>Total Units</small><strong>{units}</strong></article>
                <article><small>Unassigned Items</small><strong>{unassigned}</strong></article>
                <article><small>Needs Follow-up</small><strong>{awaiting}</strong></article>
            </div>
            <div className="split">
                <Breakdown title="Units by Category" rows={categories} total={units} />
                <article className="panel">
                    <h3>Warehouse Inventory</h3>
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr><th>Property No.</th><th>Item</th><th>Category</th><th>Qty</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                {assets.slice(0, 10).map(asset => (
                                    <tr key={asset.id}>
                                        <td>{asset.propertyNo || '—'}</td>
                                        <td>{asset.description || '—'}</td>
                                        <td>{asset.category || 'Uncategorized'}</td>
                                        <td>{asset.quantity ?? 0}</td>
                                        <td>{asset.status || 'Unassigned'}</td>
                                    </tr>
                                ))}
                                {!assets.length && <tr><td colSpan="5">No inventory records yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </article>
            </div>
        </>
    );
}

export default function Dashboard() {

    const { assets, logs } = useInventory();
    const { user } = useAuth();

    if (user?.role && user.role !== 'staff') {
        return <RoleDashboard roleId={user.role} assets={assets} logs={logs} />;
    }

    const unserviceable = unserviceableList(assets);
    const missing = missingList(assets);
    const inspection = assets.filter(a => a.condition === 'For Inspection');
    const unassigned = assets.filter(a => a.status === 'Unassigned');

    const totalValue = assets.reduce(
        (sum, a) => sum + Number(a.cost || 0) * Number(a.quantity || 1),
        0
    );

    const attention = unserviceable.length + missing.length + inspection.length;

    const departmentsCovered = new Set(
        assets.map(a => a.department).filter(Boolean)
    ).size;

    const cards = [
        ['Total Assets', assets.length],
        ['Total Property Value', pesoShort(totalValue)],
        ['Assigned', assets.filter(a => a.status === 'Assigned').length],
        ['Unassigned', unassigned.length],
        ['For Inspection', inspection.length],
        ['Unserviceable', unserviceable.length],
        ['Missing', missing.length],
        ['Departments Covered', departmentsCovered]
    ];

    const byClassification = ['PPE', 'Semi-Expendable', 'Expendable', 'Land', 'Land Improvement']
        .map(c => [c, assets.filter(a => a.classification === c).length])
        .filter(([, v]) => v > 0);

    const byCondition = ['Serviceable', 'For Inspection', 'Unserviceable']
        .map(c => [c, assets.filter(a => a.condition === c).length])
        .filter(([, v]) => v > 0);

    const byDepartment = [...new Set(assets.map(a => a.department).filter(Boolean))]
        .map(d => [d, assets.filter(a => a.department === d).length])
        .sort((a, b) => b[1] - a[1]);

    return (
        <>
            <PageHeader
                title="Inventory Dashboard"
                description="Monitor and manage municipal property records."
            />

            <div className="welcome">
                <h2>Good day, Inventory Staff!</h2>
                <p>
                    {assets.length} propert{assets.length === 1 ? 'y' : 'ies'} on record worth{' '}
                    {peso(totalValue)}
                    {attention > 0
                        ? ` · ${attention} item${attention === 1 ? '' : 's'} need attention`
                        : ' · nothing needs attention'}
                    .
                </p>
            </div>

            <div className="cards">
                {cards.map(([label, value]) => (
                    <article key={label}>
                        <small>{label}</small>
                        <strong>{value}</strong>
                    </article>
                ))}
            </div>

            <div className="split">
                <Breakdown title="By Classification" rows={byClassification} total={assets.length} />
                <Breakdown title="By Condition" rows={byCondition} total={assets.length} tone="#c2762e" />
            </div>

            <div className="split">
                <Breakdown title="By Department" rows={byDepartment} total={assets.length} />

                <article className="panel">

                    <h3>Needs Attention</h3>

                    <div className="alert-row">
                        <span>Unserviceable equipment</span>
                        <b>{unserviceable.length}</b>
                    </div>

                    <div className="alert-row">
                        <span>Missing / non-existing PPE</span>
                        <b>{missing.length}</b>
                    </div>

                    <div className="alert-row">
                        <span>Awaiting inspection</span>
                        <b>{inspection.length}</b>
                    </div>

                    <div className="alert-row">
                        <span>Unassigned property</span>
                        <b>{unassigned.length}</b>
                    </div>

                    <p className="alert-note">
                        Flag or resolve these on the{' '}
                        <Link to="/disposal">Disposal &amp; Missing</Link> page.
                    </p>

                </article>
            </div>

            <div className="split">

                <article className="panel">

                    <h3>Recent Activity</h3>

                    {logs.slice(0, 6).map(l => (
                        <p className="log-line" key={l.id}>
                            {l.date} — <b>{l.action}</b>: {l.detail}
                        </p>
                    ))}

                    {!logs.length && <p>No recent activity recorded.</p>}

                </article>

                <article className="panel">

                    <h3>Recently Registered</h3>

                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Property No.</th>
                                    <th>Description</th>
                                    <th>Department</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assets.slice(0, 5).map(a => (
                                    <tr key={a.id}>
                                        <td>{a.propertyNo}</td>
                                        <td>{a.description}</td>
                                        <td>{a.department}</td>
                                    </tr>
                                ))}
                                {!assets.length && (
                                    <tr>
                                        <td colSpan="3">No property registered yet.</td>
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
