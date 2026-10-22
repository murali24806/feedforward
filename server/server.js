const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const mongoose   = require('mongoose');
const cors       = require('cors');
const dotenv     = require('dotenv');

dotenv.config();

const app    = express();
const server = http.createServer(app);
const corsOptions = {
  origin: (origin, callback) => {
    // Allow all requests from any Vercel domain, localhost, or configured CLIENT_URL
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(null, true),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => { req.io = io; next(); });

app.get('/', (req, res) => res.json({ 
  status: 'FeedForward server running OK', 
  message: 'FeedForward Backend API is active and ready',
  health: '/api/health' 
}));

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/food',     require('./routes/food'));
app.use('/api/delivery', require('./routes/delivery'));
app.use('/api/points',   require('./routes/points'));
app.use('/api/superadmin', require('./routes/superadmin'));
app.use('/api/citizen-requests', require('./routes/citizenRequests'));

app.get('/api/health', (req, res) => res.json({ status: 'FeedForward server running OK' }));

// Load model at top level — avoids MODULE_NOT_FOUND inside callbacks
const Delivery = require('./models/Delivery');

const activeAgents = {}; // agentId → { lat, lng, deliveryId, socketId }

io.on('connection', (socket) => {
  console.log('Socket connected: ' + socket.id);

  // ── Agent sends live GPS ──────────────────────────────────────────────────
  socket.on('agent:locationUpdate', async ({ agentId, lat, lng, deliveryId }) => {
    if (!agentId || lat == null || lng == null || isNaN(Number(lat)) || isNaN(Number(lng))) return;

    const numLat = Number(lat);
    const numLng = Number(lng);

    activeAgents[agentId] = { lat: numLat, lng: numLng, deliveryId, socketId: socket.id };

    // Broadcast to donor watching this delivery
    if (deliveryId) {
      io.to('delivery:' + deliveryId).emit('agent:locationUpdate', {
        agentId, lat: numLat, lng: numLng, deliveryId,
      });
    }

    // Broadcast to admin room — always include deliveryId so admin map can link agent to route
    io.to('admin:room').emit('agent:locationUpdate', {
      agentId, lat: numLat, lng: numLng, deliveryId,
    });
    // Broadcast to superadmin room for global fleet radar
    io.to('superadmin:room').emit('agent:locationUpdate', {
      agentId, lat: numLat, lng: numLng, deliveryId,
    });

    // Persist to DB (non-blocking)
    if (deliveryId) {
      Delivery.findByIdAndUpdate(deliveryId, {
        agentLocation: { lat: numLat, lng: numLng },
      }).catch(() => {});
    }
  });

  // ── Donor / agent / admin joins a delivery-specific room ──────────────────
  const joinDelRoom = (deliveryId) => {
    if (deliveryId) socket.join('delivery:' + deliveryId);
  };
  const leaveDelRoom = (deliveryId) => {
    if (deliveryId) socket.leave('delivery:' + deliveryId);
  };
  socket.on('joinDelivery', joinDelRoom);
  socket.on('join:delivery', joinDelRoom);
  socket.on('leaveDelivery', leaveDelRoom);
  socket.on('leave:delivery', leaveDelRoom);

  // ── Admin joins overview room ─────────────────────────────────────────────
  socket.on('joinAdminRoom', () => {
    socket.join('admin:room');
    // Send current active agents to the newly joined admin immediately
    socket.emit('admin:activeAgents', activeAgents);
  });

  // ── SuperAdmin joins global command room ──────────────────────────────────
  socket.on('joinSuperAdminRoom', () => {
    socket.join('superadmin:room');
    socket.emit('admin:activeAgents', activeAgents);
  });

  // ── Status change ─────────────────────────────────────────────────────────
  socket.on('delivery:statusChanged', (data) => {
    if (data.deliveryId) {
      io.to('delivery:' + data.deliveryId).emit('delivery:statusChanged', data);
    }
    io.to('admin:room').emit('delivery:statusChanged', data);
    io.to('superadmin:room').emit('delivery:statusChanged', data);
  });

  socket.on('disconnect', () => {
    for (const agentId in activeAgents) {
      if (activeAgents[agentId].socketId === socket.id) {
        delete activeAgents[agentId];
      }
    }
    console.log('Socket disconnected: ' + socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`FeedForward server on port ${PORT}`);
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((err) => {
    console.error('MongoDB error: ' + err.message);
    console.warn('⚠️ Warning: MongoDB failed to connect. Check credentials in server/.env');
  });

module.exports = { io };
