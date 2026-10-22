import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { completeProfile } from '../services/api';
import { useGeolocation } from '../hooks/useGeolocation';

const DONOR_TYPES = [
  { id: 'Individual', label: 'Individual / Home', icon: '🏠', desc: 'Surplus home meals & family gatherings' },
  { id: 'Restaurant', label: 'Restaurant / Cafe', icon: '🍽️', desc: 'Daily kitchen surplus & excess prep' },
  { id: 'Caterer', label: 'Caterer / Banquet', icon: '🎉', desc: 'Buffet surplus & event portions' },
  { id: 'Bakery', label: 'Bakery / Grocery', icon: '🥖', desc: 'Baked goods, produce & packaged food' },
  { id: 'Corporate', label: 'Corporate Cafeteria', icon: '🏢', desc: 'Office cafeteria & institutional meals' },
];

const VEHICLE_TYPES = [
  { id: 'Motorbike', label: 'Motorbike / Scooter', icon: '🛵', desc: 'Fast neighborhood dispatches' },
  { id: 'Bicycle', label: 'Bicycle', icon: '🚲', desc: 'Eco-friendly short-range deliveries' },
  { id: 'Car', label: 'Standard Car', icon: '🚗', desc: 'Medium capacity insulated boot' },
  { id: 'Van', label: 'Van / Mini-Truck', icon: '🚐', desc: 'High capacity bulk redistributions' },
];

const ROLE_META = {
  donor: {
    title: 'Food Donor Onboarding',
    badge: 'Donor Profile',
    icon: '🍱',
    color: '#FF9500',
    description: 'Provide your primary food pickup address so verified couriers can collect surplus meals seamlessly.',
    route: '/donor',
  },
  agent: {
    title: 'Delivery Courier Onboarding',
    badge: 'Delivery Agent Profile',
    icon: '🚴',
    color: '#007AFF',
    description: 'Specify your vehicle and dispatch base location so NGO administrators can coordinate local food pickups.',
    route: '/agent',
  },
  admin: {
    title: 'NGO Partner Onboarding',
    badge: 'NGO Admin Profile',
    icon: '🏢',
    color: '#34C759',
    description: 'Provide your organization name and receiving center address to claim donations for your community.',
    route: '/admin',
  },
};

