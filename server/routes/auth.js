const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Please fill all required fields' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({ name, email, password, phone, role });
    res.status(201).json({
      token: generateToken(user._id),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        profilePhoto: user.profilePhoto,
        points: user.points,
        address: user.address || '',
        bio: user.bio || '',
        vehicleType: user.vehicleType || '',
        isAvailable: user.isAvailable,
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) return res.status(400).json({ message: 'Please fill all fields' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });
    if (user.role !== role) return res.status(401).json({ message: `This account is not registered as ${role}` });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    res.json({
      token: generateToken(user._id),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        profilePhoto: user.profilePhoto,
        points: user.points,
        isAvailable: user.isAvailable,
        address: user.address || '',
        bio: user.bio || '',
        vehicleType: user.vehicleType || '',
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
