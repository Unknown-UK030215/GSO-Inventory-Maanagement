import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import AuthFrame from '../components/common/AuthFrame';
import { USER_ROLES } from '../data/userRoles';

// Entry screen shown to signed-out visitors at the site root. The user
// picks the role they are signing in as, then continues to that role's
// sign-in form. Signed-in users never see this — they go to their dashboard.
export default function Welcome() {
    const navigate = useNavigate();
    const [selectedRole, setSelectedRole] = useState('');

    function proceed() {
        if (!selectedRole) return;

        // Administrators have their own restricted sign-in flow.
        if (selectedRole === 'administrator') {
            navigate('/admin-login');
            return;
        }

        navigate('/login', { state: { role: selectedRole } });
    }

    return (
        <AuthFrame
            title="Welcome to GSO Inventory"
            description="Choose the position you are signing in as to open the right workspace."
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

                <button
                    type="button"
                    className={`role-choice administrator${selectedRole === 'administrator' ? ' selected' : ''}`}
                    aria-pressed={selectedRole === 'administrator'}
                    onClick={() => setSelectedRole('administrator')}
                >
                    <strong>Administrator</strong>
                    <small>System administration, oversight and data protection.</small>
                </button>
            </div>

            <button
                type="button"
                className="role-continue"
                disabled={!selectedRole}
                onClick={proceed}
            >
                Continue to Sign In
            </button>

            <p className="auth-switch">
                New staff member? <Link to="/register">Register</Link>
            </p>
        </AuthFrame>
    );
}
