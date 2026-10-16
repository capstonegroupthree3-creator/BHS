import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Children from './pages/Children';
import PregnantWomen from './pages/PregnantWomen';
import PriorityList from './pages/PriorityList';
import DiseaseTrends from './pages/DiseaseTrends';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import Programs from './pages/Programs';
import Users from './pages/Users';
import Seniors from './pages/Seniors';
import Settings from './pages/Settings';
import Parents from './pages/Parents';



import Vaccinations from './pages/Vaccinations';
import Analytics from './pages/Analytics';
import Barangays from './pages/Barangays';
import Personnel from './pages/Personnel';

// ── ROUTE GUARD ──
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: string[];
}> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Redirect parents away from Dashboard / Pregnant Women to Children
  if (user?.role === 'parent' && (allowedRoles && !allowedRoles.includes('parent'))) {
    return <Navigate to="/children" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'parent' ? '/children' : '/'} replace />;
  }

  return <Layout>{children}</Layout>;
};

// ── APP ──
const AppRoutes: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={user?.role === 'parent' ? '/children' : '/'} replace /> : <Login />}
      />

      {/* SHARED / ALL USER ACCESSIBLE ROUTES */}
      <Route path="/children" element={<ProtectedRoute><Children /></ProtectedRoute>} />
      <Route path="/programs" element={<ProtectedRoute><Programs /></ProtectedRoute>} />
      <Route path="/vaccinations" element={<ProtectedRoute><Vaccinations /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

      {/* HEALTH PERSONNEL & ADMIN ONLY */}
      <Route path="/" element={<ProtectedRoute allowedRoles={['admin', 'health_personnel']}><Dashboard /></ProtectedRoute>} />
      <Route path="/pregnant" element={<ProtectedRoute allowedRoles={['admin', 'health_personnel']}><PregnantWomen /></ProtectedRoute>} />
      <Route path="/seniors" element={<ProtectedRoute allowedRoles={['admin', 'health_personnel']}><Seniors /></ProtectedRoute>} />
      <Route path="/priority" element={<ProtectedRoute allowedRoles={['admin', 'health_personnel']}><PriorityList /></ProtectedRoute>} />
      <Route path="/trends" element={<ProtectedRoute allowedRoles={['admin', 'health_personnel']}><DiseaseTrends /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute allowedRoles={['admin', 'health_personnel']}><Analytics /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin', 'health_personnel']}><Reports /></ProtectedRoute>} />
      <Route path="/parents" element={<ProtectedRoute allowedRoles={['admin', 'health_personnel']}><Parents /></ProtectedRoute>} />

      {/* ADMIN ONLY */}
      <Route path="/barangays" element={<ProtectedRoute allowedRoles={['admin']}><Barangays /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><Users /></ProtectedRoute>} />
      <Route path="/personnel" element={<ProtectedRoute allowedRoles={['admin']}><Personnel /></ProtectedRoute>} />
      <Route path="/audit" element={<ProtectedRoute allowedRoles={['admin']}><AuditLogs /></ProtectedRoute>} />

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to={user?.role === 'parent' ? '/children' : '/'} replace />} />
    </Routes>
  );
};

import { ThemeLanguageProvider } from './context/ThemeLanguageContext';

const App: React.FC = () => (
  <ThemeLanguageProvider>
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  </ThemeLanguageProvider>
);

export default App;
