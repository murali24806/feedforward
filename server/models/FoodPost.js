const mongoose = require('mongoose');

const foodPostSchema = new mongoose.Schema({
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  foodName: { type: String, required: true },
  quantity: { type: String, required: true },
  type: { type: String, enum: ['veg', 'non-veg'], required: true },
  expiryTime: { type: Date, required: true },
  description: { type: String, default: '' },
  photo: { type: String, default: '' },
  location: {
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String }
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'agent_assigned', 'picked_up', 'delivered', 'rejected'],
    default: 'pending'
  },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  deliveryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery', default: null },
  timestamps: [{ step: String, time: Date }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FoodPost', foodPostSchema);
