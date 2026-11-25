// Administrator accounts used by the local prototype fallback (i.e. when
// Supabase is NOT configured). These are NOT reachable via Supabase Auth —
// once Supabase is configured, admin sign-ins go through auth.users and the
// seeded rows in supabase/schema.sql.
//
// The PBKDF2-SHA256 credential below hashes the provided default password
//   ChangeMe!2024
// Change it from Profile Settings after the first sign-in, or re-register the
// administrator in Supabase Auth for production use.
const DEFAULT_ADMIN_CREDENTIAL = {
    passwordSalt: 'd3ada4a68b0839b22b8d22a7d4461fdc',
    passwordHash: '4809da9ae6343ffa83d738238daaa2704ec1165e3f2011f18a65eeb33a7752d4',
    passwordAlgorithm: 'pbkdf2-sha256',
    passwordIterations: 120000
};

export const ADMIN_ACCOUNTS = [
    {
        username: 'admin',
        role: 'admin',
        displayName: 'System Administrator',
        ...DEFAULT_ADMIN_CREDENTIAL
    },
    {
        username: 'superadmin',
        role: 'super-admin',
        displayName: 'Super Administrator',
        ...DEFAULT_ADMIN_CREDENTIAL
    }
];

export const DEFAULT_ADMIN_PASSWORD = 'ChangeMe!2024';
