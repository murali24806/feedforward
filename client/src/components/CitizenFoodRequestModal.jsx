import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  submitCitizenRequest,
  getCitizenRequestStatus,
  getAvailableSurplusFood
} from '../services/api';

export default function CitizenFoodRequestModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('request'); // 'request' | 'status' | 'browse'

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [mealsNeeded, setMealsNeeded] = useState(2);
  const [dietaryType, setDietaryType] = useState('any');
  const [needType, setNeedType] = useState('Individual');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [coords, setCoords] = useState({ lat: null, lng: null, accuracy: null });
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [gpsLocked, setGpsLocked] = useState(false);

  // Result state
  const [submittedData, setSubmittedData] = useState(null);

  // Status Search State
  const [searchPhone, setSearchPhone] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [foundRequests, setFoundRequests] = useState(null);
  const [searchError, setSearchError] = useState('');

  // Live Food State
  const [availableFood, setAvailableFood] = useState([]);
  const [loadingFood, setLoadingFood] = useState(false);

  // Mini Map Refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  // Auto-detect GPS when modal opens in request tab
  useEffect(() => {
    if (isOpen && activeTab === 'request' && !coords.lat && !gpsLocked) {
      handleDetectLocation();
    }
  }, [isOpen, activeTab]);

  // Fetch available food when browse tab is clicked
  useEffect(() => {
    if (activeTab === 'browse' && availableFood.length === 0) {
      setLoadingFood(true);
      getAvailableSurplusFood()
        .then((res) => {
          if (res.data?.foodPosts) setAvailableFood(res.data.foodPosts);
        })
        .catch(() => {})
        .finally(() => setLoadingFood(false));
    }
  }, [activeTab, availableFood.length]);

  // Initialize or update Leaflet Mini Map when coordinates change
  useEffect(() => {
    if (!coords.lat || !coords.lng || activeTab !== 'request') return;

    const L = window.L;
    if (!L || !mapContainerRef.current) return;

    const latLng = [coords.lat, coords.lng];

    if (!mapInstanceRef.current) {
      // Create Leaflet Map Instance
      const map = L.map(mapContainerRef.current, {
        center: latLng,
        zoom: 16,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      // Custom pulsing pin
      const pinIcon = L.divIcon({
        html: `<div style="background:#16A34A; color:#fff; border-radius:50%; width:34px; height:34px; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 12px rgba(22,163,74,0.5); font-size:18px; border:3px solid #fff; cursor:grab;">📍</div>`,
        className: 'leaflet-pin-icon',
        iconSize: [34, 34],
        iconAnchor: [17, 34]
      });

      const marker = L.marker(latLng, { icon: pinIcon, draggable: true }).addTo(map);

      // Accuracy circle
      let circle = null;
      if (coords.accuracy) {
        circle = L.circle(latLng, {
          radius: Math.min(coords.accuracy, 200),
          color: '#16A34A',
          fillColor: '#16A34A',
          fillOpacity: 0.12,
          weight: 1.5
        }).addTo(map);
        circleRef.current = circle;
      }

      // Drag listener to let user fine-tune doorstep location
      marker.on('dragend', async (ev) => {
        const newPos = ev.target.getLatLng();
        setCoords((prev) => ({ ...prev, lat: newPos.lat, lng: newPos.lng }));
        if (circleRef.current) circleRef.current.setLatLng(newPos);
        reverseGeocode(newPos.lat, newPos.lng);
      });

      // Click on map to reposition pin
      map.on('click', (ev) => {
        marker.setLatLng(ev.latlng);
        if (circleRef.current) circleRef.current.setLatLng(ev.latlng);
        setCoords((prev) => ({ ...prev, lat: ev.latlng.lat, lng: ev.latlng.lng }));
        reverseGeocode(ev.latlng.lat, ev.latlng.lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    } else {
      // Re-center map and marker
      mapInstanceRef.current.setView(latLng, 16);
      if (markerRef.current) markerRef.current.setLatLng(latLng);
      if (circleRef.current) {
        circleRef.current.setLatLng(latLng);
        if (coords.accuracy) circleRef.current.setRadius(Math.min(coords.accuracy, 200));
      }
    }
  }, [coords.lat, coords.lng, activeTab]);

  // Clean up map when closed
  useEffect(() => {
    if (!isOpen && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    }
  }, [isOpen]);

  // Reverse Geocode helper
  const reverseGeocode = async (latitude, longitude) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
      );
      const data = await res.json();
      if (data && data.display_name) {
        setAddress(data.display_name);
        const foundCity =
          data.address?.city ||
          data.address?.town ||
          data.address?.village ||
          data.address?.suburb ||
          '';
        if (foundCity) setCity(foundCity);
      }
    } catch (e) {
      if (!address) {
        setAddress(`GPS Location (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
      }
    }
  };

  // High Accuracy Geolocation Detection
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    setErrorMsg('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCoords({
          lat: latitude,
          lng: longitude,
          accuracy: accuracy ? Math.round(accuracy) : null
        });
        setGpsLocked(true);
        await reverseGeocode(latitude, longitude);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        // Fallback friendly message
        if (err.code === 1) {
          setErrorMsg('Location permission was denied. You can still type your area name below.');
        } else {
          setErrorMsg('Unable to retrieve precise GPS. Please type your area name below.');
        }
      },
      { timeout: 12000, enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  // Forward Geocode fallback if user types an address without GPS
  const forwardGeocode = async (query) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
    } catch (e) {}
    return null;
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setErrorMsg('Please enter your Name and Mobile Number.');
      return;
    }
    if (phone.trim().length < 8) {
      setErrorMsg('Please enter a valid phone number (at least 8 digits).');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      let finalLat = coords.lat;
      let finalLng = coords.lng;

      // If user typed address without GPS, forward geocode so delivery agent gets live navigation!
      if (!finalLat && address.trim()) {
        const lookup = await forwardGeocode(`${address.trim()}, ${city.trim()}`);
        if (lookup) {
          finalLat = lookup.lat;
          finalLng = lookup.lng;
        }
      }

      const res = await submitCitizenRequest({
        name: name.trim(),
        phone: phone.trim(),
        mealsNeeded: Number(mealsNeeded) || 1,
        dietaryType,
        needType,
        notes: notes.trim(),
        lat: finalLat,
        lng: finalLng,
        accuracy: coords.accuracy,
        address: address.trim() || 'Location via Live GPS',
        city: city.trim()
      });

      if (res.data?.success) {
        setSubmittedData({
          pin: res.data.pin,
          name: name.trim(),
          meals: mealsNeeded,
          phone: phone.trim(),
          lat: finalLat,
          lng: finalLng,
          address: address.trim()
        });
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Status Search Handler
  const handleCheckStatus = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!searchPhone.trim()) {
      setSearchError('Please enter your registered mobile number.');
      return;
    }

    setStatusLoading(true);
    setSearchError('');
    setFoundRequests(null);

    try {
      const res = await getCitizenRequestStatus(searchPhone.trim());
      if (res.data?.requests) {
        setFoundRequests(res.data.requests);
      }
    } catch (err) {
      setSearchError(err.response?.data?.message || 'No requests found for this mobile number.');
    } finally {
      setStatusLoading(false);
    }
  };

  const resetForm = () => {
    setSubmittedData(null);
    setName('');
    setPhone('');
    setMealsNeeded(2);
    setAddress('');
    setCity('');
    setNotes('');
    setCoords({ lat: null, lng: null, accuracy: null });
    setGpsLocked(false);
    setErrorMsg('');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 my-auto flex flex-col max-h-[94vh] sm:max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Banner (Sticky top) */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 p-4 sm:p-6 text-white relative shrink-0">
            <button
              onClick={onClose}
              className="absolute top-3 sm:top-5 right-3 sm:right-5 w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-sm sm:text-base font-bold transition-all cursor-pointer"
              aria-label="Close"
            >
              ✕
            </button>
            <div className="flex items-center gap-2.5 sm:gap-3 mb-1.5 sm:mb-2 pr-8">
              <span className="text-2xl sm:text-3xl p-1.5 sm:p-2 bg-white/20 rounded-xl sm:rounded-2xl backdrop-blur-md">
                🍽️
              </span>
              <div>
                <span className="inline-block bg-white/20 text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider mb-0.5">
                  100% Free · No Login Required
                </span>
                <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight leading-tight">
                  Food Assistance & Live Delivery
                </h2>
              </div>
            </div>
            <p className="text-emerald-100 text-xs sm:text-sm max-w-lg hidden sm:block">
              Request free surplus meals. Your live GPS coordinates will be captured so delivery
              volunteers can navigate directly to your location.
            </p>

            {/* Navigation Tabs (Scrollable on small mobile) */}
            <div className="flex gap-1.5 sm:gap-2 mt-3 sm:mt-4 bg-black/20 p-1 rounded-xl sm:rounded-2xl overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('request');
                  setErrorMsg('');
                }}
                className={`flex-1 py-1.5 sm:py-2 px-2.5 sm:px-3 text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl whitespace-nowrap transition-all ${
                  activeTab === 'request'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                📝 Request Meals
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('status');
                  setSearchError('');
                }}
                className={`flex-1 py-1.5 sm:py-2 px-2.5 sm:px-3 text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl whitespace-nowrap transition-all ${
                  activeTab === 'status'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                🔍 Check Status & Navigation
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('browse')}
                className={`flex-1 py-1.5 sm:py-2 px-2.5 sm:px-3 text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl whitespace-nowrap transition-all ${
                  activeTab === 'browse'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                🍱 Available Surplus
              </button>
            </div>
          </div>

          {/* Modal Body (Scrollable) */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
            {/* ── TAB 1: REQUEST FOOD FORM ─────────────────────────── */}
            {activeTab === 'request' && !submittedData && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm rounded-xl flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">⚠️</span>
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-sm outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Mobile Number (For Delivery & PIN) *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-sm outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Meals & Dietary Preference */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Meals Needed *
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 5, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setMealsNeeded(num)}
                          className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                            mealsNeeded === num
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Dietary Type
                    </label>
                    <select
                      value={dietaryType}
                      onChange={(e) => setDietaryType(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:border-emerald-500"
                    >
                      <option value="any">Any (Veg / Non-Veg)</option>
                      <option value="veg">Pure Vegetarian 🌱</option>
                      <option value="non-veg">Non-Vegetarian 🍗</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Requester Category
                    </label>
                    <select
                      value={needType}
                      onChange={(e) => setNeedType(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:border-emerald-500"
                    >
                      <option value="Individual">Individual Person</option>
                      <option value="Family">Family / Household</option>
                      <option value="Senior Citizen">Senior Citizen / Elder</option>
                      <option value="Student">Student Hostel</option>
                      <option value="Shelter">Shelter / Camp</option>
                    </select>
                  </div>
                </div>

                {/* ── LIVE GPS & INTERACTIVE MAP PINNING ── */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-700 text-base">📍</span>
                      <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                        Live Delivery GPS Location
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={locating}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {locating ? (
                        <>
                          <span className="animate-spin text-xs">🔄</span>
                          <span>Locking GPS...</span>
                        </>
                      ) : (
                        <>
                          <span>📡</span>
                          <span>{coords.lat ? 'Re-detect Live GPS' : 'Lock My Live GPS'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* GPS Status Banner */}
                  {coords.lat && coords.lng ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white p-2.5 rounded-xl border border-emerald-200 text-emerald-800">
                      <div className="flex items-center gap-1.5 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>
                          <strong>GPS Locked:</strong> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                          {coords.accuracy ? ` (±${coords.accuracy}m accuracy)` : ''}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-500 font-normal">
                        Drag pin on map to fine-tune doorstep
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-800/80 bg-white/70 p-2 rounded-lg">
                      💡 Click <strong>"Lock My Live GPS"</strong> so delivery drivers can navigate
                      directly to your current spot.
                    </div>
                  )}

                  {/* Interactive Leaflet Mini-Map */}
                  <div
                    ref={mapContainerRef}
                    className="w-full h-44 sm:h-52 rounded-xl overflow-hidden border border-emerald-200 relative bg-gray-100 shadow-inner"
                    style={{ minHeight: '160px' }}
                  >
                    {!coords.lat && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 text-xs p-4 text-center z-10 bg-gray-50/90">
                        <span className="text-2xl mb-1">🗺️</span>
                        <p className="font-semibold text-gray-600">Map will appear once GPS is detected</p>
                        <p className="text-[11px] text-gray-400">
                          Or type your street address below to locate
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Address input */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Street Address / Landmark
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Near Community Hall, Door No 4-12, Main Road"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs sm:text-sm bg-white outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      City / District *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Visakhapatnam / Hyderabad"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Special Notes (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Call upon reaching / Elderly person"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 text-sm outline-none"
                    />
                  </div>
                </div>

                {/* Submit CTA */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold text-sm sm:text-base shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <span className="animate-spin text-lg">🔄</span>
                        <span>Saving Request & Pinning Location...</span>
                      </>
                    ) : (
                      <>
                        <span>🚀</span>
                        <span>Submit Request (Get 4-Digit Pickup PIN)</span>
                      </>
                    )}
                  </button>
                  <p className="text-center text-[11px] text-gray-400 mt-2">
                    🔒 Food is 100% free. Verified by NGO administrators and community volunteers.
                  </p>
                </div>
              </form>
            )}

            {/* ── SUCCESS SCREEN: 4-DIGIT PIN DISPLAY ────────────────── */}
            {activeTab === 'request' && submittedData && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4 sm:py-6 px-2 space-y-4 sm:space-y-5"
              >
                <div className="w-16 sm:w-20 h-16 sm:h-20 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl sm:text-4xl shadow-inner">
                  🎉
                </div>

                <div>
                  <h3 className="text-xl sm:text-2xl font-bold font-display text-gray-900">
                    Request Received, {submittedData.name}!
                  </h3>
                  <p className="text-gray-600 text-xs sm:text-sm mt-1 max-w-md mx-auto">
                    Your request for <strong>{submittedData.meals} meal(s)</strong> has been logged in
                    the local community network.
                  </p>
                </div>

                {/* 4-Digit PIN Card */}
                <div className="bg-gradient-to-b from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl sm:rounded-3xl p-5 sm:p-6 max-w-sm mx-auto shadow-md">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-200/60 px-3 py-1 rounded-full">
                    Your 4-Digit Pickup PIN
                  </span>
                  <div className="text-4xl sm:text-5xl font-extrabold font-mono text-emerald-700 tracking-widest my-3">
                    {submittedData.pin}
                  </div>
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    Show or mention this PIN to verify food collection or when meeting the delivery
                    courier.
                  </p>
                </div>

                {/* Live Navigation Coordinates confirmation */}
                {submittedData.lat && submittedData.lng && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl max-w-sm mx-auto text-left text-xs text-gray-600 space-y-1">
                    <div className="font-semibold text-gray-800 flex items-center gap-1.5">
                      <span>📍</span> Doorstep Location Captured:
                    </div>
                    <p className="truncate text-gray-500">{submittedData.address}</p>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${submittedData.lat},${submittedData.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-600 hover:underline font-bold mt-1"
                    >
                      🗺️ Test Direct Navigation Route ↗
                    </a>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 justify-center pt-2">
                  <button
                    onClick={() => {
                      setSearchPhone(submittedData.phone);
                      setActiveTab('status');
                      handleCheckStatus({ preventDefault: () => {} });
                    }}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                  >
                    🔍 View Request Status
                  </button>
                  <button
                    onClick={resetForm}
                    className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs sm:text-sm transition-all cursor-pointer"
                  >
                    + Submit Another Request
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── TAB 2: CHECK REQUEST STATUS ─────────────────────── */}
            {activeTab === 'status' && (
              <div className="space-y-4">
                <form onSubmit={handleCheckStatus} className="flex gap-2">
                  <input
                    type="tel"
                    required
                    placeholder="Enter your registered mobile number"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs sm:text-sm outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={statusLoading}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs sm:text-sm hover:bg-emerald-700 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    {statusLoading ? 'Searching...' : 'Check Status'}
                  </button>
                </form>

                {searchError && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm rounded-xl">
                    ⚠️ {searchError}
                  </div>
                )}

                {foundRequests && foundRequests.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Found {foundRequests.length} Food Request(s):
                    </p>
                    {foundRequests.map((req) => (
                      <div
                        key={req._id}
                        className="p-4 rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition-all space-y-2.5 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                              req.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : req.status === 'fulfilled'
                                ? 'bg-blue-100 text-blue-800'
                                : req.status === 'rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            ● {req.status}
                          </span>
                          <span className="text-xs font-mono font-bold bg-white px-3 py-1 rounded-lg border border-gray-200 text-emerald-700 shadow-sm">
                            PIN: {req.pin}
                          </span>
                        </div>

                        <div className="text-sm font-semibold text-gray-800">
                          {req.mealsNeeded} Meal(s) ({req.dietaryType}) · {req.needType}
                        </div>
                        <p className="text-xs text-gray-500">
                          📍 {req.location?.address || 'Location provided'} ·{' '}
                          {new Date(req.createdAt).toLocaleDateString()}
                        </p>

                        {/* Live GPS Navigation Link */}
                        {req.location?.lat && req.location?.lng && (
                          <div className="pt-1">
                            <a
                              href={
                                req.location.navigationUrl ||
                                `https://www.google.com/maps/dir/?api=1&destination=${req.location.lat},${req.location.lng}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                            >
                              <span>🚗</span>
                              <span>Open Live GPS Navigation ↗</span>
                            </a>
                          </div>
                        )}

                        {req.matchedFoodPostId && (
                          <div className="mt-2 p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800">
                            🍱 <strong>Matched Food:</strong> {req.matchedFoodPostId.foodName} (
                            {req.matchedFoodPostId.quantity})
                          </div>
                        )}
                        {req.matchedAdminId && (
                          <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-800">
                            🏢 <strong>Assigned NGO:</strong>{' '}
                            {req.matchedAdminId.organizationName || req.matchedAdminId.name} (
                            {req.matchedAdminId.phone})
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 3: BROWSE AVAILABLE SURPLUS FOOD ─────────────── */}
            {activeTab === 'browse' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  Real-time surplus food listed by local donors ready for distribution:
                </p>

                {loadingFood && (
                  <div className="py-8 text-center text-gray-400 text-xs sm:text-sm">
                    🔄 Loading active food posts...
                  </div>
                )}

                {!loadingFood && availableFood.length === 0 && (
                  <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500 text-xs sm:text-sm p-4">
                    No active surplus food listed right now. You can still submit a request and NGOs
                    will match you as soon as food is donated!
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableFood.map((food) => (
                    <div
                      key={food._id}
                      className="border border-gray-200 rounded-2xl p-3 flex gap-3 hover:shadow-md transition-all bg-white"
                    >
                      <div className="w-16 sm:w-20 h-16 sm:h-20 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
                        {food.photo ? (
                          <img
                            src={food.photo}
                            alt={food.foodName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl sm:text-2xl">
                            🍱
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              food.type === 'veg' ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                            {food.foodName}
                          </h4>
                        </div>
                        <p className="text-xs text-emerald-700 font-semibold mb-0.5">
                          {food.quantity}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">
                          📍 {food.location?.address || 'Local area'}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setNotes(`Requesting: ${food.foodName} (${food.quantity})`);
                            setActiveTab('request');
                          }}
                          className="mt-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-800"
                        >
                          + Request this meal →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Close */}
          <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-gray-600 font-semibold text-xs sm:text-sm hover:bg-gray-200 transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
