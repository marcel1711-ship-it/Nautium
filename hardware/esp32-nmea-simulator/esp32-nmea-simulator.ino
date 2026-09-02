/*
 * Nautium NMEA 2000 Boat Simulator
 * =================================
 * Runs on: ESP32 + CAN transceiver (MCP2515 or SN65HVD230)
 *
 * Simulates a yacht with:
 *   - 2 Main Engines (Port / Starboard)
 *   - 2 Generators
 *   - 2 Battery Banks
 *   - 3 Tanks (Diesel Main, Diesel Gen, Fresh Water)
 *
 * Wiring (ESP32 → CAN transceiver):
 *   GPIO 4  → CAN TX
 *   GPIO 5  → CAN RX
 *   3.3V    → VCC
 *   GND     → GND
 *   CAN_H   → NMEA 2000 backbone (pin 5 / blue)
 *   CAN_L   → NMEA 2000 backbone (pin 4 / white)
 *   Shield  → NMEA 2000 backbone (pin 3 / shield)
 *
 * Libraries needed (install via Arduino Library Manager):
 *   - NMEA2000 by Timo Lappalainen
 *   - NMEA2000_esp32 by Timo Lappalainen
 *
 * Serial Monitor (115200 baud) shows current values.
 * Use Serial commands to control the simulation:
 *   E1  = Toggle Engine Port ON/OFF
 *   E2  = Toggle Engine Starboard ON/OFF
 *   G1  = Toggle Generator 1 ON/OFF
 *   G2  = Toggle Generator 2 ON/OFF
 *   T+  = Throttle up (both engines)
 *   T-  = Throttle down (both engines)
 *   R   = Reset all to defaults
 */

#include <Arduino.h>
#include <NMEA2000_CAN.h>
#include <N2kMessages.h>

// ── CAN pins ──
#define ESP32_CAN_TX_PIN GPIO_NUM_4
#define ESP32_CAN_RX_PIN GPIO_NUM_5

// ── Timing ──
#define SEND_INTERVAL_MS    1000   // Send every 1 second
#define PRINT_INTERVAL_MS   5000   // Print to serial every 5 seconds

unsigned long lastSend = 0;
unsigned long lastPrint = 0;

// ── Simulation State ──
struct EngineState {
  bool running;
  double rpm;
  double hours;
  double coolantTemp;   // °C
  double oilPressure;   // kPa (1 bar = 100 kPa)
  double throttle;      // 0-100%
};

struct GeneratorState {
  bool running;
  double hours;
  double voltage;       // V
  double loadPercent;   // %
  double coolantTemp;   // °C
};

struct BatteryState {
  double soc;           // 0-100%
  double voltage;       // V
  double current;       // A (positive = charging)
  double temperature;   // °C
  bool charging;
};

struct TankState {
  double level;         // 0-100%
  uint8_t fluidType;    // N2kft_Fuel=0, N2kft_Water=1, N2kft_GrayWater=2, N2kft_BlackWater=4
  double capacity;      // liters
};

// Equipment instances
EngineState enginePort  = { true, 0, 2847.0, 25.0, 0, 50.0 };
EngineState engineStbd  = { true, 0, 2831.0, 25.0, 0, 50.0 };
GeneratorState gen1     = { true, 1205.0, 0, 0, 25.0 };
GeneratorState gen2     = { false, 890.0, 0, 0, 25.0 };
BatteryState bat1       = { 87.0, 26.5, 15.0, 25.0, true };
BatteryState bat2       = { 92.0, 26.8, -10.0, 24.0, false };
TankState dieselMain    = { 52.5, 0, 8000.0 };    // N2kft_Fuel
TankState dieselGen     = { 12.1, 0, 1000.0 };    // N2kft_Fuel
TankState freshWater    = { 60.0, 1, 2000.0 };    // N2kft_Water

// ── NMEA 2000 device info ──
const unsigned long TX_PGNS[] = {
  127488UL,  // Engine Rapid - RPM
  127489UL,  // Engine Dynamic - temp, oil, hours
  127505UL,  // Fluid Level - tanks
  127506UL,  // DC Detailed Status - battery
  127508UL,  // DC Battery Status - voltage/current
  0
};

