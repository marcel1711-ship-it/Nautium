import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Wifi, WifiOff, Gauge, Clock,
  Droplets, Zap, Fan, RefreshCw, Info, Battery, Anchor,
} from 'lucide-react';
import { fetchByCompany } from '../../lib/supabase';

interface MonitorTabProps {
  vesselId: string;
  companyId: string;
  equipment: any[];
}

interface TelemetryReading {
  equipment_id: string | null;
  resource_id: string | null;
  metric: string;
  value: number;
  unit: string;
  recorded_at: string;
}

interface FuelResource {
  id: string;
  name: string;
  resource_type: string;
  capacity: string;
  current_level: string;
  unit: string;
  vessel_id: string;
}

const MONITORABLE_TYPES = ['Main Engine', 'Generator', 'HVAC', 'Compressor', 'Battery Bank'];

const METRIC_CONFIG: Record<string, { label: string; unit: string; max: number; warn: number; critical: number; color: string }> = {
  hours:             { label: 'Hours',     unit: 'hrs', max: 20000, warn: 15000, critical: 18000, color: '#60a5fa' },
  rpm:               { label: 'RPM',       unit: 'rpm', max: 2500,  warn: 2000,  critical: 2300,  color: '#22d3ee' },
  temperature:       { label: 'Temp',      unit: '°C',  max: 120,   warn: 85,    critical: 100,   color: '#fbbf24' },
  oil_pressure:      { label: 'Oil Press', unit: 'bar', max: 8,     warn: 2,     critical: 1,     color: '#a78bfa' },
  voltage:           { label: 'Voltage',   unit: 'V',   max: 250,   warn: 210,   critical: 190,   color: '#34d399' },
  load:              { label: 'Load',      unit: '%',   max: 100,   warn: 80,    critical: 95,    color: '#f472b6' },
  coolant_temp:      { label: 'Coolant',   unit: '°C',  max: 110,   warn: 85,    critical: 95,    color: '#f87171' },
  state_of_charge:   { label: 'SOC',       unit: '%',   max: 100,   warn: 25,    critical: 10,    color: '#4ade80' },
  battery_voltage:   { label: 'Voltage',   unit: 'V',   max: 60,    warn: 23,    critical: 22,    color: '#facc15' },
  battery_current:   { label: 'Current',   unit: 'A',   max: 200,   warn: 160,   critical: 180,   color: '#22d3ee' },
  battery_temp:      { label: 'Temp',      unit: '°C',  max: 60,    warn: 40,    critical: 50,    color: '#fb923c' },
};

const TANK_CONFIG: Record<string, { color: string; label: string }> = {
  diesel_main:      { color: '#f59e0b', label: 'Diesel Main' },
  diesel_generator: { color: '#f97316', label: 'Diesel Gen' },
  fresh_water:      { color: '#3b82f6', label: 'Fresh Water' },
  grey_water:       { color: '#6b7280', label: 'Grey Water' },
  black_water:      { color: '#374151', label: 'Black Water' },
  gasoline:         { color: '#ef4444', label: 'Gasoline' },
};

function InstrumentGauge({ value, max, label, unit, color, warn, critical, size = 110 }: {
  value: number; max: number; label: string; unit: string; color: string;
  warn?: number; critical?: number; size?: number;
}) {
  const strokeW = 8;
  const radius = (size - strokeW - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(Math.abs(value) / max, 1);
  const arcLen = circumference * 0.75;
  const offset = arcLen * (1 - percentage);
  const cx = size / 2;
  const cy = size / 2;

  const lowIsWorse = label === 'Oil Press' || label === 'SOC';
  let activeColor = color;
  if (critical !== undefined && warn !== undefined) {
    if (lowIsWorse ? value < critical : value > critical) activeColor = '#ef4444';
    else if (lowIsWorse ? value < warn : value > warn) activeColor = '#f59e0b';
  }

  const formatValue = (v: number) => {
    if (typeof v !== 'number') return '—';
    if (v >= 10000) return `${(v / 1000).toFixed(1)}k`;
    if (v >= 1000) return v.toLocaleString();
    return v % 1 === 0 ? String(v) : v.toFixed(1);
  };

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={radius} fill="none" strokeWidth={strokeW}
          className="stroke-gray-100 dark:stroke-gray-700/80"
          strokeDasharray={`${arcLen} ${circumference - arcLen}`}
          transform={`rotate(135 ${cx} ${cy})`} strokeLinecap="round"
        />
        {/* Value arc */}
        <circle
          cx={cx} cy={cy} r={radius} fill="none" strokeWidth={strokeW}
          stroke={activeColor}
          strokeDasharray={`${arcLen} ${circumference - arcLen}`}
          strokeDashoffset={offset}
          transform={`rotate(135 ${cx} ${cy})`} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.3s' }}
        />
        {/* Value text */}
        <text x={cx} y={cy - 1} textAnchor="middle" className="fill-gray-900 dark:fill-gray-50"
          style={{ fontSize: '17px', fontWeight: 700, fontFamily: "'SF Mono','Cascadia Code',ui-monospace,monospace", letterSpacing: '-0.5px' }}>
          {formatValue(value)}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-gray-400 dark:fill-gray-500"
          style={{ fontSize: '10px', fontFamily: 'system-ui' }}>
          {unit}
        </text>
      </svg>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 -mt-1">{label}</span>
    </div>
  );
}

