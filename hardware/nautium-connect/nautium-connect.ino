/*
 * Nautium Connect  -  NMEA 2000 → Nautium Cloud Gateway
 * ======================================================
 * Runs on: ESP32 + MCP2515 CAN module + SD Card (SPI)
 *
 * Reads real NMEA 2000 PGN data from the boat's backbone and:
 *   1. Sends it to Nautium Cloud (ingest-telemetry) via WiFi/HTTPS
 *   2. Serves a local dashboard at 192.168.4.1 (works offline)
 *   3. Logs all data to SD card for offline storage & sync
 *   4. Provides a captive portal for first-time WiFi setup
 *
 * Wiring (ESP32 -> MCP2515+TJA1050 CAN module):
 *   GPIO 5  -> CS
 *   GPIO 18 -> SCK   (shared with SD card)
 *   GPIO 23 -> MOSI  (shared with SD card)
 *   GPIO 19 -> MISO  (shared with SD card)
 *   GPIO 2  -> INT
 *   3.3V    -> VCC
 *   GND     -> GND
 *
 * Wiring (ESP32 -> SD Card module):
 *   GPIO 15 -> CS
 *   GPIO 18 -> SCK   (shared with MCP2515)
 *   GPIO 23 -> MOSI  (shared with MCP2515)
 *   GPIO 19 -> MISO  (shared with MCP2515)
 *   3.3V    -> VCC
 *   GND     -> GND
 *
 * MCP2515 CAN input from NMEA 2000 backbone:
 *   CAN_H <- Micro-C pin 5 (blue)
 *   CAN_L <- Micro-C pin 4 (white)
 *
 * Power (12V/24V boat DC via LM2596 buck converter):
 *   Boat 12/24V → [Fusible 1A] → LM2596 IN+
 *   Boat GND    → LM2596 IN-
 *   LM2596 OUT+ → ESP32 VIN (5V)
 *   LM2596 OUT- → ESP32 GND
 *
 * Status LEDs (active HIGH, each with 220 ohm resistor):
 *   GPIO 12 -> LED green  (PWR  - power on)
 *   GPIO 13 -> LED cyan   (WiFi - connected to boat network)
 *   GPIO 14 -> LED purple (DATA - sending/logging data)
 *
 * Libraries needed (install via Arduino Library Manager):
 *   - NMEA2000 by Timo Lappalainen
 *   - NMEA2000_mcp by Timo Lappalainen
 *   - ArduinoJson v7 by Benoit Blanchon
 *   - SD (built-in)
 *   - WiFi (built-in)
 *   - WebServer (built-in)
 *   - HTTPClient (built-in)
 *   - Preferences (built-in)
 *
 * Version: 1.0.0
 */

#include <Arduino.h>
#include <SPI.h>
#include <SD.h>
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <N2kMsg.h>
#include <NMEA2000.h>
#include <NMEA2000_mcp.h>
#include <N2kMessages.h>
#include <N2kMessagesEnumToStr.h>
#include <ArduinoJson.h>
#include <math.h>
#include <time.h>

// ── Version ──
#define FW_VERSION "1.0.0"

// ── Pin definitions ──
#define MCP2515_CS_PIN   5
#define MCP2515_INT_PIN  2
#define SD_CS_PIN        15

#define LED_PWR_PIN      12
#define LED_WIFI_PIN     13
#define LED_DATA_PIN     14

// ── MCP2515 CAN controller ──
tNMEA2000_mcp NMEA2000(MCP2515_CS_PIN, MCP_16MHz, MCP2515_INT_PIN);

// ── Web server (port 80 for local dashboard + setup portal) ──
WebServer server(80);

// ── Preferences (persistent config in flash) ──
Preferences prefs;

// ── Timing ──
#define CLOUD_SEND_INTERVAL_MS  5000   // send to cloud every 5 seconds
#define DASHBOARD_UPDATE_MS     1000   // update local dashboard every 1 second
#define WIFI_RETRY_INTERVAL_MS  30000  // retry WiFi every 30 seconds
#define SD_LOG_INTERVAL_MS      5000   // log to SD every 5 seconds
#define SYNC_BATCH_SIZE         50     // records per sync batch

unsigned long lastCloudSend = 0;
unsigned long lastDashUpdate = 0;
unsigned long lastWiFiRetry = 0;
unsigned long lastSDLog = 0;
unsigned long ledDataOff = 0;

// ── Device state ──
enum DeviceMode {
  MODE_SETUP,       // first boot, no config — captive portal active
  MODE_ONLINE,      // connected to boat WiFi, sending to cloud
  MODE_OFFLINE      // no WiFi, serving local dashboard, logging to SD
};

DeviceMode currentMode = MODE_SETUP;
bool sdCardPresent = false;
bool wifiConnected = false;
unsigned long bootTime = 0;
unsigned long lastDataReceived = 0;
uint32_t totalPGNsReceived = 0;
uint32_t totalCloudSends = 0;
uint32_t pendingSDRecords = 0;

// ── Configuration (stored in flash) ──
struct Config {
  char wifiSSID[64];
  char wifiPass[64];
  char vesselId[64];
  char vesselName[64];
  char apiKey[128];
  char nautiumURL[256];
  bool configured;
};

Config config;

// ── Boat data (populated from NMEA 2000 PGNs) ──
struct EngineData {
  double rpm;
  double coolantTemp;    // Celsius
  double oilPressure;    // kPa
  double hours;
  int8_t gear;           // -1=reverse, 0=neutral, 1=forward
  bool   dataValid;
  unsigned long lastUpdate;
};

