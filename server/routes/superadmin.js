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
    const activeDeliveries = await Delivery.countDocuments({ status: { $in: ['assigned', 'accepted', 'in_transit', 'picked_up'] } });
    const completedDeliveries = await Delivery.countDocuments({ status: 'delivered' });
    
    const totalFoodPosts = await FoodPost.countDocuments();
    const pendingFoodPosts = await FoodPost.countDocuments({ status: 'pending' });
    const broadcastFoodPosts = await FoodPost.countDocuments({ isBroadcast: true });
    const deliveredFoodPosts = await FoodPost.countDocuments({ status: 'delivered' });

    res.json({
      users: { total: totalUsers, donors: totalDonors, admins: totalAdmins, agents: totalAgents },
      deliveries: { total: totalDeliveries, active: activeDeliveries, completed: completedDeliveries },
      foodPosts: {
        total: totalFoodPosts,
        pending: pendingFoodPosts,
        broadcast: broadcastFoodPosts,
        delivered: deliveredFoodPosts
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/superadmin/users — all users with optional role filtering
router.get('/users', async (req, res) => {
  try {
    const query = {};
    if (req.query.role && req.query.role !== 'all') {
      query.role = req.query.role;
    }
    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/superadmin/users/:id — update any user details / role / points / status
router.put('/users/:id', async (req, res) => {
  try {
    const { name, phone, address, bio, organizationName, vehicleType, isAvailable, points, role, isProfileComplete } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (bio !== undefined) updateData.bio = bio;
    if (organizationName !== undefined) updateData.organizationName = organizationName;
    if (vehicleType !== undefined) updateData.vehicleType = vehicleType;
    if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
    if (points !== undefined) updateData.points = Number(points);
    if (role !== undefined) updateData.role = role;
    if (isProfileComplete !== undefined) updateData.isProfileComplete = isProfileComplete;

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
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

// GET /api/superadmin/food-posts — see ALL food posts across the entire platform
router.get('/food-posts', async (req, res) => {
  try {
    const posts = await FoodPost.find()
      .populate('donorId', 'name email phone profilePhoto address')
      .populate('adminId', 'name organizationName email phone')
      .populate('claimedByAdmin', 'name organizationName email phone')
      .populate('agentId', 'name phone profilePhoto vehicleType isAvailable')
      .populate('deliveryId', 'status adminLocation agentLocation createdAt')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/superadmin/food-posts/:id/status — superadmin override status or assign
router.put('/food-posts/:id/status', async (req, res) => {
  try {
    const { status, adminId, agentId } = req.body;
    const post = await FoodPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Food post not found' });

    if (status) {
      post.status = status;
      post.timestamps.push({ step: `SuperAdmin status updated to ${status}`, time: new Date() });
    }
    if (adminId) post.adminId = adminId;
    if (agentId) post.agentId = agentId;

    await post.save();

    const populated = await FoodPost.findById(post._id)
      .populate('donorId', 'name email phone')
      .populate('adminId', 'name organizationName email')
      .populate('claimedByAdmin', 'name organizationName email')
      .populate('agentId', 'name phone profilePhoto vehicleType');

    req.io.emit('food:statusChanged', { postId: post._id, status: post.status });
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/superadmin/food-posts/:id — delete fraudulent or invalid food post
router.delete('/food-posts/:id', async (req, res) => {
  try {
    const post = await FoodPost.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.deliveryId) {
      await Delivery.findByIdAndDelete(post.deliveryId);
    }
    req.io.emit('food:deleted', { postId: req.params.id });
    res.json({ message: 'Food post and associated delivery removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/superadmin/deliveries — see ALL deliveries platform-wide
router.get('/deliveries', async (req, res) => {
  try {
    const deliveries = await Delivery.find()
      .populate({
        path: 'foodPostId',
        select: 'foodName quantity type photo location status isBroadcast'
      })
      .populate('donorId', 'name email phone address')
      .populate('adminId', 'name organizationName email phone')
      .populate('agentId', 'name phone profilePhoto vehicleType isAvailable')
      .sort({ createdAt: -1 });
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/superadmin/activity-logs — aggregated recent platform events
router.get('/activity-logs', async (req, res) => {
  try {
    const [recentPosts, recentDeliveries, recentUsers] = await Promise.all([
      FoodPost.find().sort({ createdAt: -1 }).limit(10).populate('donorId', 'name').populate('claimedByAdmin', 'organizationName name').populate('adminId', 'organizationName name'),
      Delivery.find().sort({ createdAt: -1 }).limit(10).populate('agentId', 'name').populate('foodPostId', 'foodName'),
      User.find().sort({ createdAt: -1 }).limit(10).select('name role createdAt')
    ]);

    const logs = [];

    recentPosts.forEach(p => {
      logs.push({
        type: 'food_posted',
        title: `Food Posted: ${p.foodName}`,
        description: `Posted by ${p.donorId?.name || 'Donor'} (${p.quantity}) · ${p.isBroadcast ? 'Open Broadcast' : (p.claimedByAdmin?.organizationName || p.adminId?.organizationName || 'Specific NGO')}`,
        time: p.createdAt,
        badge: p.status
      });
    });

    recentDeliveries.forEach(d => {
      logs.push({
        type: 'delivery_event',
        title: `Delivery [${d.status}]: ${d.foodPostId?.foodName || 'Item'}`,
        description: `Assigned to Agent ${d.agentId?.name || 'Agent'}`,
        time: d.createdAt,
        badge: d.status
      });
    });

    recentUsers.forEach(u => {
      logs.push({
        type: 'user_registered',
        title: `New User: ${u.name}`,
        description: `Registered as ${u.role}`,
        time: u.createdAt,
        badge: u.role
      });
    });

    logs.sort((a, b) => new Date(b.time) - new Date(a.time));
    res.json(logs.slice(0, 30));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
