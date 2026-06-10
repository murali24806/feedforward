import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import LiveMap from '../components/LiveMap';
import { getMyDeliveries, updateDeliveryStatus, rejectDelivery, removeDelivery } from '../services/api';
import { getSocket } from '../services/socket';

const STEPS = [
  { status: 'accepted',   icon: '✅', label: 'Delivery Accepted',  desc: 'You accepted this delivery' },
  { status: 'in_transit', icon: '🗺️', label: 'Navigate to Donor',  desc: 'Head to the pickup location' },
  { status: 'picked_up',  icon: '📦', label: 'Pickup Completed',   desc: 'Food collected from donor' },
  { status: 'delivered',  icon: '🎉', label: 'Delivered!',         desc: 'Meal successfully delivered' },
];
const ORDER = ['assigned', 'accepted', 'in_transit', 'picked_up', 'delivered'];

const statusColors = {
  assigned:   'badge-orange',
  accepted:   'badge-green',
  in_transit: 'badge-green',
  picked_up:  'badge-orange',
  delivered:  'bg-[#1BA672]/10 text-[#1BA672] px-3 py-1 rounded-full text-sm font-semibold',
  rejected_by_agent: 'bg-red-100 text-red-500 px-3 py-1 rounded-full text-sm font-semibold',
};
const statusLabels = {
  assigned:   '⏳ New Assignment',
  accepted:   '✅ Accepted',
  in_transit: '🗺️ In Transit',
  picked_up:  '📦 Picked Up',
  delivered:  '🎉 Delivered',
  rejected_by_agent: '❌ Rejected',
};

const isValidLoc = (loc) =>
  loc != null &&
  loc.lat != null && loc.lng != null &&
  !isNaN(Number(loc.lat)) && !isNaN(Number(loc.lng)) &&
  !(Number(loc.lat) === 0 && Number(loc.lng) === 0);

