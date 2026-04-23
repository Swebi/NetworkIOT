# NetworkIoT — BLE Occupancy Monitor

Real-time occupancy monitoring using BLE scanning. A Raspberry Pi (and optionally ESP32s) detects nearby devices and reports counts to a web dashboard with per-zone alerts sent to your phone.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Network                                            │
│                                                     │
│  ┌──────────┐   POST /api/scanner/esp1/report       │
│  │  ESP32   │ ──────────────────────────────┐       │
│  └──────────┘                               ▼       │
│                                    ┌──────────────┐ │
│  ┌──────────┐   local BLE scan     │  Raspberry   │ │
│  │  ESP32   │ ──────────────────▶  │  Pi (server) │ │
│  └──────────┘                      └──────┬───────┘ │
│                                           │         │
└───────────────────────────────────────────┼─────────┘
                                            │
                          ┌─────────────────┼──────────────┐
                          │                 ▼              │
                          │   ┌──────────────────────┐     │
                          │   │  React dashboard     │     │
                          │   │  http://<pi-ip>:5173 │     │
                          │   └──────────────────────┘     │
                          │                                │
                          │   ┌──────────────────────┐     │
                          │   │  ntfy.sh push alert  │     │
                          │   │  → your phone        │     │
                          │   └──────────────────────┘     │
                          └────────────────────────────────┘
```

Each zone is assigned a scanner ID. When that scanner's active device count exceeds the zone's threshold, a push notification fires via ntfy.sh.

---

## Raspberry Pi Setup

### 1. System dependencies

```bash
sudo apt update
sudo apt install -y python3-pip python3-venv libbluetooth-dev
```

### 2. Python environment

```bash
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Run the API server

```bash
source venv/bin/activate
uvicorn api:app --host 0.0.0.0 --port 8000
```

The terminal will print the Pi's IP and the `VITE_API_URL` value to use in the next step.

### 4. Run the frontend

```bash
cd client
echo "VITE_API_URL=http://<pi-ip>:8000" > .env
npm install
npm run dev -- --host
```

Open `http://<pi-ip>:5173` in a browser on any device on the same network.

### Bluetooth permissions

If the scanner fails to start:

```bash
sudo usermod -aG bluetooth $USER
# then log out and back in, or:
sudo bluetoothctl power on
```

---

## ESP32 Setup

Each ESP32 scans BLE independently and reports to the Pi over HTTP. You can add as many as you need — one per zone.

### Hardware required

- Any ESP32 board (ESP32-WROOM, ESP32-S3, etc.)
- USB cable for flashing
- Power supply (USB or 5 V) for deployment

### Arduino IDE setup

