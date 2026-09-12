/*
 * Nautium NMEA Sim  -  Full NMEA 2000 Boat Simulator
 * ====================================================
 * Runs on: ESP32 + CAN transceiver (MCP2515 or SN65HVD230)
 * Controlled from a browser via USB Serial (JSON protocol, 115200 baud).
 *
 * Simulates a yacht with:
 *   - 2 Main Engines (Port / Starboard) with bidirectional throttle
 *   - 2 Generators
 *   - 2 Battery Banks
 *   - 3 Tanks (Diesel Main, Diesel Gen, Fresh Water)
 *   - GPS position with drift simulation
 *   - Fault injection (oil pressure, overtemp, low voltage)
 *
 * Wiring (ESP32 -> MCP2515+TJA1050 CAN module):
 *   GPIO 5  -> CS
 *   GPIO 18 -> SCK
 *   GPIO 23 -> MOSI (SI)
 *   GPIO 19 -> MISO (SO)
 *   GPIO 2  -> INT
 *   3.3V    -> VCC
 *   GND     -> GND
 *
 * MCP2515 CAN output -> NMEA 2000 backbone:
 *   CAN_H   -> Micro-C pin 5 (blue)
 *   CAN_L   -> Micro-C pin 4 (white)
 *   Shield  -> Micro-C pin 3 (shield)
 *
 * Status LEDs (active HIGH, each with 220 ohm resistor):
 *   GPIO 12 -> LED green  (PWR - power on)
 *   GPIO 13 -> LED orange (CAN - bus active)
 *   GPIO 14 -> LED blue   (TX  - transmitting)
 *
 * Libraries needed (install via Arduino Library Manager):
 *   - NMEA2000 by Timo Lappalainen
 *   - NMEA2000_mcp by Timo Lappalainen
 *   - ArduinoJson v7 by Benoit Blanchon
 *
 * Serial protocol: line-delimited JSON at 115200 baud.
 * See protocol spec in project docs for command reference.
 *
 * Version: 4.0.0
 */

#include <Arduino.h>
#include <SPI.h>
#include <N2kMsg.h>
#include <NMEA2000.h>
#include <NMEA2000_mcp.h>
#include <N2kMessages.h>
#include <ArduinoJson.h>
#include <math.h>

// ── Version ──
#define FW_VERSION "4.0.0"

// ── MCP2515 SPI pins ──
#define MCP2515_CS_PIN   5
#define MCP2515_INT_PIN  2
// SCK=18, MOSI=23, MISO=19 are ESP32 default SPI pins

// ── LED pins ──
#define LED_PWR_PIN  12
#define LED_CAN_PIN  13
#define LED_TX_PIN   14

// ── MCP2515 CAN controller (16MHz crystal, default for most modules) ──
tNMEA2000_mcp NMEA2000(MCP2515_CS_PIN, MCP_16MHz, MCP2515_INT_PIN);

// ── LED state ──
unsigned long ledTxOff = 0;
unsigned long ledCanOff = 0;

// ── Timing ──
#define SEND_INTERVAL_MS     1000   // NMEA + status every 1 second
#define SIM_INTERVAL_MS      100    // Simulation tick every 100ms
#define SERIAL_BUF_SIZE      512

unsigned long lastSend  = 0;
unsigned long lastSim   = 0;

// ── Serial input buffer ──
char serialBuf[SERIAL_BUF_SIZE];
int  serialBufPos = 0;

// ── Fault flags ──
struct FaultState {
  bool ep_oil;      // engine port low oil pressure
  bool ep_temp;     // engine port overtemp
  bool es_oil;      // engine stbd low oil pressure
  bool es_temp;     // engine stbd overtemp
  bool g1_temp;     // generator 1 overtemp
  bool g2_temp;     // generator 2 overtemp
  bool b1_low;      // battery 1 low voltage
  bool b2_low;      // battery 2 low voltage
};

// ── PGN Group Enable/Disable ──
struct PgnGroupFlags {
  bool engines;     // 127488, 127489, 127493 (default: true)
  bool batteries;   // 127508 (default: true)
  bool tanks;       // 127505 (default: true)
  bool gps;         // 129025, 129026 (default: true)
  bool faults;      // 65226 (default: true)
  bool environment; // 130310 (default: false)
  bool depth;       // 128267 (default: false)
  bool wind;        // 130306 (default: false)
  bool heading;     // 127250 (default: false)
  bool attitude;    // 127257 (default: false)
  bool waterSpeed;  // 128259 (default: false)
  bool rudder;      // 127245 (default: false)
};

// ── Simulation State ──
struct EngineState {
  bool   running;
  double rpm;
  double hours;
  double coolantTemp;    // deg C
  double oilPressure;    // kPa
  double throttle;       // -100 to +100 (negative = reverse)
};

struct GeneratorState {
  bool   running;
  double hours;
  double voltage;        // V AC
  double loadPercent;    // %
  double coolantTemp;    // deg C
};

struct BatteryState {
  double soc;            // 0-100%
  double voltage;        // V DC
  double current;        // A (positive = charging)
  double temperature;    // deg C
  bool   charging;
};

struct TankState {
  double  level;         // 0-100%
  uint8_t fluidType;     // N2kft_Fuel=0, N2kft_Water=1
  double  capacity;      // liters
};

struct GPSState {
  double lat;            // degrees (positive = N)
  double lon;            // degrees (positive = E)
  double sog;            // knots
  double cog;            // degrees true
  bool   overrideLat;    // browser is controlling lat
  bool   overrideLon;    // browser is controlling lon
  bool   overrideSog;    // browser is controlling sog
  bool   overrideCog;    // browser is controlling cog
};

struct EnvironmentState {
  double waterTemp;           // deg C
  double outsideTemp;         // deg C
  double atmosphericPressure; // hPa (mbar)
  double humidity;            // % (0-100)
};

struct DepthState {
  double depthBelowTransducer; // meters
  double offset;               // meters (positive = below waterline)
};

struct WindState {
  double windSpeed;     // m/s
  double windAngle;     // degrees (0-360)
  bool   apparent;      // true=apparent, false=true wind
};

struct HeadingState {
  double heading;       // degrees magnetic
  double deviation;     // degrees
  double variation;     // degrees
};

struct AttitudeState {
  double yaw;           // degrees
  double pitch;         // degrees
  double roll;          // degrees
};

struct WaterSpeedState {
  double speedThroughWater; // knots
};

struct RudderState {
  double rudderAngle;   // degrees (-45 to +45, negative = port)
};

// ── Default values ──
#define DEF_EP_HOURS   2847.0
#define DEF_ES_HOURS   2831.0
#define DEF_G1_HOURS   1205.0
#define DEF_G2_HOURS    890.0

