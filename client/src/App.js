import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import LoginPage from './pages/LoginPage';
import CompleteProfilePage from './pages/CompleteProfilePage';
import DonorDashboard from './pages/DonorDashboard';
import FoodPostForm from './pages/FoodPostForm';
import DonorTrackPage from './pages/DonorTrackPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/AdminDashboard';
import AdminRequests from './pages/AdminRequests';
import AdminUsers from './pages/AdminUsers';
import AdminTracking from './pages/AdminTracking';
import AdminDeliveries from './pages/AdminDeliveries';
import AgentDashboard from './pages/AgentDashboard';
import AgentDeliveries from './pages/AgentDeliveries';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import SuperAdminCreateUser from './pages/SuperAdminCreateUser';
import AdminLoginPage from './pages/AdminLoginPage';

// Protected Route (Requires logged in user AND completed profile)
function Protected({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#F9F9F9]"><div className="text-center"><div className="text-5xl mb-4 animate-bounce">🌱</div><p className="font-display text-xl text-[#282C3F]">Loading FeedForward...</p></div></div>;
  if (!user) {
    if (role === 'admin' || role === 'superadmin' || role === 'agent') {
      return <Navigate to="/admin/login" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // Profile completion enforcement: If first-time user has not completed profile, redirect
  if (!user.isProfileComplete && user.role !== 'superadmin') {
    return <Navigate to="/complete-profile" replace />;
  }

  if (role && user.role !== role) {
    const roleRoutes = { donor: '/donor', admin: '/admin', agent: '/agent', superadmin: '/admin/superadmin' };
    const isStaffRole = role === 'admin' || role === 'superadmin' || role === 'agent';
    return <Navigate to={roleRoutes[user.role] || (isStaffRole ? '/admin/login' : '/login')} replace />;
  }
  return children;
}

// Protected Profile Route (Only for logged in users whose profile is NOT yet complete)
function ProtectedProfileRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#F9F9F9]"><div className="text-center"><div className="text-5xl mb-4 animate-bounce">🌱</div><p className="font-display text-xl text-[#282C3F]">Loading FeedForward...</p></div></div>;
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If already complete, redirect to their dashboard
  if (user.isProfileComplete || user.role === 'superadmin') {
    const roleRoutes = { donor: '/donor', admin: '/admin', agent: '/agent', superadmin: '/admin/superadmin' };
    return <Navigate to={roleRoutes[user.role] || '/login'} replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Secure Admin Login Portal */}
          <Route path="/admin/login" element={<AdminLoginPage />} />

          {/* First-time Profile Completion Onboarding */}
          <Route path="/complete-profile" element={<ProtectedProfileRoute><CompleteProfilePage /></ProtectedProfileRoute>} />

          {/* Donor */}
          <Route path="/donor" element={<Protected role="donor"><DonorDashboard /></Protected>} />
          <Route path="/donor/post" element={<Protected role="donor"><FoodPostForm /></Protected>} />
          <Route path="/donor/track" element={<Protected role="donor"><DonorTrackPage /></Protected>} />
          <Route path="/donor/track/:id" element={<Protected role="donor"><DonorTrackPage /></Protected>} />
          <Route path="/donor/profile" element={<Protected role="donor"><ProfilePage /></Protected>} />

          {/* NGO Admin */}
          <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
          <Route path="/admin/requests" element={<Protected role="admin"><AdminRequests /></Protected>} />
          <Route path="/admin/users" element={<Protected role="admin"><AdminUsers /></Protected>} />
          <Route path="/admin/tracking" element={<Protected role="admin"><AdminTracking /></Protected>} />
          <Route path="/admin/deliveries" element={<Protected role="admin"><AdminDeliveries /></Protected>} />
          <Route path="/admin/profile" element={<Protected role="admin"><ProfilePage /></Protected>} />

          {/* Delivery Agent */}
          <Route path="/agent" element={<Protected role="agent"><AgentDashboard /></Protected>} />
          <Route path="/agent/deliveries" element={<Protected role="agent"><AgentDeliveries /></Protected>} />
          <Route path="/agent/deliveries/:id" element={<Protected role="agent"><AgentDeliveries /></Protected>} />
          <Route path="/agent/profile" element={<Protected role="agent"><ProfilePage /></Protected>} />

          {/* Superadmin (nested under /admin/superadmin) */}
          <Route path="/admin/superadmin" element={<Protected role="superadmin"><SuperAdminDashboard /></Protected>} />
          <Route path="/admin/superadmin/create" element={<Protected role="superadmin"><SuperAdminCreateUser /></Protected>} />

          {/* Legacy Superadmin Redirects */}
          <Route path="/superadmin" element={<Navigate to="/admin/superadmin" replace />} />
          <Route path="/superadmin/create" element={<Navigate to="/admin/superadmin/create" replace />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
