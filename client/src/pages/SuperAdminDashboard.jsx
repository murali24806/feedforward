import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import API, { deleteUser } from '../services/api';
import DashboardLayout from '../components/DashboardLayout';

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [statsRes, usersRes] = await Promise.all([
          API.get('/superadmin/stats'),
          API.get('/superadmin/users')
        ]);
        
        setStats(statsRes.data);
        setUsers(usersRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  const handleDeleteUser = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete the user "${name}"? This action cannot be undone.`)) return;
    try {
      await deleteUser(id);
      setUsers(users.filter(u => u._id !== id));
      setStats(s => ({ ...s, users: { ...s.users, total: s.users.total - 1 } }));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete user');
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Platform Overview">
        <div className="p-10 text-center text-xl font-bold">Loading Stats...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Platform Overview">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Monitor all activities across FeedForward</h2>
        </div>
        <button onClick={() => navigate('/superadmin/create')} className="bg-[#282C3F] text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-black transition-colors shadow-md hidden sm:block">
          + Create Admin / Agent
        </button>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Users', value: stats.users.total, icon: '👥', color: 'bg-blue-50 text-blue-600' },
          { label: 'Total Donations', value: stats.foodPosts.total, icon: '🍱', color: 'bg-green-50 text-green-600' },
          { label: 'Total Deliveries', value: stats.deliveries.total, icon: '🚴', color: 'bg-orange-50 text-orange-600' },
          { label: 'Active Deliveries', value: stats.deliveries.active, icon: '🔥', color: 'bg-red-50 text-red-600' }
        ].map(s => (
          <div key={s.label} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${s.color}`}>
              {s.icon}
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">{s.value}</div>
              <div className="text-sm font-medium text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Graphical Monitoring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* User Distribution Pie Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6">User Demographics</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Donors', value: stats.users.donors, color: '#1BA672' },
                    { name: 'NGO Admins', value: stats.users.admins, color: '#FC8019' },
                    { name: 'Agents', value: stats.users.agents, color: '#6C63FF' }
                  ]}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {[
                    { name: 'Donors', value: stats.users.donors, color: '#1BA672' },
                    { name: 'NGO Admins', value: stats.users.admins, color: '#FC8019' },
                    { name: 'Agents', value: stats.users.agents, color: '#6C63FF' }
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, 'Users']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Platform Activity Bar Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Platform Activity</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'Food Posts', count: stats.foodPosts.total },
                  { name: 'Deliveries', count: stats.deliveries.total },
                  { name: 'Active Orders', count: stats.deliveries.active }
                ]}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#686B78', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#686B78', fontSize: 12 }} />
                <Tooltip cursor={{ fill: '#F9FAFB' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="count" radius={[6, 6, 6, 6]}>
                  {
                    [
                      { name: 'Food Posts', count: stats.foodPosts.total },
                      { name: 'Deliveries', count: stats.deliveries.total },
                      { name: 'Active Orders', count: stats.deliveries.active }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#1BA672' : index === 1 ? '#6C63FF' : '#FC8019'} />
                    ))
                  }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 overflow-hidden">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Users</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[600px]">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100 uppercase tracking-wider text-xs">
                <th className="pb-3 font-semibold px-2">Name</th>
                <th className="pb-3 font-semibold px-2">Email</th>
                <th className="pb-3 font-semibold px-2">Role</th>
                <th className="pb-3 font-semibold px-2">Joined</th>
                <th className="pb-3 font-semibold px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="py-4 font-medium text-gray-900 px-2">{u.name}</td>
                  <td className="py-4 text-gray-500 px-2">{u.email}</td>
                  <td className="py-4 px-2">
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      u.role === 'agent' ? 'bg-orange-100 text-orange-700' :
                      u.role === 'superadmin' ? 'bg-gray-800 text-white' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-4 text-gray-500 px-2">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="py-4 px-2 text-right">
                    <button onClick={() => setSelectedUser(u)} className="text-blue-600 hover:underline mr-4 font-semibold">View</button>
                    {u.role !== 'superadmin' && (
                      <button onClick={() => handleDeleteUser(u._id, u.name)} className="text-red-600 hover:underline font-semibold">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl relative" onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 text-gray-400 hover:text-black">✖</button>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0 border border-gray-200">
                  {selectedUser.profilePhoto ? <img src={selectedUser.profilePhoto} alt="Profile" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-2xl">{selectedUser.name?.[0]}</div>}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 leading-tight">{selectedUser.name}</h3>
                  <p className="text-gray-500">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm border-t border-gray-100 pt-4">
                <div><span className="block text-xs font-bold text-gray-400 uppercase tracking-wide">Role</span><span className="font-semibold capitalize text-gray-800">{selectedUser.role}</span></div>
                <div><span className="block text-xs font-bold text-gray-400 uppercase tracking-wide">Phone</span><span className="font-semibold text-gray-800">{selectedUser.phone || 'N/A'}</span></div>
                
                {selectedUser.role === 'donor' && (
                  <div><span className="block text-xs font-bold text-gray-400 uppercase tracking-wide">Points</span><span className="font-semibold text-[#FC8019]">{selectedUser.points || 0}</span></div>
                )}
                {selectedUser.role === 'agent' && (
                  <div><span className="block text-xs font-bold text-gray-400 uppercase tracking-wide">Vehicle</span><span className="font-semibold text-gray-800">{selectedUser.vehicleType || 'Not set'}</span></div>
                )}
                {selectedUser.role === 'agent' && (
                  <div><span className="block text-xs font-bold text-gray-400 uppercase tracking-wide">Status</span><span className="font-semibold text-gray-800">{selectedUser.isAvailable ? '🟢 Available' : '🔴 Unavailable'}</span></div>
                )}
                <div className="col-span-2"><span className="block text-xs font-bold text-gray-400 uppercase tracking-wide">Address</span><span className="font-semibold text-gray-800">{selectedUser.address || 'N/A'}</span></div>
                <div className="col-span-2"><span className="block text-xs font-bold text-gray-400 uppercase tracking-wide">Bio</span><span className="text-gray-600">{selectedUser.bio || 'No bio provided.'}</span></div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
