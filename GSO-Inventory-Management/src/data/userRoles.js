export const USER_ROLES = [
    {
        id: 'staff',
        name: 'Staff',
        description: 'General inventory management and administration.'
    },
    {
        id: 'fuel-vehicle',
        name: 'Fuel/Vehicle',
        description: 'Vehicle, fuel, assignment, and transfer overview.'
    },
    {
        id: 'warehouse',
        name: 'Warehouse Staff',
        description: 'Stock, physical count, and condition overview.'
    }
];

const rolePaths = {
    staff: null,
    'fuel-vehicle': new Set([
        '/',
        '/assets',
        '/assignments',
        '/transfers',
        '/inspection',
        '/activity-logs'
    ]),
    warehouse: new Set([
        '/',
        '/assets',
        '/physical-inventory',
        '/assignments',
        '/transfers',
        '/inspection',
        '/forms',
        '/reports'
    ])
};

export function getRole(roleId) {
    return USER_ROLES.find(role => role.id === roleId) || USER_ROLES[0];
}

export function canAccessPath(roleId, path) {
    const allowed = rolePaths[roleId] ?? rolePaths.staff;
    return allowed === null || allowed.has(path);
}
