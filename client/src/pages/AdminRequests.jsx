import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import LiveMap from '../components/LiveMap';
import { getAllFood, getAgents, acceptFood, rejectFood, getDeliveryById, getFoodById } from '../services/api';
import { useGeolocation } from '../hooks/useGeolocation';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socket';

const statusColors = {
  pending: 'badge-orange', accepted: 'badge-green', agent_assigned: 'badge-green',
  picked_up: 'badge-green', delivered: 'badge-green', rejected: 'badge-red',
};
const statusLabels = {
  pending: '⏳ Pending', accepted: '✅ Accepted', agent_assigned: '🚴 Assigned',
  picked_up: '📦 Picked Up', delivered: '🎉 Delivered', rejected: '❌ Rejected',
};

export default function AdminRequests() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [liveAgentLoc, setLiveAgentLoc] = useState(null);
  const [assignAgentId, setAssignAgentId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [liveBanner, setLiveBanner] = useState(null);
  const { location: adminLoc, error: geoError, loading: geoLoading, getLocation } = useGeolocation();
  const detailRef = useRef(null);

  const selectPost = async (post) => {
    setSelected(post);
    setAssignAgentId('');
    setSelectedDelivery(null);
    setLiveAgentLoc(null);

    setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    const delId = post.deliveryId?._id || post.deliveryId;
    if (delId) {
      try {
        const res = await getDeliveryById(delId);
        setSelectedDelivery(res.data);
        if (res.data?.agentLocation?.lat) {
          setLiveAgentLoc(res.data.agentLocation);
        }
      } catch (e) {
        console.error('Failed to load delivery for post:', e);
      }
    }
  };

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

    // ── Live Socket.IO Listeners ─────────────────────────────
    const socket = getSocket();
    socket.emit('joinAdminRoom');

    const handleNewPost = (data) => {
      if (data?.post) {
        setPosts(prev => {
          const exists = prev.some(p => p._id === data.post._id);
          if (exists) return prev;
          return [data.post, ...prev];
        });
        setLiveBanner(`🍱 New ${data.isBroadcast ? 'Open Broadcast' : 'Direct'} Donation from ${data.donorName}: "${data.post.foodName}"`);
        setTimeout(() => setLiveBanner(null), 6000);
      }
    };

    const handleClaimed = (data) => {
      if (data?.postId) {
        setPosts(prev => prev.map(p => {
          if (p._id === data.postId) {
            return {
              ...p,
              status: data.status || 'agent_assigned',
              claimedByAdmin: data.claimedByAdmin,
              adminId: data.claimedByAdmin
            };
          }
          return p;
        }));
        setSelected(curr => {
          if (curr && curr._id === data.postId) {
            return {
              ...curr,
              status: data.status || 'agent_assigned',
              claimedByAdmin: data.claimedByAdmin,
              adminId: data.claimedByAdmin
            };
          }
          return curr;
        });
      }
    };

    const handleStatusChanged = (data) => {
      if (data?.postId) {
        setPosts(prev => prev.map(p => p._id === data.postId ? { ...p, status: data.status } : p));
        setSelected(curr => curr && curr._id === data.postId ? { ...curr, status: data.status } : curr);
      }
    };

    socket.on('food:newPost', handleNewPost);
    socket.on('food:claimed', handleClaimed);
    socket.on('food:statusChanged', handleStatusChanged);

    return () => {
      socket.off('food:newPost', handleNewPost);
      socket.off('food:claimed', handleClaimed);
      socket.off('food:statusChanged', handleStatusChanged);
    };
  }, []);

  // ── Live Agent Location & Delivery Status Stream for Selected Post ──
  useEffect(() => {
    if (!selected) return;
    const socket = getSocket();
    const activeDelId = selected.deliveryId?._id || selected.deliveryId;
    const activeAgentId = selected.agentId?._id || selected.agentId;

    if (activeDelId) {
      socket.emit('joinDelivery', activeDelId);
    }

    const handleLocation = (data) => {
      if (data.lat != null && data.lng != null) {
        if (
          (data.deliveryId && data.deliveryId === activeDelId) ||
          (data.agentId && data.agentId === activeAgentId)
        ) {
          setLiveAgentLoc({ lat: Number(data.lat), lng: Number(data.lng) });
        }
      }
    };

    const handleDeliveryStatus = async (data) => {
      if (data.deliveryId === activeDelId) {
        try {
          const [fpRes, delRes] = await Promise.all([
            getFoodById(selected._id),
            getDeliveryById(data.deliveryId)
          ]);
          setSelected(fpRes.data);
          setSelectedDelivery(delRes.data);
          if (delRes.data?.agentLocation?.lat) {
            setLiveAgentLoc(delRes.data.agentLocation);
          }
        } catch (e) { console.error(e); }
      }
    };

    socket.on('agent:locationUpdate', handleLocation);
    socket.on('delivery:statusChanged', handleDeliveryStatus);

    return () => {
      socket.off('agent:locationUpdate', handleLocation);
      socket.off('delivery:statusChanged', handleDeliveryStatus);
    };
  }, [selected?._id, selected?.deliveryId, selected?.agentId]);

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
      {/* Live Alert Banner */}
      <AnimatePresence>
        {liveBanner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 bg-gradient-to-r from-[#FC8019] to-orange-500 text-white px-5 py-3.5 rounded-2xl shadow-md flex items-center justify-between gap-3 text-sm font-semibold"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl animate-bounce">🔔</span>
              <span>{liveBanner}</span>
            </div>
            <button onClick={() => setLiveBanner(null)} className="text-white/80 hover:text-white text-lg">×</button>
          </motion.div>
        )}
      </AnimatePresence>

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
              {filtered.map((post, i) => {
                const isClaimedByOther = post.isBroadcast && post.status !== 'pending' &&
                  (post.claimedByAdmin?._id || post.adminId?._id || post.adminId) !== user?._id;
                const isClaimedByMe = post.status !== 'pending' &&
                  (post.claimedByAdmin?._id || post.adminId?._id || post.adminId) === user?._id;

                return (
                  <motion.div key={post._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className={`card cursor-pointer hover:shadow-[0_4px_16px_rgba(40,44,63,0.14)] hover:-translate-y-0.5 transition-all duration-200 ${selected?._id === post._id ? 'ring-2 ring-[#FC8019]' : ''}`}
                    onClick={() => selectPost(post)}>
                    <div className="flex gap-4">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-[#F4F4F4] flex items-center justify-center">
                        {post.photo ? <img src={post.photo} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">🍱</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-[#282C3F] text-base">{post.foodName}</h4>
                            {post.isBroadcast ? (
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-700">
                                🌐 Open Broadcast
                              </span>
                            ) : (
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">
                                🏢 Direct Request
                              </span>
                            )}
                          </div>
                          <span className={statusColors[post.status] || 'badge-gray'}>{statusLabels[post.status]}</span>
                        </div>

                        {/* Claimed indicator banner */}
                        {isClaimedByOther && (
                          <div className="mb-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <span>🔒</span> Claimed by {post.claimedByAdmin?.organizationName || post.claimedByAdmin?.name || post.adminId?.organizationName || 'Another NGO'}
                          </div>
                        )}
                        {isClaimedByMe && post.isBroadcast && (
                          <div className="mb-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span>✅</span> Claimed by Your Organization
                          </div>
                        )}

                        <p className="text-sm text-[#686B78]">
                          <strong className="text-[#282C3F]">{post.donorId?.name || 'Donor'}</strong> · {post.quantity} · {post.type === 'veg' ? '🥦 Veg' : '🍗 Non-veg'}
                        </p>
                        <p className="text-xs text-[#93959F] mt-1">
                          📍 {post.location?.address || 'Location recorded'} · {new Date(post.createdAt).toLocaleString()}
                        </p>
                        <p className="text-xs text-amber-600 mt-0.5">⏰ Expires: {new Date(post.expiryTime).toLocaleString()}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selected && (
            <motion.div ref={detailRef} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} className="lg:w-96 flex-shrink-0 space-y-4 scroll-mt-4">
              <div className="card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-display text-lg font-bold text-[#282C3F]">{selected.foodName}</h3>
                    <div className="mt-1">
                      {selected.isBroadcast ? (
                        <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          🌐 Open Broadcast
                        </span>
                      ) : (
                        <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          🏢 Direct Request
                        </span>
                      )}
                    </div>
                  </div>
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
                    <p className="text-xs font-semibold text-[#686B78] uppercase tracking-wider mb-3">Donor Details</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1BA672] overflow-hidden flex items-center justify-center flex-shrink-0">
                        {selected.donorId.profilePhoto
                          ? <img src={selected.donorId.profilePhoto} alt="" className="w-full h-full object-cover" />
                          : <span className="text-white font-bold">{selected.donorId.name?.[0]}</span>}
                      </div>
                      <div>
                        <p className="font-semibold text-[#282C3F] text-base">{selected.donorId.name}</p>
                        <p className="text-sm text-[#686B78]">{selected.donorId.phone || 'No phone provided'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Navigation & Map Card */}
              {selected.location?.lat && (() => {
                const isAssigned = ['agent_assigned', 'in_transit', 'picked_up'].includes(selected.status);
                const isPickedUp = selected.status === 'picked_up';
                
                // Destination target: if picked up, courier is delivering to NGO drop-off; otherwise to donor
                const targetLoc = isPickedUp
                  ? (selectedDelivery?.adminLocation?.lat ? selectedDelivery.adminLocation : (adminLoc?.lat ? adminLoc : selected.location))
                  : selected.location;

                // Courier live location: from socket or loaded delivery record
                const currentAgentLoc = liveAgentLoc || (selectedDelivery?.agentLocation?.lat ? selectedDelivery.agentLocation : null);
                const agent = selected.agentId || selectedDelivery?.agentId;
                const vehicle = agent?.vehicleType || 'Courier';

                return (
                  <div className="card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{isPickedUp ? '🏢' : '📍'}</span>
                        <div>
                          <h4 className="font-bold text-[#282C3F] text-base leading-tight">
                            {isPickedUp ? 'Drop-Off Navigation' : isAssigned ? 'Pickup Route' : 'Pickup Location'}
                          </h4>
                          <p className="text-[11px] text-[#686B78]">
                            {isPickedUp
                              ? 'Courier is heading to your NGO facility'
                              : isAssigned
                              ? 'Courier is navigating to donor doorstep'
                              : 'Donation collection point'}
                          </p>
                        </div>
                      </div>

                      {/* External Maps Navigation Link */}
                      <a
                        href={
                          currentAgentLoc && targetLoc
                            ? `https://www.google.com/maps/dir/?api=1&origin=${currentAgentLoc.lat},${currentAgentLoc.lng}&destination=${targetLoc.lat},${targetLoc.lng}&travelmode=driving`
                            : `https://www.google.com/maps/search/?api=1&query=${targetLoc.lat},${targetLoc.lng}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-[#007AFF] hover:underline flex items-center gap-1 bg-[#007AFF]/10 px-2.5 py-1 rounded-full"
                        title="Launch voice turn-by-turn navigation in Google Maps"
                      >
                        <span>🧭 GPS Maps</span>
                        <span className="text-[10px]">↗</span>
                      </a>
                    </div>

                    {/* Live Navigation Map with Courier & Route */}
                    <div className="rounded-2xl overflow-hidden shadow-inner">
                      <LiveMap
                        agentLocation={currentAgentLoc}
                        donorLocation={targetLoc}
                        height="280px"
                        showETA={true}
                        mode="admin"
                        zoom={15}
                      />
                    </div>

                    {/* Assigned Courier Live Strip (Visible to NGO Admin) */}
                    {isAssigned && agent && (
                      <div className="p-3.5 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-200/60 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-[#FC8019] text-white flex items-center justify-center font-bold text-base flex-shrink-0 shadow-sm overflow-hidden">
                            {agent.profilePhoto ? (
                              <img src={agent.profilePhoto} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>{agent.name?.[0] || '🚴'}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-sm text-[#282C3F] truncate">{agent.name}</p>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-[#FC8019] border border-orange-200">
                                {vehicle}
                              </span>
                            </div>
                            <p className="text-xs text-[#686B78] flex items-center gap-1 mt-0.5">
                              {currentAgentLoc ? (
                                <span className="text-[#34C759] font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse" />
                                  GPS Broadcasting Live
                                </span>
                              ) : (
                                <span>Awaiting agent GPS launch</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {agent.phone && (
                          <a
                            href={`tel:${agent.phone}`}
                            className="bg-white hover:bg-orange-50 border border-orange-200 text-[#FC8019] text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all flex-shrink-0"
                            title="Call Courier"
                          >
                            <span>📞</span>
                            <span>Call</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Status Action Cards */}
              {selected.status === 'pending' ? (
                <div className="card space-y-4">
                  <h4 className="font-display font-semibold text-[#282C3F] text-base">
                    {selected.isBroadcast ? '⚡ Claim & Assign Delivery Agent' : 'Assign Delivery Agent'}
                  </h4>

                  {selected.isBroadcast && (
                    <div className="bg-purple-50 p-3 rounded-xl border border-purple-200 text-xs text-purple-800">
                      📢 <strong>First-to-claim donation:</strong> By assigning an agent, your organization claims this donation for pickup.
                    </div>
                  )}

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
                      {actionLoading ? 'Assigning...' : '✅ Accept & Dispatch'}
                    </button>
                  </div>
                </div>
              ) : selected.isBroadcast && (selected.claimedByAdmin?._id || selected.adminId?._id || selected.adminId) !== user?._id ? (
                <div className="card bg-amber-50/90 border border-amber-200 p-5 rounded-2xl">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">🔒</span>
                    <div>
                      <h4 className="font-bold text-amber-950 text-base">Claimed by Another NGO</h4>
                      <p className="text-xs text-amber-800 mt-1.5 leading-relaxed">
                        This open donation was accepted by <strong>{selected.claimedByAdmin?.organizationName || selected.claimedByAdmin?.name || selected.adminId?.organizationName || 'Another NGO'}</strong>.
                      </p>
                      <div className="mt-2.5 inline-block text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-200/60 text-amber-900">
                        Current Status: {statusLabels[selected.status] || selected.status}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card bg-emerald-50/90 border border-emerald-200 p-5 rounded-2xl">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">🚴</span>
                    <div>
                      <h4 className="font-bold text-emerald-950 text-base">Managed by Your Organization</h4>
                      <p className="text-xs text-emerald-800 mt-1">
                        Agent: <strong>{selected.agentId?.name || selectedDelivery?.agentId?.name || 'Assigned Agent'}</strong>
                      </p>
                      <div className="mt-2.5 inline-block text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-200/60 text-emerald-900">
                        {statusLabels[selected.status] || selected.status}
                      </div>
                    </div>
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
