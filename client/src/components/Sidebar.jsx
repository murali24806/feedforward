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

const superadminNav = [
  { icon: '👑', label: 'Overview & Radar', path: '/admin/superadmin?tab=overview' },
  { icon: '🍱', label: 'All Food Posts', path: '/admin/superadmin?tab=food' },
  { icon: '👥', label: 'User Governance', path: '/admin/superadmin?tab=users' },
  { icon: '🚴', label: 'Fleet Deliveries', path: '/admin/superadmin?tab=deliveries' },
  { icon: '⚡', label: 'Audit Stream', path: '/admin/superadmin?tab=audit' },
  { icon: '➕', label: 'Create Account', path: '/admin/superadmin/create' },
];

const navByRole = { donor: donorNav, admin: adminNav, agent: agentNav, superadmin: superadminNav };
const roleColors = { 
  donor: '#34C759', 
  admin: '#FF9500', 
  agent: '#007AFF', 
  superadmin: '#5856D6' 
};

export default function Sidebar({ mobileOpen, onClose }) {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = navByRole[user?.role] || [];
  const accentColor = roleColors[user?.role] || '#FF9500';

  const go = (path) => { navigate(path); onClose?.(); };

  return (
    <>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-md" 
            onClick={onClose} 
          />
        )}
      </AnimatePresence>

      <aside className={`sidebar transition-transform duration-300 ease-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Brand Header */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3.5">
            <div 
              className="w-11 h-11 rounded-[16px] flex items-center justify-center shadow-lg flex-shrink-0" 
              style={{ backgroundColor: accentColor }}
            >
              <span className="text-2xl">🌱</span>
            </div>
            <div>
              <div className="font-display font-bold text-xl text-white tracking-tight">FeedForward</div>
              <div className="text-[12px] text-white/50 capitalize font-medium tracking-wide">
                {user?.role} Portal
              </div>
            </div>
          </div>
        </div>

        {/* User Card (Apple Cupertino Inset Grouped Card) */}
        <div className="mx-4 mb-5 p-3.5 bg-white/[0.08] backdrop-blur-xl rounded-[18px] border border-white/10">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm"
              style={{ backgroundColor: accentColor }}
            >
              {user?.profilePhoto ? (
                <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-base">{user?.name?.[0]?.toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-white font-semibold text-sm truncate tracking-tight">{user?.name}</div>
              <div className="text-white/45 text-xs truncate mt-0.5">{user?.email}</div>
            </div>
          </div>
          {user?.role === 'donor' && (
            <div className="mt-3 flex items-center justify-between bg-[#FF9500]/20 border border-[#FF9500]/30 rounded-[12px] px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">⭐</span>
                <span className="text-[#FF9500] font-bold text-xs tracking-tight">Impact Points</span>
              </div>
              <span className="text-white font-bold text-xs">{user?.points || 0} pts</span>
            </div>
          )}
        </div>

        {/* Section Divider */}
        <div className="px-6 mb-2">
          <span className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Navigation</span>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const currentFull = location.pathname + location.search;
            const isActive = currentFull === item.path ||
              (location.pathname === item.path && !location.search && item.path.includes('overview'));

            return (
              <button 
                key={item.path} 
                onClick={() => go(item.path)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-[15px] font-medium text-[15px] tracking-tight transition-all duration-150 ${
                  isActive 
                    ? (user?.role === 'superadmin'
                        ? 'bg-gradient-to-r from-[#5856D6] to-purple-600 text-white font-semibold shadow-[0_4px_16px_rgba(88,86,214,0.35)]'
                        : 'bg-gradient-to-r from-[#FF9500] to-[#FC8019] text-white font-semibold shadow-[0_4px_16px_rgba(255,149,0,0.35)]')
                    : 'text-white/70 hover:bg-white/[0.08] hover:text-white active:scale-[0.98]'
                }`}
              >
                <span className="text-xl w-6 text-center flex-shrink-0">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 bg-white rounded-full shadow-sm" />}
              </button>
            );
          })}
        </nav>

        {/* Sign Out (iOS destructive styling) */}
        <div className="p-4 mt-2 border-t border-white/10">
          <button 
            onClick={() => {
              const isStaff = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'agent';
              logoutUser();
              navigate(isStaff ? '/admin/login' : '/login');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-[16px]
                       bg-red-500/10 hover:bg-red-500/20 text-[#FF453A]
                       active:scale-[0.98] transition-all duration-150 text-sm font-semibold tracking-tight"
          >
            <span className="text-lg">🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
