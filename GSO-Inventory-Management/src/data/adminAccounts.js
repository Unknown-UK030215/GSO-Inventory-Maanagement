// Secret administrator accounts for this local prototype.
//
// These are intentionally NOT listed in the public role picker or the
// registration form. They can only be reached through the hidden
// administrator sign-in route (/admin-login).
//
// Change these credentials before any real deployment — this prototype
// stores everything in the browser and is not server-secured.
export const ADMIN_ACCOUNTS = [
    {
        username: 'admin',
        password: 'GsoAdmin#2026',
        role: 'admin',
        displayName: 'System Administrator'
    },
    {
        username: 'superadmin',
        password: 'GsoSuper#2026',
        role: 'super-admin',
        displayName: 'Super Administrator'
    }
];
