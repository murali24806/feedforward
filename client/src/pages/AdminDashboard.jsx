import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import { getAllFood, getDonors, getAgents } from '../services/api';
import { getSocket } from '../services/socket';

const statusColors = {
  pending: 'badge-orange', accepted: 'badge-green', agent_assigned: 'badge-green',
  picked_up: 'badge-green', delivered: 'badge-green', rejected: 'badge-red',
};
const statusLabels = {
  pending: '⏳ Pending', accepted: '✅ Accepted', agent_assigned: '🚴 Assigned',
  picked_up: '📦 Picked Up', delivered: '🎉 Delivered', rejected: '❌ Rejected',
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
    { label: 'Total Donors', value: stats.donors, icon: '🤲', color: '#1BA672', bg: '#E8F8F2', path: '/admin/users' },
    { label: 'Total Agents', value: stats.agents, icon: '🚴', color: '#6C63FF', bg: '#F0EEFF', path: '/admin/users' },
    { label: 'Pending', value: stats.pending, icon: '⏳', color: '#FC8019', bg: '#FFF3E8', path: '/admin/requests' },
    { label: 'Delivered', value: stats.delivered, icon: '✅', color: '#1BA672', bg: '#E8F8F2', path: '/admin/deliveries' },
  ];

  const quickActions = [
    { icon: '📋', label: 'Review Requests', desc: 'Accept or reject pending donations', path: '/admin/requests', color: '#FC8019', bg: '#FFF3E8' },
    { icon: '👥', label: 'Manage Users', desc: 'View donors, agents & assign points', path: '/admin/users', color: '#6C63FF', bg: '#F0EEFF' },
    { icon: '🗺️', label: 'Live Map', desc: 'Track all agents in real-time', path: '/admin/tracking', color: '#1BA672', bg: '#E8F8F2' },
  ];

  return (
    <DashboardLayout title="Admin Overview">
      {/* Toast notification */}
      {notification && (
        <motion.div initial={{ opacity: 0, y: -16, x: 16 }} animate={{ opacity: 1, y: 0, x: 0 }} exit={{ opacity: 0 }}
          className="fixed top-5 right-5 bg-[#282C3F] text-white px-5 py-4 rounded-2xl shadow-2xl z-50 max-w-xs text-sm font-medium flex items-center gap-3">
          <span className="text-xl">🍱</span>
          <span>{notification}</span>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
        <h2 className="font-display text-3xl font-bold text-[#282C3F]">Admin Dashboard 🏢</h2>
        <p className="text-[#686B78] mt-1.5 text-base">Manage donations, assign agents, and monitor deliveries.</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-7">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="card cursor-pointer hover:shadow-[0_4px_16px_rgba(40,44,63,0.14)] hover:-translate-y-0.5 transition-all duration-200"
            onClick={() => navigate(s.path)}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-3" style={{ backgroundColor: s.bg }}>
              {s.icon}
            </div>
            <div className="text-3xl font-bold font-display" style={{ color: s.color }}>{loading ? '...' : s.value}</div>
            <div className="text-sm text-[#686B78] mt-1.5 font-medium">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4 mb-7">
        {quickActions.map((item, i) => (
          <motion.button key={item.path} onClick={() => navigate(item.path)}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }}
            className="card text-left hover:shadow-[0_4px_16px_rgba(40,44,63,0.14)] hover:-translate-y-0.5 transition-all duration-200 group w-full">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4" style={{ backgroundColor: item.bg }}>
              {item.icon}
            </div>
            <h4 className="font-semibold text-[#282C3F] text-base group-hover:text-[#FC8019] transition-colors">{item.label}</h4>
            <p className="text-sm text-[#686B78] mt-1">{item.desc}</p>
          </motion.button>
        ))}
      </div>

      {/* Recent posts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-bold text-[#282C3F]">Recent Food Posts</h3>
          <button onClick={() => navigate('/admin/requests')} className="text-[#FC8019] text-base font-semibold hover:underline">View all →</button>
        </div>
        <div className="grid gap-3">
          {loading ? (
            [1,2,3].map(i => <div key={i} className="card h-20 animate-pulse bg-[#F4F4F4] border-0" />)
          ) : recentPosts.length === 0 ? (
            <div className="card text-center py-10 text-[#686B78]">No food posts yet.</div>
          ) : recentPosts.map((post, i) => (
            <motion.div key={post._id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className="card-hover" onClick={() => navigate('/admin/requests')}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#F4F4F4] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {post.photo ? <img src={post.photo} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">🍱</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <h4 className="font-semibold text-[#282C3F] truncate text-base">{post.foodName}</h4>
                    <span className={statusColors[post.status] || 'badge-gray'}>{statusLabels[post.status]}</span>
                  </div>
                  <p className="text-sm text-[#686B78] mt-0.5">{post.donorId?.name || 'Unknown donor'} · {post.quantity}</p>
                  <p className="text-xs text-[#93959F] mt-0.5">{new Date(post.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
