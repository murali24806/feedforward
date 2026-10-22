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
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.phone !== undefined) updates.phone = req.body.phone;
    if (req.body.address !== undefined) updates.address = req.body.address;
    if (req.body.city !== undefined) updates.city = req.body.city;
    if (req.body.pincode !== undefined) updates.pincode = req.body.pincode;
    if (req.body.bio !== undefined) updates.bio = req.body.bio;
    if (req.body.vehicleType !== undefined) updates.vehicleType = req.body.vehicleType;
    if (req.body.organizationName !== undefined) updates.organizationName = req.body.organizationName;
    if (req.body.donorType !== undefined) updates.donorType = req.body.donorType;
    if (req.body.isAvailable !== undefined) updates.isAvailable = req.body.isAvailable === 'true' || req.body.isAvailable === true;
    if (req.body.isProfileComplete !== undefined) {
      updates.isProfileComplete = req.body.isProfileComplete === 'true' || req.body.isProfileComplete === true;
    }
    if (req.file) updates.profilePhoto = req.file.path;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/complete-profile (First-time onboarding profile completion)
router.put('/complete-profile', protect, upload.single('profilePhoto'), async (req, res) => {
  try {
    const {
      name,
      phone,
      address,
      city,
      pincode,
      bio,
      vehicleType,
      organizationName,
      donorType
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Full name is required.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: 'Contact phone number is required.' });
    }
    if (!address || !address.trim()) {
      return res.status(400).json({ message: 'Address is required.' });
    }

    if (req.user.role === 'agent' && (!vehicleType || !vehicleType.trim())) {
      return res.status(400).json({ message: 'Vehicle type is required for delivery couriers.' });
    }

    if (req.user.role === 'admin' && (!organizationName || !organizationName.trim())) {
      return res.status(400).json({ message: 'Organization name is required for NGO administrators.' });
    }

    const updates = {
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      city: (city || '').trim(),
      pincode: (pincode || '').trim(),
      bio: (bio || '').trim(),
      isProfileComplete: true
    };

    if (req.user.role === 'donor') {
      if (donorType) updates.donorType = donorType.trim();
    }

    if (req.user.role === 'agent') {
      updates.vehicleType = vehicleType.trim();
      if (req.body.isAvailable !== undefined) {
        updates.isAvailable = req.body.isAvailable === 'true' || req.body.isAvailable === true;
      }
    }

    if (req.user.role === 'admin') {
      updates.organizationName = organizationName.trim();
    }

    if (req.file) {
      updates.profilePhoto = req.file.path;
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    res.json({
      message: 'Profile completed successfully!',
      user: updatedUser
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/profile/password
router.put('/profile/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both current and new passwords are required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });

    const user = await User.findById(req.user._id);
    
    // Some users (like Google users) might not have a password set, but usually they do
    if (user.password) {
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) return res.status(401).json({ message: 'Incorrect current password' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully' });
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

// GET /api/users/admins
router.get('/admins', protect, async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('-password');
    res.json(admins);
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
