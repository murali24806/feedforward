const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  foodPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodPost', required: true },
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminLocation: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    address: { type: String, default: '' }
  },
  status: {
    type: String,
    enum: ['assigned', 'accepted', 'in_transit', 'picked_up', 'delivered', 'rejected_by_agent'],
    default: 'assigned'
  },
  removedBy: [{ type: String }], // tracks which roles have removed this delivery from their view
  agentLocation: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  statusHistory: [{ status: String, time: { type: Date, default: Date.now } }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Delivery', deliverySchema);
