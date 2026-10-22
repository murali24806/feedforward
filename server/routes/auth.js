const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, requireRole } = require('../middleware/auth');
const admin = require('../firebaseAdmin');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/mailer');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register
// Public for 'donor', Restricted for 'admin' and 'agent'
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, phone, role, address } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Please fill all required fields' });
    }

    if (role === 'admin' || role === 'agent') {
      // Must be superadmin to create these roles
      protect(req, res, () => {
        requireRole('superadmin')(req, res, async () => {
          await registerUser(req, res, { name, email, password, phone, role, address });
        });
      });
    } else if (role === 'donor') {
      await registerUser(req, res, { name, email, password, phone, role, address });
    } else {
      return res.status(400).json({ message: 'Invalid role specified' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

async function registerUser(req, res, { name, email, password, phone, role, address }) {
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({ 
      name, 
      email, 
      password, 
      phone, 
      role, 
      address, 
      isProfileComplete: false 
    });

    // Send welcome email (Non-blocking background)
    sendWelcomeEmail({
      email: user.email,
      name: user.name,
      role: user.role
    }).catch(e => console.error('[Auth] Welcome email error:', e.message));

    res.status(201).json({
      token: generateToken(user._id),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        profilePhoto: user.profilePhoto || '',
        points: user.points,
        address: user.address || '',
        city: user.city || '',
        pincode: user.pincode || '',
        bio: user.bio || '',
        organizationName: user.organizationName || '',
        donorType: user.donorType || '',
        vehicleType: user.vehicleType || '',
        isAvailable: user.isAvailable,
        isProfileComplete: false,
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

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
        profilePhoto: user.profilePhoto || '',
        points: user.points,
        isAvailable: user.isAvailable,
        address: user.address || '',
        city: user.city || '',
        pincode: user.pincode || '',
        bio: user.bio || '',
        organizationName: user.organizationName || '',
        donorType: user.donorType || '',
        vehicleType: user.vehicleType || '',
        isProfileComplete: user.role === 'superadmin' ? true : !!user.isProfileComplete,
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { idToken, role } = req.body;
    if (!idToken || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (role !== 'donor') {
      return res.status(403).json({ message: 'Google Sign-In is only allowed for Donors' });
    }

    // Verify token with Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { email, name } = decodedToken;

    let user = await User.findOne({ email });

    if (!user) {
      // Create new donor
      user = await User.create({
        name: name || 'Donor',
        email,
        role: 'donor',
        isProfileComplete: false,
      });
    }

    if (user.role !== 'donor') {
      return res.status(403).json({ message: 'This email is already registered with a different role.' });
    }

    res.json({
      token: generateToken(user._id),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        profilePhoto: user.profilePhoto || '',
        points: user.points,
        address: user.address || '',
        city: user.city || '',
        pincode: user.pincode || '',
        bio: user.bio || '',
        organizationName: user.organizationName || '',
        donorType: user.donorType || '',
        isProfileComplete: !!user.isProfileComplete,
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) {
      // Don't leak whether the email exists, just say check email
      return res.json({ message: 'If that email exists, we sent a temporary password to it.' });
    }

    // Generate a 8 character random string
    const tempPassword = Math.random().toString(36).slice(-8);
    
    // Save new password
    user.password = tempPassword;
    await user.save();

    // Send email
    try {
      await sendPasswordResetEmail(email, tempPassword);
    } catch (err) {
      console.error('[Auth] Failed to send password reset email:', err.message);
      return res.status(500).json({ message: 'Failed to send password reset email. Please contact support.' });
    }

    res.json({ message: 'If that email exists, we sent a temporary password to it.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
