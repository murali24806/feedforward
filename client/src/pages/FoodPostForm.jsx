import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import { postFood, getAdmins } from '../services/api';
import { useGeolocation } from '../hooks/useGeolocation';
import LiveMap from '../components/LiveMap';

export default function FoodPostForm() {
  const navigate = useNavigate();
  const { location, error: geoError, loading: geoLoading, getLocation } = useGeolocation();
  const [form, setForm] = useState({ foodName: '', quantity: '', type: 'veg', expiryTime: '', description: '', address: '', adminId: 'all' });
  const [photo, setPhoto] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Camera Capture States & Refs
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('environment');
  const fileRef = useRef(null);
  const mobileCaptureRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => { 
    getLocation(); 
    getAdmins().then(res => setAdmins(res.data)).catch(console.error);

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handlePhoto = (e) => {
    const f = e.target.files[0];
    if (f) {
      setPhoto(f);
      setPreview(URL.createObjectURL(f));
      setError('');
    }
  };

  // Live Camera Functions
  const startCamera = async (facing = cameraFacing) => {
    try {
      setError('');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(console.error);
        }
      }, 100);
    } catch (err) {
      console.warn('getUserMedia failed or denied, opening native camera:', err);
      // Fallback directly to native mobile camera capture
      mobileCaptureRef.current?.click();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `captured_food_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setPhoto(file);
        setPreview(URL.createObjectURL(file));
        setError('');
        stopCamera();
      }
    }, 'image/jpeg', 0.92);
  };

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    startCamera(nextFacing);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!photo) {
      setError('Please capture or upload a clear photo of the food donation. An image is mandatory.');
      return;
    }
    if (!location) { setError('Please enable location access to post food.'); return; }
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      const isBroadcast = form.adminId === 'all' || !form.adminId;
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'adminId') {
          fd.append('adminId', isBroadcast ? '' : v);
        } else if (k === 'address' && !v) {
          fd.append(k, `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`);
        } else {
          fd.append(k, v);
        }
      });
      fd.append('isBroadcast', isBroadcast ? 'true' : 'false');
      fd.append('lat', location.lat);
      fd.append('lng', location.lng);
      fd.append('photo', photo);
      const res = await postFood(fd);
      navigate(`/donor/track/${res.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post food. Please try again.');
    } finally { setLoading(false); }
  };

  const minDateTime = new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <DashboardLayout title="Post Food Donation">
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-7">
            <h2 className="font-display text-3xl font-bold text-[#282C3F]">Share Surplus Food 🍱</h2>
            <p className="text-[#686B78] text-base mt-1.5">Fill in the details about the food you'd like to donate.</p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            {/* Photo capture & upload */}
            <div className={`card ${!photo && error ? 'ring-2 ring-red-400' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-[#282C3F] text-lg flex items-center gap-1.5">
                  Food Photo <span className="text-red-500 font-bold">*</span>
                </h3>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">
                  Mandatory
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-5">
                <div
                  className={`w-32 h-32 rounded-2xl ${preview ? 'border-2 border-emerald-500 ring-2 ring-emerald-100' : 'border-2 border-dashed border-[#E8E8E8]'} bg-[#F4F4F4] flex items-center justify-center overflow-hidden transition-all flex-shrink-0 relative group`}
                >
                  {preview ? (
                    <img src={preview} alt="Food Preview" className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    <div className="text-center p-2">
                      <div className="text-3xl mb-1">📷</div>
                      <p className="text-xs text-[#686B78] font-medium">No photo yet *</p>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3 w-full">
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => startCamera()}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FC8019] to-orange-500 text-white font-semibold text-sm shadow-sm hover:brightness-105 active:scale-95 transition-all flex items-center gap-2"
                    >
                      <span>📸</span> {photo ? 'Retake Photo' : 'Capture with Camera'}
                    </button>

                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold text-sm shadow-sm active:scale-95 transition-all flex items-center gap-2"
                    >
                      <span>📁</span> Upload from Files
                    </button>

                    {photo && (
                      <button
                        type="button"
                        onClick={() => { setPhoto(null); setPreview(''); }}
                        className="px-3 py-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-semibold text-sm transition-colors"
                        title="Remove photo"
                      >
                        🗑️ Remove
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-[#686B78]">
                    Capture photo directly using your webcam/phone camera, or upload an existing image.
                  </p>
                </div>

                {/* Hidden input tags */}
                <input type="file" ref={fileRef} accept="image/*" onChange={handlePhoto} className="hidden" />
                <input type="file" ref={mobileCaptureRef} accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>

            {/* Live Camera Viewfinder Modal */}
            <AnimatePresence>
              {cameraOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-black border border-white/20 rounded-3xl p-5 w-full max-w-lg shadow-2xl relative overflow-hidden"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between text-white mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="font-bold text-sm">Live Camera Viewfinder</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={toggleCameraFacing}
                          className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-semibold"
                        >
                          🔄 Switch Camera
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="text-white/80 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Live Viewfinder Video */}
                    <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-video flex items-center justify-center border border-white/10">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {/* Viewfinder Target Guides */}
                      <div className="absolute inset-5 border-2 border-dashed border-white/40 rounded-xl pointer-events-none flex items-end justify-center pb-2">
                        <span className="text-[11px] text-white/80 bg-black/60 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                          Align food clearly in frame
                        </span>
                      </div>
                    </div>

                    {/* Snap Controls */}
                    <div className="flex items-center justify-between mt-5 px-4">
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="text-white/70 hover:text-white text-sm font-semibold"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={captureSnapshot}
                        className="w-16 h-16 rounded-full border-4 border-white bg-[#FC8019] hover:bg-orange-600 active:scale-95 shadow-xl flex items-center justify-center transition-all"
                        title="Snap Photo"
                      >
                        <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center">
                          <span className="text-xl">📸</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => { stopCamera(); mobileCaptureRef.current?.click(); }}
                        className="text-white/70 hover:text-white text-xs underline"
                      >
                        Device App
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Food details */}
            <div className="card space-y-5">
              <h3 className="font-display font-semibold text-[#282C3F] text-lg">Food Details</h3>
              
              <div>
                <label className="input-label">Donate To (Target Recipient) *</label>
                <select name="adminId" value={form.adminId} onChange={handle} required className="input-field bg-white">
                  <option value="all">🌐 Open to All NGOs (Recommended — Fastest Pickup)</option>
                  <optgroup label="Or send to a specific NGO:">
                    {admins.map(admin => (
                      <option key={admin._id} value={admin._id}>
                        🏢 {admin.organizationName ? `${admin.organizationName} (${admin.name})` : admin.name}
                      </option>
                    ))}
                  </optgroup>
                </select>

                {form.adminId === 'all' ? (
                  <div className="mt-2.5 text-sm text-[#1BA672] bg-[#E8F8F2] p-3.5 rounded-xl border border-[#1BA672]/30 flex items-start gap-2.5">
                    <span className="text-xl">📢</span>
                    <div>
                      <div className="font-semibold text-[#1BA672]">Open Broadcast Active</div>
                      <p className="text-xs text-[#406856] mt-0.5">
                        This donation will be broadcast live to <strong>all registered NGOs</strong> in your city. The first NGO to accept will be assigned, ensuring the quickest food pickup and minimum waste!
                      </p>
                    </div>
                  </div>
                ) : (
                  form.adminId && admins.find(a => a._id === form.adminId) && (
                    <div className="mt-2 text-sm text-[#686B78] bg-[#F4F4F4] p-3 rounded-xl border border-[#E8E8E8]">
                      <div className="font-semibold text-[#282C3F] mb-1">Selected Organization:</div>
                      <p className="mb-1"><span className="font-medium text-[#282C3F]">Address:</span> {admins.find(a => a._id === form.adminId).address || 'Not provided'}</p>
                      <p><span className="font-medium text-[#282C3F]">Phone:</span> {admins.find(a => a._id === form.adminId).phone || 'Not provided'}</p>
                    </div>
                  )
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Food Name *</label>
                  <input name="foodName" value={form.foodName} onChange={handle} placeholder="e.g., Rice & Dal" required className="input-field" />
                </div>
                <div>
                  <label className="input-label">Quantity *</label>
                  <input name="quantity" value={form.quantity} onChange={handle} placeholder="e.g., 10 servings" required className="input-field" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Food Type *</label>
                  <div className="flex gap-3">
                    {['veg', 'non-veg'].map((t) => (
                      <button key={t} type="button" onClick={() => setForm({ ...form, type: t })}
                        className={`flex-1 py-3.5 rounded-[16px] border font-semibold text-sm transition-all duration-150 active:scale-[0.98] ${
                          form.type === t
                            ? t === 'veg' ? 'border-[#34C759] bg-[#34C759]/15 text-[#248A3D] shadow-sm' : 'border-[#FF9500] bg-[#FF9500]/15 text-[#C97100] shadow-sm'
                            : 'border-black/10 bg-white/70 text-[#636366] hover:bg-white'}`}>
                        {t === 'veg' ? '🥦 Veg' : '🍗 Non-Veg'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="input-label">Best Before *</label>
                  <input name="expiryTime" type="datetime-local" value={form.expiryTime} onChange={handle} min={minDateTime} required className="input-field" />
                </div>
              </div>

              <div>
                <label className="input-label">Description</label>
                <textarea name="description" value={form.description} onChange={handle} rows={3}
                  placeholder="Any additional details about the food (allergens, storage, etc.)..."
                  className="input-field resize-none" />
              </div>

              <div>
                <label className="input-label">Pickup Address *</label>
                <textarea name="address" value={form.address} onChange={handle} rows={2}
                  placeholder="Enter complete pickup address (Door no, Street, Landmark)..."
                  required
                  className="input-field resize-none" />
              </div>
            </div>

            {/* Location */}
            <div className="card">
              <h3 className="font-display font-semibold text-[#282C3F] text-lg mb-4">Pickup Location</h3>
              {geoLoading ? (
                <div className="flex items-center gap-3 text-[#686B78]">
                  <svg className="animate-spin h-5 w-5 text-[#1BA672]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  <span className="text-base">Getting your location...</span>
                </div>
              ) : location ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-[#E8F8F2] rounded-2xl px-5 py-3 border border-[#1BA672]/20">
                    <span className="text-2xl">📍</span>
                    <div className="flex-1">
                      <p className="font-semibold text-[#1BA672] text-sm">Location captured successfully!</p>
                      <p className="text-xs text-[#686B78] mt-0.5">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</p>
                    </div>
                    <button type="button" onClick={getLocation} className="text-xs font-semibold text-[#1BA672] hover:underline">
                      🔄 Recalibrate
                    </button>
                  </div>
                  <LiveMap donorLocation={location} height="150px" zoom={15} mode="donor" />
                </div>
              ) : (
                <div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-base text-amber-700 mb-4">
                    ⚠️ {geoError || 'Location not detected'}
                  </div>
                  <button type="button" onClick={getLocation} className="btn-outline">📍 Try Again</button>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3.5 rounded-xl text-base flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => navigate('/donor')} className="btn-outline flex-1">Cancel</button>
              <button type="submit" disabled={loading || !location} className="btn-primary flex-1 disabled:opacity-60">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    Posting...
                  </span>
                ) : '🍱 Post Donation'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
