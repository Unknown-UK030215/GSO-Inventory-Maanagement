import { useState } from 'react';
import { Link } from 'react-router-dom';

import PageHeader from '../components/common/PageHeader';
import BarList from '../components/common/BarList';
import { useAuth } from '../context/useAuth';
import { useFeedback } from '../context/FeedbackContext';
import { useInventory } from '../context/InventoryContext';
import { useMaintenance } from '../context/MaintenanceContext';
import { useNotifications } from '../context/NotificationContext';
import { useSupply } from '../context/SupplyContext';
import { ASSET_FORMS, isWarehouseTransaction } from '../data/assetForms';
import { ADMIN_ROLES, canAccessPath, getRole, USER_ROLES } from '../data/userRoles';
import { exportCSV } from '../services/reportService';
import { pesoShort } from '../services/formatService';

// Routes that are governed by role permissions — used by the access overview.
const ACCESS_PATHS = [
    ['/assets', 'Assets'],
    ['/disposal', 'Disposal & Missing'],
    ['/forms', 'Forms'],
    ['/physical-inventory', 'Physical Inventory'],
    ['/assignments', 'Assignments'],
    ['/transfers', 'Transfers'],
    ['/inspection', 'Inspection & Repair'],
    ['/departments', 'Departments'],
    ['/reports', 'Reports'],
    ['/activity-logs', 'Activity Logs']
];

const ALL_ROLES = [...USER_ROLES, ...ADMIN_ROLES];

const formName = formType =>
    ASSET_FORMS.find(form => form.id === formType)?.name || formType || '—';

const recordRef = record =>
    record.propertyNo || record.airNo || record.risNo || record.ssmiMonth || '—';

