import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Wifi, WifiOff, Gauge, Clock,
  Droplets, Zap, Fan, RefreshCw, Info, Battery,
  Anchor, ChevronRight,
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

const METRIC_CONFIG: Record<string, { label: string; unit: string; max: number; warn: number; critical: number; color: string; gradient: [string, string] }> = {
  hours:             { label: 'Hours',     unit: 'hrs', max: 20000, warn: 15000, critical: 18000, color: '#60a5fa', gradient: ['#3b82f6', '#93c5fd'] },
  rpm:               { label: 'RPM',       unit: 'rpm', max: 2500,  warn: 2000,  critical: 2300,  color: '#22d3ee', gradient: ['#06b6d4', '#67e8f9'] },
  temperature:       { label: 'Temp',      unit: '°C',  max: 120,   warn: 85,    critical: 100,   color: '#fbbf24', gradient: ['#f59e0b', '#fcd34d'] },
  oil_pressure:      { label: 'Oil Press', unit: 'bar', max: 8,     warn: 2,     critical: 1,     color: '#a78bfa', gradient: ['#8b5cf6', '#c4b5fd'] },
  voltage:           { label: 'Voltage',   unit: 'V',   max: 250,   warn: 210,   critical: 190,   color: '#34d399', gradient: ['#10b981', '#6ee7b7'] },
  load:              { label: 'Load',      unit: '%',   max: 100,   warn: 80,    critical: 95,    color: '#f472b6', gradient: ['#ec4899', '#f9a8d4'] },
  coolant_temp:      { label: 'Coolant',   unit: '°C',  max: 110,   warn: 85,    critical: 95,    color: '#f87171', gradient: ['#ef4444', '#fca5a5'] },
  state_of_charge:   { label: 'SOC',       unit: '%',   max: 100,   warn: 25,    critical: 10,    color: '#4ade80', gradient: ['#22c55e', '#86efac'] },
  battery_voltage:   { label: 'Voltage',   unit: 'V',   max: 60,    warn: 23,    critical: 22,    color: '#facc15', gradient: ['#eab308', '#fde047'] },
  battery_current:   { label: 'Current',   unit: 'A',   max: 200,   warn: 160,   critical: 180,   color: '#22d3ee', gradient: ['#06b6d4', '#67e8f9'] },
  battery_temp:      { label: 'Temp',      unit: '°C',  max: 60,    warn: 40,    critical: 50,    color: '#fb923c', gradient: ['#f97316', '#fdba74'] },
};

const TANK_CONFIG: Record<string, { color: string; gradient: [string, string]; label: string }> = {
  diesel_main:      { color: '#f59e0b', gradient: ['#d97706', '#fbbf24'], label: 'Diesel Main' },
  diesel_generator: { color: '#f97316', gradient: ['#ea580c', '#fb923c'], label: 'Diesel Gen' },
  fresh_water:      { color: '#3b82f6', gradient: ['#2563eb', '#60a5fa'], label: 'Fresh Water' },
  grey_water:       { color: '#6b7280', gradient: ['#4b5563', '#9ca3af'], label: 'Grey Water' },
  black_water:      { color: '#374151', gradient: ['#1f2937', '#6b7280'], label: 'Black Water' },
  gasoline:         { color: '#ef4444', gradient: ['#dc2626', '#f87171'], label: 'Gasoline' },
};

