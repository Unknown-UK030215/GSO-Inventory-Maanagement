import { Outlet } from 'react-router-dom';

import GSO_LOGO from '../../assets/GSO-Logo.jpeg';
import { useAuth } from '../../context/useAuth';
import { getRole } from '../../data/userRoles';
import GlobalSearch from './GlobalSearch';
import Sidebar from './Sidebar';
import UserMenu from './UserMenu';

export default function Layout() {
    const { user } = useAuth();
    const role = getRole(user?.role);

    return (
        <div className="shell">
            <Sidebar />
            <main>
                <header>
                    <div className="header-brand">
                        <img className="header-logo" src={GSO_LOGO} alt="General Services Office logo" />
                        <div className="header-title">GSO Inventory Management · {role.name}</div>
                    </div>
                    <div className="header-actions">
                        <GlobalSearch />
                        <span className="header-date">{new Date().toLocaleDateString()}</span>
                        <UserMenu />
                    </div>
                </header>
                <section className="content"><Outlet /></section>
                <footer>Municipal Government of El Nido · General Services Office</footer>
            </main>
        </div>
    );
}
