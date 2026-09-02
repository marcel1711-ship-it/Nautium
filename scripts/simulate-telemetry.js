/**
 * Nautium Telemetry Simulator
 *
 * Sends simulated NMEA 2000 sensor data for vessel "Dream" to the
 * ingest-telemetry edge function. Run with:
 *
 *   node scripts/simulate-telemetry.js
 *
 * Before running, set the TELEMETRY_API_KEY secret in Supabase:
 *   Dashboard → Settings → Edge Functions → Secrets → Add
 *   Key: TELEMETRY_API_KEY
 *   Value: (use the API_KEY value below or change both to match)
 */

const SUPABASE_URL = 'https://fsxjbgopxxbtidlkkafc.supabase.co';
const API_KEY = 'nautium-telemetry-demo-2026';

const VESSEL_ID = '21b73fc5-1d5b-47e6-b151-a015201b7461'; // Dream
const COMPANY_ID = '44b5ce45-0feb-49b4-bc25-f470a89ed064';

// Equipment IDs from Dream
const EQUIPMENT = {
  enginePort:  '2093e329-8a55-4399-a91f-e684648e36c9',
  engineStbd:  '51ed6f0f-63bf-433a-b0e6-532ce12993a9',
  generator1:  'c8355826-8c3a-4afc-b973-bb05a36bf621',
  generator2:  '793d6735-e58c-4fed-9a7b-32870f4e5e95',
  hvac:        'a9507c0e-04e4-46f1-b928-b9edcf5ee6e0',
  bowThruster: '0d20528d-5c73-4449-85cf-9e9337f02fd7',
};

const BATTERIES = {
  bank1: '32065a8a-5270-43d3-942a-baf9db9c0d54',
  bank2: '29f2cd98-d51b-4dab-b6f6-d1c72e05b9a1',
};

// Fuel resource IDs from Dream
const RESOURCES = {
  dieselMain: '34b4311a-ecdd-40b1-b0de-d3a4536b5063',
  freshWater: 'a069cd29-090b-4427-a3fe-e5592aa46868',
  dieselGen:  '4b1b9b65-c14a-41ef-99ec-e19056787d68',
};

// Simulation state (persists between ticks)
const state = {
  enginePortHours: 2847,
  engineStbdHours: 2831,
  gen1Hours: 1205,
  gen2Hours: 890,
  hvacHours: 3420,
  bat1Soc: 87,             // state of charge %
  bat2Soc: 92,
  bat1Charging: true,
  dieselMainLevel: 52.5,   // percentage
  freshWaterLevel: 60.0,
  dieselGenLevel: 12.1,
  enginesRunning: true,
  gen1Running: true,
  gen2Running: false,
};

