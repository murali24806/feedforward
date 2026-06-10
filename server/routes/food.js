const express = require('express');
const router = express.Router();
const FoodPost = require('../models/FoodPost');
const Delivery = require('../models/Delivery');
const User = require('../models/User');
const { protect, requireRole } = require('../middleware/auth');
const { upload } = require('../utils/cloudinary');
const { sendFoodPostNotification, sendAgentAssignmentNotification } = require('../utils/mailer');

// POST /api/food/post — donor posts food
router.post('/post', protect, requireRole('donor'), upload.single('photo'), async (req, res) => {
  try {
    const { foodName, quantity, type, expiryTime, description, lat, lng, address, adminId } = req.body;
    if (!adminId) return res.status(400).json({ message: 'Admin/Organization selection is required' });

    const post = await FoodPost.create({
      donorId: req.user._id,
      adminId,
      foodName, quantity, type, expiryTime, description,
      photo: req.file ? req.file.path : '',
      location: { lat: parseFloat(lat), lng: parseFloat(lng), address },
      timestamps: [{ step: 'Food Posted', time: new Date() }]
    });

    // Notify specific admin via Socket.IO
    req.io.to(`admin:${adminId}`).emit('food:newPost', { post, donorName: req.user.name });
    // Also fallback emit to generic admin room if needed, but per requirements we only notify the specific one.

    // Email specific NGO admin
    // Email specific NGO admin
    try {
      const admin = await User.findById(adminId);
      if (admin) {
        sendFoodPostNotification({
          adminEmail: admin.email,
          donorName: req.user.name,
          foodName, quantity,
          locationAddress: address
        }).catch(e => console.log("Email blocked by Render:", e.message));
      }
    } catch (emailErr) {
      console.error('Email setup error:', emailErr.message);
    }

    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/food/all — admin sees all posts (filtered by their adminId)
router.get('/all', protect, requireRole('admin'), async (req, res) => {
  try {
    const posts = await FoodPost.find({ adminId: req.user._id }).populate('donorId', 'name email phone profilePhoto').populate('agentId', 'name phone profilePhoto').sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/food/my — donor sees own posts
router.get('/my', protect, requireRole('donor'), async (req, res) => {
  try {
    const posts = await FoodPost.find({ donorId: req.user._id }).populate('agentId', 'name phone profilePhoto').sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/food/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const post = await FoodPost.findById(req.params.id).populate('donorId', 'name email phone profilePhoto address').populate('agentId', 'name phone profilePhoto vehicleType');
    if (!post) return res.status(404).json({ message: 'Food post not found' });
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/food/:id/accept — admin accepts + assigns agent
router.put('/:id/accept', protect, requireRole('admin'), async (req, res) => {
  try {
    const { agentId, adminLocation } = req.body;
    const post = await FoodPost.findById(req.params.id).populate('donorId', 'name email');
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.status !== 'pending') return res.status(400).json({ message: 'Post already processed' });
    if (post.adminId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not assigned to you' });

    const agent = await User.findById(agentId);
    if (!agent || agent.role !== 'agent') return res.status(400).json({ message: 'Invalid agent' });

    // Create delivery
    const delivery = await Delivery.create({
      foodPostId: post._id,
      donorId: post.donorId._id,
      adminId: req.user._id,
      agentId,
      adminLocation,
      statusHistory: [{ status: 'assigned', time: new Date() }]
    });

    // Update food post
    post.status = 'agent_assigned';
    post.agentId = agentId;
    post.deliveryId = delivery._id;
    post.timestamps.push({ step: 'NGO Admin Accepted', time: new Date() });
    post.timestamps.push({ step: 'Agent Assigned', time: new Date() });
    await post.save();

    // Update agent availability
    await User.findByIdAndUpdate(agentId, { isAvailable: false });

    // Email agent
    try {
      sendAgentAssignmentNotification({
        agentEmail: agent.email,
        agentName: agent.name,
        donorName: post.donorId.name,
        foodName: post.foodName,
        address: post.location?.address,
        pickupTime: post.createdAt
      }).catch(e => console.log("Email blocked by Render:", e.message));
    } catch (emailErr) {
      console.error('Email setup error:', emailErr.message);
    }

    // Notify via socket
    req.io.to(`delivery:${delivery._id}`).emit('delivery:statusChanged', { deliveryId: delivery._id, status: 'agent_assigned', step: 'Agent Assigned & Accepted' });

    const populatedPost = await FoodPost.findById(post._id).populate('donorId', 'name email phone').populate('agentId', 'name phone profilePhoto vehicleType');
    res.json({ post: populatedPost, delivery });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/food/:id/reject
router.put('/:id/reject', protect, requireRole('admin'), async (req, res) => {
  try {
    const post = await FoodPost.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true });
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
