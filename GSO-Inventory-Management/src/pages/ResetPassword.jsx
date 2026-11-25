import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import AuthFrame from '../components/common/AuthFrame';
import PasswordHint from '../components/common/PasswordHint';
import { useAuth } from '../context/useAuth';
import { isSupabaseConfigured } from '../lib/supabase';

export default function ResetPassword() {
    const { user, authLoading, completePasswordReset } = useAuth();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [complete, setComplete] = useState(false);

    async function submit(event) {
        event.preventDefault();
        setError('');
        if (password !== confirm) {
            setError('The new passwords do not match.');
            return;
        }

        setBusy(true);
        try {
            await completePasswordReset(password);
            setComplete(true);
        } catch (err) {
            setError(err.message || 'Unable to update the password.');
        } finally {
            setBusy(false);
        }
    }

    if (!isSupabaseConfigured) {
        return (
            <AuthFrame title="Supabase unavailable" description="Password reset links require the database connection.">
                <Link to="/login">Return to sign in</Link>
            </AuthFrame>
        );
    }

    if (authLoading) {
        return <AuthFrame title="Verifying reset link" description="Checking the secure recovery session…" />;
    }

    if (complete) {
        return (
            <AuthFrame title="Password updated" description="Your password has been changed successfully.">
                <button type="button" onClick={() => navigate('/login', { replace: true })}>
                    Return to sign in
                </button>
            </AuthFrame>
        );
    }

    if (!user) {
        return (
            <AuthFrame
                title="Reset link expired"
                description="This password reset link is invalid or has expired. Request a new link to continue."
            >
                <Link to="/forgot-password">Request another reset link</Link>
            </AuthFrame>
        );
    }

    return (
        <AuthFrame title="Choose a new password" description="Set a new password for your account.">
            <form className="auth-form" onSubmit={submit}>
                <label>
                    New Password
                    <input
                        type="password"
                        autoComplete="new-password"
                        autoFocus
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                        required
                    />
                </label>
                <PasswordHint password={password} username={user.username} />
                <label>
                    Confirm New Password
                    <input
                        type="password"
                        autoComplete="new-password"
                        value={confirm}
                        onChange={event => setConfirm(event.target.value)}
                        required
                    />
                </label>
                {error && <p className="auth-error" role="alert">{error}</p>}
                <button type="submit" disabled={busy}>
                    {busy ? 'Updating…' : 'Update Password'}
                </button>
            </form>
        </AuthFrame>
    );
}
