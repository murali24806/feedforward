require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const seedSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected.');

    const existingSuperAdmin = await User.findOne({ role: 'superadmin' });
    if (existingSuperAdmin) {
      console.log('Superadmin already exists!');
      process.exit(0);
    }

    const superAdmin = await User.create({
      name: 'Main Super Admin',
      email: 'superadmin@feedforward.com',
      password: 'superadmin123', // Please change this after first login
      role: 'superadmin',
    });

    console.log('Superadmin created successfully:');
    console.log('Email:', superAdmin.email);
    console.log('Password: superadmin123');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding superadmin:', err.message);
    process.exit(1);
  }
};

seedSuperAdmin();
