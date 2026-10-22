const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

let serviceAccount = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:', err.message);
  }
}

if (!serviceAccount) {
  try {
    serviceAccount = require('./serviceAccountKey.json');
  } catch (err) {
    console.warn('⚠️ serviceAccountKey.json not found. Set FIREBASE_SERVICE_ACCOUNT environment variable for Firebase Admin verification in production.');
  }
}

let app = null;
if (serviceAccount && getApps().length === 0) {
  try {
    app = initializeApp({
      credential: cert(serviceAccount)
    });
  } catch (err) {
    console.error('Firebase Admin init error:', err.message);
  }
} else if (getApps().length > 0) {
  app = getApps()[0];
}

module.exports = {
  auth: () => {
    if (!app) {
      throw new Error('Firebase Admin SDK is not initialized. Please configure FIREBASE_SERVICE_ACCOUNT.');
    }
    return getAuth(app);
  }
};
