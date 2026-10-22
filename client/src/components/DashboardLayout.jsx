import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';

const roleColors = { 
  donor: '#34C759', 
  admin: '#FF9500', 
  agent: '#007AFF', 
  superadmin: '#5856D6' 
};

export default function DashboardLayout({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const accentColor = roleColors[user?.role] || '#FF9500';

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
    { icon: '🏠', label: 'Home', path: '/admin/superadmin' },
    { icon: '👥', label: 'Create', path: '/admin/superadmin/create' },
  ];
  const bottomNavByRole = { donor: donorBottomNav, admin: adminBottomNav, agent: agentBottomNav, superadmin: superadminBottomNav };
  const bottomNav = bottomNavByRole[user?.role] || [];

  return (
    <div className="min-h-screen bg-[#F2F2F7] font-sans text-[#1C1C1E]">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content wrapper */}
      <div className="lg:ml-72 min-h-screen flex flex-col">

        {/* iOS Frosted Glass Top Bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-2xl border-b border-black/[0.06] px-4 lg:px-8 flex items-center justify-between h-16 lg:h-18 transition-all">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-[14px] bg-black/[0.04] active:scale-95 transition-all text-[#1C1C1E]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
            
            <div>
              <h1 className="font-display text-xl lg:text-2xl font-bold tracking-tight text-[#1C1C1E]">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* iOS Dynamic Island style Points Badge */}
            {user?.role === 'donor' && (
              <div className="flex items-center gap-2 bg-[#FF9500]/12 px-3.5 py-1.5 rounded-full border border-[#FF9500]/25 shadow-sm">
                <span className="text-sm">⭐</span>
                <span className="text-sm font-bold text-[#C97100]">{user?.points || 0} pts</span>
              </div>
            )}

            {/* Notification Bell */}
            <button className="w-9 h-9 flex items-center justify-center rounded-full bg-black/[0.04] hover:bg-black/[0.07] active:scale-95 transition-all">
              <span className="text-base">🔔</span>
            </button>

            {/* iOS Squircle Avatar */}
            <button
              onClick={() => navigate(`/${user?.role}/profile`)}
              className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-sm shadow-sm ring-2 ring-white active:scale-95 transition-all"
              style={{ backgroundColor: accentColor }}
            >
              {user?.profilePhoto ? (
                <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
              ) : (
                user?.name?.[0]?.toUpperCase()
              )}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 pb-28 lg:pb-12 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Mobile Floating iOS Tab Bar */}
        <nav 
          className="bottom-nav lg:hidden fixed bottom-3 left-4 right-4 z-40 bg-white/85 backdrop-blur-2xl border border-black/[0.08] rounded-[28px] shadow-[0_12px_36px_rgba(0,0,0,0.12)] p-1.5 flex items-center justify-around"
        >
          {bottomNav.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button 
                key={item.path} 
                onClick={() => navigate(item.path)}
                className={`flex-1 flex flex-col items-center py-2 gap-1 rounded-[22px] transition-all duration-200 ${
                  isActive ? 'bg-black/[0.05]' : 'hover:bg-black/[0.02]'
                }`}
                style={{ minHeight: '52px' }}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                <span 
                  className={`text-[11px] font-semibold tracking-tight ${
                    isActive ? 'font-bold' : 'text-[#8E8E93]'
                  }`}
                  style={isActive ? { color: accentColor } : {}}
                >
                  {item.label}
                </span>
                {isActive && (
                  <motion.span 
                    layoutId="activeTabDot"
                    className="w-1 h-1 rounded-full" 
                    style={{ backgroundColor: accentColor }} 
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
