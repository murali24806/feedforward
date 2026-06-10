const express = require('express');
const router = express.Router();
const Delivery = require('../models/Delivery');
const FoodPost = require('../models/FoodPost');
const User = require('../models/User');
const { protect, requireRole } = require('../middleware/auth');

// GET /api/delivery/my — agent's deliveries (filtered: exclude removed by agent)
router.get('/my', protect, requireRole('agent'), async (req, res) => {
  try {
    const deliveries = await Delivery.find({
      agentId: req.user._id,
      removedBy: { $nin: ['agent'] }
    })
      .populate('foodPostId')
      .populate('donorId', 'name phone address profilePhoto')
      .sort({ createdAt: -1 });
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/delivery/all — admin sees all deliveries (filtered: exclude removed by admin)
router.get('/all', protect, requireRole('admin'), async (req, res) => {
  try {
    const deliveries = await Delivery.find({ removedBy: { $nin: ['admin'] } })
      .populate('foodPostId')
      .populate('donorId', 'name phone')
      .populate('agentId', 'name phone profilePhoto')
      .sort({ createdAt: -1 });
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/delivery/donor/my — donor sees their deliveries (filtered: exclude removed by donor)
router.get('/donor/my', protect, requireRole('donor'), async (req, res) => {
  try {
    const deliveries = await Delivery.find({
      donorId: req.user._id,
      removedBy: { $nin: ['donor'] }
    })
      .populate('foodPostId')
      .populate('agentId', 'name phone profilePhoto vehicleType')
      .sort({ createdAt: -1 });
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/delivery/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate('foodPostId')
      .populate('donorId', 'name phone address profilePhoto')
      .populate('agentId', 'name phone profilePhoto vehicleType');
    if (!delivery) return res.status(404).json({ message: 'Delivery not found' });
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/delivery/:id/reject — agent rejects an assigned delivery
router.put('/:id/reject', protect, requireRole('agent'), async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ message: 'Delivery not found' });
    if (delivery.agentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your delivery' });
    }
    if (delivery.status !== 'assigned') {
      return res.status(400).json({ message: 'Can only reject assigned deliveries' });
    }

    delivery.status = 'rejected_by_agent';
    delivery.statusHistory.push({ status: 'rejected_by_agent', time: new Date() });
    await delivery.save();

    // Reset food post to pending and unassign agent
    await FoodPost.findByIdAndUpdate(delivery.foodPostId, {
      status: 'pending',
      agentId: null,
      deliveryId: null,
      $push: { timestamps: { step: 'Agent Rejected – Reassignment Needed', time: new Date() } }
    });

    // Make agent available again
    await User.findByIdAndUpdate(req.user._id, { isAvailable: true });

    // Notify admin
    req.io.to('admin:room').emit('delivery:statusChanged', {
      deliveryId: delivery._id,
      status: 'rejected_by_agent'
    });

    res.json({ message: 'Delivery rejected', delivery });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/delivery/:id/status — agent updates delivery status
router.put('/:id/status', protect, requireRole('agent'), async (req, res) => {
  try {
    const { status } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ message: 'Delivery not found' });
    if (delivery.agentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your delivery' });
    }

    delivery.status = status;
    delivery.statusHistory.push({ status, time: new Date() });
    await delivery.save();

    // Map delivery status → food post status
    const statusMap = {
      accepted: 'agent_assigned',
      in_transit: 'agent_assigned',
      picked_up: 'picked_up',
      delivered: 'delivered'
    };
    const foodStatus = statusMap[status];
    const stepMap = {
      accepted: 'Agent Accepted',
      in_transit: 'Agent In Transit',
      picked_up: 'Pickup Completed',
      delivered: 'Delivered'
    };

    await FoodPost.findByIdAndUpdate(delivery.foodPostId, {
      status: foodStatus,
      $push: { timestamps: { step: stepMap[status], time: new Date() } }
    });

    // If delivered, make agent available again
    if (status === 'delivered') {
      await User.findByIdAndUpdate(req.user._id, { isAvailable: true });
    }

    // Notify via socket
    req.io.to(`delivery:${delivery._id}`).emit('delivery:statusChanged', {
      deliveryId: delivery._id,
      status,
      step: stepMap[status],
      time: new Date()
    });
    req.io.to('admin:room').emit('delivery:statusChanged', { deliveryId: delivery._id, status });

    res.json(delivery);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/delivery/:id/remove — soft-remove a completed/rejected delivery from a panel
router.delete('/:id/remove', protect, async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ message: 'Delivery not found' });

    const role = req.user.role;
    const completedStatuses = ['delivered', 'rejected_by_agent'];

    if (role === 'admin') {
      if (!completedStatuses.includes(delivery.status)) {
        return res.status(400).json({ message: 'Can only remove completed or rejected deliveries' });
      }
      if (!delivery.removedBy.includes('admin')) delivery.removedBy.push('admin');
    } else if (role === 'agent') {
      if (delivery.agentId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not your delivery' });
      }
      if (!completedStatuses.includes(delivery.status)) {
        return res.status(400).json({ message: 'Can only remove completed or rejected deliveries' });
      }
      if (!delivery.removedBy.includes('agent')) delivery.removedBy.push('agent');
    } else if (role === 'donor') {
      if (delivery.donorId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not your delivery' });
      }
      if (!completedStatuses.includes(delivery.status)) {
        return res.status(400).json({ message: 'Can only remove completed or rejected deliveries' });
      }
      if (!delivery.removedBy.includes('donor')) delivery.removedBy.push('donor');
    } else {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await delivery.save();
    res.json({ message: 'Delivery removed from your view' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
