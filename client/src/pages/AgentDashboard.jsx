import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { getMyDeliveries } from '../services/api';

const statusColors = {
  assigned: 'badge-orange',
  accepted: 'badge-green',
  in_transit: 'badge-blue',
  picked_up: 'badge-orange',
  delivered: 'badge-green',
};

const statusLabels = {
  assigned: '⏳ New Assignment',
  accepted: '✅ Accepted',
  in_transit: '🗺️ In Transit',
  picked_up: '📦 Picked Up',
  delivered: '🎉 Delivered',
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
    { label: 'Total Assigned', value: deliveries.length, icon: '🚴', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.12)' },
    { label: 'Active Route', value: active.length, icon: '⏳', color: '#FF9500', bg: 'rgba(255, 149, 0, 0.12)' },
    { label: 'Completed', value: completed.length, icon: '✅', color: '#34C759', bg: 'rgba(52, 199, 89, 0.12)' },
    { 
      label: 'Dispatch Status', 
      value: user?.isAvailable ? 'Available' : 'Busy', 
      icon: user?.isAvailable ? '🟢' : '🔴', 
      color: user?.isAvailable ? '#34C759' : '#FF3B30', 
      bg: user?.isAvailable ? 'rgba(52, 199, 89, 0.12)' : 'rgba(255, 59, 48, 0.12)' 
    },
  ];

  return (
    <DashboardLayout title="Agent Terminal">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h2 className="font-display text-3xl font-bold tracking-tight text-[#1C1C1E]">
          Hey, {user?.name?.split(' ')[0]} 🚴
        </h2>
        <p className="text-[#636366] mt-1 text-sm font-medium">Ready to fulfill surplus food pickup and delivery?</p>
      </motion.div>

      {/* Stats */}
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
            <div className="text-2xl lg:text-3xl font-bold font-display tracking-tight" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-xs text-[#636366] mt-1 font-semibold uppercase tracking-wider">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Active Deliveries CTA Banner */}
      {active.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.18 }}
          className="rounded-[26px] p-6 lg:p-8 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 text-white overflow-hidden relative shadow-[0_10px_30px_rgba(255,149,0,0.25)]"
          style={{ background: 'linear-gradient(135deg, #FF9500 0%, #E07D00 100%)' }}
        >
          <div className="absolute right-0 top-0 w-48 h-48 bg-white/10 rounded-full -translate-y-12 translate-x-12 blur-sm pointer-events-none" />
          <div className="relative z-10">
            <span className="inline-block bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold mb-2">
              Live Courier Route
            </span>
            <h3 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">
              {active.length} active deliver{active.length > 1 ? 'ies' : 'y'} in progress!
            </h3>
            <p className="text-white/90 text-sm mt-1 max-w-md">Open turn-by-turn navigation, update pickup status, and broadcast live GPS.</p>
          </div>
          <button 
            onClick={() => navigate('/agent/deliveries')}
            className="bg-white text-[#E07D00] hover:bg-white/95 active:scale-[0.98] px-6 py-3.5 rounded-[18px] font-bold text-sm transition-all flex-shrink-0 min-h-[48px] shadow-lg relative z-10"
          >
            Launch Route Navigation →
          </button>
        </motion.div>
      )}

      {/* Recent deliveries */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-bold tracking-tight text-[#1C1C1E]">Assigned Deliveries</h3>
          <button 
            onClick={() => navigate('/agent/deliveries')} 
            className="text-[#FF9500] text-sm font-semibold hover:underline"
          >
            View all <span>→</span>
          </button>
        </div>

        {loading ? (
          <div className="grid gap-3">
            {[1,2,3].map(i => <div key={i} className="card h-24 animate-pulse bg-white/60 border border-black/[0.04]" />)}
          </div>
        ) : deliveries.length === 0 ? (
          <div className="card text-center py-14">
            <div className="text-6xl mb-4">🚴</div>
            <p className="font-display text-xl text-[#1C1C1E] font-bold tracking-tight">No active assignments</p>
            <p className="text-[#636366] mt-1.5 text-sm">Your delivery orders will appear here once assigned by the NGO coordinator.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {deliveries.slice(0, 5).map((del, i) => (
              <motion.div 
                key={del._id} 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }} 
                transition={{ delay: i * 0.05 }}
                className="card-hover flex items-center gap-4" 
                onClick={() => navigate(`/agent/deliveries/${del._id}`)}
              >
                <div className="w-14 h-14 rounded-[16px] bg-black/[0.03] border border-black/[0.04] flex items-center justify-center flex-shrink-0 shadow-sm text-2xl">
                  🚴
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <h4 className="font-semibold text-[#1C1C1E] truncate text-base tracking-tight">
                      {del.foodPostId?.foodName || 'Donation Item'}
                    </h4>
                    <span className={statusColors[del.status] || 'badge-gray'}>{statusLabels[del.status]}</span>
                  </div>
                  <p className="text-xs text-[#636366] mt-1 font-medium truncate">
                    📍 {del.pickupAddress || 'Pickup address'} → 🏢 {del.deliveryAddress || 'Dropoff location'}
                  </p>
                  <p className="text-[11px] text-[#8E8E93] mt-0.5">Assigned {new Date(del.createdAt).toLocaleDateString()}</p>
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
