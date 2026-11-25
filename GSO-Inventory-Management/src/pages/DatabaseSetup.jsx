import { useState } from 'react';
import { Link } from 'react-router-dom';

import AuthFrame from '../components/common/AuthFrame';
import {
    clearRuntimeSupabaseConfig,
    hasRuntimeSupabaseConfig,
    isSupabaseConfigured,
    saveRuntimeSupabaseConfig,
    supabaseProjectUrl,
    supabasePublicKey,
    testSupabasePublicConfig
} from '../lib/supabase';

export default function DatabaseSetup() {
    const [projectUrl, setProjectUrl] = useState(supabaseProjectUrl || '');
    const [publicKey, setPublicKey] = useState(supabasePublicKey || '');
    const [verifiedConfig, setVerifiedConfig] = useState('');
    const [status, setStatus] = useState({ type: '', message: '' });
    const [busy, setBusy] = useState(false);

    const configFingerprint = `${projectUrl.trim()}|${publicKey.trim()}`;

    async function testConnection(event) {
        event.preventDefault();
        setStatus({ type: '', message: '' });
        setVerifiedConfig('');
        setBusy(true);
        try {
            await testSupabasePublicConfig(projectUrl, publicKey);
            setVerifiedConfig(configFingerprint);
            setStatus({
                type: 'success',
                message: 'Supabase project is reachable with this public key.'
            });
        } catch (error) {
            setStatus({ type: 'error', message: error.message || 'Unable to connect to Supabase.' });
        } finally {
            setBusy(false);
        }
    }

    function saveAndConnect() {
        setStatus({ type: '', message: '' });
        try {
            if (verifiedConfig !== configFingerprint) {
                throw new Error('Test the current URL and key before saving them.');
            }
            saveRuntimeSupabaseConfig(projectUrl, publicKey);
            setStatus({ type: 'success', message: 'Configuration saved. Reloading the app…' });
            window.location.reload();
        } catch (error) {
            setStatus({ type: 'error', message: error.message || 'Unable to save configuration.' });
        }
    }

    function clearBrowserConfig() {
        clearRuntimeSupabaseConfig();
        window.location.reload();
    }

    return (
        <AuthFrame
            className="database-setup-card"
            shellClassName="database-setup-shell"
            title="Database Setup"
            description="Connect this browser to your Supabase project using its public client key."
        >
            <form className="auth-form" onSubmit={testConnection}>
                <label>
                    Supabase Project URL
                    <input
                        type="url"
                        placeholder="https://your-project.supabase.co"
                        value={projectUrl}
                        onChange={event => {
                            setProjectUrl(event.target.value);
                            setVerifiedConfig('');
                            setStatus({ type: '', message: '' });
                        }}
                        required
                    />
                </label>
                <label>
                    Supabase Anon Public / Publishable Key
                    <input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Paste the public anon or publishable key"
                        value={publicKey}
                        onChange={event => {
                            setPublicKey(event.target.value);
                            setVerifiedConfig('');
                            setStatus({ type: '', message: '' });
                        }}
                        required
                    />
                </label>
                <small className="password-hint">
                    Never enter a service_role or secret key here. The URL should not end in /rest/v1.
                </small>
                {status.message && (
                    <p className={status.type === 'error' ? 'auth-error' : 'form-status success'} role="status">
                        {status.message}
                    </p>
                )}
                <button type="submit" disabled={busy}>
                    {busy ? 'Testing connection…' : 'Test Supabase Connection'}
                </button>
                <button
                    type="button"
                    className="secondary"
                    disabled={!verifiedConfig || busy}
                    onClick={saveAndConnect}
                >
                    Save and Connect This Browser
                </button>
            </form>

            <section className="database-setup-notes">
                <h2>Database Schema</h2>
                <ol>
                    <li>Open the Supabase Dashboard for this project and select SQL Editor.</li>
                    <li>Open <code>supabase/schema.sql</code> in the project workspace, then run the complete script.</li>
                    <li>Enable email confirmation and set the Reset Password email template to include <code>{'{{ .Token }}'}</code> for OTP recovery.</li>
                    <li>Create administrator accounts in Supabase Auth and assign their roles using the instructions in <code>supabase/SETUP.md</code>.</li>
                </ol>
                <p>
                    The URL and public key are stored only in this browser. They are not sent to another account or saved in the database.
                </p>
                {isSupabaseConfigured && (
                    <p className="database-setup-connected" role="status">
                        A valid public key is currently configured in this browser.
                    </p>
                )}
            </section>

            <div className="auth-switch">
                <Link to="/login">Return to sign in</Link>
                {hasRuntimeSupabaseConfig && (
                    <>
                        {' · '}
                        <button type="button" className="link-button" onClick={clearBrowserConfig}>
                            Clear browser override
                        </button>
                    </>
                )}
            </div>
        </AuthFrame>
    );
}
