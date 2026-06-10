import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { getMyFood, getMyPoints } from '../services/api';
import { getSocket } from '../services/socket';

const statusColors = {
  pending: 'badge-gray',
  accepted: 'badge-green',
  agent_assigned: 'badge-green',
  picked_up: 'badge-orange',
  delivered: 'badge-green',
  rejected: 'badge-red',
};
const statusLabels = {
  pending: '⏳ Pending',
  accepted: '✅ Accepted',
  agent_assigned: '🚴 Agent Assigned',
  picked_up: '📦 Picked Up',
  delivered: '🎉 Delivered',
  rejected: '❌ Rejected',
};

export default function DonorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [postsRes] = await Promise.all([getMyFood()]);
        setPosts(postsRes.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
    const socket = getSocket();
    socket.on('delivery:statusChanged', fetchData);
    return () => socket.off('delivery:statusChanged');
  }, []);

  const stats = [
    { label: 'Total Donations', value: posts.length, icon: '🍱', color: '#1BA672', bg: '#E8F8F2' },
    { label: 'Active', value: posts.filter(p => ['pending','accepted','agent_assigned','picked_up'].includes(p.status)).length, icon: '⏳', color: '#FC8019', bg: '#FFF3E8' },
    { label: 'Delivered', value: posts.filter(p => p.status === 'delivered').length, icon: '🎉', color: '#1BA672', bg: '#E8F8F2' },
    { label: 'Reward Points', value: user?.points || 0, icon: '⭐', color: '#FC8019', bg: '#FFF3E8' },
  ];

  return (
    <DashboardLayout title="My Dashboard">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
        <h2 className="font-display text-3xl font-bold text-[#282C3F]">
          Hello, {user?.name?.split(' ')[0]} 👋
        </h2>
        <p className="text-[#686B78] mt-1.5 text-base">Thank you for making a difference with every donation.</p>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-7">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="card text-center hover:shadow-[0_4px_16px_rgba(40,44,63,0.14)] hover:-translate-y-0.5 transition-all duration-200">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3"
              style={{ backgroundColor: s.bg }}>
              {s.icon}
            </div>
            <div className="text-3xl font-bold font-display" style={{ color: s.color }}>{s.value}</div>
            <div className="text-sm text-[#686B78] mt-1.5 font-medium">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* CTA Banner */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-2xl p-5 lg:p-7 mb-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-white overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg, #1BA672 0%, #138A5C 100%)' }}>
        <div className="absolute right-0 top-0 w-40 h-40 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
        <div className="relative">
          <h3 className="font-display text-2xl font-bold">Have surplus food?</h3>
          <p className="text-white/80 text-base mt-1">Post a donation — connect with those in need.</p>
        </div>
        <button onClick={() => navigate('/donor/post')}
          className="bg-white text-[#1BA672] px-6 py-3 rounded-xl font-bold text-base hover:bg-green-50 transition-colors flex-shrink-0 min-h-[48px] shadow-lg relative z-10">
          🍱 Post Food Now
        </button>
      </motion.div>

      {/* Recent donations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-bold text-[#282C3F]">My Donations</h3>
          <button onClick={() => navigate('/donor/track')} className="text-[#FC8019] text-base font-semibold hover:underline flex items-center gap-1">
            View all <span>→</span>
          </button>
        </div>

        {loading ? (
          <div className="grid gap-3">
            {[1,2,3].map(i => <div key={i} className="card h-24 animate-pulse bg-[#F4F4F4] border-0" />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="card text-center py-14">
            <div className="text-6xl mb-4">🍽️</div>
            <p className="font-display text-xl text-[#282C3F] font-bold">No donations yet</p>
            <p className="text-[#686B78] mt-2 text-base">Start by posting your first food donation!</p>
            <button onClick={() => navigate('/donor/post')} className="btn-secondary mt-5 mx-auto">Post Food</button>
          </div>
        ) : (
          <div className="grid gap-3">
            {posts.slice(0, 5).map((post, i) => (
              <motion.div key={post._id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="card-hover" onClick={() => navigate(`/donor/track/${post._id}`)}>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#F4F4F4] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {post.photo ? <img src={post.photo} alt="" className="w-full h-full object-cover rounded-2xl" /> : <span className="text-3xl">🍱</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <h4 className="font-semibold text-[#282C3F] truncate text-base">{post.foodName}</h4>
                      <span className={statusColors[post.status] || 'badge-gray'}>{statusLabels[post.status]}</span>
                    </div>
                    <p className="text-sm text-[#686B78] mt-1">{post.quantity} · {post.type === 'veg' ? '🥦 Veg' : '🍗 Non-veg'}</p>
                    <p className="text-xs text-[#93959F] mt-0.5">{new Date(post.createdAt).toLocaleString()}</p>
                  </div>
                  <span className="text-[#93959F] text-xl">›</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
