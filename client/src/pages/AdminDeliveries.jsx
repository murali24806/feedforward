import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import { getAllDeliveries, removeDelivery } from '../services/api';

const COLUMNS = [
  { key: 'assigned', label: 'Pending', icon: '⏳', color: '#FC8019' },
  { key: 'in_transit', label: 'In Progress', icon: '🚴', color: '#138A5C' },
  { key: 'picked_up', label: 'Picked Up', icon: '📦', color: '#1BA672' },
  { key: 'delivered', label: 'Delivered', icon: '✅', color: '#282C3F' },
  { key: 'rejected_by_agent', label: 'Rejected', icon: '❌', color: '#EF4444' },
];

export default function AdminDeliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('kanban'); // 'kanban' | 'list'
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    getAllDeliveries()
      .then(res => setDeliveries(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getByStatus = (status) => deliveries.filter(d => d.status === status);

  const handleRemove = async (del, e) => {
    e.stopPropagation();
    if (!window.confirm(`Remove this delivery from the board?`)) return;
    setRemovingId(del._id);
    try {
      await removeDelivery(del._id);
      setDeliveries(prev => prev.filter(d => d._id !== del._id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove');
    } finally {
      setRemovingId(null);
    }
  };

  const completedStatuses = ['delivered', 'rejected_by_agent'];

  return (
    <DashboardLayout title="Deliveries">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#282C3F]">Delivery Overview</h2>
          <p className="text-[#93959F] text-sm mt-1">{deliveries.length} total deliveries</p>
        </div>
        <div className="flex gap-2">
          {['kanban','list'].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${view === v ? 'bg-[#1BA672] text-white' : 'bg-white text-[#686B78]'}`}>
              {v === 'kanban' ? '⊞ Kanban' : '☰ List'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="card h-64 animate-pulse bg-[#F4F4F4]" />)}
        </div>
      ) : view === 'kanban' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 overflow-x-auto">
          {COLUMNS.map(col => {
            const items = getByStatus(col.key);
            const isCompletedCol = completedStatuses.includes(col.key);
            return (
              <div key={col.key} className="min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{col.icon}</span>
                  <h3 className="font-semibold text-sm text-[#282C3F]">{col.label}</h3>
                  <span className="ml-auto bg-[#F4F4F4] text-[#686B78] text-xs font-bold px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
                <div className="space-y-3 min-h-[200px]">
                  {items.map((del, i) => (
                    <motion.div key={del._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="bg-white rounded-xl p-4 shadow-sm border border-gray-50 hover:shadow-md transition-shadow relative group">
                      <p className="font-semibold text-sm text-[#282C3F] mb-2">{del.foodPostId?.foodName || 'Food'}</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-[#1BA672]/20 flex items-center justify-center text-xs">🤲</div>
                          <span className="text-xs text-[#686B78] truncate">{del.donorId?.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-[#FC8019]/20 flex items-center justify-center text-xs">🚴</div>
                          <span className="text-xs text-[#686B78] truncate">{del.agentId?.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-[10px] text-gray-300">{new Date(del.createdAt).toLocaleDateString()}</p>
                        {isCompletedCol && (
                          <button
                            onClick={(e) => handleRemove(del, e)}
                            disabled={removingId === del._id}
                            className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 text-xs disabled:opacity-40"
                            title="Remove delivery"
                          >
                            {removingId === del._id ? '…' : '🗑️'}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {items.length === 0 && (
                    <div className="text-center py-8 text-gray-300 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                      No deliveries
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="text-left text-xs text-[#93959F] uppercase border-b border-gray-100">
                <th className="pb-3 pr-4">Food</th>
                <th className="pb-3 pr-4">Donor</th>
                <th className="pb-3 pr-4">Agent</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {deliveries.map((del, i) => (
                <motion.tr key={del._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="hover:bg-gray-50/50">
                  <td className="py-3 pr-4 font-medium text-sm text-[#282C3F]">{del.foodPostId?.foodName || '—'}</td>
                  <td className="py-3 pr-4 text-sm text-[#686B78]">{del.donorId?.name || '—'}</td>
                  <td className="py-3 pr-4 text-sm text-[#686B78]">{del.agentId?.name || '—'}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                      del.status === 'delivered' ? 'bg-[#1BA672]/10 text-[#1BA672]' :
                      del.status === 'rejected_by_agent' ? 'bg-red-100 text-red-500' :
                      del.status === 'in_transit' ? 'bg-[#FC8019]/20 text-[#E8720C]' :
                      'bg-[#F4F4F4] text-gray-600'}`}>
                      {del.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-xs text-[#93959F]">{new Date(del.createdAt).toLocaleDateString()}</td>
                  <td className="py-3">
                    {completedStatuses.includes(del.status) && (
                      <button
                        onClick={(e) => handleRemove(del, e)}
                        disabled={removingId === del._id}
                        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                      >
                        {removingId === del._id ? 'Removing…' : '🗑️ Remove'}
                      </button>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
