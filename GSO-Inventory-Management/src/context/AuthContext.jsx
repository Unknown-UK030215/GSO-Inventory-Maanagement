import { useCallback, useEffect, useState } from 'react';

import { ADMIN_ACCOUNTS } from '../data/adminAccounts';
import { USER_ROLES } from '../data/userRoles';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
    MAX_RECOVERY_ATTEMPTS,
    RECOVERY_LOCK_MINUTES,
    assertStrongPassword,
    hashRecoveryAnswer,
    isModernCredential,
    legacyPasswordHash,
    makeCredential,
    timingSafeEqual,
    verifyCredential,
    verifyRecoveryAnswer
} from '../services/passwordService';
import {
    fetchAccountProfile,
    updateAccountProfile
} from '../services/supabaseService';
import AuthContext from './authContextBase';

const USERS_KEY = 'gso-local-users';
const SESSION_KEY = 'gso-auth-user';
const PROFILES_KEY = 'gso-user-profiles';
const DEFAULT_USERNAME = 'Staff';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readUsers() {
    try {
        const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
        return Array.isArray(users) ? users : [];
    } catch {
        return [];
    }
}

function readProfiles() {
    try {
        const profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || '{}');
        return profiles && typeof profiles === 'object' && !Array.isArray(profiles) ? profiles : {};
    } catch {
        return {};
    }
}