struct BatteryData {
  double voltage;
  double current;
  double temperature;    // Celsius
  double soc;            // 0-100%
  bool   dataValid;
  unsigned long lastUpdate;
};

struct TankData {
  double level;          // 0-100%
  double capacity;       // liters
  uint8_t type;          // 0=fuel, 1=water, 2=waste, etc.
  bool   dataValid;
  unsigned long lastUpdate;
};

struct GPSData {
  double lat;
  double lon;
  double sog;            // knots
  double cog;            // degrees true
  bool   dataValid;
  unsigned long lastUpdate;
};

struct FaultData {
  uint32_t spn;
  uint8_t  fmi;
  unsigned long timestamp;
};

// ── Boat state ──
EngineData   engines[4]   = {};  // up to 4 engines (port, stbd, gen1, gen2)
BatteryData  batteries[4] = {};  // up to 4 battery banks
TankData     tanks[6]     = {};  // up to 6 tanks
GPSData      gps          = {};
FaultData    activeFaults[16];
int          faultCount   = 0;

// ── Forward declarations ──
void setupWiFi();
void setupWebServer();
void setupSD();
void loadConfig();
void saveConfig();
void handleNMEAMessages();
void sendToCloud();
void logToSD();
void syncSDToCloud();
void blinkDataLED();

// ── NMEA 2000 message handler ──
void handleN2kMsg(const tN2kMsg &N2kMsg);

// ── Web server handlers ──
void handleRoot();
void handleSetup();
void handleSaveConfig();
void handleDashboard();
void handleAPI();
void handleStatus();

