import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Wifi, WifiOff, RefreshCw, Info } from 'lucide-react';
import { fetchByCompany } from '../../lib/supabase';

/* ── Types ─────────────────────────────────────────────────────────── */

interface MonitorTabProps { vesselId: string; companyId: string; equipment: any[]; }
interface TReading { equipment_id: string | null; resource_id: string | null; metric: string; value: number; unit: string; recorded_at: string; }
interface FuelRes { id: string; name: string; resource_type: string; capacity: string; current_level: string; unit: string; vessel_id: string; }

/* ── Theme tokens (scoped to .eicas) ───────────────────────────────── */

const EICAS_STYLE = `
.eicas{--bg:#0B1220;--card:#121A28;--border:#1F2A3A;--text:#E8EEF4;--muted:#8B9AAB;--ok:#3DDC97;--warn:#E8B84A;--alarm:#E24B4A;--accent:#2A9B8F;background:var(--bg);color:var(--text);font-variant-numeric:tabular-nums}
.eicas *{box-sizing:border-box}
`;

/* ── Thresholds ────────────────────────────────────────────────────── */

interface Alert { equipment: string; metric: string; value: number; unit: string; level: 'alarm' | 'advisory'; }

function checkAlert(name: string, metric: string, val: number, unit: string, rpm?: number): Alert | null {
  if (metric === 'temperature' && val > 95) return { equipment: name, metric: 'coolant', value: val, unit, level: 'alarm' };
  if (metric === 'temperature' && val > 90) return { equipment: name, metric: 'coolant', value: val, unit, level: 'advisory' };
  if (metric === 'oil_pressure' && val < 2.0 && rpm !== undefined && rpm > 600) return { equipment: name, metric: 'oil press', value: val, unit, level: 'alarm' };
  if (metric === 'load' && val > 95) return { equipment: name, metric: 'load', value: val, unit, level: 'alarm' };
  if (metric === 'load' && val > 80) return { equipment: name, metric: 'load', value: val, unit, level: 'advisory' };
  if (metric === 'state_of_charge' && val < 20) return { equipment: name, metric: 'SOC', value: val, unit, level: 'alarm' };
  if (metric === 'state_of_charge' && val < 30) return { equipment: name, metric: 'SOC', value: val, unit, level: 'advisory' };
  return null;
}

function valueColor(metric: string, val: number, rpm?: number): string {
  if (metric === 'temperature' && val > 95) return 'var(--alarm)';
  if (metric === 'temperature' && val > 90) return 'var(--warn)';
  if (metric === 'oil_pressure' && val < 2.0 && rpm !== undefined && rpm > 600) return 'var(--alarm)';
  if (metric === 'load' && val > 95) return 'var(--alarm)';
  if (metric === 'load' && val > 80) return 'var(--warn)';
  if (metric === 'state_of_charge' && val < 20) return 'var(--alarm)';
  if (metric === 'state_of_charge' && val < 30) return 'var(--warn)';
  if (metric === 'battery_temp' && val > 50) return 'var(--alarm)';
  if (metric === 'battery_temp' && val > 40) return 'var(--warn)';
  return 'var(--text)';
}

/* ── Primitives ────────────────────────────────────────────────────── */

function StatePill({ label, state }: { label: string; state: 'running' | 'stopped' | 'charging' | 'discharging' | 'stale' }) {
  const bg: Record<string, string> = { running: 'var(--ok)', stopped: 'var(--muted)', charging: 'var(--accent)', discharging: 'var(--warn)', stale: 'var(--alarm)' };
  return (
    <span style={{ background: bg[state] || 'var(--muted)', color: '#0B1220', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      {label}
    </span>
  );
}

function Metric({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div style={{ minWidth: 72 }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: color || 'var(--text)', transition: 'color 0.3s' }}>{value}</span>
        {unit && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{unit}</span>}
      </div>
    </div>
  );
}

function ThinBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--border)', marginTop: 4, overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: color, transition: 'width 0.8s ease-out' }} />
    </div>
  );
}

function TankRow({ name, pct, capacity, unit, current }: { name: string; pct: number; capacity: number; unit: string; current: number }) {
  const color = pct < 10 ? 'var(--alarm)' : pct < 20 ? 'var(--warn)' : 'var(--accent)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 100, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>{name}</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: color, transition: 'width 1s ease-out' }} />
          </div>
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, color: pct < 20 ? color : 'var(--text)', minWidth: 48, textAlign: 'right', transition: 'color 0.3s' }}>
          {Math.round(pct)}%
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', minWidth: 100, textAlign: 'right' }}>
        {current.toLocaleString()} / {capacity.toLocaleString()} {unit}
      </div>
    </div>
  );
}

/* ── Format helpers ────────────────────────────────────────────────── */

