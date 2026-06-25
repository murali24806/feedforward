const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Delivery = require('../models/Delivery');
const FoodPost = require('../models/FoodPost');
const { protect, requireRole } = require('../middleware/auth');

// Apply middleware to all routes in this file
router.use(protect);
router.use(requireRole('superadmin'));

// GET /api/superadmin/stats
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalDonors = await User.countDocuments({ role: 'donor' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    const totalAgents = await User.countDocuments({ role: 'agent' });
    
    const totalDeliveries = await Delivery.countDocuments();
    const activeDeliveries = await Delivery.countDocuments({ status: { $in: ['assigned', 'picked_up'] } });
    
    const totalFoodPosts = await FoodPost.countDocuments();

    res.json({
      users: { total: totalUsers, donors: totalDonors, admins: totalAdmins, agents: totalAgents },
      deliveries: { total: totalDeliveries, active: activeDeliveries },
      foodPosts: { total: totalFoodPosts }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/superadmin/users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/superadmin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
