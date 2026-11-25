import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import Layout from './components/layout/Layout';
import { useAuth } from './context/useAuth';
import { canAccessPath, isAdminRole } from './data/userRoles';
import Assets from './pages/Assets';
import AdminLogin from './pages/AdminLogin';
import Backup from './pages/Backup';
import Chat from './pages/Chat';
import Clearance from './pages/Clearance';
import Dashboard from './pages/Dashboard';
import DatabaseSetup from './pages/DatabaseSetup';
import DisposalMissing from './pages/DisposalMissing';
import Feedback from './pages/Feedback';
import Forms from './pages/Forms';
import ForgotPassword from './pages/ForgotPassword';
import Generic from './pages/Generic';
import Login from './pages/Login';
import Maintenance from './pages/Maintenance';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import PurchasingReceiving from './pages/PurchasingReceiving';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import Rpci from './pages/Rpci';
import Welcome from './pages/Welcome';

function ProtectedRoutes() {
    const { user, authLoading } = useAuth();
    const location = useLocation();

    if (authLoading) return <div className="auth-shell"><p>Checking your session…</p></div>;
    if (user) return <Outlet />;

    // Signed-out visitors start on the welcome/role picker at the site root.
    if (location.pathname === '/') return <Welcome />;

    return <Navigate to="/login" replace state={{ from: location }} />;
}

function RolePage({ path, children }) {
    const { user } = useAuth();
    return canAccessPath(user?.role, path)
        ? children
        : <Navigate to="/" replace />;
}

// Administrator-only pages (data backup is restricted to admin accounts).
function AdminPage({ children }) {
    const { user } = useAuth();
    return isAdminRole(user?.role)
        ? children
        : <Navigate to="/" replace />;
}

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/database-setup" element={<DatabaseSetup />} />
            {/* Hidden administrator sign-in — intentionally not linked in the public UI. */}
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route element={<ProtectedRoutes />}>
                <Route element={<Layout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/profile" element={<Profile />} />
                    {/* Feedback & bug reporting is available to every role. */}
                    <Route path="/feedback" element={<Feedback />} />
                    {/* System announcements broadcast by the super administrator. */}
                    <Route path="/notifications" element={<Notifications />} />
                    {/* Role chat is shared by every account with the same role. */}
                    <Route path="/chat" element={<Chat />} />
                    <Route path="/assets" element={<RolePage path="/assets"><Assets /></RolePage>} />
                    <Route path="/disposal" element={<RolePage path="/disposal"><DisposalMissing /></RolePage>} />
                    <Route path="/forms" element={<RolePage path="/forms"><Forms /></RolePage>} />
                    <Route path="/purchasing" element={<RolePage path="/purchasing"><PurchasingReceiving /></RolePage>} />
                    <Route path="/rpci" element={<RolePage path="/rpci"><Rpci /></RolePage>} />
                    <Route path="/maintenance" element={<RolePage path="/maintenance"><Maintenance /></RolePage>} />
                    <Route path="/clearance" element={<RolePage path="/clearance"><Clearance /></RolePage>} />
                    {/* Data backup & restore is restricted to administrator accounts. */}
                    <Route path="/backup" element={<AdminPage><Backup /></AdminPage>} />
                    {[
                        'physical-inventory',
                        'assignments',
                        'transfers',
                        'inspection',
                        'departments',
                        'reports',
                        'activity-logs'
                    ].map(page => (
                        <Route
                            key={page}
                            path={`/${page}`}
                            element={
                                <RolePage path={`/${page}`}>
                                    <Generic page={page} />
                                </RolePage>
                            }
                        />
                    ))}
                </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