// ── Setup ──
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.println("  =============================================");
  Serial.println("  Nautium NMEA 2000 Boat Simulator");
  Serial.println("  =============================================");
  Serial.println();
  Serial.println("  Commands (type in Serial Monitor):");
  Serial.println("    E1 = Toggle Engine Port");
  Serial.println("    E2 = Toggle Engine Starboard");
  Serial.println("    G1 = Toggle Generator 1");
  Serial.println("    G2 = Toggle Generator 2");
  Serial.println("    T+ = Throttle up (+10%)");
  Serial.println("    T- = Throttle down (-10%)");
  Serial.println("    R  = Reset all");
  Serial.println();

  // NMEA 2000 setup
  NMEA2000.SetProductInformation(
    "NAU-SIM-001",           // Serial number
    100,                      // Product code
    "Nautium Boat Simulator", // Model ID
    "1.0.0",                  // Software version
    "1.0.0"                   // Model version
  );

  NMEA2000.SetDeviceInformation(
    1,    // Unique number
    130,  // Device function: PC gateway
    25,   // Device class: Inter/Intranetwork Device
    2046  // Manufacturer code (generic)
  );

  NMEA2000.SetMode(tNMEA2000::N2km_NodeOnly, 22);
  NMEA2000.EnableForward(false);
  NMEA2000.SetTransmitPGNs(TX_PGNS);
  NMEA2000.Open();

  Serial.println("  NMEA 2000 bus initialized. Transmitting...");
  Serial.println();
}

// ── Simulation logic ──
void updateSimulation() {
  float dt = SEND_INTERVAL_MS / 1000.0;

  // Engine Port
  if (enginePort.running) {
    enginePort.rpm = 600 + (enginePort.throttle / 100.0) * 1900;  // 600-2500 RPM
    enginePort.coolantTemp = 75.0 + (enginePort.throttle / 100.0) * 15.0;
    enginePort.oilPressure = 350 + (enginePort.rpm / 2500.0) * 200;  // kPa
    enginePort.hours += dt / 3600.0;
    dieselMain.level = max(0.0, dieselMain.level - 0.001 * (enginePort.throttle / 50.0));
  } else {
    enginePort.rpm = 0;
    enginePort.coolantTemp = max(25.0, enginePort.coolantTemp - 0.1);
    enginePort.oilPressure = 0;
  }

  // Engine Starboard
  if (engineStbd.running) {
    engineStbd.rpm = 600 + (engineStbd.throttle / 100.0) * 1900;
    engineStbd.coolantTemp = 74.0 + (engineStbd.throttle / 100.0) * 16.0;
    engineStbd.oilPressure = 340 + (engineStbd.rpm / 2500.0) * 210;
    engineStbd.hours += dt / 3600.0;
    dieselMain.level = max(0.0, dieselMain.level - 0.001 * (engineStbd.throttle / 50.0));
  } else {
    engineStbd.rpm = 0;
    engineStbd.coolantTemp = max(25.0, engineStbd.coolantTemp - 0.1);
    engineStbd.oilPressure = 0;
  }

  // Generator 1
  if (gen1.running) {
    gen1.voltage = 225.0 + random(-20, 20) / 10.0;
    gen1.loadPercent = 45.0 + random(-50, 50) / 10.0;
    gen1.coolantTemp = 68.0 + (gen1.loadPercent / 100.0) * 12.0;
    gen1.hours += dt / 3600.0;
    dieselGen.level = max(0.0, dieselGen.level - 0.0005);
  } else {
    gen1.voltage = 0;
    gen1.loadPercent = 0;
    gen1.coolantTemp = max(25.0, gen1.coolantTemp - 0.1);
  }

  // Generator 2
  if (gen2.running) {
    gen2.voltage = 223.0 + random(-20, 20) / 10.0;
    gen2.loadPercent = 35.0 + random(-50, 50) / 10.0;
    gen2.coolantTemp = 65.0 + (gen2.loadPercent / 100.0) * 13.0;
    gen2.hours += dt / 3600.0;
    dieselGen.level = max(0.0, dieselGen.level - 0.0005);
  } else {
    gen2.voltage = 0;
    gen2.loadPercent = 0;
    gen2.coolantTemp = max(25.0, gen2.coolantTemp - 0.1);
  }

  // Battery 1
  if (bat1.charging) {
    bat1.current = 15.0 + random(0, 100) / 10.0;
    bat1.soc = min(100.0, bat1.soc + 0.02);
    bat1.voltage = 27.0 + (bat1.soc / 100.0) * 1.8;
    if (bat1.soc >= 98.0) bat1.charging = false;
  } else {
    bat1.current = -(5.0 + random(0, 80) / 10.0);
    bat1.soc = max(0.0, bat1.soc - 0.01);
    bat1.voltage = 24.5 + (bat1.soc / 100.0) * 2.0;
    if (bat1.soc <= 20.0) bat1.charging = true;
  }
  bat1.temperature = 24.0 + abs(bat1.current) * 0.1;

  // Battery 2
  if (bat2.charging) {
    bat2.current = 10.0 + random(0, 80) / 10.0;
    bat2.soc = min(100.0, bat2.soc + 0.015);
    bat2.voltage = 26.5 + (bat2.soc / 100.0) * 1.5;
    if (bat2.soc >= 97.0) bat2.charging = false;
  } else {
    bat2.current = -(3.0 + random(0, 60) / 10.0);
    bat2.soc = max(0.0, bat2.soc - 0.008);
    bat2.voltage = 24.0 + (bat2.soc / 100.0) * 2.5;
    if (bat2.soc <= 25.0) bat2.charging = true;
  }
  bat2.temperature = 23.0 + abs(bat2.current) * 0.08;

  // Fresh water slow consumption
  freshWater.level = max(0.0, freshWater.level - 0.0003);
}