export default function AdminDashboard() {
    const { user, listUsers, removeUser } = useAuth();
    const { assets, warehouseAssets, logs } = useInventory();
    const { feedback, updateFeedbackStatus, deleteFeedback, openCount } = useFeedback();
    const { notifications, publishNotification, deleteNotification } = useNotifications();
    const { rpci, lowStock, purchases } = useSupply();
    const { workOrders, openCount: openWorkOrders } = useMaintenance();

    const isSuperAdmin = user?.role === 'super-admin';
    const [accounts, setAccounts] = useState(listUsers);
    const [notice, setNotice] = useState('');
    const [roleFilter, setRoleFilter] = useState(USER_ROLES[0].id);
    const [selectedUsername, setSelectedUsername] = useState('');
    const [reportKind, setReportKind] = useState('all');
    const [reportStatus, setReportStatus] = useState('All status');
    const [noticeTitle, setNoticeTitle] = useState('');
    const [noticeMessage, setNoticeMessage] = useState('');
    const [noticeType, setNoticeType] = useState('info');
    const [noticeStatus, setNoticeStatus] = useState('');

    const reports = feedback.filter(item =>
        (reportKind === 'all' || item.kind === reportKind) &&
        (reportStatus === 'All status' || item.status === reportStatus)
    );

    const allRecords = [...assets, ...warehouseAssets];
    const stockItems = warehouseAssets.filter(asset => !isWarehouseTransaction(asset.formType));
    const transactions = warehouseAssets.filter(asset => isWarehouseTransaction(asset.formType));
    const inventoryValue = assets.reduce(
        (sum, asset) => sum + Number(asset.cost || 0) * Number(asset.quantity || 1),
        0
    );
    const departmentsCovered = new Set(assets.map(asset => asset.department).filter(Boolean)).size;

    // What a given account has encoded (created) and everything it has done.
    const recordsBy = username => allRecords.filter(record => record.registeredBy === username);
    const tasksBy = username => logs.filter(entry => entry.actor === username);

    const roleAccounts = accounts.filter(account => account.role === roleFilter);
    const selected = accounts.find(account => account.username === selectedUsername) || null;

    // ----- Alerts & data health (both registers) -----
    const unserviceable = allRecords.filter(asset => asset.condition === 'Unserviceable');
    const forInspection = allRecords.filter(asset => asset.condition === 'For Inspection');
    const missingAssets = allRecords.filter(asset => asset.status === 'Missing');
    const unassigned = assets.filter(asset => asset.status === 'Unassigned');

    const duplicateProperties = Object.entries(
        allRecords
            .filter(asset => asset.propertyNo)
            .reduce((map, asset) => {
                const key = String(asset.propertyNo).trim().toLowerCase();
                map[key] = (map[key] || 0) + 1;
                return map;
            }, {})
    ).filter(([, count]) => count > 1);

    const missingDepartment = allRecords.filter(asset =>
        !String(asset.department || asset.officeDept || '').trim()
    );
    const assignedNoAccountable = assets.filter(asset =>
        asset.status === 'Assigned' && !String(asset.accountable || '').trim()
    );

    // ----- Register analytics -----
    const warehouseValue = stockItems.reduce(
        (sum, asset) => sum + Number(asset.cost || 0) * Number(asset.quantity || 1),
        0
    );
    const warehouseUnits = stockItems.reduce((sum, asset) => sum + Number(asset.quantity || 0), 0);
    const inventoryByDepartment = [...new Set(assets.map(asset => asset.department).filter(Boolean))]
        .map(department => [department, assets.filter(asset => asset.department === department).length])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
    const warehouseByCategory = [...new Set(stockItems.map(asset => asset.category || 'Uncategorized'))]
        .map(category => [
            category,
            stockItems
                .filter(asset => (asset.category || 'Uncategorized') === category)
                .reduce((sum, asset) => sum + Number(asset.quantity || 0), 0)
        ])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

    // ----- Staff performance -----
    const staffActivity = accounts
        .map(account => ({
            username: account.username,
            displayName: account.displayName,
            role: account.role,
            encoded: recordsBy(account.username).length,
            tasks: tasksBy(account.username).length
        }))
        .sort((a, b) => (b.encoded + b.tasks) - (a.encoded + a.tasks));
    const topContributors = staffActivity.filter(item => item.encoded || item.tasks).slice(0, 5);

    function exportStaffActivity() {
        exportCSV(
            staffActivity.map(item => ({
                Account: item.username,
                Name: item.displayName,
                Position: getRole(item.role).name,
                EncodedRecords: item.encoded,
                Tasks: item.tasks
            })),
            'gso-staff-activity.csv'
        );
    }

    function handleRemove(username) {
        try {
            removeUser(username);
            setAccounts(listUsers());
            if (selectedUsername === username) setSelectedUsername('');
            setNotice(`Account "${username}" has been removed.`);
        } catch (err) {
            setNotice(err.message);
        }
    }

    function handlePublish(event) {
        event.preventDefault();
        try {
            publishNotification({ title: noticeTitle, message: noticeMessage, type: noticeType });
            setNoticeTitle('');
            setNoticeMessage('');
            setNoticeType('info');
            setNoticeStatus('Notification sent to all users.');
        } catch (err) {
            setNoticeStatus(err.message);
        }
    }

    return (
        <>
            <PageHeader
                title={isSuperAdmin ? 'Super Administrator Dashboard' : 'Administrator Dashboard'}
                description="Organization-wide overview of registers, staff accounts, and the work each account does."
            />

            <div className="cards">
                <article><small>Registered Accounts</small><strong>{accounts.length}</strong></article>
                <article><small>Inventory Records</small><strong>{assets.length}</strong></article>
                <article><small>Warehouse Records</small><strong>{warehouseAssets.length}</strong></article>
                <article><small>Activity Entries</small><strong>{logs.length}</strong></article>
                {isSuperAdmin && (
                    <article><small>Open Bug Reports</small><strong>{openCount}</strong></article>
                )}
            </div>

            <div className="split">
                <article className="panel">
                    <h3>Register Overview</h3>
                    <div className="alert-row">
                        <span>Inventory property records</span>
                        <b>{assets.length}</b>
                    </div>
                    <div className="alert-row">
                        <span>Inventory property value</span>
                        <b>{pesoShort(inventoryValue)}</b>
                    </div>
                    <div className="alert-row">
                        <span>Departments covered</span>
                        <b>{departmentsCovered}</b>
                    </div>
                    <div className="alert-row">
                        <span>Warehouse stock items</span>
                        <b>{stockItems.length}</b>
                    </div>
                    <div className="alert-row">
                        <span>Warehouse transactions (AIR / RIS / SSMI)</span>
                        <b>{transactions.length}</b>
                    </div>
                    <p className="alert-note">
                        Registers can be reviewed from the <Link to="/assets">Assets</Link> page.
                    </p>
                </article>

                <article className="panel">
                    <h3>Accounts by Position</h3>
                    {USER_ROLES.map(role => {
                        const count = accounts.filter(account => account.role === role.id).length;
                        return (
                            <div className="alert-row" key={role.id}>
                                <span>{role.name}</span>
                                <b>{count}</b>
                            </div>
                        );
                    })}
                </article>
            </div>

            {/* =========================================
                ALERTS & DATA HEALTH
            ========================================= */}
            <div className="split">
                <article className="panel">
                    <h3>Items Needing Attention</h3>
                    <p className="result-count">Across the inventory and warehouse registers.</p>
                    <div className="alert-row">
                        <span>Unserviceable</span>
                        <b>{unserviceable.length}</b>
                    </div>
                    <div className="alert-row">
                        <span>For inspection</span>
                        <b>{forInspection.length}</b>
                    </div>
                    <div className="alert-row">
                        <span>Reported missing</span>
                        <b>{missingAssets.length}</b>
                    </div>
                    <div className="alert-row">
                        <span>Unassigned inventory</span>
                        <b>{unassigned.length}</b>
                    </div>
                    <p className="alert-note">
                        Review these from the <Link to="/assets">Assets</Link> or{' '}
                        <Link to="/inspection">Inspection</Link> pages.
                    </p>
                </article>

                <article className="panel">
                    <h3>Data Health Checks</h3>
                    <p className="result-count">Records that may need correcting.</p>
                    <div className="alert-row">
                        <span>Duplicate property numbers</span>
                        <b>{duplicateProperties.length}</b>
                    </div>
                    <div className="alert-row">
                        <span>Records without a department</span>
                        <b>{missingDepartment.length}</b>
                    </div>
                    <div className="alert-row">
                        <span>Assigned without an accountable person</span>
                        <b>{assignedNoAccountable.length}</b>
                    </div>
                    {duplicateProperties.length > 0 ? (
                        <p className="alert-note">
                            Duplicates: {duplicateProperties.map(([value]) => value).join(', ')}
                        </p>
                    ) : (
                        !missingDepartment.length && !assignedNoAccountable.length && (
                            <p className="alert-note">No data issues detected.</p>
                        )
                    )}
                </article>
            </div>

            {/* =========================================
                SUPPLY & MAINTENANCE
            ========================================= */}
            <div className="split">
                <article className={`panel${lowStock.length ? ' panel-warning' : ''}`}>
                    <h3>Supply &amp; Stock Alerts</h3>
                    <p className="result-count">Purchasing, live stock on hand, and reorder levels.</p>
                    <div className="alert-row">
                        <span>Purchase orders received</span>
                        <b>{purchases.length}</b>
                    </div>
                    <div className="alert-row">
                        <span>Stock items tracked (RPCI)</span>
                        <b>{rpci.length}</b>
                    </div>
                    <div className="alert-row">
                        <span>Items at or below minimum</span>
                        <b>{lowStock.length}</b>
                    </div>
                    <p className="alert-note">
                        {lowStock.length
                            ? `Running low: ${lowStock.map(item => item.description).slice(0, 3).join(', ')}${lowStock.length > 3 ? '…' : ''}. `
                            : 'No supply is below its minimum level. '}
                        Manage on <Link to="/rpci">Stock on Hand (RPCI)</Link>.
                    </p>
                </article>

                <article className={`panel${openWorkOrders ? ' panel-warning' : ''}`}>
                    <h3>Maintenance Work Orders</h3>
                    <p className="result-count">Equipment and items under repair.</p>
                    <div className="alert-row">
                        <span>Open work orders</span>
                        <b>{openWorkOrders}</b>
                    </div>
                    <div className="alert-row">
                        <span>Completed</span>
                        <b>{workOrders.filter(order => order.status === 'Completed').length}</b>
                    </div>
                    <div className="alert-row">
                        <span>Total repair cost</span>
                        <b>{pesoShort(workOrders.reduce((sum, order) => sum + Number(order.repairCost || 0), 0))}</b>
                    </div>
                    <p className="alert-note">
                        Track repairs on the <Link to="/maintenance">Maintenance &amp; Repair</Link> page.
                    </p>
                </article>
            </div>

            {/* =========================================
                REGISTER ANALYTICS
            ========================================= */}
            <div className="split">
                <article className="panel">
                    <h3>Inventory by Department</h3>
                    <p className="result-count">Top departments by number of records.</p>
                    <BarList rows={inventoryByDepartment} total={assets.length} tone="#2f6fb1" />
                </article>

                <article className="panel">
                    <h3>Warehouse by Category</h3>
                    <p className="result-count">Top categories by quantity on hand.</p>
                    <BarList rows={warehouseByCategory} total={warehouseUnits} tone="#3f8f6b" />
                </article>
            </div>

            <article className="panel">
                <h3>Register Totals</h3>
                <div className="alert-row">
                    <span>Inventory records</span>
                    <b>{assets.length}</b>
                </div>
                <div className="alert-row">
                    <span>Inventory property value</span>
                    <b>{pesoShort(inventoryValue)}</b>
                </div>
                <div className="alert-row">
                    <span>Warehouse stock items</span>
                    <b>{stockItems.length}</b>
                </div>
                <div className="alert-row">
                    <span>Warehouse stock value</span>
                    <b>{pesoShort(warehouseValue)}</b>
                </div>
                <div className="alert-row">
                    <span>Warehouse transactions (AIR / RIS / SSMI)</span>
                    <b>{transactions.length}</b>
                </div>
                <p className="alert-note">
                    Protect these records — download a copy from{' '}
                    <Link to="/backup">Data Backup &amp; Restore</Link>.
                </p>
            </article>

            {/* =========================================
                STAFF PERFORMANCE
            ========================================= */}
            <article className="panel">
                <h3>Staff Performance</h3>
                <p className="result-count">Accounts ranked by records encoded and tasks performed.</p>
                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Full Name</th>
                                <th>Position</th>
                                <th>Encoded Records</th>
                                <th>Tasks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topContributors.map((item, index) => (
                                <tr key={item.username}>
                                    <td>{index + 1}</td>
                                    <td>{item.displayName}</td>
                                    <td>{getRole(item.role).name}</td>
                                    <td>{item.encoded}</td>
                                    <td>{item.tasks}</td>
                                </tr>
                            ))}
                            {!topContributors.length && (
                                <tr><td colSpan="5">No staff activity recorded yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="actions">
                    <button type="button" className="secondary" onClick={exportStaffActivity}>
                        Export Staff Activity CSV
                    </button>
                </div>
            </article>

            {/* =========================================
                STAFF ACCOUNTS BY ROLE
            ========================================= */}
            <article className="panel">
                <h3>Staff Accounts by Role</h3>
                <p className="result-count">
                    Pick a role to see its accounts, how many records each account encoded,
                    and how many tasks it performed.
                </p>

                <div className="toolbar">
                    {USER_ROLES.map(role => {
                        const count = accounts.filter(account => account.role === role.id).length;
                        const active = roleFilter === role.id;
                        return (
                            <button
                                key={role.id}
                                type="button"
                                className={active ? undefined : 'secondary'}
                                onClick={() => {
                                    setRoleFilter(role.id);
                                    setSelectedUsername('');
                                }}
                            >
                                {role.name} ({count})
                            </button>
                        );
                    })}
                </div>

                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Full Name</th>
                                <th>Username</th>
                                <th>Encoded Records</th>
                                <th>Tasks</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {roleAccounts.map(account => (
                                <tr key={account.username}>
                                    <td>{account.displayName}</td>
                                    <td>{account.username}</td>
                                    <td>{recordsBy(account.username).length}</td>
                                    <td>{tasksBy(account.username).length}</td>
                                    <td className="row-actions">
                                        <button
                                            type="button"
                                            className="secondary"
                                            onClick={() => setSelectedUsername(account.username)}
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!roleAccounts.length && (
                                <tr>
                                    <td colSpan="5">
                                        No {getRole(roleFilter).name} accounts registered yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </article>

            {selected && (
                <div className="split">
                    <article className="panel">
                        <h3>Encoded Records — {selected.displayName}</h3>
                        <div className="table-scroll">
                            <table>
                                <thead>
                                    <tr><th>Form</th><th>Reference</th><th>Description</th><th>Qty</th></tr>
                                </thead>
                                <tbody>
                                    {recordsBy(selected.username).map(record => (
                                        <tr key={record.id}>
                                            <td>{formName(record.formType)}</td>
                                            <td>{recordRef(record)}</td>
                                            <td>{record.description || '—'}</td>
                                            <td>{record.quantity ?? '—'}</td>
                                        </tr>
                                    ))}
                                    {!recordsBy(selected.username).length && (
                                        <tr><td colSpan="4">This account has not encoded any records yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </article>

                    <article className="panel">
                        <h3>Tasks &amp; Activity — {selected.displayName}</h3>
                        {tasksBy(selected.username).slice(0, 20).map(entry => (
                            <p className="log-line" key={entry.id}>
                                {entry.date} — <b>{entry.action}</b>: {entry.detail}
                            </p>
                        ))}
                        {!tasksBy(selected.username).length && (
                            <p>This account has no recorded activity yet.</p>
                        )}
                    </article>
                </div>
            )}

            <article className="panel">
                <h3>Recent Activity</h3>
                {logs.slice(0, 8).map(entry => (
                    <p className="log-line" key={entry.id}>
                        {entry.date} — <b>{entry.actorName || 'System'}</b> · {entry.action}: {entry.detail}
                    </p>
                ))}
                {!logs.length && <p>No recent activity recorded.</p>}
            </article>

            {/* =========================================
                ROLE ACCESS OVERVIEW
            ========================================= */}
            <article className="panel">
                <h3>Role Access Overview</h3>
                <p className="result-count">
                    Which roles can open each governed page. All roles can also reach the
                    dashboard, their profile, feedback, and notifications.
                </p>
                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Page</th>
                                {ALL_ROLES.map(role => (
                                    <th key={role.id}>{role.name}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ACCESS_PATHS.map(([path, label]) => (
                                <tr key={path}>
                                    <td>{label}</td>
                                    {ALL_ROLES.map(role => (
                                        <td key={role.id}>
                                            {canAccessPath(role.id, path) ? 'Yes' : 'No'}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </article>

            {/* =========================================
                SYSTEM BUG REPORTS & USER FEEDBACK
            ========================================= */}
            {isSuperAdmin && (
                <article className="panel">
                    <h3>System Bug Reports &amp; Feedback</h3>
                    <p className="result-count">
                        {openCount} needing attention · {feedback.length} report{feedback.length === 1 ? '' : 's'} from all users.
                    </p>

                    <div className="toolbar">
                        <label>
                            Type
                            <select value={reportKind} onChange={event => setReportKind(event.target.value)}>
                                <option value="all">All types</option>
                                <option value="bug">Bugs</option>
                                <option value="feedback">Feedback</option>
                            </select>
                        </label>
                        <label>
                            Status
                            <select value={reportStatus} onChange={event => setReportStatus(event.target.value)}>
                                <option>All status</option>
                                <option>Open</option>
                                <option>In Review</option>
                                <option>Resolved</option>
                            </select>
                        </label>
                    </div>

                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>From</th>
                                    <th>Subject</th>
                                    <th>Details</th>
                                    <th>Status</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {reports.map(item => (
                                    <tr key={item.id}>
                                        <td>{item.date}</td>
                                        <td>
                                            <span className={`activity-tag ${item.kind === 'bug' ? 'tone-delete' : 'tone-assignment'}`}>
                                                {item.kind === 'bug' ? 'Bug' : 'Feedback'}
                                            </span>
                                        </td>
                                        <td>{item.submittedByName} · {getRole(item.role).name}</td>
                                        <td>{item.subject}</td>
                                        <td className="activity-detail">
                                            {item.message}
                                            {item.page && <small>Reported from {item.page}</small>}
                                        </td>
                                        <td>
                                            <select
                                                value={item.status}
                                                onChange={event => updateFeedbackStatus(item.id, event.target.value)}
                                                aria-label={`Status for ${item.subject}`}
                                            >
                                                <option>Open</option>
                                                <option>In Review</option>
                                                <option>Resolved</option>
                                            </select>
                                        </td>
                                        <td className="row-actions">
                                            <button type="button" className="delete" onClick={() => deleteFeedback(item.id)}>
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {!reports.length && (
                                    <tr><td colSpan="7">No reports match these filters.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}

            {/* =========================================
                SYSTEM NOTIFICATIONS TO ALL USERS
            ========================================= */}
            {isSuperAdmin && (
                <article className="panel">
                    <h3>Notify All Users</h3>
                    <p className="result-count">
                        Broadcast a message to every account when something on the system changes.
                    </p>
                    <form onSubmit={handlePublish}>
                        <div className="form-grid">
                            <label>
                                Type
                                <select value={noticeType} onChange={event => setNoticeType(event.target.value)}>
                                    <option value="info">Update</option>
                                    <option value="alert">Important</option>
                                </select>
                            </label>
                            <label>
                                Title
                                <input
                                    value={noticeTitle}
                                    onChange={event => setNoticeTitle(event.target.value)}
                                    placeholder="e.g. Warehouse register updated"
                                    required
                                />
                            </label>
                            <label className="span-2">
                                Message
                                <textarea
                                    value={noticeMessage}
                                    onChange={event => setNoticeMessage(event.target.value)}
                                    placeholder="Describe the change all users should know about"
                                    required
                                />
                            </label>
                        </div>
                        <div className="actions">
                            <button type="submit">Send to All Users</button>
                        </div>
                        {noticeStatus && <p className="result-count" role="status">{noticeStatus}</p>}
                    </form>

                    <h3 className="section-title">Sent Notifications ({notifications.length})</h3>
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr><th>Date</th><th>Type</th><th>Title</th><th>Message</th><th /></tr>
                            </thead>
                            <tbody>
                                {notifications.map(item => (
                                    <tr key={item.id}>
                                        <td>{item.date}</td>
                                        <td>
                                            <span className={`activity-tag ${item.type === 'alert' ? 'tone-delete' : 'tone-assignment'}`}>
                                                {item.type === 'alert' ? 'Important' : 'Update'}
                                            </span>
                                        </td>
                                        <td>{item.title}</td>
                                        <td className="activity-detail">{item.message}</td>
                                        <td className="row-actions">
                                            <button type="button" className="delete" onClick={() => deleteNotification(item.id)}>
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {!notifications.length && (
                                    <tr><td colSpan="5">No notifications sent yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}

            {isSuperAdmin && (
                <article className="panel">
                    <h3>Account Management</h3>
                    {notice && <p className="result-count" role="status">{notice}</p>}
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr><th>Username</th><th>Full Name</th><th>Position</th><th /></tr>
                            </thead>
                            <tbody>
                                {accounts.map(account => (
                                    <tr key={account.username}>
                                        <td>{account.username}</td>
                                        <td>{account.displayName}</td>
                                        <td>{getRole(account.role).name}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className="delete"
                                                onClick={() => handleRemove(account.username)}
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {!accounts.length && (
                                    <tr><td colSpan="4">No registered accounts to manage.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}
        </>
    );
}
