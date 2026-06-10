import React from 'react';
import { motion } from 'framer-motion';

const STEPS = [
  { key: 'Food Posted', icon: '🍱', label: 'Food Posted', desc: 'Your donation has been submitted' },
  { key: 'NGO Admin Accepted', icon: '✅', label: 'NGO Accepted', desc: 'Donation accepted by NGO Admin' },
  { key: 'Agent Assigned', icon: '🚴', label: 'Agent Assigned', desc: 'Delivery agent has been assigned' },
  { key: 'Agent In Transit', icon: '📍', label: 'Agent En Route', desc: 'Agent is heading to your location' },
  { key: 'Pickup Completed', icon: '📦', label: 'Picked Up', desc: 'Food has been collected' },
  { key: 'Delivered', icon: '🎉', label: 'Delivered', desc: 'Meal delivered successfully!' },
];

function getCompletedSteps(timestamps = [], status) {
  const completedKeys = timestamps.map((t) => t.step);
  const statusToStep = {
    pending: [],
    accepted: ['Food Posted', 'NGO Admin Accepted'],
    agent_assigned: ['Food Posted', 'NGO Admin Accepted', 'Agent Assigned'],
    picked_up: ['Food Posted', 'NGO Admin Accepted', 'Agent Assigned', 'Agent In Transit', 'Pickup Completed'],
    delivered: ['Food Posted', 'NGO Admin Accepted', 'Agent Assigned', 'Agent In Transit', 'Pickup Completed', 'Delivered'],
  };
  return statusToStep[status] || completedKeys;
}

export default function TrackingTimeline({ foodPost, delivery, agent }) {
  const completedKeys = getCompletedSteps(foodPost?.timestamps, foodPost?.status);
  const currentStepIdx = STEPS.findIndex((s) => !completedKeys.includes(s.key));
  const activeIdx = currentStepIdx === -1 ? STEPS.length - 1 : Math.max(currentStepIdx - 1, 0);

  const getTimestamp = (key) => {
    const ts = foodPost?.timestamps?.find((t) => t.step === key);
    return ts ? new Date(ts.time).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : null;
  };

  return (
    <div className="card">
      <h3 className="font-display text-xl font-bold text-[#282C3F] mb-6">Delivery Status</h3>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[22px] top-8 bottom-8 w-0.5 bg-[#F4F4F4]" />
        <div className="absolute left-[22px] top-8 w-0.5 bg-[#1BA672] transition-all duration-1000"
          style={{ height: `${(completedKeys.length / STEPS.length) * 100}%` }} />

        <div className="space-y-6">
          {STEPS.map((step, idx) => {
            const done = completedKeys.includes(step.key);
            const active = idx === completedKeys.length && idx <= activeIdx + 1;
            const ts = getTimestamp(step.key);
            return (
              <motion.div key={step.key} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }}
                className="flex items-start gap-4 relative z-10">
                {/* Step icon */}
                <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-lg transition-all duration-500 border-2 ${done ? 'bg-[#1BA672] border-[#1BA672] shadow-md' : active ? 'bg-white border-[#FC8019] shadow-md animate-pulse-slow' : 'bg-white border-[#E8E8E8]'}`}>
                  {done ? '✅' : step.icon}
                </div>
                <div className="flex-1 pt-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className={`font-semibold text-sm ${done ? 'text-[#282C3F]' : 'text-[#93959F]'}`}>{step.label}</p>
                    {ts && <span className="text-xs text-[#93959F]">{ts}</span>}
                  </div>
                  <p className={`text-xs mt-0.5 ${done ? 'text-[#686B78]' : 'text-gray-300'}`}>{step.desc}</p>
                  {/* Show agent info at step 3+ */}
                  {idx >= 2 && done && agent && (
                    <div className="mt-2 flex items-center gap-2 bg-[#1BA672]/5 rounded-lg p-2">
                      <div className="w-7 h-7 rounded-full bg-[#FC8019] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {agent.profilePhoto ? <img src={agent.profilePhoto} alt="" className="w-full h-full object-cover" /> : <span className="text-white text-xs font-bold">{agent.name?.[0]}</span>}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#282C3F]">{agent.name}</p>
                        <p className="text-[10px] text-[#93959F]">{agent.phone} · {agent.vehicleType || 'Bike'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Success banner */}
      {foodPost?.status === 'delivered' && (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-6 bg-[#1BA672] text-white rounded-2xl p-4 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <p className="font-display font-bold text-lg">Delivered Successfully!</p>
          <p className="text-white/70 text-sm">Thank you for making a difference!</p>
        </motion.div>
      )}
    </div>
  );
}