// ── Send NMEA 2000 messages ──
void sendNMEA() {
  tN2kMsg N2kMsg;

  // PGN 127488 - Engine Rapid Update (RPM)
  // Engine 0 = Port
  SetN2kEngineParamRapid(N2kMsg, 0, enginePort.rpm, N2kDoubleNA, N2kInt8NA);
  NMEA2000.SendMsg(N2kMsg);

  // Engine 1 = Starboard
  SetN2kEngineParamRapid(N2kMsg, 1, engineStbd.rpm, N2kDoubleNA, N2kInt8NA);
  NMEA2000.SendMsg(N2kMsg);

  // PGN 127489 - Engine Dynamic (temp, oil pressure, hours)
  SetN2kEngineDynamicParam(N2kMsg, 0,
    CToKelvin(enginePort.oilPressure > 0 ? enginePort.oilPressure * 100 : 0), // oil pressure Pa
    CToKelvin(enginePort.coolantTemp),  // oil temp (using coolant as proxy)
    CToKelvin(enginePort.coolantTemp),  // coolant temp
    N2kDoubleNA,                        // alternator voltage
    N2kDoubleNA,                        // fuel rate
    enginePort.hours,                   // engine hours
    N2kDoubleNA,                        // coolant pressure
    N2kDoubleNA,                        // fuel pressure
    N2kInt8NA,                          // engine load
    N2kInt8NA                           // engine torque
  );
  NMEA2000.SendMsg(N2kMsg);

  SetN2kEngineDynamicParam(N2kMsg, 1,
    CToKelvin(engineStbd.oilPressure > 0 ? engineStbd.oilPressure * 100 : 0),
    CToKelvin(engineStbd.coolantTemp),
    CToKelvin(engineStbd.coolantTemp),
    N2kDoubleNA, N2kDoubleNA,
    engineStbd.hours,
    N2kDoubleNA, N2kDoubleNA,
    N2kInt8NA, N2kInt8NA
  );
  NMEA2000.SendMsg(N2kMsg);

  // PGN 127505 - Fluid Level (tanks)
  SetN2kFluidLevel(N2kMsg, 0, N2kft_Fuel, dieselMain.level, dieselMain.capacity);
  NMEA2000.SendMsg(N2kMsg);

  SetN2kFluidLevel(N2kMsg, 1, N2kft_Fuel, dieselGen.level, dieselGen.capacity);
  NMEA2000.SendMsg(N2kMsg);

  SetN2kFluidLevel(N2kMsg, 2, N2kft_Water, freshWater.level, freshWater.capacity);
  NMEA2000.SendMsg(N2kMsg);

  // PGN 127508 - Battery Status (voltage, current, temp)
  SetN2kDCBatStatus(N2kMsg, 0, bat1.voltage, bat1.current, CToKelvin(bat1.temperature), bat1.soc);
  NMEA2000.SendMsg(N2kMsg);

  SetN2kDCBatStatus(N2kMsg, 1, bat2.voltage, bat2.current, CToKelvin(bat2.temperature), bat2.soc);
  NMEA2000.SendMsg(N2kMsg);
}

