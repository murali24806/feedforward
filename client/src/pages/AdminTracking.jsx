import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import { getAllDeliveries, getAgents } from '../services/api';
import { getSocket } from '../services/socket';

const isValidLoc = (loc) =>
  loc != null &&
  loc.lat != null && loc.lng != null &&
  !isNaN(Number(loc.lat)) && !isNaN(Number(loc.lng)) &&
  !(Number(loc.lat) === 0 && Number(loc.lng) === 0);

export default function AdminTracking() {
  const mapRef          = useRef(null);
  const mapInstanceRef  = useRef(null);
  const agentMarkersRef = useRef({});   // agentId  → Leaflet marker
  const donorMarkersRef = useRef({});   // deliveryId → Leaflet marker
  const routeLinesRef   = useRef({});   // deliveryId → Leaflet polyline group
  const initRef         = useRef(false);

  // Keep a ref copy of deliveries so socket callbacks always see fresh data
  const deliveriesRef = useRef([]);

  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [agentLocations, setAgentLocations]     = useState({});   // agentId → {lat,lng,deliveryId}
  const [loading, setLoading]                   = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const detailRef = useRef(null);

  // ── fetch all deliveries + agents ──────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [delRes, agentsRes] = await Promise.all([getAllDeliveries(), getAgents()]);
        const active = delRes.data.filter(d =>
          ['assigned','accepted','in_transit','picked_up'].includes(d.status)
        );
        deliveriesRef.current = active;
        setActiveDeliveries(active);

        // Paint saved agent locations from DB immediately (no need to wait for GPS event)
        active.forEach(del => {
          const saved = del.agentLocation;
          const agentId = del.agentId?._id || del.agentId;
          if (isValidLoc(saved) && agentId) {
            setAgentLocations(prev => ({ ...prev, [agentId]: { lat: saved.lat, lng: saved.lng, deliveryId: del._id } }));
          }
        });
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();

    const socket = getSocket();
    socket.emit('joinAdminRoom');

    // Real-time GPS updates from agents
    const onLocation = ({ agentId, lat, lng, deliveryId }) => {
      if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;
      setAgentLocations(prev => ({ ...prev, [agentId]: { lat: Number(lat), lng: Number(lng), deliveryId } }));
    };

    socket.on("agent:locationUpdate", onLocation);

    // Receive snapshot of already-active agents when admin first connects
    socket.on("admin:activeAgents", (snapshot) => {
      Object.entries(snapshot).forEach(([agentId, data]) => {
        const { lat, lng, deliveryId } = data;
        if (lat == null || isNaN(lat)) return;
        setAgentLocations(prev => ({ ...prev, [agentId]: { lat: Number(lat), lng: Number(lng), deliveryId } }));
      });
    });
    return () => {
      socket.off("agent:locationUpdate", onLocation);
      socket.off("admin:activeAgents");
    };
  }, []);

  // ── init Leaflet map ───────────────────────────────────────────────────────
  useEffect(() => {
    if (initRef.current || !mapRef.current) return;
    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current, { zoomControl: false })
      .setView([17.385, 78.4867], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 20,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;
    initRef.current = true;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        agentMarkersRef.current = {};
        donorMarkersRef.current = {};
        routeLinesRef.current   = {};
        initRef.current = false;
      }
    };
  }, []);

  // ── paint donor pins once deliveries are loaded ────────────────────────────
  useEffect(() => {
    if (!initRef.current || activeDeliveries.length === 0) return;
    const L   = window.L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    activeDeliveries.forEach(del => {
      if (donorMarkersRef.current[del._id]) return; // already painted

      const loc = del.foodPostId?.location;
      if (!isValidLoc(loc)) return;

      const icon = L.divIcon({
        html: `<div style="
          width:42px;height:42px;background:#1BA672;border-radius:50%;
          border:3px solid white;display:flex;align-items:center;justify-content:center;
          font-size:18px;box-shadow:0 4px 12px rgba(27,166,114,0.5)">🏠</div>`,
        className: '', iconSize: [42,42], iconAnchor: [21,21],
      });

      donorMarkersRef.current[del._id] = L.marker(
        [Number(loc.lat), Number(loc.lng)], { icon }
      ).addTo(map)
       .bindPopup(`<b>📍 ${del.foodPostId?.foodName || 'Pickup'}</b><br/>Donor: ${del.donorId?.name || '—'}`);
    });
  }, [activeDeliveries, initRef.current]);

  // ── paint / update agent pins whenever agentLocations changes ─────────────
  useEffect(() => {
    if (!initRef.current) return;
    const L   = window.L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    Object.entries(agentLocations).forEach(([agentId, { lat, lng, deliveryId }]) => {
      const del   = deliveriesRef.current.find(d => (d.agentId?._id || d.agentId) === agentId);
      const agent = del?.agentId;
      const name  = (typeof agent === 'object' ? agent?.name : '') || 'Agent';
      const phone = (typeof agent === 'object' ? agent?.phone : '') || '';
      const photo = (typeof agent === 'object' ? agent?.profilePhoto : '') || '';
      const initial = name[0]?.toUpperCase() || 'A';

      const icon = L.divIcon({
        html: `
          <div style="position:relative;width:48px;height:48px">
            <div style="
              width:48px;height:48px;border-radius:50%;
              border:3px solid white;overflow:hidden;
              display:flex;align-items:center;justify-content:center;
              background:#FC8019;font-size:16px;font-weight:700;color:white;
              box-shadow:0 4px 14px rgba(252,128,25,0.55);
              animation:agentPulse 1.8s ease-out infinite">
              ${photo
                ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover"/>`
                : initial}
            </div>
            <div style="
              position:absolute;bottom:-2px;right:-2px;
              width:14px;height:14px;background:#22c55e;
              border:2px solid white;border-radius:50%"></div>
          </div>
          <style>
            @keyframes agentPulse {
              0%   { box-shadow: 0 0 0 0 rgba(252,128,25,0.55) }
              70%  { box-shadow: 0 0 0 14px rgba(252,128,25,0) }
              100% { box-shadow: 0 0 0 0 rgba(252,128,25,0) }
            }
          </style>`,
        className: '', iconSize: [48,48], iconAnchor: [24,24],
      });

      if (agentMarkersRef.current[agentId]) {
        agentMarkersRef.current[agentId].setLatLng([lat, lng]);
      } else {
        agentMarkersRef.current[agentId] = L.marker([lat, lng], { icon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup(`<b>🚴 ${name}</b><br/>${phone}<br/><span style="color:#FC8019;font-size:11px">● Live GPS</span>`);
      }

      // Draw straight dashed line agent → donor pickup (refreshes each update)
      if (deliveryId) {
        const d = deliveriesRef.current.find(x => x._id === deliveryId);
        const donorLoc = d?.foodPostId?.location;
        if (isValidLoc(donorLoc)) {
          if (routeLinesRef.current[deliveryId]) {
            routeLinesRef.current[deliveryId].setLatLngs([
              [lat, lng],
              [Number(donorLoc.lat), Number(donorLoc.lng)],
            ]);
          } else {
            routeLinesRef.current[deliveryId] = L.polyline(
              [[lat, lng], [Number(donorLoc.lat), Number(donorLoc.lng)]],
              { color: '#FC8019', weight: 3, dashArray: '10 6', opacity: 0.9 }
            ).addTo(map);
          }
        }
      }
    });
  }, [agentLocations, initRef.current]);

  // ── focus map on a delivery card click ────────────────────────────────────
  const focusDelivery = (del) => {
    setSelectedDelivery(del);
    const map = mapInstanceRef.current;
    if (!map) return;

    const agentId  = del.agentId?._id || del.agentId;
    const agentLoc = agentLocations[agentId];
    const donorLoc = del.foodPostId?.location;
    const points   = [];

    if (agentLoc) points.push([Number(agentLoc.lat), Number(agentLoc.lng)]);
    if (isValidLoc(donorLoc)) points.push([Number(donorLoc.lat), Number(donorLoc.lng)]);

    if (points.length >= 2) {
      map.fitBounds(points, { padding: [80, 80], animate: true });
    } else if (points.length === 1) {
      map.setView(points[0], 16, { animate: true });
    }

    // Scroll to map on mobile
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const liveCount = Object.keys(agentLocations).length;

  return (
    <DashboardLayout title="Live Tracking">

      {/* Header */}
      <div className="mb-5 flex flex-wrap gap-4 items-start justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#282C3F]">🗺️ Live Agent Map</h2>
          <p className="text-[#93959F] text-sm mt-1">Both agent GPS and donor pickup pins shown on map</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="card py-3 px-5 flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-[#282C3F]">{liveCount} Agent{liveCount !== 1 ? 's' : ''} Live</span>
          </div>
          <div className="card py-3 px-5">
            <span className="text-sm font-semibold text-[#686B78]">{activeDeliveries.length} Active Deliveries</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-5 mb-4 text-sm text-[#686B78] flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#FC8019] flex items-center justify-center text-white text-xs font-bold shadow-md">A</div>
          <span>Agent — live GPS <span className="text-green-500 font-semibold">(● pulsing = online)</span></span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#1BA672] flex items-center justify-center text-sm shadow-md">🏠</div>
          <span>Donor — pickup location</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-10 h-0 border-t-2 border-dashed border-[#FC8019]" />
          <span>Route line (agent → pickup)</span>
        </div>
      </div>

      {/* Map */}
      <div className="card mb-6 p-0 overflow-hidden" style={{ borderRadius: 16 }}>
        {/* No-GPS notice shown when agents are assigned but no live GPS yet */}
        {activeDeliveries.length > 0 && liveCount === 0 && (
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 text-amber-700 text-sm font-medium flex items-center gap-2">
            <span className="text-base">⚠️</span>
            Agent GPS not active yet — markers will appear once agents start navigation
          </div>
        )}
        <div ref={mapRef} style={{ height: '460px' }} />
      </div>

      {/* Delivery cards */}
      <div ref={detailRef} className="scroll-mt-4">
        <h3 className="font-display text-xl font-bold text-[#282C3F] mb-4">Active Deliveries</h3>

        {loading ? (
          <div className="grid gap-4">{[1,2,3].map(i => <div key={i} className="card h-24 animate-pulse bg-[#F4F4F4]" />)}</div>
        ) : activeDeliveries.length === 0 ? (
          <div className="card text-center py-10 text-[#93959F]">No active deliveries right now.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeDeliveries.map((del, i) => {
              const agentId  = del.agentId?._id || del.agentId;
              const agentLoc = agentLocations[agentId];
              const donorLoc = del.foodPostId?.location;
              const isSelected = selectedDelivery?._id === del._id;

              return (
                <motion.div key={del._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }} onClick={() => focusDelivery(del)}
                  className={`card cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all ${isSelected ? 'ring-2 ring-[#FC8019]' : ''}`}>

                  {/* Agent row */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-full bg-[#FC8019] overflow-hidden flex items-center justify-center shadow-md">
                        {del.agentId?.profilePhoto
                          ? <img src={del.agentId.profilePhoto} alt="" className="w-full h-full object-cover" />
                          : <span className="text-white font-bold text-base">{del.agentId?.name?.[0]}</span>}
                      </div>
                      {agentLoc
                        ? <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 border-2 border-white rounded-full" />
                        : <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-gray-300 border-2 border-white rounded-full" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-[#282C3F] truncate">{del.agentId?.name || 'Agent'}</p>
                      <p className="text-xs text-[#93959F]">{del.agentId?.phone}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${agentLoc ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                      {agentLoc ? '● Live' : '○ Offline'}
                    </span>
                  </div>

                  {/* Food + Donor */}
                  <div className="text-sm space-y-1.5 text-[#686B78]">
                    <div className="flex items-center gap-2">
                      <span>🍱</span>
                      <span className="truncate font-medium text-[#282C3F]">{del.foodPostId?.foodName || 'Food'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>🤲</span>
                      <span>Donor: <strong>{del.donorId?.name || '—'}</strong></span>
                    </div>
                    {del.donorId?.phone && (
                      <div className="flex items-center gap-2">
                        <span>📞</span>
                        <a href={`tel:${del.donorId.phone}`} onClick={e => e.stopPropagation()}
                          className="text-[#1BA672] hover:underline">{del.donorId.phone}</a>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span>📍</span>
                      <span className={`text-xs font-medium ${isValidLoc(donorLoc) ? 'text-[#1BA672]' : 'text-amber-500'}`}>
                        {isValidLoc(donorLoc) ? 'Pickup pinned on map ✓' : 'Pickup location not saved'}
                      </span>
                    </div>
                  </div>

                  {/* Status + GPS coords */}
                  <div className="mt-3 pt-3 border-t border-[#F4F4F4] flex items-center justify-between">
                    <span className="badge-orange capitalize text-xs">
                      {del.status.replace('_', ' ')}
                    </span>
                    {agentLoc ? (
                      <span className="text-xs text-green-600">
                        {Number(agentLoc.lat).toFixed(4)}, {Number(agentLoc.lng).toFixed(4)}
                      </span>
                    ) : (
                      <span className="text-xs text-[#93959F]">Click to focus map →</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
