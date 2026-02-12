#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>
#include <time.h>

// ----------------- WiFi Configuration -----------------
const char* ssid = "RCA";
const char* password = "@RcaNyabihu2023";
const uint32_t WIFI_TIMEOUT_MS = 30000;

// ----------------- MQTT Configuration -----------------
const char* mqtt_server = "broker.benax.rw";
const uint16_t MQTT_PORT = 1883;
const char* team_id = "iot_shield_2026";

// ----------------- MQTT Topics -----------------
String topic_status   = "rfid/" + String(team_id) + "/card/status";
String topic_balance  = "rfid/" + String(team_id) + "/card/balance";
String topic_topup    = "rfid/" + String(team_id) + "/card/topup";
String topic_health   = "rfid/" + String(team_id) + "/device/health";
String topic_lwt      = "rfid/" + String(team_id) + "/device/status";

// ----------------- Pin Mapping -----------------
#define RST_PIN D3
#define SS_PIN  D4

MFRC522 mfrc522(SS_PIN, RST_PIN);
WiFiClient espClient;
PubSubClient client(espClient);

// ----------------- Health Report -----------------
unsigned long last_health_report = 0;
const unsigned long HEALTH_INTERVAL = 60000; // 60 seconds

// ----------------- Time Functions -----------------
void sync_time() {
  Serial.print("Syncing time with NTP...");
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  time_t now = time(nullptr);
  while (now < 8 * 3600 * 2) { // wait until valid time
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.println("\nTime synchronized");
}

unsigned long get_unix_time() {
  return (unsigned long)time(nullptr);
}

// ----------------- WiFi Setup -----------------
void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  unsigned long start_attempt_ms = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start_attempt_ms > WIFI_TIMEOUT_MS) {
      Serial.println("\nWiFi connection timeout! Restarting...");
      ESP.restart();
    }
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

// ----------------- MQTT Callback -----------------
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");

  // Parse JSON payload
  StaticJsonDocument<256> doc;
  deserializeJson(doc, payload, length);

  const char* uid = doc["uid"];
  float amount = doc["amount"];

  // Simulate old balance
  float simulatedOldBalance = 50.0;
  float newBalance = simulatedOldBalance + amount;

  // Prepare response
  StaticJsonDocument<200> responseDoc;
  responseDoc["uid"] = uid;
  responseDoc["new_balance"] = newBalance;
  responseDoc["status"] = "success";
  responseDoc["ts"] = get_unix_time();

  char buffer[200];
  serializeJson(responseDoc, buffer);
  client.publish(topic_balance.c_str(), buffer);

  Serial.print("Updated balance for ");
  Serial.print(uid);
  Serial.print(": ");
  Serial.println(newBalance);
}

// ----------------- MQTT Reconnect -----------------
void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");

    String clientId = "ESP8266_Shield_" + String(ESP.getChipId(), HEX);

    if (client.connect(clientId.c_str(), topic_lwt.c_str(), 1, true, "offline")) {
      Serial.println("connected");

      // Publish online status
      client.publish(topic_lwt.c_str(), "online", true);

      // Subscribe to topics
      client.subscribe(topic_topup.c_str());
      client.subscribe(topic_health.c_str());
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

// ----------------- Health Reporting -----------------
void publish_health() {
  StaticJsonDocument<256> doc;
  doc["status"] = "online";
  doc["ip"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();
  doc["free_heap"] = ESP.getFreeHeap();
  doc["ts"] = get_unix_time();

  char buffer[256];
  serializeJson(doc, buffer);
  client.publish(topic_health.c_str(), buffer);
  Serial.println("Health report published");
}

// ----------------- Setup -----------------
void setup() {
  Serial.begin(115200);
  SPI.begin();
  mfrc522.PCD_Init();

  setup_wifi();
  sync_time();

  client.setServer(mqtt_server, MQTT_PORT);
  client.setCallback(callback);

  Serial.println("✓ System initialized successfully");
}

// ----------------- Main Loop -----------------
void loop() {
  // Ensure WiFi is connected
  if (WiFi.status() != WL_CONNECTED) {
    setup_wifi();
  }

  // Ensure MQTT is connected
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Periodic health report
  unsigned long now = millis();
  if (now - last_health_report > HEALTH_INTERVAL) {
    last_health_report = now;
    publish_health();
  }

  // ----------------- RFID Scanning -----------------
  if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
    // Build UID string
    String uid = "";
    for (byte i = 0; i < mfrc522.uid.size; i++) {
      if (mfrc522.uid.uidByte[i] < 0x10) uid += "0";
      uid += String(mfrc522.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();

    float currentBalance = 50.0; // Simulated balance

    Serial.print("Card Detected: ");
    Serial.print(uid);
    Serial.print(" | Balance: ");
    Serial.println(currentBalance);

    // Prepare JSON payload
    StaticJsonDocument<255> doc;
    doc["uid"] = uid;
    doc["balance"] = currentBalance;
    doc["status"] = "detected";
    doc["ts"] = get_unix_time();

    char buffer[255];
    serializeJson(doc, buffer);
    client.publish(topic_status.c_str(), buffer);

    // Properly halt and stop crypto
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();

    delay(2000); // Debounce
  }
}
