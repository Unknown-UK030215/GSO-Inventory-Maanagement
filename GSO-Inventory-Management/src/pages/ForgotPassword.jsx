import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import AuthFrame from '../components/common/AuthFrame';
import PasswordHint from '../components/common/PasswordHint';
import { useAuth } from '../context/useAuth';
import { isSupabaseConfigured } from '../lib/supabase';

// Supabase Auth verifies a recovery OTP before accepting a new password.
// The local-only prototype keeps its security-question fallback.
export default function ForgotPassword() {
    const {
        requestPasswordReset,
        verifyPasswordResetOtp,
        resetPassword,
        completePasswordReset
    } = useAuth();
    const navigate = useNavigate();

    const [stage, setStage] = useState('identify');
    const [email, setEmail] = useState('');
    const [accountUsername, setAccountUsername] = useState('');
    const [otp, setOtp] = useState('');
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);

    async function findAccount(event) {
        event.preventDefault();
        setError('');
        setNotice('');
        setBusy(true);

        try {
            const found = await requestPasswordReset(email);
            if (isSupabaseConfigured) {
                setStage('otp');
                return;
            }
            setQuestion(found.question);
            setAccountUsername(found.username);
            setStage('verify');
        } catch (err) {
            setError(err.message || 'Unable to start the reset.');
        } finally {
            setBusy(false);
        }
    }

    async function verifyOtp(event) {
        event.preventDefault();
        setError('');
        setBusy(true);
        try {
            const verifiedUser = await verifyPasswordResetOtp(email, otp);
            setAccountUsername(verifiedUser.username);
            setStage('password');
        } catch (err) {
            setError(err.message || 'Unable to verify the OTP.');
        } finally {
            setBusy(false);
        }
    }

    async function submitReset(event) {
        event.preventDefault();
        setError('');

        if (next !== confirm) {
            setError('The new passwords do not match.');
            return;
        }

        setBusy(true);
        try {
            if (isSupabaseConfigured) {
                await completePasswordReset(next);
            } else {
                await resetPassword({ username: accountUsername, answer, newPassword: next });
            }
            setStage('done');
        } catch (err) {
            setError(err.message || 'Unable to reset the password.');
        } finally {
            setBusy(false);
        }
    }

    if (stage === 'done') {
        return (
            <AuthFrame
                title="Password reset"
                description="Your password has been changed. You can sign in with it now."
            >
                <button type="button" onClick={() => navigate('/login', { replace: true })}>
                    Return to sign in
                </button>
            </AuthFrame>
        );
    }

    if (stage === 'otp') {
        return (
            <AuthFrame
                title="Enter your email OTP"
                description={`If an account uses ${email}, enter the one-time code sent there.`}
            >
                <form className="auth-form" onSubmit={verifyOtp}>
                    <label>
                        One-Time Password
                        <input
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            autoFocus
                            value={otp}
                            onChange={event => setOtp(event.target.value.replace(/\s/g, ''))}
                            required
                        />
                    </label>
                    {error && <p className="auth-error" role="alert">{error}</p>}
                    {notice && <p className="form-status success" role="status">{notice}</p>}
                    <button type="submit" disabled={busy}>
                        {busy ? 'Verifying…' : 'Verify OTP'}
                    </button>
                    <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={async () => {
                            setError('');
                            setNotice('');
                            setBusy(true);
                            try {
                                await requestPasswordReset(email);
                                setOtp('');
                                setNotice('A new code has been requested. Check your email if the account exists.');
                            } catch (err) {
                                setError(err.message || 'Unable to resend the OTP.');
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        Resend OTP
                    </button>
                </form>
                <p className="auth-switch">
                    <button type="button" className="link-button" onClick={() => {
                        setStage('identify');
                        setOtp('');
                        setError('');
                    }}>
                        Use a different email address
                    </button>
                </p>
            </AuthFrame>
        );
    }

    if (stage === 'identify') {
        return (
            <AuthFrame
                title="Forgot password"
                description="Enter the email address on your account to continue."
            >
                <form className="auth-form" onSubmit={findAccount}>
                    <label>
                        Email Address
                        <input
                            type="email"
                            autoComplete="email"
                            autoFocus
                            value={email}
                            onChange={event => setEmail(event.target.value)}
                            required
                        />
                    </label>
                    {error && <p className="auth-error" role="alert">{error}</p>}
                    <button type="submit" disabled={busy}>
                        {busy ? 'Checking…' : 'Continue'}
                    </button>
                </form>
                <p className="auth-switch">
                    Remembered it? <Link to="/login">Sign in</Link>
                </p>
            </AuthFrame>
        );
    }

    if (stage === 'password') {
        return (
            <AuthFrame
                title="Choose a new password"
                description="Your OTP verified the account. Set a new password to finish recovery."
            >
                <form className="auth-form" onSubmit={submitReset}>
                    <label>
                        New Password
                        <input
                            type="password"
                            autoComplete="new-password"
                            autoFocus
                            value={next}
                            onChange={event => setNext(event.target.value)}
                            required
                        />
                    </label>
                    <PasswordHint password={next} username={accountUsername} />
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
                        {busy ? 'Resetting…' : 'Change Password'}
                    </button>
                </form>
            </AuthFrame>
        );
    }

    return (
        <AuthFrame
            title="Reset your password"
            description="Answer your account recovery question."
        >
            <form className="auth-form" onSubmit={submitReset}>
                <label>
                    Recovery Question
                    <input value={question} readOnly />
                </label>
                <label>
                    Your Answer
                    <input
                        autoFocus
                        autoComplete="off"
                        value={answer}
                        onChange={event => setAnswer(event.target.value)}
                        required
                    />
                </label>
                <label>
                    New Password
                    <input
                        type="password"
                        autoComplete="new-password"
                        value={next}
                        onChange={event => setNext(event.target.value)}
                        required
                    />
                </label>
                <PasswordHint password={next} username={accountUsername} />
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
                    {busy ? 'Resetting…' : 'Reset Password'}
                </button>
            </form>
            <p className="auth-switch">
                <button type="button" className="link-button" onClick={() => {
                    setStage('identify');
                    setAnswer('');
                    setNext('');
                    setConfirm('');
                    setError('');
                }}>
                    Use a different email address
                </button>
            </p>
        </AuthFrame>
    );
}