// ── Equipment instances ──
EngineState    enginePort  = { false, 0, DEF_EP_HOURS, 25.0, 0, 0 };
EngineState    engineStbd  = { false, 0, DEF_ES_HOURS, 25.0, 0, 0 };
GeneratorState gen1        = { false, DEF_G1_HOURS, 0, 0, 25.0 };
GeneratorState gen2        = { false, DEF_G2_HOURS, 0, 0, 25.0 };
BatteryState   bat1        = { 87.0, 26.5,  15.0, 25.0, true  };
BatteryState   bat2        = { 92.0, 26.8, -10.0, 24.0, false };
TankState      dieselMain  = { 80.0, 0, 8000.0 };   // N2kft_Fuel
TankState      dieselGen   = { 50.0, 0, 1000.0 };   // N2kft_Fuel
TankState      freshWater  = { 70.0, 1, 2000.0 };   // N2kft_Water
GPSState       gps         = { 25.7617, -80.1918, 0, 180.0, false, false, false, false };
FaultState     faults      = { false, false, false, false, false, false, false, false };
PgnGroupFlags  pgnGroups   = { true, true, true, true, true, false, false, false, false, false, false, false };

// ── New sensor state instances ──
EnvironmentState envState       = { 22.0, 28.0, 1013.25, 65.0 };
DepthState       depthState     = { 15.0, 0.5 };
WindState        windState      = { 5.0, 45.0, true };
HeadingState     headingState   = { 180.0, -2.0, -4.5 };
AttitudeState    attitudeState  = { 0.0, 0.5, 1.0 };
WaterSpeedState  waterSpeedState = { 0.0 };
RudderState      rudderState    = { 0.0 };

// ── Previous COG for rudder simulation ──
double prevCog = 180.0;

// ── NMEA 2000 PGN list ──
const unsigned long TX_PGNS[] = {
  127245UL,   // Rudder
  127250UL,   // Vessel Heading
  127257UL,   // Attitude
  127488UL,   // Engine Rapid - RPM
  127489UL,   // Engine Dynamic - temp, oil, hours
  127493UL,   // Transmission Parameters - gear
  127505UL,   // Fluid Level - tanks
  127508UL,   // DC Battery Status - voltage/current/soc
  128259UL,   // Speed Water Referenced
  128267UL,   // Water Depth
  129025UL,   // Position Rapid Update - lat/lon
  129026UL,   // COG/SOG Rapid Update
  130306UL,   // Wind Data
  130310UL,   // Environmental Parameters
  65226UL,    // DM1 Diagnostic Message
  0
};

// ── Forward declarations ──
void updateSimulation(float dt);
void sendNMEA();
void sendStatusJSON();
void handleSerialLine(const char* line);
void resetAll();
void printBanner();
void sendDM1();
void sendEnvironment();
void sendDepth();
void sendWind();
void sendHeading();
void sendAttitude();
void sendWaterSpeed();
void sendRudder();

// ── Unit conversion helpers ──
static double knotsToMs(double kn) { return kn * 1852.0 / 3600.0; }

// ====================================================================
//  Setup
// ====================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  // LED setup
  pinMode(LED_PWR_PIN, OUTPUT);
  pinMode(LED_CAN_PIN, OUTPUT);
  pinMode(LED_TX_PIN, OUTPUT);
  digitalWrite(LED_PWR_PIN, HIGH);
  digitalWrite(LED_CAN_PIN, LOW);
  digitalWrite(LED_TX_PIN, LOW);

  printBanner();

  // NMEA 2000 setup
  NMEA2000.SetProductInformation(
    "NAU-SIM-002",              // Serial number
    200,                         // Product code
    "Nautium NMEA Sim",          // Model ID
    FW_VERSION,                  // Software version
    "4.0.0"                      // Model version
  );

  NMEA2000.SetDeviceInformation(
    2,      // Unique number
    130,    // Device function: PC gateway
    25,     // Device class: Inter/Intranetwork Device
    2046    // Manufacturer code
  );

  NMEA2000.SetMode(tNMEA2000::N2km_NodeOnly, 22);
  NMEA2000.EnableForward(false);
  NMEA2000.SetTransmitPGNs(TX_PGNS);
  NMEA2000.Open();

  Serial.println("{\"event\":\"ready\",\"version\":\"" FW_VERSION "\"}");
}

// ====================================================================
//  Banner
// ====================================================================
void printBanner() {
  Serial.println();
  Serial.println("  _   _             _   _                 ");
  Serial.println(" | \\ | |           | | (_)                ");
  Serial.println(" |  \\| | __ _ _   _| |_ _ _   _ _ __ ___ ");
  Serial.println(" | . ` |/ _` | | | | __| | | | | '_ ` _ \\");
  Serial.println(" | |\\  | (_| | |_| | |_| | |_| | | | | | |");
  Serial.println(" |_| \\_|\\__,_|\\__,_|\\__|_|\\__,_|_| |_| |_|");
  Serial.println();
  Serial.println("  NMEA Sim v" FW_VERSION " - Full Boat Simulator");
  Serial.println("  ──────────────────────────────────────────");
  Serial.println("  15 PGNs: engines, tanks, batteries, GPS,");
  Serial.println("  faults, environment, depth, wind, heading,");
  Serial.println("  attitude, water speed, rudder");
  Serial.println("  PGN groups can be enabled/disabled at runtime");
  Serial.println("  Serial: 115200 baud, line-delimited JSON");
  Serial.println("  CAN:    MCP2515 via SPI (CS=5, INT=2)");
  Serial.println();
  Serial.println("  Commands (JSON):");
  Serial.println("    {\"c\":\"ep\",\"p\":\"thr\",\"v\":50}     Engine port throttle");
  Serial.println("    {\"c\":\"ep\",\"p\":\"on\",\"v\":1}       Engine port on/off");
  Serial.println("    {\"c\":\"es\",\"p\":\"thr\",\"v\":-30}    Engine stbd throttle");
  Serial.println("    {\"c\":\"gps\",\"p\":\"lat\",\"v\":25.7}  GPS latitude");
  Serial.println("    {\"c\":\"fault\",\"p\":\"ep_oil\",\"v\":1} Activate fault");
  Serial.println("    {\"c\":\"pgn\",\"p\":\"env\",\"v\":1}     Enable PGN group");
  Serial.println("    {\"c\":\"env\",\"p\":\"wt\",\"v\":20.0}   Set water temp");
  Serial.println("    {\"c\":\"reset\"}                    Reset all");
  Serial.println("  ──────────────────────────────────────────");
  Serial.println();
}

// ====================================================================
//  Simulation
// ====================================================================

