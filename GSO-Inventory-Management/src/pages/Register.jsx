import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import AuthFrame from '../components/common/AuthFrame';
import PasswordHint from '../components/common/PasswordHint';
import { useAuth } from '../context/useAuth';
import { SECURITY_QUESTIONS } from '../data/securityQuestions';
import { USER_ROLES } from '../data/userRoles';
import { isSupabaseConfigured } from '../lib/supabase';

export default function Register() {
    const { user, register } = useAuth();
    const navigate = useNavigate();
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [securityQuestion, setSecurityQuestion] = useState('');
    const [securityAnswer, setSecurityAnswer] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
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
            const result = await register({ displayName, username, email, password, role, securityQuestion, securityAnswer });
            if (result?.confirmationRequired) {
                setNotice('Account created. Check your email and confirm the address before signing in.');
                return;
            }
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
            description={isSupabaseConfigured
                ? 'Create your account. You may need to confirm your email before signing in.'
                : 'Create a local account for this browser.'}
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
                    Email Address
                    <input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={event => setEmail(event.target.value)}
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
                <PasswordHint password={password} username={username} />
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
                {!isSupabaseConfigured && (
                    <>
                        <label>
                            Recovery Question
                            <select
                                value={securityQuestion}
                                onChange={event => setSecurityQuestion(event.target.value)}
                                required
                            >
                                <option value="">Choose a question…</option>
                                {SECURITY_QUESTIONS.map(q => (
                                    <option key={q} value={q}>{q}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Recovery Answer
                            <input
                                autoComplete="off"
                                value={securityAnswer}
                                onChange={event => setSecurityAnswer(event.target.value)}
                                required
                            />
                        </label>
                        <small className="password-hint">
                            Your answer is used only to reset a forgotten password.
                        </small>
                    </>
                )}
                {error && <p className="auth-error" role="alert">{error}</p>}
                {notice && <p className="form-status success" role="status">{notice}</p>}
                <button type="submit" disabled={busy}>
                    {busy ? 'Creating account…' : 'Create Account'}
                </button>
            </form>
            <p className="auth-switch">
                Already registered? <Link to="/login">Sign in</Link>
            </p>
            <p className="auth-switch">
                <Link to="/database-setup">Database Setup</Link>
            </p>
        </AuthFrame>
    );
}
