import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Anchor, Gauge, Zap, Battery, Droplets, Power, PowerOff,
  Wifi, WifiOff, Play, Square, Settings2, ChevronDown, ChevronUp,
} from 'lucide-react';

const SUPABASE_URL = 'https://fsxjbgopxxbtidlkkafc.supabase.co';

const PRESETS: Record<string, { label: string; vesselId: string; companyId: string; equipment: Record<string, string>; batteries: Record<string, string>; resources: Record<string, string> }> = {
  dream: {
    label: 'M/Y Dream',
    vesselId: '21b73fc5-1d5b-47e6-b151-a015201b7461',
    companyId: '44b5ce45-0feb-49b4-bc25-f470a89ed064',
    equipment: {
      enginePort:  '2093e329-8a55-4399-a91f-e684648e36c9',
      engineStbd:  '51ed6f0f-63bf-433a-b0e6-532ce12993a9',
      generator1:  'c8355826-8c3a-4afc-b973-bb05a36bf621',
      generator2:  '793d6735-e58c-4fed-9a7b-32870f4e5e95',
      hvac:        'a9507c0e-04e4-46f1-b928-b9edcf5ee6e0',
    },
    batteries: {
      bank1: '32065a8a-5270-43d3-942a-baf9db9c0d54',
      bank2: '29f2cd98-d51b-4dab-b6f6-d1c72e05b9a1',
    },
    resources: {
      dieselMain: '34b4311a-ecdd-40b1-b0de-d3a4536b5063',
      freshWater: 'a069cd29-090b-4427-a3fe-e5592aa46868',
      dieselGen:  '4b1b9b65-c14a-41ef-99ec-e19056787d68',
    },
  },
};

interface SimState {
  enginesOn: boolean;
  throttle: number;
  gen1On: boolean;
  gen2On: boolean;
  hvacOn: boolean;
  bat1Soc: number;
  bat1Charging: boolean;
  bat2Soc: number;
  bat2Charging: boolean;
  dieselMain: number;
  freshWater: number;
  dieselGen: number;
  enginePortHours: number;
  engineStbdHours: number;
  gen1Hours: number;
  gen2Hours: number;
  hvacHours: number;
}

const DEFAULT_STATE: SimState = {
  enginesOn: false,
  throttle: 0,
  gen1On: true,
  gen2On: false,
  hvacOn: true,
  bat1Soc: 87,
  bat1Charging: true,
  bat2Soc: 92,
  bat2Charging: false,
  dieselMain: 52.5,
  freshWater: 60,
  dieselGen: 12.1,
  enginePortHours: 2847,
  engineStbdHours: 2831,
  gen1Hours: 1205,
  gen2Hours: 890,
  hvacHours: 3420,
};

