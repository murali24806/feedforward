import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import PointsBadge from '../components/PointsBadge';
import { getDonors, getAgents, getDonorPoints, assignPoints } from '../services/api';

export default function AdminUsers() {
  const [tab, setTab] = useState('donors');
  const [donors, setDonors] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pointsLogs, setPointsLogs] = useState([]);
  const [pointsForm, setPointsForm] = useState({ points: '', reason: '' });
  const [assignLoading, setAssignLoading] = useState(false);
  const detailRef = useRef(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [dr, ar] = await Promise.all([getDonors(), getAgents()]);
        setDonors(dr.data);
        setAgents(ar.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const selectUser = async (user) => {
    setSelectedUser(user);
    // Scroll to detail panel on mobile
    setTimeout(() => {
      if (detailRef.current) {
        detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
    if (user.role === 'donor') {
      try {
        const res = await getDonorPoints(user._id);
        setPointsLogs(res.data);
      } catch (err) { setPointsLogs([]); }
    }
  };

  const handleAssignPoints = async () => {
    if (!pointsForm.points || !pointsForm.reason) { alert('Enter points and reason'); return; }
    setAssignLoading(true);
    try {
      await assignPoints({ donorId: selectedUser._id, points: parseInt(pointsForm.points), reason: pointsForm.reason });
      setSelectedUser(u => ({ ...u, points: u.points + parseInt(pointsForm.points) }));
      setDonors(d => d.map(donor => donor._id === selectedUser._id ? { ...donor, points: donor.points + parseInt(pointsForm.points) } : donor));
      setPointsForm({ points: '', reason: '' });
      alert('Points assigned!');
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
    finally { setAssignLoading(false); }
  };

  const list = tab === 'donors' ? donors : agents;

  return (
    <DashboardLayout title="User Management">
      {/* Tab switcher */}
      <div className="flex gap-3 mb-6">
        {[
          { key: 'donors', label: `🤲 Donors`, count: donors.length },
          { key: 'agents', label: `🚴 Agents`, count: agents.length },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelectedUser(null); }}
            className={`px-6 py-3 rounded-xl font-semibold text-base transition-all
              ${tab === t.key ? 'bg-[#FC8019] text-white shadow-[0_4px_10px_rgba(252,128,25,0.3)]' : 'bg-white text-[#686B78] border border-[#F0F0F0] hover:bg-[#F4F4F4]'}`}>
            {t.label} <span className={`text-sm ml-1 ${tab === t.key ? 'text-white/80' : 'text-[#93959F]'}`}>({t.count})</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Table */}
        <div className="flex-1 card overflow-x-auto">
          {loading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-16 animate-pulse bg-[#F4F4F4] rounded-xl" />)}</div>
          ) : list.length === 0 ? (
            <div className="text-center py-10 text-[#686B78] text-base">No {tab} found.</div>
          ) : (
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="text-left text-sm text-[#93959F] font-semibold border-b border-[#F0F0F0]">
                  <th className="pb-4 pr-4">User</th>
                  <th className="pb-4 pr-4">Contact</th>
                  {tab === 'donors' && <th className="pb-4 pr-4">Points</th>}
                  {tab === 'agents' && <th className="pb-4 pr-4">Status</th>}
                  <th className="pb-4">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F4F4]">
                {list.map((user, i) => (
                  <motion.tr key={user._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    onClick={() => selectUser(user)}
                    className={`cursor-pointer hover:bg-[#FFF3E8] transition-colors ${selectedUser?._id === user._id ? 'bg-[#FFF3E8]' : ''}`}>
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 bg-[#FC8019]">
                          {user.profilePhoto ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" /> : <span className="text-white font-bold">{user.name?.[0]}</span>}
                        </div>
                        <div>
                          <p className="font-semibold text-base text-[#282C3F]">{user.name}</p>
                          <p className="text-sm text-[#686B78]">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-base text-[#686B78]">{user.phone || '—'}</td>
                    {tab === 'donors' && <td className="py-4 pr-4"><span className="badge-green">⭐ {user.points}</span></td>}
                    {tab === 'agents' && <td className="py-4 pr-4"><span className={user.isAvailable ? 'badge-green' : 'badge-orange'}>{user.isAvailable ? '🟢 Available' : '🟠 Busy'}</span></td>}
                    <td className="py-4 text-sm text-[#93959F]">{new Date(user.createdAt).toLocaleDateString()}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Selected user panel */}
        <AnimatePresence>
          {selectedUser && (
            <motion.div ref={detailRef} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="lg:w-80 flex-shrink-0 space-y-4 scroll-mt-4">
              <div className="card text-center">
                <button onClick={() => setSelectedUser(null)} className="float-right w-8 h-8 rounded-xl bg-[#F4F4F4] flex items-center justify-center text-[#686B78] hover:bg-[#E8E8E8] text-xl transition-colors">×</button>
                <div className="w-20 h-20 rounded-2xl mx-auto bg-[#FC8019] overflow-hidden mb-4 flex items-center justify-center">
                  {selectedUser.profilePhoto ? <img src={selectedUser.profilePhoto} alt="" className="w-full h-full object-cover" /> : <span className="text-white text-3xl font-bold">{selectedUser.name?.[0]}</span>}
                </div>
                <h3 className="font-display font-bold text-[#282C3F] text-lg">{selectedUser.name}</h3>
                <p className="text-base text-[#686B78]">{selectedUser.email}</p>
                <p className="text-base text-[#686B78]">{selectedUser.phone}</p>
                {selectedUser.bio && <p className="text-sm text-[#686B78] mt-2 italic">"{selectedUser.bio}"</p>}
              </div>

              {selectedUser.role === 'donor' && (
                <>
                  <PointsBadge points={selectedUser.points} logs={pointsLogs} />
                  <div className="card">
                    <h4 className="font-display font-semibold text-[#282C3F] text-base mb-4">Assign Points</h4>
                    <div className="space-y-3">
                      <input type="number" min="1" placeholder="Points to add" value={pointsForm.points}
                        onChange={e => setPointsForm(p => ({ ...p, points: e.target.value }))} className="input-field" />
                      <input type="text" placeholder="Reason (e.g. Great donation!)" value={pointsForm.reason}
                        onChange={e => setPointsForm(p => ({ ...p, reason: e.target.value }))} className="input-field" />
                      <button onClick={handleAssignPoints} disabled={assignLoading} className="btn-primary w-full disabled:opacity-60">
                        {assignLoading ? 'Assigning...' : '⭐ Assign Points'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {selectedUser.role === 'agent' && (
                <div className="card space-y-3">
                  {[
                    ['🚗', 'Vehicle', selectedUser.vehicleType || '—'],
                    ['📅', 'Joined', new Date(selectedUser.createdAt).toLocaleDateString()],
                  ].map(([icon, label, value]) => (
                    <div key={label} className="flex justify-between items-center py-2 border-b border-[#F4F4F4] last:border-0">
                      <span className="text-[#686B78] text-base flex items-center gap-2"><span>{icon}</span>{label}</span>
                      <span className="font-semibold text-[#282C3F] text-base">{value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[#686B78] text-base flex items-center gap-2"><span>🔘</span>Status</span>
                    <span className={selectedUser.isAvailable ? 'badge-green' : 'badge-orange'}>
                      {selectedUser.isAvailable ? '🟢 Available' : '🟠 On Delivery'}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
