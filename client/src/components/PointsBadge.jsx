import React from 'react';
import { motion } from 'framer-motion';

const tiers = [
  { min: 0,    label: 'Seed',       color: '#1BA672', icon: '🌱' },
  { min: 100,  label: 'Sprout',     color: '#0EA070', icon: '🌿' },
  { min: 500,  label: 'Green Hero', color: '#FC8019', icon: '🌳' },
  { min: 1000, label: 'Champion',   color: '#FC8019', icon: '🏆' },
  { min: 5000, label: 'Legend',     color: '#E8720C', icon: '⭐' },
];

function getTier(points) {
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (points >= tiers[i].min) return tiers[i];
  }
  return tiers[0];
}

export default function PointsBadge({ points = 0, logs = [] }) {
  const tier = getTier(points);
  const nextTier = tiers.find((t) => t.min > points);
  const tierIdx = tiers.indexOf(tier);
  const progress = nextTier
    ? Math.min(((points - tiers[tierIdx].min) / (nextTier.min - tiers[tierIdx].min)) * 100, 100)
    : 100;

  return (
    <div className="card">
      <h3 className="font-display text-xl font-bold text-[#282C3F] mb-5">Reward Points</h3>

      <div className="flex items-center gap-4 mb-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shadow-md flex-shrink-0"
          style={{ background: `${tier.color}18`, border: `2px solid ${tier.color}40` }}>
          {tier.icon}
        </motion.div>
        <div>
          <p className="text-4xl font-bold text-[#282C3F] font-display">{points.toLocaleString()}</p>
          <p className="text-base font-semibold mt-1" style={{ color: tier.color }}>{tier.label}</p>
          {nextTier && <p className="text-sm text-[#686B78] mt-0.5">{nextTier.min - points} pts to {nextTier.label}</p>}
        </div>
      </div>

      {nextTier && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-[#686B78] font-medium mb-2">
            <span>{tier.label}</span>
            <span>{nextTier.label}</span>
          </div>
          <div className="h-2.5 bg-[#F4F4F4] rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1, delay: 0.3 }}
              className="h-full rounded-full" style={{ background: tier.color }} />
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap mb-5">
        {tiers.map((t) => (
          <div key={t.label}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${points >= t.min ? 'opacity-100' : 'opacity-25'}`}
            style={{ background: `${t.color}15`, color: t.color, border: `1px solid ${t.color}30` }}>
            {t.icon} {t.label}
          </div>
        ))}
      </div>

      {logs.length > 0 && (
        <div>
          <h4 className="font-semibold text-base text-[#282C3F] mb-3">Points History</h4>
          <div className="space-y-0 max-h-52 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-[#F4F4F4] last:border-0">
                <div>
                  <p className="text-base text-[#282C3F]">{log.reason}</p>
                  <p className="text-sm text-[#686B78]">{new Date(log.date).toLocaleDateString()}</p>
                </div>
                <span className="text-[#1BA672] font-bold text-base">+{log.points}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
