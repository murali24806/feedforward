import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { getMyFood } from '../services/api';
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
    { label: 'Total Donations', value: posts.length, icon: '🍱', color: '#34C759', bg: 'rgba(52, 199, 89, 0.12)' },
    { label: 'Active Tasks', value: posts.filter(p => ['pending','accepted','agent_assigned','picked_up'].includes(p.status)).length, icon: '⏳', color: '#FF9500', bg: 'rgba(255, 149, 0, 0.12)' },
    { label: 'Delivered', value: posts.filter(p => p.status === 'delivered').length, icon: '🎉', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.12)' },
    { label: 'Reward Points', value: user?.points || 0, icon: '⭐', color: '#FF9500', bg: 'rgba(255, 149, 0, 0.12)' },
  ];

  return (
    <DashboardLayout title="My Dashboard">
      {/* Welcome Section */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h2 className="font-display text-3xl font-bold tracking-tight text-[#1C1C1E]">
          Hello, {user?.name?.split(' ')[0]} 👋
        </h2>
        <p className="text-[#636366] mt-1 text-sm font-medium">Thank you for making a difference with every donation.</p>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 lg:gap-5 mb-8">
        {stats.map((s, i) => (
          <motion.div 
            key={s.label} 
            initial={{ opacity: 0, y: 14 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: i * 0.06 }}
            className="card text-center hover:shadow-[0_12px_28px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200"
          >
            <div 
              className="w-12 h-12 rounded-[16px] flex items-center justify-center text-2xl mx-auto mb-3 shadow-sm"
              style={{ backgroundColor: s.bg }}
            >
              {s.icon}
            </div>
            <div className="text-3xl font-bold font-display tracking-tight" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-xs text-[#636366] mt-1 font-semibold uppercase tracking-wider">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* iOS CTA Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 12 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.18 }}
        className="rounded-[26px] p-6 lg:p-8 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 text-white overflow-hidden relative shadow-[0_10px_30px_rgba(52,199,89,0.25)]"
        style={{ background: 'linear-gradient(135deg, #34C759 0%, #28A745 100%)' }}
      >
        <div className="absolute right-0 top-0 w-48 h-48 bg-white/10 rounded-full -translate-y-12 translate-x-12 blur-sm pointer-events-none" />
        <div className="relative z-10">
          <span className="inline-block bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold mb-2">
            Surplus Redistribution
          </span>
          <h3 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">Have surplus food?</h3>
          <p className="text-white/90 text-sm mt-1 max-w-md">Connect directly with vetted local NGOs to pick up and distribute meals.</p>
        </div>
        <button 
          onClick={() => navigate('/donor/post')}
          className="bg-white text-[#28A745] hover:bg-white/95 active:scale-[0.98] px-6 py-3.5 rounded-[18px] font-bold text-sm transition-all flex-shrink-0 min-h-[48px] shadow-lg relative z-10"
        >
          🍱 Post Food Now
        </button>
      </motion.div>

      {/* Recent donations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-bold tracking-tight text-[#1C1C1E]">My Donations</h3>
          <button 
            onClick={() => navigate('/donor/track')} 
            className="text-[#FF9500] text-sm font-semibold hover:underline flex items-center gap-1"
          >
            View all <span>→</span>
          </button>
        </div>

        {loading ? (
          <div className="grid gap-3">
            {[1,2,3].map(i => (
              <div key={i} className="card h-24 animate-pulse bg-white/60 border border-black/[0.04]" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="card text-center py-14">
            <div className="text-6xl mb-4">🍽️</div>
            <p className="font-display text-xl text-[#1C1C1E] font-bold tracking-tight">No donations yet</p>
            <p className="text-[#636366] mt-1.5 text-sm">Start by sharing your first food donation!</p>
            <button onClick={() => navigate('/donor/post')} className="btn-secondary mt-5 mx-auto">
              Post Food Now
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {posts.slice(0, 5).map((post, i) => (
              <motion.div 
                key={post._id} 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }} 
                transition={{ delay: i * 0.05 }}
                className="card-hover flex items-center gap-4" 
                onClick={() => navigate(`/donor/track/${post._id}`)}
              >
                <div className="w-16 h-16 rounded-[18px] bg-black/[0.03] border border-black/[0.04] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
                  {post.photo ? (
                    <img src={post.photo} alt="" className="w-full h-full object-cover rounded-[18px]" />
                  ) : (
                    <span className="text-3xl">🍱</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <h4 className="font-semibold text-[#1C1C1E] truncate text-base tracking-tight">{post.foodName}</h4>
                    <span className={statusColors[post.status] || 'badge-gray'}>{statusLabels[post.status]}</span>
                  </div>
                  <p className="text-xs text-[#636366] mt-1 font-medium">{post.quantity} · {post.type === 'veg' ? '🥦 Veg' : '🍗 Non-veg'}</p>
                  <p className="text-[11px] text-[#8E8E93] mt-0.5">{new Date(post.createdAt).toLocaleDateString()}</p>
                </div>
                <span className="text-[#8E8E93] text-2xl font-light">›</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
