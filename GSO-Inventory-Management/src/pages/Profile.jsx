import { useState } from 'react';

import PageHeader from '../components/common/PageHeader';
import { useAuth } from '../context/useAuth';
import { getRole } from '../data/userRoles';

export default function Profile() {
    const { user, updateProfile, changePassword } = useAuth();
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

    function updateField(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    function updatePasswordField(field, value) {
        setPasswords(prev => ({ ...prev, [field]: value }));
    }

    function saveProfile(event) {
        event.preventDefault();
        setProfileStatus({ type: '', message: '' });
        setSavingProfile(true);
        try {
            updateProfile(form);
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
                            />
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
            </div>
        </>
    );
}
