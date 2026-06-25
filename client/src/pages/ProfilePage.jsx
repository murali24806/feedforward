import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import ProfileEditor from '../components/ProfileEditor';
import PointsBadge from '../components/PointsBadge';
import { useAuth } from '../context/AuthContext';
import { getMyPoints, updatePassword } from '../services/api';

export default function ProfilePage() {
  const { user } = useAuth();
  const [pointLogs, setPointLogs] = useState([]);
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '' });
  const [passStatus, setPassStatus] = useState({ loading: false, error: '', success: '' });

  useEffect(() => {
    if (user?.role === 'donor') {
      getMyPoints().then(res => setPointLogs(res.data)).catch(() => {});
    }
  }, [user?.role]);

  return (
    <DashboardLayout title="My Profile">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <ProfileEditor />

            {/* Change Password Card */}
            <div className="card">
              <h3 className="font-display text-2xl font-bold text-[#282C3F] mb-6">Change Password</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                setPassStatus({ loading: true, error: '', success: '' });
                try {
                  const res = await updatePassword(passForm);
                  setPassStatus({ loading: false, error: '', success: res.data.message });
                  setPassForm({ currentPassword: '', newPassword: '' });
                  setTimeout(() => setPassStatus(s => ({ ...s, success: '' })), 3000);
                } catch (err) {
                  setPassStatus({ loading: false, error: err.response?.data?.message || 'Failed to update password', success: '' });
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#282C3F] mb-1.5">Current or Temporary Password</label>
                  <input type="password" value={passForm.currentPassword} onChange={e => setPassForm({ ...passForm, currentPassword: e.target.value })} required className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#282C3F] mb-1.5">New Password</label>
                  <input type="password" value={passForm.newPassword} onChange={e => setPassForm({ ...passForm, newPassword: e.target.value })} required minLength={6} className="input-field" placeholder="Min. 6 characters" />
                </div>
                
                {passStatus.error && <div className="text-red-500 text-sm font-medium">⚠️ {passStatus.error}</div>}
                {passStatus.success && <div className="text-green-600 text-sm font-medium">✅ {passStatus.success}</div>}
                
                <button type="submit" disabled={passStatus.loading} className="btn-primary w-full disabled:opacity-60">
                  {passStatus.loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>

          <div className="space-y-5">
            {user?.role === 'donor' && (
              <PointsBadge points={user?.points || 0} logs={pointLogs} />
            )}

            {user?.role === 'agent' && (
              <div className="card">
                <h3 className="font-display text-xl font-bold text-[#282C3F] mb-5">Agent Stats</h3>
                <div className="space-y-1">
                  {[
                    ['🚗', 'Vehicle', user?.vehicleType || 'Not set'],
                    ['🔘', 'Availability', user?.isAvailable ? '🟢 Available' : '🟠 On Delivery'],
                    ['📅', 'Member Since', user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'],
                  ].map(([icon, label, value]) => (
                    <div key={label} className="flex justify-between items-center py-3 border-b border-[#F4F4F4] last:border-0">
                      <span className="text-[#686B78] text-base flex items-center gap-2"><span>{icon}</span>{label}</span>
                      <span className="font-semibold text-[#282C3F] text-base">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {user?.role === 'admin' && (
              <div className="card">
                <h3 className="font-display text-xl font-bold text-[#282C3F] mb-4">Admin Info</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-[#FFF3E8] rounded-2xl px-4 py-3">
                    <span className="text-2xl">🏢</span>
                    <div>
                      <p className="font-semibold text-[#282C3F] text-base">NGO Admin Account</p>
                      <p className="text-sm text-[#686B78]">Full platform access</p>
                    </div>
                  </div>
                  <p className="text-sm text-[#686B78] leading-relaxed">
                    You can manage food donations, assign delivery agents, monitor live tracking, and award points to donors.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
