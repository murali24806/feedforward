import React from 'react';
import { useNavigate } from 'react-router-dom';
import CitizenFoodRequestModal from '../components/CitizenFoodRequestModal';

export default function CitizenFoodRequestPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-gray-50 flex flex-col justify-between">
      {/* Top Simple Header */}
      <header className="p-4 sm:p-6 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <span className="text-3xl">🌱</span>
          <span className="text-2xl font-black font-display text-gray-900 tracking-tight">
            Feed<span className="text-orange-500">Forward</span>
          </span>
        </div>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-xl text-sm font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 shadow-sm transition-all"
        >
          ← Back to Home
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4">
        <CitizenFoodRequestModal isOpen={true} onClose={() => navigate('/')} />
      </main>

      <footer className="p-4 text-center text-xs text-gray-400">
        FeedForward Community Hunger Relief Initiative · No Login Required
      </footer>
    </div>
  );
}
