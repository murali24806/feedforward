const express = require('express');
const router = express.Router();
const CitizenRequest = require('../models/CitizenRequest');
const FoodPost = require('../models/FoodPost');
const { protect, requireRole } = require('../middleware/auth');

// ── 1. PUBLIC: Submit a Food Assistance Request (No Login Needed) ─────────
router.post('/', async (req, res) => {
  try {
    const { name, phone, mealsNeeded, dietaryType, needType, notes, lat, lng, address, city } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: 'Name and Phone Number are required' });
    }

    // Generate unique 4-digit pickup / verification PIN
    const pin = Math.floor(1000 + Math.random() * 9000).toString();

    const newRequest = await CitizenRequest.create({
      name: name.trim(),
      phone: phone.trim(),
      mealsNeeded: Number(mealsNeeded) || 1,
      dietaryType: dietaryType || 'any',
      needType: needType || 'Individual',
      notes: notes || '',
      location: {
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        address: address || '',
        city: city || ''
      },
      pin,
      status: 'pending'
    });

    // Broadcast in real-time via Socket.IO
    if (req.io) {
      req.io.to('superadmin:room').emit('citizen:newRequest', newRequest);
      req.io.to('admin:room').emit('citizen:newRequest', newRequest);
      req.io.emit('superadmin:activity', {
        type: 'citizen_request',
        title: 'New Citizen Food Request',
        message: `${name} requested ${mealsNeeded || 1} meal(s) in ${city || address || 'local area'} (PIN: ${pin})`,
        time: new Date()
      });
    }

    res.status(201).json({
      success: true,
      message: 'Your food assistance request has been received!',
      pin,
      requestId: newRequest._id,
      request: newRequest
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── 2. PUBLIC: Check Request Status by Phone (No Login Needed) ───────────
router.get('/status/:phone', async (req, res) => {
  try {
    const phone = req.params.phone.trim();
    const requests = await CitizenRequest.find({ phone })
      .populate('matchedFoodPostId', 'foodName quantity type expiryTime photo location')
      .populate('matchedAdminId', 'name organizationName phone')
      .sort({ createdAt: -1 });

    if (!requests || requests.length === 0) {
      return res.status(404).json({ message: 'No food requests found for this phone number' });
    }

    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── 3. PUBLIC: Browse Available Surplus Food (No Login Needed) ────────────
router.get('/available-food', async (req, res) => {
  try {
    // Return pending or accepted food posts that haven't expired yet
    const posts = await FoodPost.find({
      status: { $in: ['pending', 'accepted', 'agent_assigned'] },
      expiryTime: { $gt: new Date() }
    })
      .select('foodName quantity type expiryTime description photo location createdAt')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ success: true, count: posts.length, foodPosts: posts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── 4. PROTECTED (Superadmin & NGO Admin): List all citizen requests ───────
router.get('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { status, city } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (city) filter['location.city'] = new RegExp(city, 'i');

    const requests = await CitizenRequest.find(filter)
      .populate('matchedFoodPostId', 'foodName quantity type expiryTime photo location status')
      .populate('matchedAdminId', 'name organizationName phone')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── 5. PROTECTED (Superadmin & NGO Admin): Update request status / Match ──
router.put('/:id/status', protect, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { status, matchedFoodPostId } = req.body;
    const updateData = {};
    if (status) updateData.status = status;
    if (matchedFoodPostId) updateData.matchedFoodPostId = matchedFoodPostId;
    if (req.user.role === 'admin') updateData.matchedAdminId = req.user._id;

    const updated = await CitizenRequest.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('matchedFoodPostId')
      .populate('matchedAdminId');

    if (!updated) return res.status(404).json({ message: 'Request not found' });

    if (req.io) {
      req.io.to('superadmin:room').emit('citizen:requestUpdated', updated);
      req.io.to('admin:room').emit('citizen:requestUpdated', updated);
    }

    res.json({ success: true, request: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── 6. PROTECTED (Superadmin): Delete Request ─────────────────────────────
router.delete('/:id', protect, requireRole('superadmin'), async (req, res) => {
  try {
    const deleted = await CitizenRequest.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Request not found' });
    res.json({ success: true, message: 'Citizen request deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
