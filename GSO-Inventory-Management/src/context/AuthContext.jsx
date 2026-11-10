import { useState } from 'react';

import { USER_ROLES } from '../data/userRoles';
import AuthContext from './authContextBase';
const USERS_KEY = 'gso-local-users';
const SESSION_KEY = 'gso-auth-user';
const PROFILES_KEY = 'gso-user-profiles';
const DEFAULT_USERNAME = 'Staff';
const DEFAULT_PASSWORD = 'Staff1323';
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

function buildSession(account) {
    const stored = readProfiles()[profileKey(account.username)] || {};
    return {
        username: account.username,
        role: account.role || 'staff',
        displayName: stored.displayName || account.displayName || account.username,
        email: stored.email || '',
        phone: stored.phone || '',
        department: stored.department || '',
        designation: stored.designation || ''
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

async function hashPassword(password) {
    if (!globalThis.crypto?.subtle) {
        throw new Error('Password hashing is unavailable in this browser. Open the app on localhost or HTTPS.');
    }

    const bytes = new TextEncoder().encode(password);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(readSession);

    function startSession(account) {
        const session = buildSession(account);
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        setUser(session);
        return session;
    }

    async function login(username, password, selectedRole) {
        const normalizedUsername = username.trim().toLowerCase();

        if (normalizedUsername === DEFAULT_USERNAME.toLowerCase() && selectedRole === 'staff') {
            const stored = readProfiles()[normalizedUsername] || {};
            const matches = stored.passwordHash
                ? stored.passwordHash === await hashPassword(password)
                : password === DEFAULT_PASSWORD;
            if (!matches) {
                throw new Error('Username or password is incorrect.');
            }
            return startSession({ username: DEFAULT_USERNAME, displayName: 'Inventory Staff', role: 'staff' });
        }

        const account = readUsers().find(item =>
            typeof item.username === 'string' &&
            item.username.toLowerCase() === normalizedUsername
        );
        if (!account ||
            (account.role || 'staff') !== selectedRole ||
            account.passwordHash !== await hashPassword(password)) {
            throw new Error('Username or password is incorrect.');
        }

        return startSession(account);
    }

    async function register({ displayName, username, password, role }) {
        const cleanName = displayName.trim();
        const cleanUsername = username.trim();
        const normalizedUsername = cleanUsername.toLowerCase();

        if (!cleanName || cleanUsername.length < 3) {
            throw new Error('Enter a name and a username with at least 3 characters.');
        }
        if (normalizedUsername === DEFAULT_USERNAME.toLowerCase() ||
            readUsers().some(item =>
                typeof item.username === 'string' &&
                item.username.toLowerCase() === normalizedUsername
            )) {
            throw new Error('That username is already registered.');
        }
        if (password.length < 8) {
            throw new Error('Choose a password with at least 8 characters.');
        }
        if (!USER_ROLES.some(item => item.id === role)) {
            throw new Error('Choose a valid staff position.');
        }

        const account = {
            username: cleanUsername,
            displayName: cleanName,
            role,
            passwordHash: await hashPassword(password)
        };
        localStorage.setItem(USERS_KEY, JSON.stringify([...readUsers(), account]));
        return startSession(account);
    }

    function updateProfile(changes) {
        if (!user) {
            throw new Error('You must be signed in to update your profile.');
        }

        const displayName = String(changes.displayName || '').trim();
        const email = String(changes.email || '').trim();
        if (!displayName) {
            throw new Error('Your full name is required.');
        }
        if (email && !EMAIL_PATTERN.test(email)) {
            throw new Error('Enter a valid email address.');
        }

        const next = {
            displayName,
            email,
            phone: String(changes.phone || '').trim(),
            department: String(changes.department || '').trim(),
            designation: String(changes.designation || '').trim()
        };

        const key = profileKey(user.username);
        const profiles = readProfiles();
        profiles[key] = { ...profiles[key], ...next };
        writeProfiles(profiles);

        const session = { ...user, ...next };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        setUser(session);
        return session;
    }

    async function changePassword(currentPassword, newPassword) {
        if (!user) {
            throw new Error('You must be signed in to change your password.');
        }
        if (!currentPassword) {
            throw new Error('Enter your current password.');
        }
        if (String(newPassword || '').length < 8) {
            throw new Error('Choose a new password with at least 8 characters.');
        }

        const key = profileKey(user.username);
        const profiles = readProfiles();
        const stored = profiles[key] || {};
        const accounts = readUsers();
        const account = accounts.find(item => profileKey(item.username) === key);

        const expectedHash = stored.passwordHash
            || (account && account.passwordHash)
            || await hashPassword(DEFAULT_PASSWORD);

        if (await hashPassword(currentPassword) !== expectedHash) {
            throw new Error('Your current password is incorrect.');
        }

        const passwordHash = await hashPassword(newPassword);
        if (account) {
            account.passwordHash = passwordHash;
            localStorage.setItem(USERS_KEY, JSON.stringify(accounts));
        } else {
            profiles[key] = { ...stored, passwordHash };
            writeProfiles(profiles);
        }
        return true;
    }

    function logout() {
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, login, register, logout, updateProfile, changePassword }}>
            {children}
        </AuthContext.Provider>
    );
}
