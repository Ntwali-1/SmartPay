const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://157.173.101.159:1883');

const TEAM_ID = "iot_shield_2026";
const TOPIC_STATUS = `rfid/${TEAM_ID}/card/status`;

client.on('connect', () => {
  console.log('Simulator connected');
  const payload = JSON.stringify({
    uid: "A1B2C3D4",
    balance: 75.25,
    status: "detected",
    timestamp: Date.now()
  });
  client.publish(TOPIC_STATUS, payload, () => {
    console.log('Simulated card detection sent');
    client.end();
  });
});
