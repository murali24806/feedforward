const mongoose = require('mongoose');

const citizenRequestSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  mealsNeeded: { type: Number, required: true, min: 1, default: 1 },
  dietaryType: { type: String, enum: ['veg', 'non-veg', 'any'], default: 'any' },
  needType: { type: String, default: 'Individual' }, // Individual, Family, Senior Citizen, Student, Shelter
  notes: { type: String, default: '' },
  location: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    address: { type: String, default: '' },
    city: { type: String, default: '' }
  },
  pin: { type: String, required: true }, // 4-digit pickup / verification code
  status: {
    type: String,
    enum: ['pending', 'approved', 'fulfilled', 'rejected'],
    default: 'pending'
  },
  matchedFoodPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodPost', default: null },
  matchedAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CitizenRequest', citizenRequestSchema);
