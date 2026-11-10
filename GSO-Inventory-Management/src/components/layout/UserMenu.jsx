import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/useAuth';

function getInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const first = parts[0][0];
    const second = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + second).toUpperCase();
}

export default function UserMenu() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;

        function handlePointer(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setOpen(false);
            }
        }
        function handleKey(event) {
            if (event.key === 'Escape') setOpen(false);
        }

        document.addEventListener('mousedown', handlePointer);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handlePointer);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open]);

    const name = user?.displayName || user?.username || 'Inventory Staff';

    function signOut() {
        setOpen(false);
        logout();
        navigate('/login', { replace: true });
    }

    return (
        <div className="user-menu" ref={menuRef}>
            <button
                type="button"
                className="user-menu-trigger"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(value => !value)}
            >
                <span className="user-avatar" aria-hidden="true">{getInitials(name)}</span>
                <span className="user-menu-name">{name}</span>
                <span className={`user-caret${open ? ' open' : ''}`} aria-hidden="true">▾</span>
            </button>

            {open && (
                <div className="user-menu-panel" role="menu">
                    <div className="user-menu-head">
                        <strong>{name}</strong>
                        <small>{user?.email || user?.username || 'No email on file'}</small>
                    </div>
                    <Link
                        to="/profile"
                        role="menuitem"
                        className="user-menu-item"
                        onClick={() => setOpen(false)}
                    >
                        Profile Settings
                    </Link>
                    <button type="button" role="menuitem" className="user-menu-item danger" onClick={signOut}>
                        Sign Out
                    </button>
                </div>
            )}
        </div>
    );
}
