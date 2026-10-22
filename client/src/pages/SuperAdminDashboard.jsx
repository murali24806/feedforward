import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  getSuperAdminStats,
  getSuperAdminUsers,
  updateSuperAdminUser,
  deleteUser,
  getSuperAdminFoodPosts,
  updateSuperAdminFoodStatus,
  deleteSuperAdminFoodPost,
  getSuperAdminDeliveries,
  getSuperAdminActivityLogs,
  getAllCitizenRequests,
  updateCitizenRequestStatus,
  deleteCitizenRequest
} from '../services/api';
import { getSocket } from '../services/socket';
import DashboardLayout from '../components/DashboardLayout';

const STATUS_BADGES = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  accepted: 'bg-blue-100 text-blue-800 border-blue-200',
  agent_assigned: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  in_transit: 'bg-orange-100 text-orange-800 border-orange-200',
  picked_up: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-800 border-rose-200',
};

const STATUS_LABELS = {
  pending: '⏳ Pending',
  accepted: '✅ Accepted',
  agent_assigned: '🚴 Assigned',
  in_transit: '🚚 In Transit',
  picked_up: '📦 Picked Up',
  delivered: '🎉 Delivered',
  rejected: '❌ Rejected',
};

export default function SuperAdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = searchParams.get('tab') || 'overview';

  // Data States
  const [stats, setStats] = useState(null);
  const [foodPosts, setFoodPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [citizenRequests, setCitizenRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search States
  const [foodFilter, setFoodFilter] = useState('all');
  const [foodSearch, setFoodSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');

  // Modals
  const [selectedFood, setSelectedFood] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [statusOverridePost, setStatusOverridePost] = useState(null);
  const [newStatusValue, setNewStatusValue] = useState('delivered');

  // Real-Time Notification Banner
  const [liveBanner, setLiveBanner] = useState(null);

  const setTab = (tab) => {
    setSearchParams({ tab });
  };

  // Initial Data Fetch
  const loadAllData = async () => {
    try {
      setLoading(true);
      const [statsRes, foodRes, usersRes, deliveriesRes, logsRes, citizenRes] = await Promise.all([
        getSuperAdminStats(),
        getSuperAdminFoodPosts(),
        getSuperAdminUsers(),
        getSuperAdminDeliveries(),
        getSuperAdminActivityLogs(),
        getAllCitizenRequests().catch(() => ({ data: [] }))
      ]);
      setStats(statsRes.data);
      setFoodPosts(foodRes.data);
      setUsers(usersRes.data);
      setDeliveries(deliveriesRes.data);
      setActivityLogs(logsRes.data);
      setCitizenRequests(citizenRes?.data || []);
    } catch (err) {
      console.error('SuperAdmin load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();

    // Socket.IO Real-Time Room Subscription
    const socket = getSocket();
    socket.emit('joinSuperAdminRoom');

    const handleNewPost = (data) => {
      if (data?.post) {
        setFoodPosts(prev => [data.post, ...prev]);
        setStats(s => s ? ({
          ...s,
          foodPosts: { ...s.foodPosts, total: s.foodPosts.total + 1, pending: s.foodPosts.pending + 1 }
        }) : s);
        setLiveBanner(`🍱 Alert: ${data.donorName} posted "${data.post.foodName}" (${data.isBroadcast ? 'Open to All NGOs' : 'Direct NGO'})`);
        setActivityLogs(logs => [
          {
            type: 'food_posted',
            title: `New Donation: ${data.post.foodName}`,
            description: `Posted by ${data.donorName} · ${data.isBroadcast ? 'Open Broadcast' : 'Direct NGO'}`,
            time: new Date(),
            badge: 'pending'
          },
          ...logs.slice(0, 25)
        ]);
        setTimeout(() => setLiveBanner(null), 7000);
      }
    };

    const handleClaimed = (data) => {
      if (data?.postId) {
        setFoodPosts(prev => prev.map(p => {
          if (p._id === data.postId) {
            return {
              ...p,
              status: data.status,
              claimedByAdmin: data.claimedByAdmin,
              adminId: data.claimedByAdmin
            };
          }
          return p;
        }));
        setLiveBanner(`🏢 Claimed: ${data.claimedByAdmin?.organizationName || data.claimedByAdmin?.name || 'An NGO'} accepted donation "${data.post?.foodName || 'Food Item'}"`);
        setActivityLogs(logs => [
          {
            type: 'food_claimed',
            title: `Donation Claimed: ${data.post?.foodName || 'Donation'}`,
            description: `Accepted by ${data.claimedByAdmin?.organizationName || data.claimedByAdmin?.name}`,
            time: new Date(),
            badge: data.status || 'agent_assigned'
          },
          ...logs.slice(0, 25)
        ]);
        setTimeout(() => setLiveBanner(null), 7000);
      }
    };

    const handleStatusChanged = (data) => {
      if (data?.postId) {
        setFoodPosts(prev => prev.map(p => p._id === data.postId ? { ...p, status: data.status } : p));
      }
    };

    const handleActivity = (activity) => {
      if (activity) {
        setActivityLogs(logs => [activity, ...logs.slice(0, 25)]);
      }
    };

    socket.on('food:newPost', handleNewPost);
    socket.on('food:claimed', handleClaimed);
    socket.on('food:statusChanged', handleStatusChanged);
    socket.on('superadmin:activity', handleActivity);
    socket.on('citizen:newRequest', (newReq) => {
      setCitizenRequests(prev => [newReq, ...prev]);
      setLiveBanner(`🍽️ Citizen Request: ${newReq.name} requested ${newReq.mealsNeeded} meal(s) (PIN: ${newReq.pin})`);
    });
    socket.on('citizen:requestUpdated', (upd) => {
      setCitizenRequests(prev => prev.map(r => r._id === upd._id ? upd : r));
    });

    return () => {
      socket.off('food:newPost', handleNewPost);
      socket.off('food:claimed', handleClaimed);
      socket.off('food:statusChanged', handleStatusChanged);
      socket.off('superadmin:activity', handleActivity);
      socket.off('citizen:newRequest');
      socket.off('citizen:requestUpdated');
    };
  }, []);

  // Citizen Request Handlers
  const handleUpdateCitizenStatus = async (id, status) => {
    try {
      const res = await updateCitizenRequestStatus(id, { status });
      if (res.data?.request) {
        setCitizenRequests(prev => prev.map(r => r._id === id ? res.data.request : r));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update citizen request status');
    }
  };

  const handleDeleteCitizenReq = async (id) => {
    if (!window.confirm('Are you sure you want to delete this citizen food request?')) return;
    try {
      await deleteCitizenRequest(id);
      setCitizenRequests(prev => prev.filter(r => r._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete request');
    }
  };

  // Handlers
  const handleDeleteUser = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${name}"?`)) return;
    try {
      await deleteUser(id);
      setUsers(u => u.filter(user => user._id !== id));
      setStats(s => s ? ({ ...s, users: { ...s.users, total: s.users.total - 1 } }) : s);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleSaveUserEdit = async (e) => {
    e.preventDefault();
    try {
      const res = await updateSuperAdminUser(editingUser._id, editingUser);
      setUsers(u => u.map(user => user._id === editingUser._id ? res.data : user));
      setEditingUser(null);
      alert('User details updated successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update user');
    }
  };

  const handleDeleteFood = async (id, foodName) => {
    if (!window.confirm(`Are you sure you want to permanently delete food donation "${foodName}"?`)) return;
    try {
      await deleteSuperAdminFoodPost(id);
      setFoodPosts(f => f.filter(post => post._id !== id));
      alert('Food post removed.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete food post');
    }
  };

  const handleApplyStatusOverride = async () => {
    if (!statusOverridePost) return;
    try {
      const res = await updateSuperAdminFoodStatus(statusOverridePost._id, { status: newStatusValue });
      setFoodPosts(posts => posts.map(p => p._id === statusOverridePost._id ? res.data : p));
      setStatusOverridePost(null);
      alert(`Status updated to ${newStatusValue}!`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  // Filtered Food Posts
  const filteredFood = useMemo(() => {
    return foodPosts.filter(p => {
      const matchesFilter =
        foodFilter === 'all' ? true :
        foodFilter === 'broadcast' ? p.isBroadcast :
        foodFilter === 'direct' ? !p.isBroadcast :
        p.status === foodFilter;

      const matchesSearch = foodSearch.trim() === '' ||
        p.foodName?.toLowerCase().includes(foodSearch.toLowerCase()) ||
        p.donorId?.name?.toLowerCase().includes(foodSearch.toLowerCase()) ||
        p.claimedByAdmin?.organizationName?.toLowerCase().includes(foodSearch.toLowerCase()) ||
        p.adminId?.organizationName?.toLowerCase().includes(foodSearch.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [foodPosts, foodFilter, foodSearch]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
      const matchesSearch = userSearch.trim() === '' ||
        u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.phone?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.organizationName?.toLowerCase().includes(userSearch.toLowerCase());

      return matchesRole && matchesSearch;
    });
  }, [users, userRoleFilter, userSearch]);

  if (loading) {
    return (
      <DashboardLayout title="SuperAdmin Command Center">
        <div className="p-16 text-center">
          <div className="w-16 h-16 border-4 border-[#5856D6] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl font-bold text-gray-800">Booting SuperAdmin Command Center...</p>
          <p className="text-sm text-gray-500 mt-1">Connecting to live platform fleet and databases</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="SuperAdmin Command Center">
      {/* ── Live Alert Toast Banner ── */}
      <AnimatePresence>
        {liveBanner && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            className="mb-6 bg-gradient-to-r from-[#5856D6] via-purple-600 to-[#FC8019] text-white p-4 rounded-2xl shadow-xl flex items-center justify-between gap-4 border border-white/20"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-pulse">👑</span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Real-Time Platform Event</div>
                <div className="text-sm font-bold">{liveBanner}</div>
              </div>
            </div>
            <button
              onClick={() => setLiveBanner(null)}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Executive Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">👑</span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#282C3F]">Platform Governance & Radar</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Boss Access
            </span>
          </div>
          <p className="text-gray-500 text-sm">
            Complete executive oversight over all NGOs, Donors, Volunteer Delivery Fleet, and Food Redistribution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadAllData()}
            className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-semibold text-sm shadow-sm transition-all"
            title="Refresh All Real-Time Data"
          >
            🔄 Refresh Radar
          </button>
          <button
            onClick={() => navigate('/admin/superadmin/create')}
            className="px-5 py-2.5 bg-[#5856D6] hover:bg-[#4845B4] text-white font-semibold text-sm rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <span>+</span> Create NGO / Agent
          </button>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-8 border-b border-gray-200">
        {[
          { key: 'overview', label: '📊 Overview & Radar', count: null },
          { key: 'food', label: '🍱 All Food Donations', count: foodPosts.length },
          { key: 'citizens', label: '🍽️ Citizen Requests', count: citizenRequests.length },
          { key: 'users', label: '👥 User Governance', count: users.length },
          { key: 'deliveries', label: '🚴 Fleet Deliveries', count: deliveries.length },
          { key: 'audit', label: '⚡ Live Audit Stream', count: activityLogs.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.key
                ? 'bg-[#282C3F] text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-100'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          TAB 1: OVERVIEW & RADAR
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-8">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Total Platform Users',
                value: stats.users.total,
                sub: `${stats.users.donors} Donors · ${stats.users.admins} NGOs · ${stats.users.agents} Agents`,
                icon: '👥',
                bg: 'bg-blue-50 text-blue-700 border-blue-100'
              },
              {
                label: 'Food Donations',
                value: stats.foodPosts.total,
                sub: `${stats.foodPosts.pending} Pending · ${stats.foodPosts.broadcast} Broadcasted`,
                icon: '🍱',
                bg: 'bg-emerald-50 text-emerald-700 border-emerald-100'
              },
              {
                label: 'Active Deliveries',
                value: stats.deliveries.active,
                sub: `${stats.deliveries.completed} Completed successfully`,
                icon: '🚴',
                bg: 'bg-orange-50 text-orange-700 border-orange-100'
              },
              {
                label: 'Broadcast Donations',
                value: stats.foodPosts.broadcast,
                sub: 'Open pool accessible to all NGOs',
                icon: '📢',
                bg: 'bg-purple-50 text-purple-700 border-purple-100'
              },
            ].map(card => (
              <div key={card.label} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{card.label}</span>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg border ${card.bg}`}>
                    {card.icon}
                  </div>
                </div>
                <div className="text-3xl font-black text-gray-900">{card.value}</div>
                <div className="text-xs text-gray-500 mt-1 font-medium">{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Graphical Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Demographics */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-1">User Ecosystem Distribution</h3>
              <p className="text-xs text-gray-500 mb-4">Breakdown of active platform stakeholders</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Donors', value: stats.users.donors, color: '#34C759' },
                        { name: 'NGO Admins', value: stats.users.admins, color: '#FC8019' },
                        { name: 'Delivery Agents', value: stats.users.agents, color: '#007AFF' }
                      ]}
                      cx="50%" cy="50%"
                      innerRadius={65} outerRadius={85}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {[
                        { color: '#34C759' },
                        { color: '#FC8019' },
                        { color: '#007AFF' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Platform Operations */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Redistribution Operations Pipeline</h3>
              <p className="text-xs text-gray-500 mb-4">Real-time status of food postings & deliveries</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Total Donations', count: stats.foodPosts.total },
                      { name: 'Broadcast Pool', count: stats.foodPosts.broadcast },
                      { name: 'Pending Claim', count: stats.foodPosts.pending },
                      { name: 'Active In Transit', count: stats.deliveries.active },
                      { name: 'Delivered', count: stats.deliveries.completed }
                    ]}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#686B78', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#686B78', fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {[
                        { color: '#5856D6' },
                        { color: '#A855F7' },
                        { color: '#F59E0B' },
                        { color: '#FC8019' },
                        { color: '#10B981' }
                      ].map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Live Activity Stream Preview */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Live Activity Feed</h3>
                <p className="text-xs text-gray-500">Real-time platform logs & notifications</p>
              </div>
              <button
                onClick={() => setTab('audit')}
                className="text-xs font-bold text-[#5856D6] hover:underline"
              >
                View Full Audit Log →
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              {activityLogs.slice(0, 6).map((log, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-sm">
                      {log.type === 'food_posted' ? '🍱' : log.type === 'food_claimed' ? '🏢' : log.type === 'delivery_event' ? '🚴' : '👤'}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{log.title}</div>
                      <div className="text-xs text-gray-500">{log.description || log.message}</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[11px] font-mono text-gray-400 block">
                      {new Date(log.time).toLocaleTimeString()}
                    </span>
                    {log.badge && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGES[log.badge] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[log.badge] || log.badge}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 2: ALL FOOD DONATIONS (FULL ACCESS & OVERRIDE)
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'food' && (
        <div className="space-y-6">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {[
                { key: 'all', label: 'All Donations' },
                { key: 'broadcast', label: '📢 Broadcast Only' },
                { key: 'direct', label: '🏢 Direct Only' },
                { key: 'pending', label: '⏳ Pending' },
                { key: 'agent_assigned', label: '🚴 Assigned' },
                { key: 'delivered', label: '🎉 Delivered' },
                { key: 'rejected', label: '❌ Rejected' }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFoodFilter(f.key)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    foodFilter === f.key
                      ? 'bg-[#5856D6] text-white shadow-sm'
                      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <input
                type="text"
                placeholder="Search food, donor, NGO..."
                value={foodSearch}
                onChange={e => setFoodSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#5856D6]"
              />
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
            </div>
          </div>

          {/* Food Posts List */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50/80 text-gray-400 border-b border-gray-100 uppercase tracking-wider text-xs font-semibold">
                    <th className="py-3.5 px-4">Food Item</th>
                    <th className="py-3.5 px-4">Donor</th>
                    <th className="py-3.5 px-4">Target / Claimed NGO</th>
                    <th className="py-3.5 px-4">Assigned Agent</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Posted At</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredFood.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-gray-400">
                        <div className="text-4xl mb-2">🍱</div>
                        No food donation records found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredFood.map(post => {
                      const isBroadcast = post.isBroadcast;
                      const claimedOrg = post.claimedByAdmin?.organizationName || post.claimedByAdmin?.name || post.adminId?.organizationName || post.adminId?.name;

                      return (
                        <tr key={post._id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                {post.photo ? (
                                  <img src={post.photo} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xl">🍱</span>
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-gray-900">{post.foodName}</div>
                                <div className="text-xs text-gray-500 font-medium">
                                  {post.quantity} · {post.type === 'veg' ? '🥦 Veg' : '🍗 Non-veg'}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-semibold text-gray-900">{post.donorId?.name || 'Unknown Donor'}</div>
                            <div className="text-xs text-gray-500">{post.donorId?.phone || post.donorId?.email || 'N/A'}</div>
                          </td>

                          <td className="py-4 px-4">
                            {isBroadcast ? (
                              <div>
                                <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 mb-1">
                                  📢 Open Broadcast
                                </span>
                                {post.status !== 'pending' ? (
                                  <div className="text-xs font-semibold text-gray-800">
                                    Claimed by: <span className="text-emerald-700">{claimedOrg || 'NGO Partner'}</span>
                                  </div>
                                ) : (
                                  <div className="text-xs text-amber-600 font-medium">Waiting for any NGO to claim</div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 mb-1">
                                  🏢 Direct NGO
                                </span>
                                <div className="text-xs font-semibold text-gray-800">{claimedOrg || 'Assigned NGO'}</div>
                              </div>
                            )}
                          </td>

                          <td className="py-4 px-4">
                            {post.agentId ? (
                              <div>
                                <div className="font-semibold text-gray-900">{post.agentId.name}</div>
                                <div className="text-xs text-gray-500">{post.agentId.vehicleType || 'Agent'} · {post.agentId.phone}</div>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">No agent assigned yet</span>
                            )}
                          </td>

                          <td className="py-4 px-4">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_BADGES[post.status] || 'bg-gray-100 text-gray-700'}`}>
                              {STATUS_LABELS[post.status] || post.status}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-xs text-gray-500">
                            {new Date(post.createdAt).toLocaleDateString()}
                            <span className="block text-[10px] text-gray-400">{new Date(post.createdAt).toLocaleTimeString()}</span>
                          </td>

                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedFood(post)}
                                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-lg transition-colors"
                              >
                                View
                              </button>
                              <button
                                onClick={() => {
                                  setStatusOverridePost(post);
                                  setNewStatusValue(post.status);
                                }}
                                className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-xs rounded-lg transition-colors"
                              >
                                Status
                              </button>
                              <button
                                onClick={() => handleDeleteFood(post._id, post.foodName)}
                                className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs rounded-lg transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 3: USER & FLEET GOVERNANCE
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2">
              {[
                { key: 'all', label: 'All Users' },
                { key: 'donor', label: '🤲 Donors' },
                { key: 'admin', label: '🏢 NGO Admins' },
                { key: 'agent', label: '🚴 Delivery Agents' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setUserRoleFilter(f.key)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    userRoleFilter === f.key
                      ? 'bg-[#5856D6] text-white shadow-sm'
                      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <input
                type="text"
                placeholder="Search by name, email, phone..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#5856D6]"
              />
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50/80 text-gray-400 border-b border-gray-100 uppercase tracking-wider text-xs font-semibold">
                    <th className="py-3.5 px-4">User</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Role-Specific Data</th>
                    <th className="py-3.5 px-4">Phone / Contact</th>
                    <th className="py-3.5 px-4">Joined Date</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map(u => (
                    <tr key={u._id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center font-bold text-gray-700 flex-shrink-0">
                            {u.profilePhoto ? (
                              <img src={u.profilePhoto} alt="" className="w-full h-full object-cover" />
                            ) : (
                              u.name?.[0]?.toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900">{u.name}</div>
                            <div className="text-xs text-gray-500">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          u.role === 'agent' ? 'bg-orange-100 text-orange-700' :
                          u.role === 'superadmin' ? 'bg-gray-900 text-white' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {u.role === 'admin' ? '🏢 NGO Admin' :
                           u.role === 'agent' ? '🚴 Delivery Agent' :
                           u.role === 'superadmin' ? '👑 Super Admin' : '🤲 Donor'}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        {u.role === 'admin' && (
                          <div className="text-xs font-semibold text-gray-800">
                            Org: <span className="text-[#FC8019]">{u.organizationName || 'Not Set'}</span>
                          </div>
                        )}
                        {u.role === 'agent' && (
                          <div className="text-xs">
                            <span className="font-semibold text-gray-800">{u.vehicleType || 'Vehicle N/A'}</span>
                            <span className="block mt-0.5 text-[11px] font-bold text-gray-500">
                              {u.isAvailable ? '🟢 Active & Ready' : '🔴 On Delivery / Offline'}
                            </span>
                          </div>
                        )}
                        {u.role === 'donor' && (
                          <div className="text-xs font-semibold text-gray-800">
                            Reward Points: <span className="text-emerald-600 font-bold">{u.points || 0} pts</span>
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 text-xs text-gray-600">
                        <div>{u.phone || 'No phone'}</div>
                        <div className="text-gray-400 truncate max-w-[160px]">{u.address || 'No address'}</div>
                      </td>

                      <td className="py-4 px-4 text-xs text-gray-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedUser(u)}
                            className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-lg transition-colors"
                          >
                            Profile
                          </button>
                          <button
                            onClick={() => setEditingUser({ ...u })}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-lg transition-colors"
                          >
                            Edit
                          </button>
                          {u.role !== 'superadmin' && (
                            <button
                              onClick={() => handleDeleteUser(u._id, u.name)}
                              className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs rounded-lg transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 4: FLEET DELIVERIES & RADAR
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'deliveries' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Citywide Delivery Fleet Radar</h3>
                <p className="text-xs text-gray-500">Live overview of dispatch, transit, and completions</p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                {deliveries.filter(d => ['assigned', 'in_transit', 'picked_up'].includes(d.status)).length} Orders Active
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[850px]">
                <thead>
                  <tr className="bg-gray-50/80 text-gray-400 border-b border-gray-100 uppercase tracking-wider text-xs font-semibold">
                    <th className="py-3.5 px-4">Food Item</th>
                    <th className="py-3.5 px-4">Donor Pickup</th>
                    <th className="py-3.5 px-4">NGO Drop-off</th>
                    <th className="py-3.5 px-4">Delivery Agent</th>
                    <th className="py-3.5 px-4">Current Status</th>
                    <th className="py-3.5 px-4">Created Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {deliveries.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-gray-400">
                        No delivery assignments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    deliveries.map(del => (
                      <tr key={del._id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-4 px-4 font-bold text-gray-900">
                          {del.foodPostId?.foodName || 'Donation Item'}
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-semibold text-gray-900">{del.donorId?.name || 'Donor'}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[150px]">{del.donorId?.address || 'Pickup point recorded'}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-semibold text-gray-900">
                            {del.adminId?.organizationName || del.adminId?.name || 'Partner NGO'}
                          </div>
                          <div className="text-xs text-gray-500">{del.adminId?.phone || 'NGO contact'}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-semibold text-gray-900">{del.agentId?.name || 'Assigned Agent'}</div>
                          <div className="text-xs text-gray-500">{del.agentId?.vehicleType || 'Vehicle'} · {del.agentId?.phone}</div>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_BADGES[del.status] || 'bg-gray-100 text-gray-700'}`}>
                            {STATUS_LABELS[del.status] || del.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-xs text-gray-500">
                          {new Date(del.createdAt).toLocaleDateString()} {new Date(del.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: CITIZEN FOOD ASSISTANCE REQUESTS
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'citizens' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🍽️</span>
                <h3 className="text-xl font-bold text-gray-900">Direct Citizen & Needy Food Requests</h3>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Requests submitted by everyday citizens, students, and families in need without requiring login.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold">
                {citizenRequests.filter(r => r.status === 'pending').length} Pending
              </span>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-xl text-xs font-bold">
                {citizenRequests.filter(r => r.status === 'approved').length} Approved
              </span>
              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold">
                {citizenRequests.length} Total
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {citizenRequests.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <span className="text-4xl block mb-2">🍽️</span>
                <p className="font-semibold text-gray-600">No citizen food requests logged yet.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Public requests submitted from the home page will appear here instantly via WebSockets with live GPS coordinates.
                </p>
              </div>
            ) : (
              <div>
                {/* ── DESKTOP TABLE VIEW (hidden on mobile, visible on md+) ── */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        <th className="py-4 px-4">Requester</th>
                        <th className="py-4 px-4">Meals & Type</th>
                        <th className="py-4 px-4">Live Doorstep GPS</th>
                        <th className="py-4 px-4">Pickup PIN</th>
                        <th className="py-4 px-4">Status</th>
                        <th className="py-4 px-4">Submitted</th>
                        <th className="py-4 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {citizenRequests.map((req) => (
                        <tr key={req._id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="py-4 px-4">
                            <div className="font-bold text-gray-900">{req.name}</div>
                            <a
                              href={`tel:${req.phone}`}
                              className="text-xs text-emerald-600 hover:underline flex items-center gap-1 mt-0.5"
                            >
                              📞 {req.phone}
                            </a>
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-semibold text-gray-800">
                              {req.mealsNeeded} Meal(s)
                            </div>
                            <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-bold mt-1 ${
                              req.dietaryType === 'veg' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {req.dietaryType === 'veg' ? '🌱 Veg Only' : '🍖 Any Food'}
                            </span>
                            <span className="block text-[11px] text-gray-400 mt-0.5">
                              {req.needType}
                            </span>
                          </td>

                          <td className="py-4 px-4 max-w-xs">
                            <div className="text-xs text-gray-800 font-medium truncate" title={req.location?.address}>
                              📍 {req.location?.address || 'Location provided'}
                            </div>
                            {req.location?.city && (
                              <span className="text-[11px] text-gray-500">
                                City: {req.location.city}
                              </span>
                            )}
                            {/* Live Doorstep Navigation Button */}
                            {req.location?.lat && req.location?.lng ? (
                              <div className="mt-1 flex items-center gap-2">
                                <a
                                  href={req.location.navigationUrl || `https://www.google.com/maps/dir/?api=1&destination=${req.location.lat},${req.location.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-all border border-blue-200 shadow-xs"
                                  title="Open Voice Turn-by-Turn GPS Navigation"
                                >
                                  <span>🚗 Live Navigation</span>
                                  <span className="text-[10px]">↗</span>
                                </a>
                                {req.location.accuracy && (
                                  <span className="text-[10px] text-emerald-600 font-medium">
                                    ±{req.location.accuracy}m
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-400 block mt-0.5">Approximate street</span>
                            )}
                          </td>

                          <td className="py-4 px-4">
                            <span className="font-mono font-bold text-sm bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-200">
                              {req.pin}
                            </span>
                          </td>

                          <td className="py-4 px-4">
                            <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                              req.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : req.status === 'fulfilled'
                                ? 'bg-blue-100 text-blue-800'
                                : req.status === 'rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              ● {req.status}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-xs text-gray-400">
                            {new Date(req.createdAt).toLocaleDateString()}
                            <div className="text-[10px]">
                              {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>

                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {req.status === 'pending' && (
                                <button
                                  onClick={() => handleUpdateCitizenStatus(req._id, 'approved')}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                                  title="Approve Request & Allow Pickup with PIN"
                                >
                                  ✅ Approve
                                </button>
                              )}
                              {req.status === 'approved' && (
                                <button
                                  onClick={() => handleUpdateCitizenStatus(req._id, 'fulfilled')}
                                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                                  title="Mark Food as Picked Up / Delivered"
                                >
                                  🎉 Mark Fulfilled
                                </button>
                              )}
                              {req.status === 'pending' && (
                                <button
                                  onClick={() => handleUpdateCitizenStatus(req._id, 'rejected')}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                  title="Reject Request"
                                >
                                  ✕
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteCitizenReq(req._id)}
                                className="px-2 py-1.5 text-gray-400 hover:text-rose-600 hover:bg-gray-100 rounded-lg text-xs transition-all cursor-pointer"
                                title="Delete permanently"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── MOBILE CARD VIEW (visible on mobile, hidden on md+) ── */}
                <div className="block md:hidden divide-y divide-gray-100">
                  {citizenRequests.map((req) => (
                    <div key={req._id} className="p-4 space-y-3 bg-white">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-gray-900 text-base">{req.name}</h4>
                          <a
                            href={`tel:${req.phone}`}
                            className="text-xs text-emerald-600 font-semibold flex items-center gap-1 mt-0.5"
                          >
                            📞 {req.phone} (Tap to Call)
                          </a>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            req.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : req.status === 'fulfilled'
                              ? 'bg-blue-100 text-blue-800'
                              : req.status === 'rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            ● {req.status}
                          </span>
                          <div className="text-[10px] font-mono text-gray-400 mt-1">
                            PIN: <strong className="text-emerald-700">{req.pin}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 p-2.5 rounded-xl">
                        <span>🍱</span>
                        <span>
                          <strong>{req.mealsNeeded} Meal(s)</strong> ·{' '}
                          {req.dietaryType === 'veg' ? '🌱 Vegetarian' : '🍖 Any Food'} ·{' '}
                          {req.needType}
                        </span>
                      </div>

                      {/* Location with Live Navigation */}
                      <div className="text-xs space-y-1">
                        <div className="text-gray-800 font-medium">
                          📍 {req.location?.address || 'Location provided'}
                        </div>
                        {req.location?.lat && req.location?.lng && (
                          <div className="pt-1">
                            <a
                              href={req.location.navigationUrl || `https://www.google.com/maps/dir/?api=1&destination=${req.location.lat},${req.location.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold w-full justify-center shadow-sm"
                            >
                              <span>🚗</span>
                              <span>Open Live GPS Navigation ↗</span>
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Mobile Action Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        {req.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateCitizenStatus(req._id, 'approved')}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                          >
                            ✅ Approve
                          </button>
                        )}
                        {req.status === 'approved' && (
                          <button
                            onClick={() => handleUpdateCitizenStatus(req._id, 'fulfilled')}
                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                          >
                            🎉 Mark Fulfilled
                          </button>
                        )}
                        {req.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateCitizenStatus(req._id, 'rejected')}
                            className="px-3 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold"
                          >
                            ✕ Reject
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteCitizenReq(req._id)}
                          className="px-3 py-2 text-gray-400 hover:text-rose-600 hover:bg-gray-100 rounded-xl text-xs"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 5: LIVE AUDIT STREAM
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Platform Real-Time Audit Log</h3>
              <p className="text-xs text-gray-500">Chronological ledger of user registrations, food posts, NGO claims & deliveries</p>
            </div>
            <button
              onClick={loadAllData}
              className="text-xs font-semibold px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
            >
              🔄 Refresh Stream
            </button>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gray-200">
            {activityLogs.map((log, idx) => (
              <div key={idx} className="relative flex items-start gap-3">
                <span className="absolute -left-6 mt-1 w-5 h-5 rounded-full bg-[#5856D6] text-white flex items-center justify-center text-[10px] ring-4 ring-white">
                  ●
                </span>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-gray-900 text-sm">{log.title}</span>
                    <span className="text-[11px] font-mono text-gray-400">
                      {new Date(log.time).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{log.description || log.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL: FOOD POST FULL DETAILS
      ════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedFood && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedFood(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setSelectedFood(null)} className="absolute top-4 right-4 text-gray-400 hover:text-black text-xl font-bold">✖</button>

              <div className="flex items-start gap-4 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center border border-gray-200">
                  {selectedFood.photo ? (
                    <img src={selectedFood.photo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">🍱</span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-gray-900">{selectedFood.foodName}</h3>
                    {selectedFood.isBroadcast ? (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        📢 Open Broadcast
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        🏢 Direct NGO
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedFood.quantity} · {selectedFood.type === 'veg' ? '🥦 Vegetarian' : '🍗 Non-Vegetarian'}
                  </p>
                  <p className="text-xs text-amber-700 font-semibold mt-1">
                    ⏰ Best before: {new Date(selectedFood.expiryTime).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t border-b border-gray-100 py-4 mb-4">
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase">Donor</span>
                  <div className="font-semibold text-gray-800">{selectedFood.donorId?.name}</div>
                  <div className="text-xs text-gray-500">{selectedFood.donorId?.phone} · {selectedFood.donorId?.email}</div>
                </div>

                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase">Target / Claimed NGO</span>
                  <div className="font-semibold text-gray-800">
                    {selectedFood.claimedByAdmin?.organizationName || selectedFood.adminId?.organizationName || selectedFood.claimedByAdmin?.name || selectedFood.adminId?.name || 'Open to all NGOs (Unclaimed)'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {selectedFood.claimedByAdmin?.phone || selectedFood.adminId?.phone || 'Awaiting assignment'}
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase">Assigned Agent</span>
                  <div className="font-semibold text-gray-800">
                    {selectedFood.agentId ? `${selectedFood.agentId.name} (${selectedFood.agentId.vehicleType || 'Agent'})` : 'No agent assigned'}
                  </div>
                  <div className="text-xs text-gray-500">{selectedFood.agentId?.phone || 'N/A'}</div>
                </div>

                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase">Current Status</span>
                  <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_BADGES[selectedFood.status] || 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_LABELS[selectedFood.status] || selectedFood.status}
                  </span>
                </div>

                <div className="sm:col-span-2">
                  <span className="block text-xs font-bold text-gray-400 uppercase">Pickup Location</span>
                  <div className="text-gray-800">{selectedFood.location?.address || 'GPS Coordinates'}</div>
                  {selectedFood.location?.lat && (
                    <div className="text-xs font-mono text-gray-500 mt-0.5">
                      Coordinates: {selectedFood.location.lat.toFixed(5)}, {selectedFood.location.lng.toFixed(5)}
                    </div>
                  )}
                </div>

                {selectedFood.description && (
                  <div className="sm:col-span-2">
                    <span className="block text-xs font-bold text-gray-400 uppercase">Notes & Allergens</span>
                    <div className="text-gray-600 bg-gray-50 p-2.5 rounded-xl">{selectedFood.description}</div>
                  </div>
                )}
              </div>

              {/* Status History Timeline */}
              {selectedFood.timestamps && selectedFood.timestamps.length > 0 && (
                <div>
                  <h4 className="font-bold text-sm text-gray-800 mb-2">Audit Timestamp Trail</h4>
                  <div className="space-y-1.5 text-xs text-gray-600">
                    {selectedFood.timestamps.map((t, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                        <span className="font-medium text-gray-800">{t.step}</span>
                        <span className="text-gray-400 font-mono">{new Date(t.time).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════
          MODAL: EDIT USER (SUPERADMIN FULL ACCESS)
      ════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setEditingUser(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setEditingUser(null)} className="absolute top-4 right-4 text-gray-400 hover:text-black">✖</button>

              <h3 className="text-xl font-bold text-gray-900 mb-1">Edit User Profile</h3>
              <p className="text-xs text-gray-500 mb-6">Update attributes, role parameters, reward points, and availability.</p>

              <form onSubmit={handleSaveUserEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editingUser.name}
                    onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editingUser.phone || ''}
                    onChange={e => setEditingUser({ ...editingUser, phone: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Address</label>
                  <input
                    type="text"
                    value={editingUser.address || ''}
                    onChange={e => setEditingUser({ ...editingUser, address: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
                  />
                </div>

                {editingUser.role === 'admin' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Organization Name (NGO)</label>
                    <input
                      type="text"
                      value={editingUser.organizationName || ''}
                      onChange={e => setEditingUser({ ...editingUser, organizationName: e.target.value })}
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
                    />
                  </div>
                )}

                {editingUser.role === 'agent' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Vehicle Type</label>
                      <input
                        type="text"
                        value={editingUser.vehicleType || ''}
                        onChange={e => setEditingUser({ ...editingUser, vehicleType: e.target.value })}
                        className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
                        placeholder="e.g. Scooter, Bicycle, Van"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="isAvail"
                        checked={editingUser.isAvailable}
                        onChange={e => setEditingUser({ ...editingUser, isAvailable: e.target.checked })}
                        className="w-4 h-4 rounded text-[#5856D6]"
                      />
                      <label htmlFor="isAvail" className="text-sm font-semibold text-gray-800">
                        Agent is Available for New Dispatches
                      </label>
                    </div>
                  </>
                )}

                {editingUser.role === 'donor' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Donor Reward Points</label>
                    <input
                      type="number"
                      value={editingUser.points || 0}
                      onChange={e => setEditingUser({ ...editingUser, points: Number(e.target.value) })}
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-bold text-emerald-700"
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#5856D6] hover:bg-[#4845B4] text-white rounded-xl font-semibold text-sm"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════
          MODAL: STATUS OVERRIDE (SUPERADMIN)
      ════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {statusOverridePost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setStatusOverridePost(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setStatusOverridePost(null)} className="absolute top-4 right-4 text-gray-400 hover:text-black">✖</button>

              <h3 className="text-xl font-bold text-gray-900 mb-1">Override Donation Status</h3>
              <p className="text-xs text-gray-500 mb-4">
                Manually change status for "{statusOverridePost.foodName}".
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">New Status</label>
                  <select
                    value={newStatusValue}
                    onChange={e => setNewStatusValue(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm bg-white font-medium"
                  >
                    <option value="pending">⏳ Pending (Reset / Unclaim)</option>
                    <option value="accepted">✅ Accepted</option>
                    <option value="agent_assigned">🚴 Agent Assigned</option>
                    <option value="picked_up">📦 Picked Up</option>
                    <option value="delivered">🎉 Delivered (Completed)</option>
                    <option value="rejected">❌ Rejected (Cancelled)</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setStatusOverridePost(null)}
                    className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApplyStatusOverride}
                    className="flex-1 py-2.5 bg-[#5856D6] hover:bg-[#4845B4] text-white rounded-xl font-semibold text-sm"
                  >
                    Apply Status
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════
          MODAL: USER DETAIL VIEW
      ════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 text-gray-400 hover:text-black">✖</button>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center font-bold text-2xl text-gray-600">
                  {selectedUser.profilePhoto ? (
                    <img src={selectedUser.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    selectedUser.name?.[0]?.toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 leading-tight">{selectedUser.name}</h3>
                  <p className="text-gray-500 text-xs">{selectedUser.email}</p>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-800 capitalize">
                    {selectedUser.role}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm border-t border-gray-100 pt-4">
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase">Phone</span>
                  <span className="font-semibold text-gray-800">{selectedUser.phone || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase">Registered</span>
                  <span className="font-semibold text-gray-800">{new Date(selectedUser.createdAt).toLocaleDateString()}</span>
                </div>
                
                {selectedUser.role === 'admin' && (
                  <div className="col-span-2">
                    <span className="block text-xs font-bold text-gray-400 uppercase">Organization (NGO)</span>
                    <span className="font-semibold text-[#FC8019]">{selectedUser.organizationName || 'Not Set'}</span>
                  </div>
                )}
                {selectedUser.role === 'donor' && (
                  <div>
                    <span className="block text-xs font-bold text-gray-400 uppercase">Reward Points</span>
                    <span className="font-semibold text-emerald-600">{selectedUser.points || 0} pts</span>
                  </div>
                )}
                {selectedUser.role === 'agent' && (
                  <>
                    <div>
                      <span className="block text-xs font-bold text-gray-400 uppercase">Vehicle</span>
                      <span className="font-semibold text-gray-800">{selectedUser.vehicleType || 'Not set'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-xs font-bold text-gray-400 uppercase">Availability</span>
                      <span className="font-semibold text-gray-800">{selectedUser.isAvailable ? '🟢 Available' : '🔴 Busy / Offline'}</span>
                    </div>
                  </>
                )}
                <div className="col-span-2">
                  <span className="block text-xs font-bold text-gray-400 uppercase">Address</span>
                  <span className="font-semibold text-gray-800">{selectedUser.address || 'N/A'}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