function CircularGauge({ value, max, label, unit, color, gradient, warn, critical, size = 120, id }: {
  value: number; max: number; label: string; unit: string; color: string;
  gradient: [string, string]; warn?: number; critical?: number; size?: number; id: string;
}) {
  const strokeW = 10;
  const radius = (size - strokeW - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(value / max, 1);
  const arcLength = circumference * 0.75;
  const offset = arcLength * (1 - percentage);
  const startAngle = 135;
  const cx = size / 2;
  const cy = size / 2;

  const lowIsWorse = label === 'Oil Press' || label === 'SOC';
  let activeColor = color;
  let activeGradient = gradient;
  if (critical !== undefined && warn !== undefined) {
    if (lowIsWorse ? value < critical : value > critical) {
      activeColor = '#ef4444';
      activeGradient = ['#dc2626', '#f87171'];
    } else if (lowIsWorse ? value < warn : value > warn) {
      activeColor = '#f59e0b';
      activeGradient = ['#d97706', '#fbbf24'];
    }
  }

  const gradId = `gauge-grad-${id}`;
  const glowId = `gauge-glow-${id}`;

  const formatValue = (v: number) => {
    if (typeof v !== 'number') return '—';
    if (v >= 10000) return `${(v / 1000).toFixed(1)}k`;
    if (v >= 1000) return v.toLocaleString();
    return v % 1 === 0 ? String(v) : v.toFixed(1);
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={activeGradient[0]} />
            <stop offset="100%" stopColor={activeGradient[1]} />
          </linearGradient>
          <filter id={glowId}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none" strokeWidth={strokeW} opacity="0.12"
          stroke={activeColor}
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          transform={`rotate(${startAngle} ${cx} ${cy})`}
          strokeLinecap="round"
        />
        {/* Tick marks */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick, i) => {
          const angle = (startAngle + tick * 270) * (Math.PI / 180);
          const inner = radius - strokeW / 2 - 3;
          const outer = radius - strokeW / 2 - 8;
          return (
            <line
              key={i}
              x1={cx + Math.cos(angle) * inner}
              y1={cy + Math.sin(angle) * inner}
              x2={cx + Math.cos(angle) * outer}
              y2={cy + Math.sin(angle) * outer}
              className="stroke-gray-300 dark:stroke-gray-600"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          );
        })}
        {/* Active arc */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none" strokeWidth={strokeW}
          stroke={`url(#${gradId})`}
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeDashoffset={offset}
          transform={`rotate(${startAngle} ${cx} ${cy})`}
          strokeLinecap="round"
          filter={`url(#${glowId})`}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
        {/* Value */}
        <text x={cx} y={cy - 2} textAnchor="middle" className="fill-gray-900 dark:fill-gray-50" style={{ fontSize: '18px', fontWeight: 700, fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', monospace", letterSpacing: '-0.5px' }}>
          {formatValue(value)}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-gray-400 dark:fill-gray-500" style={{ fontSize: '10px', fontFamily: 'system-ui', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          {unit}
        </text>
      </svg>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</span>
    </div>
  );
}

function TankGauge({ name, level, capacity, unit, color, gradient }: {
  name: string; level: number; capacity: number; unit: string; color: string; gradient: [string, string];
}) {
  const percentage = capacity > 0 ? Math.min((level / capacity) * 100, 100) : 0;
  const isLow = percentage < 20;
  const isCritical = percentage < 10;

  const fillColor = isCritical ? '#ef4444' : isLow ? '#f59e0b' : color;
  const fillGrad = isCritical ? ['#dc2626', '#f87171'] : isLow ? ['#d97706', '#fbbf24'] : gradient;
  const gradId = `tank-${name.replace(/\s/g, '')}`;

  return (
    <div className="flex flex-col items-center gap-3 group">
      <div className="relative">
        <svg width="72" height="140" viewBox="0 0 72 140">
          <defs>
            <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={fillGrad[0]} />
              <stop offset="100%" stopColor={fillGrad[1]} />
            </linearGradient>
            <clipPath id={`tank-clip-${gradId}`}>
              <rect x="6" y="10" width="60" height="120" rx="12" />
            </clipPath>
          </defs>
          {/* Tank body */}
          <rect x="6" y="10" width="60" height="120" rx="12" className="fill-gray-100 dark:fill-gray-700/50 stroke-gray-200 dark:stroke-gray-600" strokeWidth="1.5" />
          {/* Fill */}
          <rect
            x="6" width="60" rx="12"
            y={10 + 120 * (1 - percentage / 100)}
            height={120 * (percentage / 100)}
            fill={`url(#${gradId})`}
            clipPath={`url(#tank-clip-${gradId})`}
            style={{ transition: 'y 1.5s cubic-bezier(0.4,0,0.2,1), height 1.5s cubic-bezier(0.4,0,0.2,1)' }}
          />
          {/* Glass highlight */}
          <rect x="14" y="16" width="16" height="108" rx="8" fill="white" opacity="0.12" clipPath={`url(#tank-clip-${gradId})`} />
          {/* Scale lines */}
          {[25, 50, 75].map(mark => (
            <line key={mark} x1="56" y1={10 + 120 * (1 - mark / 100)} x2="62" y2={10 + 120 * (1 - mark / 100)} className="stroke-gray-300 dark:stroke-gray-500" strokeWidth="1" strokeLinecap="round" />
          ))}
          {/* Percentage */}
          <text x="36" y="75" textAnchor="middle" className="fill-gray-800 dark:fill-gray-100" style={{ fontSize: '16px', fontWeight: 700, fontFamily: "'SF Mono', monospace" }}>
            {Math.round(percentage)}%
          </text>
        </svg>
        {isCritical && (
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse" />
        )}
      </div>
      <div className="text-center">
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 leading-tight">{name}</div>
        <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono tabular-nums">
          {level.toLocaleString()} / {capacity.toLocaleString()} {unit}
        </div>
      </div>
    </div>
  );
}

function LEDIndicator({ active, color = 'emerald' }: { active: boolean; color?: string }) {
  const colorMap: Record<string, { bg: string; ring: string; glow: string }> = {
    emerald: { bg: 'bg-emerald-400', ring: 'ring-emerald-400/30', glow: 'shadow-[0_0_8px_rgba(52,211,153,0.5)]' },
    blue:    { bg: 'bg-blue-400',    ring: 'ring-blue-400/30',    glow: 'shadow-[0_0_8px_rgba(96,165,250,0.5)]' },
    amber:   { bg: 'bg-amber-400',   ring: 'ring-amber-400/30',   glow: 'shadow-[0_0_8px_rgba(251,191,35,0.5)]' },
    red:     { bg: 'bg-red-400',     ring: 'ring-red-400/30',     glow: 'shadow-[0_0_8px_rgba(248,113,113,0.5)]' },
  };
  const c = colorMap[color] || colorMap.emerald;

  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ring-4 transition-all duration-500 ${
      active ? `${c.bg} ${c.ring} ${c.glow}` : 'bg-gray-400/30 ring-gray-400/10 dark:bg-gray-600/30'
    }`} />
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

  const statusColor = isBattery
    ? (isBatteryCharging ? 'blue' : 'amber')
    : isRunning ? 'emerald' : 'gray';

  const statusStyles: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    blue:    'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    amber:   'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    gray:    'bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-500/20',
  };

  const iconBg: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-500',
    blue:    'bg-blue-500/10 text-blue-500',
    amber:   'bg-amber-500/10 text-amber-500',
    gray:    'bg-gray-500/10 text-gray-400',
  };

  return (
    <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700/60 shadow-sm hover:shadow-md transition-shadow duration-300">
      {/* Subtle top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${
        statusColor === 'emerald' ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
        statusColor === 'blue' ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
        statusColor === 'amber' ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
        'bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-500'
      }`} />
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg[statusColor]}`}>
            <IconComponent className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-50 tracking-tight">{equipment.name}</h4>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              {equipment.manufacturer} {equipment.model}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {isOnline && <LEDIndicator active={isBattery || isRunning} color={statusColor === 'gray' ? undefined : statusColor} />}
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${statusStyles[statusColor]}`}>
            {statusLabel}
          </span>
        </div>
      </div>
      {/* Gauges */}
      <div className="px-4 pb-5 pt-1 flex items-center justify-center gap-2 flex-wrap">
        {metricsToShow.map(metric => {
          const reading = readings.get(metric);
          const config = METRIC_CONFIG[metric];
          if (!config) return null;
          return (
            <CircularGauge
              key={metric}
              id={`${equipment.id}-${metric}`}
              value={reading ? reading.value : 0}
              max={config.max}
              label={config.label}
              unit={config.unit}
              color={config.color}
              gradient={config.gradient}
              warn={config.warn}
              critical={config.critical}
              size={115}
            />
          );
        })}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.FC<any>; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
        <Icon className="w-4 h-4" />
        <h3 className="text-xs font-bold uppercase tracking-[0.15em]">{title}</h3>
      </div>
      <div className="flex-1 h-px bg-gradient-to-r from-gray-200 dark:from-gray-700 to-transparent" />
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
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-blue-500/20" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!vesselId || vesselId === 'all') {
    return (
      <div className="text-center py-20 bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700/50">
        <Anchor className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
        <p className="text-gray-400 dark:text-gray-500 font-medium text-sm">Select a vessel to view monitoring data</p>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="text-center py-20 bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700/50 border-dashed">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center mx-auto mb-5">
          <WifiOff className="w-7 h-7 text-gray-300 dark:text-gray-500" />
        </div>
        <p className="text-gray-800 dark:text-gray-100 font-semibold text-base">No sensors connected</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
          Connect a NMEA 2000 gateway to see live engine hours, tank levels, and battery data.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-semibold">
          <Info className="w-3.5 h-3.5" />
          Equipment data is updated manually
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Connection status bar */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700/50 px-5 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide ${
            isOnline
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          }`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isOnline ? 'LIVE' : 'OFFLINE'}
          </div>
          {timeSinceUpdate !== null && (
            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5 font-mono tabular-nums">
              <Clock className="w-3 h-3" />
              {timeSinceUpdate < 1 ? 'Just now' : timeSinceUpdate < 60 ? `${timeSinceUpdate}m ago` : `${Math.floor(timeSinceUpdate / 60)}h ago`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all ${
              autoRefresh
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'bg-gray-100 text-gray-400 dark:bg-gray-700/50 dark:text-gray-500'
            }`}
          >
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={loadTelemetry}
            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
            title="Refresh now"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Engines */}
      {engines.length > 0 && (
        <div>
          <SectionHeader icon={Gauge} title="Main Engines" />
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
          <SectionHeader icon={Zap} title="Generators" />
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
          <SectionHeader icon={Battery} title="Battery Banks" />
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
          <SectionHeader icon={Droplets} title="Tanks" />
          <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-6 shadow-sm">
            <div className="flex items-end justify-center gap-10 flex-wrap">
              {resources.map((res) => {
                const tankConfig = TANK_CONFIG[res.resource_type] || { color: '#6b7280', gradient: ['#4b5563', '#9ca3af'] as [string, string], label: res.name };
                const levelReading = getResourceReadings(res.id).get('level');
                const currentLevel = levelReading
                  ? Math.round((levelReading.value / 100) * Number(res.capacity))
                  : Number(res.current_level);

                return (
                  <TankGauge
                    key={res.id}
                    name={tankConfig.label}
                    level={currentLevel}
                    capacity={Number(res.capacity)}
                    unit={res.unit}
                    color={tankConfig.color}
                    gradient={tankConfig.gradient}
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
          <SectionHeader icon={Activity} title="Systems" />
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
