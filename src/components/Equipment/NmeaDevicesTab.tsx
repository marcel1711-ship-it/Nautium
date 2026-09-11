import React, { useState, useEffect, useCallback } from 'react';
import {
  Radio, Link2, LinkIcon, Unlink, ToggleLeft, ToggleRight,
  RefreshCw, AlertCircle, CheckCircle, Clock, Cpu,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface NmeaDevicesTabProps {
  vesselId: string;
  companyId: string;
  equipment: any[];
}

interface NmeaMapping {
  id: string;
  vessel_id: string;
  company_id: string;
  device_type: string;
  instance_key: string;
  pgn: number;
  equipment_id: string | null;
  resource_id: string | null;
  label: string | null;
  enabled: boolean;
  last_seen_at: string | null;
  created_at: string;
}

interface FuelResource {
  id: string;
  name: string;
  resource_type: string;
  vessel_id: string;
}

const DEVICE_TYPE_LABELS: Record<string, string> = {
  engine: 'Engine',
  battery: 'Battery',
  tank: 'Tank',
  gps: 'GPS',
  environment: 'Environment',
  switch: 'Switch Panel',
  depth: 'Depth Sounder',
  wind: 'Wind Sensor',
  heading: 'Heading Sensor',
};

const DEVICE_TYPE_COLORS: Record<string, string> = {
  engine: 'bg-orange-100 text-orange-700 border-orange-200',
  battery: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  tank: 'bg-blue-100 text-blue-700 border-blue-200',
  gps: 'bg-green-100 text-green-700 border-green-200',
  environment: 'bg-teal-100 text-teal-700 border-teal-200',
  switch: 'bg-purple-100 text-purple-700 border-purple-200',
  depth: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  wind: 'bg-sky-100 text-sky-700 border-sky-200',
  heading: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function isStale(dateStr: string | null): boolean {
  if (!dateStr) return true;
  return Date.now() - new Date(dateStr).getTime() > 60_000;
}

export const NmeaDevicesTab: React.FC<NmeaDevicesTabProps> = ({ vesselId, companyId, equipment }) => {
  const [mappings, setMappings] = useState<NmeaMapping[]>([]);
  const [fuelResources, setFuelResources] = useState<FuelResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!vesselId || vesselId === 'all') { setMappings([]); setLoading(false); return; }
    setLoading(true);
    const [mappingsRes, fuelRes] = await Promise.all([
      supabase.from('nmea_device_mappings').select('*').eq('vessel_id', vesselId).order('device_type').order('instance_key'),
      supabase.from('fuel_resources').select('id, name, resource_type, vessel_id').eq('vessel_id', vesselId),
    ]);
    setMappings(mappingsRes.data || []);
    setFuelResources(fuelRes.data || []);
    setLoading(false);
  }, [vesselId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggle = async (mapping: NmeaMapping) => {
    setSaving(mapping.id);
    await supabase.from('nmea_device_mappings').update({ enabled: !mapping.enabled }).eq('id', mapping.id);
    setMappings(prev => prev.map(m => m.id === mapping.id ? { ...m, enabled: !m.enabled } : m));
    setSaving(null);
  };

  const handleMapEquipment = async (mapping: NmeaMapping, equipmentId: string) => {
    setSaving(mapping.id);
    const value = equipmentId === '' ? null : equipmentId;
    await supabase.from('nmea_device_mappings').update({ equipment_id: value }).eq('id', mapping.id);
    setMappings(prev => prev.map(m => m.id === mapping.id ? { ...m, equipment_id: value } : m));
    setSaving(null);
  };

  const handleMapResource = async (mapping: NmeaMapping, resourceId: string) => {
    setSaving(mapping.id);
    const value = resourceId === '' ? null : resourceId;
    await supabase.from('nmea_device_mappings').update({ resource_id: value }).eq('id', mapping.id);
    setMappings(prev => prev.map(m => m.id === mapping.id ? { ...m, resource_id: value } : m));
    setSaving(null);
  };

  if (!vesselId || vesselId === 'all') {
    return (
      <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
        <Radio className="w-14 h-14 text-gray-300 mx-auto mb-4" />
        <p className="text-lg font-semibold text-gray-700">Select a vessel</p>
        <p className="text-sm text-gray-500 mt-1">Choose a specific vessel from the top bar to see its NMEA devices.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-gray-200" />)}
      </div>
    );
  }

  if (mappings.length === 0) {
    return (
      <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
        <Cpu className="w-14 h-14 text-gray-300 mx-auto mb-4" />
        <p className="text-lg font-semibold text-gray-700">No NMEA devices discovered yet</p>
        <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
          Connect your Nautium Connect to the vessel's NMEA 2000 backbone. Devices will appear here automatically
          as they are detected on the bus.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
          <Radio className="w-3.5 h-3.5" />
          <span>Waiting for data from Nautium Connect...</span>
        </div>
      </div>
    );
  }

  const grouped = mappings.reduce((acc, m) => {
    if (!acc[m.device_type]) acc[m.device_type] = [];
    acc[m.device_type].push(m);
    return acc;
  }, {} as Record<string, NmeaMapping[]>);

  const typeOrder = ['engine', 'battery', 'tank', 'gps', 'environment', 'depth', 'wind', 'heading', 'switch'];
  const sortedTypes = typeOrder.filter(t => grouped[t]);

  const mappedCount = mappings.filter(m => m.equipment_id || m.resource_id).length;
  const liveCount = mappings.filter(m => !isStale(m.last_seen_at)).length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm">
          <Radio className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-700">{mappings.length} devices discovered</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm">
          <LinkIcon className="w-4 h-4 text-green-500" />
          <span className="text-sm font-semibold text-gray-700">{mappedCount} mapped</span>
          {mappings.length - mappedCount > 0 && (
            <span className="text-xs text-amber-600 font-medium">· {mappings.length - mappedCount} unmapped</span>
          )}
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm">
          {liveCount > 0
            ? <CheckCircle className="w-4 h-4 text-green-500" />
            : <AlertCircle className="w-4 h-4 text-gray-400" />
          }
          <span className="text-sm font-semibold text-gray-700">{liveCount} live</span>
        </div>
        <button onClick={loadData}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 transition-colors ml-auto">
          <RefreshCw className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-600">Refresh</span>
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
        <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          Map each NMEA device to an equipment item from your list. Once mapped, telemetry data flows
          automatically to the Monitor dashboard and maintenance hour tracking.
        </p>
      </div>

      {/* Device groups */}
      {sortedTypes.map(type => {
        const devices = grouped[type];
        const colors = DEVICE_TYPE_COLORS[type] || 'bg-gray-100 text-gray-700 border-gray-200';
        return (
          <div key={type} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className={`px-5 py-3 flex items-center gap-3 border-b ${colors}`}>
              <Radio className="w-4 h-4 flex-shrink-0" />
              <h3 className="text-sm font-bold uppercase tracking-wide">
                {DEVICE_TYPE_LABELS[type] || type}
              </h3>
              <span className="text-xs font-bold px-2 py-0.5 bg-white/50 rounded-full">{devices.length}</span>
            </div>

            <div className="divide-y divide-gray-100">
              {devices.map(device => {
                const stale = isStale(device.last_seen_at);
                const isMapped = !!(device.equipment_id || device.resource_id);
                const isTank = device.device_type === 'tank';

                return (
                  <div key={device.id} className={`px-5 py-4 ${!device.enabled ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-4 flex-wrap">
                      {/* Status + name */}
                      <div className="flex items-center gap-3 min-w-48">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${stale ? 'bg-gray-300' : 'bg-green-400 animate-pulse'}`} />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {device.label || `${DEVICE_TYPE_LABELS[device.device_type] || device.device_type} ${device.instance_key}`}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                            <span>PGN {device.pgn}</span>
                            <span>·</span>
                            <Clock className="w-3 h-3 inline" />
                            <span>{timeAgo(device.last_seen_at)}</span>
                          </p>
                        </div>
                      </div>

                      {/* Map to equipment */}
                      <div className="flex-1 min-w-52">
                        <label className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-1 block">
                          {isTank ? 'Map to Fuel Resource' : 'Map to Equipment'}
                        </label>
                        {isTank ? (
                          <select
                            value={device.resource_id || ''}
                            onChange={e => handleMapResource(device, e.target.value)}
                            disabled={saving === device.id}
                            className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                              device.resource_id ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'
                            }`}
                          >
                            <option value="">— Not mapped —</option>
                            {fuelResources.map(r => (
                              <option key={r.id} value={r.id}>{r.name} ({r.resource_type})</option>
                            ))}
                          </select>
                        ) : (
                          <select
                            value={device.equipment_id || ''}
                            onChange={e => handleMapEquipment(device, e.target.value)}
                            disabled={saving === device.id}
                            className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                              device.equipment_id ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'
                            }`}
                          >
                            <option value="">— Not mapped —</option>
                            {equipment.map(eq => (
                              <option key={eq.id} value={eq.id}>{eq.name} ({eq.type})</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Status badge */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isMapped ? (
                          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                            <Link2 className="w-3 h-3" /> Mapped
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                            <Unlink className="w-3 h-3" /> Unmapped
                          </span>
                        )}
                      </div>

                      {/* Enable/disable toggle */}
                      <button
                        onClick={() => handleToggle(device)}
                        disabled={saving === device.id}
                        className="flex-shrink-0 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                        title={device.enabled ? 'Disable this device' : 'Enable this device'}
                      >
                        {device.enabled
                          ? <ToggleRight className="w-7 h-7 text-green-500" />
                          : <ToggleLeft className="w-7 h-7 text-gray-300" />
                        }
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
