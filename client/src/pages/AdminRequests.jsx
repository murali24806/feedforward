import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import LiveMap from '../components/LiveMap';
import { getAllFood, getAgents, acceptFood, rejectFood } from '../services/api';
import { useGeolocation } from '../hooks/useGeolocation';

const statusColors = {
  pending: 'badge-orange', accepted: 'badge-green', agent_assigned: 'badge-green',
  picked_up: 'badge-green', delivered: 'badge-green', rejected: 'badge-red',
};
const statusLabels = {
  pending: '⏳ Pending', accepted: '✅ Accepted', agent_assigned: '🚴 Assigned',
  picked_up: '📦 Picked Up', delivered: '🎉 Delivered', rejected: '❌ Rejected',
};

export default function AdminRequests() {
  const [posts, setPosts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [assignAgentId, setAssignAgentId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const { location: adminLoc, error: geoError, loading: geoLoading, getLocation } = useGeolocation();
  const detailRef = useRef(null);

  useEffect(() => {
    getLocation(); // get admin location on mount
    const fetch = async () => {
      try {
        const [foodRes, agentsRes] = await Promise.all([getAllFood(), getAgents()]);
        setPosts(foodRes.data);
        setAgents(agentsRes.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const handleAccept = async (postId) => {
    if (!assignAgentId) { alert('Please select an agent first'); return; }
    if (!adminLoc) { 
      alert('Please allow location access to assign an agent. The agent needs your location to deliver the food.'); 
      getLocation();
      return; 
    }
    setActionLoading(true);
    try {
      await acceptFood(postId, assignAgentId, { lat: adminLoc.lat, lng: adminLoc.lng, address: 'Admin Location' });
      setPosts(p => p.map(post => post._id === postId ? { ...post, status: 'agent_assigned' } : post));
      setSelected(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept');
    } finally { setActionLoading(false); }
  };

  const handleReject = async (postId) => {
    if (!window.confirm('Reject this food post?')) return;
    setActionLoading(true);
    try {
      await rejectFood(postId);
      setPosts(p => p.map(post => post._id === postId ? { ...post, status: 'rejected' } : post));
      setSelected(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject');
    } finally { setActionLoading(false); }
  };

  const filtered = filterStatus === 'all' ? posts : posts.filter(p => p.status === filterStatus);
  const availableAgents = agents.filter(a => a.isAvailable);

  const filters = [
    { key: 'all', label: 'All', count: posts.length },
    { key: 'pending', label: '⏳ Pending', count: posts.filter(p => p.status === 'pending').length },
    { key: 'agent_assigned', label: '🚴 Assigned', count: posts.filter(p => p.status === 'agent_assigned').length },
    { key: 'delivered', label: '🎉 Delivered', count: posts.filter(p => p.status === 'delivered').length },
    { key: 'rejected', label: '❌ Rejected', count: posts.filter(p => p.status === 'rejected').length },
  ];

  return (
    <DashboardLayout title="Food Requests">
      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap mb-6 overflow-x-auto pb-1">
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilterStatus(f.key)}
            className={`px-4 py-2.5 rounded-xl text-base font-semibold transition-all whitespace-nowrap flex-shrink-0
              ${filterStatus === f.key ? 'bg-[#FC8019] text-white shadow-[0_4px_10px_rgba(252,128,25,0.3)]' : 'bg-white text-[#686B78] hover:bg-[#F4F4F4] border border-[#F0F0F0]'}`}>
            {f.label} <span className={`text-sm ml-1 ${filterStatus === f.key ? 'text-white/80' : 'text-[#93959F]'}`}>({f.count})</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Posts list */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid gap-3">{[1,2,3].map(i => <div key={i} className="card h-28 animate-pulse bg-[#F4F4F4] border-0" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="card text-center py-14">
              <div className="text-5xl mb-3">📭</div>
              <p className="text-[#686B78] text-base">No food requests in this category.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((post, i) => (
                <motion.div key={post._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={`card cursor-pointer hover:shadow-[0_4px_16px_rgba(40,44,63,0.14)] hover:-translate-y-0.5 transition-all duration-200 ${selected?._id === post._id ? 'ring-2 ring-[#FC8019]' : ''}`}
                  onClick={() => {
                    setSelected(post);
                    setAssignAgentId('');
                    setTimeout(() => {
                      if (detailRef.current) {
                        detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }, 100);
                  }}>
                  <div className="flex gap-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-[#F4F4F4] flex items-center justify-center">
                      {post.photo ? <img src={post.photo} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">🍱</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <h4 className="font-semibold text-[#282C3F] text-base">{post.foodName}</h4>
                        <span className={statusColors[post.status] || 'badge-gray'}>{statusLabels[post.status]}</span>
                      </div>
                      <p className="text-sm text-[#686B78] mt-1">
                        <strong className="text-[#282C3F]">{post.donorId?.name || 'Donor'}</strong> · {post.quantity} · {post.type === 'veg' ? '🥦 Veg' : '🍗 Non-veg'}
                      </p>
                      <p className="text-xs text-[#93959F] mt-1">
                        📍 {post.location?.address || 'Location recorded'} · {new Date(post.createdAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-amber-600 mt-0.5">⏰ Expires: {new Date(post.expiryTime).toLocaleString()}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selected && (
            <motion.div ref={detailRef} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} className="lg:w-96 flex-shrink-0 space-y-4 scroll-mt-4">
              <div className="card">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-display text-lg font-bold text-[#282C3F]">{selected.foodName}</h3>
                  <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-xl bg-[#F4F4F4] flex items-center justify-center text-[#686B78] hover:bg-[#E8E8E8] text-xl leading-none font-light transition-colors">×</button>
                </div>
                {selected.photo && <img src={selected.photo} alt="" className="w-full h-44 object-cover rounded-2xl mb-4" />}
                <div className="space-y-2.5">
                  {[
                    ['📦', 'Quantity', selected.quantity],
                    ['🥗', 'Type', selected.type === 'veg' ? 'Vegetarian' : 'Non-Vegetarian'],
                    ['⏰', 'Expiry', new Date(selected.expiryTime).toLocaleString()],
                  ].map(([icon, label, value]) => (
                    <div key={label} className="flex items-center gap-3 text-sm">
                      <span className="text-base">{icon}</span>
                      <span className="text-[#686B78]">{label}:</span>
                      <span className="font-semibold text-[#282C3F]">{value}</span>
                    </div>
                  ))}
                  {selected.description && (
                    <p className="text-sm text-[#686B78] bg-[#F9F9F9] rounded-xl px-3 py-2.5 mt-2">📝 {selected.description}</p>
                  )}
                </div>

                {selected.donorId && (
                  <div className="mt-4 p-4 bg-[#F9F9F9] rounded-2xl">
                    <p className="text-xs font-semibold text-[#686B78] uppercase tracking-wider mb-3">Donor</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1BA672] overflow-hidden flex items-center justify-center flex-shrink-0">
                        {selected.donorId.profilePhoto
                          ? <img src={selected.donorId.profilePhoto} alt="" className="w-full h-full object-cover" />
                          : <span className="text-white font-bold">{selected.donorId.name?.[0]}</span>}
                      </div>
                      <div>
                        <p className="font-semibold text-[#282C3F] text-base">{selected.donorId.name}</p>
                        <p className="text-sm text-[#686B78]">{selected.donorId.phone}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {selected.location?.lat && (
                <div className="card">
                  <h4 className="font-semibold text-[#282C3F] mb-3 text-base">📍 Pickup Location</h4>
                  <LiveMap donorLocation={selected.location} height="180px" zoom={14} mode="admin" />
                </div>
              )}

              {selected.status === 'pending' && (
                <div className="card space-y-4">
                  <h4 className="font-display font-semibold text-[#282C3F] text-base">Assign Delivery Agent</h4>

                  {/* Admin Location Status */}
                  <div className="bg-[#F9F9F9] p-3 rounded-xl border border-[#E8E8E8]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-[#686B78]">Your Location (Drop-off)</span>
                      <button onClick={getLocation} className="text-xs font-semibold text-[#FC8019] hover:underline flex items-center gap-1">
                        {geoLoading ? '⏳ Fetching...' : '🔄 Refresh'}
                      </button>
                    </div>
                    {adminLoc ? (
                      <div className="flex items-center gap-2 text-sm text-[#1BA672] bg-[#E8F8F2] px-3 py-2 rounded-lg">
                        <span>✅</span> <span>Captured: {adminLoc.lat.toFixed(4)}, {adminLoc.lng.toFixed(4)}</span>
                      </div>
                    ) : geoError ? (
                      <div className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
                        ⚠️ {geoError}
                      </div>
                    ) : (
                      <div className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                        ⚠️ Waiting for location...
                      </div>
                    )}
                  </div>

                  <select value={assignAgentId} onChange={e => setAssignAgentId(e.target.value)} className="input-field">
                    <option value="">Select available agent...</option>
                    {availableAgents.map(a => (
                      <option key={a._id} value={a._id}>{a.name} · {a.vehicleType || 'Agent'}</option>
                    ))}
                  </select>
                  {availableAgents.length === 0 && (
                    <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-xl">⚠️ No agents available right now</p>
                  )}
                  <div className="flex gap-3">
                    <button onClick={() => handleReject(selected._id)} disabled={actionLoading}
                      className="flex-1 py-3 rounded-xl border-2 border-red-200 text-red-500 font-semibold text-base hover:bg-red-50 transition-colors disabled:opacity-60">
                      ❌ Reject
                    </button>
                    <button onClick={() => handleAccept(selected._id)} disabled={actionLoading || !assignAgentId}
                      className="flex-1 btn-primary disabled:opacity-60">
                      {actionLoading ? 'Assigning...' : '✅ Assign'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
