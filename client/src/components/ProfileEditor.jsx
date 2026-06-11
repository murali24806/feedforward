import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { updateProfile } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ProfileEditor() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', address: user?.address || '', bio: user?.bio || '', vehicleType: user?.vehicleType || '', isAvailable: user?.isAvailable ?? true });
  const [preview, setPreview] = useState(user?.profilePhoto || '');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef();

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); setPreview(URL.createObjectURL(f)); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append('profilePhoto', file);
      const res = await updateProfile(fd);
      updateUser(res.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card max-w-2xl">
      <h3 className="font-display text-2xl font-bold text-[#282C3F] mb-6">Edit Profile</h3>
      <form onSubmit={submit} className="space-y-5">
        {/* Photo */}
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-[#FC8019] overflow-hidden shadow-md cursor-pointer" onClick={() => fileRef.current?.click()}>
              {preview ? <img src={preview} alt="Profile" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white font-bold text-4xl">{user?.name?.[0]?.toUpperCase()}</div>}
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#FC8019] rounded-full flex items-center justify-center text-white shadow-md hover:bg-[#E8720C] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            <input type="file" ref={fileRef} accept="image/*" onChange={handleFile} className="hidden" />
          </div>
          <div>
            <p className="font-semibold text-[#282C3F]">{user?.name}</p>
            <p className="text-sm text-[#686B78] capitalize">{user?.role}</p>
            <p className="text-sm text-[#686B78]">{user?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-[#282C3F] mb-1.5">{user?.role === 'admin' ? 'Organization Name' : 'Full Name'}</label>
            <input name="name" value={form.name} onChange={handle} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#282C3F] mb-1.5">Phone Number</label>
            <input name="phone" value={form.phone} onChange={handle} className="input-field" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#282C3F] mb-1.5">Address</label>
          <input name="address" value={form.address} onChange={handle} className="input-field" placeholder="Your address" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#282C3F] mb-1.5">Bio</label>
          <textarea name="bio" value={form.bio} onChange={handle} rows={3} className="input-field resize-none" placeholder="Tell us about yourself..." />
        </div>

        {user?.role === 'agent' && (
          <>
            <div>
              <label className="block text-sm font-semibold text-[#282C3F] mb-1.5">Vehicle Type</label>
              <select name="vehicleType" value={form.vehicleType} onChange={handle} className="input-field">
                <option value="">Select vehicle</option>
                <option value="Bicycle">Bicycle</option>
                <option value="Motorbike">Motorbike</option>
                <option value="Car">Car</option>
                <option value="Van">Van</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <div className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${form.isAvailable ? 'bg-[#FC8019]' : 'bg-gray-200'}`}
                onClick={() => setForm({ ...form, isAvailable: !form.isAvailable })}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.isAvailable ? 'left-7' : 'left-1'}`} />
              </div>
              <span className="text-sm font-semibold text-[#282C3F]">Available for deliveries</span>
            </div>
          </>
        )}

        {success && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#FC8019]/10 text-[#1BA672] px-4 py-3 rounded-xl text-sm font-medium">
            ✅ Profile updated successfully!
          </motion.div>
        )}

        <button type="submit" disabled={loading} className="btn-primary disabled:opacity-60">
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </motion.div>
  );
}
