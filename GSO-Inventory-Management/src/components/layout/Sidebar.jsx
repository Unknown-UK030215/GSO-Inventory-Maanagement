import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { useChat } from '../../context/ChatContext';
import { useFeedback } from '../../context/FeedbackContext';
import { useNotifications } from '../../context/NotificationContext';

// Grouped navigation so the 11 pages are easy to scan.
const groups = [
    {
        label: 'Overview',
        links: [
            ['Dashboard', '/']
        ]
    },
    {
        label: 'Assets & Inventory',
        links: [
            ['Assets', '/assets'],
            ['Physical Inventory', '/physical-inventory'],
            ['Assignments', '/assignments'],
            ['Transfers', '/transfers'],
            ['Inspection & Repair', '/inspection'],
            ['Maintenance & Repair', '/maintenance']
        ]
    },
    {
        label: 'Disposal & Records',
        links: [
            ['Disposal & Missing', '/disposal'],
            ['Property Clearance', '/clearance'],
            ['Forms', '/forms'],
            ['Reports', '/reports']
        ]
    },
    {
        label: 'Administration',
        links: [
            ['Departments', '/departments'],
            ['Activity Logs', '/activity-logs']
        ]
    },
    {
        label: 'Supply',
        links: [
            ['Purchasing & Receiving', '/purchasing'],
            ['Stock on Hand (RPCI)', '/rpci']
        ]
    },
    {
        label: 'Support',
        links: [
            ['Role Chat', '/chat'],
            ['Feedback & Bug Report', '/feedback']
        ]
    }
];

const groupsByRole = {
    'fuel-vehicle': [
        { label: 'Overview', links: [['Fuel/Vehicle Dashboard', '/']] },
        {
            label: 'Fleet Operations',
            links: [
                ['Fuel/Vehicle Register', '/assets'],
                ['Assignments', '/assignments'],
                ['Transfers', '/transfers'],
                ['Inspection & Repair', '/inspection'],
                ['Maintenance & Repair', '/maintenance']
            ]
        },
        { label: 'Activity', links: [['Activity Logs', '/activity-logs']] },
        { label: 'Support', links: [['Role Chat', '/chat'], ['Notifications', '/notifications'], ['Feedback & Bug Report', '/feedback']] }
    ],
    warehouse: [
        { label: 'Overview', links: [['Warehouse Dashboard', '/']] },
        {
            label: 'Warehouse Operations',
            links: [
                ['Warehouse Inventory', '/assets'],
                ['Physical Inventory', '/physical-inventory'],
                ['Assignments', '/assignments'],
                ['Transfers', '/transfers'],
                ['Inspection & Repair', '/inspection'],
                ['Maintenance & Repair', '/maintenance']
            ]
        },
        { label: 'Supply', links: [['Purchasing & Receiving', '/purchasing'], ['Stock on Hand (RPCI)', '/rpci']] },
        { label: 'Records', links: [['Property Clearance', '/clearance'], ['Forms', '/forms'], ['Reports', '/reports']] },
        { label: 'Support', links: [['Role Chat', '/chat'], ['Notifications', '/notifications'], ['Feedback & Bug Report', '/feedback']] }
    ],
    admin: [
        { label: 'Administration', links: [['Administrator Dashboard', '/']] },
        {
            label: 'Registers & Records',
            links: [
                ['Assets', '/assets'],
                ['Forms', '/forms'],
                ['Reports', '/reports'],
                ['Departments', '/departments'],
                ['Purchasing & Receiving', '/purchasing'],
                ['Stock on Hand (RPCI)', '/rpci'],
                ['Maintenance & Repair', '/maintenance'],
                ['Property Clearance', '/clearance']
            ]
        },
        { label: 'Monitoring', links: [['Activity Logs', '/activity-logs'], ['Data Backup & Restore', '/backup']] },
        { label: 'Support', links: [['Role Chat', '/chat'], ['Notifications', '/notifications'], ['Feedback & Bug Report', '/feedback']] }
    ],
    'super-admin': [
        { label: 'Administration', links: [['Super Admin Dashboard', '/']] },
        {
            label: 'Registers & Records',
            links: [
                ['Assets', '/assets'],
                ['Forms', '/forms'],
                ['Reports', '/reports'],
                ['Departments', '/departments'],
                ['Purchasing & Receiving', '/purchasing'],
                ['Stock on Hand (RPCI)', '/rpci'],
                ['Maintenance & Repair', '/maintenance'],
                ['Property Clearance', '/clearance']
            ]
        },
        { label: 'Monitoring', links: [['Activity Logs', '/activity-logs'], ['Data Backup & Restore', '/backup']] },
        { label: 'Support', links: [['Role Chat', '/chat'], ['Notifications', '/notifications'], ['Feedback & Bug Report', '/feedback']] }
    ]
};

export default function Sidebar() {
    const { user, logout } = useAuth();
    const { unreadCount: unreadChat } = useChat();
    const { openCount } = useFeedback();
    const { unreadCount } = useNotifications();
    const visibleGroups = groupsByRole[user?.role] || groups;

    // Super administrators get a count of reports that still need attention.
    const showFeedbackBadge = user?.role === 'super-admin' && openCount > 0;

    return (
        <aside className="sidebar">

            <h2>Inventory Dashboard</h2>
            <small>EL NIDO GSO</small>

            <nav>
                {visibleGroups.map(group => (
                    <div className="nav-group" key={group.label}>
                        <span className="nav-label">{group.label}</span>
                        {group.links.map(([name, path]) => (
                            <NavLink end={path === '/'} to={path} key={path}>
                                {name}
                                {path === '/notifications' && unreadCount > 0 && (
                                    <span className="nav-badge">{unreadCount}</span>
                                )}
                                {path === '/chat' && unreadChat > 0 && (
                                    <span className="nav-badge">{unreadChat}</span>
                                )}
                                {path === '/feedback' && showFeedbackBadge && (
                                    <span className="nav-badge">{openCount}</span>
                                )}
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            <div className="staff">
                {user?.displayName || 'Inventory Staff'}<br />
                <small>{user?.username || 'Staff workspace'}</small>
                <button type="button" className="logout-button" onClick={logout}>
                    Sign Out
                </button>
            </div>

        </aside>
    );
}
