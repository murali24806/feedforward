import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { login } from '../services/api';

const ADMIN_ROLES = [
  { value: 'admin', label: 'NGO Admin', emoji: '🏢', desc: 'Donations & live tracking' },
  { value: 'agent', label: 'Delivery Agent', emoji: '🚴', desc: 'Pick up & live route dispatch' },
  { value: 'superadmin', label: 'Super Admin', emoji: '👑', desc: 'Platform & fleet governance' },
];

const DEMO_CREDENTIALS = {
  admin: { email: 'admin@feedforward.com', password: 'admin123' },
  agent: { email: 'agent@feedforward.com', password: 'agent123' },
  superadmin: { email: 'superadmin@feedforward.com', password: 'superadmin123' },
};

export default function AdminLoginPage() {
  const [role, setRole] = useState('admin');
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, loginUser } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (!user) return;
    if (!user.isProfileComplete && user.role !== 'superadmin') {
      navigate('/complete-profile');
    } else if (user.role === 'admin') navigate('/admin');
    else if (user.role === 'superadmin') navigate('/admin/superadmin');
    else if (user.role === 'agent') navigate('/agent');
    else if (user.role === 'donor') navigate('/donor');
  }, [user, navigate]);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const fillDemo = (selectedRole) => {
    const r = selectedRole || role;
    const cred = DEMO_CREDENTIALS[r];
    if (cred) {
      setRole(r);
      setForm({ email: cred.email, password: cred.password });
      setError('');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login({ email: form.email, password: form.password, role });
      loginUser(res.data.user, res.data.token);

      if (!res.data.user.isProfileComplete && res.data.user.role !== 'superadmin') {
        navigate('/complete-profile');
      } else if (role === 'superadmin') {
        navigate('/admin/superadmin');
      } else if (role === 'agent') {
        navigate('/agent');
      } else {
        navigate('/admin');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#0C0D10] text-white px-4 py-12 relative overflow-hidden font-sans">
      {/* iOS Pro Specular Ambient Glows */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-[#FF9500]/12 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-[#007AFF]/12 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-lg z-10"
      >
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-[18px] bg-gradient-to-br from-[#FF9500] to-[#E07D00] shadow-xl shadow-orange-500/25 mb-4">
            <span className="text-3xl">🛡️</span>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">
            Staff & Admin Portal
          </h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="w-2 h-2 rounded-full bg-[#34C759] animate-pulse" />
            <span className="text-xs uppercase tracking-widest text-white/50 font-semibold">
              Authorized Personnel • Secure SSL
            </span>
          </div>
        </div>

        {/* Card (Apple Dark Titanium Glass) */}
        <div className="bg-[#1C1C1E]/85 backdrop-blur-2xl border border-white/10 rounded-[28px] p-7 lg:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {/* Role selector */}
          <div className="mb-6">
            <label className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2.5">
              Select Authorized Role
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {ADMIN_ROLES.map((r) => {
                const isSelected = role === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => {
                      setRole(r.value);
                      setError('');
                    }}
                    className={`p-3.5 rounded-[18px] border text-left transition-all duration-150 active:scale-[0.98] ${
                      isSelected
                        ? 'border-[#FF9500] bg-[#FF9500]/15 shadow-sm shadow-orange-500/10'
                        : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
                    }`}
                  >
                    <div className="text-xl mb-1">{r.emoji}</div>
                    <div className={`text-sm font-bold tracking-tight ${isSelected ? 'text-[#FF9500]' : 'text-white'}`}>
                      {r.label}
                    </div>
                    <div className="text-[11px] text-white/50 leading-tight mt-0.5 line-clamp-2">
                      {r.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Demo Autofill Bar */}
          <div className="mb-6 flex items-center justify-between bg-white/[0.06] border border-white/10 rounded-[16px] px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-2 text-white/80 truncate">
              <span>⚡</span>
              <span className="truncate">Demo: <b>{DEMO_CREDENTIALS[role]?.email}</b></span>
            </div>
            <button
              type="button"
              onClick={() => fillDemo(role)}
              className="text-xs bg-[#FF9500] hover:bg-[#E07D00] text-white font-medium px-3 py-1 rounded-[10px] transition-all shadow-sm active:scale-95 whitespace-nowrap ml-2"
            >
              Autofill
            </button>
          </div>

          {/* Login Form */}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5">
                {role === 'agent' ? 'Delivery Agent Email' : 'Authorized Email Address'}
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handle}
                required
                placeholder={role === 'agent' ? 'agent@feedforward.com' : role === 'superadmin' ? 'superadmin@feedforward.com' : 'admin@feedforward.com'}
                className="w-full px-4 py-3.5 bg-[#0E0F12] border border-white/15 rounded-[16px] text-white placeholder-white/30 focus:outline-none focus:border-[#FF9500] focus:ring-4 focus:ring-[#FF9500]/15 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5">
                Security Password
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handle}
                required
                placeholder="••••••••••••"
                className="w-full px-4 py-3.5 bg-[#0E0F12] border border-white/15 rounded-[16px] text-white placeholder-white/30 focus:outline-none focus:border-[#FF9500] focus:ring-4 focus:ring-[#FF9500]/15 transition-all text-sm"
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-500/15 border border-red-500/30 text-[#FF453A] rounded-[14px] text-xs flex items-center gap-2"
              >
                <span>⚠️</span>
                <span>{error}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#FF9500] to-[#E07D00] hover:opacity-95 text-white font-bold py-3.5 px-4 rounded-[18px] shadow-lg shadow-orange-500/25 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>
                    Authenticate & Enter {role === 'superadmin' ? 'Super Admin' : role === 'agent' ? 'Agent Delivery' : 'NGO Admin'} Console
                  </span>
                  <span>→</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Security Notice */}
          <div className="mt-6 pt-5 border-t border-white/10 text-center">
            <p className="text-[11px] text-white/40">
              Access to this console is logged and restricted to authorized personnel.
            </p>
          </div>
        </div>

        {/* Back Link to Public Donor Login */}
        <div className="text-center mt-6">
          <Link
            to="/login"
            className="text-xs text-white/50 hover:text-white transition-colors inline-flex items-center gap-1.5"
          >
            <span>←</span>
            <span>Return to Public Donor Portal</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
