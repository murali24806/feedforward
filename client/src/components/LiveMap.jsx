import React, { useEffect, useRef, useState } from 'react';

const isValid = (loc) =>
  loc != null &&
  loc.lat != null && loc.lng != null &&
  !isNaN(Number(loc.lat)) && !isNaN(Number(loc.lng)) &&
  Number(loc.lat) !== 0 && Number(loc.lng) !== 0;

export default function LiveMap({
  agentLocation,
  donorLocation,
  height = '320px',
  showETA = true,
  mode = 'agent',   // 'agent' | 'donor' | 'admin'
  zoom = 14,
}) {
  const mapRef          = useRef(null);
  const mapInstanceRef  = useRef(null);
  const agentMarkerRef  = useRef(null);
  const donorMarkerRef  = useRef(null);
  const routeGroupRef   = useRef(null);
  const initializedRef  = useRef(false);

  const [eta, setEta]           = useState(null);
  const [distance, setDistance] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  /* ── 1. Init map ── */
  useEffect(() => {
    if (initializedRef.current) return;
    if (!mapRef.current) return;

    const L = window.L;
    if (!L) { console.error('Leaflet not loaded'); return; }

    let center = [17.385, 78.4867];
    if (isValid(agentLocation)) center = [Number(agentLocation.lat), Number(agentLocation.lng)];
    else if (isValid(donorLocation)) center = [Number(donorLocation.lat), Number(donorLocation.lng)];

    const map = L.map(mapRef.current, {
      center, zoom, zoomControl: false, scrollWheelZoom: true, dragging: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd', maxZoom: 20,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;
    initializedRef.current = true;
    setMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      agentMarkerRef.current = null;
      donorMarkerRef.current = null;
      routeGroupRef.current  = null;
      initializedRef.current = false;
      setMapReady(false);
    };
  }, []);

  /* ── 2. Update markers + route when locations change ── */
  useEffect(() => {
    if (!mapReady) return;
    const map = mapInstanceRef.current;
    const L   = window.L;
    if (!map || !L) return;

    /* -- Donor/pickup pin (green teardrop) -- */
    if (isValid(donorLocation)) {
      const lat = Number(donorLocation.lat);
      const lng = Number(donorLocation.lng);

      const donorIcon = L.divIcon({
        html: `
          <div style="position:relative;width:40px;height:50px">
            <div style="
              width:40px;height:40px;
              background:#1BA672;
              border-radius:50% 50% 50% 0;
              transform:rotate(-45deg);
              border:3px solid white;
              box-shadow:0 4px 14px rgba(45,106,79,0.45);
            "></div>
            <span style="
              position:absolute;
              top:7px;left:7px;
              font-size:18px;
              line-height:1;
            ">🏠</span>
          </div>`,
        className: '',
        iconSize:   [40, 50],
        iconAnchor: [20, 50],
        popupAnchor:[0, -50],
      });

      if (!donorMarkerRef.current) {
        donorMarkerRef.current = L.marker([lat, lng], { icon: donorIcon, zIndexOffset: 100 })
          .addTo(map)
          .bindPopup('<b>📍 Pickup Location</b>');
      } else {
        donorMarkerRef.current.setLatLng([lat, lng]);
      }
    }

    /* -- Agent pin (animated orange pulse) -- */
    if (isValid(agentLocation)) {
      const lat = Number(agentLocation.lat);
      const lng = Number(agentLocation.lng);

      const agentIcon = L.divIcon({
        html: `
          <div style="
            width:46px;height:46px;
            background:#F4A261;
            border-radius:50%;
            border:4px solid white;
            display:flex;align-items:center;justify-content:center;
            font-size:20px;
            box-shadow:0 0 0 0 rgba(244,162,97,0.6);
            animation:agentRing 1.6s ease-out infinite;
          ">🚴</div>
          <style>
            @keyframes agentRing{
              0%  {box-shadow:0 0 0 0   rgba(244,162,97,0.6);}
              70% {box-shadow:0 0 0 14px rgba(244,162,97,0);}
              100%{box-shadow:0 0 0 0   rgba(244,162,97,0);}
            }
          </style>`,
        className: '',
        iconSize:   [46, 46],
        iconAnchor: [23, 23],
        popupAnchor:[0, -23],
      });

      if (!agentMarkerRef.current) {
        agentMarkerRef.current = L.marker([lat, lng], { icon: agentIcon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup('<b>🚴 Delivery Agent</b>');
      } else {
        agentMarkerRef.current.setLatLng([lat, lng]);
      }
    }

    /* -- Route between the two -- */
    if (isValid(agentLocation) && isValid(donorLocation)) {
      drawRoute(
        { lat: Number(agentLocation.lat), lng: Number(agentLocation.lng) },
        { lat: Number(donorLocation.lat), lng: Number(donorLocation.lng) },
        map, L
      );
    } else if (isValid(agentLocation)) {
      map.setView([Number(agentLocation.lat), Number(agentLocation.lng)], 15);
    } else if (isValid(donorLocation)) {
      map.setView([Number(donorLocation.lat), Number(donorLocation.lng)], zoom);
    }

  }, [
    mapReady,
    agentLocation?.lat, agentLocation?.lng,
    donorLocation?.lat, donorLocation?.lng,
  ]);

  /* ── draw route via OSRM ── */
  const drawRoute = async (from, to, map, L) => {
    setRouteLoading(true);
    try {
      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${from.lng},${from.lat};${to.lng},${to.lat}` +
        `?overview=full&geometries=geojson`;

      const res  = await fetch(url, { signal: AbortSignal.timeout(6000) });
      const data = await res.json();

      if (data.code === 'Ok' && data.routes?.length > 0) {
        const route = data.routes[0];
        setEta(Math.round(route.duration / 60));
        setDistance((route.distance / 1000).toFixed(1));

        const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

        if (routeGroupRef.current) {
          routeGroupRef.current.clearLayers();
        } else {
          routeGroupRef.current = L.layerGroup().addTo(map);
        }

        L.polyline(coords, {
          color: '#ffffff', weight: 9, opacity: 1, lineCap: 'round', lineJoin: 'round',
        }).addTo(routeGroupRef.current);

        L.polyline(coords, {
          color: '#F4A261', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round',
        }).addTo(routeGroupRef.current);

        map.fitBounds(L.latLngBounds(coords), { padding: [55, 55], maxZoom: 16 });
      } else {
        throw new Error('No route found');
      }
    } catch {
      if (routeGroupRef.current) {
        routeGroupRef.current.clearLayers();
      } else {
        routeGroupRef.current = L.layerGroup().addTo(map);
      }
      L.polyline(
        [[from.lat, from.lng], [to.lat, to.lng]],
        { color: '#F4A261', weight: 4, dashArray: '10, 8', opacity: 0.8 }
      ).addTo(routeGroupRef.current);
      map.fitBounds([[from.lat, from.lng], [to.lat, to.lng]], { padding: [50, 50] });
    } finally {
      setRouteLoading(false);
    }
  };

  const hasAny   = isValid(agentLocation) || isValid(donorLocation);
  const hasAgent = isValid(agentLocation);
  const hasDonor = isValid(donorLocation);

  // Context-aware messages
  const waitingMsg = mode === 'donor'
    ? { icon: '🚴', title: 'Waiting for agent location…', sub: 'Live tracking will appear once the agent starts navigation' }
    : mode === 'admin'
    ? { icon: '📡', title: 'No live location yet', sub: 'Agent location will appear here once GPS is active' }
    : { icon: '📍', title: 'Waiting for location…', sub: 'Enable "Share Live GPS" above to start navigation' };

  const onlyDonorMsg = mode === 'donor'
    ? '📍 Your pickup location · Agent location will appear when they start'
    : mode === 'admin'
    ? '📍 Pickup location shown · Waiting for agent GPS'
    : '📍 Pickup location shown · Enable GPS to share your position';

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 16, overflow: 'hidden' }}>

      {/* Map */}
      <div ref={mapRef} style={{ height, width: '100%', borderRadius: 16, zIndex: 0, background: '#f0ede6' }} />

      {/* ETA / Distance pill */}
      {showETA && (eta !== null || distance !== null || routeLoading) && (
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 1000,
          background: 'white', borderRadius: 12, padding: '9px 16px',
          boxShadow: '0 4px 18px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: 14, minWidth: 100,
        }}>
          {routeLoading ? (
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Calculating route…</span>
          ) : (
            <>
              {eta !== null && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#F4A261', lineHeight: 1 }}>{eta}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, fontWeight: 600, letterSpacing: '0.05em' }}>MIN</div>
                </div>
              )}
              {eta !== null && distance !== null && (
                <div style={{ width: 1, height: 28, background: '#e5e7eb' }} />
              )}
              {distance !== null && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1BA672', lineHeight: 1 }}>{distance}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, fontWeight: 600, letterSpacing: '0.05em' }}>KM</div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* LIVE badge — top right, only when agent is broadcasting */}
      {hasAgent && (
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 1000,
          background: '#1BA672', color: 'white',
          borderRadius: 20, padding: '5px 12px',
          fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 5,
          letterSpacing: '0.08em',
          boxShadow: '0 2px 8px rgba(45,106,79,0.4)',
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%', background: '#4DC49A',
            animation: 'livePulse 1.1s ease-in-out infinite',
          }} />
          LIVE
        </div>
      )}

      {/* Full waiting overlay — no locations at all */}
      {!hasAny && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(254,250,224,0.92)',
          borderRadius: 16, zIndex: 600,
        }}>
          <div style={{ fontSize: 42, marginBottom: 10 }}>{waitingMsg.icon}</div>
          <p style={{ color: '#282C3F', fontWeight: 600, fontSize: 15, margin: 0 }}>{waitingMsg.title}</p>
          <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 5, textAlign: 'center', maxWidth: 220 }}>{waitingMsg.sub}</p>
        </div>
      )}

      {/* Donor location known but no agent yet — show info banner */}
      {!hasAgent && hasDonor && (
        <div style={{
          position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(27,166,114,0.92)', color: 'white',
          borderRadius: 20, padding: '6px 16px',
          fontSize: 12, fontWeight: 600, zIndex: 600,
          whiteSpace: 'nowrap',
        }}>
          {onlyDonorMsg}
        </div>
      )}

      <style>{`
        @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  );
}
