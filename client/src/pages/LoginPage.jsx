import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { login, register } from '../services/api';

const ROLES = [
  { value: 'donor', label: 'Donor', emoji: '🤲', desc: 'Share surplus food' },
  { value: 'admin', label: 'NGO Admin', emoji: '🏢', desc: 'Manage donations' },
  { value: 'agent', label: 'Agent', emoji: '🚴', desc: 'Deliver meals' },
];

export default function LoginPage() {
  const [tab, setTab] = useState('login');
  const [role, setRole] = useState('donor');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'register') {
        if (form.password !== form.confirmPassword) { setError('Passwords do not match'); setLoading(false); return; }
        const res = await register({ name: form.name, email: form.email, phone: form.phone, password: form.password, role });
        loginUser(res.data.user, res.data.token);
      } else {
        const res = await login({ email: form.email, password: form.password, role });
        loginUser(res.data.user, res.data.token);
      }
      const roleRoutes = { donor: '/donor', admin: '/admin', agent: '/agent' };
      navigate(roleRoutes[role]);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F9F9F9] font-sans">

      {/* LEFT: Hero Panel — desktop only */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-[#282C3F]">
        <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover opacity-30">
          <source src="https://assets.mixkit.co/videos/preview/mixkit-volunteers-serving-food-to-people-in-need-4765-large.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-br from-[#282C3F]/95 via-[#282C3F]/80 to-[#FC8019]/30" />

        <div className="relative z-10 flex flex-col justify-between p-16 text-white w-full">
          {/* Logo top */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FC8019] flex items-center justify-center shadow-lg">
              <span className="text-2xl">🌱</span>
            </div>
            <div>
              <div className="font-display text-2xl font-bold text-white">FeedForward</div>
              <div className="text-sm text-white/50 tracking-wide">Food Redistribution Platform</div>
            </div>
          </div>

          {/* Hero content */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 bg-[#FC8019]/20 border border-[#FC8019]/40 text-[#FC8019] text-sm font-semibold px-4 py-2 rounded-full mb-6">
              <span className="w-2 h-2 bg-[#FC8019] rounded-full animate-pulse" />
              Making a difference every day
            </div>
            <h1 className="font-display text-5xl font-bold leading-tight mb-6 text-white">
              Every meal saved<br />
              <span className="text-[#FC8019]">is a life changed</span>
            </h1>
            <p className="text-white/70 text-lg max-w-md leading-relaxed mb-10">
              Connecting food donors, NGOs, and delivery agents to reduce waste and nourish communities — one meal at a time.
            </p>
            <div className="flex gap-10">
              {[['10K+', 'Meals Saved'], ['500+', 'Active Donors'], ['50+', 'NGO Partners']].map(([num, label]) => (
                <div key={label}>
                  <div className="text-3xl font-bold text-[#FC8019] font-display">{num}</div>
                  <div className="text-white/50 text-sm mt-1">{label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Mobile top banner */}
      <div className="lg:hidden bg-[#282C3F] px-6 py-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#FC8019] flex items-center justify-center">
          <span className="text-xl">🌱</span>
        </div>
        <div>
          <div className="font-display text-xl font-bold text-white">FeedForward</div>
          <div className="text-xs text-white/50">Food Redistribution Platform</div>
        </div>
      </div>

      {/* RIGHT: Auth Form */}
      <div className="flex-1 lg:w-[45%] flex flex-col justify-center px-5 py-8 lg:px-12 lg:py-12 min-h-screen lg:min-h-0 bg-white">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-[420px] mx-auto">

          {/* Page heading */}
          <div className="mb-8">
            <h2 className="font-display text-3xl font-bold text-[#282C3F]">
              {tab === 'login' ? 'Welcome back 👋' : 'Join FeedForward'}
            </h2>
            <p className="text-[#686B78] mt-2 text-base">
              {tab === 'login' ? 'Sign in to continue your impact' : 'Create your account and start donating'}
            </p>
          </div>

          {/* Tab toggle */}
          <div className="flex bg-[#F4F4F4] rounded-xl p-1.5 mb-7">
            {['login', 'register'].map((t) => (
              <button key={t} onClick={() => { setTab(t); setError(''); }}
                className={`flex-1 py-3 rounded-lg font-semibold text-base capitalize transition-all duration-250 ${tab === t ? 'bg-white text-[#282C3F] shadow-md' : 'text-[#686B78] hover:text-[#282C3F]'}`}>
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {/* Role selector */}
          <div className="mb-7">
            <p className="input-label text-[#686B78] mb-3">I am a...</p>
            <div className="grid grid-cols-3 gap-3">
              {ROLES.map((r) => (
                <button key={r.value} onClick={() => setRole(r.value)}
                  className={`p-4 rounded-xl border-2 text-center transition-all duration-200 ${role === r.value ? 'border-[#FC8019] bg-[#FFF3E8]' : 'border-[#E8E8E8] bg-white hover:border-gray-300'}`}>
                  <div className="text-2xl mb-1.5">{r.emoji}</div>
                  <div className={`text-xs font-semibold leading-tight ${role === r.value ? 'text-[#FC8019]' : 'text-[#686B78]'}`}>{r.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <AnimatePresence mode="wait">
            <motion.form key={tab} initial={{ opacity: 0, x: tab === 'login' ? -12 : 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onSubmit={submit} className="space-y-4">
              {tab === 'register' && (
                <>
                  <div>
                    <label className="input-label">{role === 'admin' ? 'Organization Name' : 'Full Name'}</label>
                    <input name="name" value={form.name} onChange={handle} placeholder={role === 'admin' ? 'Feed the Needy NGO' : 'John Doe'} required className="input-field" />
                  </div>
                  <div>
                    <label className="input-label">Phone Number</label>
                    <input name="phone" value={form.phone} onChange={handle} placeholder="+91 9876543210" className="input-field" />
                  </div>
                </>
              )}
              <div>
                <label className="input-label">Email Address</label>
                <input name="email" type="email" value={form.email} onChange={handle} placeholder="you@example.com" required className="input-field" />
              </div>
              <div>
                <label className="input-label">Password</label>
                <input name="password" type="password" value={form.password} onChange={handle} placeholder="Min. 8 characters" required className="input-field" />
              </div>
              {tab === 'register' && (
                <div>
                  <label className="input-label">Confirm Password</label>
                  <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handle} placeholder="Repeat password" required className="input-field" />
                </div>
              )}

              {tab === 'login' && (
                <div className="text-right">
                  <button type="button" className="text-sm text-[#FC8019] font-semibold hover:underline">Forgot password?</button>
                </div>
              )}

              {error && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-base flex items-start gap-2">
                  <span className="mt-0.5">⚠️</span>
                  <span>{error}</span>
                </motion.div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full mt-2 text-lg disabled:opacity-60 disabled:cursor-not-allowed">
                {loading
                  ? <span className="flex items-center gap-2"><svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Please wait...</span>
                  : tab === 'login' ? '→  Sign In' : '→  Create Account'}
              </button>
            </motion.form>
          </AnimatePresence>

          <p className="text-center text-base text-[#686B78] mt-7">
            {tab === 'login' ? "Don't have an account?" : 'Already have an account?'}
            <button onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError(''); }} className="text-[#FC8019] font-semibold ml-1.5 hover:underline">
              {tab === 'login' ? 'Register' : 'Sign In'}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
