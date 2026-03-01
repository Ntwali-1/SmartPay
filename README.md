# SmartPay System

A complete RFID-based payment system with real-time card management, transaction tracking, and a modern dashboard interface.

## Live Demo

** Access the live application: ** [http://157.173.101.159:9264](http://157.173.101.159:9264)

## Features

- Real-time RFID card detection via MQTT
- Complete transaction history
- Modern glass-morphism dashboard
- System status monitoring
- Live statistics and analytics

## MQTT Topics

- `rfid/team_rdf/card/status`: ESP8266 publishes card UID and balance when detected
- `rfid/team_rdf/card/topup`: Backend publishes top-up commands
- `rfid/team_rdf/card/balance`: ESP8266 publishes confirmation of balance update
- `rfid/team_rdf/device/status`: MQTT Last Will (online/offline)
- `rfid/team_rdf/device/health`: Periodic health metrics (IP, RSSI, Memory)

## 🛠️ Hardware Setup (ESP8266 + RC522)

| RC522 Pin | ESP8266 Pin (NodeMCU) | Function  |
| --------- | --------------------- | --------- |
| 3.3V      | 3V3                   | Power     |
| RST       | D3 (GPIO0)            | Reset     |
| GND       | GND                   | Ground    |
| MISO      | D6 (GPIO12)           | SPI MISO  |
| MOSI      | D7 (GPIO13)           | SPI MOSI  |
| SCK       | D5 (GPIO14)           | SPI Clock |
| SDA (SS)  | D4 (GPIO2)            | SPI SS    |

## 🛠️ Technology Stack

- **Backend**: Node.js, Express, Socket.IO, Mongoose, MQTT
- **Frontend**: HTML5, CSS3, JavaScript, Socket.IO Client
- **Hardware**: ESP8266, MFRC522 RFID Reader
- **Process Manager**: PM2 (production)

```
## 📄 License

MIT


