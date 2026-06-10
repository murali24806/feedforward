import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const donorNav = [
  { icon: '🏠', label: 'Dashboard', path: '/donor' },
  { icon: '🍱', label: 'Post Food', path: '/donor/post' },
  { icon: '📍', label: 'My Donations', path: '/donor/track' },
  { icon: '👤', label: 'Profile', path: '/donor/profile' },
];

const adminNav = [
  { icon: '🏠', label: 'Overview', path: '/admin' },
  { icon: '📋', label: 'Food Requests', path: '/admin/requests' },
  { icon: '👥', label: 'Users', path: '/admin/users' },
  { icon: '🗺️', label: 'Live Tracking', path: '/admin/tracking' },
  { icon: '📦', label: 'Deliveries', path: '/admin/deliveries' },
];

const agentNav = [
  { icon: '🏠', label: 'Dashboard', path: '/agent' },
  { icon: '🚴', label: 'My Deliveries', path: '/agent/deliveries' },
  { icon: '👤', label: 'Profile', path: '/agent/profile' },
];

const navByRole = { donor: donorNav, admin: adminNav, agent: agentNav };
const roleColors = { donor: '#1BA672', admin: '#FC8019', agent: '#6C63FF' };

export default function Sidebar({ mobileOpen, onClose }) {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = navByRole[user?.role] || [];
  const accentColor = roleColors[user?.role] || '#FC8019';

  const go = (path) => { navigate(path); onClose?.(); };

  return (
    <>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-sm" onClick={onClose} />
        )}
      </AnimatePresence>

      <aside className={`sidebar transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Logo */}
        <div className="p-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0" style={{ backgroundColor: accentColor }}>
              <span className="text-2xl">🌱</span>
            </div>
            <div>
              <div className="font-display font-bold text-xl text-white">FeedForward</div>
              <div className="text-xs text-white/40 capitalize font-medium mt-0.5">{user?.role} Panel</div>
            </div>
          </div>
        </div>

        {/* User card */}
        <div className="mx-4 mb-5 p-4 bg-white/8 rounded-2xl border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ backgroundColor: accentColor }}>
              {user?.profilePhoto
                ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
                : <span className="text-white font-bold text-lg">{user?.name?.[0]?.toUpperCase()}</span>}
            </div>
            <div className="min-w-0">
              <div className="text-white font-semibold text-base truncate">{user?.name}</div>
              <div className="text-white/40 text-xs truncate mt-0.5">{user?.email}</div>
            </div>
          </div>
          {user?.role === 'donor' && (
            <div className="mt-3 flex items-center gap-2 bg-[#FC8019]/20 rounded-xl px-3 py-2">
              <span className="text-base">⭐</span>
              <span className="text-[#FC8019] font-bold text-sm">{user?.points || 0} reward points</span>
            </div>
          )}
        </div>

        {/* Nav divider label */}
        <div className="px-6 mb-2">
          <span className="text-xs text-white/30 font-semibold uppercase tracking-widest">Navigation</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button key={item.path} onClick={() => go(item.path)}
                className={`nav-item w-full text-left ${isActive ? 'active' : ''}`}
                style={isActive ? { backgroundColor: accentColor } : {}}>
                <span className="text-xl w-7 text-center flex-shrink-0">{item.icon}</span>
                <span className="text-base font-medium">{item.label}</span>
                {isActive && <span className="ml-auto w-2 h-2 bg-white/60 rounded-full" />}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 mt-2 border-t border-white/10">
          <button onClick={() => { logoutUser(); navigate('/login'); }}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-xl
                       hover:bg-red-500/15 text-red-400 hover:text-red-300
                       transition-all duration-200 text-base font-medium">
            <span className="text-xl">🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
