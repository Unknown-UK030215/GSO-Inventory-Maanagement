import { Link } from 'react-router-dom';

import PageHeader from '../components/common/PageHeader';
import { useAuth } from '../context/useAuth';
import { useInventory } from '../context/InventoryContext';
import { useSupply } from '../context/SupplyContext';
import { isWarehouseTransaction } from '../data/assetForms';
import { getRole, isAdminRole } from '../data/userRoles';
import AdminDashboard from './AdminDashboard';
import BarList from '../components/common/BarList';
import { peso, pesoShort } from '../services/formatService';
import { missingList, unserviceableList, exportForm } from '../services/formService';

function RoleDashboard({ roleId, assets, warehouseAssets, logs }) {
    const role = getRole(roleId);
    const { lowStock } = useSupply();

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

    // Warehouse item register — its own pool, separate from the inventory
    // property records. Transactional forms (AIR / RIS / SSMI) are handled
    // below and excluded from the item stats.
    const stockItems = warehouseAssets.filter(asset => !isWarehouseTransaction(asset.formType));

    const units = stockItems.reduce((sum, asset) => sum + Number(asset.quantity || 1), 0);
    const categories = [...new Set(stockItems.map(asset => asset.category || 'Uncategorized'))]
        .map(category => [
            category,
            stockItems.reduce((count, asset) =>
                count + ((asset.category || 'Uncategorized') === category ? Number(asset.quantity || 1) : 0), 0)
        ])
        .sort((a, b) => b[1] - a[1]);
    const unassigned = stockItems.filter(asset => asset.status === 'Unassigned').length;
    const awaiting = stockItems.filter(asset =>
        asset.condition === 'For Inspection' || asset.condition === 'Unserviceable'
    ).length;

    // Warehouse transaction records — AIR, RIS, and SSMI forms.
    // These live in a separate pool from inventory property records.
    const airRecords = warehouseAssets.filter(a => a.formType === 'air');
    const risRecords = warehouseAssets.filter(a => a.formType === 'ris');
    const ssmiRecords = warehouseAssets.filter(a => a.formType === 'ssmi');

    // Quick-export handlers for the warehouse operation cards.
    const quickExport = (formId) => exportForm(formId, [...assets, ...warehouseAssets]);

    const warehouseActions = [
        {
            id: 'air',
            label: 'Acceptance & Inspection Report',
            short: 'AIR',
            count: airRecords.length,
            description: 'Appendix 50 — record and inspect supplies from suppliers',
            tone: '#2e7d32'
        },
        {
            id: 'ris',
            label: 'Requisition & Issue Slip',
            short: 'RIS',
            count: risRecords.length,
            description: 'Appendix 59 — requisition and issue supplies to offices',
            tone: '#1565c0'
        },
        {
            id: 'ssmi',
            label: 'Summary of Supplies & Materials Issued',
            short: 'SSMI',
            count: ssmiRecords.length,
            description: 'Monthly summary of issued supplies with attached RIS',
            tone: '#ef6c00'
        }
    ];

    // Recent warehouse transactions (AIR + RIS + SSMI), newest first.
    const transactions = [...airRecords, ...risRecords, ...ssmiRecords]
        .sort((a, b) => (b.id || 0) - (a.id || 0))
        .slice(0, 8);

    const txnLabel = (formType) => {
        if (formType === 'air') return 'AIR';
        if (formType === 'ris') return 'RIS';
        if (formType === 'ssmi') return 'SSMI';
        return formType;
    };

    const txnRef = (a) =>
        a.airNo || a.risNo || a.ssmiMonth || a.propertyNo || '—';

    return (
        <>
            <PageHeader
                title="Warehouse Staff Dashboard"
                description="Stock quantities, item categories, warehouse transactions, and inventory follow-up from the warehouse register."
            />

            <div className="cards">
                <article><small>Registered Items</small><strong>{stockItems.length}</strong></article>
                <article><small>Total Units</small><strong>{units}</strong></article>
                <article><small>Unassigned Items</small><strong>{unassigned}</strong></article>
                <article><small>Needs Follow-up</small><strong>{awaiting}</strong></article>
            </div>

            {lowStock.length > 0 && (
                <article className="panel panel-warning">
                    <h3>Reorder Soon</h3>
                    <p className="result-count">
                        {lowStock.length} suppl{lowStock.length === 1 ? 'y has' : 'ies have'} reached the
                        minimum level. Manage reorder levels on the{' '}
                        <Link to="/rpci">Stock on Hand (RPCI)</Link> page.
                    </p>
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr><th>Stock No.</th><th>Description</th><th>On Hand</th><th>Min Level</th></tr>
                            </thead>
                            <tbody>
                                {lowStock.map(item => (
                                    <tr key={item.id}>
                                        <td>{item.stockNo || '—'}</td>
                                        <td>{item.description}</td>
                                        <td><b>{item.onHand}</b> {item.unit || ''}</td>
                                        <td>{item.minLevel}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}

            {/* =========================================
                WAREHOUSE OPERATIONS — QUICK ACTIONS
            ========================================= */}
            <div className="panel">
                <h3>Warehouse Operations</h3>
                <p className="result-count">
                    Generate the official GSO warehouse forms. Each card shows how many
                    records are on file for that form.
                </p>
                <div className="warehouse-actions">
                    {warehouseActions.map(action => (
                        <div className="warehouse-action-card" key={action.id}>
                            <div className="wa-header">
                                <span className="wa-badge" style={{ background: action.tone }}>
                                    {action.short}
                                </span>
                                <strong>{action.count}</strong>
                                <small>record{action.count === 1 ? '' : 's'}</small>
                            </div>
                            <div className="wa-body">
                                <b>{action.label}</b>
                                <small>{action.description}</small>
                            </div>
                            <div className="wa-actions">
                                <button
                                    type="button"
                                    onClick={() => quickExport(action.id)}
                                    disabled={action.count === 0 && action.id !== 'ssmi'}
                                >
                                    Export .xlsx
                                </button>
                                <Link to="/forms">
                                    <button type="button" className="secondary">
                                        All Forms
                                    </button>
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="split">
                <BarList title="Units by Category" rows={categories} total={units} />
                <article className="panel">
                    <h3>Warehouse Inventory</h3>
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr><th>Property No.</th><th>Item</th><th>Category</th><th>Qty</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                {stockItems.slice(0, 10).map(asset => (
                                    <tr key={asset.id}>
                                        <td>{asset.propertyNo || '—'}</td>
                                        <td>{asset.description || '—'}</td>
                                        <td>{asset.category || 'Uncategorized'}</td>
                                        <td>{asset.quantity ?? 0}</td>
                                        <td>{asset.status || 'Unassigned'}</td>
                                    </tr>
                                ))}
                                {!stockItems.length && <tr><td colSpan="5">No inventory records yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </article>
            </div>

            {/* =========================================
                RECENT WAREHOUSE TRANSACTIONS
            ========================================= */}
            <article className="panel">
                <h3>Recent Warehouse Transactions</h3>
                <p className="result-count">
                    Latest AIR, RIS, and SSMI records filed in the register.
                </p>
                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Form</th>
                                <th>Reference No.</th>
                                <th>Description</th>
                                <th>Office / Dept.</th>
                                <th>Qty</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map(a => (
                                <tr key={a.id}>
                                    <td>
                                        <span className={`txn-tag txn-${a.formType}`}>
                                            {txnLabel(a.formType)}
                                        </span>
                                    </td>
                                    <td>{txnRef(a)}</td>
                                    <td>{a.description || a.ssmiMonth || '—'}</td>
                                    <td>{a.officeDept || a.department || '—'}</td>
                                    <td>{a.quantity ?? '—'}</td>
                                    <td>{a.airDate || a.risDate || '—'}</td>
                                </tr>
                            ))}
                            {!transactions.length && (
                                <tr>
                                    <td colSpan="6">
                                        No warehouse transactions yet. Register an AIR or RIS
                                        from the <Link to="/assets">Assets</Link> page.
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

export default function Dashboard() {

    const { assets, warehouseAssets, logs } = useInventory();
    const { user } = useAuth();

    // Administrators get their own organization-wide dashboard.
    if (isAdminRole(user?.role)) {
        return <AdminDashboard />;
    }

    if (user?.role && user.role !== 'staff') {
        return <RoleDashboard roleId={user.role} assets={assets} warehouseAssets={warehouseAssets} logs={logs} />;
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
                <BarList title="By Classification" rows={byClassification} total={assets.length} />
                <BarList title="By Condition" rows={byCondition} total={assets.length} tone="#c2762e" />
            </div>

            <div className="split">
                <BarList title="By Department" rows={byDepartment} total={assets.length} />

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