// Smooth approach helper: moves current toward target at a rate per second
static double approach(double current, double target, double rate, float dt) {
  if (current < target) return min(current + rate * dt, target);
  if (current > target) return max(current - rate * dt, target);
  return current;
}

void updateSimulation(float dt) {
  double absThrP = fabs(enginePort.throttle);
  double absThrS = fabs(engineStbd.throttle);

  // ── Engine Port ──
  if (enginePort.running) {
    double targetRPM = 600 + (absThrP / 100.0) * 1900;  // 600-2500 RPM
    enginePort.rpm = approach(enginePort.rpm, targetRPM, 800, dt);

    double baseTemp = 75.0 + (absThrP / 100.0) * 15.0;
    if (faults.ep_temp) baseTemp = 115.0 + (absThrP / 100.0) * 10.0;  // overtemp fault
    enginePort.coolantTemp = approach(enginePort.coolantTemp, baseTemp, 5.0, dt);

    double baseOil = 350 + (enginePort.rpm / 2500.0) * 200;
    if (faults.ep_oil) baseOil = 80.0;  // dangerously low
    enginePort.oilPressure = approach(enginePort.oilPressure, baseOil, 100.0, dt);

    enginePort.hours += dt / 3600.0;
    dieselMain.level = max(0.0, dieselMain.level - 0.001 * (absThrP / 50.0) * dt);
  } else {
    enginePort.rpm = approach(enginePort.rpm, 0, 1200, dt);
    enginePort.coolantTemp = approach(enginePort.coolantTemp, 25.0, 0.5, dt);
    enginePort.oilPressure = approach(enginePort.oilPressure, 0, 200.0, dt);
  }

  // ── Engine Starboard ──
  if (engineStbd.running) {
    double targetRPM = 600 + (absThrS / 100.0) * 1900;
    engineStbd.rpm = approach(engineStbd.rpm, targetRPM, 800, dt);

    double baseTemp = 74.0 + (absThrS / 100.0) * 16.0;
    if (faults.es_temp) baseTemp = 118.0 + (absThrS / 100.0) * 8.0;
    engineStbd.coolantTemp = approach(engineStbd.coolantTemp, baseTemp, 5.0, dt);

    double baseOil = 340 + (engineStbd.rpm / 2500.0) * 210;
    if (faults.es_oil) baseOil = 70.0;
    engineStbd.oilPressure = approach(engineStbd.oilPressure, baseOil, 100.0, dt);

    engineStbd.hours += dt / 3600.0;
    dieselMain.level = max(0.0, dieselMain.level - 0.001 * (absThrS / 50.0) * dt);
  } else {
    engineStbd.rpm = approach(engineStbd.rpm, 0, 1200, dt);
    engineStbd.coolantTemp = approach(engineStbd.coolantTemp, 25.0, 0.5, dt);
    engineStbd.oilPressure = approach(engineStbd.oilPressure, 0, 200.0, dt);
  }

  // ── Generator 1 ──
  if (gen1.running) {
    gen1.voltage = 225.0 + random(-20, 20) / 10.0;
    gen1.loadPercent = 45.0 + random(-50, 50) / 10.0;
    double baseTemp = 68.0 + (gen1.loadPercent / 100.0) * 12.0;
    if (faults.g1_temp) baseTemp = 110.0 + random(0, 50) / 10.0;
    gen1.coolantTemp = approach(gen1.coolantTemp, baseTemp, 3.0, dt);
    gen1.hours += dt / 3600.0;
    dieselGen.level = max(0.0, dieselGen.level - 0.0005 * dt);
  } else {
    gen1.voltage = 0;
    gen1.loadPercent = 0;
    gen1.coolantTemp = approach(gen1.coolantTemp, 25.0, 0.5, dt);
  }

  // ── Generator 2 ──
  if (gen2.running) {
    gen2.voltage = 223.0 + random(-20, 20) / 10.0;
    gen2.loadPercent = 35.0 + random(-50, 50) / 10.0;
    double baseTemp = 65.0 + (gen2.loadPercent / 100.0) * 13.0;
    if (faults.g2_temp) baseTemp = 108.0 + random(0, 50) / 10.0;
    gen2.coolantTemp = approach(gen2.coolantTemp, baseTemp, 3.0, dt);
    gen2.hours += dt / 3600.0;
    dieselGen.level = max(0.0, dieselGen.level - 0.0005 * dt);
  } else {
    gen2.voltage = 0;
    gen2.loadPercent = 0;
    gen2.coolantTemp = approach(gen2.coolantTemp, 25.0, 0.5, dt);
  }

  // ── Battery 1 ──
  if (bat1.charging) {
    bat1.current = 15.0 + random(0, 100) / 10.0;
    bat1.soc = min(100.0, bat1.soc + 0.02 * dt);
    bat1.voltage = 27.0 + (bat1.soc / 100.0) * 1.8;
    if (bat1.soc >= 98.0) bat1.charging = false;
  } else {
    bat1.current = -(5.0 + random(0, 80) / 10.0);
    bat1.soc = max(0.0, bat1.soc - 0.01 * dt);
    bat1.voltage = 24.5 + (bat1.soc / 100.0) * 2.0;
    if (bat1.soc <= 20.0) bat1.charging = true;
  }
  if (faults.b1_low) {
    bat1.voltage = 22.0 + random(0, 10) / 10.0;  // dangerously low
    bat1.soc = min(bat1.soc, 10.0);
  }
  bat1.temperature = 24.0 + fabs(bat1.current) * 0.1;

  // ── Battery 2 ──
  if (bat2.charging) {
    bat2.current = 10.0 + random(0, 80) / 10.0;
    bat2.soc = min(100.0, bat2.soc + 0.015 * dt);
    bat2.voltage = 26.5 + (bat2.soc / 100.0) * 1.5;
    if (bat2.soc >= 97.0) bat2.charging = false;
  } else {
    bat2.current = -(3.0 + random(0, 60) / 10.0);
    bat2.soc = max(0.0, bat2.soc - 0.008 * dt);
    bat2.voltage = 24.0 + (bat2.soc / 100.0) * 2.5;
    if (bat2.soc <= 25.0) bat2.charging = true;
  }
  if (faults.b2_low) {
    bat2.voltage = 21.5 + random(0, 10) / 10.0;
    bat2.soc = min(bat2.soc, 8.0);
  }
  bat2.temperature = 23.0 + fabs(bat2.current) * 0.08;

  // ── Fresh water slow consumption ──
  freshWater.level = max(0.0, freshWater.level - 0.0003 * dt);

  // ── GPS drift ──
  // Only drift if engines running, throttle positive, and not fully overridden
  double avgThrottle = 0;
  int engCount = 0;
  if (enginePort.running && enginePort.throttle > 0) { avgThrottle += enginePort.throttle; engCount++; }
  if (engineStbd.running && engineStbd.throttle > 0) { avgThrottle += engineStbd.throttle; engCount++; }
  if (engCount > 0) avgThrottle /= engCount;

  // Compute SOG from throttle if not overridden by browser
  if (!gps.overrideSog) {
    gps.sog = (avgThrottle / 100.0) * 18.0;  // max 18 knots
  }

  // Drift position based on COG and SOG
  if (gps.sog > 0.1 && !gps.overrideLat && !gps.overrideLon) {
    // 1 knot = 1 nautical mile/hr = 1/60 degree lat per hour
    double sogDegPerSec = (gps.sog / 3600.0) / 60.0;  // degrees per second
    double cogRad = gps.cog * PI / 180.0;
    gps.lat += sogDegPerSec * cos(cogRad) * dt;
    gps.lon += sogDegPerSec * sin(cogRad) * dt / cos(gps.lat * PI / 180.0);
  }

  // ── Environment: slow random drift on temps, pressure oscillates ──
  if (pgnGroups.environment) {
    envState.waterTemp += (random(-10, 11) / 100.0) * dt;
    envState.waterTemp = constrain(envState.waterTemp, 0.0, 40.0);
    envState.outsideTemp += (random(-10, 11) / 100.0) * dt;
    envState.outsideTemp = constrain(envState.outsideTemp, -10.0, 50.0);
    envState.atmosphericPressure += (random(-5, 6) / 100.0) * dt;
    envState.atmosphericPressure = constrain(envState.atmosphericPressure, 950.0, 1060.0);
    envState.humidity += (random(-5, 6) / 100.0) * dt;
    envState.humidity = constrain(envState.humidity, 10.0, 100.0);
  }

  // ── Depth: gentle random variation around current depth ──
  if (pgnGroups.depth) {
    depthState.depthBelowTransducer += (random(-50, 51) / 100.0) * dt;
    depthState.depthBelowTransducer = max(0.5, depthState.depthBelowTransducer);
  }

  // ── Wind: random gusts, angle drifts slowly ──
  if (pgnGroups.wind) {
    windState.windSpeed += (random(-200, 201) / 100.0) * dt;
    windState.windSpeed = constrain(windState.windSpeed, 0.0, 30.0);
    windState.windAngle += (random(-50, 51) / 10.0) * dt;
    windState.windAngle = fmod(windState.windAngle, 360.0);
    if (windState.windAngle < 0) windState.windAngle += 360.0;
  }

  // ── Heading: follows COG when engines running, random drift when stopped ──
  if (pgnGroups.heading) {
    if (engCount > 0 && gps.sog > 0.5) {
      headingState.heading = approach(headingState.heading, gps.cog, 15.0, dt);
    } else {
      headingState.heading += (random(-10, 11) / 10.0) * dt;
    }
    headingState.heading = fmod(headingState.heading, 360.0);
    if (headingState.heading < 0) headingState.heading += 360.0;
  }

  // ── Attitude: sine-wave pitch/roll based on wind speed (rougher seas) ──
  if (pgnGroups.attitude) {
    double seaFactor = constrain(windState.windSpeed / 15.0, 0.1, 1.0);
    double t = millis() / 1000.0;
    attitudeState.pitch = seaFactor * 3.0 * sin(t * 0.8);
    attitudeState.roll  = seaFactor * 5.0 * sin(t * 0.5 + 1.2);
    attitudeState.yaw   = seaFactor * 1.0 * sin(t * 0.3 + 2.5);
  }

  // ── Water speed: correlates with SOG (slightly less due to current) ──
  if (pgnGroups.waterSpeed) {
    double targetSTW = gps.sog * 0.92;  // hull slip / current
    waterSpeedState.speedThroughWater = approach(
      waterSpeedState.speedThroughWater, targetSTW, 2.0, dt);
    waterSpeedState.speedThroughWater = max(0.0, waterSpeedState.speedThroughWater);
  }

  // ── Rudder: correlates inversely with COG change rate ──
  if (pgnGroups.rudder) {
    double cogDelta = gps.cog - prevCog;
    // Normalize to -180..+180
    if (cogDelta > 180.0) cogDelta -= 360.0;
    if (cogDelta < -180.0) cogDelta += 360.0;
    double targetAngle = constrain(-cogDelta * 5.0, -45.0, 45.0);
    rudderState.rudderAngle = approach(rudderState.rudderAngle, targetAngle, 20.0, dt);
  }
  prevCog = gps.cog;
}

