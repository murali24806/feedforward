import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { login, register, googleLogin, forgotPassword } from '../services/api';
import { signInWithGoogle } from '../firebase';

export default function LoginPage() {
  const [tab, setTab] = useState('login');
  const role = 'donor';
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, loginUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    if (!user.isProfileComplete && user.role !== 'superadmin') {
      navigate('/complete-profile');
    } else if (user.role === 'donor') navigate('/donor');
    else if (user.role === 'agent') navigate('/agent');
    else if (user.role === 'admin') navigate('/admin');
    else if (user.role === 'superadmin') navigate('/admin/superadmin');
  }, [user, navigate]);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (tab === 'forgot_password') {
        const res = await forgotPassword({ email: form.email });
        setSuccess(res.data.message);
        setLoading(false);
        return;
      }
      
      let loggedUser;
      if (tab === 'register') {
        if (form.password !== form.confirmPassword) { 
          setError('Passwords do not match'); 
          setLoading(false); 
          return; 
        }
        const res = await register({ name: form.name, email: form.email, phone: form.phone, password: form.password, role });
        loginUser(res.data.user, res.data.token);
        loggedUser = res.data.user;
      } else {
        const res = await login({ email: form.email, password: form.password, role });
        loginUser(res.data.user, res.data.token);
        loggedUser = res.data.user;
      }

      if (!loggedUser.isProfileComplete && loggedUser.role !== 'superadmin') {
        navigate('/complete-profile');
      } else {
        navigate('/donor');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      const result = await signInWithGoogle();
      const user = result.user;
      const idToken = await user.getIdToken();
      
      const res = await googleLogin({
        idToken,
        role: 'donor'
      });
      
      loginUser(res.data.user, res.data.token);
      if (!res.data.user.isProfileComplete) {
        navigate('/complete-profile');
      } else {
        navigate('/donor');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Google Sign-In failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F2F2F7] font-sans text-[#1C1C1E]">

      {/* LEFT: iOS Hero Panel — desktop only */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden bg-[#1C1C1E]">
        <video 
          autoPlay 
          muted 
          loop 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        >
          <source src="https://assets.mixkit.co/videos/preview/mixkit-volunteers-serving-food-to-people-in-need-4765-large.mp4" type="video/mp4" />
        </video>
        
        {/* Subtle Ambient Apple Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1C1C1E]/95 via-[#1C1C1E]/85 to-[#FF9500]/25 backdrop-blur-[2px]" />

        <div className="relative z-10 flex flex-col justify-between p-14 text-white w-full">
          {/* Logo top */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-[#FF9500] to-[#FC8019] flex items-center justify-center shadow-lg shadow-orange-500/25">
              <span className="text-2xl">🌱</span>
            </div>
            <div>
              <div className="font-display text-2xl font-bold tracking-tight text-white">FeedForward</div>
              <div className="text-xs text-white/50 tracking-wider uppercase font-medium">Smart Food Redistribution</div>
            </div>
          </div>

          {/* Hero content */}
          <motion.div 
            initial={{ opacity: 0, y: 24 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-xl border border-white/15 text-[#FF9500] text-xs font-semibold px-4 py-2 rounded-full mb-6">
              <span className="w-2 h-2 bg-[#FF9500] rounded-full animate-pulse" />
              Empowering Sustainable Communities
            </div>
            <h1 className="font-display text-5xl font-bold leading-tight mb-5 text-white tracking-tight">
              Every meal saved<br />
              <span className="bg-gradient-to-r from-[#FF9500] to-[#FFB340] bg-clip-text text-transparent">
                nourishes a future
              </span>
            </h1>
            <p className="text-white/70 text-base max-w-md leading-relaxed mb-10">
              A real-time logistics platform connecting surplus food donors, NGO administrators, and couriers to feed communities seamlessly.
            </p>

            {/* Apple Grouped Stat Cards */}
            <div className="grid grid-cols-3 gap-3.5 max-w-lg">
              {[
                ['10K+', 'Meals Saved', '🍱'],
                ['500+', 'Active Donors', '🤲'],
                ['50+', 'NGO Partners', '🏢']
              ].map(([num, label, emoji]) => (
                <div key={label} className="bg-white/[0.08] backdrop-blur-xl border border-white/10 p-4 rounded-[18px]">
                  <div className="text-xl mb-1">{emoji}</div>
                  <div className="text-2xl font-bold text-white tracking-tight">{num}</div>
                  <div className="text-white/50 text-xs mt-0.5 font-medium">{label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Mobile Top Header */}
      <div className="lg:hidden bg-[#1C1C1E] px-6 py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[13px] bg-gradient-to-br from-[#FF9500] to-[#FC8019] flex items-center justify-center shadow-md">
            <span className="text-xl">🌱</span>
          </div>
          <div>
            <div className="font-display text-lg font-bold text-white tracking-tight">FeedForward</div>
            <div className="text-[11px] text-white/50">Donor Portal</div>
          </div>
        </div>
        <Link 
          to="/admin/login"
          className="text-xs bg-white/10 hover:bg-white/15 text-[#FF9500] font-semibold px-3 py-1.5 rounded-full border border-white/10 transition-colors"
        >
          Staff 🛡️
        </Link>
      </div>

      {/* RIGHT: iOS Auth Form */}
      <div className="flex-1 lg:w-[48%] flex flex-col justify-center px-6 py-8 lg:px-14 lg:py-12 bg-[#F2F2F7]">
        <motion.div 
          initial={{ opacity: 0, y: 16 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.35 }} 
          className="w-full max-w-[420px] mx-auto bg-white/80 backdrop-blur-2xl border border-black/[0.06] rounded-[28px] p-7 lg:p-9 shadow-[0_12px_40px_rgba(0,0,0,0.06)]"
        >

          {/* Heading */}
          <div className="mb-7">
            <h2 className="font-display text-2xl lg:text-3xl font-bold tracking-tight text-[#1C1C1E]">
              {tab === 'login' ? 'Welcome back 👋' : tab === 'forgot_password' ? 'Reset Password 🔐' : 'Create Account 🌱'}
            </h2>
            <p className="text-[#636366] mt-1.5 text-sm">
              {tab === 'login' ? 'Sign in to manage and share food donations' : tab === 'forgot_password' ? 'Enter your registered email for temporary access' : 'Start donating surplus food in your neighborhood'}
            </p>
          </div>

          {/* Cupertino Segmented Control */}
          {tab !== 'forgot_password' && (
            <div className="ios-segmented mb-6">
              {['login', 'register'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTab(t); setError(''); setSuccess(''); }}
                  className={`ios-segment-btn ${tab === t ? 'active' : 'inactive'}`}
                >
                  {t === 'login' ? 'Sign In' : 'Register'}
                </button>
              ))}
            </div>
          )}

          {/* Google Sign In (iOS Pill Style) */}
          {tab !== 'forgot_password' && (
            <div className="mb-5">
              <button 
                type="button" 
                onClick={handleGoogleSignIn} 
                disabled={loading} 
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-black/[0.02] active:scale-[0.98] border border-black/10 rounded-[16px] py-3 text-sm font-semibold text-[#1C1C1E] transition-all shadow-[0_1px_3px_rgba(0,0,0,0.05)] disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative mt-5 mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-black/[0.08]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white/90 text-[#8E8E93] font-medium">or continue with email</span>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <AnimatePresence mode="wait">
            <motion.form 
              key={tab} 
              initial={{ opacity: 0, x: tab === 'login' ? -10 : 10 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0 }} 
              transition={{ duration: 0.2 }} 
              onSubmit={submit} 
              className="space-y-3.5"
            >
              {tab === 'register' && (
                <>
                  <div>
                    <label className="input-label">Full Name</label>
                    <input 
                      name="name" 
                      value={form.name} 
                      onChange={handle} 
                      placeholder="Jane Doe" 
                      required 
                      className="input-field" 
                    />
                  </div>
                  <div>
                    <label className="input-label">Phone Number</label>
                    <input 
                      name="phone" 
                      value={form.phone} 
                      onChange={handle} 
                      placeholder="+91 9876543210" 
                      className="input-field" 
                    />
                  </div>
                </>
              )}

              <div>
                <label className="input-label">Email Address</label>
                <input 
                  name="email" 
                  type="email" 
                  value={form.email} 
                  onChange={handle} 
                  placeholder="donor@feedforward.com" 
                  required 
                  className="input-field" 
                />
              </div>
              
              {tab !== 'forgot_password' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="input-label !mb-0">Password</label>
                    {tab === 'login' && (
                      <button 
                        type="button" 
                        onClick={() => { setTab('forgot_password'); setError(''); setSuccess(''); }} 
                        className="text-xs text-[#FF9500] font-semibold hover:underline"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <input 
                    name="password" 
                    type="password" 
                    value={form.password} 
                    onChange={handle} 
                    placeholder="••••••••••••" 
                    required 
                    className="input-field" 
                  />
                </div>
              )}

              {tab === 'register' && (
                <div>
                  <label className="input-label">Confirm Password</label>
                  <input 
                    name="confirmPassword" 
                    type="password" 
                    value={form.confirmPassword} 
                    onChange={handle} 
                    placeholder="Repeat password" 
                    required 
                    className="input-field" 
                  />
                </div>
              )}

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -4 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/20 text-[#FF3B30] px-3.5 py-2.5 rounded-[14px] text-xs font-medium flex items-center gap-2"
                >
                  <span>⚠️</span>
                  <span>{error}</span>
                </motion.div>
              )}

              {success && (
                <motion.div 
                  initial={{ opacity: 0, y: -4 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-emerald-500/10 border border-emerald-500/20 text-[#34C759] px-3.5 py-2.5 rounded-[14px] text-xs font-medium flex items-center gap-2"
                >
                  <span>✅</span>
                  <span>{success}</span>
                </motion.div>
              )}

              <button 
                type="submit" 
                disabled={loading} 
                className="btn-primary w-full mt-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_16px_rgba(255,149,0,0.35)]"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    <span>Please wait...</span>
                  </span>
                ) : (
                  <span>
                    {tab === 'login' ? 'Sign In' : tab === 'forgot_password' ? 'Send Reset Link' : 'Create Account'} →
                  </span>
                )}
              </button>
            </motion.form>
          </AnimatePresence>

          {/* Toggle between register & login */}
          <div className="mt-5 text-center">
            {tab === 'forgot_password' ? (
              <button 
                type="button" 
                onClick={() => { setTab('login'); setError(''); setSuccess(''); }} 
                className="text-xs text-[#FF9500] font-semibold hover:underline"
              >
                ← Back to Sign In
              </button>
            ) : (
              <p className="text-xs text-[#636366]">
                {tab === 'login' ? "Don't have an account?" : 'Already registered?'}
                <button 
                  type="button"
                  onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError(''); setSuccess(''); }} 
                  className="text-[#FF9500] font-semibold ml-1.5 hover:underline"
                >
                  {tab === 'login' ? 'Register now' : 'Sign In'}
                </button>
              </p>
            )}
          </div>

          {/* iOS Inset Card for Staff Portal Access */}
          <div className="mt-6 pt-5 border-t border-black/[0.08] text-center">
            <Link
              to="/admin/login"
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#636366] hover:text-[#1C1C1E] transition-colors py-2.5 px-4 rounded-full bg-black/[0.04] hover:bg-black/[0.07] border border-black/[0.05]"
            >
              <span>🛡️</span>
              <span>Staff, Courier & Admin Portal</span>
              <span>→</span>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
