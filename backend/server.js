const express = require('express');
const mqtt = require('mqtt');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

// -------------------------------
// Config
// -------------------------------
const PORT = process.env.PORT || 9264;
const TEAM_ID = "iot_shield_2026";
const MQTT_BROKER = "mqtt://157.173.101.159:1883";

// MQTT Topics
const TOPIC_STATUS = `rfid/${TEAM_ID}/card/status`;
const TOPIC_BALANCE = `rfid/${TEAM_ID}/card/balance`;
const TOPIC_TOPUP = `rfid/${TEAM_ID}/card/topup`;

// Card balance tracker (in-memory storage)
const cardBalances = {};

// -------------------------------
// Serve frontend
// -------------------------------
const frontendPath = path.resolve(__dirname, '../frontend');
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// -------------------------------
// MQTT setup
// -------------------------------
const mqttClient = mqtt.connect(MQTT_BROKER);

mqttClient.on('connect', () => {
  console.log('Connected to MQTT Broker');
  mqttClient.subscribe([TOPIC_STATUS, TOPIC_BALANCE, TOPIC_TOPUP], (err) => {
    if (!err) console.log('Subscribed to MQTT topics');
  });
});

mqttClient.on('message', (topic, message) => {
  let data;
  try {
    data = JSON.parse(message.toString());
  } catch (e) {
    console.error('Invalid MQTT message:', message.toString());
    return;
  }

  if (topic === TOPIC_STATUS) {
    // When a card is scanned, emit the status but DON'T override cardBalances
    // The frontend will send the current balance in the topup request
    io.emit('card-status', data);
    console.log('Card status:', data);
  }

  if (topic === TOPIC_BALANCE) {
    // Emit balance updates for display purposes only
    // Don't override cardBalances - trust the frontend's currentBalance instead
    io.emit('card-balance', data);
    console.log('Card balance update from device:', data);
  }
});

// -------------------------------
// Socket.IO
// -------------------------------
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
});

// -------------------------------
// Top-up API
// -------------------------------
app.post('/topup', (req, res) => {
  const { uid, amount, currentBalance } = req.body;

  if (!uid || !amount || amount <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid UID or amount' });
  }

  // ALWAYS trust currentBalance from frontend - it's the source of truth from localStorage
  // The frontend has the most up-to-date balance
  if (currentBalance === undefined || currentBalance === null) {
    return res.status(400).json({ success: false, error: 'Current balance not provided' });
  }

  const newBalance = currentBalance + amount;

  // Update server's balance tracker for potential fallback
  cardBalances[uid] = newBalance;

  console.log(`Top-up: UID=${uid}, Current=${currentBalance}, Amount=${amount}, New Balance=${newBalance}`);

  // Emit topup-success event to all connected clients with the confirmed new balance
  io.emit('topup-success', { uid, amount, newBalance });

  // Publish topup with the calculated new balance
  mqttClient.publish(TOPIC_TOPUP, JSON.stringify({ uid, amount, newBalance }), (err) => {
    if (err) {
      console.error('Failed to publish topup:', err);
      return res.status(500).json({ success: false, error: 'MQTT publish failed' });
    }
    console.log(`Top-up published: UID=${uid}, Amount=${amount}, New Balance=${newBalance}`);
    res.json({ success: true, uid, amount, newBalance });
  });
});

// -------------------------------
// Start server
// -------------------------------
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend + Frontend running on http://localhost:${PORT}`);
});
