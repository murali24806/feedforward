import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import LiveMap from '../components/LiveMap';
import { getAllDeliveries, getDeliveryById, removeDelivery } from '../services/api';
import { getSocket } from '../services/socket';

const COLUMNS = [
  { key: 'assigned', label: 'Pending', icon: '⏳', color: '#FC8019' },
  { key: 'in_transit', label: 'In Progress', icon: '🚴', color: '#138A5C' },
  { key: 'picked_up', label: 'Picked Up', icon: '📦', color: '#1BA672' },
  { key: 'delivered', label: 'Delivered', icon: '✅', color: '#282C3F' },
  { key: 'rejected_by_agent', label: 'Rejected', icon: '❌', color: '#EF4444' },
];

const isValidLoc = (loc) =>
  loc != null &&
  loc.lat != null && loc.lng != null &&
  !isNaN(Number(loc.lat)) && !isNaN(Number(loc.lng)) &&
  !(Number(loc.lat) === 0 && Number(loc.lng) === 0);

const resolveTargetLoc = (d) => {
  if (!d) return null;
  if (d.status === 'picked_up') {
    if (isValidLoc(d.adminLocation)) return d.adminLocation;
    if (isValidLoc(d.adminId?.location)) return d.adminId.location;
    return null;
  }
  if (isValidLoc(d.foodPostId?.location)) return d.foodPostId.location;
  if (isValidLoc(d.donorId?.location)) return d.donorId.location;
  return null;
};