function rand(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function Toggle({ on, onToggle, label, icon: Icon, color = 'emerald' }: {
  on: boolean; onToggle: () => void; label: string; icon: React.FC<any>; color?: string;
}) {
  const colors: Record<string, { on: string; dot: string }> = {
    emerald: { on: 'bg-emerald-500', dot: 'bg-white' },
    blue:    { on: 'bg-blue-500',    dot: 'bg-white' },
    amber:   { on: 'bg-amber-500',   dot: 'bg-white' },
    cyan:    { on: 'bg-cyan-500',    dot: 'bg-white' },
  };
  const c = colors[color] || colors.emerald;

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2.5">
        <Icon className={`w-4 h-4 ${on ? 'text-white' : 'text-gray-500'}`} />
        <span className="text-sm font-medium text-gray-200">{label}</span>
      </div>
      <button onClick={onToggle} className={`relative w-11 h-6 rounded-full transition-colors ${on ? c.on : 'bg-gray-600'}`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full transition-transform ${c.dot} shadow ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function Slider({ value, onChange, min, max, step = 1, label, unit, color = '#3b82f6' }: {
  value: number; onChange: (v: number) => void; min: number; max: number;
  step?: number; label: string; unit: string; color?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-300">{label}</span>
        <span className="text-sm font-mono font-bold tabular-nums" style={{ color }}>
          {value.toFixed(step < 1 ? 1 : 0)}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #374151 ${pct}%, #374151 100%)`,
        }}
      />
    </div>
  );
}

function MetricDisplay({ label, value, unit, color = '#60a5fa' }: { label: string; value: string | number; unit: string; color?: string }) {
  return (
    <div className="text-center px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-mono font-bold tabular-nums" style={{ color }}>
        {typeof value === 'number' ? (value >= 1000 ? value.toLocaleString() : value % 1 === 0 ? value : value.toFixed(1)) : value}
      </div>
      <div className="text-[10px] text-gray-500">{unit}</div>
    </div>
  );
}

function TankLevel({ label, level, color }: { label: string; level: number; color: string }) {
  return (
    <div className="flex-1 min-w-[80px]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-xs font-mono font-bold tabular-nums" style={{ color }}>{level.toFixed(1)}%</span>
      </div>
      <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${level}%`, background: level < 15 ? '#ef4444' : level < 25 ? '#f59e0b' : color }}
        />
      </div>
    </div>
  );
}

export function DataSim() {
  const [apiKey, setApiKey] = useState('nautium-telemetry-demo-2026');
  const [preset, setPreset] = useState('dream');
  const [state, setState] = useState<SimState>({ ...DEFAULT_STATE });
  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [sendCount, setSendCount] = useState(0);
  const [interval, setIntervalSec] = useState(10);
  const [showConfig, setShowConfig] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLog(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  const buildReadings = useCallback(() => {
    const s = stateRef.current;
    const p = PRESETS[preset];
    if (!p) return [];

    const baseRpm = 800 + (s.throttle / 100) * 1200;
    const baseTemp = s.enginesOn ? 45 + (s.throttle / 100) * 45 : 22;

    const readings: any[] = [];

    // Engines
    readings.push(
      { equipment_id: p.equipment.enginePort, metric: 'status', value: s.enginesOn ? 1 : 0, unit: '' },
      { equipment_id: p.equipment.enginePort, metric: 'hours', value: Math.round(s.enginePortHours * 10) / 10, unit: 'hrs' },
      { equipment_id: p.equipment.enginePort, metric: 'rpm', value: s.enginesOn ? Math.round(baseRpm + rand(-30, 30)) : 0, unit: 'rpm' },
      { equipment_id: p.equipment.enginePort, metric: 'temperature', value: s.enginesOn ? Math.round((baseTemp + rand(-3, 3)) * 10) / 10 : rand(20, 24), unit: '°C' },
      { equipment_id: p.equipment.enginePort, metric: 'oil_pressure', value: s.enginesOn ? rand(3.2 + s.throttle / 100 * 1.5, 4.8 + s.throttle / 100) : 0, unit: 'bar' },

      { equipment_id: p.equipment.engineStbd, metric: 'status', value: s.enginesOn ? 1 : 0, unit: '' },
      { equipment_id: p.equipment.engineStbd, metric: 'hours', value: Math.round(s.engineStbdHours * 10) / 10, unit: 'hrs' },
      { equipment_id: p.equipment.engineStbd, metric: 'rpm', value: s.enginesOn ? Math.round(baseRpm + rand(-25, 25)) : 0, unit: 'rpm' },
      { equipment_id: p.equipment.engineStbd, metric: 'temperature', value: s.enginesOn ? Math.round((baseTemp + rand(-4, 4)) * 10) / 10 : rand(20, 24), unit: '°C' },
      { equipment_id: p.equipment.engineStbd, metric: 'oil_pressure', value: s.enginesOn ? rand(3.1 + s.throttle / 100 * 1.5, 4.7 + s.throttle / 100) : 0, unit: 'bar' },
    );

    // Generators
    readings.push(
      { equipment_id: p.equipment.generator1, metric: 'status', value: s.gen1On ? 1 : 0, unit: '' },
      { equipment_id: p.equipment.generator1, metric: 'hours', value: Math.round(s.gen1Hours * 10) / 10, unit: 'hrs' },
      { equipment_id: p.equipment.generator1, metric: 'voltage', value: s.gen1On ? rand(222, 234) : 0, unit: 'V' },
      { equipment_id: p.equipment.generator1, metric: 'load', value: s.gen1On ? rand(35, 70) : 0, unit: '%' },
      { equipment_id: p.equipment.generator1, metric: 'temperature', value: s.gen1On ? rand(62, 78) : rand(20, 24), unit: '°C' },

      { equipment_id: p.equipment.generator2, metric: 'status', value: s.gen2On ? 1 : 0, unit: '' },
      { equipment_id: p.equipment.generator2, metric: 'hours', value: Math.round(s.gen2Hours * 10) / 10, unit: 'hrs' },
      { equipment_id: p.equipment.generator2, metric: 'voltage', value: s.gen2On ? rand(220, 232) : 0, unit: 'V' },
      { equipment_id: p.equipment.generator2, metric: 'load', value: s.gen2On ? rand(28, 55) : 0, unit: '%' },
      { equipment_id: p.equipment.generator2, metric: 'temperature', value: s.gen2On ? rand(60, 75) : rand(20, 24), unit: '°C' },
    );

    // HVAC
    readings.push(
      { equipment_id: p.equipment.hvac, metric: 'status', value: s.hvacOn ? 1 : 0, unit: '' },
      { equipment_id: p.equipment.hvac, metric: 'hours', value: Math.round(s.hvacHours * 10) / 10, unit: 'hrs' },
      { equipment_id: p.equipment.hvac, metric: 'temperature', value: s.hvacOn ? rand(6, 10) : rand(20, 28), unit: '°C' },
    );

    // Batteries
    readings.push(
      { equipment_id: p.batteries.bank1, metric: 'status', value: 1, unit: '' },
      { equipment_id: p.batteries.bank1, metric: 'state_of_charge', value: Math.round(s.bat1Soc * 10) / 10, unit: '%' },
      { equipment_id: p.batteries.bank1, metric: 'battery_voltage', value: s.bat1Charging ? rand(27.2, 28.8) : rand(24.5, 26.2), unit: 'V' },
      { equipment_id: p.batteries.bank1, metric: 'battery_current', value: s.bat1Charging ? rand(15, 45) : rand(-30, -5), unit: 'A' },
      { equipment_id: p.batteries.bank1, metric: 'battery_temp', value: rand(22, 32), unit: '°C' },

      { equipment_id: p.batteries.bank2, metric: 'status', value: 1, unit: '' },
      { equipment_id: p.batteries.bank2, metric: 'state_of_charge', value: Math.round(s.bat2Soc * 10) / 10, unit: '%' },
      { equipment_id: p.batteries.bank2, metric: 'battery_voltage', value: s.bat2Charging ? rand(27.0, 28.5) : rand(24.2, 26.0), unit: 'V' },
      { equipment_id: p.batteries.bank2, metric: 'battery_current', value: s.bat2Charging ? rand(12, 40) : rand(-25, -3), unit: 'A' },
      { equipment_id: p.batteries.bank2, metric: 'battery_temp', value: rand(21, 30), unit: '°C' },
    );

    // Tanks
    readings.push(
      { resource_id: p.resources.dieselMain, metric: 'level', value: Math.round(s.dieselMain * 10) / 10, unit: '%' },
      { resource_id: p.resources.freshWater, metric: 'level', value: Math.round(s.freshWater * 10) / 10, unit: '%' },
      { resource_id: p.resources.dieselGen,  metric: 'level', value: Math.round(s.dieselGen * 10) / 10, unit: '%' },
    );

    return readings;
  }, [preset]);

  const sendReadings = useCallback(async () => {
    const p = PRESETS[preset];
    if (!p) return;

    const readings = buildReadings();
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ingest-telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
        body: JSON.stringify({ vessel_id: p.vesselId, company_id: p.companyId, readings }),
      });
      const data = await res.json();
      if (res.ok) {
        setConnected(true);
        setSendCount(c => c + 1);
        addLog(`Sent ${data.inserted} readings`);
      } else {
        setConnected(false);
        addLog(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setConnected(false);
      addLog(`Network error: ${err.message}`);
    }
  }, [preset, apiKey, buildReadings, addLog]);

  const simulateTick = useCallback(() => {
    setState(prev => {
      const s = { ...prev };
      const dt = interval / 3600;

      if (s.enginesOn) {
        s.enginePortHours += dt;
        s.engineStbdHours += dt;
        const consumption = 0.02 + (s.throttle / 100) * 0.08;
        s.dieselMain = Math.max(0, s.dieselMain - consumption);
      }
      if (s.gen1On) {
        s.gen1Hours += dt;
        s.dieselGen = Math.max(0, s.dieselGen - 0.015);
      }
      if (s.gen2On) {
        s.gen2Hours += dt;
        s.dieselGen = Math.max(0, s.dieselGen - 0.012);
      }
      if (s.hvacOn) {
        s.hvacHours += dt;
      }
      s.freshWater = Math.max(0, s.freshWater - 0.005);

      if (s.bat1Charging) {
        s.bat1Soc = Math.min(100, s.bat1Soc + rand(0.1, 0.3));
        if (s.bat1Soc >= 99) s.bat1Charging = false;
      } else {
        s.bat1Soc = Math.max(0, s.bat1Soc - rand(0.05, 0.15));
        if (s.bat1Soc <= 15) s.bat1Charging = true;
      }

      if (s.bat2Charging) {
        s.bat2Soc = Math.min(100, s.bat2Soc + rand(0.08, 0.25));
        if (s.bat2Soc >= 99) s.bat2Charging = false;
      } else {
        s.bat2Soc = Math.max(0, s.bat2Soc - rand(0.04, 0.12));
        if (s.bat2Soc <= 15) s.bat2Charging = true;
      }

      return s;
    });
  }, [interval]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    sendReadings();
    simulateTick();

    intervalRef.current = window.setInterval(() => {
      simulateTick();
      sendReadings();
    }, interval * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, interval, sendReadings, simulateTick]);

  const rpm = state.enginesOn ? Math.round(800 + (state.throttle / 100) * 1200) : 0;
  const speed = state.enginesOn ? Math.round((state.throttle / 100) * 22 * 10) / 10 : 0;
  const temp = state.enginesOn ? Math.round(45 + (state.throttle / 100) * 45) : 22;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Anchor className="w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">Nautium DataSim</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Telemetry Simulator</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold ${
              connected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-800 text-gray-500'
            }`}>
              {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {connected ? 'Connected' : 'Disconnected'}
            </div>
            {sendCount > 0 && (
              <span className="text-[11px] text-gray-500 font-mono tabular-nums">{sendCount} sent</span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Panel — Controls */}
          <div className="lg:col-span-4 space-y-4">

            {/* Start/Stop */}
            <button
              onClick={() => setRunning(!running)}
              className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                running
                  ? 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25'
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
              }`}
            >
              {running ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {running ? 'Stop Simulation' : 'Start Simulation'}
            </button>

            {/* Engines */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-3">Propulsion</h3>
              <Toggle on={state.enginesOn} onToggle={() => setState(s => ({ ...s, enginesOn: !s.enginesOn, throttle: s.enginesOn ? 0 : s.throttle }))} label="Main Engines" icon={Gauge} />
              <Slider
                value={state.throttle} onChange={v => setState(s => ({ ...s, throttle: v }))}
                min={0} max={100} label="Throttle" unit="%" color="#22d3ee"
              />
              <div className="grid grid-cols-3 gap-1 mt-2 bg-gray-800/50 rounded-lg p-2">
                <MetricDisplay label="RPM" value={rpm} unit="rpm" color="#22d3ee" />
                <MetricDisplay label="Speed" value={speed} unit="kts" color="#60a5fa" />
                <MetricDisplay label="Temp" value={temp} unit="°C" color={temp > 85 ? '#ef4444' : '#fbbf24'} />
              </div>
            </div>

            {/* Generators */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-3">Electrical</h3>
              <Toggle on={state.gen1On} onToggle={() => setState(s => ({ ...s, gen1On: !s.gen1On }))} label="Generator 1" icon={Zap} color="amber" />
              <Toggle on={state.gen2On} onToggle={() => setState(s => ({ ...s, gen2On: !s.gen2On }))} label="Generator 2" icon={Zap} color="amber" />
              <Toggle on={state.hvacOn} onToggle={() => setState(s => ({ ...s, hvacOn: !s.hvacOn }))} label="HVAC System" icon={Settings2} color="cyan" />
            </div>

            {/* Batteries */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-3">Battery Banks</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Battery className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-gray-300">Bank 1</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono font-bold ${state.bat1Soc < 20 ? 'text-red-400' : 'text-green-400'}`}>{state.bat1Soc.toFixed(1)}%</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${state.bat1Charging ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {state.bat1Charging ? 'CHG' : 'DIS'}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all bg-green-500" style={{ width: `${state.bat1Soc}%` }} />
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <Battery className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-gray-300">Bank 2</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono font-bold ${state.bat2Soc < 20 ? 'text-red-400' : 'text-green-400'}`}>{state.bat2Soc.toFixed(1)}%</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${state.bat2Charging ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {state.bat2Charging ? 'CHG' : 'DIS'}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all bg-green-500" style={{ width: `${state.bat2Soc}%` }} />
                </div>
              </div>
            </div>

            {/* Tanks */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-3">Tanks</h3>
              <div className="space-y-3">
                <TankLevel label="Diesel Main" level={state.dieselMain} color="#f59e0b" />
                <TankLevel label="Diesel Gen" level={state.dieselGen} color="#f97316" />
                <TankLevel label="Fresh Water" level={state.freshWater} color="#3b82f6" />
              </div>
              <div className="mt-3 pt-3 border-t border-gray-800">
                <Slider
                  value={state.dieselMain} onChange={v => setState(s => ({ ...s, dieselMain: v }))}
                  min={0} max={100} step={0.5} label="Refuel Diesel" unit="%" color="#f59e0b"
                />
                <Slider
                  value={state.freshWater} onChange={v => setState(s => ({ ...s, freshWater: v }))}
                  min={0} max={100} step={0.5} label="Fill Water" unit="%" color="#3b82f6"
                />
              </div>
            </div>

            {/* Config */}
            <div className="bg-gray-900 rounded-xl border border-gray-800">
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="w-full px-4 py-3 flex items-center justify-between text-sm text-gray-400 hover:text-gray-200"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4" />
                  <span>Configuration</span>
                </div>
                {showConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showConfig && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-800 pt-3">
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">API Key</label>
                    <input
                      type="text" value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-300 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <Slider
                    value={interval} onChange={setIntervalSec}
                    min={5} max={60} label="Send Interval" unit="s" color="#8b5cf6"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right Panel — Dashboard Preview & Log */}
          <div className="lg:col-span-8 space-y-4">

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Engines', value: state.enginesOn ? 'ON' : 'OFF', color: state.enginesOn ? '#34d399' : '#6b7280', sub: `${rpm} RPM` },
                { label: 'Generator 1', value: state.gen1On ? 'ON' : 'OFF', color: state.gen1On ? '#fbbf24' : '#6b7280', sub: `${state.gen1Hours.toFixed(0)} hrs` },
                { label: 'Generator 2', value: state.gen2On ? 'ON' : 'OFF', color: state.gen2On ? '#fbbf24' : '#6b7280', sub: `${state.gen2Hours.toFixed(0)} hrs` },
                { label: 'Speed', value: `${speed}`, color: '#22d3ee', sub: `${state.throttle}% throttle` },
              ].map(s => (
                <div key={s.label} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">{s.label}</div>
                  <div className="text-2xl font-mono font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Engine hours overview */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-4">Equipment Hours</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: 'Engine Port', hours: state.enginePortHours, color: '#60a5fa' },
                  { label: 'Engine Stbd', hours: state.engineStbdHours, color: '#22d3ee' },
                  { label: 'Gen 1', hours: state.gen1Hours, color: '#fbbf24' },
                  { label: 'Gen 2', hours: state.gen2Hours, color: '#f97316' },
                  { label: 'HVAC', hours: state.hvacHours, color: '#a78bfa' },
                ].map(e => (
                  <div key={e.label} className="text-center">
                    <div className="text-xl font-mono font-bold tabular-nums" style={{ color: e.color }}>
                      {e.hours.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">{e.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tank gauges */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-4">Tank Levels</h3>
              <div className="grid grid-cols-3 gap-6">
                {[
                  { label: 'Diesel Main', level: state.dieselMain, capacity: '8,000L', color: '#f59e0b' },
                  { label: 'Diesel Gen', level: state.dieselGen, capacity: '6,750L', color: '#f97316' },
                  { label: 'Fresh Water', level: state.freshWater, capacity: '3,000L', color: '#3b82f6' },
                ].map(t => (
                  <div key={t.label} className="text-center">
                    <div className="relative w-20 h-28 mx-auto mb-2 rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
                      <div
                        className="absolute bottom-0 left-0 right-0 transition-all duration-700"
                        style={{
                          height: `${t.level}%`,
                          background: `linear-gradient(to top, ${t.level < 15 ? '#ef4444' : t.color}dd, ${t.level < 15 ? '#ef4444' : t.color}66)`,
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg font-mono font-bold text-white drop-shadow-lg">{Math.round(t.level)}%</span>
                      </div>
                    </div>
                    <div className="text-xs font-medium text-gray-300">{t.label}</div>
                    <div className="text-[10px] text-gray-500">{t.capacity}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Log */}
            <div className="bg-gray-900 rounded-xl border border-gray-800">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Activity Log</h3>
                <button onClick={() => setLog([])} className="text-[10px] text-gray-500 hover:text-gray-300">Clear</button>
              </div>
              <div className="h-48 overflow-y-auto p-3 font-mono text-[11px] text-gray-400 space-y-0.5">
                {log.length === 0 ? (
                  <div className="text-gray-600 text-center py-8">Press "Start Simulation" to begin...</div>
                ) : (
                  log.map((entry, i) => (
                    <div key={i} className={`${entry.includes('Error') ? 'text-red-400' : ''}`}>{entry}</div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
