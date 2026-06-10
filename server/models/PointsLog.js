const mongoose = require('mongoose');

const pointsLogSchema = new mongoose.Schema({
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  points: { type: Number, required: true },
  reason: { type: String, required: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PointsLog', pointsLogSchema);
