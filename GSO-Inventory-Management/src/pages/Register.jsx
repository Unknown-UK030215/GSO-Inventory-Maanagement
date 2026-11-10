import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import AuthFrame from '../components/common/AuthFrame';
import { useAuth } from '../context/useAuth';
import { USER_ROLES } from '../data/userRoles';

export default function Register() {
    const { user, register } = useAuth();
    const navigate = useNavigate();
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [role, setRole] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    if (user) {
        return <AuthFrame title="Already signed in" description="Your inventory workspace is ready.">
            <button type="button" onClick={() => navigate('/', { replace: true })}>Open Dashboard</button>
        </AuthFrame>;
    }

    async function submit(event) {
        event.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('The passwords do not match.');
            return;
        }

        setBusy(true);
        try {
            await register({ displayName, username, password, role });
            navigate('/', { replace: true });
        } catch (err) {
            setError(err.message || 'Unable to create the account.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <AuthFrame
            title="Create staff account"
            description="Create a local account for this browser."
        >
            <form className="auth-form" onSubmit={submit}>
                <label>
                    Full Name
                    <input
                        autoComplete="name"
                        autoFocus
                        value={displayName}
                        onChange={event => setDisplayName(event.target.value)}
                        required
                    />
                </label>
                <label>
                    Username
                    <input
                        autoComplete="username"
                        minLength="3"
                        value={username}
                        onChange={event => setUsername(event.target.value)}
                        required
                    />
                </label>
                <label>
                    Position
                    <select value={role} onChange={event => setRole(event.target.value)} required>
                        <option value="">Select your position…</option>
                        {USER_ROLES.map(item => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                    </select>
                </label>
                <label>
                    Password
                    <input
                        type="password"
                        autoComplete="new-password"
                        minLength="8"
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                        required
                    />
                </label>
                <label>
                    Confirm Password
                    <input
                        type="password"
                        autoComplete="new-password"
                        minLength="8"
                        value={confirmPassword}
                        onChange={event => setConfirmPassword(event.target.value)}
                        required
                    />
                </label>
                {error && <p className="auth-error" role="alert">{error}</p>}
                <button type="submit" disabled={busy}>
                    {busy ? 'Creating account…' : 'Create Account'}
                </button>
            </form>
            <p className="auth-switch">
                Already registered? <Link to="/login">Sign in</Link>
            </p>
        </AuthFrame>
    );
}
