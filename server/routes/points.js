const express = require('express');
const router = express.Router();
const PointsLog = require('../models/PointsLog');
const User = require('../models/User');
const { protect, requireRole } = require('../middleware/auth');

// POST /api/points/assign — admin assigns points to donor
router.post('/assign', protect, requireRole('admin'), async (req, res) => {
  try {
    const { donorId, points, reason } = req.body;
    const donor = await User.findById(donorId);
    if (!donor || donor.role !== 'donor') return res.status(404).json({ message: 'Donor not found' });

    donor.points += parseInt(points);
    await donor.save();

    await PointsLog.create({ donorId, points: parseInt(points), reason, assignedBy: req.user._id });

    res.json({ message: 'Points assigned', totalPoints: donor.points });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/points/my — donor's own points log
router.get('/my', protect, requireRole('donor'), async (req, res) => {
  try {
    const logs = await PointsLog.find({ donorId: req.user._id }).sort({ date: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/points/:donorId — admin views donor's points log
router.get('/:donorId', protect, requireRole('admin'), async (req, res) => {
  try {
    const logs = await PointsLog.find({ donorId: req.params.donorId }).sort({ date: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
