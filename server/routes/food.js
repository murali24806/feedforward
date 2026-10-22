const express = require('express');
const router = express.Router();
const FoodPost = require('../models/FoodPost');
const Delivery = require('../models/Delivery');
const User = require('../models/User');
const { protect, requireRole } = require('../middleware/auth');
const { upload } = require('../utils/cloudinary');
const {
  sendFoodPostNotification,
  sendAgentAssignmentNotification,
  sendFoodPostAlertToSuperAdmin,
  sendBroadcastFoodPostNotification
} = require('../utils/mailer');

// POST /api/food/post — donor posts food
router.post('/post', protect, requireRole('donor'), upload.single('photo'), async (req, res) => {
  try {
    const { foodName, quantity, type, expiryTime, description, lat, lng, address, adminId } = req.body;
    
    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: 'A photo of the food donation is mandatory. Please upload an image.' });
    }

    const isBroadcast = req.body.isBroadcast === 'true' || req.body.isBroadcast === true || adminId === 'all' || !adminId;
    const targetAdminId = isBroadcast ? null : adminId;

    const post = await FoodPost.create({
      donorId: req.user._id,
      adminId: targetAdminId,
      isBroadcast,
      foodName,
      quantity,
      type,
      expiryTime,
      description,
      photo: req.file ? req.file.path : '',
      location: { lat: parseFloat(lat), lng: parseFloat(lng), address },
      timestamps: [{ step: 'Food Posted', time: new Date() }]
    });

    const populatedPost = await FoodPost.findById(post._id)
      .populate('donorId', 'name email phone profilePhoto address')
      .populate('adminId', 'name organizationName email');

    // ── Real-Time Socket.IO Notifications ─────────────────────────
    // 1. Notify Super Admin room
    req.io.to('superadmin:room').emit('food:newPost', {
      post: populatedPost,
      donorName: req.user.name,
      isBroadcast,
      targetName: isBroadcast ? 'Open to All NGOs' : (populatedPost.adminId?.organizationName || populatedPost.adminId?.name)
    });
    req.io.emit('superadmin:activity', {
      type: 'food_posted',
      title: 'New Food Donation',
      message: `${req.user.name} posted "${foodName}" (${quantity}) — ${isBroadcast ? 'Open to All NGOs' : 'Specific NGO'}`,
      time: new Date(),
      postId: post._id
    });

    // 2. Notify NGO Admins
    if (isBroadcast) {
      // Broadcast to ALL connected NGO admins
      req.io.to('admin:room').emit('food:newPost', {
        post: populatedPost,
        donorName: req.user.name,
        isBroadcast: true
      });
    } else if (targetAdminId) {
      req.io.to(`admin:${targetAdminId}`).emit('food:newPost', {
        post: populatedPost,
        donorName: req.user.name,
        isBroadcast: false
      });
      req.io.to('admin:room').emit('food:newPost', {
        post: populatedPost,
        donorName: req.user.name,
        isBroadcast: false,
        targetAdminId
      });
    }

    // ── Email Notifications (Background Non-Blocking) ─────────────
    (async () => {
      try {
        // Always notify Super Admin(s)
        const superAdmins = await User.find({ role: 'superadmin' });
        for (const sa of superAdmins) {
          sendFoodPostAlertToSuperAdmin({
            superAdminEmail: sa.email,
            donorName: req.user.name,
            foodName,
            quantity,
            targetName: isBroadcast ? 'Open to All NGOs' : (populatedPost.adminId?.organizationName || populatedPost.adminId?.name),
            locationAddress: address
          }).catch(e => console.log('Superadmin email error:', e.message));
        }

        // Notify NGO(s)
        if (isBroadcast) {
          const allNgos = await User.find({ role: 'admin' });
          for (const ngo of allNgos) {
            sendBroadcastFoodPostNotification({
              adminEmail: ngo.email,
              donorName: req.user.name,
              foodName,
              quantity,
              locationAddress: address
            }).catch(e => console.log('NGO broadcast email error:', e.message));
          }
        } else if (targetAdminId) {
          const specificAdmin = await User.findById(targetAdminId);
          if (specificAdmin) {
            sendFoodPostNotification({
              adminEmail: specificAdmin.email,
              donorName: req.user.name,
              foodName,
              quantity,
              locationAddress: address
            }).catch(e => console.log('NGO specific email error:', e.message));
          }
        }
      } catch (emailErr) {
        console.error('Email notification background error:', emailErr.message);
      }
    })();

    res.status(201).json(populatedPost);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/food/all — admin sees assigned posts AND open broadcast posts
