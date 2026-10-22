import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import { getAllFood, getDonors, getAgents } from '../services/api';
import { getSocket } from '../services/socket';

const statusColors = {
  pending: 'badge-orange',
  accepted: 'badge-green',
  agent_assigned: 'badge-blue',
  picked_up: 'badge-orange',
  delivered: 'badge-green',
  rejected: 'badge-red',
};

const statusLabels = {
  pending: '⏳ Pending',
  accepted: '✅ Accepted',
  agent_assigned: '🚴 Assigned',
  picked_up: '📦 Picked Up',
  delivered: '🎉 Delivered',
  rejected: '❌ Rejected',
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ donors: 0, agents: 0, pending: 0, delivered: 0 });
  const [recentPosts, setRecentPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [foodRes, donorsRes, agentsRes] = await Promise.all([getAllFood(), getDonors(), getAgents()]);
        const posts = foodRes.data;
        setRecentPosts(posts.slice(0, 5));
        setStats({
          donors: donorsRes.data.length,
          agents: agentsRes.data.length,
          pending: posts.filter(p => p.status === 'pending').length,
          delivered: posts.filter(p => p.status === 'delivered').length,
        });
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
    const socket = getSocket();
    socket.emit('joinAdminRoom');
    socket.on('food:newPost', (data) => {
      setNotification(`🍱 New donation from ${data.donorName}: ${data.post.foodName}`);
      setStats(s => ({ ...s, pending: s.pending + 1 }));
      setRecentPosts(prev => [data.post, ...prev].slice(0, 5));
      setTimeout(() => setNotification(null), 5000);
    });
    return () => socket.off('food:newPost');
  }, []);

  const statCards = [
    { label: 'Total Donors', value: stats.donors, icon: '🤲', color: '#34C759', bg: 'rgba(52, 199, 89, 0.12)', path: '/admin/users' },
    { label: 'Fleet Agents', value: stats.agents, icon: '🚴', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.12)', path: '/admin/users' },
    { label: 'Pending Review', value: stats.pending, icon: '⏳', color: '#FF9500', bg: 'rgba(255, 149, 0, 0.12)', path: '/admin/requests' },
    { label: 'Delivered', value: stats.delivered, icon: '✅', color: '#34C759', bg: 'rgba(52, 199, 89, 0.12)', path: '/admin/deliveries' },
  ];

  const quickActions = [
    { icon: '📋', label: 'Review Requests', desc: 'Accept or reject pending donations', path: '/admin/requests', color: '#FF9500', bg: 'rgba(255, 149, 0, 0.12)' },
    { icon: '👥', label: 'Manage Users', desc: 'View donors, agents & reward points', path: '/admin/users', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.12)' },
    { icon: '🗺️', label: 'Live Tracking', desc: 'Monitor active agents on city map', path: '/admin/tracking', color: '#34C759', bg: 'rgba(52, 199, 89, 0.12)' },
  ];

  return (
    <DashboardLayout title="Admin Overview">
      {/* iOS Dynamic Island Style Live Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -24, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 bg-[#1C1C1E]/90 text-white px-5 py-2.5 rounded-full backdrop-blur-2xl border border-white/10 shadow-2xl z-50 text-xs font-semibold flex items-center gap-3 tracking-tight"
          >
            <span className="w-2 h-2 rounded-full bg-[#34C759] animate-pulse" />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h2 className="font-display text-3xl font-bold tracking-tight text-[#1C1C1E]">
          Operations Console 🏢
        </h2>
        <p className="text-[#636366] mt-1 text-sm font-medium">Manage donations, dispatch courier agents, and track live deliveries.</p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 lg:gap-5 mb-8">
        {statCards.map((s, i) => (
          <motion.div 
            key={s.label} 
            initial={{ opacity: 0, y: 14 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: i * 0.06 }}
            className="card cursor-pointer hover:shadow-[0_12px_28px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200"
            onClick={() => navigate(s.path)}
          >
            <div 
              className="w-12 h-12 rounded-[16px] flex items-center justify-center text-2xl mb-3 shadow-sm" 
              style={{ backgroundColor: s.bg }}
            >
              {s.icon}
            </div>
            <div className="text-3xl font-bold font-display tracking-tight" style={{ color: s.color }}>
              {loading ? '...' : s.value}
            </div>
            <div className="text-xs text-[#636366] mt-1 font-semibold uppercase tracking-wider">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Quick actions (iOS Inset Grouped Action Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 lg:gap-5 mb-8">
        {quickActions.map((item, i) => (
          <motion.button 
            key={item.path} 
            onClick={() => navigate(item.path)}
            initial={{ opacity: 0, y: 12 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.18 + i * 0.06 }}
            className="card text-left hover:shadow-[0_12px_28px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 group w-full"
          >
            <div 
              className="w-12 h-12 rounded-[16px] flex items-center justify-center text-2xl mb-4 shadow-sm" 
              style={{ backgroundColor: item.bg }}
            >
              {item.icon}
            </div>
            <h4 className="font-semibold text-[#1C1C1E] text-base tracking-tight group-hover:text-[#FF9500] transition-colors flex items-center justify-between">
              <span>{item.label}</span>
              <span className="text-[#8E8E93] text-sm font-light">›</span>
            </h4>
            <p className="text-xs text-[#636366] mt-1 font-medium">{item.desc}</p>
          </motion.button>
        ))}
      </div>

      {/* Recent posts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-bold tracking-tight text-[#1C1C1E]">Recent Food Posts</h3>
          <button 
            onClick={() => navigate('/admin/requests')} 
            className="text-[#FF9500] text-sm font-semibold hover:underline flex items-center gap-1"
          >
            View all <span>→</span>
          </button>
        </div>
        <div className="grid gap-3">
          {loading ? (
            [1,2,3].map(i => <div key={i} className="card h-20 animate-pulse bg-white/60 border border-black/[0.04]" />)
          ) : recentPosts.length === 0 ? (
            <div className="card text-center py-10 text-[#636366] text-sm font-medium">No food posts submitted yet.</div>
          ) : recentPosts.map((post, i) => (
            <motion.div 
              key={post._id} 
              initial={{ opacity: 0, x: -10 }} 
              animate={{ opacity: 1, x: 0 }} 
              transition={{ delay: i * 0.05 }}
              className="card-hover flex items-center gap-4" 
              onClick={() => navigate('/admin/requests')}
            >
              <div className="w-14 h-14 rounded-[16px] bg-black/[0.03] border border-black/[0.04] flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                {post.photo ? (
                  <img src={post.photo} alt="" className="w-full h-full object-cover rounded-[16px]" />
                ) : (
                  <span className="text-2xl">🍱</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <h4 className="font-semibold text-[#1C1C1E] truncate text-base tracking-tight">{post.foodName}</h4>
                  <span className={statusColors[post.status] || 'badge-gray'}>{statusLabels[post.status]}</span>
                </div>
                <p className="text-xs text-[#636366] mt-1 font-medium">{post.donorId?.name || 'Verified Donor'} · {post.quantity}</p>
                <p className="text-[11px] text-[#8E8E93] mt-0.5">{new Date(post.createdAt).toLocaleDateString()}</p>
              </div>
              <span className="text-[#8E8E93] text-2xl font-light">›</span>
            </motion.div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
