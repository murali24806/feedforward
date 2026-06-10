import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import LoginPage from './pages/LoginPage';
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

// Protected Route
function Protected({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#F9F9F9]"><div className="text-center"><div className="text-5xl mb-4 animate-bounce">🌱</div><p className="font-display text-xl text-[#282C3F]">Loading FeedForward...</p></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    const roleRoutes = { donor: '/donor', admin: '/admin', agent: '/agent' };
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

          {/* Donor */}
          <Route path="/donor" element={<Protected role="donor"><DonorDashboard /></Protected>} />
          <Route path="/donor/post" element={<Protected role="donor"><FoodPostForm /></Protected>} />
          <Route path="/donor/track" element={<Protected role="donor"><DonorTrackPage /></Protected>} />
          <Route path="/donor/track/:id" element={<Protected role="donor"><DonorTrackPage /></Protected>} />
          <Route path="/donor/profile" element={<Protected role="donor"><ProfilePage /></Protected>} />

          {/* Admin */}
          <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
          <Route path="/admin/requests" element={<Protected role="admin"><AdminRequests /></Protected>} />
          <Route path="/admin/users" element={<Protected role="admin"><AdminUsers /></Protected>} />
          <Route path="/admin/tracking" element={<Protected role="admin"><AdminTracking /></Protected>} />
          <Route path="/admin/deliveries" element={<Protected role="admin"><AdminDeliveries /></Protected>} />
          <Route path="/admin/profile" element={<Protected role="admin"><ProfilePage /></Protected>} />

          {/* Agent */}
          <Route path="/agent" element={<Protected role="agent"><AgentDashboard /></Protected>} />
          <Route path="/agent/deliveries" element={<Protected role="agent"><AgentDeliveries /></Protected>} />
          <Route path="/agent/deliveries/:id" element={<Protected role="agent"><AgentDeliveries /></Protected>} />
          <Route path="/agent/profile" element={<Protected role="agent"><ProfilePage /></Protected>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