export default function AgentDeliveries() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const [deliveries, setDeliveries]         = useState([]);
  const [selected, setSelected]             = useState(null);
  const [loading, setLoading]               = useState(true);
  const [actionLoading, setActionLoading]   = useState(false);
  const [rejectLoading, setRejectLoading]   = useState(false);
  const [removeLoading, setRemoveLoading]   = useState(false);
  const [liveEnabled, setLiveEnabled]       = useState(false);
  const [agentLocation, setAgentLocation]   = useState(null);
  const [geoError, setGeoError]             = useState('');
  const watchIdRef   = useRef(null);
  const detailRef    = useRef(null); // for mobile scroll

  /* fetch */
  useEffect(() => {
    const load = async () => {
      try {
        const res = await getMyDeliveries();
        setDeliveries(res.data);
        if (id) {
          const found = res.data.find(d => d._id === id);
          if (found) setSelected(found);
        } else {
          const active = res.data.find(d => !['delivered','rejected_by_agent'].includes(d.status));
          setSelected(active || res.data[0] || null);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  /* live GPS */
  useEffect(() => {
    if (!liveEnabled || !selected) return;
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported'); setLiveEnabled(false); return;
    }
    setGeoError('');
    const socket = getSocket();
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setAgentLocation(loc);
        socket.emit('agent:locationUpdate', {
          agentId:    selected.agentId?._id || selected.agentId,
          lat:        loc.lat,
          lng:        loc.lng,
          deliveryId: selected._id,
        });
      },
      (err) => { setGeoError('Location access denied — allow in browser settings.'); setLiveEnabled(false); },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
    return () => {
      if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    };
  }, [liveEnabled, selected?._id]);

  useEffect(() => {
    if (!liveEnabled && watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null;
    }
  }, [liveEnabled]);

  /* Auto-start GPS when status changes to in_transit */
  useEffect(() => {
    if (selected?.status === 'in_transit' && !liveEnabled) {
      setLiveEnabled(true);
    }
  }, [selected?.status]);

  const scrollToDetail = () => {
    // Scroll to detail panel on mobile after selecting
    setTimeout(() => {
      if (detailRef.current) {
        detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const selectDelivery = (del) => {
    setSelected(del);
    setAgentLocation(null);
    scrollToDetail();
  };

  const updateStatus = async (newStatus) => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await updateDeliveryStatus(selected._id, newStatus);
      const updated = { ...selected, status: newStatus };
      setSelected(updated);
      setDeliveries(ds => ds.map(d => d._id === selected._id ? updated : d));
      if (newStatus === 'delivered') setLiveEnabled(false);
      // Auto-enable GPS when navigating
      if (newStatus === 'in_transit') {
        setLiveEnabled(true);
      }
      getSocket().emit('delivery:statusChanged', { deliveryId: selected._id, status: newStatus });
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
    finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (!selected) return;
    if (!window.confirm('Reject this delivery assignment? It will be sent back for reassignment.')) return;
    setRejectLoading(true);
    try {
      await rejectDelivery(selected._id);
      const updated = { ...selected, status: 'rejected_by_agent' };
      setSelected(updated);
      setDeliveries(ds => ds.map(d => d._id === selected._id ? updated : d));
      setLiveEnabled(false);
    } catch (err) { alert(err.response?.data?.message || 'Failed to reject'); }
    finally { setRejectLoading(false); }
  };

  const handleRemove = async () => {
    if (!selected) return;
    if (!window.confirm('Remove this delivery from your list? This cannot be undone.')) return;
    setRemoveLoading(true);
    try {
      await removeDelivery(selected._id);
      const remaining = deliveries.filter(d => d._id !== selected._id);
      setDeliveries(remaining);
      setSelected(remaining[0] || null);
    } catch (err) { alert(err.response?.data?.message || 'Failed to remove'); }
    finally { setRemoveLoading(false); }
  };

  const getNextAction = (s) => {
    if (s === 'assigned')   return { label: '✅ Accept Delivery',        next: 'accepted' };
    if (s === 'accepted')   return { label: '🗺️ Start Navigation',       next: 'in_transit' };
    if (s === 'in_transit') return { label: '📦 Mark Pickup Complete',   next: 'picked_up' };
    if (s === 'picked_up')  return { label: '🎉 Mark as Delivered',      next: 'delivered' };
    return null;
  };

  const resolveDonorLoc = (sel) => {
    if (!sel) return null;
    const candidates = [sel?.foodPostId?.location, sel?.donorId?.location];
    for (const c of candidates) { if (isValidLoc(c)) return c; }
    return null;
  };

  const donorLoc = resolveDonorLoc(selected);
  const showMap  = selected && !['delivered','rejected_by_agent'].includes(selected.status);

  return (
    <DashboardLayout title="My Deliveries">
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Sidebar */}
        <div className="lg:w-72 flex-shrink-0">
          <h3 className="font-display text-xl font-bold text-[#282C3F] mb-4">All Assignments</h3>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="card h-20 animate-pulse bg-[#F4F4F4]"/>)}</div>
          ) : deliveries.length === 0 ? (
            <div className="card text-center py-8"><div className="text-4xl mb-2">📭</div><p className="text-[#93959F] text-sm">No deliveries yet</p></div>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              {deliveries.map(del => (
                <div key={del._id}
                  onClick={() => selectDelivery(del)}
                  className={`card cursor-pointer transition-all hover:shadow-md ${selected?._id===del._id?'ring-2 ring-[#FC8019]':''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#FC8019]/20 flex items-center justify-center text-xl flex-shrink-0">🍱</div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-[#282C3F] truncate">{del.foodPostId?.foodName||'Delivery'}</p>
                      <span className={`text-xs ${statusColors[del.status]||'badge-gray'}`}>{statusLabels[del.status]||del.status}</span>
                    </div>
                    {['delivered','rejected_by_agent'].includes(del.status) && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!window.confirm('Remove this delivery from your list?')) return;
                          try {
                            await removeDelivery(del._id);
                            const remaining = deliveries.filter(d => d._id !== del._id);
                            setDeliveries(remaining);
                            if (selected?._id === del._id) setSelected(remaining[0] || null);
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

        {/* Detail */}
        <div ref={detailRef} className="flex-1 space-y-5 scroll-mt-4">
          {selected ? (
            <>
              {/* Donor info */}
              <div className="card">
                <h3 className="font-display text-xl font-bold text-[#282C3F] mb-4">Pickup Details</h3>
                <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap">
                  <div className="w-14 h-14 rounded-2xl bg-[#1BA672] overflow-hidden flex items-center justify-center flex-shrink-0 shadow-md">
                    {selected.donorId?.profilePhoto
                      ? <img src={selected.donorId.profilePhoto} alt="" className="w-full h-full object-cover"/>
                      : <span className="text-white text-2xl font-bold">{selected.donorId?.name?.[0]}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#282C3F] text-lg">{selected.donorId?.name}</p>
                    <a href={`tel:${selected.donorId?.phone}`} className="text-sm text-[#1BA672] font-semibold hover:underline">
                      📞 {selected.donorId?.phone}
                    </a>
                    <p className="text-sm text-[#93959F] mt-1">
                      📍 {selected.donorId?.address || selected.foodPostId?.location?.address || 'Location on map below'}
                    </p>
                    {donorLoc && (
                      <p className="text-xs text-[#D0D0D0] mt-0.5">
                        Coords: {Number(donorLoc.lat).toFixed(5)}, {Number(donorLoc.lng).toFixed(5)}
                      </p>
                    )}
                  </div>
                  <span className={`flex-shrink-0 ${statusColors[selected.status]||'badge-gray'}`}>{statusLabels[selected.status]}</span>
                </div>

                {selected.foodPostId && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-xl flex items-center gap-3">
                    {selected.foodPostId.photo && (
                      <img src={selected.foodPostId.photo} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0"/>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-[#282C3F]">🍱 {selected.foodPostId.foodName}</p>
                      <p className="text-xs text-[#93959F] mt-0.5">
                        {selected.foodPostId.quantity} · {selected.foodPostId.type==='veg'?'🥦 Veg':'🍗 Non-veg'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── MAP ── */}
              {showMap && (
                <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="card p-0 overflow-hidden">
                  {/* Header */}
                  <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50">
                    <div>
                      <h3 className="font-semibold text-[#282C3F]">🗺️ Navigation Map</h3>
                      <p className="text-xs text-[#93959F] mt-0.5">
                        {selected.status === 'in_transit' ? 'Live GPS active — heading to donor' : 'Route to pickup location'}
                      </p>
                    </div>
                    {/* GPS toggle */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#686B78] font-medium">Live GPS</span>
                      <div
                        onClick={() => setLiveEnabled(v => !v)}
                        className={`relative w-12 h-6 rounded-full cursor-pointer transition-colors duration-300 ${liveEnabled?'bg-[#1BA672]':'bg-gray-200'}`}>
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${liveEnabled?'left-6':'left-0.5'}`}/>
                      </div>
                      {liveEnabled && <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse"/>}
                    </div>
                  </div>

                  {geoError && (
                    <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-xl text-xs">⚠️ {geoError}</div>
                  )}

                  {liveEnabled && agentLocation && (
                    <div className="mx-4 mt-3 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-xl text-xs flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>
                      GPS active · sharing live location with donor and admin
                    </div>
                  )}

                  {/* Map */}
                  <div className="p-4">
                    <LiveMap
                      agentLocation={agentLocation}
                      donorLocation={donorLoc}
                      height="340px"
                      showETA={true}
                      mode="agent"
                    />
                  </div>

                  {/* Legend */}
                  <div className="px-5 pb-4 flex items-center gap-6 text-xs text-[#93959F] flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-[#FC8019] flex items-center justify-center text-[10px]">🚴</div>
                      <span>Your location</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-[#1BA672] flex items-center justify-center text-[10px]">🏠</div>
                      <span>Pickup point</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-8 h-1 rounded bg-[#FC8019]"/>
                      <span>Route</span>
                    </div>
                    {!isValidLoc(donorLoc) && (
                      <span className="text-amber-500">⚠️ Pickup location not saved for this order</span>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── 4-step tracker ── */}
              <div className="card">
                <h3 className="font-display text-xl font-bold text-[#282C3F] mb-5">Delivery Progress</h3>
                <div className="relative">
                  <div className="absolute left-[21px] top-8 bottom-8 w-0.5 bg-[#F4F4F4]"/>
                  <div className="absolute left-[21px] top-8 w-0.5 bg-[#FC8019] transition-all duration-700"
                    style={{ height: `${Math.min((ORDER.indexOf(selected.status) / STEPS.length) * 100, 100)}%` }}/>
                  <div className="space-y-5">
                    {STEPS.map((step, idx) => {
                      const done   = ORDER.indexOf(selected.status) >= ORDER.indexOf(step.status);
                      const active = ORDER.indexOf(selected.status) === ORDER.indexOf(step.status) - 1;
                      return (
                        <motion.div key={step.status} initial={{opacity:0,x:-15}} animate={{opacity:1,x:0}} transition={{delay:idx*0.1}}
                          className="flex items-start gap-4 relative z-10">
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg flex-shrink-0 border-2 transition-all duration-500 ${done?'bg-[#FC8019] border-[#FC8019] shadow-md':active?'bg-white border-[#FC8019]':'bg-white border-[#F0F0F0]'}`}>
                            {done ? '✅' : step.icon}
                          </div>
                          <div className="flex-1 pt-2">
                            <p className={`font-semibold text-sm ${done?'text-[#282C3F]':'text-[#D0D0D0]'}`}>{step.label}</p>
                            <p className={`text-xs mt-0.5 ${done?'text-[#93959F]':'text-[#E8E8E8]'}`}>{step.desc}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Action buttons */}
                {selected.status === 'assigned' && (
                  <div className="flex gap-3 mt-6">
                    <motion.button
                      initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
                      onClick={handleReject}
                      disabled={rejectLoading || actionLoading}
                      className="flex-1 py-3 rounded-xl border-2 border-red-200 text-red-500 font-semibold text-base hover:bg-red-50 transition-colors disabled:opacity-60">
                      {rejectLoading ? 'Rejecting...' : '❌ Reject Order'}
                    </motion.button>
                    <motion.button
                      initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
                      onClick={() => updateStatus('accepted')}
                      disabled={actionLoading || rejectLoading}
                      className="flex-1 btn-secondary text-base disabled:opacity-60">
                      {actionLoading ? 'Updating...' : '✅ Accept Delivery'}
                    </motion.button>
                  </div>
                )}

                {selected.status !== 'delivered' && selected.status !== 'assigned' && selected.status !== 'rejected_by_agent' && (() => {
                  const action = getNextAction(selected.status);
                  return action ? (
                    <motion.button initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
                      onClick={() => updateStatus(action.next)} disabled={actionLoading}
                      className="btn-secondary w-full mt-6 text-base disabled:opacity-60">
                      {actionLoading
                        ? <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>Updating...
                          </span>
                        : action.label}
                    </motion.button>
                  ) : null;
                })()}

                {selected.status === 'rejected_by_agent' && (
                  <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}}
                    className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
                    <div className="text-4xl mb-2">❌</div>
                    <p className="font-display font-bold text-lg text-red-600">Order Rejected</p>
                    <p className="text-red-400 text-sm mt-1">This delivery has been sent back for reassignment.</p>
                    <div className="flex gap-3 mt-4 justify-center">
                      <button onClick={() => navigate('/agent')}
                        className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors">
                        Back to Dashboard
                      </button>
                      <button onClick={handleRemove} disabled={removeLoading}
                        className="bg-white border border-red-200 text-red-500 hover:bg-red-50 px-5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
                        {removeLoading ? 'Removing...' : '🗑️ Remove from List'}
                      </button>
                    </div>
                  </motion.div>
                )}

                {selected.status === 'delivered' && (
                  <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}}
                    className="mt-6 bg-gradient-to-br from-[#1BA672] to-[#138A5C] text-white rounded-2xl p-5 text-center">
                    <div className="text-4xl mb-2">🎉</div>
                    <p className="font-display font-bold text-lg">Delivery Completed!</p>
                    <p className="text-white/70 text-sm mt-1">Great work! The community thanks you.</p>
                    <div className="flex gap-3 mt-4 justify-center">
                      <button onClick={() => navigate('/agent')}
                        className="bg-white/20 hover:bg-white/30 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors">
                        Back to Dashboard
                      </button>
                      <button onClick={handleRemove} disabled={removeLoading}
                        className="bg-white/10 hover:bg-white/20 border border-white/30 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
                        {removeLoading ? 'Removing...' : '🗑️ Clear from List'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </>
          ) : (
            <div className="card text-center py-16">
              <div className="text-5xl mb-4">👈</div>
              <p className="font-display text-xl text-[#282C3F]">Select a delivery to view details</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}