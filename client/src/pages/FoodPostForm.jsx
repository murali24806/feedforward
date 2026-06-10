import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import { postFood } from '../services/api';
import { useGeolocation } from '../hooks/useGeolocation';

export default function FoodPostForm() {
  const navigate = useNavigate();
  const { location, error: geoError, loading: geoLoading, getLocation } = useGeolocation();
  const [form, setForm] = useState({ foodName: '', quantity: '', type: 'veg', expiryTime: '', description: '' });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  useEffect(() => { getLocation(); }, []);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handlePhoto = (e) => {
    const f = e.target.files[0];
    if (f) { setPhoto(f); setPreview(URL.createObjectURL(f)); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!location) { setError('Please enable location access to post food.'); return; }
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append('lat', location.lat);
      fd.append('lng', location.lng);
      fd.append('address', `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`);
      if (photo) fd.append('photo', photo);
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
            {/* Photo upload */}
            <div className="card">
              <h3 className="font-display font-semibold text-[#282C3F] text-lg mb-4">Food Photo</h3>
              <div className="flex items-center gap-5">
                <div
                  className="w-28 h-28 rounded-2xl bg-[#F4F4F4] border-2 border-dashed border-[#E8E8E8] flex items-center justify-center cursor-pointer overflow-hidden hover:border-[#FC8019] hover:bg-[#FFF3E8] transition-all"
                  onClick={() => fileRef.current?.click()}>
                  {preview
                    ? <img src={preview} alt="" className="w-full h-full object-cover rounded-2xl" />
                    : <div className="text-center p-2"><div className="text-3xl mb-1">📷</div><p className="text-xs text-[#686B78] font-medium">Add Photo</p></div>}
                </div>
                <div>
                  <button type="button" onClick={() => fileRef.current?.click()} className="btn-outline text-sm px-5 py-2.5">Upload Image</button>
                  <p className="text-sm text-[#686B78] mt-2">JPG, PNG, WebP · Max 5MB · Optional</p>
                </div>
                <input type="file" ref={fileRef} accept="image/*" onChange={handlePhoto} className="hidden" />
              </div>
            </div>

            {/* Food details */}
            <div className="card space-y-5">
              <h3 className="font-display font-semibold text-[#282C3F] text-lg">Food Details</h3>
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
                        className={`flex-1 py-3.5 rounded-xl border-2 font-semibold text-base transition-all ${
                          form.type === t
                            ? t === 'veg' ? 'border-[#1BA672] bg-[#E8F8F2] text-[#1BA672]' : 'border-[#FC8019] bg-[#FFF3E8] text-[#FC8019]'
                            : 'border-[#E8E8E8] text-[#686B78] hover:border-gray-300'}`}>
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
                <div className="flex items-center gap-3 bg-[#E8F8F2] rounded-2xl px-5 py-4 border border-[#1BA672]/20">
                  <span className="text-2xl">📍</span>
                  <div>
                    <p className="font-semibold text-[#1BA672] text-base">Location captured!</p>
                    <p className="text-sm text-[#686B78] mt-0.5">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</p>
                  </div>
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