// ====================================================================
//  NMEA 2000 Transmission
// ====================================================================

// Determine transmission gear from throttle sign
static tN2kTransmissionGear getGear(double throttle) {
  if (throttle > 1.0)  return N2kTG_Forward;
  if (throttle < -1.0) return N2kTG_Reverse;
  return N2kTG_Neutral;
}

void sendNMEA() {
  digitalWrite(LED_TX_PIN, HIGH);
  ledTxOff = millis() + 100;
  digitalWrite(LED_CAN_PIN, HIGH);
  ledCanOff = millis() + 200;

  tN2kMsg N2kMsg;

  // ── Engine PGNs (127488, 127489, 127493) ──
  if (pgnGroups.engines) {
    // PGN 127488 - Engine Rapid Update (RPM)
    SetN2kEngineParamRapid(N2kMsg, 0, enginePort.rpm, N2kDoubleNA, N2kInt8NA);
    NMEA2000.SendMsg(N2kMsg);

    SetN2kEngineParamRapid(N2kMsg, 1, engineStbd.rpm, N2kDoubleNA, N2kInt8NA);
    NMEA2000.SendMsg(N2kMsg);

    // PGN 127489 - Engine Dynamic (temp, oil pressure, hours)
    SetN2kEngineDynamicParam(N2kMsg, 0,
      enginePort.oilPressure * 100.0,       // oil pressure in Pa (kPa * 100)
      CToKelvin(enginePort.coolantTemp),     // oil temp (using coolant as proxy)
      CToKelvin(enginePort.coolantTemp),     // coolant temp
      N2kDoubleNA,                           // alternator voltage
      N2kDoubleNA,                           // fuel rate
      enginePort.hours,                      // engine hours
      N2kDoubleNA,                           // coolant pressure
      N2kDoubleNA,                           // fuel pressure
      N2kInt8NA,                             // engine load
      N2kInt8NA                              // engine torque
    );
    NMEA2000.SendMsg(N2kMsg);

    SetN2kEngineDynamicParam(N2kMsg, 1,
      engineStbd.oilPressure * 100.0,
      CToKelvin(engineStbd.coolantTemp),
      CToKelvin(engineStbd.coolantTemp),
      N2kDoubleNA, N2kDoubleNA,
      engineStbd.hours,
      N2kDoubleNA, N2kDoubleNA,
      N2kInt8NA, N2kInt8NA
    );
    NMEA2000.SendMsg(N2kMsg);

    // PGN 127493 - Transmission Parameters (gear)
    SetN2kTransmissionParameters(N2kMsg, 0, getGear(enginePort.throttle),
      N2kDoubleNA, N2kDoubleNA, N2kInt8NA, N2kTG_Forward, N2kTG_Forward);
    NMEA2000.SendMsg(N2kMsg);

    SetN2kTransmissionParameters(N2kMsg, 1, getGear(engineStbd.throttle),
      N2kDoubleNA, N2kDoubleNA, N2kInt8NA, N2kTG_Forward, N2kTG_Forward);
    NMEA2000.SendMsg(N2kMsg);
  }

  // ── Tank PGNs (127505) ──
  if (pgnGroups.tanks) {
    SetN2kFluidLevel(N2kMsg, 0, N2kft_Fuel, dieselMain.level, dieselMain.capacity);
    NMEA2000.SendMsg(N2kMsg);

    SetN2kFluidLevel(N2kMsg, 1, N2kft_Fuel, dieselGen.level, dieselGen.capacity);
    NMEA2000.SendMsg(N2kMsg);

    SetN2kFluidLevel(N2kMsg, 2, N2kft_Water, freshWater.level, freshWater.capacity);
    NMEA2000.SendMsg(N2kMsg);
  }

  // ── Battery PGNs (127508) ──
  if (pgnGroups.batteries) {
    SetN2kDCBatStatus(N2kMsg, 0, bat1.voltage, bat1.current,
      CToKelvin(bat1.temperature), bat1.soc);
    NMEA2000.SendMsg(N2kMsg);

    SetN2kDCBatStatus(N2kMsg, 1, bat2.voltage, bat2.current,
      CToKelvin(bat2.temperature), bat2.soc);
    NMEA2000.SendMsg(N2kMsg);
  }

  // ── GPS PGNs (129025, 129026) ──
  if (pgnGroups.gps) {
    SetN2kLatLonRapid(N2kMsg, gps.lat, gps.lon);
    NMEA2000.SendMsg(N2kMsg);

    SetN2kCOGSOGRapid(N2kMsg, 1, N2khr_true,
      DegToRad(gps.cog),               // COG in radians
      gps.sog * 1852.0 / 3600.0);      // SOG: knots to m/s
    NMEA2000.SendMsg(N2kMsg);
  }

  // ── Fault PGN (65226) ──
  if (pgnGroups.faults) sendDM1();

  // ── New PGN groups ──
  if (pgnGroups.environment) sendEnvironment();
  if (pgnGroups.depth) sendDepth();
  if (pgnGroups.wind) sendWind();
  if (pgnGroups.heading) sendHeading();
  if (pgnGroups.attitude) sendAttitude();
  if (pgnGroups.waterSpeed) sendWaterSpeed();
  if (pgnGroups.rudder) sendRudder();
}