function TankBar({ name, level, capacity, unit, color }: {
  name: string; level: number; capacity: number; unit: string; color: string;
}) {
  const pct = capacity > 0 ? Math.min((level / capacity) * 100, 100) : 0;
  const fillColor = pct < 10 ? '#ef4444' : pct < 20 ? '#f59e0b' : color;

  return (
    <div className="flex flex-col items-center gap-2 min-w-[72px]">
      <div className="relative w-14 h-28 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out"
          style={{ height: `${pct}%`, backgroundColor: fillColor, opacity: 0.85 }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold font-mono text-gray-800 dark:text-gray-100 tabular-nums"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            {Math.round(pct)}%
          </span>
        </div>
        {pct < 10 && (
          <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </div>
      <div className="text-center">
        <div className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{name}</div>
        <div className="text-[9px] text-gray-400 font-mono tabular-nums">{level.toLocaleString()}/{capacity.toLocaleString()} {unit}</div>
      </div>
    </div>
  );
}

function EquipmentCard({ equipment, readings, isOnline }: {
  equipment: any; readings: Map<string, TelemetryReading>; isOnline: boolean;
}) {
  const type = equipment.type;
  const isEngine = type === 'Main Engine';
  const isGenerator = type === 'Generator';
  const isBattery = type === 'Battery Bank';

  const metricsToShow = isEngine
    ? ['hours', 'rpm', 'temperature', 'oil_pressure']
    : isGenerator
    ? ['hours', 'voltage', 'load', 'temperature']
    : isBattery
    ? ['state_of_charge', 'battery_voltage', 'battery_current', 'battery_temp']
    : ['hours', 'temperature'];

  const status = readings.get('status');
  const isRunning = status ? status.value === 1 : false;
  const battCurrent = readings.get('battery_current')?.value ?? 0;
  const isBatteryCharging = isBattery && battCurrent > 0;

  const IconComponent = isEngine ? Gauge : isGenerator ? Zap : isBattery ? Battery : Fan;

  const statusLabel = isBattery
    ? (isBatteryCharging ? 'Charging' : 'Discharging')
    : isRunning ? 'Running' : 'Off';

  const isActive = isBattery || isRunning;

  const statusClasses = isBattery
    ? (isBatteryCharging
      ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400'
      : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400')
    : isRunning
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-150 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isActive ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-gray-50 dark:bg-gray-700'
          }`}>
            <IconComponent className={`w-4 h-4 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50">{equipment.name}</h4>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">{equipment.manufacturer} {equipment.model}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOnline && (
            <span className="relative flex h-2 w-2">
              {isActive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
            </span>
          )}
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${statusClasses}`}>
            {statusLabel}
          </span>
        </div>
      </div>
      {/* Gauges */}
      <div className="px-3 py-3 flex items-center justify-center gap-1 flex-wrap">
        {metricsToShow.map(metric => {
          const reading = readings.get(metric);
          const config = METRIC_CONFIG[metric];
          if (!config) return null;
          return (
            <InstrumentGauge
              key={metric}
              value={reading ? reading.value : 0}
              max={config.max}
              label={config.label}
              unit={config.unit}
              color={config.color}
              warn={config.warn}
              critical={config.critical}
              size={108}
            />
          );
        })}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.FC<any>; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">{title}</h3>
      <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700/50" />
    </div>
  );
}

export const MonitorTab: React.FC<MonitorTabProps> = ({ vesselId, companyId, equipment }) => {
  const [telemetry, setTelemetry] = useState<TelemetryReading[]>([]);
  const [resources, setResources] = useState<FuelResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const monitorableEquipment = equipment.filter((e: any) =>
    MONITORABLE_TYPES.includes(e.type) && e.vessel_id === vesselId
  );

  const loadTelemetry = useCallback(async () => {
    if (!companyId || !vesselId || vesselId === 'all') return;
    try {
      const [telData, resData] = await Promise.all([
        fetchByCompany('vessel_telemetry', companyId, 'recorded_at', false),
        fetchByCompany('fuel_resources', companyId, 'name', true),
      ]);

      const vesselTelemetry = telData.filter((t: any) => t.vessel_id === vesselId);
      setTelemetry(vesselTelemetry);
      setResources(resData.filter((r: any) => r.vessel_id === vesselId));

      if (vesselTelemetry.length > 0) {
        setLastUpdate(new Date(vesselTelemetry[0].recorded_at));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [companyId, vesselId]);

  useEffect(() => { loadTelemetry(); }, [loadTelemetry]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadTelemetry, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadTelemetry]);

  const getLatestReadings = (equipmentId: string): Map<string, TelemetryReading> => {
    const map = new Map<string, TelemetryReading>();
    for (const t of telemetry) {
      if (t.equipment_id === equipmentId && !map.has(t.metric)) map.set(t.metric, t);
    }
    return map;
  };

  const getResourceReadings = (resourceId: string): Map<string, TelemetryReading> => {
    const map = new Map<string, TelemetryReading>();
    for (const t of telemetry) {
      if (t.resource_id === resourceId && !map.has(t.metric)) map.set(t.metric, t);
    }
    return map;
  };

  const hasData = telemetry.length > 0;
  const isOnline = lastUpdate ? (Date.now() - lastUpdate.getTime()) < 10 * 60 * 1000 : false;
  const timeSinceUpdate = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 60000) : null;

  const engines = monitorableEquipment.filter((e: any) => e.type === 'Main Engine');
  const generators = monitorableEquipment.filter((e: any) => e.type === 'Generator');
  const batteries = monitorableEquipment.filter((e: any) => e.type === 'Battery Bank');
  const systems = monitorableEquipment.filter((e: any) => !['Main Engine', 'Generator', 'Battery Bank'].includes(e.type));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-200 dark:border-blue-800 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!vesselId || vesselId === 'all') {
    return (
      <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
        <Anchor className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
        <p className="text-gray-400 dark:text-gray-500 text-sm">Select a vessel to view monitoring data</p>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
        <WifiOff className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
        <p className="text-gray-800 dark:text-gray-100 font-semibold">No sensors connected</p>
        <p className="text-gray-400 text-sm mt-1.5 max-w-sm mx-auto">
          Connect a NMEA 2000 gateway to see live engine, tank, and battery data.
        </p>
        <div className="mt-5 inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium">
          <Info className="w-3.5 h-3.5" />
          Equipment data is updated manually
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide ${
            isOnline
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
          }`}>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isOnline ? 'Live' : 'Offline'}
          </div>
          {timeSinceUpdate !== null && (
            <span className="text-[11px] text-gray-400 flex items-center gap-1 font-mono tabular-nums">
              <Clock className="w-3 h-3" />
              {timeSinceUpdate < 1 ? 'Just now' : timeSinceUpdate < 60 ? `${timeSinceUpdate}m ago` : `${Math.floor(timeSinceUpdate / 60)}h ago`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors ${
              autoRefresh ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-gray-50 text-gray-400 dark:bg-gray-700'
            }`}
          >
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </button>
          <button onClick={loadTelemetry} className="p-1.5 text-gray-400 hover:text-blue-500 rounded-md hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {engines.length > 0 && (
        <div>
          <SectionHeader icon={Gauge} title="Main Engines" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {engines.map((eng: any) => <EquipmentCard key={eng.id} equipment={eng} readings={getLatestReadings(eng.id)} isOnline={isOnline} />)}
          </div>
        </div>
      )}

      {generators.length > 0 && (
        <div>
          <SectionHeader icon={Zap} title="Generators" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {generators.map((gen: any) => <EquipmentCard key={gen.id} equipment={gen} readings={getLatestReadings(gen.id)} isOnline={isOnline} />)}
          </div>
        </div>
      )}

      {batteries.length > 0 && (
        <div>
          <SectionHeader icon={Battery} title="Battery Banks" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {batteries.map((bat: any) => <EquipmentCard key={bat.id} equipment={bat} readings={getLatestReadings(bat.id)} isOnline={isOnline} />)}
          </div>
        </div>
      )}

      {resources.length > 0 && (
        <div>
          <SectionHeader icon={Droplets} title="Tanks" />
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-end justify-center gap-6 flex-wrap">
              {resources.map((res) => {
                const tc = TANK_CONFIG[res.resource_type] || { color: '#6b7280', label: res.name };
                const levelReading = getResourceReadings(res.id).get('level');
                const currentLevel = levelReading
                  ? Math.round((levelReading.value / 100) * Number(res.capacity))
                  : Number(res.current_level);
                return (
                  <TankBar key={res.id} name={tc.label} level={currentLevel} capacity={Number(res.capacity)} unit={res.unit} color={tc.color} />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {systems.length > 0 && (
        <div>
          <SectionHeader icon={Activity} title="Systems" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {systems.map((sys: any) => <EquipmentCard key={sys.id} equipment={sys} readings={getLatestReadings(sys.id)} isOnline={isOnline} />)}
          </div>
        </div>
      )}
    </div>
  );
};
