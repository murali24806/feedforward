import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  submitCitizenRequest,
  getCitizenRequestStatus,
  getAvailableSurplusFood
} from '../services/api';

export default function CitizenFoodRequestModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('request'); // 'request' | 'status' | 'browse'

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [mealsNeeded, setMealsNeeded] = useState(2);
  const [dietaryType, setDietaryType] = useState('any');
  const [needType, setNeedType] = useState('Individual');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [coords, setCoords] = useState({ lat: null, lng: null });
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Result state
  const [submittedData, setSubmittedData] = useState(null);

  // Status Search State
  const [searchPhone, setSearchPhone] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [foundRequests, setFoundRequests] = useState(null);
  const [searchError, setSearchError] = useState('');

  // Live Food State
  const [availableFood, setAvailableFood] = useState([]);
  const [loadingFood, setLoadingFood] = useState(false);

  // Fetch available food when browse tab is clicked
  useEffect(() => {
    if (activeTab === 'browse' && availableFood.length === 0) {
      setLoadingFood(true);
      getAvailableSurplusFood()
        .then((res) => {
          if (res.data?.foodPosts) setAvailableFood(res.data.foodPosts);
        })
        .catch(() => {})
        .finally(() => setLoadingFood(false));
    }
  }, [activeTab, availableFood.length]);

  // Geolocation auto-detection
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    setErrorMsg('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        try {
          // Free Nominatim reverse geocode
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          if (data && data.display_name) {
            setAddress(data.display_name);
            const foundCity =
              data.address?.city ||
              data.address?.town ||
              data.address?.village ||
              data.address?.suburb ||
              '';
            if (foundCity) setCity(foundCity);
          }
        } catch (e) {
          setAddress(`GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setErrorMsg('Could not detect location. Please type your street/city manually.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setErrorMsg('Please enter your Name and Mobile Number.');
      return;
    }
    if (phone.trim().length < 8) {
      setErrorMsg('Please enter a valid phone number.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await submitCitizenRequest({
        name: name.trim(),
        phone: phone.trim(),
        mealsNeeded: Number(mealsNeeded) || 1,
        dietaryType,
        needType,
        notes: notes.trim(),
        lat: coords.lat,
        lng: coords.lng,
        address: address.trim(),
        city: city.trim()
      });

      if (res.data?.success) {
        setSubmittedData({
          pin: res.data.pin,
          name: name.trim(),
          meals: mealsNeeded,
          phone: phone.trim()
        });
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Status Search Handler
  const handleCheckStatus = async (e) => {
    e.preventDefault();
    if (!searchPhone.trim()) {
      setSearchError('Please enter your registered mobile number.');
      return;
    }

    setStatusLoading(true);
    setSearchError('');
    setFoundRequests(null);

    try {
      const res = await getCitizenRequestStatus(searchPhone.trim());
      if (res.data?.requests) {
        setFoundRequests(res.data.requests);
      }
    } catch (err) {
      setSearchError(err.response?.data?.message || 'No requests found for this number.');
    } finally {
      setStatusLoading(false);
    }
  };

  const resetForm = () => {
    setSubmittedData(null);
    setName('');
    setPhone('');
    setMealsNeeded(2);
    setAddress('');
    setCity('');
    setNotes('');
    setErrorMsg('');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 my-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 p-6 text-white relative">
            <button
              onClick={onClose}
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-lg font-bold transition-all"
              aria-label="Close"
            >
              ✕
            </button>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl p-2 bg-white/20 rounded-2xl backdrop-blur-md">🍽️</span>
              <div>
                <span className="inline-block bg-white/20 text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-1">
                  100% Free · No Login Required
                </span>
                <h2 className="text-2xl font-bold font-display tracking-tight">
                  Community Food Assistance
                </h2>
              </div>
            </div>
            <p className="text-emerald-100 text-sm mt-1 max-w-lg">
              Get wholesome, nutritious surplus meals from verified local donors and NGOs. Fill the
              form below to generate your direct 4-digit pickup code.
            </p>

            {/* Navigation Tabs */}
            <div className="flex gap-2 mt-5 bg-black/15 p-1 rounded-2xl max-w-md">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('request');
                  setErrorMsg('');
                }}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
                  activeTab === 'request'
                    ? 'bg-white text-emerald-800 shadow-md'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                📝 Request Meals
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('status');
                  setSearchError('');
                }}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
                  activeTab === 'status'
                    ? 'bg-white text-emerald-800 shadow-md'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                🔍 Check Status
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('browse')}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
                  activeTab === 'browse'
                    ? 'bg-white text-emerald-800 shadow-md'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                🍱 Available Surplus
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 max-h-[75vh] overflow-y-auto">
            {/* ── TAB 1: REQUEST FOOD FORM ─────────────────────────── */}
            {activeTab === 'request' && !submittedData && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2">
                    <span>⚠️</span>
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-sm outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Mobile Number (For PIN & Delivery) *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-sm outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Meals Needed *
                    </label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 5, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setMealsNeeded(num)}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                            mealsNeeded === num
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {num} {num === 1 ? 'Meal' : 'Meals'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Dietary Preference
                    </label>
                    <select
                      value={dietaryType}
                      onChange={(e) => setDietaryType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:border-emerald-500"
                    >
                      <option value="any">Any Food (Veg / Non-Veg)</option>
                      <option value="veg">Pure Vegetarian 🌱</option>
                      <option value="non-veg">Non-Vegetarian 🍗</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Requester Type
                    </label>
                    <select
                      value={needType}
                      onChange={(e) => setNeedType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:border-emerald-500"
                    >
                      <option value="Individual">Individual Person</option>
                      <option value="Family">Family / Household</option>
                      <option value="Senior Citizen">Senior Citizen / Elder</option>
                      <option value="Student">Student Hostel</option>
                      <option value="Shelter">Shelter / Labor Camp</option>
                    </select>
                  </div>
                </div>

                {/* Location / Address */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Your Location / Area *
                    </label>
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={locating}
                      className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1 transition-all"
                    >
                      {locating ? '🔄 Detecting...' : '📍 Auto-Detect GPS'}
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Enter street, landmark, or village area"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-sm outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      City / District *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Visakhapatnam / Hyderabad"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-sm outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Special Notes (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Please call before arrival / Urgent"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 text-sm outline-none"
                    />
                  </div>
                </div>

                {/* Submit CTA */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold text-base shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <span className="animate-spin text-lg">🔄</span>
                        <span>Submitting Request...</span>
                      </>
                    ) : (
                      <>
                        <span>🚀</span>
                        <span>Submit Food Request (Get Pickup PIN)</span>
                      </>
                    )}
                  </button>
                  <p className="text-center text-xs text-gray-400 mt-2">
                    🔒 All requests are verified by local NGO administrators to prevent hoarding. Food is 100% free.
                  </p>
                </div>
              </form>
            )}

            {/* ── SUCCESS STATE: 4-DIGIT PIN DISPLAY ────────────────── */}
            {activeTab === 'request' && submittedData && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6 px-4 space-y-5"
              >
                <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-4xl shadow-inner">
                  🎉
                </div>

                <div>
                  <h3 className="text-2xl font-bold font-display text-gray-900">
                    Request Received, {submittedData.name}!
                  </h3>
                  <p className="text-gray-600 text-sm mt-1 max-w-md mx-auto">
                    Your request for <strong>{submittedData.meals} meal(s)</strong> has been logged in
                    the local community network.
                  </p>
                </div>

                {/* 4-Digit PIN Card */}
                <div className="bg-gradient-to-b from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-3xl p-6 max-w-sm mx-auto shadow-md">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-200/60 px-3 py-1 rounded-full">
                    Your 4-Digit Pickup PIN
                  </span>
                  <div className="text-5xl font-extrabold font-mono text-emerald-700 tracking-widest my-3">
                    {submittedData.pin}
                  </div>
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    Show or mention this PIN to the donor or courier when receiving your meals to
                    verify pickup.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <button
                    onClick={() => {
                      setSearchPhone(submittedData.phone);
                      setActiveTab('status');
                      handleCheckStatus({ preventDefault: () => {} });
                    }}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md transition-all"
                  >
                    🔍 View Request Status
                  </button>
                  <button
                    onClick={resetForm}
                    className="px-6 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-all"
                  >
                    + Submit Another Request
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── TAB 2: CHECK REQUEST STATUS ─────────────────────── */}
            {activeTab === 'status' && (
              <div className="space-y-5">
                <form onSubmit={handleCheckStatus} className="flex gap-2">
                  <input
                    type="tel"
                    required
                    placeholder="Enter your registered mobile number"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={statusLoading}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    {statusLoading ? 'Searching...' : 'Check Status'}
                  </button>
                </form>

                {searchError && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl">
                    ⚠️ {searchError}
                  </div>
                )}

                {foundRequests && foundRequests.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Found {foundRequests.length} Food Request(s):
                    </p>
                    {foundRequests.map((req) => (
                      <div
                        key={req._id}
                        className="p-4 rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                              req.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : req.status === 'fulfilled'
                                ? 'bg-blue-100 text-blue-800'
                                : req.status === 'rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            ● {req.status}
                          </span>
                          <span className="text-xs font-mono font-bold bg-white px-3 py-1 rounded-lg border border-gray-200 text-emerald-700">
                            PIN: {req.pin}
                          </span>
                        </div>

                        <div className="text-sm font-semibold text-gray-800">
                          {req.mealsNeeded} Meal(s) ({req.dietaryType}) · {req.needType}
                        </div>
                        <p className="text-xs text-gray-500">
                          📍 {req.location?.address || 'Location provided'} ·{' '}
                          {new Date(req.createdAt).toLocaleDateString()}
                        </p>

                        {req.matchedFoodPostId && (
                          <div className="mt-2 p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800">
                            🍱 <strong>Matched Food:</strong> {req.matchedFoodPostId.foodName} (
                            {req.matchedFoodPostId.quantity})
                          </div>
                        )}
                        {req.matchedAdminId && (
                          <div className="p-2 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-800">
                            🏢 <strong>Assigned NGO:</strong> {req.matchedAdminId.organizationName || req.matchedAdminId.name} (
                            {req.matchedAdminId.phone})
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 3: BROWSE AVAILABLE SURPLUS FOOD ─────────────── */}
            {activeTab === 'browse' && (
              <div className="space-y-4">
                <p className="text-xs font-medium text-gray-500">
                  Real-time surplus food listed by local donors ready for distribution:
                </p>

                {loadingFood && (
                  <div className="py-8 text-center text-gray-400 text-sm">
                    🔄 Loading active food posts...
                  </div>
                )}

                {!loadingFood && availableFood.length === 0 && (
                  <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500 text-sm">
                    No active surplus food listed right now. You can still submit a request and NGOs
                    will match you as soon as food is donated!
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableFood.map((food) => (
                    <div
                      key={food._id}
                      className="border border-gray-200 rounded-2xl p-3 flex gap-3 hover:shadow-md transition-all bg-white"
                    >
                      <div className="w-20 h-20 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
                        {food.photo ? (
                          <img
                            src={food.photo}
                            alt={food.foodName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            🍱
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              food.type === 'veg' ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          <h4 className="text-sm font-bold text-gray-900 truncate">
                            {food.foodName}
                          </h4>
                        </div>
                        <p className="text-xs text-emerald-700 font-semibold mb-1">
                          {food.quantity}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">
                          📍 {food.location?.address || 'Local area'}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setNotes(`Requesting: ${food.foodName} (${food.quantity})`);
                            setActiveTab('request');
                          }}
                          className="mt-2 text-xs font-bold text-emerald-600 hover:text-emerald-800"
                        >
                          + Request this item →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Close */}
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-gray-600 font-semibold text-sm hover:bg-gray-200 transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
