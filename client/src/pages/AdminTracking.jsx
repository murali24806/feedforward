import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import { getAllDeliveries, getAgents } from '../services/api';
import { getSocket } from '../services/socket';

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

const TILE_LAYERS = {
  streets: {
    name: 'Streets',
    icon: '🗺️',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  detailed: {
    name: 'Detailed City',
    icon: '🏙️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ',
    maxZoom: 19,
  },
  satellite: {
    name: 'Satellite',
    icon: '🛰️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS',
    maxZoom: 19,
  },
};

export default function AdminTracking() {
  const mapRef          = useRef(null);
  const mapInstanceRef  = useRef(null);
  const currentTileRef  = useRef(null);
  const agentMarkersRef = useRef({});   // agentId  → Leaflet marker
  const donorMarkersRef = useRef({});   // deliveryId → Leaflet marker
  const adminMarkersRef = useRef({});   // deliveryId → Leaflet marker
  const routeLinesRef   = useRef({});   // deliveryId → Leaflet polyline group
  const focusedRouteRef = useRef(null); // High-contrast OSRM road route for selected delivery
  const initRef         = useRef(false);

  // Keep a ref copy of deliveries so socket callbacks always see fresh data
  const deliveriesRef = useRef([]);

  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [agentLocations, setAgentLocations]     = useState({});   // agentId → {lat,lng,deliveryId}
  const [loading, setLoading]                   = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [hudData, setHudData]                   = useState({ eta: null, distance: null, loading: false });
  const [activeLayer, setActiveLayer]           = useState('streets');
  const [isFullscreen, setIsFullscreen]         = useState(false);
  const detailRef = useRef(null);

  const changeTileLayer = (layerKey) => {
    const map = mapInstanceRef.current;
    const L   = window.L;
    if (!map || !L) return;

    const layerConfig = TILE_LAYERS[layerKey] || TILE_LAYERS.streets;
    if (currentTileRef.current) {
      map.removeLayer(currentTileRef.current);
    }

    const newTile = L.tileLayer(layerConfig.url, {
      attribution: layerConfig.attribution,
      maxZoom: layerConfig.maxZoom,
      crossOrigin: true,
    }).addTo(map);

    currentTileRef.current = newTile;
    setActiveLayer(layerKey);
  };

  const recenterAll = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const points = [];
    Object.values(agentLocations).forEach(loc => {
      if (isValidLoc(loc)) points.push([Number(loc.lat), Number(loc.lng)]);
    });
    activeDeliveries.forEach(del => {
      const loc = resolveTargetLoc(del);
      if (isValidLoc(loc)) points.push([Number(loc.lat), Number(loc.lng)]);
    });
    if (points.length >= 2) {
      map.fitBounds(points, { padding: [60, 60], animate: true });
    } else if (points.length === 1) {
      map.setView(points[0], 14, { animate: true });
    } else {
      map.setView([17.385, 78.4867], 12);
    }
  };

  // ── Road Route Fetcher (OSRM Turn-by-Turn Navigation) ────────────────────────
  const updateRoadRoute = useCallback(async (del, curAgentLoc) => {
    const map = mapInstanceRef.current;
    const L   = window.L;
    if (!map || !L || !del) return;

    const targetLoc = resolveTargetLoc(del);
    if (!isValidLoc(curAgentLoc) || !isValidLoc(targetLoc)) {
      if (focusedRouteRef.current) {
        focusedRouteRef.current.clearLayers();
      }
      setHudData({ eta: null, distance: null, loading: false });
      return;
    }

    setHudData(prev => ({ ...prev, loading: true }));

    const from = { lat: Number(curAgentLoc.lat), lng: Number(curAgentLoc.lng) };
    const to   = { lat: Number(targetLoc.lat), lng: Number(targetLoc.lng) };

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      const data = await res.json();

      if (data.code === 'Ok' && data.routes?.length > 0) {
        const route = data.routes[0];
        const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

        if (focusedRouteRef.current) {
          focusedRouteRef.current.clearLayers();
        } else {
          focusedRouteRef.current = L.layerGroup().addTo(map);
        }

        // White border buffer for high contrast against any map layer
        L.polyline(coords, {
          color: '#ffffff',
          weight: 8,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(focusedRouteRef.current);

        // Vibrant emerald green road polyline
        L.polyline(coords, {
          color: '#1BA672',
          weight: 4.5,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(focusedRouteRef.current);

        setHudData({
          eta: Math.round(route.duration / 60),
          distance: (route.distance / 1000).toFixed(1),
          loading: false,
        });
      } else {
        throw new Error('OSRM route failed');
      }
    } catch {
      // Fallback straight line
      if (focusedRouteRef.current) {
        focusedRouteRef.current.clearLayers();
      } else {
        focusedRouteRef.current = L.layerGroup().addTo(map);
      }
      L.polyline([[from.lat, from.lng], [to.lat, to.lng]], {
        color: '#1BA672',
        weight: 4,
        dashArray: '8, 8',
        opacity: 0.9,
      }).addTo(focusedRouteRef.current);

      // Simple Haversine distance estimate
      const R = 6371;
      const dLat = (to.lat - from.lat) * Math.PI / 180;
      const dLon = (to.lng - from.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(from.lat*Math.PI/180) * Math.cos(to.lat*Math.PI/180) * Math.sin(dLon/2)**2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const dist = (R * c).toFixed(1);

      setHudData({
        eta: Math.max(1, Math.round(dist * 2.5)),
        distance: dist,
        loading: false,
      });
    }
  }, []);

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

    const map = L.map(mapRef.current, { zoomControl: false, scrollWheelZoom: true })
      .setView([17.385, 78.4867], 12);

    const defaultTile = L.tileLayer(TILE_LAYERS.streets.url, {
      attribution: TILE_LAYERS.streets.attribution,
      maxZoom: TILE_LAYERS.streets.maxZoom,
      crossOrigin: true,
    }).addTo(map);

    currentTileRef.current = defaultTile;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;
    initRef.current = true;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        agentMarkersRef.current = {};
        donorMarkersRef.current = {};
        adminMarkersRef.current = {};
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
      if (!donorMarkersRef.current[del._id]) {
        let loc = null;
        if (isValidLoc(del.foodPostId?.location)) loc = del.foodPostId.location;
        else if (isValidLoc(del.donorId?.location)) loc = del.donorId.location;

        if (isValidLoc(loc)) {
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
           .bindPopup(`<b>📍 ${del.foodPostId?.foodName || 'Pickup'}</b><br/>Donor: ${del.donorId?.name || '—'}`)
           .on('click', () => focusDelivery(del));
        }
      }

      if (del.status === 'picked_up' && !adminMarkersRef.current[del._id]) {
        let loc = null;
        if (isValidLoc(del.adminLocation)) loc = del.adminLocation;
        else if (isValidLoc(del.adminId?.location)) loc = del.adminId.location;

        if (isValidLoc(loc)) {
          const icon = L.divIcon({
            html: `<div style="
              width:42px;height:42px;background:#3B82F6;border-radius:50%;
              border:3px solid white;display:flex;align-items:center;justify-content:center;
              font-size:18px;box-shadow:0 4px 12px rgba(59,130,246,0.5)">🏢</div>`,
            className: '', iconSize: [42,42], iconAnchor: [21,21],
          });

          adminMarkersRef.current[del._id] = L.marker(
            [Number(loc.lat), Number(loc.lng)], { icon }
          ).addTo(map)
           .bindPopup(`<b>📍 Drop-off</b><br/>Admin Location`)
           .on('click', () => focusDelivery(del));
        }
      }
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
        const marker = L.marker([lat, lng], { icon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup(`<b>🚴 ${name}</b><br/>${phone}<br/><span style="color:#FC8019;font-size:11px">● Live GPS · Click to track</span>`);
        if (del) {
          marker.on('click', () => focusDelivery(del));
        }
        agentMarkersRef.current[agentId] = marker;
      }

      // Draw dashed line agent → destination (only if not currently focused with road route)
      if (deliveryId) {
        const d = deliveriesRef.current.find(x => x._id === deliveryId);
        let targetLoc = resolveTargetLoc(d);

        if (isValidLoc(targetLoc)) {
          if (routeLinesRef.current[deliveryId]) {
            routeLinesRef.current[deliveryId].setLatLngs([
              [lat, lng],
              [Number(targetLoc.lat), Number(targetLoc.lng)],
            ]);
          } else {
            routeLinesRef.current[deliveryId] = L.polyline(
              [[lat, lng], [Number(targetLoc.lat), Number(targetLoc.lng)]],
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
    const agentLoc = agentLocations[agentId] || (isValidLoc(del.agentLocation) ? del.agentLocation : null);
    let targetLoc = resolveTargetLoc(del);
    const points   = [];

    if (isValidLoc(agentLoc)) points.push([Number(agentLoc.lat), Number(agentLoc.lng)]);
    if (isValidLoc(targetLoc)) points.push([Number(targetLoc.lat), Number(targetLoc.lng)]);

    if (points.length >= 2) {
      map.fitBounds(points, { padding: [80, 80], animate: true });
    } else if (points.length === 1) {
      map.setView(points[0], 16, { animate: true });
    }

    if (isValidLoc(agentLoc)) {
      updateRoadRoute(del, agentLoc);
    }

    // Scroll to map on mobile
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── update road route dynamically when courier location streams ───────────
  useEffect(() => {
    if (!selectedDelivery) return;
    const agentId = selectedDelivery.agentId?._id || selectedDelivery.agentId;
    const curLoc = agentLocations[agentId] || (isValidLoc(selectedDelivery.agentLocation) ? selectedDelivery.agentLocation : null);
    if (isValidLoc(curLoc)) {
      updateRoadRoute(selectedDelivery, curLoc);
    }
  }, [agentLocations, selectedDelivery, updateRoadRoute]);

  const clearFocusedDelivery = () => {
    setSelectedDelivery(null);
    if (focusedRouteRef.current) {
      focusedRouteRef.current.clearLayers();
    }
    setHudData({ eta: null, distance: null, loading: false });
  };

  const liveCount = Object.keys(agentLocations).length;

  return (
    <DashboardLayout title="Live Tracking">

      {/* Header */}
      <div className="mb-5 flex flex-wrap gap-4 items-start justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#282C3F]">🗺️ Live Agent Map</h2>
          <p className="text-[#93959F] text-sm mt-1">Both agent GPS and donor pickup pins shown on map with real-time road routing</p>
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
          <div className="w-7 h-7 rounded-full bg-[#3B82F6] flex items-center justify-center text-sm shadow-md">🏢</div>
          <span>Admin — drop-off location</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-10 h-0 border-t-2 border-dashed border-[#FC8019]" />
          <span>Route line</span>
        </div>
      </div>

      {/* Map with Navigation Controls & Live Navigation HUD */}
      <div 
        className={`card mb-6 p-0 overflow-hidden relative transition-all ${
          isFullscreen ? 'fixed inset-0 z-50 rounded-none m-0' : 'rounded-[20px]'
        }`}
      >
        {/* Floating Top Controls: Layer Switcher + Recenter + Fullscreen */}
        <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-[1000] flex items-center gap-1.5 sm:gap-2 max-w-[calc(100%-20px)]">
          {/* Layer switcher */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-1 flex shadow-md border border-black/10">
            {Object.entries(TILE_LAYERS).map(([key, item]) => {
              const isSelected = activeLayer === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => changeTileLayer(key)}
                  className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                    isSelected
                      ? 'bg-[#FC8019] text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span className="hidden md:inline">{item.name}</span>
                </button>
              );
            })}
          </div>

          {/* Recenter All Fleet Button */}
          <button
            type="button"
            onClick={recenterAll}
            className="bg-white/95 backdrop-blur-md border border-black/10 text-gray-800 rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-bold shadow-md hover:bg-gray-50 flex items-center gap-1 active:scale-95 transition-all"
            title="Recenter view on all active couriers"
          >
            <span>🎯</span>
            <span className="hidden sm:inline">Recenter</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="bg-white/95 backdrop-blur-md border border-black/10 text-gray-800 rounded-xl w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-xs font-bold shadow-md hover:bg-gray-50 active:scale-95 transition-all"
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen Radar'}
          >
            {isFullscreen ? '✕' : '⛶'}
          </button>
        </div>

        {/* FLOATING LIVE NAVIGATION HUD (When an active delivery is focused) */}
        <AnimatePresence>
          {selectedDelivery && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              className="absolute bottom-20 sm:bottom-4 left-3 right-3 sm:left-4 sm:right-auto sm:max-w-md z-[1000] bg-white/95 backdrop-blur-xl rounded-2xl p-3.5 sm:p-4 shadow-2xl border border-black/10 max-h-[60vh] overflow-y-auto"
            >
              {/* HUD Header */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-bold text-gray-800 tracking-tight">
                    {selectedDelivery.status === 'picked_up' ? '📦 En Route to Drop-off' : '🚴 En Route to Pickup'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearFocusedDelivery}
                  className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-xs font-bold transition-colors"
                  title="Close Navigation HUD"
                >
                  ✕
                </button>
              </div>

              {/* Food & Destination */}
              <p className="font-bold text-sm text-[#282C3F] truncate">
                {selectedDelivery.foodPostId?.foodName || 'Food Item'}
              </p>

              {/* ETA & Distance Pill */}
              <div className="my-2.5 flex items-center gap-2 flex-wrap">
                {hudData.loading ? (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-lg animate-pulse font-medium">
                    Calculating road route...
                  </span>
                ) : hudData.eta ? (
                  <div className="flex items-center gap-2 bg-[#1BA672]/10 border border-[#1BA672]/20 px-3 py-1 rounded-xl">
                    <span className="text-sm">⏱️</span>
                    <span className="text-xs font-bold text-[#1BA672]">
                      ~{hudData.eta} mins away · {hudData.distance} km
                    </span>
                  </div>
                ) : (
                  <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg font-medium">
                    ● Live GPS Active
                  </span>
                )}
              </div>

              {/* Courier info row */}
              <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#FC8019] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {selectedDelivery.agentId?.name?.[0] || 'A'}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-[#282C3F] truncate">{selectedDelivery.agentId?.name || 'Courier'}</p>
                    <p className="text-[10px] text-gray-500">{selectedDelivery.agentId?.vehicleType || 'Motorbike'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {selectedDelivery.agentId?.phone && (
                    <a
                      href={`tel:${selectedDelivery.agentId.phone}`}
                      className="w-7 h-7 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 flex items-center justify-center text-xs"
                      title="Call Courier"
                    >
                      📞
                    </a>
                  )}
                  {(() => {
                    const agentId = selectedDelivery.agentId?._id || selectedDelivery.agentId;
                    const aLoc = agentLocations[agentId] || (isValidLoc(selectedDelivery.agentLocation) ? selectedDelivery.agentLocation : null);
                    const tLoc = resolveTargetLoc(selectedDelivery);
                    if (isValidLoc(aLoc) && isValidLoc(tLoc)) {
                      return (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&origin=${aLoc.lat},${aLoc.lng}&destination=${tLoc.lat},${tLoc.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-bold bg-[#1BA672] hover:bg-[#138A5C] text-white px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                          title="Open turn-by-turn navigation in Google Maps"
                        >
                          <span>🧭 Turn-by-Turn</span>
                          <span>↗</span>
                        </a>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* No-GPS notice shown when agents are assigned but no live GPS yet */}
        {activeDeliveries.length > 0 && liveCount === 0 && (
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 text-amber-700 text-sm font-medium flex items-center gap-2">
            <span className="text-base">⚠️</span>
            Agent GPS not active yet — markers will appear once agents start navigation
          </div>
        )}
        <div ref={mapRef} className={isFullscreen ? 'h-screen w-full' : 'h-[320px] sm:h-[400px] lg:h-[480px] w-full'} />
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
              const donorLoc = resolveTargetLoc(del);
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
                        {isValidLoc(donorLoc) ? 'Target pinned on map ✓' : 'Target location not saved'}
                      </span>
                    </div>
                  </div>

                  {/* Status + GPS coords + Live Navigation Action */}
                  <div className="mt-3 pt-3 border-t border-[#F4F4F4] flex items-center justify-between">
                    <span className="badge-orange capitalize text-xs">
                      {del.status.replace('_', ' ')}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        focusDelivery(del);
                      }}
                      className="text-xs font-semibold text-[#1BA672] bg-[#1BA672]/10 hover:bg-[#1BA672]/20 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <span>🧭</span>
                      <span>Live Nav</span>
                    </button>
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
