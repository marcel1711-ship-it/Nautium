import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Wifi, WifiOff, Thermometer, Gauge, Clock,
  Droplets, Fuel, Zap, Fan, RefreshCw, Info, Battery,
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
  hours:       { label: 'Hours',       unit: 'hrs',  max: 20000, warn: 15000, critical: 18000, color: '#3b82f6' },
  rpm:         { label: 'RPM',         unit: 'rpm',  max: 2500,  warn: 2000,  critical: 2300,  color: '#06b6d4' },
  temperature: { label: 'Temp',        unit: '°C',   max: 120,   warn: 85,    critical: 100,   color: '#f59e0b' },
  oil_pressure:{ label: 'Oil Press.',  unit: 'bar',  max: 8,     warn: 2,     critical: 1,     color: '#8b5cf6' },
  voltage:     { label: 'Voltage',     unit: 'V',    max: 250,   warn: 210,   critical: 190,   color: '#10b981' },
  load:        { label: 'Load',        unit: '%',    max: 100,   warn: 80,    critical: 95,    color: '#ec4899' },
  coolant_temp:      { label: 'Coolant',     unit: '°C',   max: 110,   warn: 85,    critical: 95,    color: '#ef4444' },
  state_of_charge:   { label: 'SOC',         unit: '%',    max: 100,   warn: 25,    critical: 10,    color: '#22c55e' },
  battery_voltage:   { label: 'Voltage',     unit: 'V',    max: 60,    warn: 23,    critical: 22,    color: '#eab308' },
  battery_current:   { label: 'Current',     unit: 'A',    max: 200,   warn: 160,   critical: 180,   color: '#06b6d4' },
  battery_temp:      { label: 'Temp',        unit: '°C',   max: 60,    warn: 40,    critical: 50,    color: '#f97316' },
};

const TANK_COLORS: Record<string, { fill: string; bg: string; label: string }> = {
  diesel_main:      { fill: '#f59e0b', bg: '#fef3c7', label: 'Diesel Main' },
  diesel_generator: { fill: '#f97316', bg: '#ffedd5', label: 'Diesel Gen' },
  fresh_water:      { fill: '#3b82f6', bg: '#dbeafe', label: 'Fresh Water' },
  grey_water:       { fill: '#6b7280', bg: '#e5e7eb', label: 'Grey Water' },
  black_water:      { fill: '#1f2937', bg: '#d1d5db', label: 'Black Water' },
  gasoline:         { fill: '#ef4444', bg: '#fee2e2', label: 'Gasoline' },
};

function CircularGauge({ value, max, label, unit, color, warn, critical, size = 130 }: {
  value: number; max: number; label: string; unit: string; color: string;
  warn?: number; critical?: number; size?: number;
}) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(value / max, 1);
  const offset = circumference * (1 - percentage * 0.75);
  const startAngle = 135;

  let gaugeColor = color;
  const lowIsWorse = label === 'Oil Press.' || label === 'SOC';
  if (critical !== undefined && warn !== undefined) {
    if (lowIsWorse ? value < critical : value > critical) gaugeColor = '#ef4444';
    else if (lowIsWorse ? value < warn : value > warn) gaugeColor = '#f59e0b';
  }

  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none" stroke="#e5e7eb" strokeWidth="8"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          transform={`rotate(${startAngle} ${cx} ${cy})`}
          strokeLinecap="round"
          className="dark:stroke-gray-700"
        />
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none" stroke={gaugeColor} strokeWidth="8"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeDashoffset={offset}
          transform={`rotate(${startAngle} ${cx} ${cy})`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }}
        />
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-gray-900 dark:fill-gray-100" fontSize="20" fontWeight="700" fontFamily="system-ui">
          {typeof value === 'number' ? (value >= 1000 ? value.toLocaleString() : value % 1 === 0 ? value : value.toFixed(1)) : '—'}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-gray-400 dark:fill-gray-500" fontSize="11" fontFamily="system-ui">
          {unit}
        </text>
      </svg>
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 -mt-2">{label}</span>
    </div>
  );
}