export default function AdminDeliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('kanban'); // 'kanban' | 'list'
  const [removingId, setRemovingId] = useState(null);

  // Live Navigation Modal State
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [liveAgentLoc, setLiveAgentLoc] = useState(null);

  useEffect(() => {
    getAllDeliveries()
      .then(res => setDeliveries(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Real-time socket events for live courier GPS & delivery updates
  useEffect(() => {
    const socket = getSocket();
    socket.emit('joinAdminRoom');

    const onLocationUpdate = ({ agentId, lat, lng, deliveryId }) => {
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
      if (selectedDelivery) {
        const curAgentId = selectedDelivery.agentId?._id || selectedDelivery.agentId;
        if (curAgentId === agentId || selectedDelivery._id === deliveryId) {
          setLiveAgentLoc({ lat: Number(lat), lng: Number(lng) });
        }
      }
    };

    const onStatusChanged = ({ deliveryId, status }) => {
      setDeliveries(prev => prev.map(d => d._id === deliveryId ? { ...d, status } : d));
      if (selectedDelivery?._id === deliveryId) {
        setSelectedDelivery(prev => prev ? { ...prev, status } : null);
      }
    };

    socket.on('agent:locationUpdate', onLocationUpdate);
    socket.on('delivery:statusChanged', onStatusChanged);

    return () => {
      socket.off('agent:locationUpdate', onLocationUpdate);
      socket.off('delivery:statusChanged', onStatusChanged);
    };
  }, [selectedDelivery]);

  const openLiveTracking = async (del, e) => {
    e?.stopPropagation();
    setSelectedDelivery(del);
    if (isValidLoc(del.agentLocation)) {
      setLiveAgentLoc({ lat: Number(del.agentLocation.lat), lng: Number(del.agentLocation.lng) });
    } else {
      setLiveAgentLoc(null);
    }

    const socket = getSocket();
    socket.emit('join:delivery', del._id);

    try {
      const res = await getDeliveryById(del._id);
      if (res.data) {
        setSelectedDelivery(res.data);
        if (isValidLoc(res.data.agentLocation)) {
          setLiveAgentLoc({ lat: Number(res.data.agentLocation.lat), lng: Number(res.data.agentLocation.lng) });
        }
      }
    } catch (err) {
      console.error('Error fetching delivery details for modal:', err);
    }
  };

  const closeLiveTracking = () => {
    if (selectedDelivery) {
      const socket = getSocket();
      socket.emit('leave:delivery', selectedDelivery._id);
    }
    setSelectedDelivery(null);
    setLiveAgentLoc(null);
  };

  const getByStatus = (status) => deliveries.filter(d => d.status === status);

  const handleRemove = async (del, e) => {
    e.stopPropagation();
    if (!window.confirm(`Remove this delivery from the board?`)) return;
    setRemovingId(del._id);
    try {
      await removeDelivery(del._id);
      setDeliveries(prev => prev.filter(d => d._id !== del._id));
      if (selectedDelivery?._id === del._id) {
        closeLiveTracking();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove');
    } finally {
      setRemovingId(null);
    }
  };

  const completedStatuses = ['delivered', 'rejected_by_agent'];

  // Current target location for the open modal
  const modalTargetLoc = selectedDelivery ? resolveTargetLoc(selectedDelivery) : null;
  const currentAgentLoc = liveAgentLoc || selectedDelivery?.agentLocation;
  const hasValidAgentLoc = isValidLoc(currentAgentLoc);
  const hasValidTargetLoc = isValidLoc(modalTargetLoc);

  return (
    <DashboardLayout title="Deliveries">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#282C3F]">Delivery Overview</h2>
          <p className="text-[#93959F] text-sm mt-1">{deliveries.length} total deliveries · Click any delivery to open live navigation</p>
        </div>
        <div className="flex gap-2">
          {['kanban','list'].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${view === v ? 'bg-[#1BA672] text-white' : 'bg-white text-[#686B78]'}`}>
              {v === 'kanban' ? '⊞ Kanban' : '☰ List'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="card h-64 animate-pulse bg-[#F4F4F4]" />)}
        </div>
      ) : view === 'kanban' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 overflow-x-auto">
          {COLUMNS.map(col => {
            const items = getByStatus(col.key);
            const isCompletedCol = completedStatuses.includes(col.key);
            return (
              <div key={col.key} className="min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{col.icon}</span>
                  <h3 className="font-semibold text-sm text-[#282C3F]">{col.label}</h3>
                  <span className="ml-auto bg-[#F4F4F4] text-[#686B78] text-xs font-bold px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
                <div className="space-y-3 min-h-[200px]">
                  {items.map((del, i) => {
                    const hasAgent = !!del.agentId;
                    const isOnline = isValidLoc(del.agentLocation);
                    return (
                      <motion.div 
                        key={del._id} 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ delay: i * 0.05 }}
                        onClick={(e) => openLiveTracking(del, e)}
                        className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-[#1BA672]/30 transition-all relative group cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-1 mb-2">
                          <p className="font-semibold text-sm text-[#282C3F] truncate">{del.foodPostId?.foodName || 'Food'}</p>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} title={isOnline ? 'Live GPS Active' : 'Offline GPS'} />
                        </div>

                        <div className="space-y-1.5 mb-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-[#1BA672]/20 flex items-center justify-center text-xs flex-shrink-0">🤲</div>
                            <span className="text-xs text-[#686B78] truncate">{del.donorId?.name || 'Donor'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-[#FC8019]/20 flex items-center justify-center text-xs flex-shrink-0">🚴</div>
                            <span className="text-xs text-[#686B78] truncate">{del.agentId?.name || 'Agent unassigned'}</span>
                          </div>
                        </div>

                        {/* Live Navigation CTA pill */}
                        <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={(e) => openLiveTracking(del, e)}
                            className="text-[11px] font-semibold text-[#1BA672] hover:text-[#138A5C] flex items-center gap-1 bg-[#1BA672]/10 px-2 py-1 rounded-lg transition-colors"
                          >
                            <span>🧭</span>
                            <span>Live Nav</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400">{new Date(del.createdAt).toLocaleDateString()}</span>
                            {isCompletedCol && (
                              <button
                                onClick={(e) => handleRemove(del, e)}
                                disabled={removingId === del._id}
                                className="w-6 h-6 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 text-xs disabled:opacity-40 ml-1"
                                title="Remove delivery"
                              >
                                {removingId === del._id ? '…' : '🗑️'}
                              </button>
                            )}
                          </div>
                        </div>

                        {del.deliveryPhoto && (
                          <div className="mt-3">
                            <p className="text-[10px] text-[#93959F] mb-1 font-semibold">Delivery Proof</p>
                            <img src={del.deliveryPhoto} alt="Proof" className="w-full h-24 object-cover rounded-lg border border-gray-100 shadow-sm" />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="text-center py-8 text-gray-300 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                      No deliveries
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="text-left text-xs text-[#93959F] uppercase border-b border-gray-100">
                <th className="pb-3 pr-4">Food</th>
                <th className="pb-3 pr-4">Donor</th>
                <th className="pb-3 pr-4">Agent</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {deliveries.map((del, i) => (
                <motion.tr 
                  key={del._id} 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  transition={{ delay: i * 0.03 }} 
                  className="hover:bg-gray-50/70 cursor-pointer transition-colors"
                  onClick={(e) => openLiveTracking(del, e)}
                >
                  <td className="py-3 pr-4 font-medium text-sm text-[#282C3F]">{del.foodPostId?.foodName || '—'}</td>
                  <td className="py-3 pr-4 text-sm text-[#686B78]">{del.donorId?.name || '—'}</td>
                  <td className="py-3 pr-4 text-sm text-[#686B78]">{del.agentId?.name || '—'}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                      del.status === 'delivered' ? 'bg-[#1BA672]/10 text-[#1BA672]' :
                      del.status === 'rejected_by_agent' ? 'bg-red-100 text-red-500' :
                      del.status === 'in_transit' ? 'bg-[#FC8019]/20 text-[#E8720C]' :
                      'bg-[#F4F4F4] text-gray-600'}`}>
                      {del.status.replace(/_/g, ' ')}
                    </span>
                    {del.deliveryPhoto && (
                      <a href={del.deliveryPhoto} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="block mt-1 text-[10px] text-blue-500 hover:underline">
                        View Photo
                      </a>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs text-[#93959F]">{new Date(del.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => openLiveTracking(del, e)}
                        className="flex items-center gap-1 text-xs font-semibold text-[#1BA672] bg-[#1BA672]/10 hover:bg-[#1BA672]/20 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <span>🧭 Live Track</span>
                      </button>
                      {completedStatuses.includes(del.status) && (
                        <button
                          onClick={(e) => handleRemove(del, e)}
                          disabled={removingId === del._id}
                          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                        >
                          {removingId === del._id ? 'Removing…' : '🗑️'}
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── LIVE NAVIGATION MODAL ── */}
      <AnimatePresence>
        {selectedDelivery && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh] border border-gray-100"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#1BA672]/10 flex items-center justify-center text-xl shadow-sm">
                    🧭
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-bold text-[#282C3F]">
                        Live Navigation Tracking
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                        selectedDelivery.status === 'delivered' ? 'bg-green-100 text-green-700' :
                        selectedDelivery.status === 'in_transit' ? 'bg-orange-100 text-orange-700' :
                        selectedDelivery.status === 'picked_up' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {selectedDelivery.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-[#93959F]">
                      {selectedDelivery.foodPostId?.foodName || 'Food Item'} · Real-time GPS & Road Navigation
                    </p>
                  </div>
                </div>

                <button
                  onClick={closeLiveTracking}
                  className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="overflow-y-auto flex-1 p-5 space-y-4">
                {/* LiveMap Component */}
                <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative">
                  <LiveMap
                    agentLocation={currentAgentLoc}
                    donorLocation={modalTargetLoc}
                    height="380px"
                    showETA={true}
                    mode="admin"
                  />
                </div>

                {/* Courier & Route Details Bar */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Courier Card */}
                  <div className="bg-[#F9F9F9] rounded-2xl p-4 border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#FC8019] flex items-center justify-center text-white font-bold text-lg overflow-hidden shadow-sm flex-shrink-0">
                        {selectedDelivery.agentId?.profilePhoto ? (
                          <img src={selectedDelivery.agentId.profilePhoto} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>{selectedDelivery.agentId?.name?.[0] || 'A'}</span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-[#282C3F]">{selectedDelivery.agentId?.name || 'Unassigned Courier'}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            hasValidAgentLoc ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {hasValidAgentLoc ? '● GPS Online' : '○ Standby'}
                          </span>
                        </div>
                        <p className="text-xs text-[#93959F] mt-0.5">
                          {selectedDelivery.agentId?.vehicleType || 'Motorbike'} · {selectedDelivery.agentId?.phone || 'No phone'}
                        </p>
                      </div>
                    </div>

                    {selectedDelivery.agentId?.phone && (
                      <a
                        href={`tel:${selectedDelivery.agentId.phone}`}
                        className="w-10 h-10 rounded-xl bg-[#1BA672] hover:bg-[#138A5C] text-white flex items-center justify-center text-sm shadow-md transition-transform active:scale-95 flex-shrink-0"
                        title="Call Courier"
                      >
                        📞
                      </a>
                    )}
                  </div>

                  {/* Donor / Destination Card */}
                  <div className="bg-[#F9F9F9] rounded-2xl p-4 border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#1BA672] flex items-center justify-center text-white text-xl shadow-sm flex-shrink-0">
                        {selectedDelivery.status === 'picked_up' ? '🏢' : '🏠'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-[#282C3F] truncate">
                          {selectedDelivery.status === 'picked_up'
                            ? (selectedDelivery.adminId?.organizationName || 'NGO Drop-off Facility')
                            : (selectedDelivery.donorId?.name || 'Donor Pickup')}
                        </p>
                        <p className="text-xs text-[#93959F] truncate mt-0.5">
                          {selectedDelivery.status === 'picked_up'
                            ? (selectedDelivery.adminLocation?.address || selectedDelivery.adminId?.address || 'NGO Office')
                            : (selectedDelivery.foodPostId?.pickupAddress || selectedDelivery.donorId?.address || 'Pickup Point')}
                        </p>
                      </div>
                    </div>

                    {selectedDelivery.donorId?.phone && selectedDelivery.status !== 'picked_up' && (
                      <a
                        href={`tel:${selectedDelivery.donorId.phone}`}
                        className="w-10 h-10 rounded-xl bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center text-sm shadow-md transition-transform active:scale-95 flex-shrink-0"
                        title="Call Donor"
                      >
                        📞
                      </a>
                    )}
                  </div>
                </div>

                {/* External Turn-by-Turn Navigation Shortcut */}
                {hasValidAgentLoc && hasValidTargetLoc && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">🗺️</span>
                      <div>
                        <p className="text-xs font-bold text-emerald-900">External GPS Turn-by-Turn Navigation</p>
                        <p className="text-[11px] text-emerald-700">Open route in Google Maps app with real-time audio guidance</p>
                      </div>
                    </div>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&origin=${currentAgentLoc.lat},${currentAgentLoc.lng}&destination=${modalTargetLoc.lat},${modalTargetLoc.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-[#1BA672] hover:bg-[#138A5C] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                    >
                      <span>Open in Maps</span>
                      <span>↗</span>
                    </a>
                  </div>
                )}

                {/* Proof of Delivery if Available */}
                {selectedDelivery.deliveryPhoto && (
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                    <p className="text-xs font-bold text-[#282C3F] mb-2 flex items-center gap-1.5">
                      <span>📸</span> Proof of Delivery Photo
                    </p>
                    <img
                      src={selectedDelivery.deliveryPhoto}
                      alt="Delivery Proof"
                      className="w-full max-h-60 object-cover rounded-xl border border-gray-200 shadow-sm"
                    />
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                <span className="text-xs text-[#93959F]">
                  Delivery ID: <span className="font-mono">{selectedDelivery._id}</span>
                </span>
                <button
                  type="button"
                  onClick={closeLiveTracking}
                  className="bg-[#282C3F] hover:bg-black text-white px-5 py-2 rounded-xl text-xs font-bold transition-colors"
                >
                  Close Navigation
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