function writeProfiles(profiles) {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

function profileKey(username) {
    return String(username || '').trim().toLowerCase();
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function supabaseSession(authUser, profile) {
    return {
        id: authUser.id,
        username: profile.username,
        email: authUser.email || profile.email || '',
        role: profile.role,
        displayName: profile.display_name || profile.username,
        phone: profile.phone || '',
        department: profile.department || '',
        designation: profile.designation || '',
        recoveryQuestion: profile.security_question || ''
    };
}

// Locate an account across every place an account can live: the public staff
// register, the secret administrator accounts, or the built-in default user.
function resolveAccount(username) {
    const key = profileKey(username);
    const account = readUsers().find(item => profileKey(item.username) === key) || null;
    const admin = ADMIN_ACCOUNTS.find(item => profileKey(item.username) === key) || null;
    const isDefaultUser = key === profileKey(DEFAULT_USERNAME);

    return {
        key,
        account,
        admin,
        isDefaultUser,
        exists: Boolean(account || admin || isDefaultUser),
        username: account?.username || admin?.username || (isDefaultUser ? DEFAULT_USERNAME : username)
    };
}

function resolveAccountByEmail(email) {
    const target = normalizeEmail(email);
    const profiles = readProfiles();
    const accounts = [
        ...readUsers(),
        ...ADMIN_ACCOUNTS,
        { username: DEFAULT_USERNAME, role: 'staff' }
    ];
    const account = accounts.find(item => {
        const stored = profiles[profileKey(item.username)] || {};
        return normalizeEmail(stored.email || item.email) === target;
    });
    return account ? resolveAccount(account.username) : null;
}

function emailAlreadyUsed(email, ignoredUsername = '') {
    const target = normalizeEmail(email);
    const ignored = profileKey(ignoredUsername);
    if (!target) return false;

    const profiles = readProfiles();
    const accounts = [
        ...readUsers(),
        ...ADMIN_ACCOUNTS,
        { username: DEFAULT_USERNAME }
    ];
    return accounts.some(account => {
        if (profileKey(account.username) === ignored) return false;
        const stored = profiles[profileKey(account.username)] || {};
        return normalizeEmail(stored.email || account.email) === target;
    });
}

// Verify a plaintext password against the stored credential. Modern salted
// hashes are preferred; legacy SHA-256 hashes and the built-in seeds are
// still accepted so no existing account is locked out.
async function verifyAccountPassword(password, { key, account, admin }) {
    const stored = readProfiles()[key] || {};

    if (isModernCredential(stored)) return verifyCredential(password, stored);
    if (isModernCredential(account)) return verifyCredential(password, account);
    if (isModernCredential(admin)) return verifyCredential(password, admin);

    const legacy = await legacyPasswordHash(password);
    if (stored.passwordHash) return timingSafeEqual(legacy, stored.passwordHash);
    if (account?.passwordHash) return timingSafeEqual(legacy, account.passwordHash);
    if (admin?.passwordHash) return timingSafeEqual(legacy, admin.passwordHash);

    return false;
}

// Write a new credential to whichever store owns the account.
function applyCredential(resolved, credential) {
    if (resolved.account) {
        const accounts = readUsers().map(item =>
            profileKey(item.username) === resolved.key ? { ...item, ...credential } : item
        );
        localStorage.setItem(USERS_KEY, JSON.stringify(accounts));
        return;
    }

    const profiles = readProfiles();
    profiles[resolved.key] = { ...profiles[resolved.key], ...credential };
    writeProfiles(profiles);
}

function stampPasswordChanged(key) {
    const profiles = readProfiles();
    profiles[key] = { ...profiles[key], passwordChangedAt: new Date().toISOString() };
    writeProfiles(profiles);
}

function buildSession(account) {
    const stored = readProfiles()[profileKey(account.username)] || {};
    return {
        username: account.username,
        role: account.role || 'staff',
        displayName: stored.displayName || account.displayName || account.username,
        email: stored.email || '',
        phone: stored.phone || '',
        department: stored.department || '',
        designation: stored.designation || '',
        recoveryQuestion: stored.securityQuestion || ''
    };
}

function readSession() {
    try {
        const user = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
        return user?.username ? { ...user, role: user.role || 'staff' } : null;
    } catch {
        return null;
    }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => isSupabaseConfigured ? null : readSession());
    const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);

    useEffect(() => {
        if (!isSupabaseConfigured) return undefined;

        let active = true;
        let revision = 0;
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') setAuthLoading(true);
            const currentRevision = ++revision;
            // Defer database access until Supabase Auth releases its internal
            // lock from the auth-state callback.
            Promise.resolve().then(async () => {
                if (!session?.user) {
                    if (active && currentRevision === revision) {
                        setUser(null);
                        setAuthLoading(false);
                    }
                    return;
                }

                try {
                    const profile = await fetchAccountProfile(session.user.id);
                    if (!profile.is_active) {
                        await supabase.auth.signOut();
                        if (active && currentRevision === revision) {
                            setUser(null);
                            setAuthLoading(false);
                        }
                        return;
                    }
                    if (active && currentRevision === revision) {
                        setUser(supabaseSession(session.user, profile));
                        setAuthLoading(false);
                    }
                } catch (error) {
                    console.error('Unable to load the signed-in account profile:', error.message);
                    if (active && currentRevision === revision) {
                        setUser(null);
                        setAuthLoading(false);
                    }
                }
            });
        });

        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, []);

    function startSession(account) {
        const session = buildSession(account);
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        setUser(session);
        return session;
    }

    async function loadSupabaseProfile(authUser) {
        let profile;
        try {
            profile = await fetchAccountProfile(authUser.id);
        } catch {
            await supabase.auth.signOut();
            throw new Error('Account profile is missing. Apply the latest Supabase schema, then register again.');
        }
        if (!profile.is_active) {
            await supabase.auth.signOut();
            throw new Error('This account has been deactivated. Contact the system administrator.');
        }
        const session = supabaseSession(authUser, profile);
        setUser(session);
        return session;
    }

    async function login(username, password, selectedRole) {
        if (isSupabaseConfigured) {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: normalizeEmail(username),
                password
            });
            if (error || !data.user) {
                throw new Error('Email or password is incorrect.');
            }

            const session = await loadSupabaseProfile(data.user);
            if (session.role !== selectedRole) {
                await supabase.auth.signOut();
                setUser(null);
                throw new Error('This account does not have access to the selected workspace.');
            }
            return session;
        }

        const normalizedUsername = username.trim().toLowerCase();

        if (normalizedUsername === DEFAULT_USERNAME.toLowerCase() && selectedRole === 'staff') {
            const stored = readProfiles()[normalizedUsername] || {};
            const hasCredential = isModernCredential(stored) || Boolean(stored.passwordHash);
            const matches = hasCredential
                ? await verifyAccountPassword(password, resolveAccount(DEFAULT_USERNAME))
                : false;
            if (!matches) {
                throw new Error('Username or password is incorrect.');
            }
            return startSession({ username: DEFAULT_USERNAME, displayName: 'Inventory Staff', role: 'staff' });
        }

        const account = readUsers().find(item =>
            typeof item.username === 'string' &&
            item.username.toLowerCase() === normalizedUsername
        );
        if (!account || (account.role || 'staff') !== selectedRole) {
            throw new Error('Username or password is incorrect.');
        }

        const matches = await verifyAccountPassword(password, resolveAccount(account.username));
        if (!matches) {
            throw new Error('Username or password is incorrect.');
        }

        return startSession(account);
    }

    // Hidden administrator sign-in — validated against the secret accounts
    // rather than the public staff register. A password the administrator
    // changed from Profile Settings is stored as an override.
    async function loginAdmin(username, password) {
        if (isSupabaseConfigured) {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: normalizeEmail(username),
                password
            });
            if (error || !data.user) {
                throw new Error('Invalid administrator credentials.');
            }

            const session = await loadSupabaseProfile(data.user);
            if (!['admin', 'super-admin'].includes(session.role)) {
                await supabase.auth.signOut();
                setUser(null);
                throw new Error('This account is not an administrator.');
            }
            return session;
        }

        const resolved = resolveAccount(username);
        if (!resolved.admin) {
            throw new Error('Invalid administrator credentials.');
        }

        const matches = await verifyAccountPassword(password, resolved);
        if (!matches) {
            throw new Error('Invalid administrator credentials.');
        }

        return startSession({
            username: resolved.admin.username,
            displayName: resolved.admin.displayName,
            role: resolved.admin.role
        });
    }

    const listUsers = useCallback(async () => {
        if (isSupabaseConfigured) {
            if (!['admin', 'super-admin'].includes(user?.role)) return [];
            const { data, error } = await supabase
                .from('account_profiles')
                .select('username, display_name, role, is_active')
                .eq('is_active', true)
                .order('display_name');
            if (error) throw error;
            return (data || []).map(profile => ({
                username: profile.username,
                displayName: profile.display_name || profile.username,
                role: profile.role
            }));
        }
        return readUsers().map(account => ({
            username: account.username,
            displayName: account.displayName || account.username,
            role: account.role || 'staff'
        }));
    }, [user?.role]);

    async function removeUser(username) {
        if (user?.role !== 'super-admin') {
            throw new Error('Only a super administrator can remove accounts.');
        }
        if (isSupabaseConfigured) {
            const { error } = await supabase
                .from('account_profiles')
                .update({ is_active: false })
                .eq('username', username);
            if (error) throw error;
            return;
        }
        const key = profileKey(username);
        const remaining = readUsers().filter(item => profileKey(item.username) !== key);
        localStorage.setItem(USERS_KEY, JSON.stringify(remaining));
    }

    async function register({ displayName, username, email, password, role, securityQuestion, securityAnswer }) {
        const cleanName = displayName.trim();
        const cleanUsername = username.trim();
        const normalizedUsername = cleanUsername.toLowerCase();
        const cleanEmail = normalizeEmail(email);

        if (!cleanName || cleanUsername.length < 3) {
            throw new Error('Enter a name and a username with at least 3 characters.');
        }
        if (!EMAIL_PATTERN.test(cleanEmail)) {
            throw new Error('Enter a valid email address for account recovery.');
        }
        if (!isSupabaseConfigured && emailAlreadyUsed(cleanEmail)) {
            throw new Error('That email address is already registered.');
        }
        if (!isSupabaseConfigured && (normalizedUsername === DEFAULT_USERNAME.toLowerCase() ||
            readUsers().some(item =>
                typeof item.username === 'string' &&
                item.username.toLowerCase() === normalizedUsername
            ))) {
            throw new Error('That username is already registered.');
        }
        if (!USER_ROLES.some(item => item.id === role)) {
            throw new Error('Choose a valid staff position.');
        }
        if (!isSupabaseConfigured && !securityQuestion) {
            throw new Error('Choose a recovery question so you can reset your password later.');
        }
        if (!isSupabaseConfigured && String(securityAnswer || '').trim().length < 2) {
            throw new Error('Add an answer to your recovery question.');
        }
        assertStrongPassword(password, { username: cleanUsername });

        if (isSupabaseConfigured) {
            const { data, error } = await supabase.auth.signUp({
                email: cleanEmail,
                password,
                options: {
                    data: {
                        username: cleanUsername,
                        display_name: cleanName,
                        role
                    }
                }
            });
            if (error) throw new Error(error.message);
            if (!data.session) return { confirmationRequired: true };
            return loadSupabaseProfile(data.user);
        }

        // Salted + PBKDF2 password from the start.
        const credential = await makeCredential(password);
        const account = { username: cleanUsername, displayName: cleanName, role, ...credential };
        localStorage.setItem(USERS_KEY, JSON.stringify([...readUsers(), account]));

        // The recovery question and its answer hash live in the profile store,
        // so recovery works for staff, administrators and the default user.
        const profiles = readProfiles();
        profiles[profileKey(cleanUsername)] = {
            ...profiles[profileKey(cleanUsername)],
            email: cleanEmail,
            securityQuestion,
            ...(await hashRecoveryAnswer(securityAnswer)),
            recoveryAttempts: 0,
            recoveryLockedUntil: '',
            passwordChangedAt: new Date().toISOString()
        };
        writeProfiles(profiles);

        return startSession(account);
    }

    async function updateProfile(changes) {
        if (!user) {
            throw new Error('You must be signed in to update your profile.');
        }

        const displayName = String(changes.displayName || '').trim();
        const email = normalizeEmail(changes.email);
        if (!displayName) {
            throw new Error('Your full name is required.');
        }
        if (!EMAIL_PATTERN.test(email)) {
            throw new Error('Enter a valid email address.');
        }
        if (!isSupabaseConfigured && emailAlreadyUsed(email, user.username)) {
            throw new Error('That email address is already registered to another account.');
        }

        const next = {
            displayName,
            email,
            phone: String(changes.phone || '').trim(),
            department: String(changes.department || '').trim(),
            designation: String(changes.designation || '').trim()
        };

        if (isSupabaseConfigured) {
            if (email !== normalizeEmail(user.email)) {
                throw new Error('To change your sign-in email, contact the administrator so it can be verified.');
            }
            const { email: unchangedEmail, ...profileChanges } = next;
            void unchangedEmail;
            const profile = await updateAccountProfile(user.id, profileChanges);
            const session = {
                ...user,
                displayName: profile.display_name,
                phone: profile.phone || '',
                department: profile.department || '',
                designation: profile.designation || ''
            };
            setUser(session);
            return session;
        }

        const key = profileKey(user.username);
        const profiles = readProfiles();
        profiles[key] = { ...profiles[key], ...next };
        writeProfiles(profiles);

        const session = { ...user, ...next };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        setUser(session);
        return session;
    }

    // Change the password of the signed-in account. The current password is
    // re-authenticated and the new one must satisfy the strength policy and
    // differ from the current one.
    async function changePassword(currentPassword, newPassword) {
        if (!user) {
            throw new Error('You must be signed in to change your password.');
        }
        if (!currentPassword) {
            throw new Error('Enter your current password.');
        }

        if (isSupabaseConfigured) {
            assertStrongPassword(newPassword, { username: user.username });
            if (String(newPassword) === String(currentPassword)) {
                throw new Error('Your new password must be different from your current one.');
            }
            const { error: reauthError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword
            });
            if (reauthError) throw new Error('Your current password is incorrect.');
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw new Error(error.message);
            return true;
        }

        const resolved = resolveAccount(user.username);
        const authenticated = await verifyAccountPassword(currentPassword, resolved);
        if (!authenticated) {
            throw new Error('Your current password is incorrect.');
        }

        assertStrongPassword(newPassword, { username: resolved.username });
        if (String(newPassword) === String(currentPassword)) {
            throw new Error('Your new password must be different from your current one.');
        }

        applyCredential(resolved, await makeCredential(newPassword));
        stampPasswordChanged(resolved.key);
        return true;
    }

    // Send Supabase's one-time recovery code, or use the local-only fallback.
    async function requestPasswordReset(email) {
        const clean = normalizeEmail(email);
        if (!EMAIL_PATTERN.test(clean)) {
            throw new Error('Enter a valid email address.');
        }

        if (isSupabaseConfigured) {
            const { error } = await supabase.auth.resetPasswordForEmail(clean);
            if (error) throw new Error(error.message);
            return true;
        }

        const resolved = resolveAccountByEmail(clean);
        if (!resolved) {
            throw new Error('No account with a recovery question was found for that email address.');
        }
        const stored = readProfiles()[resolved.key] || {};
        if (!stored.securityQuestion || !stored.securityAnswerHash) {
            throw new Error('No recovery question is set for that account. Ask the administrator to help.');
        }

        return { username: resolved.username, question: stored.securityQuestion };
    }

    async function verifyPasswordResetOtp(email, token) {
        if (!isSupabaseConfigured) {
            throw new Error('Email OTP recovery requires Supabase Auth.');
        }
        const cleanEmail = normalizeEmail(email);
        const cleanToken = String(token || '').trim();
        if (!EMAIL_PATTERN.test(cleanEmail) || !cleanToken) {
            throw new Error('Enter the email OTP sent for this account.');
        }
        const { data, error } = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token: cleanToken,
            type: 'recovery'
        });
        if (error || !data.user) {
            throw new Error('That OTP is invalid or expired. Request a new code and try again.');
        }
        return loadSupabaseProfile(data.user);
    }

    // Local-only fallback; Supabase recovery uses verifyPasswordResetOtp.
    async function resetPassword({ username, answer, newPassword }) {
        const resolved = resolveAccount(username);
        const stored = readProfiles()[resolved.key] || {};

        if (!stored.securityQuestion || !stored.securityAnswerHash) {
            throw new Error('No recovery question is set for that account.');
        }

        const lockedUntil = stored.recoveryLockedUntil ? new Date(stored.recoveryLockedUntil).getTime() : 0;
        if (lockedUntil && Date.now() < lockedUntil) {
            const minutes = Math.ceil((lockedUntil - Date.now()) / 60000);
            throw new Error(`Too many incorrect answers. Try again in about ${minutes} minute(s).`);
        }

        const answerOk = await verifyRecoveryAnswer(answer, stored);
        if (!answerOk) {
            const attempts = (stored.recoveryAttempts || 0) + 1;
            const locked = attempts >= MAX_RECOVERY_ATTEMPTS;
            const profiles = readProfiles();
            profiles[resolved.key] = {
                ...stored,
                recoveryAttempts: locked ? 0 : attempts,
                recoveryLockedUntil: locked
                    ? new Date(Date.now() + RECOVERY_LOCK_MINUTES * 60000).toISOString()
                    : ''
            };
            writeProfiles(profiles);
            throw new Error(
                locked
                    ? `Too many incorrect answers. Try again in ${RECOVERY_LOCK_MINUTES} minutes.`
                    : 'The answer is incorrect.'
            );
        }

        assertStrongPassword(newPassword, { username: resolved.username });

        applyCredential(resolved, await makeCredential(newPassword));

        const profiles = readProfiles();
        profiles[resolved.key] = {
            ...profiles[resolved.key],
            recoveryAttempts: 0,
            recoveryLockedUntil: '',
            passwordChangedAt: new Date().toISOString()
        };
        writeProfiles(profiles);
        return true;
    }

    async function completePasswordReset(newPassword) {
        if (!isSupabaseConfigured || !user) {
            throw new Error('Open the password reset link sent to your email first.');
        }
        assertStrongPassword(newPassword, { username: user.username });
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw new Error(error.message);
        await supabase.auth.signOut();
        setUser(null);
        return true;
    }

    // Signed-in users can set or replace their recovery question at any time.
    async function setRecoveryQuestion(question, answer) {
        if (!user) {
            throw new Error('You must be signed in.');
        }
        if (!question) {
            throw new Error('Choose a recovery question.');
        }
        if (String(answer || '').trim().length < 2) {
            throw new Error('Add an answer to your recovery question.');
        }

        if (isSupabaseConfigured) {
            throw new Error('Supabase account recovery uses the verified email OTP.');
        }

        const key = profileKey(user.username);
        const profiles = readProfiles();
        profiles[key] = {
            ...profiles[key],
            securityQuestion: question,
            ...(await hashRecoveryAnswer(answer)),
            recoveryAttempts: 0,
            recoveryLockedUntil: ''
        };
        writeProfiles(profiles);

        const session = { ...user, recoveryQuestion: question };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        setUser(session);
        return true;
    }

    async function logout() {
        if (isSupabaseConfigured) {
            setUser(null);
            const { error } = await supabase.auth.signOut();
            if (error) console.warn('Supabase sign-out warning:', error.message);
            return;
        }
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{
            user,
            authLoading,
            login,
            loginAdmin,
            listUsers,
            removeUser,
            register,
            logout,
            updateProfile,
            changePassword,
            requestPasswordReset,
            verifyPasswordResetOtp,
            resetPassword,
            completePasswordReset,
            setRecoveryQuestion
        }}>
            {children}
        </AuthContext.Provider>
    );
}