1. Install [Arduino IDE 2](https://www.arduino.cc/en/software)
2. **Add ESP32 board support**
   - Preferences → Additional boards manager URLs → add:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Tools → Board → Boards Manager → search **esp32 by Espressif** → Install
3. **Install ArduinoJson library**
   - Sketch → Include Library → Manage Libraries → search **ArduinoJson** → Install

### Sketch

Create a new sketch and paste this code:

```cpp
#include <BLEDevice.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ── Config — change these ────────────────────────────────────────────────────
const char* WIFI_SSID     = "your_ssid";
const char* WIFI_PASSWORD = "your_password";
const char* PI_HOST       = "http://192.168.x.x:8000";  // Pi's IP
const char* SCANNER_ID    = "esp1";                      // must match zone's Scanner ID

const int SCAN_SECONDS = 5;
const int PAUSE_MS     = 7000;
// ─────────────────────────────────────────────────────────────────────────────

BLEScan* pBLEScan;

struct DeviceInfo { String mac, name; int rssi; };
std::vector<DeviceInfo> discovered;

class ScanCallback : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice device) {
    discovered.push_back({
      device.getAddress().toString().c_str(),
      device.haveName() ? device.getName().c_str() : "Unknown",
      device.getRSSI()
    });
  }
};

void setup() {
  Serial.begin(115200);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nConnected: " + WiFi.localIP().toString());

  BLEDevice::init("");
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new ScanCallback());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);
}

void loop() {
  discovered.clear();
  pBLEScan->start(SCAN_SECONDS, false);
  pBLEScan->clearResults();
  Serial.printf("[BLE] Found %d devices\n", discovered.size());

  // Build JSON body
  DynamicJsonDocument doc(8192);
  JsonObject devices = doc.createNestedObject("devices");
  for (auto& d : discovered) {
    JsonObject dev = devices.createNestedObject(d.mac);
    dev["name"] = d.name;
    dev["rssi"] = d.rssi;
  }
  String body;
  serializeJson(doc, body);

  // POST to Pi
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = String(PI_HOST) + "/api/scanner/" + SCANNER_ID + "/report";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(body);
    Serial.printf("[HTTP] %s -> %d\n", url.c_str(), code);
    http.end();
  } else {
    Serial.println("[WiFi] Disconnected, reconnecting...");
    WiFi.reconnect();
  }

  delay(PAUSE_MS);
}
```

### Flash steps

1. Fill in the 4 config constants at the top of the sketch
2. Tools → Board → **ESP32 Dev Module** (or your specific model)
3. Tools → Port → select the COM/tty port for your ESP32
4. Click **Upload**
5. Open Serial Monitor (115200 baud) to confirm WiFi connection and HTTP responses

### Assign the ESP to a zone

In the dashboard → Zones → click the pencil icon on a zone → set **Scanner ID** to match the `SCANNER_ID` in your sketch (e.g. `esp1`).

---

## Phone alerts (ntfy.sh)

Alerts fire when a zone's active device count exceeds its threshold.

### Setup

1. Install the **ntfy** app — [iOS](https://apps.apple.com/app/ntfy/id1625396347) / [Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy)
2. Subscribe to a topic of your choice (e.g. `networkiot-yourname-42`)
3. In the dashboard → Settings → Alerts:
   - Paste your topic into **ntfy topic**
   - Set **alert cooldown** (minimum minutes between repeated alerts per zone)
   - Set **this device's scanner ID** (default `pi`)
4. In Zones, set a **threshold** on each zone via the pencil icon

### Per-zone thresholds

| Zone | Scanner ID | Threshold | Behaviour |
|------|-----------|-----------|-----------|
| Entrance | `pi` | 20 | Alerts when Pi detects > 20 devices |
| Lab | `esp1` | 5 | Alerts when ESP1 detects > 5 devices |
| Storage | `esp2` | 2 | Alerts when ESP2 detects > 2 devices |

---

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/live` | Current occupancy, devices, history, per-zone counts |
| GET | `/api/zones` | All zones with config |
| POST | `/api/zones` | Create zone `{name, color, coordinates, scanner_id, threshold}` |
| PUT | `/api/zones/{id}` | Update zone fields |
| DELETE | `/api/zones/{id}` | Delete zone |
| GET | `/api/settings` | Current settings |
| POST | `/api/settings` | Update `{rssi_threshold, ntfy_topic, alert_cooldown_minutes, scanner_id}` |
| POST | `/api/scanner/{id}/report` | ESP scan report `{"devices": {"MAC": {"name": "...", "rssi": -65}}}` |

---

## Data files

| File | Description |
|------|-------------|
| `server/occupancy_data.json` | Pi BLE scan history and tracked devices |
| `server/scanner_{id}_data.json` | Per-ESP scan history (created automatically) |
| `server/zones.json` | Zone polygons, map config, thresholds |
| `server/settings.json` | RSSI filter, ntfy config, scanner ID |

---

## Notes

- BLE range is typically 10–30 m indoors; place scanners accordingly
- Modern phones randomize MAC addresses every few minutes — counts are estimates of unique BLE radios, not exact people
- The Pi counts all devices it can hear; ESP32s do the same for their coverage area
- Stable MACs expire after 15 min of absence; random MACs expire after 2 min