// ====================================================================
//  Setup Portal HTML (captive portal for first-time config)
// ====================================================================
const char SETUP_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nautium Connect Setup</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#0a1628;color:#e8edf5;min-height:100vh;display:flex;align-items:center;justify-content:center}
.container{width:90%;max-width:420px;padding:24px}
h1{font-size:22px;color:#0ea5e9;margin-bottom:4px}
h2{font-size:13px;color:#06b6d4;letter-spacing:2px;margin-bottom:24px;font-weight:400}
.field{margin-bottom:16px}
label{display:block;font-size:12px;color:#7a93b0;margin-bottom:4px;letter-spacing:1px}
input,select{width:100%;padding:12px;background:#111d32;border:1px solid #1e3a5f;border-radius:8px;color:#e8edf5;font-size:14px;outline:none}
input:focus,select:focus{border-color:#0ea5e9}
button{width:100%;padding:14px;background:#0ea5e9;border:none;border-radius:8px;color:white;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px;letter-spacing:1px}
button:hover{background:#0284c7}
.scan{font-size:11px;color:#06b6d4;cursor:pointer;float:right;margin-top:-18px}
.info{font-size:11px;color:#7a93b0;margin-top:16px;text-align:center;line-height:1.6}
.logo{text-align:center;margin-bottom:24px}
.status{padding:10px;background:#162240;border-radius:8px;margin-bottom:16px;font-size:12px}
.status .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.dot.green{background:#22c55e}
.dot.red{background:#ef4444}
.dot.yellow{background:#f59e0b}
</style>
</head>
<body>
<div class="container">
  <div class="logo">
    <h1>NAUTIUM</h1>
    <h2>CONNECT — SETUP</h2>
  </div>

  <div class="status">
    <span class="dot %SD_CLASS%"></span>SD Card: %SD_STATUS%<br>
    <span class="dot %CAN_CLASS%"></span>NMEA 2000: %CAN_STATUS%
  </div>

  <form action="/save" method="POST">
    <div class="field">
      <label>WIFI DEL BARCO (SSID)</label>
      <input type="text" name="ssid" placeholder="Nombre de la red WiFi" value="%SSID%" required>
    </div>
    <div class="field">
      <label>WIFI PASSWORD</label>
      <input type="password" name="pass" placeholder="Contraseña del WiFi" value="%PASS%">
    </div>
    <div class="field">
      <label>VESSEL ID (de Nautium)</label>
      <input type="text" name="vessel_id" placeholder="UUID del barco en nautium.app" value="%VESSEL_ID%" required>
    </div>
    <div class="field">
      <label>NOMBRE DEL BARCO</label>
      <input type="text" name="vessel_name" placeholder="ej: Soulmate" value="%VESSEL_NAME%">
    </div>
    <div class="field">
      <label>API KEY</label>
      <input type="text" name="api_key" placeholder="Clave de API de Nautium" value="%API_KEY%" required>
    </div>
    <div class="field">
      <label>NAUTIUM URL</label>
      <input type="text" name="url" placeholder="URL del endpoint" value="%URL%">
    </div>
    <button type="submit">GUARDAR Y CONECTAR</button>
  </form>
  <p class="info">
    Nautium Connect v%VERSION%<br>
    Después de guardar, el dispositivo se reiniciará<br>
    y se conectará al WiFi del barco automáticamente.
  </p>
</div>
</body>
</html>
)rawliteral";

// ====================================================================
//  Local Dashboard HTML (works offline)
// ====================================================================
const char DASHBOARD_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nautium Connect — %VESSEL%</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#0a1628;color:#e8edf5;padding:16px}
h1{font-size:18px;color:#0ea5e9;margin-bottom:2px}
h2{font-size:11px;color:#7a93b0;letter-spacing:2px;margin-bottom:12px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:500px){.grid{grid-template-columns:1fr}}
.card{background:#111d32;border:1px solid #1e3a5f;border-radius:10px;padding:12px}
.card h3{font-size:11px;color:#7a93b0;letter-spacing:1px;margin-bottom:8px}
.val{font-size:22px;font-weight:700;color:#0ea5e9}
.unit{font-size:11px;color:#7a93b0}
.row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #1e3a5f22}
.row:last-child{border:none}
.lbl{color:#7a93b0;font-size:12px}
.v{font-size:13px;font-weight:600}
.bar-bg{height:8px;background:#1e3a5f;border-radius:4px;margin-top:4px}
.bar-fill{height:8px;border-radius:4px;transition:width 0.5s}
.fuel{background:#f59e0b}
.water{background:#3b82f6}
.good{color:#22c55e}.warn{color:#f59e0b}.bad{color:#ef4444}
.status-bar{display:flex;justify-content:space-between;align-items:center;background:#111d32;border:1px solid #1e3a5f;border-radius:10px;padding:8px 12px;margin-bottom:12px;font-size:11px}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px}
.dot.on{background:#22c55e}.dot.off{background:#ef4444}.dot.warn{background:#f59e0b}
.gear{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700}
.gear.fwd{background:#22c55e22;color:#22c55e}
.gear.rev{background:#f59e0b22;color:#f59e0b}
.gear.neu{background:#7a93b022;color:#7a93b0}
.fault{background:#ef444422;border:1px solid #ef4444;border-radius:8px;padding:8px 12px;margin-bottom:6px;font-size:12px;color:#ef4444}
</style>
</head>
<body>
<h1>NAUTIUM</h1>
<h2>%VESSEL% — MONITOR LOCAL</h2>

<div class="status-bar">
  <div><span class="dot %MODE_CLASS%"></span>%MODE_TEXT%</div>
  <div>%UPTIME%</div>
  <div>PGNs: %PGNS%</div>
</div>

<div id="data">Cargando datos...</div>

<script>
function fmt(v,d){return v!=null?Number(v).toFixed(d||0):'--'}
function gearTag(g){
  if(g>0) return '<span class="gear fwd">FWD</span>';
  if(g<0) return '<span class="gear rev">REV</span>';
  return '<span class="gear neu">NEU</span>';
}
function bar(pct,cls){
  return '<div class="bar-bg"><div class="bar-fill '+cls+'" style="width:'+Math.max(0,Math.min(100,pct))+'%"></div></div>';
}
function tempClass(t){return t>100?'bad':t>90?'warn':'good'}

function update(){
  fetch('/api/data').then(r=>r.json()).then(d=>{
    let h='';
    // Engines
    h+='<div class="grid">';
    const eNames=['Motor Port','Motor Stbd','Generador 1','Generador 2'];
    for(let i=0;i<4;i++){
      const e=d.engines[i];
      if(!e||!e.valid) continue;
      h+='<div class="card"><h3>'+eNames[i]+'</h3>';
      h+='<div class="val">'+fmt(e.rpm)+' <span class="unit">RPM</span></div>';
      h+='<div class="row"><span class="lbl">Temp</span><span class="v '+tempClass(e.temp)+'">'+fmt(e.temp,1)+'°C</span></div>';
      h+='<div class="row"><span class="lbl">Oil</span><span class="v">'+fmt(e.oil)+' kPa</span></div>';
      h+='<div class="row"><span class="lbl">Horas</span><span class="v">'+fmt(e.hours,1)+'</span></div>';
      h+='<div class="row"><span class="lbl">Gear</span>'+gearTag(e.gear)+'</div>';
      h+='</div>';
    }
    h+='</div>';

    // Batteries
    if(d.batteries&&d.batteries.some(b=>b&&b.valid)){
      h+='<div class="grid" style="margin-top:10px">';
      for(let i=0;i<d.batteries.length;i++){
        const b=d.batteries[i];
        if(!b||!b.valid) continue;
        h+='<div class="card"><h3>Batería '+(i+1)+'</h3>';
        h+='<div class="val">'+fmt(b.voltage,1)+' <span class="unit">V</span></div>';
        h+='<div class="row"><span class="lbl">Corriente</span><span class="v">'+fmt(b.current,1)+' A</span></div>';
        h+='<div class="row"><span class="lbl">SOC</span><span class="v">'+fmt(b.soc)+'%</span></div>';
        h+=bar(b.soc,'water');
        h+='<div class="row"><span class="lbl">Temp</span><span class="v">'+fmt(b.temp,1)+'°C</span></div>';
        h+='</div>';
      }
      h+='</div>';
    }

    // Tanks
    if(d.tanks&&d.tanks.some(t=>t&&t.valid)){
      h+='<div class="grid" style="margin-top:10px">';
      const tNames={0:'Diesel',1:'Agua',2:'Aguas Grises',3:'Aceite',4:'Aguas Negras'};
      for(let i=0;i<d.tanks.length;i++){
        const t=d.tanks[i];
        if(!t||!t.valid) continue;
        h+='<div class="card"><h3>'+(tNames[t.type]||'Tanque')+' '+(i+1)+'</h3>';
        h+='<div class="val">'+fmt(t.level)+'<span class="unit">%</span></div>';
        h+=bar(t.level, t.type==0?'fuel':'water');
        h+='<div class="row"><span class="lbl">Capacidad</span><span class="v">'+fmt(t.capacity)+' L</span></div>';
        h+='</div>';
      }
      h+='</div>';
    }

    // GPS
    if(d.gps&&d.gps.valid){
      h+='<div class="card" style="margin-top:10px"><h3>GPS</h3>';
      h+='<div class="grid">';
      h+='<div><div class="row"><span class="lbl">Lat</span><span class="v">'+fmt(d.gps.lat,4)+'</span></div></div>';
      h+='<div><div class="row"><span class="lbl">Lon</span><span class="v">'+fmt(d.gps.lon,4)+'</span></div></div>';
      h+='<div><div class="row"><span class="lbl">SOG</span><span class="v">'+fmt(d.gps.sog,1)+' kn</span></div></div>';
      h+='<div><div class="row"><span class="lbl">COG</span><span class="v">'+fmt(d.gps.cog)+'°</span></div></div>';
      h+='</div></div>';
    }

    // Faults
    if(d.faults&&d.faults.length>0){
      h+='<div style="margin-top:10px">';
      for(let f of d.faults){
        h+='<div class="fault">⚠ SPN '+f.spn+' FMI '+f.fmi+'</div>';
      }
      h+='</div>';
    }

    document.getElementById('data').innerHTML=h;
  }).catch(()=>{
    document.getElementById('data').innerHTML='<div class="card"><h3>Sin datos</h3><p style="color:#7a93b0">Esperando datos del backbone NMEA 2000...</p></div>';
  });
}
update();
setInterval(update,1000);
</script>
</body>
</html>
)rawliteral";

// ====================================================================
//  Setup
// ====================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  // LED setup
  pinMode(LED_PWR_PIN, OUTPUT);
  pinMode(LED_WIFI_PIN, OUTPUT);
  pinMode(LED_DATA_PIN, OUTPUT);
  digitalWrite(LED_PWR_PIN, HIGH);
  digitalWrite(LED_WIFI_PIN, LOW);
  digitalWrite(LED_DATA_PIN, LOW);

  bootTime = millis();

  Serial.println();
  Serial.println("  NAUTIUM CONNECT v" FW_VERSION);
  Serial.println("  ════════════════════════");

  // Load config from flash
  loadConfig();

  // Init SD card
  setupSD();

  // NMEA 2000 setup — listen mode (read only)
  NMEA2000.SetProductInformation(
    "NCT-001", 300, "Nautium Connect",
    FW_VERSION, "1.0.0"
  );
  NMEA2000.SetDeviceInformation(3, 130, 25, 2046);
  NMEA2000.SetMode(tNMEA2000::N2km_ListenOnly);
  NMEA2000.SetMsgHandler(handleN2kMsg);
  NMEA2000.EnableForward(false);
  NMEA2000.Open();
  Serial.println("  CAN bus: MCP2515 initialized (listen mode)");

  // WiFi + web server
  setupWiFi();
  setupWebServer();

  Serial.println("  ════════════════════════");
  Serial.println("  Ready!");
  Serial.println();
}

// ====================================================================
//  Configuration management
// ====================================================================
void loadConfig() {
  prefs.begin("nautium", true);  // read-only
  strlcpy(config.wifiSSID, prefs.getString("ssid", "").c_str(), 64);
  strlcpy(config.wifiPass, prefs.getString("pass", "").c_str(), 64);
  strlcpy(config.vesselId, prefs.getString("vessel_id", "").c_str(), 64);
  strlcpy(config.vesselName, prefs.getString("vessel_name", "").c_str(), 64);
  strlcpy(config.apiKey, prefs.getString("api_key", "").c_str(), 128);
  strlcpy(config.nautiumURL, prefs.getString("url",
    "https://fsxjbgopxxbtidlkkafc.supabase.co/functions/v1/ingest-telemetry").c_str(), 256);
  config.configured = prefs.getBool("configured", false);
  prefs.end();

  Serial.printf("  Config: %s\n", config.configured ? "loaded" : "not configured");
  if (config.configured) {
    Serial.printf("  Vessel: %s (%s)\n", config.vesselName, config.vesselId);
    Serial.printf("  WiFi:   %s\n", config.wifiSSID);
  }
}

void saveConfig() {
  prefs.begin("nautium", false);
  prefs.putString("ssid", config.wifiSSID);
  prefs.putString("pass", config.wifiPass);
  prefs.putString("vessel_id", config.vesselId);
  prefs.putString("vessel_name", config.vesselName);
  prefs.putString("api_key", config.apiKey);
  prefs.putString("url", config.nautiumURL);
  prefs.putBool("configured", true);
  prefs.end();
  config.configured = true;
}

// ====================================================================
//  SD Card
// ====================================================================
void setupSD() {
  pinMode(SD_CS_PIN, OUTPUT);
  digitalWrite(SD_CS_PIN, HIGH);

  if (SD.begin(SD_CS_PIN)) {
    sdCardPresent = true;
    // Create data directory if needed
    if (!SD.exists("/nautium")) SD.mkdir("/nautium");
    Serial.println("  SD card: ready");

    // Count pending records
    File idx = SD.open("/nautium/pending.txt", FILE_READ);
    if (idx) {
      while (idx.available()) {
        idx.readStringUntil('\n');
        pendingSDRecords++;
      }
      idx.close();
    }
    if (pendingSDRecords > 0) {
      Serial.printf("  SD card: %d pending records to sync\n", pendingSDRecords);
    }
  } else {
    sdCardPresent = false;
    Serial.println("  SD card: not found (optional)");
  }
}

void logToSD() {
  if (!sdCardPresent) return;

  File f = SD.open("/nautium/pending.txt", FILE_APPEND);
  if (!f) return;

  // Write a JSON line with all current data
  JsonDocument doc;
  doc["ts"] = millis();
  doc["vid"] = config.vesselId;

  // Engines
  JsonArray eng = doc["eng"].to<JsonArray>();
  for (int i = 0; i < 4; i++) {
    if (!engines[i].dataValid) continue;
    JsonObject e = eng.add<JsonObject>();
    e["i"] = i;
    e["rpm"] = (int)round(engines[i].rpm);
    e["tmp"] = round(engines[i].coolantTemp * 10.0) / 10.0;
    e["oil"] = (int)round(engines[i].oilPressure);
    e["hrs"] = round(engines[i].hours * 10.0) / 10.0;
    e["g"] = engines[i].gear;
  }

  // Batteries
  JsonArray bat = doc["bat"].to<JsonArray>();
  for (int i = 0; i < 4; i++) {
    if (!batteries[i].dataValid) continue;
    JsonObject b = bat.add<JsonObject>();
    b["i"] = i;
    b["v"] = round(batteries[i].voltage * 10.0) / 10.0;
    b["a"] = round(batteries[i].current * 10.0) / 10.0;
    b["soc"] = (int)round(batteries[i].soc);
  }

  // Tanks
  JsonArray tnk = doc["tnk"].to<JsonArray>();
  for (int i = 0; i < 6; i++) {
    if (!tanks[i].dataValid) continue;
    JsonObject t = tnk.add<JsonObject>();
    t["i"] = i;
    t["lvl"] = round(tanks[i].level * 10.0) / 10.0;
    t["typ"] = tanks[i].type;
  }

  // GPS
  if (gps.dataValid) {
    JsonObject g = doc["gps"].to<JsonObject>();
    g["lat"] = round(gps.lat * 10000.0) / 10000.0;
    g["lon"] = round(gps.lon * 10000.0) / 10000.0;
    g["sog"] = round(gps.sog * 10.0) / 10.0;
    g["cog"] = (int)round(gps.cog);
  }

  serializeJson(doc, f);
  f.println();
  f.close();
  pendingSDRecords++;
}

void syncSDToCloud() {
  if (!sdCardPresent || pendingSDRecords == 0 || !wifiConnected) return;

  File f = SD.open("/nautium/pending.txt", FILE_READ);
  if (!f) return;

  HTTPClient http;
  int synced = 0;
  String remaining = "";

  while (f.available() && synced < SYNC_BATCH_SIZE) {
    String line = f.readStringUntil('\n');
    if (line.length() < 10) continue;

    http.begin(String(config.nautiumURL));
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", String("Bearer ") + config.apiKey);
    int code = http.POST(line);
    http.end();

    if (code >= 200 && code < 300) {
      synced++;
    } else {
      remaining += line + "\n";
      break;  // stop on first failure
    }
  }

  // Copy remaining lines
  while (f.available()) {
    remaining += f.readStringUntil('\n') + "\n";
  }
  f.close();

  // Rewrite pending file with remaining
  File fw = SD.open("/nautium/pending.txt", FILE_WRITE);
  if (fw) {
    fw.print(remaining);
    fw.close();
  }

  pendingSDRecords = max(0, (int)pendingSDRecords - synced);
  if (synced > 0) {
    Serial.printf("  Synced %d records from SD, %d remaining\n", synced, pendingSDRecords);
  }
}

// ====================================================================
//  WiFi
// ====================================================================
void setupWiFi() {
  if (!config.configured) {
    // Setup mode: create AP for captive portal
    String apName = "Nautium-Setup-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    WiFi.mode(WIFI_AP);
    WiFi.softAP(apName.c_str());
    currentMode = MODE_SETUP;
    Serial.printf("  WiFi: AP mode → %s\n", apName.c_str());
    Serial.printf("  Setup portal: http://192.168.4.1\n");
  } else {
    // Normal mode: AP + STA (local dashboard + cloud)
    String apName = "Nautium-" + String(config.vesselName);
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP(apName.c_str());
    WiFi.begin(config.wifiSSID, config.wifiPass);

    Serial.printf("  WiFi: connecting to %s...\n", config.wifiSSID);

    // Try to connect (non-blocking after 5 seconds)
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 5000) {
      delay(250);
      Serial.print(".");
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
      wifiConnected = true;
      currentMode = MODE_ONLINE;
      digitalWrite(LED_WIFI_PIN, HIGH);
      Serial.printf("  WiFi: connected! IP=%s\n", WiFi.localIP().toString().c_str());
    } else {
      wifiConnected = false;
      currentMode = MODE_OFFLINE;
      Serial.println("  WiFi: offline — local dashboard at 192.168.4.1");
    }

    Serial.printf("  Local dashboard: http://192.168.4.1 (%s)\n", apName.c_str());
  }
}

// ====================================================================
//  Web Server
// ====================================================================
void setupWebServer() {
  server.on("/", handleRoot);
  server.on("/setup", handleSetup);
  server.on("/save", HTTP_POST, handleSaveConfig);
  server.on("/dashboard", handleDashboard);
  server.on("/api/data", handleAPI);
  server.on("/api/status", handleStatus);
  server.begin();
  Serial.println("  Web server: started on port 80");
}

void handleRoot() {
  if (currentMode == MODE_SETUP) {
    handleSetup();
  } else {
    handleDashboard();
  }
}

void handleSetup() {
  String html = String(SETUP_HTML);
  html.replace("%VERSION%", FW_VERSION);
  html.replace("%SSID%", config.wifiSSID);
  html.replace("%PASS%", config.wifiPass);
  html.replace("%VESSEL_ID%", config.vesselId);
  html.replace("%VESSEL_NAME%", config.vesselName);
  html.replace("%API_KEY%", config.apiKey);
  html.replace("%URL%", config.nautiumURL);
  html.replace("%SD_STATUS%", sdCardPresent ? "Presente" : "No detectada");
  html.replace("%SD_CLASS%", sdCardPresent ? "green" : "yellow");
  html.replace("%CAN_STATUS%", totalPGNsReceived > 0 ? "Recibiendo datos" : "Esperando...");
  html.replace("%CAN_CLASS%", totalPGNsReceived > 0 ? "green" : "yellow");
  server.send(200, "text/html", html);
}

void handleSaveConfig() {
  strlcpy(config.wifiSSID, server.arg("ssid").c_str(), 64);
  strlcpy(config.wifiPass, server.arg("pass").c_str(), 64);
  strlcpy(config.vesselId, server.arg("vessel_id").c_str(), 64);
  strlcpy(config.vesselName, server.arg("vessel_name").c_str(), 64);
  strlcpy(config.apiKey, server.arg("api_key").c_str(), 128);
  String url = server.arg("url");
  if (url.length() > 0) {
    strlcpy(config.nautiumURL, url.c_str(), 256);
  }

  saveConfig();

  server.send(200, "text/html",
    "<html><body style='background:#0a1628;color:#e8edf5;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh'>"
    "<div style='text-align:center'>"
    "<h1 style='color:#0ea5e9'>NAUTIUM CONNECT</h1>"
    "<h2 style='color:#22c55e'>Configuración guardada!</h2>"
    "<p style='color:#7a93b0'>Reiniciando en 3 segundos...</p>"
    "</div></body></html>"
  );

  delay(3000);
  ESP.restart();
}

void handleDashboard() {
  String html = String(DASHBOARD_HTML);
  html.replace("%VESSEL%", config.vesselName);

  // Mode
  if (currentMode == MODE_ONLINE) {
    html.replace("%MODE_CLASS%", "on");
    html.replace("%MODE_TEXT%", "Online — enviando a Nautium");
  } else if (currentMode == MODE_OFFLINE) {
    html.replace("%MODE_CLASS%", "warn");
    html.replace("%MODE_TEXT%", "Offline — datos en SD");
  } else {
    html.replace("%MODE_CLASS%", "off");
    html.replace("%MODE_TEXT%", "Setup necesario");
  }

  // Uptime
  unsigned long up = (millis() - bootTime) / 1000;
  char upStr[32];
  if (up > 86400) snprintf(upStr, 32, "%lud %luh", up / 86400, (up % 86400) / 3600);
  else if (up > 3600) snprintf(upStr, 32, "%luh %lum", up / 3600, (up % 3600) / 60);
  else snprintf(upStr, 32, "%lum %lus", up / 60, up % 60);
  html.replace("%UPTIME%", upStr);
  html.replace("%PGNS%", String(totalPGNsReceived));

  server.send(200, "text/html", html);
}

void handleAPI() {
  JsonDocument doc;

  // Engines
  JsonArray eng = doc["engines"].to<JsonArray>();
  for (int i = 0; i < 4; i++) {
    JsonObject e = eng.add<JsonObject>();
    e["valid"] = engines[i].dataValid;
    if (engines[i].dataValid) {
      e["rpm"] = (int)round(engines[i].rpm);
      e["temp"] = round(engines[i].coolantTemp * 10.0) / 10.0;
      e["oil"] = (int)round(engines[i].oilPressure);
      e["hours"] = round(engines[i].hours * 10.0) / 10.0;
      e["gear"] = engines[i].gear;
    }
  }

  // Batteries
  JsonArray bat = doc["batteries"].to<JsonArray>();
  for (int i = 0; i < 4; i++) {
    JsonObject b = bat.add<JsonObject>();
    b["valid"] = batteries[i].dataValid;
    if (batteries[i].dataValid) {
      b["voltage"] = round(batteries[i].voltage * 10.0) / 10.0;
      b["current"] = round(batteries[i].current * 10.0) / 10.0;
      b["soc"] = (int)round(batteries[i].soc);
      b["temp"] = round(batteries[i].temperature * 10.0) / 10.0;
    }
  }

  // Tanks
  JsonArray tnk = doc["tanks"].to<JsonArray>();
  for (int i = 0; i < 6; i++) {
    JsonObject t = tnk.add<JsonObject>();
    t["valid"] = tanks[i].dataValid;
    if (tanks[i].dataValid) {
      t["level"] = round(tanks[i].level * 10.0) / 10.0;
      t["capacity"] = (int)round(tanks[i].capacity);
      t["type"] = tanks[i].type;
    }
  }

  // GPS
  JsonObject g = doc["gps"].to<JsonObject>();
  g["valid"] = gps.dataValid;
  if (gps.dataValid) {
    g["lat"] = round(gps.lat * 10000.0) / 10000.0;
    g["lon"] = round(gps.lon * 10000.0) / 10000.0;
    g["sog"] = round(gps.sog * 10.0) / 10.0;
    g["cog"] = (int)round(gps.cog);
  }

  // Faults
  JsonArray fa = doc["faults"].to<JsonArray>();
  for (int i = 0; i < faultCount; i++) {
    JsonObject f = fa.add<JsonObject>();
    f["spn"] = activeFaults[i].spn;
    f["fmi"] = activeFaults[i].fmi;
  }

  String json;
  serializeJson(doc, json);
  server.send(200, "application/json", json);
}

void handleStatus() {
  JsonDocument doc;
  doc["version"] = FW_VERSION;
  doc["vessel_id"] = config.vesselId;
  doc["vessel_name"] = config.vesselName;
  doc["mode"] = currentMode == MODE_ONLINE ? "online" :
                currentMode == MODE_OFFLINE ? "offline" : "setup";
  doc["wifi_connected"] = wifiConnected;
  doc["wifi_rssi"] = wifiConnected ? WiFi.RSSI() : 0;
  doc["sd_card"] = sdCardPresent;
  doc["pending_records"] = pendingSDRecords;
  doc["pgns_received"] = totalPGNsReceived;
  doc["cloud_sends"] = totalCloudSends;
  doc["uptime_sec"] = (millis() - bootTime) / 1000;

  String json;
  serializeJson(doc, json);
  server.send(200, "application/json", json);
}

// ====================================================================
//  NMEA 2000 Message Handler
// ====================================================================
void handleN2kMsg(const tN2kMsg &N2kMsg) {
  totalPGNsReceived++;
  lastDataReceived = millis();

  switch (N2kMsg.PGN) {
    case 127488UL: {  // Engine Rapid Update (RPM)
      unsigned char instance;
      double rpm, boost;
      int8_t trim;
      if (ParseN2kEngineParamRapid(N2kMsg, instance, rpm, boost, trim)) {
        if (instance < 4) {
          engines[instance].rpm = rpm;
          engines[instance].dataValid = true;
          engines[instance].lastUpdate = millis();
        }
      }
      break;
    }

    case 127489UL: {  // Engine Dynamic (temp, oil, hours)
      unsigned char instance;
      double oilPress, oilTemp, coolTemp, altV, fuelRate, hours, coolPress, fuelPress;
      int8_t load, torque;
      if (ParseN2kEngineDynamicParam(N2kMsg, instance, oilPress, oilTemp, coolTemp,
          altV, fuelRate, hours, coolPress, fuelPress, load, torque)) {
        if (instance < 4) {
          if (!N2kIsNA(oilPress)) engines[instance].oilPressure = oilPress / 100.0;  // Pa to kPa
          if (!N2kIsNA(coolTemp)) engines[instance].coolantTemp = KelvinToC(coolTemp);
          if (!N2kIsNA(hours)) engines[instance].hours = hours;
          engines[instance].dataValid = true;
          engines[instance].lastUpdate = millis();
        }
      }
      break;
    }

    case 127493UL: {  // Transmission Parameters (gear)
      unsigned char instance;
      tN2kTransmissionGear gear;
      double oilPress, oilTemp;
      int8_t discreteStatus;
      if (ParseN2kTransmissionParameters(N2kMsg, instance, gear, oilPress, oilTemp,
          discreteStatus)) {
        if (instance < 4) {
          engines[instance].gear = (gear == N2kTG_Forward) ? 1 :
                                   (gear == N2kTG_Reverse) ? -1 : 0;
          engines[instance].lastUpdate = millis();
        }
      }
      break;
    }

    case 127505UL: {  // Fluid Level (tanks)
      unsigned char instance;
      tN2kFluidType type;
      double level, capacity;
      if (ParseN2kFluidLevel(N2kMsg, instance, type, level, capacity)) {
        if (instance < 6) {
          tanks[instance].level = level;
          tanks[instance].capacity = capacity;
          tanks[instance].type = (uint8_t)type;
          tanks[instance].dataValid = true;
          tanks[instance].lastUpdate = millis();
        }
      }
      break;
    }

    case 127508UL: {  // DC Battery Status
      unsigned char instance;
      double voltage, current, temp;
      unsigned char sid;
      if (ParseN2kDCBatStatus(N2kMsg, instance, voltage, current, temp, sid)) {
        if (instance < 4) {
          if (!N2kIsNA(voltage)) batteries[instance].voltage = voltage;
          if (!N2kIsNA(current)) batteries[instance].current = current;
          if (!N2kIsNA(temp)) batteries[instance].temperature = KelvinToC(temp);
          batteries[instance].dataValid = true;
          batteries[instance].lastUpdate = millis();
        }
      }
      break;
    }

    case 129025UL: {  // Position Rapid Update (lat/lon)
      double lat, lon;
      if (ParseN2kPositionRapid(N2kMsg, lat, lon)) {
        gps.lat = lat;
        gps.lon = lon;
        gps.dataValid = true;
        gps.lastUpdate = millis();
      }
      break;
    }

    case 129026UL: {  // COG/SOG Rapid Update
      unsigned char sid;
      tN2kHeadingReference ref;
      double cog, sog;
      if (ParseN2kCOGSOGRapid(N2kMsg, sid, ref, cog, sog)) {
        if (!N2kIsNA(cog)) gps.cog = RadToDeg(cog);
        if (!N2kIsNA(sog)) gps.sog = sog * 3600.0 / 1852.0;  // m/s to knots
        gps.lastUpdate = millis();
      }
      break;
    }

    case 65226UL: {  // DM1 Diagnostic Message (faults)
      // Parse DTC bytes manually
      if (N2kMsg.DataLen >= 6) {
        faultCount = 0;
        for (int offset = 2; offset + 3 < N2kMsg.DataLen && faultCount < 16; offset += 4) {
          uint32_t spn = N2kMsg.GetByte(offset) |
                         (N2kMsg.GetByte(offset + 1) << 8) |
                         ((N2kMsg.GetByte(offset + 2) & 0xE0) << 11);
          uint8_t fmi = N2kMsg.GetByte(offset + 2) & 0x1F;
          activeFaults[faultCount].spn = spn;
          activeFaults[faultCount].fmi = fmi;
          activeFaults[faultCount].timestamp = millis();
          faultCount++;
        }
      }
      break;
    }
  }
}

// ====================================================================
//  Send to Nautium Cloud
// ====================================================================
void sendToCloud() {
  if (!wifiConnected || !config.configured) return;

  HTTPClient http;
  http.begin(String(config.nautiumURL));
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + config.apiKey);
  http.setTimeout(5000);

  // Build payload
  JsonDocument doc;
  doc["vessel_id"] = config.vesselId;
  doc["timestamp"] = millis();

  // Engines
  JsonObject engObj = doc["engines"].to<JsonObject>();
  const char* engNames[] = {"port", "stbd", "gen1", "gen2"};
  for (int i = 0; i < 4; i++) {
    if (!engines[i].dataValid) continue;
    JsonObject e = engObj[engNames[i]].to<JsonObject>();
    e["rpm"] = (int)round(engines[i].rpm);
    e["temp"] = round(engines[i].coolantTemp * 10.0) / 10.0;
    e["oil_pressure"] = (int)round(engines[i].oilPressure);
    e["hours"] = round(engines[i].hours * 10.0) / 10.0;
    e["gear"] = engines[i].gear;
  }

  // Batteries
  JsonObject batObj = doc["batteries"].to<JsonObject>();
  for (int i = 0; i < 4; i++) {
    if (!batteries[i].dataValid) continue;
    JsonObject b = batObj[String("bank") + String(i + 1)].to<JsonObject>();
    b["voltage"] = round(batteries[i].voltage * 10.0) / 10.0;
    b["current"] = round(batteries[i].current * 10.0) / 10.0;
    b["soc"] = (int)round(batteries[i].soc);
    b["temp"] = round(batteries[i].temperature * 10.0) / 10.0;
  }

  // Tanks
  JsonArray tnkArr = doc["tanks"].to<JsonArray>();
  for (int i = 0; i < 6; i++) {
    if (!tanks[i].dataValid) continue;
    JsonObject t = tnkArr.add<JsonObject>();
    t["instance"] = i;
    t["level"] = round(tanks[i].level * 10.0) / 10.0;
    t["capacity"] = (int)round(tanks[i].capacity);
    t["type"] = tanks[i].type;
  }

  // GPS
  if (gps.dataValid) {
    JsonObject g = doc["gps"].to<JsonObject>();
    g["lat"] = round(gps.lat * 10000.0) / 10000.0;
    g["lon"] = round(gps.lon * 10000.0) / 10000.0;
    g["sog"] = round(gps.sog * 10.0) / 10.0;
    g["cog"] = (int)round(gps.cog);
  }

  // Faults
  if (faultCount > 0) {
    JsonArray fa = doc["faults"].to<JsonArray>();
    for (int i = 0; i < faultCount; i++) {
      JsonObject f = fa.add<JsonObject>();
      f["spn"] = activeFaults[i].spn;
      f["fmi"] = activeFaults[i].fmi;
    }
  }

  String payload;
  serializeJson(doc, payload);

  int code = http.POST(payload);
  http.end();

  if (code >= 200 && code < 300) {
    totalCloudSends++;
    blinkDataLED();
  } else {
    Serial.printf("  Cloud send failed: %d\n", code);
    // Log to SD as fallback
    if (sdCardPresent) logToSD();
  }
}

// ====================================================================
//  LED helpers
// ====================================================================
void blinkDataLED() {
  digitalWrite(LED_DATA_PIN, HIGH);
  ledDataOff = millis() + 150;
}

// ====================================================================
//  Main Loop
// ====================================================================
void loop() {
  unsigned long now = millis();

  // Handle web server requests
  server.handleClient();

  // Parse NMEA 2000 messages from CAN bus
  NMEA2000.ParseMessages();

  // LED timeout
  if (ledDataOff && now >= ledDataOff) {
    digitalWrite(LED_DATA_PIN, LOW);
    ledDataOff = 0;
  }

  // Check WiFi connection
  if (config.configured && now - lastWiFiRetry >= WIFI_RETRY_INTERVAL_MS) {
    lastWiFiRetry = now;
    bool wasConnected = wifiConnected;
    wifiConnected = (WiFi.status() == WL_CONNECTED);

    if (wifiConnected && !wasConnected) {
      currentMode = MODE_ONLINE;
      digitalWrite(LED_WIFI_PIN, HIGH);
      Serial.println("  WiFi: reconnected!");
      // Try to sync pending SD records
      syncSDToCloud();
    } else if (!wifiConnected && wasConnected) {
      currentMode = MODE_OFFLINE;
      digitalWrite(LED_WIFI_PIN, LOW);
      Serial.println("  WiFi: disconnected — offline mode");
    } else if (!wifiConnected) {
      WiFi.reconnect();
    }
  }

  // Send to cloud (every 5 seconds, online only)
  if (currentMode == MODE_ONLINE && now - lastCloudSend >= CLOUD_SEND_INTERVAL_MS) {
    lastCloudSend = now;
    sendToCloud();
  }

  // Log to SD (every 5 seconds, offline or as backup)
  if (sdCardPresent && currentMode == MODE_OFFLINE && now - lastSDLog >= SD_LOG_INTERVAL_MS) {
    lastSDLog = now;
    logToSD();
    blinkDataLED();
  }

  // Periodic SD sync attempt (every 60 seconds when online)
  if (currentMode == MODE_ONLINE && pendingSDRecords > 0 && now % 60000 < 100) {
    syncSDToCloud();
  }
}

// ── Kelvin to Celsius helper ──
double KelvinToC(double kelvin) {
  return kelvin - 273.15;
}
