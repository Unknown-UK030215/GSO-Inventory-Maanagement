import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AuthFrame from '../components/common/AuthFrame';
import { useAuth } from '../context/useAuth';
import { isAdminRole } from '../data/userRoles';

// Hidden administrator sign-in. This route is not linked from anywhere in
// the public UI — it is reached only by knowing the /admin-login path.
export default function AdminLogin() {
    const { user, loginAdmin } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    if (isAdminRole(user?.role)) {
        return (
            <AuthFrame title="Administrator session active" description={`Signed in as ${user.displayName}.`}>
                <button type="button" onClick={() => navigate('/', { replace: true })}>Open Dashboard</button>
            </AuthFrame>
        );
    }

    if (user) {
        return (
            <AuthFrame title="Restricted area" description="A non-administrator is already signed in on this browser.">
                <p className="auth-description">Sign out of the current session before using administrator access.</p>
                <button type="button" onClick={() => navigate('/login', { replace: true })}>Go to sign-in</button>
            </AuthFrame>
        );
    }

    async function submit(event) {
        event.preventDefault();
        setError('');
        setBusy(true);

        try {
            await loginAdmin(username, password);
            navigate('/', { replace: true });
        } catch (err) {
            setError(err.message || 'Unable to sign in.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <AuthFrame
            title="Administrator Access"
            description="Restricted sign-in for administrators only."
        >
            <form className="auth-form" onSubmit={submit}>
                <label>
                    Administrator Username
                    <input
                        autoComplete="off"
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
                        autoComplete="off"
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                        required
                    />
                </label>
                {error && <p className="auth-error" role="alert">{error}</p>}
                <button type="submit" disabled={busy}>
                    {busy ? 'Verifying…' : 'Enter Admin Console'}
                </button>
            </form>
        </AuthFrame>
    );
}