export default function CompleteProfilePage() {
  const { user, updateUser, logoutUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const { getLocation, loading: geoLoading } = useGeolocation();

  const role = user?.role || 'donor';
  const meta = ROLE_META[role] || ROLE_META.donor;

  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    city: user?.city || '',
    pincode: user?.pincode || '',
    bio: user?.bio || '',
    donorType: user?.donorType || (role === 'donor' ? 'Individual' : ''),
    vehicleType: user?.vehicleType || (role === 'agent' ? 'Motorbike' : ''),
    organizationName: user?.organizationName || (role === 'admin' ? user?.name || '' : ''),
    isAvailable: user?.isAvailable ?? true,
  });

  const [preview, setPreview] = useState(user?.profilePhoto || '');
  const [photoFile, setPhotoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successCelebration, setSuccessCelebration] = useState(false);
  const [locatingState, setLocatingState] = useState(false);

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPreview(URL.createObjectURL(file));
      if (error) setError('');
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setLocatingState(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const city = addr.city || addr.town || addr.village || addr.suburb || addr.state_district || '';
            const postcode = addr.postcode || '';
            const road = addr.road || addr.neighbourhood || '';
            const fullAddress = [road, addr.suburb, city].filter(Boolean).join(', ');

            setForm((prev) => ({
              ...prev,
              address: prev.address || fullAddress || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
              city: prev.city || city,
              pincode: prev.pincode || postcode,
            }));
          }
        } catch (e) {
          console.warn('Reverse geocoding error:', e);
        } finally {
          setLocatingState(false);
        }
      },
      (err) => {
        setError(`Location detection failed: ${err.message}`);
        setLocatingState(false);
      },
      { timeout: 15000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!form.name.trim()) {
      setError('Please provide your Full Name.');
      return;
    }
    if (!form.phone.trim()) {
      setError('Please provide a valid Contact Phone Number.');
      return;
    }
    if (!form.address.trim()) {
      setError('Please provide your Street Address / Location.');
      return;
    }
    if (role === 'agent' && !form.vehicleType) {
      setError('Please choose your Delivery Vehicle Type.');
      return;
    }
    if (role === 'admin' && !form.organizationName.trim()) {
      setError('Please enter your NGO Organization Name.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', form.name.trim());
      formData.append('phone', form.phone.trim());
      formData.append('address', form.address.trim());
      formData.append('city', form.city.trim());
      formData.append('pincode', form.pincode.trim());
      formData.append('bio', form.bio.trim());

      if (role === 'donor') {
        formData.append('donorType', form.donorType);
      }
      if (role === 'agent') {
        formData.append('vehicleType', form.vehicleType);
        formData.append('isAvailable', form.isAvailable);
      }
      if (role === 'admin') {
        formData.append('organizationName', form.organizationName.trim());
      }
      if (photoFile) {
        formData.append('profilePhoto', photoFile);
      }

      const res = await completeProfile(formData);
      updateUser(res.data.user);
      setSuccessCelebration(true);

      setTimeout(() => {
        navigate(meta.route, { replace: true });
      }, 1600);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete profile. Please try again.');
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    const isStaff = role === 'admin' || role === 'superadmin' || role === 'agent';
    logoutUser();
    navigate(isStaff ? '/admin/login' : '/login');
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col justify-between font-sans text-[#1C1C1E] relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#FF9500]/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-32 w-96 h-96 rounded-full bg-[#34C759]/10 blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-2xl border-b border-black/[0.06] px-5 lg:px-12 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-[#FF9500] to-[#FC8019] flex items-center justify-center shadow-md shadow-orange-500/25">
            <span className="text-xl">🌱</span>
          </div>
          <div>
            <div className="font-display text-lg font-bold tracking-tight text-[#1C1C1E]">FeedForward</div>
            <div className="text-[11px] text-[#8E8E93] font-medium tracking-wide uppercase">First-Time Setup</div>
          </div>
        </div>

        {/* User Role Badge & Sign out */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-black/[0.04] border border-black/[0.06] px-3 py-1.5 rounded-full text-xs font-semibold text-[#1C1C1E]">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
            <span>{meta.badge}</span>
            <span className="text-[#8E8E93] font-normal">({user?.email})</span>
          </div>

          <button
            id="profile-signout-btn"
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#FF3B30] hover:bg-red-500/10 transition-colors border border-red-500/20"
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 sm:py-12 z-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="bg-white/90 backdrop-blur-2xl rounded-[30px] border border-black/[0.08] p-6 sm:p-10 shadow-[0_16px_50px_rgba(0,0,0,0.06)]"
        >
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-xs font-semibold text-[#8E8E93] mb-2 uppercase tracking-wider">
              <span>Account Registration</span>
              <span className="text-[#FF9500] font-bold">Profile Details (Required)</span>
              <span>Dashboard Ready</span>
            </div>
            <div className="w-full h-2 bg-black/[0.05] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#FF9500] to-[#FC8019] rounded-full w-[66%]" />
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold mb-3 border"
              style={{ backgroundColor: `${meta.color}15`, borderColor: `${meta.color}35`, color: meta.color }}>
              <span>{meta.icon}</span>
              <span>{meta.title}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1C1C1E]">
              Complete your profile, {user?.name?.split(' ')[0] || 'Friend'} 👋
            </h1>
            <p className="text-sm sm:text-base text-[#636366] mt-2 leading-relaxed">
              {meta.description}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-[18px] bg-red-500/10 border border-red-500/20 text-[#FF3B30] text-sm font-medium flex items-center gap-2.5"
            >
              <span className="text-base">⚠️</span>
              <span>{error}</span>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Photo & Core Info */}
            <div className="p-5 rounded-[22px] bg-black/[0.02] border border-black/[0.05]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E8E93] mb-4">
                1. Avatar & Personal Contact
              </h3>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Photo Preview & Clickable Avatar */}
                <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
                  <div className="w-24 h-24 rounded-[22px] bg-gradient-to-br from-[#FF9500] to-[#FC8019] overflow-hidden shadow-lg shadow-orange-500/20 flex items-center justify-center text-white text-3xl font-bold">
                    {preview ? (
                      <img src={preview} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span>{user?.name?.[0]?.toUpperCase() || '🌱'}</span>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/40 rounded-[22px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                    Change
                  </div>
                  <button
                    type="button"
                    aria-label="Upload photo"
                    onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                    className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-[#1C1C1E] text-white flex items-center justify-center shadow-md hover:scale-105 transition-transform"
                  >
                    📷
                  </button>
                  <input
                    id="profile-photo-input"
                    type="file"
                    ref={fileRef}
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </div>

                <div className="flex-1 w-full space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="input-label" htmlFor="name-input">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="name-input"
                        name="name"
                        value={form.name}
                        onChange={handleInput}
                        required
                        placeholder="e.g., Alex Johnson"
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="input-label" htmlFor="phone-input">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="phone-input"
                        name="phone"
                        type="tel"
                        value={form.phone}
                        onChange={handleInput}
                        required
                        placeholder="e.g., +91 9876543210"
                        className="input-field"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="input-label">Email Address (Verified)</label>
                    <div className="flex items-center justify-between px-4 py-3 rounded-[16px] bg-black/[0.04] border border-black/10 text-sm text-[#636366]">
                      <span>{user?.email}</span>
                      <span className="text-xs bg-[#34C759]/15 text-[#34C759] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span>✓</span> Verified
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Role Specific Details */}
            {role === 'donor' && (
              <div className="p-5 rounded-[22px] bg-black/[0.02] border border-black/[0.05]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E8E93] mb-4">
                  2. Donor Category & Surplus Type
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {DONOR_TYPES.map((dt) => {
                    const isSelected = form.donorType === dt.id;
                    return (
                      <button
                        key={dt.id}
                        type="button"
                        onClick={() => setForm({ ...form, donorType: dt.id })}
                        className={`p-3.5 rounded-[18px] border text-left transition-all active:scale-[0.98] ${
                          isSelected
                            ? 'border-[#FF9500] bg-[#FF9500]/10 shadow-sm shadow-orange-500/10'
                            : 'border-black/[0.08] bg-white hover:bg-black/[0.02]'
                        }`}
                      >
                        <div className="text-xl mb-1">{dt.icon}</div>
                        <div className={`text-sm font-bold tracking-tight ${isSelected ? 'text-[#FF9500]' : 'text-[#1C1C1E]'}`}>
                          {dt.label}
                        </div>
                        <div className="text-[11px] text-[#8E8E93] leading-tight mt-0.5">
                          {dt.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {role === 'agent' && (
              <div className="p-5 rounded-[22px] bg-black/[0.02] border border-black/[0.05]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E8E93] mb-4">
                  2. Delivery Courier Specs
                </h3>

                <div className="mb-4">
                  <label className="input-label">
                    Primary Delivery Vehicle <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {VEHICLE_TYPES.map((vt) => {
                      const isSelected = form.vehicleType === vt.id;
                      return (
                        <button
                          key={vt.id}
                          type="button"
                          onClick={() => setForm({ ...form, vehicleType: vt.id })}
                          className={`p-3.5 rounded-[18px] border text-left transition-all active:scale-[0.98] ${
                            isSelected
                              ? 'border-[#007AFF] bg-[#007AFF]/10 shadow-sm shadow-blue-500/10'
                              : 'border-black/[0.08] bg-white hover:bg-black/[0.02]'
                          }`}
                        >
                          <div className="text-xl mb-1">{vt.icon}</div>
                          <div className={`text-sm font-bold tracking-tight ${isSelected ? 'text-[#007AFF]' : 'text-[#1C1C1E]'}`}>
                            {vt.label}
                          </div>
                          <div className="text-[11px] text-[#8E8E93] leading-tight mt-0.5">
                            {vt.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Availability Toggle */}
                <div className="flex items-center justify-between p-3.5 bg-white rounded-[16px] border border-black/[0.08]">
                  <div>
                    <div className="text-sm font-bold text-[#1C1C1E]">Available for Pickups Immediately</div>
                    <div className="text-xs text-[#8E8E93]">Can administrators assign deliveries to you right away?</div>
                  </div>
                  <div
                    onClick={() => setForm({ ...form, isAvailable: !form.isAvailable })}
                    className={`relative w-12 h-6 rounded-full cursor-pointer transition-colors ${
                      form.isAvailable ? 'bg-[#34C759]' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                        form.isAvailable ? 'left-7' : 'left-1'
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}

            {role === 'admin' && (
              <div className="p-5 rounded-[22px] bg-black/[0.02] border border-black/[0.05]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E8E93] mb-4">
                  2. Organization Identity
                </h3>

                <div>
                  <label className="input-label" htmlFor="org-name-input">
                    NGO / Organization Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="org-name-input"
                    name="organizationName"
                    value={form.organizationName}
                    onChange={handleInput}
                    required
                    placeholder="e.g., Hope Community Food Bank Trust"
                    className="input-field"
                  />
                  <p className="text-xs text-[#8E8E93] mt-1.5">
                    This official name will be shown to food donors and volunteers when claiming donations.
                  </p>
                </div>
              </div>
            )}

            {/* Section 3: Address & Location */}
            <div className="p-5 rounded-[22px] bg-black/[0.02] border border-black/[0.05]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E8E93]">
                  3. {role === 'donor' ? 'Pickup Address' : role === 'agent' ? 'Operating Base Address' : 'NGO Center Address'}
                </h3>

                {/* Geolocation Detect Button */}
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={locatingState}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF9500] hover:text-[#FC8019] bg-[#FF9500]/10 hover:bg-[#FF9500]/20 px-3 py-1.5 rounded-full transition-colors active:scale-95 disabled:opacity-50"
                >
                  <span>{locatingState ? '⏳' : '📍'}</span>
                  <span>{locatingState ? 'Detecting...' : 'Detect My Location'}</span>
                </button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="input-label" htmlFor="address-input">
                    Street Address / Building / Landmark <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="address-input"
                    name="address"
                    value={form.address}
                    onChange={handleInput}
                    required
                    rows={2}
                    placeholder={
                      role === 'donor'
                        ? 'e.g., Flat 302, Green View Apts, 12th Main Road, Indiranagar'
                        : role === 'agent'
                        ? 'e.g., H.No 44/2, Central Avenue, Near Metro Station'
                        : 'e.g., Plot 15, Community Distribution Center, Civil Lines'
                    }
                    className="input-field !h-auto py-3 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="input-label" htmlFor="city-input">City / Locality</label>
                    <input
                      id="city-input"
                      name="city"
                      value={form.city}
                      onChange={handleInput}
                      placeholder="e.g., Bangalore"
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="input-label" htmlFor="pincode-input">Pincode / Postal Code</label>
                    <input
                      id="pincode-input"
                      name="pincode"
                      value={form.pincode}
                      onChange={handleInput}
                      placeholder="e.g., 560038"
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Bio / Extra Note */}
            <div>
              <label className="input-label" htmlFor="bio-input">
                About / Bio <span className="text-[#8E8E93] font-normal">(Optional)</span>
              </label>
              <textarea
                id="bio-input"
                name="bio"
                value={form.bio}
                onChange={handleInput}
                rows={2}
                placeholder={
                  role === 'donor'
                    ? 'e.g., We host weekend events and prioritize donating fresh leftover vegetarian meals.'
                    : role === 'agent'
                    ? 'e.g., Available on evenings and weekends with insulated food bags.'
                    : 'e.g., Non-profit trust serving hot dinner to homeless families and shelter children.'
                }
                className="input-field !h-auto py-3 resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              id="submit-profile-btn"
              type="submit"
              disabled={loading || successCelebration}
              className="btn-primary w-full py-4 text-base font-bold shadow-[0_8px_25px_rgba(255,149,0,0.35)] active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span>Saving Your Profile...</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>Complete Profile & Unlock Dashboard</span>
                  <span>→</span>
                </span>
              )}
            </button>
          </form>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-[#8E8E93]">
        FeedForward • Real-time Sustainable Food Redistribution Logistics
      </footer>

      {/* Success Celebration Overlay */}
      <AnimatePresence>
        {successCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="bg-white rounded-[32px] p-8 max-w-sm w-full text-center shadow-2xl border border-black/10"
            >
              <div className="w-20 h-20 rounded-full bg-[#34C759]/15 text-[#34C759] text-4xl flex items-center justify-center mx-auto mb-4 animate-bounce">
                🎉
              </div>
              <h2 className="font-display text-2xl font-bold text-[#1C1C1E] mb-2">
                Profile Completed!
              </h2>
              <p className="text-sm text-[#636366] mb-6">
                Welcome to the FeedForward network. Redirecting you to your workspace...
              </p>
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#FF9500]">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <span>Loading your dashboard...</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