// ── Serial commands ──
void handleSerial() {
  if (!Serial.available()) return;

  String cmd = Serial.readStringUntil('\n');
  cmd.trim();
  cmd.toUpperCase();

  if (cmd == "E1") {
    enginePort.running = !enginePort.running;
    Serial.printf(">> Engine Port: %s\n", enginePort.running ? "ON" : "OFF");
  }
  else if (cmd == "E2") {
    engineStbd.running = !engineStbd.running;
    Serial.printf(">> Engine Stbd: %s\n", engineStbd.running ? "ON" : "OFF");
  }
  else if (cmd == "G1") {
    gen1.running = !gen1.running;
    Serial.printf(">> Generator 1: %s\n", gen1.running ? "ON" : "OFF");
  }
  else if (cmd == "G2") {
    gen2.running = !gen2.running;
    Serial.printf(">> Generator 2: %s\n", gen2.running ? "ON" : "OFF");
  }
  else if (cmd == "T+") {
    enginePort.throttle = min(100.0, enginePort.throttle + 10.0);
    engineStbd.throttle = min(100.0, engineStbd.throttle + 10.0);
    Serial.printf(">> Throttle: %.0f%%\n", enginePort.throttle);
  }
  else if (cmd == "T-") {
    enginePort.throttle = max(0.0, enginePort.throttle - 10.0);
    engineStbd.throttle = max(0.0, engineStbd.throttle - 10.0);
    Serial.printf(">> Throttle: %.0f%%\n", enginePort.throttle);
  }
  else if (cmd == "R") {
    enginePort = { true, 0, 2847.0, 25.0, 0, 50.0 };
    engineStbd = { true, 0, 2831.0, 25.0, 0, 50.0 };
    gen1 = { true, 1205.0, 0, 0, 25.0 };
    gen2 = { false, 890.0, 0, 0, 25.0 };
    bat1 = { 87.0, 26.5, 15.0, 25.0, true };
    bat2 = { 92.0, 26.8, -10.0, 24.0, false };
    dieselMain.level = 52.5;
    dieselGen.level = 12.1;
    freshWater.level = 60.0;
    Serial.println(">> All reset to defaults");
  }
  else {
    Serial.println(">> Unknown command. Use: E1 E2 G1 G2 T+ T- R");
  }
}

// ── Print status to Serial ──
void printStatus() {
  Serial.println("─────────────────────────────────────────────");
  Serial.printf("  PORT  %s  RPM:%4.0f  Temp:%.1f°C  Oil:%.0fkPa  Hrs:%.1f  Thr:%.0f%%\n",
    enginePort.running ? "ON " : "OFF", enginePort.rpm, enginePort.coolantTemp,
    enginePort.oilPressure, enginePort.hours, enginePort.throttle);
  Serial.printf("  STBD  %s  RPM:%4.0f  Temp:%.1f°C  Oil:%.0fkPa  Hrs:%.1f  Thr:%.0f%%\n",
    engineStbd.running ? "ON " : "OFF", engineStbd.rpm, engineStbd.coolantTemp,
    engineStbd.oilPressure, engineStbd.hours, engineStbd.throttle);
  Serial.printf("  GEN1  %s  V:%.0f  Load:%.0f%%  Temp:%.1f°C  Hrs:%.1f\n",
    gen1.running ? "ON " : "OFF", gen1.voltage, gen1.loadPercent, gen1.coolantTemp, gen1.hours);
  Serial.printf("  GEN2  %s  V:%.0f  Load:%.0f%%  Temp:%.1f°C  Hrs:%.1f\n",
    gen2.running ? "ON " : "OFF", gen2.voltage, gen2.loadPercent, gen2.coolantTemp, gen2.hours);
  Serial.printf("  BAT1  SOC:%.1f%%  V:%.1f  A:%+.1f  %s\n",
    bat1.soc, bat1.voltage, bat1.current, bat1.charging ? "CHARGING" : "DISCHARGING");
  Serial.printf("  BAT2  SOC:%.1f%%  V:%.1f  A:%+.1f  %s\n",
    bat2.soc, bat2.voltage, bat2.current, bat2.charging ? "CHARGING" : "DISCHARGING");
  Serial.printf("  DIESEL: %.1f%%  GEN DIESEL: %.1f%%  WATER: %.1f%%\n",
    dieselMain.level, dieselGen.level, freshWater.level);
  Serial.println("─────────────────────────────────────────────");
}

// ── Main loop ──
void loop() {
  unsigned long now = millis();

  handleSerial();
  NMEA2000.ParseMessages();

  if (now - lastSend >= SEND_INTERVAL_MS) {
    lastSend = now;
    updateSimulation();
    sendNMEA();
  }

  if (now - lastPrint >= PRINT_INTERVAL_MS) {
    lastPrint = now;
    printStatus();
  }
}
