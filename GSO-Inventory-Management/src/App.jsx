import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import Layout from './components/layout/Layout';
import { useAuth } from './context/useAuth';
import { canAccessPath } from './data/userRoles';
import Assets from './pages/Assets';
import Dashboard from './pages/Dashboard';
import DisposalMissing from './pages/DisposalMissing';
import Forms from './pages/Forms';
import Generic from './pages/Generic';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Register from './pages/Register';

function ProtectedRoutes() {
    const { user } = useAuth();
    const location = useLocation();

    return user
        ? <Outlet />
        : <Navigate to="/login" replace state={{ from: location }} />;
}

function RolePage({ path, children }) {
    const { user } = useAuth();
    return canAccessPath(user?.role, path)
        ? children
        : <Navigate to="/" replace />;
}

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<ProtectedRoutes />}>
                <Route element={<Layout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/assets" element={<RolePage path="/assets"><Assets /></RolePage>} />
                    <Route path="/disposal" element={<RolePage path="/disposal"><DisposalMissing /></RolePage>} />
                    <Route path="/forms" element={<RolePage path="/forms"><Forms /></RolePage>} />
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
