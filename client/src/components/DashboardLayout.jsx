import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';

const roleColors = { donor: '#1BA672', admin: '#FC8019', agent: '#6C63FF', superadmin: '#282C3F' };

export default function DashboardLayout({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const accentColor = roleColors[user?.role] || '#FC8019';

  const donorBottomNav = [
    { icon: '🏠', label: 'Home', path: '/donor' },
    { icon: '🍱', label: 'Post', path: '/donor/post' },
    { icon: '📍', label: 'Track', path: '/donor/track' },
    { icon: '👤', label: 'Profile', path: '/donor/profile' },
  ];
  const adminBottomNav = [
    { icon: '🏠', label: 'Home', path: '/admin' },
    { icon: '📋', label: 'Requests', path: '/admin/requests' },
    { icon: '👥', label: 'Users', path: '/admin/users' },
    { icon: '🗺️', label: 'Map', path: '/admin/tracking' },
  ];
  const agentBottomNav = [
    { icon: '🏠', label: 'Home', path: '/agent' },
    { icon: '🚴', label: 'Deliveries', path: '/agent/deliveries' },
    { icon: '👤', label: 'Profile', path: '/agent/profile' },
  ];
  const superadminBottomNav = [
    { icon: '🏠', label: 'Home', path: '/superadmin' },
    { icon: '👥', label: 'Create', path: '/superadmin/create' },
  ];
  const bottomNavByRole = { donor: donorBottomNav, admin: adminBottomNav, agent: agentBottomNav, superadmin: superadminBottomNav };
  const bottomNav = bottomNavByRole[user?.role] || [];

  return (
    <div className="min-h-screen bg-[#F9F9F9] font-sans">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="lg:ml-72 min-h-screen flex flex-col">

        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-[#F0F0F0] px-4 lg:px-8 py-0 flex items-center justify-between h-16 lg:h-18"
          style={{ boxShadow: '0 1px 4px rgba(40,44,63,0.06)' }}>

          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#F4F4F4] transition-colors">
              <svg className="w-6 h-6 text-[#282C3F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
            <h1 className="font-display text-xl lg:text-2xl font-bold text-[#282C3F]">{title}</h1>
          </div>

          <div className="flex items-center gap-3">
            {user?.role === 'donor' && (
              <div className="hidden sm:flex items-center gap-2 bg-[#FFF3E8] px-4 py-2 rounded-full border border-[#FC8019]/20">
                <span className="text-lg">⭐</span>
                <span className="text-base font-bold text-[#FC8019]">{user?.points || 0} pts</span>
              </div>
            )}
            {/* Notification bell placeholder */}
            <button className="w-10 h-10 hidden sm:flex items-center justify-center rounded-xl hover:bg-[#F4F4F4] transition-colors relative">
              <span className="text-xl">🔔</span>
            </button>
            {/* Avatar */}
            <button
              onClick={() => navigate(`/${user?.role}/profile`)}
              className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-base flex-shrink-0 ring-2 ring-offset-1"
              style={{ backgroundColor: accentColor, ringColor: accentColor }}>
              {user?.profilePhoto
                ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
                : user?.name?.[0]?.toUpperCase()}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-10">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="bottom-nav lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#F0F0F0] flex z-20"
          style={{ boxShadow: '0 -2px 12px rgba(40,44,63,0.08)' }}>
          {bottomNav.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className="flex-1 flex flex-col items-center py-3 gap-1 transition-colors min-h-[64px]"
                style={isActive ? { color: accentColor } : { color: '#686B78' }}>
                <span className="text-2xl leading-none">{item.icon}</span>
                <span className="text-xs font-semibold">{item.label}</span>
                {isActive && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