function rand(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function buildReadings() {
  // Simulate time passing
  if (state.enginesRunning) {
    state.enginePortHours += 0.1;
    state.engineStbdHours += 0.1;
    state.dieselMainLevel = Math.max(0, state.dieselMainLevel - rand(0.05, 0.15));
  }
  if (state.gen1Running) {
    state.gen1Hours += 0.1;
    state.dieselGenLevel = Math.max(0, state.dieselGenLevel - rand(0.02, 0.08));
  }
  if (state.gen2Running) {
    state.gen2Hours += 0.1;
  }
  state.hvacHours += 0.1;
  state.freshWaterLevel = Math.max(0, state.freshWaterLevel - rand(0.01, 0.05));

  // Battery simulation: charging increases SOC, discharging decreases
  if (state.bat1Charging) {
    state.bat1Soc = Math.min(100, state.bat1Soc + rand(0.1, 0.4));
    if (state.bat1Soc >= 98) state.bat1Charging = false;
  } else {
    state.bat1Soc = Math.max(0, state.bat1Soc - rand(0.05, 0.2));
    if (state.bat1Soc <= 20) state.bat1Charging = true;
  }
  state.bat2Soc = Math.max(0, Math.min(100, state.bat2Soc + rand(-0.15, 0.25)));

  // Randomly toggle gen2 on/off
  if (Math.random() < 0.05) state.gen2Running = !state.gen2Running;

  const readings = [
    // ── Main Engine Port ──
    { equipment_id: EQUIPMENT.enginePort, metric: 'status', value: state.enginesRunning ? 1 : 0, unit: '' },
    { equipment_id: EQUIPMENT.enginePort, metric: 'hours', value: Math.round(state.enginePortHours * 10) / 10, unit: 'hrs' },
    { equipment_id: EQUIPMENT.enginePort, metric: 'rpm', value: state.enginesRunning ? rand(1100, 1400) : 0, unit: 'rpm' },
    { equipment_id: EQUIPMENT.enginePort, metric: 'temperature', value: state.enginesRunning ? rand(78, 88) : rand(20, 25), unit: '°C' },
    { equipment_id: EQUIPMENT.enginePort, metric: 'oil_pressure', value: state.enginesRunning ? rand(3.5, 5.2) : 0, unit: 'bar' },

    // ── Main Engine Starboard ──
    { equipment_id: EQUIPMENT.engineStbd, metric: 'status', value: state.enginesRunning ? 1 : 0, unit: '' },
    { equipment_id: EQUIPMENT.engineStbd, metric: 'hours', value: Math.round(state.engineStbdHours * 10) / 10, unit: 'hrs' },
    { equipment_id: EQUIPMENT.engineStbd, metric: 'rpm', value: state.enginesRunning ? rand(1080, 1380) : 0, unit: 'rpm' },
    { equipment_id: EQUIPMENT.engineStbd, metric: 'temperature', value: state.enginesRunning ? rand(76, 86) : rand(20, 25), unit: '°C' },
    { equipment_id: EQUIPMENT.engineStbd, metric: 'oil_pressure', value: state.enginesRunning ? rand(3.4, 5.0) : 0, unit: 'bar' },

    // ── Generator 1 ──
    { equipment_id: EQUIPMENT.generator1, metric: 'status', value: state.gen1Running ? 1 : 0, unit: '' },
    { equipment_id: EQUIPMENT.generator1, metric: 'hours', value: Math.round(state.gen1Hours * 10) / 10, unit: 'hrs' },
    { equipment_id: EQUIPMENT.generator1, metric: 'voltage', value: state.gen1Running ? rand(220, 235) : 0, unit: 'V' },
    { equipment_id: EQUIPMENT.generator1, metric: 'load', value: state.gen1Running ? rand(40, 72) : 0, unit: '%' },
    { equipment_id: EQUIPMENT.generator1, metric: 'temperature', value: state.gen1Running ? rand(65, 80) : rand(20, 25), unit: '°C' },

    // ── Generator 2 ──
    { equipment_id: EQUIPMENT.generator2, metric: 'status', value: state.gen2Running ? 1 : 0, unit: '' },
    { equipment_id: EQUIPMENT.generator2, metric: 'hours', value: Math.round(state.gen2Hours * 10) / 10, unit: 'hrs' },
    { equipment_id: EQUIPMENT.generator2, metric: 'voltage', value: state.gen2Running ? rand(218, 232) : 0, unit: 'V' },
    { equipment_id: EQUIPMENT.generator2, metric: 'load', value: state.gen2Running ? rand(30, 55) : 0, unit: '%' },
    { equipment_id: EQUIPMENT.generator2, metric: 'temperature', value: state.gen2Running ? rand(62, 78) : rand(20, 25), unit: '°C' },

    // ── HVAC ──
    { equipment_id: EQUIPMENT.hvac, metric: 'status', value: 1, unit: '' },
    { equipment_id: EQUIPMENT.hvac, metric: 'hours', value: Math.round(state.hvacHours * 10) / 10, unit: 'hrs' },
    { equipment_id: EQUIPMENT.hvac, metric: 'temperature', value: rand(6, 10), unit: '°C' },

    // ── Battery Bank 1 ──
    { equipment_id: BATTERIES.bank1, metric: 'status', value: 1, unit: '' },
    { equipment_id: BATTERIES.bank1, metric: 'state_of_charge', value: Math.round(state.bat1Soc * 10) / 10, unit: '%' },
    { equipment_id: BATTERIES.bank1, metric: 'battery_voltage', value: state.bat1Charging ? rand(27.2, 28.8) : rand(24.5, 26.2), unit: 'V' },
    { equipment_id: BATTERIES.bank1, metric: 'battery_current', value: state.bat1Charging ? rand(15, 45) : rand(-30, -5), unit: 'A' },
    { equipment_id: BATTERIES.bank1, metric: 'battery_temp', value: rand(22, 32), unit: '°C' },

    // ── Battery Bank 2 ──
    { equipment_id: BATTERIES.bank2, metric: 'status', value: 1, unit: '' },
    { equipment_id: BATTERIES.bank2, metric: 'state_of_charge', value: Math.round(state.bat2Soc * 10) / 10, unit: '%' },
    { equipment_id: BATTERIES.bank2, metric: 'battery_voltage', value: rand(25.0, 27.5), unit: 'V' },
    { equipment_id: BATTERIES.bank2, metric: 'battery_current', value: rand(-20, 30), unit: 'A' },
    { equipment_id: BATTERIES.bank2, metric: 'battery_temp', value: rand(21, 30), unit: '°C' },

    // ── Tanks ──
    { resource_id: RESOURCES.dieselMain, metric: 'level', value: Math.round(state.dieselMainLevel * 10) / 10, unit: '%' },
    { resource_id: RESOURCES.freshWater, metric: 'level', value: Math.round(state.freshWaterLevel * 10) / 10, unit: '%' },
    { resource_id: RESOURCES.dieselGen,  metric: 'level', value: Math.round(state.dieselGenLevel * 10) / 10, unit: '%' },
  ];

  return readings;
}

async function sendReadings() {
  const readings = buildReadings();
  const payload = {
    vessel_id: VESSEL_ID,
    company_id: COMPANY_ID,
    readings,
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/ingest-telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    const now = new Date().toLocaleTimeString();

    if (res.ok) {
      console.log(`[${now}] Sent ${data.inserted} readings | Engines: ${state.enginesRunning ? 'ON' : 'OFF'} | Gen1: ${state.gen1Running ? 'ON' : 'OFF'} | Gen2: ${state.gen2Running ? 'ON' : 'OFF'} | Bat1: ${state.bat1Soc.toFixed(1)}% ${state.bat1Charging ? '⚡' : '↓'} | Diesel: ${state.dieselMainLevel.toFixed(1)}% | Water: ${state.freshWaterLevel.toFixed(1)}%`);
    } else {
      console.error(`[${now}] Error:`, data.error);
    }
  } catch (err) {
    console.error('Network error:', err.message);
  }
}

// ── Main loop ──
const INTERVAL_SECONDS = 30;

console.log('');
console.log('  ⚓ Nautium Telemetry Simulator');
console.log('  ─────────────────────────────');
console.log(`  Vessel:   Dream`);
console.log(`  Interval: ${INTERVAL_SECONDS}s`);
console.log(`  Endpoint: ${SUPABASE_URL}/functions/v1/ingest-telemetry`);
console.log('');
console.log('  Sending readings... (Ctrl+C to stop)');
console.log('');

// Send immediately, then every INTERVAL_SECONDS
sendReadings();
setInterval(sendReadings, INTERVAL_SECONDS * 1000);
