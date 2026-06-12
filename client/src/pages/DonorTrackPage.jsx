import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import TrackingTimeline from '../components/TrackingTimeline';
import LiveMap from '../components/LiveMap';
import { getMyFood, getFoodById, getDeliveryById, getDonorDeliveries, removeDelivery } from '../services/api';
import { getSocket } from '../services/socket';

const statusColors = {
  pending: 'badge-gray',
  accepted: 'badge-green',
  agent_assigned: 'badge-green',
  picked_up: 'badge-orange',
  delivered: 'badge-green',
  rejected: 'bg-red-100 text-red-600 px-3 py-1 rounded-full text-sm font-semibold'
};
const statusLabels = {
  pending: '⏳ Pending',
  accepted: '✅ Accepted',
  agent_assigned: '🚴 Agent Assigned',
  picked_up: '📦 Picked Up',
  delivered: '🎉 Delivered',
  rejected: '❌ Rejected'
};

// Safe location check
const isValidLocation = (loc) =>
  loc &&
  loc.lat != null && loc.lng != null &&
  !isNaN(Number(loc.lat)) && !isNaN(Number(loc.lng));

export default function DonorTrackPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [agentLocation, setAgentLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [removeLoading, setRemoveLoading] = useState(false);
  const detailRef = useRef(null);

  const fetchAll = async () => {
    try {
      const res = await getMyFood();
      setPosts(res.data);
      let targetPost = null;
      if (id) {
        targetPost = res.data.find(p => p._id === id);
      } else if (res.data.length > 0) {
        targetPost = res.data[0];
      }
      if (targetPost) {
        setSelected(targetPost);
        if (targetPost.deliveryId) {
          try {
            const dr = await getDeliveryById(
              typeof targetPost.deliveryId === 'object'
                ? targetPost.deliveryId._id
                : targetPost.deliveryId
            );
            setDelivery(dr.data);
            // Pre-load agent location from delivery if available
            if (isValidLocation(dr.data?.agentLocation)) {
              setAgentLocation(dr.data.agentLocation);
            }
          } catch (e) { console.error('Delivery fetch err:', e); }
        }
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [id]);

  // Select a post from sidebar
  const selectPost = async (post) => {
    setSelected(post);
    setDelivery(null);
    setAgentLocation(null);
    // Scroll to detail on mobile
    setTimeout(() => {
      if (detailRef.current) {
        detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
    if (post.deliveryId) {
      try {
        const dr = await getDeliveryById(
          typeof post.deliveryId === 'object' ? post.deliveryId._id : post.deliveryId
        );
        setDelivery(dr.data);
        if (isValidLocation(dr.data?.agentLocation)) {
          setAgentLocation(dr.data.agentLocation);
        }
      } catch (e) { console.error(e); }
    }
  };

  // Socket: live location + status updates
  useEffect(() => {
    if (!delivery?._id) return;
    const socket = getSocket();
    const deliveryId = typeof delivery._id === 'object' ? delivery._id.toString() : delivery._id;
    socket.emit('joinDelivery', deliveryId);

    const handleLocation = (data) => {
      // We're already in the delivery-specific socket room, so any
      // location update here belongs to our agent. Accept it directly.
      if (data.lat != null && data.lng != null) {
        setAgentLocation({ lat: data.lat, lng: data.lng });
      }
    };

    const handleStatusChange = async (data) => {
      if (data.deliveryId === deliveryId) {
        try {
          const fp = await getFoodById(selected._id);
          setSelected(fp.data);
          const dr = await getDeliveryById(deliveryId);
          setDelivery(dr.data);
          if (isValidLocation(dr.data?.agentLocation)) {
            setAgentLocation(dr.data.agentLocation);
          }
        } catch (e) { console.error(e); }
      }
    };

    socket.on('agent:locationUpdate', handleLocation);
    socket.on('delivery:statusChanged', handleStatusChange);

    return () => {
      socket.off('agent:locationUpdate', handleLocation);
      socket.off('delivery:statusChanged', handleStatusChange);
    };
  }, [delivery?._id]);

  // Should we show map?
  const showMap = selected && ['accepted', 'agent_assigned', 'in_transit', 'picked_up'].includes(selected.status);
  // Use agent location from socket OR from saved delivery record
  const mapAgentLoc = agentLocation || (isValidLocation(delivery?.agentLocation) ? delivery.agentLocation : null);
  
  // Resolve target location based on status
  const resolveTargetLoc = (post, del) => {
    if (post?.status === 'picked_up') {
      return del?.adminLocation && isValidLocation(del.adminLocation) ? del.adminLocation : null;
    }
    return isValidLocation(post?.location) ? post.location : null;
  };
  
  const mapDonorLoc = resolveTargetLoc(selected, delivery);

  return (
    <DashboardLayout title="My Donations">
      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── Sidebar: donations list ── */}
        <div className="lg:w-80 flex-shrink-0">
          <h3 className="font-display text-xl font-bold text-[#282C3F] mb-4">All Donations</h3>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="card h-20 animate-pulse bg-[#F4F4F4]" />)}
            </div>
          ) : posts.length === 0 ? (
            <div className="card text-center py-8">
              <div className="text-4xl mb-2">🍽️</div>
              <p className="text-[#93959F] text-sm">No donations yet</p>
              <button onClick={() => navigate('/donor/post')} className="btn-primary mt-3 text-sm px-4 py-2">Post Food</button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
              {posts.map((post) => (
                <div
                  key={post._id}
                  onClick={() => selectPost(post)}
                  className={`card cursor-pointer transition-all hover:shadow-lg ${selected?._id === post._id ? 'ring-2 ring-[#1BA672]' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#1BA672]/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {post.photo
                        ? <img src={post.photo} alt="" className="w-full h-full object-cover" />
                        : <span className="text-2xl">🍱</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-[#282C3F] truncate">{post.foodName}</p>
                      <span className={`text-xs ${statusColors[post.status] || 'badge-gray'}`}>
                        {statusLabels[post.status] || post.status}
                      </span>
                    </div>
                    {post.status === 'delivered' && post.deliveryId && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!window.confirm('Remove this delivery from your list?')) return;
                          try {
                            const delivId = typeof post.deliveryId === 'object' ? post.deliveryId._id : post.deliveryId;
                            await removeDelivery(delivId);
                            const remaining = posts.filter(p => p._id !== post._id);
                            setPosts(remaining);
                            if (selected?._id === post._id) { setSelected(remaining[0] || null); setDelivery(null); }
                          } catch (err) { alert(err.response?.data?.message || 'Failed to remove'); }
                        }}
                        className="flex-shrink-0 w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors"
                        title="Remove from list"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Main detail panel ── */}
        <div ref={detailRef} className="flex-1 space-y-5 scroll-mt-4">
          {selected ? (
            <>
              {/* Food info card */}
              <div className="card">
                <div className="flex gap-4 flex-wrap sm:flex-nowrap">
                  {selected.photo && (
                    <img src={selected.photo} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-xl font-bold text-[#282C3F]">{selected.foodName}</h3>
                    <p className="text-sm text-[#686B78] mt-1">
                      {selected.quantity} · {selected.type === 'veg' ? '🥦 Veg' : '🍗 Non-veg'}
                    </p>
                    {selected.description && (
                      <p className="text-sm text-[#93959F] mt-1">{selected.description}</p>
                    )}
                    <p className="text-xs text-[#D0D0D0] mt-2">
                      Posted {new Date(selected.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={statusColors[selected.status] || 'badge-gray'}>
                      {statusLabels[selected.status] || selected.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── LIVE MAP — Swiggy style ── */}
              {showMap && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card p-0 overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50">
                    <div>
                      <h3 className="font-semibold text-[#282C3F]">
                        {selected.status === 'picked_up' ? '📦 Food Picked Up' : '🚴 Agent On The Way'}
                      </h3>
                      <p className="text-xs text-[#93959F] mt-0.5">
                        {selected.status === 'picked_up'
                          ? 'Food collected — heading to delivery destination'
                          : selected.status === 'in_transit'
                          ? 'Your agent is navigating to collect the food — live GPS active'
                          : 'Your agent has been assigned and will head to you shortly'}
                      </p>
                    </div>
                    {mapAgentLoc && (
                      <div className="flex items-center gap-1.5 bg-[#1BA672]/10 px-3 py-1.5 rounded-full">
                        <div className="w-2 h-2 bg-[#1BA672] rounded-full animate-pulse" />
                        <span className="text-xs font-semibold text-[#1BA672]">Live</span>
                      </div>
                    )}
                  </div>

                  {/* Map */}
                  <div className="px-4 py-4">
                    <LiveMap
                      agentLocation={mapAgentLoc}
                      donorLocation={mapDonorLoc}
                      height="320px"
                      showETA={true}
                      mode="donor"
                    />
                  </div>

                  {/* Agent info strip */}
                  {selected.agentId && (
                    <div className="px-5 py-4 bg-[#FC8019]/5 border-t border-[#F4A261]/20 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-[#FC8019] overflow-hidden flex-shrink-0 flex items-center justify-center shadow-md">
                          {selected.agentId?.profilePhoto
                            ? <img src={selected.agentId.profilePhoto} alt="" className="w-full h-full object-cover" />
                            : <span className="text-white font-bold text-lg">{selected.agentId?.name?.[0]}</span>}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-[#282C3F]">{selected.agentId?.name}</p>
                          <p className="text-xs text-[#93959F]">
                            {selected.agentId?.vehicleType || 'Motorbike'} · {selected.agentId?.phone}
                          </p>
                        </div>
                      </div>
                      <a
                        href={`tel:${selected.agentId?.phone}`}
                        className="w-10 h-10 rounded-full bg-[#1BA672] flex items-center justify-center text-white shadow-md hover:bg-[#138A5C] transition-colors"
                      >
                        📞
                      </a>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Delivered celebration */}
              {selected.status === 'delivered' && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="card bg-gradient-to-br from-[#1BA672] to-[#138A5C] text-white text-center py-8"
                >
                  <div className="text-5xl mb-3">🎉</div>
                  <h3 className="font-display text-2xl font-bold">Successfully Delivered!</h3>
                  <p className="text-white/70 mt-2">Your food reached someone in need. Thank you!</p>
                  {delivery?.deliveryPhoto && (
                    <div className="mt-4 flex justify-center">
                      <div className="bg-white/20 p-2 rounded-2xl">
                        <img src={delivery.deliveryPhoto} alt="Delivery Proof" className="w-48 h-48 object-cover rounded-xl shadow-lg border-2 border-white/30" />
                        <p className="text-xs text-white/80 mt-2 font-medium">Delivery Proof</p>
                      </div>
                    </div>
                  )}
                  {delivery?._id && (
                    <button
                      onClick={async () => {
                        if (!window.confirm('Remove this donation record from your list?')) return;
                        setRemoveLoading(true);
                        try {
                          await removeDelivery(delivery._id);
                          const remaining = posts.filter(p => p._id !== selected._id);
                          setPosts(remaining);
                          setSelected(remaining[0] || null);
                          setDelivery(null);
                        } catch (err) { alert(err.response?.data?.message || 'Failed to remove'); }
                        finally { setRemoveLoading(false); }
                      }}
                      disabled={removeLoading}
                      className="mt-4 bg-white/10 hover:bg-white/20 border border-white/30 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
                    >
                      {removeLoading ? 'Removing…' : '🗑️ Clear from List'}
                    </button>
                  )}
                </motion.div>
              )}

              {/* Timeline */}
              <TrackingTimeline
                foodPost={selected}
                delivery={delivery}
                agent={selected.agentId}
              />
            </>
          ) : (
            <div className="card text-center py-16">
              <div className="text-5xl mb-4">👈</div>
              <p className="font-display text-xl text-[#282C3F]">Select a donation to track</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