router.get('/all', protect, requireRole('admin'), async (req, res) => {
  try {
    const posts = await FoodPost.find({
      $or: [
        { adminId: req.user._id },
        { isBroadcast: true }
      ]
    })
      .populate('donorId', 'name email phone profilePhoto address')
      .populate('agentId', 'name phone profilePhoto vehicleType')
      .populate('adminId', 'name organizationName email phone')
      .populate('claimedByAdmin', 'name organizationName email phone')
      .populate('deliveryId')
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/food/my — donor sees own posts
router.get('/my', protect, requireRole('donor'), async (req, res) => {
  try {
    const posts = await FoodPost.find({ donorId: req.user._id })
      .populate('agentId', 'name phone profilePhoto vehicleType')
      .populate('adminId', 'name organizationName email phone')
      .populate('claimedByAdmin', 'name organizationName email phone')
      .populate('deliveryId')
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/food/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const post = await FoodPost.findById(req.params.id)
      .populate('donorId', 'name email phone profilePhoto address')
      .populate('agentId', 'name phone profilePhoto vehicleType')
      .populate('adminId', 'name organizationName email phone')
      .populate('claimedByAdmin', 'name organizationName email phone')
      .populate('deliveryId');

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
    if (post.status !== 'pending') return res.status(400).json({ message: 'This donation has already been accepted or processed' });

    // If specific donation, only assigned admin can accept
    if (!post.isBroadcast && post.adminId && post.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'This donation was directed to another organization' });
    }

    const agent = await User.findById(agentId);
    if (!agent || agent.role !== 'agent') return res.status(400).json({ message: 'Invalid agent' });

    // Set claiming admin and adminId
    post.adminId = req.user._id;
    post.claimedByAdmin = req.user._id;
    post.claimedAt = new Date();

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
    const adminOrgName = req.user.organizationName || req.user.name;
    post.timestamps.push({ step: `Accepted by ${adminOrgName}`, time: new Date() });
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
      }).catch(e => console.log('Email blocked by Render:', e.message));
    } catch (emailErr) {
      console.error('Email setup error:', emailErr.message);
    }

    const populatedPost = await FoodPost.findById(post._id)
      .populate('donorId', 'name email phone profilePhoto')
      .populate('agentId', 'name phone profilePhoto vehicleType')
      .populate('adminId', 'name organizationName email')
      .populate('claimedByAdmin', 'name organizationName email');

    // Notify delivery room
    req.io.to(`delivery:${delivery._id}`).emit('delivery:statusChanged', {
      deliveryId: delivery._id,
      status: 'agent_assigned',
      step: `Accepted by ${adminOrgName} & Agent Assigned`
    });

    // Broadcast claim to ALL admins so other NGOs see it's claimed in real-time
    req.io.emit('food:claimed', {
      postId: post._id,
      claimedByAdmin: {
        _id: req.user._id,
        name: req.user.name,
        organizationName: adminOrgName
      },
      status: 'agent_assigned',
      post: populatedPost
    });

    // Notify Super Admin
    req.io.to('superadmin:room').emit('superadmin:activity', {
      type: 'food_accepted',
      title: 'Donation Accepted',
      message: `${adminOrgName} accepted donation "${post.foodName}" and dispatched ${agent.name}`,
      time: new Date(),
      post: populatedPost
    });

    res.json({ post: populatedPost, delivery });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/food/:id/reject
router.put('/:id/reject', protect, requireRole('admin'), async (req, res) => {
  try {
    const post = await FoodPost.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true });
    req.io.emit('food:statusChanged', { postId: req.params.id, status: 'rejected' });
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