// ====================================================================
//  DM1 Diagnostic Message (PGN 65226)
// ====================================================================
void sendDM1() {
  // Build a DM1 message manually. Each active fault is a DTC (4 bytes).
  // SPN assignments (custom for this simulator):
  //   ep_oil=100, ep_temp=110, es_oil=101, es_temp=111
  //   g1_temp=200, g2_temp=201, b1_low=300, b2_low=301
  // FMI: 1=high, 4=low, 18=data valid but above normal

  struct DTC {
    uint32_t spn;
    uint8_t  fmi;
  };

  DTC activeDTCs[8];
  int count = 0;

  if (faults.ep_oil)  activeDTCs[count++] = { 100, 4  };  // low oil pressure
  if (faults.ep_temp) activeDTCs[count++] = { 110, 18 };  // overtemp
  if (faults.es_oil)  activeDTCs[count++] = { 101, 4  };
  if (faults.es_temp) activeDTCs[count++] = { 111, 18 };
  if (faults.g1_temp) activeDTCs[count++] = { 200, 18 };
  if (faults.g2_temp) activeDTCs[count++] = { 201, 18 };
  if (faults.b1_low)  activeDTCs[count++] = { 300, 4  };  // low voltage
  if (faults.b2_low)  activeDTCs[count++] = { 301, 4  };

  if (count == 0) return;  // no active faults, no DM1 needed

  tN2kMsg N2kMsg;
  N2kMsg.SetPGN(65226UL);
  N2kMsg.Priority = 6;

  // Lamp status bytes (MIL on, all others off)
  N2kMsg.AddByte(0x00);  // Protect lamp off, amber warning off
  N2kMsg.AddByte(0x04);  // MIL on, red stop off

  for (int i = 0; i < count; i++) {
    uint32_t spn = activeDTCs[i].spn;
    uint8_t fmi  = activeDTCs[i].fmi;
    // J1939 DTC encoding: SPN[18:3] | FMI[4:0] | OC[6:0]
    N2kMsg.AddByte(spn & 0xFF);
    N2kMsg.AddByte((spn >> 8) & 0xFF);
    N2kMsg.AddByte(((spn >> 16) & 0xE0) | (fmi & 0x1F));
    N2kMsg.AddByte(1);  // occurrence count = 1
  }

  NMEA2000.SendMsg(N2kMsg);
}

// ====================================================================
//  New PGN Send Functions
// ====================================================================

// PGN 130310 - Environmental Parameters
void sendEnvironment() {
  tN2kMsg N2kMsg;
  SetN2kOutsideEnvironmentalParameters(N2kMsg, 1,
    CToKelvin(envState.waterTemp),
    CToKelvin(envState.outsideTemp),
    envState.atmosphericPressure * 100.0);  // hPa to Pa
  NMEA2000.SendMsg(N2kMsg);
}

// PGN 128267 - Water Depth
void sendDepth() {
  tN2kMsg N2kMsg;
  SetN2kWaterDepth(N2kMsg, 1,
    depthState.depthBelowTransducer,
    depthState.offset);
  NMEA2000.SendMsg(N2kMsg);
}

// PGN 130306 - Wind Data
void sendWind() {
  tN2kMsg N2kMsg;
  SetN2kWindSpeed(N2kMsg, 1,
    windState.windSpeed,
    DegToRad(windState.windAngle),
    windState.apparent ? N2kWind_Apparent : N2kWind_True_North);
  NMEA2000.SendMsg(N2kMsg);
}

// PGN 127250 - Vessel Heading
void sendHeading() {
  tN2kMsg N2kMsg;
  SetN2kMagneticHeading(N2kMsg, 1,
    DegToRad(headingState.heading),
    DegToRad(headingState.deviation),
    DegToRad(headingState.variation));
  NMEA2000.SendMsg(N2kMsg);
}