function TankBar({ name, level, capacity, unit, color, bg }: {
  name: string; level: number; capacity: number; unit: string; color: string; bg: string;
}) {
  const percentage = capacity > 0 ? Math.min((level / capacity) * 100, 100) : 0;
  const isLow = percentage < 20;
  const isCritical = percentage < 10;

  return (
    <div className="flex flex-col items-center gap-2 min-w-[80px]">
      <div className="relative w-16 h-32 rounded-xl border-2 border-gray-200 dark:border-gray-600 overflow-hidden" style={{ background: bg }}>
        <div
          className="absolute bottom-0 left-0 right-0 rounded-b-lg transition-all duration-1000 ease-out"
          style={{
            height: `${percentage}%`,
            background: isCritical ? '#ef4444' : isLow ? '#f59e0b' : color,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200 drop-shadow-sm" style={{ textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}>
            {Math.round(percentage)}%
          </span>
        </div>
        {isCritical && (
          <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </div>
      <div className="text-center">
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 leading-tight">{name}</div>
        <div className="text-[10px] text-gray-400">{level.toLocaleString()} / {capacity.toLocaleString()} {unit}</div>
      </div>
    </div>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {active && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
    </span>
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
  const isBatteryCharging = isBattery && readings.get('battery_current') && (readings.get('battery_current')?.value ?? 0) > 0;

  const IconComponent = isEngine ? Gauge : isGenerator ? Zap : isBattery ? Battery : Fan;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            isRunning ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-gray-50 dark:bg-gray-700'
          }`}>
            <IconComponent className={`w-5 h-5 ${isRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`} />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{equipment.name}</h4>
            <p className="text-[11px] text-gray-400">
              {equipment.manufacturer} {equipment.model}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOnline && <StatusDot active={isBattery || isRunning} />}
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
            isBattery
              ? isBatteryCharging
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              : isRunning
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            {isBattery ? (isBatteryCharging ? 'Charging' : 'Discharging') : isRunning ? 'Running' : 'Off'}
          </span>
        </div>
      </div>
      <div className="px-5 py-4 flex items-center justify-center gap-4 flex-wrap">
        {metricsToShow.map(metric => {
          const reading = readings.get(metric);
          const config = METRIC_CONFIG[metric];
          if (!config) return null;
          return (
            <CircularGauge
              key={metric}
              value={reading ? reading.value : 0}
              max={config.max}
              label={config.label}
              unit={config.unit}
              color={config.color}
              warn={config.warn}
              critical={config.critical}
              size={110}
            />
          );
        })}
      </div>
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

  useEffect(() => {
    loadTelemetry();
  }, [loadTelemetry]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadTelemetry, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadTelemetry]);

  const getLatestReadings = (equipmentId: string): Map<string, TelemetryReading> => {
    const map = new Map<string, TelemetryReading>();
    for (const t of telemetry) {
      if (t.equipment_id === equipmentId && !map.has(t.metric)) {
        map.set(t.metric, t);
      }
    }
    return map;
  };

  const getResourceReadings = (resourceId: string): Map<string, TelemetryReading> => {
    const map = new Map<string, TelemetryReading>();
    for (const t of telemetry) {
      if (t.resource_id === resourceId && !map.has(t.metric)) {
        map.set(t.metric, t);
      }
    }
    return map;
  };

  const hasData = telemetry.length > 0;
  const isOnline = lastUpdate ? (Date.now() - lastUpdate.getTime()) < 10 * 60 * 1000 : false;

  const timeSinceUpdate = lastUpdate
    ? Math.floor((Date.now() - lastUpdate.getTime()) / 60000)
    : null;

  const engines = monitorableEquipment.filter((e: any) => e.type === 'Main Engine');
  const generators = monitorableEquipment.filter((e: any) => e.type === 'Generator');
  const batteries = monitorableEquipment.filter((e: any) => e.type === 'Battery Bank');
  const systems = monitorableEquipment.filter((e: any) => !['Main Engine', 'Generator', 'Battery Bank'].includes(e.type));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!vesselId || vesselId === 'all') {
    return (
      <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
        <Gauge className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400 font-medium">Select a vessel to view monitoring data</p>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <WifiOff className="w-8 h-8 text-gray-300 dark:text-gray-500" />
        </div>
        <p className="text-gray-900 dark:text-gray-100 font-semibold text-lg">No sensors connected</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-2 max-w-md mx-auto">
          Connect a NMEA 2000 gateway (Yacht Devices YDWG-02 or similar) to see live engine hours, tank levels, and battery data here.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-medium">
          <Info className="w-4 h-4" />
          Equipment data is updated manually
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection status bar */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
            isOnline
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          }`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isOnline ? 'Live' : 'Offline'}
          </div>
          {timeSinceUpdate !== null && (
            <span className="text-xs text-gray-400">
              <Clock className="w-3 h-3 inline mr-1" />
              {timeSinceUpdate < 1 ? 'Just now' : timeSinceUpdate < 60 ? `${timeSinceUpdate}m ago` : `${Math.floor(timeSinceUpdate / 60)}h ago`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              autoRefresh ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-gray-50 text-gray-400 dark:bg-gray-700'
            }`}
          >
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={loadTelemetry}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            title="Refresh now"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Engines */}
      {engines.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Gauge className="w-4 h-4" />
            Main Engines
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {engines.map((eng: any) => (
              <EquipmentCard
                key={eng.id}
                equipment={eng}
                readings={getLatestReadings(eng.id)}
                isOnline={isOnline}
              />
            ))}
          </div>
        </div>
      )}

      {/* Generators */}
      {generators.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Generators
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {generators.map((gen: any) => (
              <EquipmentCard
                key={gen.id}
                equipment={gen}
                readings={getLatestReadings(gen.id)}
                isOnline={isOnline}
              />
            ))}
          </div>
        </div>
      )}

      {/* Batteries */}
      {batteries.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Battery className="w-4 h-4" />
            Battery Banks
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {batteries.map((bat: any) => (
              <EquipmentCard
                key={bat.id}
                equipment={bat}
                readings={getLatestReadings(bat.id)}
                isOnline={isOnline}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tanks */}
      {resources.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Droplets className="w-4 h-4" />
            Tanks
          </h3>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <div className="flex items-center justify-center gap-8 flex-wrap">
              {resources.map((res) => {
                const tankConfig = TANK_COLORS[res.resource_type] || { fill: '#6b7280', bg: '#e5e7eb', label: res.name };
                const levelReading = getResourceReadings(res.id).get('level');
                const currentLevel = levelReading
                  ? Math.round((levelReading.value / 100) * Number(res.capacity))
                  : Number(res.current_level);

                return (
                  <TankBar
                    key={res.id}
                    name={tankConfig.label}
                    level={currentLevel}
                    capacity={Number(res.capacity)}
                    unit={res.unit}
                    color={tankConfig.fill}
                    bg={tankConfig.bg}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Other systems */}
      {systems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Systems
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {systems.map((sys: any) => (
              <EquipmentCard
                key={sys.id}
                equipment={sys}
                readings={getLatestReadings(sys.id)}
                isOnline={isOnline}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
