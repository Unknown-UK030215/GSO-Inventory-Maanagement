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

// Administrator roles are deliberately kept out of USER_ROLES so they never
// appear in the public role picker or the registration form. They are only
// reachable through the hidden administrator sign-in route.
export const ADMIN_ROLES = [
    {
        id: 'admin',
        name: 'Administrator',
        description: 'System administration and oversight.'
    },
    {
        id: 'super-admin',
        name: 'Super Administrator',
        description: 'Full control including account management.'
    }
];

const ROLE_PATHS = {
    staff: null,
    'fuel-vehicle': new Set([
        '/',
        '/assets',
        '/assignments',
        '/transfers',
        '/inspection',
        '/maintenance',
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
        '/reports',
        '/purchasing',
        '/rpci',
        '/maintenance',
        '/clearance'
    ]),
    // Administrators get unrestricted access; `null` means "every path".
    admin: null,
    'super-admin': null
};

export function getRole(roleId) {
    return [...USER_ROLES, ...ADMIN_ROLES].find(role => role.id === roleId) || USER_ROLES[0];
}

export function isAdminRole(roleId) {
    return ADMIN_ROLES.some(role => role.id === roleId);
}

export function canAccessPath(roleId, path) {
    const allowed = ROLE_PATHS[roleId] ?? ROLE_PATHS.staff;
    return allowed === null || allowed.has(path);
}