// PGN 127257 - Attitude
void sendAttitude() {
  tN2kMsg N2kMsg;
  SetN2kAttitude(N2kMsg, 1,
    DegToRad(attitudeState.yaw),
    DegToRad(attitudeState.pitch),
    DegToRad(attitudeState.roll));
  NMEA2000.SendMsg(N2kMsg);
}

// PGN 128259 - Speed Water Referenced
void sendWaterSpeed() {
  tN2kMsg N2kMsg;
  SetN2kBoatSpeed(N2kMsg, 1,
    knotsToMs(waterSpeedState.speedThroughWater));
  NMEA2000.SendMsg(N2kMsg);
}

// PGN 127245 - Rudder
void sendRudder() {
  tN2kMsg N2kMsg;
  SetN2kRudder(N2kMsg,
    DegToRad(rudderState.rudderAngle),
    0,
    N2kRDO_NoDirectionOrder,
    N2kDoubleNA);
  NMEA2000.SendMsg(N2kMsg);
}

// ====================================================================
//  Status JSON (ESP32 -> Browser, every 1 second)
// ====================================================================
void sendStatusJSON() {
  JsonDocument doc;

  // Engine port
  JsonObject ep = doc["ep"].to<JsonObject>();
  ep["on"]  = enginePort.running ? 1 : 0;
  ep["rpm"] = (int)round(enginePort.rpm);
  ep["thr"] = (int)round(enginePort.throttle);
  ep["tmp"] = round(enginePort.coolantTemp * 10.0) / 10.0;
  ep["oil"] = (int)round(enginePort.oilPressure);
  ep["hrs"] = round(enginePort.hours * 10.0) / 10.0;

  // Engine starboard
  JsonObject es = doc["es"].to<JsonObject>();
  es["on"]  = engineStbd.running ? 1 : 0;
  es["rpm"] = (int)round(engineStbd.rpm);
  es["thr"] = (int)round(engineStbd.throttle);
  es["tmp"] = round(engineStbd.coolantTemp * 10.0) / 10.0;
  es["oil"] = (int)round(engineStbd.oilPressure);
  es["hrs"] = round(engineStbd.hours * 10.0) / 10.0;

  // Generator 1
  JsonObject g1o = doc["g1"].to<JsonObject>();
  g1o["on"]  = gen1.running ? 1 : 0;
  g1o["v"]   = (int)round(gen1.voltage);
  g1o["ld"]  = (int)round(gen1.loadPercent);
  g1o["tmp"] = (int)round(gen1.coolantTemp);
  g1o["hrs"] = round(gen1.hours * 10.0) / 10.0;

  // Generator 2
  JsonObject g2o = doc["g2"].to<JsonObject>();
  g2o["on"]  = gen2.running ? 1 : 0;
  g2o["v"]   = (int)round(gen2.voltage);
  g2o["ld"]  = (int)round(gen2.loadPercent);
  g2o["tmp"] = (int)round(gen2.coolantTemp);
  g2o["hrs"] = round(gen2.hours * 10.0) / 10.0;

  // Battery 1
  JsonObject b1o = doc["b1"].to<JsonObject>();
  b1o["soc"] = (int)round(bat1.soc);
  b1o["v"]   = round(bat1.voltage * 10.0) / 10.0;
  b1o["a"]   = (int)round(bat1.current);
  b1o["tmp"] = (int)round(bat1.temperature);
  b1o["chg"] = bat1.charging ? 1 : 0;

  // Battery 2
  JsonObject b2o = doc["b2"].to<JsonObject>();
  b2o["soc"] = (int)round(bat2.soc);
  b2o["v"]   = round(bat2.voltage * 10.0) / 10.0;
  b2o["a"]   = (int)round(bat2.current);
  b2o["tmp"] = (int)round(bat2.temperature);
  b2o["chg"] = bat2.charging ? 1 : 0;

  // Tanks
  doc["dm"] = round(dieselMain.level * 10.0) / 10.0;
  doc["dg"] = round(dieselGen.level * 10.0) / 10.0;
  doc["fw"] = round(freshWater.level * 10.0) / 10.0;

  // GPS
  JsonObject gpsObj = doc["gps"].to<JsonObject>();
  gpsObj["lat"] = round(gps.lat * 10000.0) / 10000.0;
  gpsObj["lon"] = round(gps.lon * 10000.0) / 10000.0;
  gpsObj["sog"] = round(gps.sog * 10.0) / 10.0;
  gpsObj["cog"] = (int)round(gps.cog);

  // Active faults
  JsonArray fa = doc["faults"].to<JsonArray>();
  if (faults.ep_oil)  fa.add("ep_oil");
  if (faults.ep_temp) fa.add("ep_temp");
  if (faults.es_oil)  fa.add("es_oil");
  if (faults.es_temp) fa.add("es_temp");
  if (faults.g1_temp) fa.add("g1_temp");
  if (faults.g2_temp) fa.add("g2_temp");
  if (faults.b1_low)  fa.add("b1_low");
  if (faults.b2_low)  fa.add("b2_low");

  // Environment
  if (pgnGroups.environment) {
    JsonObject env = doc["env"].to<JsonObject>();
    env["wt"] = round(envState.waterTemp * 10.0) / 10.0;
    env["ot"] = round(envState.outsideTemp * 10.0) / 10.0;
    env["ap"] = round(envState.atmosphericPressure * 10.0) / 10.0;
    env["hu"] = (int)round(envState.humidity);
  }

  // Depth
  if (pgnGroups.depth) {
    JsonObject dep = doc["dep"].to<JsonObject>();
    dep["dbt"] = round(depthState.depthBelowTransducer * 10.0) / 10.0;
    dep["off"] = round(depthState.offset * 10.0) / 10.0;
  }

  // Wind
  if (pgnGroups.wind) {
    JsonObject wnd = doc["wnd"].to<JsonObject>();
    wnd["spd"] = round(windState.windSpeed * 10.0) / 10.0;
    wnd["ang"] = (int)round(windState.windAngle);
    wnd["app"] = windState.apparent ? 1 : 0;
  }

  // Heading
  if (pgnGroups.heading) {
    JsonObject hdg = doc["hdg"].to<JsonObject>();
    hdg["hdg"] = round(headingState.heading * 10.0) / 10.0;
    hdg["dev"] = round(headingState.deviation * 10.0) / 10.0;
    hdg["var"] = round(headingState.variation * 10.0) / 10.0;
  }

  // Attitude
  if (pgnGroups.attitude) {
    JsonObject att = doc["att"].to<JsonObject>();
    att["yaw"]   = round(attitudeState.yaw * 10.0) / 10.0;
    att["pitch"] = round(attitudeState.pitch * 10.0) / 10.0;
    att["roll"]  = round(attitudeState.roll * 10.0) / 10.0;
  }

  // Water speed
  if (pgnGroups.waterSpeed) {
    JsonObject spd = doc["spd"].to<JsonObject>();
    spd["stw"] = round(waterSpeedState.speedThroughWater * 10.0) / 10.0;
  }

  // Rudder
  if (pgnGroups.rudder) {
    JsonObject rud = doc["rud"].to<JsonObject>();
    rud["ang"] = round(rudderState.rudderAngle * 10.0) / 10.0;
  }

  // PGN group flags
  JsonObject pgn = doc["pgn"].to<JsonObject>();
  pgn["eng"] = pgnGroups.engines ? 1 : 0;
  pgn["bat"] = pgnGroups.batteries ? 1 : 0;
  pgn["tnk"] = pgnGroups.tanks ? 1 : 0;
  pgn["gps"] = pgnGroups.gps ? 1 : 0;
  pgn["flt"] = pgnGroups.faults ? 1 : 0;
  pgn["env"] = pgnGroups.environment ? 1 : 0;
  pgn["dep"] = pgnGroups.depth ? 1 : 0;
  pgn["wnd"] = pgnGroups.wind ? 1 : 0;
  pgn["hdg"] = pgnGroups.heading ? 1 : 0;
  pgn["att"] = pgnGroups.attitude ? 1 : 0;
  pgn["spd"] = pgnGroups.waterSpeed ? 1 : 0;
  pgn["rud"] = pgnGroups.rudder ? 1 : 0;

  serializeJson(doc, Serial);
  Serial.println();  // newline delimiter
}

