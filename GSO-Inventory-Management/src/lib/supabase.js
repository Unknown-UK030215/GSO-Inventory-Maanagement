// ============================================================
// SUPABASE CLIENT
// ------------------------------------------------------------
// Reads a browser-local public config first, then Vite environment variables:
//
//   VITE_SUPABASE_URL=https://<project>.supabase.co
//   VITE_SUPABASE_ANON_KEY=<anon public key>
//
// A Database Setup screen can save the same public values for this browser.
// Service-role/secret keys are rejected before a client is created.
// ============================================================
import { createClient } from '@supabase/supabase-js';

const RUNTIME_CONFIG_KEY = 'gso-supabase-public-config';
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function readRuntimeConfig() {
    try {
        if (typeof window === 'undefined') return {};
        return JSON.parse(window.localStorage.getItem(RUNTIME_CONFIG_KEY) || '{}');
    } catch {
        return {};
    }
}

const runtimeConfig = readRuntimeConfig();
const url = normalizeProjectUrl(runtimeConfig.url || envUrl);
const anonKey = String(runtimeConfig.anonKey || envKey || '').trim();

function normalizeProjectUrl(value) {
    return String(value || '').trim().replace(/\/+$/, '');
}

function isValidProjectUrl(value) {
    try {
        const parsed = new URL(value);
        const safeProtocol = parsed.protocol === 'https:' ||
            (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname));
        return safeProtocol && ['/', ''].includes(parsed.pathname) && !parsed.search && !parsed.hash;
    } catch {
        return false;
    }
}

function keyRole(key) {
    const token = String(key || '');
    if (token.startsWith('sb_publishable_')) return 'publishable';
    try {
        const payload = token.split('.')[1];
        if (!payload) return '';
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(globalThis.atob(base64)).role || '';
    } catch {
        return '';
    }
}

const configuredKeyRole = keyRole(anonKey);

// Never bundle a service-role/secret key into the browser application.
export const isSupabaseConfigured = Boolean(
    isValidProjectUrl(url) &&
    anonKey &&
    (configuredKeyRole === 'anon' || configuredKeyRole === 'publishable')
);
export const supabaseConfigurationIssue = !url || !anonKey
    ? 'Enter your Supabase project URL and anon/publishable key in Database Setup.'
    : isSupabaseConfigured
        ? ''
            : !isValidProjectUrl(url)
            ? 'Enter a valid Supabase project URL. Hosted projects must use HTTPS.'
            : 'The configured key is not a public anon/publishable key. Never use service_role or secret keys in a browser.';

export const supabase = isSupabaseConfigured
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true }
    })
    : null;

export const supabaseProjectUrl = url;
export const supabasePublicKey = anonKey;
export const hasRuntimeSupabaseConfig = Boolean(runtimeConfig.url && runtimeConfig.anonKey);

export function validateSupabasePublicConfig(projectUrl, publicKey) {
    const cleanUrl = normalizeProjectUrl(projectUrl);
    const cleanKey = String(publicKey || '').trim();
    const role = keyRole(cleanKey);
    if (!isValidProjectUrl(cleanUrl)) {
        throw new Error('Enter a valid Supabase project URL. Hosted projects must use HTTPS.');
    }
    if (!cleanKey || !['anon', 'publishable'].includes(role)) {
        throw new Error('Use the Supabase anon public or publishable key. Secret and service_role keys are blocked.');
    }
    return { url: cleanUrl, anonKey: cleanKey };
}

export async function testSupabasePublicConfig(projectUrl, publicKey) {
    const config = validateSupabasePublicConfig(projectUrl, publicKey);
    const response = await fetch(`${config.url}/auth/v1/settings`, {
        headers: { apikey: config.anonKey }
    });
    if (!response.ok) {
        throw new Error(`Supabase returned HTTP ${response.status}. Check the project URL and public key.`);
    }
    return true;
}

export function saveRuntimeSupabaseConfig(projectUrl, publicKey) {
    const config = validateSupabasePublicConfig(projectUrl, publicKey);
    if (typeof window === 'undefined') throw new Error('Database setup is available in the browser only.');
    window.localStorage.setItem(RUNTIME_CONFIG_KEY, JSON.stringify(config));
}

export function clearRuntimeSupabaseConfig() {
    if (typeof window !== 'undefined') window.localStorage.removeItem(RUNTIME_CONFIG_KEY);
}

// Small helper so services can guard their calls in one place.
export function requireSupabase() {
    if (!supabase) {
        throw new Error(
            supabaseConfigurationIssue || 'Supabase is not configured.'
        );
    }
    return supabase;
}
