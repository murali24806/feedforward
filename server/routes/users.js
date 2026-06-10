const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, requireRole } = require('../middleware/auth');
const { upload } = require('../utils/cloudinary');

// GET /api/users/profile
router.get('/profile', protect, async (req, res) => {
  res.json(req.user);
});

// PUT /api/users/profile
router.put('/profile', protect, upload.single('profilePhoto'), async (req, res) => {
  try {
    const updates = { name: req.body.name, phone: req.body.phone, address: req.body.address, bio: req.body.bio, vehicleType: req.body.vehicleType };
    if (req.body.isAvailable !== undefined) updates.isAvailable = req.body.isAvailable === 'true';
    if (req.file) updates.profilePhoto = req.file.path;
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/donors (admin only)
router.get('/donors', protect, requireRole('admin'), async (req, res) => {
  try {
    const donors = await User.find({ role: 'donor' }).select('-password');
    res.json(donors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/agents (admin only)
router.get('/agents', protect, requireRole('admin'), async (req, res) => {
  try {
    const agents = await User.find({ role: 'agent' }).select('-password');
    res.json(agents);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/:id (admin only)
router.get('/:id', protect, requireRole('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
