import { useState } from 'react';

import PageHeader from '../components/common/PageHeader';
import PasswordHint from '../components/common/PasswordHint';
import { useAuth } from '../context/useAuth';
import { SECURITY_QUESTIONS } from '../data/securityQuestions';
import { getRole } from '../data/userRoles';
import { isSupabaseConfigured } from '../lib/supabase';

export default function Profile() {
    const { user, updateProfile, changePassword, setRecoveryQuestion } = useAuth();
    const role = getRole(user?.role);

    const [form, setForm] = useState({
        displayName: user?.displayName || '',
        email: user?.email || '',
        phone: user?.phone || '',
        department: user?.department || '',
        designation: user?.designation || ''
    });
    const [profileStatus, setProfileStatus] = useState({ type: '', message: '' });
    const [savingProfile, setSavingProfile] = useState(false);

    const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
    const [passwordStatus, setPasswordStatus] = useState({ type: '', message: '' });
    const [savingPassword, setSavingPassword] = useState(false);

    const [recovery, setRecovery] = useState({
        question: user?.recoveryQuestion || '',
        answer: ''
    });
    const [recoveryStatus, setRecoveryStatus] = useState({ type: '', message: '' });
    const [savingRecovery, setSavingRecovery] = useState(false);

    function updateField(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    function updatePasswordField(field, value) {
        setPasswords(prev => ({ ...prev, [field]: value }));
    }

    function saveRecovery(event) {
        event.preventDefault();
        setRecoveryStatus({ type: '', message: '' });
        setSavingRecovery(true);
        setRecoveryQuestion(recovery.question, recovery.answer)
            .then(() => {
                setRecovery(prev => ({ ...prev, answer: '' }));
                setRecoveryStatus({ type: 'success', message: 'Recovery question saved.' });
            })
            .catch(err => setRecoveryStatus({
                type: 'error',
                message: err.message || 'Unable to save the recovery question.'
            }))
            .finally(() => setSavingRecovery(false));
    }

    async function saveProfile(event) {
        event.preventDefault();
        setProfileStatus({ type: '', message: '' });
        setSavingProfile(true);
        try {
            await updateProfile(form);
            setProfileStatus({ type: 'success', message: 'Profile details saved.' });
        } catch (err) {
            setProfileStatus({ type: 'error', message: err.message || 'Unable to save your profile.' });
        } finally {
            setSavingProfile(false);
        }
    }

    function savePassword(event) {
        event.preventDefault();
        setPasswordStatus({ type: '', message: '' });

        if (passwords.next !== passwords.confirm) {
            setPasswordStatus({ type: 'error', message: 'The new passwords do not match.' });
            return;
        }

        setSavingPassword(true);
        changePassword(passwords.current, passwords.next)
            .then(() => {
                setPasswords({ current: '', next: '', confirm: '' });
                setPasswordStatus({ type: 'success', message: 'Password updated.' });
            })
            .catch(err => setPasswordStatus({
                type: 'error',
                message: err.message || 'Unable to update the password.'
            }))
            .finally(() => setSavingPassword(false));
    }

    return (
        <>
            <PageHeader
                title="Profile Settings"
                description="Manage your account details and password."
            />
            <div className="profile-grid">
                <section className="panel">
                    <h2 className="panel-title">Account Details</h2>
                    <form className="form-grid" onSubmit={saveProfile}>
                        <label>
                            Full Name
                            <input
                                autoComplete="name"
                                value={form.displayName}
                                onChange={event => updateField('displayName', event.target.value)}
                                required
                            />
                        </label>
                        <label>
                            Email Address
                            <input
                                type="email"
                                autoComplete="email"
                                placeholder="name@elnido.gov.ph"
                                value={form.email}
                                onChange={event => updateField('email', event.target.value)}
                                readOnly={isSupabaseConfigured}
                                required
                            />
                            {isSupabaseConfigured && (
                                <small className="form-note">Sign-in email is verified and managed by Supabase Auth.</small>
                            )}
                        </label>
                        <label>
                            Phone Number
                            <input
                                autoComplete="tel"
                                placeholder="09XX XXX XXXX"
                                value={form.phone}
                                onChange={event => updateField('phone', event.target.value)}
                            />
                        </label>
                        <label>
                            Department / Office
                            <input
                                placeholder="General Services Office"
                                value={form.department}
                                onChange={event => updateField('department', event.target.value)}
                            />
                        </label>
                        <label>
                            Designation
                            <input
                                placeholder="e.g. Property Custodian"
                                value={form.designation}
                                onChange={event => updateField('designation', event.target.value)}
                            />
                        </label>
                        <label>
                            Position
                            <input value={role.name} readOnly />
                        </label>
                        <label>
                            Username
                            <input value={user?.username || ''} readOnly />
                        </label>
                        <div className="profile-actions">
                            {profileStatus.message && (
                                <p className={`form-status ${profileStatus.type}`} role="status">
                                    {profileStatus.message}
                                </p>
                            )}
                            <button type="submit" disabled={savingProfile}>
                                {savingProfile ? 'Saving…' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </section>

                <section className="panel">
                    <h2 className="panel-title">Change Password</h2>
                    <form className="form-grid" onSubmit={savePassword}>
                        <label className="span-2">
                            Current Password
                            <input
                                type="password"
                                autoComplete="current-password"
                                value={passwords.current}
                                onChange={event => updatePasswordField('current', event.target.value)}
                                required
                            />
                        </label>
                        <label className="span-2">
                            New Password
                            <input
                                type="password"
                                autoComplete="new-password"
                                minLength="8"
                                value={passwords.next}
                                onChange={event => updatePasswordField('next', event.target.value)}
                                required
                            />
                        </label>
                        <PasswordHint password={passwords.next} username={user?.username} />
                        <label className="span-2">
                            Confirm New Password
                            <input
                                type="password"
                                autoComplete="new-password"
                                minLength="8"
                                value={passwords.confirm}
                                onChange={event => updatePasswordField('confirm', event.target.value)}
                                required
                            />
                        </label>
                        <div className="profile-actions">
                            {passwordStatus.message && (
                                <p className={`form-status ${passwordStatus.type}`} role="status">
                                    {passwordStatus.message}
                                </p>
                            )}
                            <button type="submit" disabled={savingPassword}>
                                {savingPassword ? 'Updating…' : 'Update Password'}
                            </button>
                        </div>
                    </form>
                </section>

                {!isSupabaseConfigured && (
                    <section className="panel span-2">
                        <h2 className="panel-title">Recovery Question</h2>
                        <p className="panel-note">
                            Pick a question only you can answer. The response is stored as a salted hash.
                        </p>
                        <form className="form-grid" onSubmit={saveRecovery}>
                            <label className="span-2">
                                Recovery Question
                                <select
                                    value={recovery.question}
                                    onChange={event => setRecovery(prev => ({ ...prev, question: event.target.value }))}
                                    required
                                >
                                    <option value="" disabled>Select a question…</option>
                                    {SECURITY_QUESTIONS.map(question => (
                                        <option key={question} value={question}>{question}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="span-2">
                                Recovery Answer
                                <input
                                    autoComplete="off"
                                    value={recovery.answer}
                                    onChange={event => setRecovery(prev => ({ ...prev, answer: event.target.value }))}
                                    required
                                />
                            </label>
                            <div className="profile-actions">
                                {recoveryStatus.message && (
                                    <p className={`form-status ${recoveryStatus.type}`} role="status">
                                        {recoveryStatus.message}
                                    </p>
                                )}
                                <button type="submit" disabled={savingRecovery}>
                                    {savingRecovery ? 'Saving…' : 'Save Recovery Question'}
                                </button>
                            </div>
                        </form>
                    </section>
                )}
            </div>
        </>
    );
}
