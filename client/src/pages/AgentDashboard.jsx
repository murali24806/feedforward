import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { getMyDeliveries } from '../services/api';

const statusColors = {
  assigned: 'badge-orange', accepted: 'badge-green', in_transit: 'badge-green',
  picked_up: 'badge-orange', delivered: 'badge-green',
};
const statusLabels = {
  assigned: '⏳ New', accepted: '✅ Accepted', in_transit: '🗺️ In Transit',
  picked_up: '📦 Picked Up', delivered: '🎉 Delivered',
};

export default function AgentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyDeliveries()
      .then(res => setDeliveries(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const active = deliveries.filter(d => d.status !== 'delivered');
  const completed = deliveries.filter(d => d.status === 'delivered');

  const stats = [
    { label: 'Total', value: deliveries.length, icon: '🚴', color: '#6C63FF', bg: '#F0EEFF' },
    { label: 'Active', value: active.length, icon: '⏳', color: '#FC8019', bg: '#FFF3E8' },
    { label: 'Completed', value: completed.length, icon: '✅', color: '#1BA672', bg: '#E8F8F2' },
    { label: 'Status', value: user?.isAvailable ? 'Available' : 'Busy', icon: user?.isAvailable ? '🟢' : '🔴', color: user?.isAvailable ? '#1BA672' : '#E74C3C', bg: user?.isAvailable ? '#E8F8F2' : '#FEE8E8' },
  ];

  return (
    <DashboardLayout title="Agent Dashboard">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
        <h2 className="font-display text-3xl font-bold text-[#282C3F]">Hey, {user?.name?.split(' ')[0]} 🚴</h2>
        <p className="text-[#686B78] mt-1.5 text-base">Ready to make a delivery today?</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-7">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="card text-center hover:shadow-[0_4px_16px_rgba(40,44,63,0.14)] transition-all duration-200">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3" style={{ backgroundColor: s.bg }}>
              {s.icon}
            </div>
            <div className="text-2xl font-bold font-display" style={{ color: s.color }}>{s.value}</div>
            <div className="text-sm text-[#686B78] mt-1.5 font-medium">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Active CTA */}
      {active.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="rounded-2xl p-5 lg:p-7 mb-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #FC8019 0%, #E8720C 100%)' }}>
          <div className="absolute right-0 top-0 w-36 h-36 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <h3 className="font-display text-2xl font-bold">
              {active.length} active delivery{active.length > 1 ? 'ies' : ''}!
            </h3>
            <p className="text-white/80 text-base mt-1">View and track your current assignments.</p>
          </div>
          <button onClick={() => navigate('/agent/deliveries')}
            className="bg-white text-[#FC8019] px-6 py-3 rounded-xl font-bold text-base hover:bg-orange-50 transition-colors flex-shrink-0 min-h-[48px] shadow-lg relative z-10">
            View Deliveries →
          </button>
        </motion.div>
      )}

      {/* Recent deliveries */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-bold text-[#282C3F]">Recent Assignments</h3>
          <button onClick={() => navigate('/agent/deliveries')} className="text-[#FC8019] text-base font-semibold hover:underline">View all →</button>
        </div>

        {loading ? (
          <div className="grid gap-3">{[1,2,3].map(i => <div key={i} className="card h-24 animate-pulse bg-[#F4F4F4] border-0" />)}</div>
        ) : deliveries.length === 0 ? (
          <div className="card text-center py-14">
            <div className="text-6xl mb-4">📭</div>
            <p className="font-display text-xl text-[#282C3F] font-bold">No deliveries yet</p>
            <p className="text-[#686B78] mt-2 text-base">Your assignments will appear here once assigned by the NGO.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {deliveries.slice(0, 5).map((del, i) => (
              <motion.div key={del._id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="card-hover" onClick={() => navigate(`/agent/deliveries/${del._id}`)}>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#FFF3E8] flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🍱</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <h4 className="font-semibold text-[#282C3F] truncate text-base">{del.foodPostId?.foodName || 'Food Delivery'}</h4>
                      <span className={statusColors[del.status] || 'badge-gray'}>{statusLabels[del.status]}</span>
                    </div>
                    <p className="text-sm text-[#686B78] mt-1">From: {del.donorId?.name} · {del.donorId?.phone}</p>
                    <p className="text-xs text-[#93959F] mt-0.5">{new Date(del.createdAt).toLocaleString()}</p>
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
