import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import AuthFrame from '../components/common/AuthFrame';
import { useAuth } from '../context/useAuth';
import { USER_ROLES } from '../data/userRoles';

export default function Login() {
    const { user, login } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [selectedRole, setSelectedRole] = useState('');
    const [loginRole, setLoginRole] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const role = USER_ROLES.find(item => item.id === loginRole);

    if (user) {
        return <AuthFrame title="Already signed in" description="Your inventory workspace is ready.">
            <button type="button" onClick={() => navigate('/', { replace: true })}>Open Dashboard</button>
        </AuthFrame>;
    }

    if (!role) {
        return (
            <AuthFrame
                title="Choose your position"
                description="Select the workspace you need before signing in."
            >
                <div className="role-choices">
                    {USER_ROLES.map(item => (
                        <button
                            type="button"
                            key={item.id}
                            className={`role-choice${selectedRole === item.id ? ' selected' : ''}`}
                            aria-pressed={selectedRole === item.id}
                            onClick={() => setSelectedRole(item.id)}
                        >
                            <strong>{item.name}</strong>
                            <small>{item.description}</small>
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className="role-continue"
                    disabled={!selectedRole}
                    onClick={() => setLoginRole(selectedRole)}
                >
                    Continue to Login
                </button>
                <p className="auth-switch">
                    New staff member? <Link to="/register">Register</Link>
                </p>
            </AuthFrame>
        );
    }

    async function submit(event) {
        event.preventDefault();
        setError('');
        setBusy(true);

        try {
            await login(username, password, loginRole);
            navigate(location.state?.from?.pathname || '/', { replace: true });
        } catch (err) {
            setError(err.message || 'Unable to sign in.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <AuthFrame
            title={`Sign in · ${role.name}`}
            description={`Enter your credentials for the ${role.name} workspace.`}
        >
            <button type="button" className="role-back" onClick={() => {
                setLoginRole('');
                setError('');
                setPassword('');
            }}>
                ← Choose a different position
            </button>
            <form className="auth-form" onSubmit={submit}>
                <label>
                    Username
                    <input
                        autoComplete="username"
                        autoFocus
                        value={username}
                        onChange={event => setUsername(event.target.value)}
                        required
                    />
                </label>
                <label>
                    Password
                    <input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                        required
                    />
                </label>
                {error && <p className="auth-error" role="alert">{error}</p>}
                <button type="submit" disabled={busy}>
                    {busy ? 'Signing in…' : 'Sign In'}
                </button>
            </form>
        </AuthFrame>
    );
}