function fmtVal(v: number, decimals = 1): string {
  if (v >= 1000) return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return v % 1 === 0 ? String(v) : v.toFixed(decimals);
}

function fmtAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 5) return `${(ms / 1000).toFixed(1)}s ago`;
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

/* ── Main component ────────────────────────────────────────────────── */

const MONITORABLE = ['Main Engine', 'Generator', 'HVAC', 'Compressor', 'Battery Bank'];
const TANK_LABELS: Record<string, string> = { diesel_main: 'DIESEL MAIN', diesel_generator: 'DIESEL GEN', fresh_water: 'FRESH WATER', grey_water: 'GREY WATER', black_water: 'BLACK WATER', gasoline: 'GASOLINE' };

export const MonitorTab: React.FC<MonitorTabProps> = ({ vesselId, companyId, equipment }) => {
  const [telemetry, setTelemetry] = useState<TReading[]>([]);
  const [resources, setResources] = useState<FuelRes[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const monEq = equipment.filter((e: any) => MONITORABLE.includes(e.type) && e.vessel_id === vesselId);

  const load = useCallback(async () => {
    if (!companyId || !vesselId || vesselId === 'all') return;
    try {
      const [td, rd] = await Promise.all([
        fetchByCompany('vessel_telemetry', companyId, 'recorded_at', false),
        fetchByCompany('fuel_resources', companyId, 'name', true),
      ]);
      const vt = td.filter((t: any) => t.vessel_id === vesselId);
      setTelemetry(vt);
      setResources(rd.filter((r: any) => r.vessel_id === vesselId));
      if (vt.length > 0) setLastUpdate(new Date(vt[0].recorded_at));
    } catch { /* silent */ } finally { setLoading(false); }
  }, [companyId, vesselId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!autoRefresh) return; const i = setInterval(load, 10000); return () => clearInterval(i); }, [autoRefresh, load]);

  const latest = useCallback((eqId: string): Map<string, TReading> => {
    const m = new Map<string, TReading>();
    for (const t of telemetry) { if (t.equipment_id === eqId && !m.has(t.metric)) m.set(t.metric, t); }
    return m;
  }, [telemetry]);

  const resLatest = useCallback((rId: string): Map<string, TReading> => {
    const m = new Map<string, TReading>();
    for (const t of telemetry) { if (t.resource_id === rId && !m.has(t.metric)) m.set(t.metric, t); }
    return m;
  }, [telemetry]);

  const hasData = telemetry.length > 0;
  const ageMs = lastUpdate ? Date.now() - lastUpdate.getTime() : Infinity;
  const isLive = ageMs < 5 * 60 * 1000;
  const isStale = hasData && ageMs > 5 * 60 * 1000;

  const engines = monEq.filter((e: any) => e.type === 'Main Engine');
  const generators = monEq.filter((e: any) => e.type === 'Generator');
  const batteries = monEq.filter((e: any) => e.type === 'Battery Bank');
  const systems = monEq.filter((e: any) => !['Main Engine', 'Generator', 'Battery Bank'].includes(e.type));

  const alerts = useMemo<Alert[]>(() => {
    const a: Alert[] = [];
    for (const eq of [...engines, ...generators, ...batteries, ...systems]) {
      const r = latest(eq.id);
      const rpm = r.get('rpm')?.value;
      r.forEach((reading, metric) => {
        const al = checkAlert(eq.name, metric, reading.value, reading.unit, rpm);
        if (al) a.push(al);
      });
    }
    return a;
  }, [engines, generators, batteries, systems, latest]);

  const critCount = alerts.filter(a => a.level === 'alarm').length;
  const advCount = alerts.filter(a => a.level === 'advisory').length;

  /* ── Empty states ─────────────────────────────────────────────────── */

  if (loading) return (
    <div className="eicas" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320, background: '#0B1220', borderRadius: 8 }}>
      <style>{EICAS_STYLE}</style>
      <div style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!vesselId || vesselId === 'all') return (
    <div className="eicas" style={{ textAlign: 'center', padding: '80px 20px', background: '#0B1220', borderRadius: 8, border: '1px solid #1F2A3A' }}>
      <style>{EICAS_STYLE}</style>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>Select a vessel to view monitoring data</div>
    </div>
  );

  if (!hasData) return (
    <div className="eicas" style={{ textAlign: 'center', padding: '80px 20px', background: '#0B1220', borderRadius: 8, border: '1px dashed #1F2A3A' }}>
      <style>{EICAS_STYLE}</style>
      <WifiOff style={{ width: 32, height: 32, color: '#1F2A3A', margin: '0 auto 16px' }} />
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>No live feed</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
        Connect a NMEA 2000 gateway to see live engine, tank, and battery data.
      </div>
    </div>
  );

  /* ── Card style helper ────────────────────────────────────────────── */

  const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px' };
  const sectionLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--muted)', marginBottom: 10 };

  return (
    <div className="eicas" style={{ background: 'var(--bg)', borderRadius: 8, padding: 16 }}>
      <style>{EICAS_STYLE}</style>

      {/* ── Status bar ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '8px 14px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', background: isLive ? 'rgba(61,220,151,0.12)' : isStale ? 'rgba(226,75,74,0.12)' : 'rgba(139,154,171,0.12)', color: isLive ? 'var(--ok)' : isStale ? 'var(--alarm)' : 'var(--muted)' }}>
            {isLive ? <Wifi style={{ width: 12, height: 12 }} /> : <WifiOff style={{ width: 12, height: 12 }} />}
            {isLive ? 'LIVE' : isStale ? 'STALE' : 'OFFLINE'}
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>NMEA 2000</span>
          {lastUpdate && <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{fmtAge(ageMs)}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: autoRefresh ? 'rgba(42,155,143,0.15)' : 'var(--border)', color: autoRefresh ? 'var(--accent)' : 'var(--muted)' }}
          >
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </button>
          <button onClick={load} style={{ padding: 4, border: 'none', cursor: 'pointer', background: 'none', color: 'var(--muted)', display: 'flex' }} title="Refresh">
            <RefreshCw style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      {/* ── Alarm strip ─────────────────────────────────────────────── */}
      {isStale ? (
        <div style={{ padding: '8px 14px', borderRadius: 6, background: 'rgba(226,75,74,0.12)', border: '1px solid rgba(226,75,74,0.3)', marginBottom: 14, fontSize: 12, fontWeight: 600, color: 'var(--alarm)' }}>
          GATEWAY DISCONNECTED — last data {fmtAge(ageMs)}. Values shown are stale.
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '6px 14px', borderRadius: 6, background: critCount > 0 ? 'rgba(226,75,74,0.08)' : 'var(--card)', border: `1px solid ${critCount > 0 ? 'rgba(226,75,74,0.2)' : 'var(--border)'}`, marginBottom: 14, fontSize: 11, fontWeight: 600 }}>
          <span style={{ color: critCount > 0 ? 'var(--alarm)' : 'var(--ok)' }}>{critCount} critical</span>
          <span style={{ color: advCount > 0 ? 'var(--warn)' : 'var(--muted)' }}>{advCount} advisory</span>
          {alerts.length > 0 && <span style={{ color: alerts[0].level === 'alarm' ? 'var(--alarm)' : 'var(--warn)', fontWeight: 400 }}>{alerts[0].equipment} {alerts[0].metric} {alerts[0].value}{alerts[0].unit}</span>}
        </div>
      )}

      {/* ── Two-column layout ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }} className="eicas-grid">
        <style>{`@media(min-width:1200px){.eicas-grid{grid-template-columns:58% 1fr!important}}`}</style>

        {/* LEFT: Propulsion + Power + Tanks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* PROPULSION */}
          {engines.length > 0 && (
            <div style={card}>
              <div style={sectionLabel}>PROPULSION</div>
              {engines.map((eng: any, i: number) => {
                const r = latest(eng.id);
                const status = r.get('status');
                const isRunning = status ? status.value === 1 : false;
                const hours = r.get('hours')?.value ?? 0;
                const rpm = r.get('rpm')?.value ?? 0;
                const temp = r.get('temperature')?.value ?? 0;
                const oil = r.get('oil_pressure')?.value ?? 0;
                const nameTag = eng.name?.toUpperCase().includes('PORT') ? 'PORT' : eng.name?.toUpperCase().includes('STAR') ? 'STBD' : eng.name;
                return (
                  <div key={eng.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none', paddingTop: i > 0 ? 12 : 0, marginTop: i > 0 ? 12 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{nameTag}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{eng.manufacturer} {eng.model}</span>
                      <StatePill label={isRunning ? 'RUNNING' : 'STOPPED'} state={isRunning ? 'running' : 'stopped'} />
                    </div>
                    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                      <Metric label="HOURS" value={fmtVal(hours)} unit="hrs" />
                      <div style={{ minWidth: 100 }}>
                        <Metric label="RPM" value={String(Math.round(rpm))} color={isRunning && rpm > 2300 ? 'var(--alarm)' : undefined} />
                        {isRunning && <ThinBar value={rpm} max={2500} color={rpm > 2300 ? 'var(--alarm)' : rpm > 2000 ? 'var(--warn)' : 'var(--ok)'} />}
                      </div>
                      <Metric label="COOLANT" value={fmtVal(temp)} unit="°C" color={valueColor('temperature', temp)} />
                      <Metric label="OIL" value={fmtVal(oil)} unit="bar" color={valueColor('oil_pressure', oil, rpm)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* POWER */}
          {generators.length > 0 && (
            <div style={card}>
              <div style={sectionLabel}>POWER</div>
              {generators.map((gen: any, i: number) => {
                const r = latest(gen.id);
                const status = r.get('status');
                const isRunning = status ? status.value === 1 : false;
                const hours = r.get('hours')?.value ?? 0;
                const volts = r.get('voltage')?.value ?? 0;
                const loadPct = r.get('load')?.value ?? 0;
                const temp = r.get('temperature')?.value ?? 0;
                return (
                  <div key={gen.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none', paddingTop: i > 0 ? 12 : 0, marginTop: i > 0 ? 12 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{gen.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{gen.manufacturer} {gen.model}</span>
                      <StatePill label={isRunning ? 'RUNNING' : 'STOPPED'} state={isRunning ? 'running' : 'stopped'} />
                    </div>
                    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                      <Metric label="HOURS" value={fmtVal(hours)} unit="hrs" />
                      <Metric label="VOLTS" value={String(Math.round(volts))} unit="V" />
                      <div style={{ minWidth: 100 }}>
                        <Metric label="LOAD" value={String(Math.round(loadPct))} unit="%" color={valueColor('load', loadPct)} />
                        {isRunning && <ThinBar value={loadPct} max={100} color={loadPct > 95 ? 'var(--alarm)' : loadPct > 80 ? 'var(--warn)' : 'var(--ok)'} />}
                      </div>
                      <Metric label="TEMP" value={fmtVal(temp)} unit="°C" color={valueColor('temperature', temp)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TANKS */}
          {resources.length > 0 && (
            <div style={card}>
              <div style={sectionLabel}>TANKS</div>
              {resources.map(res => {
                const lr = resLatest(res.id).get('level');
                const cap = Number(res.capacity);
                const cur = lr ? Math.round((lr.value / 100) * cap) : Number(res.current_level);
                const pct = cap > 0 ? Math.min((cur / cap) * 100, 100) : 0;
                const label = TANK_LABELS[res.resource_type] || res.name.toUpperCase();
                return <TankRow key={res.id} name={label} pct={pct} capacity={cap} unit={res.unit} current={cur} />;
              })}
            </div>
          )}

          {/* SYSTEMS (HVAC etc) */}
          {systems.length > 0 && (
            <div style={card}>
              <div style={sectionLabel}>SYSTEMS</div>
              {systems.map((sys: any, i: number) => {
                const r = latest(sys.id);
                const status = r.get('status');
                const isRunning = status ? status.value === 1 : false;
                const hours = r.get('hours')?.value ?? 0;
                const temp = r.get('temperature')?.value ?? 0;
                return (
                  <div key={sys.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none', paddingTop: i > 0 ? 12 : 0, marginTop: i > 0 ? 12 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{sys.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{sys.manufacturer} {sys.model}</span>
                      <StatePill label={isRunning ? 'RUNNING' : 'STOPPED'} state={isRunning ? 'running' : 'stopped'} />
                    </div>
                    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                      <Metric label="HOURS" value={fmtVal(hours)} unit="hrs" />
                      <Metric label="TEMP" value={fmtVal(temp)} unit="°C" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Electrical + Connection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ELECTRICAL */}
          {batteries.length > 0 && (
            <div style={card}>
              <div style={sectionLabel}>ELECTRICAL</div>
              {batteries.map((bat: any, i: number) => {
                const r = latest(bat.id);
                const soc = r.get('state_of_charge')?.value ?? 0;
                const volts = r.get('battery_voltage')?.value ?? 0;
                const amps = r.get('battery_current')?.value ?? 0;
                const isCharging = amps > 0;
                return (
                  <div key={bat.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none', paddingTop: i > 0 ? 12 : 0, marginTop: i > 0 ? 12 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{bat.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{bat.manufacturer}</span>
                      <StatePill label={isCharging ? 'CHARGING' : 'DISCHARGING'} state={isCharging ? 'charging' : 'discharging'} />
                    </div>
                    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                      <Metric label="SOC" value={fmtVal(soc)} unit="%" color={valueColor('state_of_charge', soc)} />
                      <Metric label="VOLTAGE" value={fmtVal(volts)} unit="V" />
                      <Metric label="CURRENT" value={fmtVal(Math.abs(amps))} unit={`A ${isCharging ? '↑' : '↓'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* CONNECTION */}
          <div style={card}>
            <div style={sectionLabel}>CONNECTION</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>NMEA 2000 Gateway</span>
              <StatePill label={isLive ? 'CONNECTED' : 'STALE'} state={isLive ? 'running' : 'stale'} />
            </div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              <Metric label="LAST PACKET" value={lastUpdate ? fmtAge(ageMs) : '—'} />
              <Metric label="STATUS" value={isLive ? 'Receiving' : 'No data'} color={isLive ? 'var(--ok)' : 'var(--alarm)'} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 2 }}>REFRESH</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{autoRefresh ? '10s interval' : 'Manual'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
