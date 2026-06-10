const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  phone: { type: String, trim: true },
  role: { type: String, enum: ['donor', 'admin', 'agent'], required: true },
  profilePhoto: { type: String, default: '' },
  address: { type: String, default: '' },
  bio: { type: String, default: '' },
  points: { type: Number, default: 0 },
  vehicleType: { type: String, default: '' }, // for agents
  isAvailable: { type: Boolean, default: true }, // for agents
  createdAt: { type: Date, default: Date.now }
});

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