// ====================================================================
//  Serial Command Parser (JSON)
// ====================================================================
void handleSerialLine(const char* line) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, line);
  if (err) {
    Serial.print("{\"error\":\"json_parse\",\"msg\":\"");
    Serial.print(err.c_str());
    Serial.println("\"}");
    return;
  }

  const char* cmd = doc["c"] | "";
  const char* prm = doc["p"] | "";
  double val      = doc["v"] | 0.0;

  // ── Reset ──
  if (strcmp(cmd, "reset") == 0) {
    resetAll();
    Serial.println("{\"ack\":\"reset\"}");
    return;
  }

  // ── Engine Port ──
  if (strcmp(cmd, "ep") == 0) {
    if (strcmp(prm, "on") == 0) {
      enginePort.running = (val != 0);
      if (!enginePort.running) enginePort.throttle = 0;
    } else if (strcmp(prm, "thr") == 0) {
      enginePort.throttle = constrain(val, -100.0, 100.0);
    }
    Serial.println("{\"ack\":\"ep\"}");
    return;
  }

  // ── Engine Starboard ──
  if (strcmp(cmd, "es") == 0) {
    if (strcmp(prm, "on") == 0) {
      engineStbd.running = (val != 0);
      if (!engineStbd.running) engineStbd.throttle = 0;
    } else if (strcmp(prm, "thr") == 0) {
      engineStbd.throttle = constrain(val, -100.0, 100.0);
    }
    Serial.println("{\"ack\":\"es\"}");
    return;
  }

  // ── Generator 1 ──
  if (strcmp(cmd, "g1") == 0) {
    if (strcmp(prm, "on") == 0) gen1.running = (val != 0);
    Serial.println("{\"ack\":\"g1\"}");
    return;
  }

  // ── Generator 2 ──
  if (strcmp(cmd, "g2") == 0) {
    if (strcmp(prm, "on") == 0) gen2.running = (val != 0);
    Serial.println("{\"ack\":\"g2\"}");
    return;
  }

  // ── Battery 1 ──
  if (strcmp(cmd, "b1") == 0) {
    if (strcmp(prm, "chg") == 0) bat1.charging = (val != 0);
    Serial.println("{\"ack\":\"b1\"}");
    return;
  }

  // ── Battery 2 ──
  if (strcmp(cmd, "b2") == 0) {
    if (strcmp(prm, "chg") == 0) bat2.charging = (val != 0);
    Serial.println("{\"ack\":\"b2\"}");
    return;
  }

  // ── Tanks ──
  if (strcmp(cmd, "t") == 0) {
    if (strcmp(prm, "dm") == 0)      dieselMain.level = constrain(val, 0.0, 100.0);
    else if (strcmp(prm, "dg") == 0) dieselGen.level  = constrain(val, 0.0, 100.0);
    else if (strcmp(prm, "fw") == 0) freshWater.level  = constrain(val, 0.0, 100.0);
    Serial.println("{\"ack\":\"t\"}");
    return;
  }

  // ── GPS ──
  if (strcmp(cmd, "gps") == 0) {
    if (strcmp(prm, "lat") == 0) {
      gps.lat = val;
      gps.overrideLat = true;
    } else if (strcmp(prm, "lon") == 0) {
      gps.lon = val;
      gps.overrideLon = true;
    } else if (strcmp(prm, "sog") == 0) {
      gps.sog = max(0.0, val);
      gps.overrideSog = true;
    } else if (strcmp(prm, "cog") == 0) {
      gps.cog = fmod(val, 360.0);
      if (gps.cog < 0) gps.cog += 360.0;
      gps.overrideCog = true;
    }
    Serial.println("{\"ack\":\"gps\"}");
    return;
  }

  // ── PGN Group Enable/Disable ──
  if (strcmp(cmd, "pgn") == 0) {
    bool enabled = (val != 0);
    if (strcmp(prm, "eng") == 0)      pgnGroups.engines = enabled;
    else if (strcmp(prm, "bat") == 0) pgnGroups.batteries = enabled;
    else if (strcmp(prm, "tnk") == 0) pgnGroups.tanks = enabled;
    else if (strcmp(prm, "gps") == 0) pgnGroups.gps = enabled;
    else if (strcmp(prm, "flt") == 0) pgnGroups.faults = enabled;
    else if (strcmp(prm, "env") == 0) pgnGroups.environment = enabled;
    else if (strcmp(prm, "dep") == 0) pgnGroups.depth = enabled;
    else if (strcmp(prm, "wnd") == 0) pgnGroups.wind = enabled;
    else if (strcmp(prm, "hdg") == 0) pgnGroups.heading = enabled;
    else if (strcmp(prm, "att") == 0) pgnGroups.attitude = enabled;
    else if (strcmp(prm, "spd") == 0) pgnGroups.waterSpeed = enabled;
    else if (strcmp(prm, "rud") == 0) pgnGroups.rudder = enabled;
    Serial.println("{\"ack\":\"pgn\"}");
    return;
  }

  // ── Environment ──
  if (strcmp(cmd, "env") == 0) {
    if (strcmp(prm, "wt") == 0)      envState.waterTemp = val;
    else if (strcmp(prm, "ot") == 0) envState.outsideTemp = val;
    else if (strcmp(prm, "ap") == 0) envState.atmosphericPressure = val;
    else if (strcmp(prm, "hu") == 0) envState.humidity = constrain(val, 0.0, 100.0);
    Serial.println("{\"ack\":\"env\"}");
    return;
  }

  // ── Depth ──
  if (strcmp(cmd, "dep") == 0) {
    if (strcmp(prm, "depth") == 0)     depthState.depthBelowTransducer = max(0.0, val);
    else if (strcmp(prm, "offset") == 0) depthState.offset = val;
    Serial.println("{\"ack\":\"dep\"}");
    return;
  }

  // ── Wind ──
  if (strcmp(cmd, "wnd") == 0) {
    if (strcmp(prm, "speed") == 0)     windState.windSpeed = max(0.0, val);
    else if (strcmp(prm, "angle") == 0) {
      windState.windAngle = fmod(val, 360.0);
      if (windState.windAngle < 0) windState.windAngle += 360.0;
    }
    else if (strcmp(prm, "mode") == 0) windState.apparent = (val == 0);  // 0=apparent, 1=true
    Serial.println("{\"ack\":\"wnd\"}");
    return;
  }

  // ── Heading ──
  if (strcmp(cmd, "hdg") == 0) {
    if (strcmp(prm, "heading") == 0) {
      headingState.heading = fmod(val, 360.0);
      if (headingState.heading < 0) headingState.heading += 360.0;
    }
    else if (strcmp(prm, "dev") == 0) headingState.deviation = val;
    else if (strcmp(prm, "var") == 0) headingState.variation = val;
    Serial.println("{\"ack\":\"hdg\"}");
    return;
  }

  // ── Attitude ──
  if (strcmp(cmd, "att") == 0) {
    if (strcmp(prm, "yaw") == 0)        attitudeState.yaw = val;
    else if (strcmp(prm, "pitch") == 0) attitudeState.pitch = val;
    else if (strcmp(prm, "roll") == 0)  attitudeState.roll = val;
    Serial.println("{\"ack\":\"att\"}");
    return;
  }

  // ── Water Speed ──
  if (strcmp(cmd, "spd") == 0) {
    if (strcmp(prm, "stw") == 0) waterSpeedState.speedThroughWater = max(0.0, val);
    Serial.println("{\"ack\":\"spd\"}");
    return;
  }

  // ── Rudder ──
  if (strcmp(cmd, "rud") == 0) {
    if (strcmp(prm, "angle") == 0) rudderState.rudderAngle = constrain(val, -45.0, 45.0);
    Serial.println("{\"ack\":\"rud\"}");
    return;
  }

  // ── Faults ──
  if (strcmp(cmd, "fault") == 0) {
    bool active = (val != 0);
    if (strcmp(prm, "ep_oil") == 0)       faults.ep_oil  = active;
    else if (strcmp(prm, "ep_temp") == 0) faults.ep_temp = active;
    else if (strcmp(prm, "es_oil") == 0)  faults.es_oil  = active;
    else if (strcmp(prm, "es_temp") == 0) faults.es_temp = active;
    else if (strcmp(prm, "g1_temp") == 0) faults.g1_temp = active;
    else if (strcmp(prm, "g2_temp") == 0) faults.g2_temp = active;
    else if (strcmp(prm, "b1_low") == 0)  faults.b1_low  = active;
    else if (strcmp(prm, "b2_low") == 0)  faults.b2_low  = active;
    else {
      Serial.println("{\"error\":\"unknown_fault\"}");
      return;
    }
    Serial.println("{\"ack\":\"fault\"}");
    return;
  }

  Serial.println("{\"error\":\"unknown_cmd\"}");
}

