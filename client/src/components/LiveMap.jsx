import React, { useEffect, useRef, useState, useCallback } from 'react';

const isValid = (loc) =>
  loc != null &&
  loc.lat != null && loc.lng != null &&
  !isNaN(Number(loc.lat)) && !isNaN(Number(loc.lng)) &&
  Number(loc.lat) !== 0 && Number(loc.lng) !== 0;

// High performance, 100% free, zero-API-key tile providers
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
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS',
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

export default function LiveMap({
  agentLocation,
  donorLocation,
  destinationLocation, // NEW: { lat, lng, address, name }
  isPickedUp = false,   // NEW: whether food is picked up and courier is heading to drop-off
  height = '320px',
  showETA = true,
  mode = 'agent',       // 'agent' | 'donor' | 'admin'
  zoom = 14,
}) {
  const mapRef                  = useRef(null);
  const mapInstanceRef          = useRef(null);
  const currentTileRef          = useRef(null);
  const agentMarkerRef          = useRef(null);
  const donorMarkerRef          = useRef(null);
  const destinationMarkerRef    = useRef(null);
  const routeGroupRef           = useRef(null);
  const secondaryRouteGroupRef  = useRef(null);
  const initializedRef          = useRef(false);

  const [activeLayer, setActiveLayer] = useState('streets');
  const [eta, setEta]                 = useState(null);
  const [distance, setDistance]       = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [mapReady, setMapReady]       = useState(false);
  const [autoFollow, setAutoFollow]   = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [targetLabel, setTargetLabel] = useState('TO PICKUP');

  /* ── Switch Tile Layer smoothly without rebuilding map ── */
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

  /* ── 1. Init Map with Fast OSM Default ── */
  useEffect(() => {
    if (initializedRef.current) return;
    if (!mapRef.current) return;

    const L = window.L;
    if (!L) {
      console.error('Leaflet not loaded');
      return;
    }

    let center = [17.385, 78.4867];
    if (isValid(agentLocation)) center = [Number(agentLocation.lat), Number(agentLocation.lng)];
    else if (isValid(donorLocation)) center = [Number(donorLocation.lat), Number(donorLocation.lng)];
    else if (isValid(destinationLocation)) center = [Number(destinationLocation.lat), Number(destinationLocation.lng)];

    const map = L.map(mapRef.current, {
      center,
      zoom,
      zoomControl: false,
      scrollWheelZoom: true,
      dragging: true,
      doubleClickZoom: true,
      touchZoom: true,
    });

    // Use fast OpenStreetMap as default (Zero API key required!)
    const initialTile = L.tileLayer(TILE_LAYERS.streets.url, {
      attribution: TILE_LAYERS.streets.attribution,
      maxZoom: TILE_LAYERS.streets.maxZoom,
      crossOrigin: true,
    }).addTo(map);

    currentTileRef.current = initialTile;

    // Reposition zoom controls to bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;
    initializedRef.current = true;
    setMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      currentTileRef.current = null;
      agentMarkerRef.current = null;
      donorMarkerRef.current = null;
      destinationMarkerRef.current = null;
      routeGroupRef.current = null;
      secondaryRouteGroupRef.current = null;
      initializedRef.current = false;
      setMapReady(false);
    };
  }, []);

  /* ── 2. Draw / update route via OSRM with smooth polyline ── */
  const drawRoute = useCallback(async (from, to, map, L, label = 'TO PICKUP') => {
    setRouteLoading(true);
    setTargetLabel(label);
    try {
      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${from.lng},${from.lat};${to.lng},${to.lat}` +
        `?overview=full&geometries=geojson`;

      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      const data = await res.json();

      if (data.code === 'Ok' && data.routes?.length > 0) {
        const route = data.routes[0];
        setEta(Math.round(route.duration / 60));
        setDistance((route.distance / 1000).toFixed(1));
        setLastUpdated(new Date().toLocaleTimeString());

        const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

        if (routeGroupRef.current) {
          routeGroupRef.current.clearLayers();
        } else {
          routeGroupRef.current = L.layerGroup().addTo(map);
        }

        // Outer white buffer for high contrast visibility
        L.polyline(coords, {
          color: '#ffffff',
          weight: 8,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(routeGroupRef.current);

        // Core vivid navigation line
        const lineColor = isPickedUp ? '#2563EB' : '#FC8019';
        L.polyline(coords, {
          color: lineColor,
          weight: 4.5,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(routeGroupRef.current);

        if (autoFollow) {
          const allPoints = [...coords];
          if (isValid(destinationLocation) && !isPickedUp) {
            allPoints.push([Number(destinationLocation.lat), Number(destinationLocation.lng)]);
          }
          if (isValid(donorLocation) && isPickedUp) {
            allPoints.push([Number(donorLocation.lat), Number(donorLocation.lng)]);
          }
          map.fitBounds(L.latLngBounds(allPoints), { padding: [55, 55], maxZoom: 16 });
        }
      } else {
        throw new Error('No OSRM route');
      }
    } catch {
      // Fallback straight dashed line
      if (routeGroupRef.current) {
        routeGroupRef.current.clearLayers();
      } else {
        routeGroupRef.current = L.layerGroup().addTo(map);
      }
      const lineColor = isPickedUp ? '#2563EB' : '#FC8019';
      L.polyline(
        [[from.lat, from.lng], [to.lat, to.lng]],
        { color: lineColor, weight: 4, dashArray: '8, 8', opacity: 0.85 }
      ).addTo(routeGroupRef.current);

      if (autoFollow) {
        map.fitBounds([[from.lat, from.lng], [to.lat, to.lng]], { padding: [50, 50] });
      }
    } finally {
      setRouteLoading(false);
    }
  }, [autoFollow, isPickedUp, destinationLocation, donorLocation]);

  /* ── 3. Update Markers & Route When Coordinates Stream ── */
  useEffect(() => {
    if (!mapReady) return;
    const map = mapInstanceRef.current;
    const L   = window.L;
    if (!map || !L) return;

    /* -- Donor / Food Pickup Pin (Green 🏠) -- */
    if (isValid(donorLocation)) {
      const lat = Number(donorLocation.lat);
      const lng = Number(donorLocation.lng);
      const donorName = donorLocation.name || 'Food Pickup Point';
      const donorAddress = donorLocation.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

      const donorIcon = L.divIcon({
        html: `
          <div style="position:relative;width:40px;height:50px">
            <div style="
              width:40px;height:40px;
              background:${isPickedUp ? '#059669' : '#1BA672'};
              border-radius:50% 50% 50% 0;
              transform:rotate(-45deg);
              border:3px solid white;
              box-shadow:0 4px 14px rgba(27,166,114,0.45);
            "></div>
            <span style="
              position:absolute;
              top:7px;left:7px;
              font-size:18px;
              line-height:1;
            ">🏠</span>
            ${isPickedUp ? `
              <div style="
                position:absolute;bottom:6px;right:0;
                width:16px;height:16px;
                background:#34C759;
                border:2px solid white;
                border-radius:50%;
                display:flex;align-items:center;justify-content:center;
                color:white;font-size:9px;font-weight:bold;
              ">✓</div>` : ''}
          </div>`,
        className: '',
        iconSize:   [40, 50],
        iconAnchor: [20, 50],
        popupAnchor:[0, -50],
      });

      if (!donorMarkerRef.current) {
        donorMarkerRef.current = L.marker([lat, lng], { icon: donorIcon, zIndexOffset: 100 })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:sans-serif;padding:4px">
              <b style="color:#1BA672;font-size:13px">📍 ${isPickedUp ? 'Food Pickup Point (Collected ✓)' : 'Food Pickup Point'}</b><br/>
              <span style="font-size:11px;font-weight:600;color:#282C3F">${donorName}</span><br/>
              <span style="font-size:10px;color:#666">${donorAddress}</span>
            </div>
          `);
      } else {
        donorMarkerRef.current.setIcon(donorIcon);
        donorMarkerRef.current.setLatLng([lat, lng]);
      }
    } else if (donorMarkerRef.current) {
      donorMarkerRef.current.remove();
      donorMarkerRef.current = null;
    }

    /* -- Delivery Destination / NGO Drop-off Pin (Royal Blue 🏢) -- */
    if (isValid(destinationLocation)) {
      const destLat = Number(destinationLocation.lat);
      const destLng = Number(destinationLocation.lng);
      const destName = destinationLocation.organizationName || destinationLocation.name || 'NGO Drop-off Facility';
      const destAddress = destinationLocation.address || `${destLat.toFixed(5)}, ${destLng.toFixed(5)}`;

      const destIcon = L.divIcon({
        html: `
          <div style="position:relative;width:40px;height:50px">
            <div style="
              width:40px;height:40px;
              background:linear-gradient(135deg, #2563EB 0%, #4F46E5 100%);
              border-radius:50% 50% 50% 0;
              transform:rotate(-45deg);
              border:3px solid white;
              box-shadow:0 4px 16px rgba(37,99,235,0.55);
            "></div>
            <span style="
              position:absolute;
              top:7px;left:7px;
              font-size:18px;
              line-height:1;
            ">🏢</span>
            ${isPickedUp ? `
              <div style="
                position:absolute;bottom:6px;right:0;
                width:14px;height:14px;
                background:#FC8019;
                border:2px solid white;
                border-radius:50%;
                animation:pulseLive 1.2s infinite;
              "></div>` : ''}
          </div>`,
        className: '',
        iconSize:   [40, 50],
        iconAnchor: [20, 50],
        popupAnchor:[0, -50],
      });

      if (!destinationMarkerRef.current) {
        destinationMarkerRef.current = L.marker([destLat, destLng], { icon: destIcon, zIndexOffset: 200 })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:sans-serif;padding:4px">
              <b style="color:#2563EB;font-size:13px">🏢 Drop-off Destination (NGO)</b><br/>
              <span style="font-size:11px;font-weight:600;color:#282C3F">${destName}</span><br/>
              <span style="font-size:10px;color:#666">${destAddress}</span>
            </div>
          `);
      } else {
        destinationMarkerRef.current.setIcon(destIcon);
        destinationMarkerRef.current.setLatLng([destLat, destLng]);
      }
    } else if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove();
      destinationMarkerRef.current = null;
    }

    /* -- Agent / Courier Pin with Live Pulse (Orange 🚴) -- */
    if (isValid(agentLocation)) {
      const lat = Number(agentLocation.lat);
      const lng = Number(agentLocation.lng);
      setLastUpdated(new Date().toLocaleTimeString());

      const agentIcon = L.divIcon({
        html: `
          <div style="position:relative;width:48px;height:48px">
            <div style="
              width:48px;height:48px;
              background:linear-gradient(135deg, #FC8019 0%, #FF9500 100%);
              border-radius:50%;
              border:3px solid white;
              display:flex;align-items:center;justify-content:center;
              font-size:20px;
              box-shadow:0 4px 14px rgba(252,128,25,0.45);
              animation:liveAgentPulse 1.6s ease-out infinite;
            ">🚴</div>
            <div style="
              position:absolute;bottom:0;right:0;
              width:14px;height:14px;
              background:#34C759;
              border:2.5px solid white;
              border-radius:50%;
            "></div>
          </div>
          <style>
            @keyframes liveAgentPulse {
              0%   { box-shadow: 0 0 0 0 rgba(252,128,25,0.6); }
              70%  { box-shadow: 0 0 0 16px rgba(252,128,25,0); }
              100% { box-shadow: 0 0 0 0 rgba(252,128,25,0); }
            }
          </style>`,
        className: '',
        iconSize:   [48, 48],
        iconAnchor: [24, 24],
        popupAnchor:[0, -24],
      });

      if (!agentMarkerRef.current) {
        agentMarkerRef.current = L.marker([lat, lng], { icon: agentIcon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:sans-serif;padding:4px">
              <b style="color:#FC8019;font-size:13px">🚴 Delivery Courier</b><br/>
              <span style="font-size:11px;color:#34C759;font-weight:bold">● Live GPS Active</span><br/>
              <span style="font-size:10px;color:#888">${lat.toFixed(5)}, ${lng.toFixed(5)}</span>
            </div>
          `);
      } else {
        agentMarkerRef.current.setLatLng([lat, lng]);
      }
    } else if (agentMarkerRef.current) {
      agentMarkerRef.current.remove();
      agentMarkerRef.current = null;
    }

    /* ── Navigation Routing with Multi-leg display ── */
    // Secondary route clean
    if (secondaryRouteGroupRef.current) {
      secondaryRouteGroupRef.current.clearLayers();
    } else {
      secondaryRouteGroupRef.current = L.layerGroup().addTo(map);
    }

    if (isPickedUp) {
      // Picked Up: Main route is Agent -> Destination
      if (isValid(agentLocation) && isValid(destinationLocation)) {
        drawRoute(
          { lat: Number(agentLocation.lat), lng: Number(agentLocation.lng) },
          { lat: Number(destinationLocation.lat), lng: Number(destinationLocation.lng) },
          map, L, 'TO DROP-OFF'
        );
        // Completed segment: dashed route from Donor -> Agent (subtle)
        if (isValid(donorLocation)) {
          L.polyline(
            [[Number(donorLocation.lat), Number(donorLocation.lng)], [Number(agentLocation.lat), Number(agentLocation.lng)]],
            { color: '#1BA672', weight: 3, dashArray: '4, 8', opacity: 0.6 }
          ).addTo(secondaryRouteGroupRef.current);
        }
      } else if (isValid(agentLocation)) {
        if (autoFollow) map.setView([Number(agentLocation.lat), Number(agentLocation.lng)], 15);
      } else if (isValid(destinationLocation)) {
        if (autoFollow) map.setView([Number(destinationLocation.lat), Number(destinationLocation.lng)], zoom);
      }
    } else {
      // Before Pickup: Main route is Agent -> Donor Pickup
      if (isValid(agentLocation) && isValid(donorLocation)) {
        drawRoute(
          { lat: Number(agentLocation.lat), lng: Number(agentLocation.lng) },
          { lat: Number(donorLocation.lat), lng: Number(donorLocation.lng) },
          map, L, 'TO PICKUP'
        );

        // Future leg: dashed route connecting Donor Pickup -> Destination
        if (isValid(destinationLocation)) {
          L.polyline(
            [[Number(donorLocation.lat), Number(donorLocation.lng)], [Number(destinationLocation.lat), Number(destinationLocation.lng)]],
            { color: '#2563EB', weight: 3.5, dashArray: '6, 8', opacity: 0.85 }
          ).addTo(secondaryRouteGroupRef.current);
        }
      } else if (!isValid(agentLocation) && isValid(donorLocation) && isValid(destinationLocation)) {
        // Agent GPS not streaming yet: draw full pickup-to-destination route
        drawRoute(
          { lat: Number(donorLocation.lat), lng: Number(donorLocation.lng) },
          { lat: Number(destinationLocation.lat), lng: Number(destinationLocation.lng) },
          map, L, 'PICKUP ➔ DROP-OFF'
        );
      } else if (isValid(agentLocation)) {
        if (autoFollow) map.setView([Number(agentLocation.lat), Number(agentLocation.lng)], 15);
      } else if (isValid(donorLocation)) {
        if (autoFollow) map.setView([Number(donorLocation.lat), Number(donorLocation.lng)], zoom);
      } else if (isValid(destinationLocation)) {
        if (autoFollow) map.setView([Number(destinationLocation.lat), Number(destinationLocation.lng)], zoom);
      }
    }

  }, [
    mapReady,
    agentLocation?.lat, agentLocation?.lng,
    donorLocation?.lat, donorLocation?.lng, donorLocation?.name, donorLocation?.address,
    destinationLocation?.lat, destinationLocation?.lng, destinationLocation?.name, destinationLocation?.address,
    isPickedUp,
    autoFollow,
    zoom,
    drawRoute
  ]);

  /* ── Fit Bounds helper: Fits ALL Active Points ── */
  const handleFitBounds = () => {
    const map = mapInstanceRef.current;
    const L   = window.L;
    if (!map || !L) return;

    const points = [];
    if (isValid(agentLocation)) points.push([Number(agentLocation.lat), Number(agentLocation.lng)]);
    if (isValid(donorLocation)) points.push([Number(donorLocation.lat), Number(donorLocation.lng)]);
    if (isValid(destinationLocation)) points.push([Number(destinationLocation.lat), Number(destinationLocation.lng)]);

    if (points.length >= 2) {
      map.fitBounds(points, { padding: [60, 60], animate: true });
    } else if (points.length === 1) {
      map.setView(points[0], 15, { animate: true });
    }
  };

  /* ── External Google Maps GPS Turn-by-Turn Navigation Link ── */
  const getExternalNavUrl = () => {
    if (isPickedUp && isValid(agentLocation) && isValid(destinationLocation)) {
      return `https://www.google.com/maps/dir/?api=1&origin=${agentLocation.lat},${agentLocation.lng}&destination=${destinationLocation.lat},${destinationLocation.lng}&travelmode=driving`;
    }
    if (isValid(agentLocation) && isValid(donorLocation)) {
      return `https://www.google.com/maps/dir/?api=1&origin=${agentLocation.lat},${agentLocation.lng}&destination=${donorLocation.lat},${donorLocation.lng}&travelmode=driving`;
    }
    if (isValid(destinationLocation)) {
      return `https://www.google.com/maps/search/?api=1&query=${destinationLocation.lat},${destinationLocation.lng}`;
    }
    if (isValid(donorLocation)) {
      return `https://www.google.com/maps/search/?api=1&query=${donorLocation.lat},${donorLocation.lng}`;
    }
    if (isValid(agentLocation)) {
      return `https://www.google.com/maps/search/?api=1&query=${agentLocation.lat},${agentLocation.lng}`;
    }
    return null;
  };

  const navUrl = getExternalNavUrl();
  const hasAny   = isValid(agentLocation) || isValid(donorLocation) || isValid(destinationLocation);
  const hasAgent = isValid(agentLocation);
  const hasDonor = isValid(donorLocation);
  const hasDest  = isValid(destinationLocation);

  const waitingMsg = mode === 'donor'
    ? { icon: '🚴', title: 'Waiting for courier GPS…', sub: 'Live route tracking will display as soon as courier navigation begins' }
    : mode === 'admin'
    ? { icon: '📡', title: 'Awaiting Live Location', sub: 'Agent GPS coordinates will stream in real-time when dispatched' }
    : { icon: '📍', title: 'Waiting for coordinates…', sub: 'Tap "Share Live GPS" above to broadcast position' };

  const onlyDonorMsg = mode === 'donor'
    ? '📍 Pickup location locked · Courier will navigate here'
    : mode === 'admin'
    ? '📍 Pickup location loaded · Waiting for courier GPS stream'
    : '📍 Pickup point located · Enable GPS to share your live location';

  return (
    <div
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 1,
        width: '100%',
        height: isFullscreen ? '100vh' : 'auto',
        borderRadius: isFullscreen ? 0 : 20,
        overflow: 'hidden',
        boxShadow: isFullscreen ? 'none' : '0 8px 30px rgba(0,0,0,0.08)',
        border: isFullscreen ? 'none' : '1px solid rgba(0,0,0,0.08)',
        background: '#e5e3df',
      }}
    >
      {/* MAP CANVAS */}
      <div
        ref={mapRef}
        style={{
          height: isFullscreen ? '100vh' : height,
          width: '100%',
          zIndex: 0,
          background: '#f2efe9',
        }}
      />

      {/* TOP-RIGHT CONTROLS: LAYER SWITCHER + EXPAND / FULLSCREEN */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {/* Layer Switcher Pills */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(12px)',
            borderRadius: 14,
            padding: 3,
            display: 'flex',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {Object.entries(TILE_LAYERS).map(([key, item]) => {
            const isSelected = activeLayer === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => changeTileLayer(key)}
                title={`Switch to ${item.name}`}
                style={{
                  border: 'none',
                  background: isSelected ? '#FC8019' : 'transparent',
                  color: isSelected ? '#ffffff' : '#333333',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '5px 10px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{item.icon}</span>
                <span style={{ display: isFullscreen ? 'inline' : 'none' }}>{item.name}</span>
              </button>
            );
          })}
        </div>

        {/* Fullscreen / Expand Button */}
        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          title={isFullscreen ? 'Exit Fullscreen' : 'Expand to Fullscreen'}
          style={{
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 12,
            width: 34,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 14,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            color: '#1C1C1E',
          }}
        >
          {isFullscreen ? '✕' : '⛶'}
        </button>
      </div>

      {/* TOP-LEFT LIVE HUD: ETA, DISTANCE & NAVIGATION */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {/* ETA & Distance Pill */}
        {showETA && (eta !== null || distance !== null || routeLoading) && (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(14px)',
              borderRadius: 16,
              padding: '8px 14px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
              border: '1px solid rgba(0,0,0,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {routeLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#FC8019', fontWeight: 600 }}>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                <span>Calculating fastest route…</span>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {eta !== null && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: isPickedUp ? '#2563EB' : '#FC8019', lineHeight: 1 }}>{eta}</div>
                      <div style={{ fontSize: 9, color: '#8E8E93', marginTop: 2, fontWeight: 700, letterSpacing: '0.05em' }}>MIN</div>
                    </div>
                  )}
                  {eta !== null && distance !== null && (
                    <div style={{ width: 1, height: 26, background: '#e5e7eb' }} />
                  )}
                  {distance !== null && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#1BA672', lineHeight: 1 }}>{distance}</div>
                      <div style={{ fontSize: 9, color: '#8E8E93', marginTop: 2, fontWeight: 700, letterSpacing: '0.05em' }}>KM</div>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 9, fontWeight: 800, color: isPickedUp ? '#2563EB' : '#FC8019', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {targetLabel}
                </div>
              </>
            )}
          </div>
        )}

        {/* Live Status Chip */}
        {hasAgent && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(27, 166, 114, 0.95)',
              color: '#ffffff',
              borderRadius: 20,
              padding: '4px 10px',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.05em',
              boxShadow: '0 2px 8px rgba(27, 166, 114, 0.35)',
              width: 'fit-content',
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#ffffff',
                animation: 'pulseLive 1s ease-in-out infinite',
              }}
            />
            <span>LIVE GPS ACTIVE</span>
            {lastUpdated && <span style={{ opacity: 0.8, fontWeight: 400 }}>· {lastUpdated}</span>}
          </div>
        )}
      </div>

      {/* BOTTOM ACTION BAR: RECENTER + TURN-BY-TURN GPS NAVIGATION */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 50,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* Recenter / Focus Button */}
        <button
          type="button"
          onClick={handleFitBounds}
          title="Recenter Map View"
          style={{
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 12,
            padding: '7px 12px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            color: '#1C1C1E',
            boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
          }}
        >
          <span>🎯</span>
          <span>Focus</span>
        </button>

        {/* Launch External Voice Turn-by-Turn GPS Navigation in Google Maps */}
        {navUrl && (
          <a
            href={navUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Launch Voice GPS Navigation in Google Maps"
            style={{
              background: 'linear-gradient(135deg, #007AFF 0%, #0051D5 100%)',
              color: '#ffffff',
              borderRadius: 12,
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: '0 4px 14px rgba(0, 122, 255, 0.35)',
              transition: 'transform 0.15s ease',
            }}
          >
            <span>🧭</span>
            <span>Navigate</span>
            <span style={{ fontSize: 10 }}>↗</span>
          </a>
        )}
      </div>

      {/* OVERLAY: NO LOCATIONS AT ALL */}
      {!hasAny && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(254, 250, 240, 0.92)',
            backdropFilter: 'blur(4px)',
            borderRadius: isFullscreen ? 0 : 20,
            zIndex: 600,
            padding: 20,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 44, marginBottom: 8 }}>{waitingMsg.icon}</div>
          <p style={{ color: '#1C1C1E', fontWeight: 700, fontSize: 16, margin: 0 }}>{waitingMsg.title}</p>
          <p style={{ color: '#8E8E93', fontSize: 12, marginTop: 4, maxWidth: 260, lineHeight: 1.4 }}>
            {waitingMsg.sub}
          </p>
        </div>
      )}

      {/* BOTTOM-LEFT MAP LEGEND / STATUS PILL */}
      {hasAny && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            background: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(12px)',
            color: '#282C3F',
            borderRadius: 14,
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 700,
            zIndex: 600,
            boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
            border: '1px solid rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            maxWidth: 'calc(100% - 170px)',
          }}
        >
          {hasAgent && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#FC8019' }}>
              <span>🚴</span> <span>Courier</span>
            </span>
          )}
          {hasDonor && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#1BA672' }}>
              <span>🏠</span> <span>Pickup {isPickedUp ? '✓' : ''}</span>
            </span>
          )}
          {hasDest && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#2563EB' }}>
              <span>🏢</span> <span>Drop-off</span>
            </span>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulseLive { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(1.2); } }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
