import React, { useState } from 'react';
import API from '../services/api';
import DashboardLayout from '../components/DashboardLayout';

export default function SuperAdminCreateUser() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', password: '', role: 'admin' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    
    try {
      await API.post('/auth/register', form);
      setMessage(`Successfully created ${form.role} account for ${form.email}`);
      setForm({ name: '', email: '', phone: '', address: '', password: '', role: 'admin' });
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Create Account">
      <div className="flex justify-center items-start w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 w-full max-w-lg mt-4 sm:mt-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Generate Credentials</h2>
          <p className="text-gray-500 mb-8">Create accounts for NGO Admins or Delivery Agents.</p>

          {message && <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-xl border border-green-200">{message}</div>}
          {error && <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">{error}</div>}

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Account Role</label>
              <select name="role" value={form.role} onChange={handle} className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#FC8019] bg-gray-50">
                <option value="admin">NGO Admin</option>
                <option value="agent">Delivery Agent</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{form.role === 'admin' ? 'Organization Name' : 'Full Name'}</label>
              <input name="name" value={form.name} onChange={handle} required className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#FC8019]" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
              <input type="email" name="email" value={form.email} onChange={handle} required className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#FC8019]" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Temporary Password</label>
              <input type="password" name="password" value={form.password} onChange={handle} required className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#FC8019]" />
              <p className="text-xs text-gray-400 mt-1">They can change this later in their profile.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Phone (Optional)</label>
              <input name="phone" value={form.phone} onChange={handle} className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#FC8019]" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Address (Required)</label>
              <textarea name="address" value={form.address} onChange={handle} required rows={2} className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#FC8019] resize-none" />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-[#282C3F] text-white py-3 rounded-xl font-bold hover:bg-black transition-colors mt-4">
              {loading ? 'Creating...' : `Create ${form.role === 'admin' ? 'NGO Admin' : 'Agent'} Account`}
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
