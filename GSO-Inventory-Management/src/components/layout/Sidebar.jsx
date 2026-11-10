import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

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
            ['Inspection & Repair', '/inspection']
        ]
    },
    {
        label: 'Disposal & Records',
        links: [
            ['Disposal & Missing', '/disposal'],
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
                ['Inspection & Repair', '/inspection']
            ]
        },
        { label: 'Activity', links: [['Activity Logs', '/activity-logs']] }
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
                ['Inspection & Repair', '/inspection']
            ]
        },
        { label: 'Records', links: [['Forms', '/forms'], ['Reports', '/reports']] }
    ]
};

export default function Sidebar() {
    const { user, logout } = useAuth();
    const visibleGroups = groupsByRole[user?.role] || groups;

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
