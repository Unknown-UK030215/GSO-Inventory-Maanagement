// ============================================================
// PASSWORD SECURITY
// ------------------------------------------------------------
// One place for the password policy and the hashing used when an
// account is created, when a signed-in user changes their
// password, and when a forgotten password is reset.
//
// New credentials are salted and hashed with PBKDF2-SHA256.
// Accounts created before this upgrade only carry a legacy
// unsalted SHA-256 hash; those are still verified and are
// upgraded to PBKDF2 the next time the password is changed.
// ============================================================

const encoder = new TextEncoder();

export const PASSWORD_MIN_LENGTH = 8;
export const PBKDF2_ITERATIONS = 120000;
export const MAX_RECOVERY_ATTEMPTS = 5;
export const RECOVERY_LOCK_MINUTES = 15;

function requireCrypto() {
    if (!globalThis.crypto?.subtle) {
        throw new Error('Secure password hashing is unavailable in this browser. Open the app on localhost or HTTPS.');
    }
    return globalThis.crypto;
}

function toHex(bytes) {
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
    const clean = String(hex || '');
    const out = new Uint8Array(Math.floor(clean.length / 2));
    for (let i = 0; i < out.length; i += 1) {
        out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
}

function randomSalt(bytes = 16) {
    const value = new Uint8Array(bytes);
    requireCrypto().getRandomValues(value);
    return toHex(value);
}

// Constant-time string compare so a wrong password cannot be narrowed down
// by how long the check takes.
export function timingSafeEqual(a, b) {
    const left = String(a || '');
    const right = String(b || '');
    if (left.length !== right.length) return false;

    let diff = 0;
    for (let i = 0; i < left.length; i += 1) {
        diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
    }
    return diff === 0;
}

async function sha256Hex(text) {
    const digest = await requireCrypto().subtle.digest('SHA-256', encoder.encode(String(text)));
    return toHex(digest);
}

async function pbkdf2Hex(text, saltHex, iterations = PBKDF2_ITERATIONS) {
    const key = await requireCrypto().subtle.importKey(
        'raw',
        encoder.encode(String(text)),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    const bits = await requireCrypto().subtle.deriveBits(
        { name: 'PBKDF2', salt: fromHex(saltHex), iterations, hash: 'SHA-256' },
        key,
        256
    );
    return toHex(bits);
}

// ----------------------------------------
// PASSWORD POLICY
// ----------------------------------------

// Returns the list of requirements a password still fails. Empty means OK.
export function passwordIssues(password, { username } = {}) {
    const value = String(password || '');
    const issues = [];

    if (value.length < PASSWORD_MIN_LENGTH) issues.push(`at least ${PASSWORD_MIN_LENGTH} characters`);
    if (!/[a-z]/.test(value)) issues.push('a lowercase letter');
    if (!/[A-Z]/.test(value)) issues.push('an uppercase letter');
    if (!/[0-9]/.test(value)) issues.push('a number');
    if (!/[^A-Za-z0-9]/.test(value)) issues.push('a symbol');
    if (username && value && value.toLowerCase().includes(String(username).toLowerCase())) {
        issues.push('no part of your username');
    }

    return issues;
}

export function assertStrongPassword(password, options = {}) {
    const issues = passwordIssues(password, options);
    if (issues.length) {
        throw new Error(`Choose a stronger password — it needs ${issues.join(', ')}.`);
    }
}

// 0–4 score with a label, used by the little strength hint in the forms.
export function passwordStrength(password) {
    const value = String(password || '');
    if (!value) return { score: 0, label: 'Empty' };

    let score = 0;
    if (value.length >= PASSWORD_MIN_LENGTH) score += 1;
    if (value.length >= 12) score += 1;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
    if (/[0-9]/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;

    const capped = Math.min(4, score);
    return { score: capped, label: ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'][capped] };
}

// ----------------------------------------
// PASSWORD RECORDS
// ----------------------------------------

// Build the salted credential stored for a new or changed password.
export async function makeCredential(password) {
    const salt = randomSalt();
    return {
        passwordSalt: salt,
        passwordHash: await pbkdf2Hex(password, salt),
        passwordAlgorithm: 'pbkdf2-sha256',
        passwordIterations: PBKDF2_ITERATIONS
    };
}

export function isModernCredential(record) {
    return Boolean(record && record.passwordSalt && record.passwordHash);
}

// Verify against a salt+PBKDF2 record. Legacy records are handled by the
// caller via `legacyPasswordHash` so plaintext seeds stay out of this module.
export async function verifyCredential(password, record) {
    if (!isModernCredential(record)) return false;
    const computed = await pbkdf2Hex(
        password,
        record.passwordSalt,
        record.passwordIterations || PBKDF2_ITERATIONS
    );
    return timingSafeEqual(computed, record.passwordHash);
}

// Legacy unsalted SHA-256 — only used to verify accounts that have not been
// upgraded yet.
export async function legacyPasswordHash(password) {
    return sha256Hex(password);
}

// ----------------------------------------
// RECOVERY-ANSWER SECRETS
// ----------------------------------------

export async function hashRecoveryAnswer(answer) {
    const salt = randomSalt();
    return {
        securityAnswerHash: await pbkdf2Hex(normalizeAnswer(answer), salt),
        securityAnswerSalt: salt
    };
}

export async function verifyRecoveryAnswer(answer, stored) {
    if (!stored?.securityAnswerHash || !stored?.securityAnswerSalt) return false;
    const computed = await pbkdf2Hex(normalizeAnswer(answer), stored.securityAnswerSalt);
    return timingSafeEqual(computed, stored.securityAnswerHash);
}

// Answers are compared case- and whitespace-insensitively so a difference in
// casing does not lock a user out of their own account.
export function normalizeAnswer(answer) {
    return String(answer || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