// ====================================================================
//  Reset
// ====================================================================
void resetAll() {
  enginePort  = { false, 0, DEF_EP_HOURS, 25.0, 0, 0 };
  engineStbd  = { false, 0, DEF_ES_HOURS, 25.0, 0, 0 };
  gen1        = { false, DEF_G1_HOURS, 0, 0, 25.0 };
  gen2        = { false, DEF_G2_HOURS, 0, 0, 25.0 };
  bat1        = { 87.0, 26.5,  15.0, 25.0, true  };
  bat2        = { 92.0, 26.8, -10.0, 24.0, false };
  dieselMain.level = 80.0;
  dieselGen.level  = 50.0;
  freshWater.level = 70.0;
  gps = { 25.7617, -80.1918, 0, 180.0, false, false, false, false };
  faults = { false, false, false, false, false, false, false, false };
  pgnGroups = { true, true, true, true, true, false, false, false, false, false, false, false };
  envState       = { 22.0, 28.0, 1013.25, 65.0 };
  depthState     = { 15.0, 0.5 };
  windState      = { 5.0, 45.0, true };
  headingState   = { 180.0, -2.0, -4.5 };
  attitudeState  = { 0.0, 0.5, 1.0 };
  waterSpeedState = { 0.0 };
  rudderState    = { 0.0 };
  prevCog = 180.0;
}

// ====================================================================
//  Serial Reader (line buffering)
// ====================================================================
void readSerial() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialBufPos > 0) {
        serialBuf[serialBufPos] = '\0';
        handleSerialLine(serialBuf);
        serialBufPos = 0;
      }
    } else {
      if (serialBufPos < SERIAL_BUF_SIZE - 1) {
        serialBuf[serialBufPos++] = c;
      } else {
        // Buffer overflow, discard
        serialBufPos = 0;
      }
    }
  }
}

// ====================================================================
//  Main Loop
// ====================================================================
void loop() {
  unsigned long now = millis();

  readSerial();
  NMEA2000.ParseMessages();

  // Turn off LED blinks after timeout
  if (ledTxOff && now >= ledTxOff)  { digitalWrite(LED_TX_PIN, LOW);  ledTxOff = 0; }
  if (ledCanOff && now >= ledCanOff) { digitalWrite(LED_CAN_PIN, LOW); ledCanOff = 0; }

  // Simulation tick (100ms for smooth value transitions)
  if (now - lastSim >= SIM_INTERVAL_MS) {
    float dt = (now - lastSim) / 1000.0;
    lastSim = now;
    updateSimulation(dt);
  }

  // NMEA transmit + status JSON (1 second)
  if (now - lastSend >= SEND_INTERVAL_MS) {
    lastSend = now;
    sendNMEA();
    sendStatusJSON();
  }
}
