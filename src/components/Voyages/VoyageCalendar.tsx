import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, MapPin, Ship, Filter } from 'lucide-react';
import { fetchByCompany } from '../../lib/supabase';
import { Voyage, Vessel } from '../../types';

const VESSEL_COLORS = [
  { bg: '#eff6ff', bar: '#3b82f6', text: '#1d4ed8', border: '#93c5fd' },
  { bg: '#fef3c7', bar: '#f59e0b', text: '#b45309', border: '#fcd34d' },
  { bg: '#f0fdf4', bar: '#22c55e', text: '#15803d', border: '#86efac' },
  { bg: '#fdf2f8', bar: '#ec4899', text: '#be185d', border: '#f9a8d4' },
  { bg: '#f5f3ff', bar: '#8b5cf6', text: '#6d28d9', border: '#c4b5fd' },
  { bg: '#fff7ed', bar: '#f97316', text: '#c2410c', border: '#fdba74' },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  planned:   { bg: '#eff6ff', text: '#2563eb', label: 'Planned' },
  active:    { bg: '#f0fdf4', text: '#16a34a', label: 'Active' },
  completed: { bg: '#f9fafb', text: '#6b7280', label: 'Completed' },
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

interface Props {
  companyId: string;
  vessels: Vessel[];
  selectedVesselId?: string | null;
  onNavigate: (page: string, params?: any) => void;
}

export const UpcomingVoyagesCard: React.FC<Props> = ({ companyId, vessels, selectedVesselId, onNavigate }) => {
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    fetchByCompany('voyages', companyId, 'departure_date', true)
      .then(data => setVoyages(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId]);

  const vesselColorMap = useMemo(() => {
    const map: Record<string, typeof VESSEL_COLORS[0]> = {};
    vessels.forEach((v, i) => { map[v.id] = VESSEL_COLORS[i % VESSEL_COLORS.length]; });
    return map;
  }, [vessels]);

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return voyages
      .filter(v => (v.departure_date || '') >= today || v.status === 'active')
      .filter(v => !selectedVesselId || selectedVesselId === 'all' || v.vessel_id === selectedVesselId)
      .sort((a, b) => (a.departure_date || '').localeCompare(b.departure_date || ''))
      .slice(0, 3);
  }, [voyages, selectedVesselId]);

  const getVesselName = (vid: string) => vessels.find(v => v.id === vid)?.name || 'Vessel';

  const formatShortDate = (d?: string) => {
    if (!d) return '—';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e5e7eb', padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={16} style={{ color: '#2563eb' }} />
              Upcoming Voyages
            </h2>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              <span style={{ fontWeight: 600, color: '#374151' }}>{upcoming.length}</span> upcoming
            </div>
          </div>
          <button
            onClick={() => setShowCalendar(true)}
            style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            View Calendar →
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[1,2,3].map(i => <div key={i} style={{ height: 52, background: '#f9fafb', borderRadius: 10 }} />)}
          </div>
        ) : upcoming.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <Ship size={36} style={{ color: '#d1d5db', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 13, color: '#9ca3af' }}>No upcoming voyages</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {upcoming.map(voyage => {
              const colors = vesselColorMap[voyage.vessel_id] || VESSEL_COLORS[0];
              const status = STATUS_STYLES[voyage.status] || STATUS_STYLES.planned;
              return (
                <div key={voyage.id}
                  onClick={() => onNavigate('guest-list')}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', background: '#f9fafb', border: '1px solid transparent', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = colors.bg; e.currentTarget.style.borderColor = colors.border; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = 'transparent'; }}
                >
                  <div style={{ width: 3, height: 40, borderRadius: 2, background: colors.bar, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {voyage.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={10} />
                      {voyage.departure_port} → {voyage.arrival_port}
                    </div>
                    {vessels.length > 1 && (
                      <div style={{ fontSize: 10, color: colors.text, fontWeight: 600, marginTop: 2 }}>
                        {getVesselName(voyage.vessel_id)}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                      {formatShortDate(voyage.departure_date)}
                    </div>
                    <div style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 6, background: status.bg, fontSize: 10, fontWeight: 600, color: status.text, marginTop: 3 }}>
                      {status.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCalendar && (
        <VoyageCalendarModal
          voyages={voyages}
          vessels={vessels}
          vesselColorMap={vesselColorMap}
          initialVesselId={selectedVesselId}
          onClose={() => setShowCalendar(false)}
          onNavigate={onNavigate}
        />
      )}
    </>
  );
};

const VoyageCalendarModal: React.FC<{
  voyages: Voyage[];
  vessels: Vessel[];
  vesselColorMap: Record<string, typeof VESSEL_COLORS[0]>;
  initialVesselId?: string | null;
  onClose: () => void;
  onNavigate: (page: string, params?: any) => void;
}> = ({ voyages, vessels, vesselColorMap, initialVesselId, onClose, onNavigate }) => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [filterVessel, setFilterVessel] = useState<string>(initialVesselId && initialVesselId !== 'all' ? initialVesselId : 'all');
  const [hoveredVoyage, setHoveredVoyage] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const filtered = useMemo(() => {
    return voyages.filter(v => filterVessel === 'all' || v.vessel_id === filterVessel);
  }, [voyages, filterVessel]);

  const getVoyagesForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filtered.filter(v => {
      const dep = v.departure_date || '';
      const arr = v.arrival_date || dep;
      return dateStr >= dep && dateStr <= arr;
    });
  };

  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const getVesselName = (vid: string) => vessels.find(v => v.id === vid)?.name || 'Vessel';

  const formatFullDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const hoveredData = useMemo(() => {
    if (!hoveredVoyage) return null;
    return voyages.find(v => v.id === hoveredVoyage) || null;
  }, [hoveredVoyage, voyages]);

  const handleVoyageHover = (voyageId: string, e: React.MouseEvent) => {
    setHoveredVoyage(voyageId);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'white', borderRadius: 20, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', width: '100%', maxWidth: 820, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={prevMonth} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={16} color="#374151" />
            </button>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0, minWidth: 180, textAlign: 'center' }}>
              {MONTHS[month]} {year}
            </h2>
            <button onClick={nextMonth} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={16} color="#374151" />
            </button>
            <button onClick={goToday} style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', background: '#eff6ff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
              Today
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {vessels.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={13} color="#9ca3af" />
                <select
                  value={filterVessel}
                  onChange={e => setFilterVessel(e.target.value)}
                  style={{ fontSize: 12, fontWeight: 500, color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, padding: '5px 10px', background: 'white', cursor: 'pointer' }}
                >
                  <option value="all">All Vessels</option>
                  {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            )}
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} color="#6b7280" />
            </button>
          </div>
        </div>

        {/* Vessel legend */}
        {vessels.length > 1 && filterVessel === 'all' && (
          <div style={{ padding: '10px 24px', display: 'flex', gap: 14, flexWrap: 'wrap', borderBottom: '1px solid #f3f4f6' }}>
            {vessels.map(v => {
              const c = vesselColorMap[v.id] || VESSEL_COLORS[0];
              return (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: c.bar }} />
                  {v.name}
                </div>
              );
            })}
          </div>
        )}

        {/* Calendar grid */}
        <div style={{ padding: '16px 24px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#9ca3af', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
            {cells.map((day, idx) => {
              if (day === null) return <div key={idx} style={{ minHeight: 80, background: '#fafafa', borderRadius: 6 }} />;
              const dayVoyages = getVoyagesForDay(day);
              const todayStyle = isToday(day);
              return (
                <div
                  key={idx}
                  style={{
                    minHeight: 80, borderRadius: 6, padding: '4px 5px',
                    background: todayStyle ? '#eff6ff' : 'white',
                    border: todayStyle ? '1.5px solid #93c5fd' : '1px solid #f3f4f6',
                    cursor: 'pointer', transition: 'background 0.1s',
                    position: 'relative',
                  }}
                  onClick={() => onNavigate('guest-list')}
                  onMouseEnter={e => { if (!todayStyle) e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={e => { if (!todayStyle) e.currentTarget.style.background = 'white'; }}
                >
                  <div style={{
                    fontSize: 12, fontWeight: todayStyle ? 700 : 500,
                    color: todayStyle ? '#2563eb' : '#374151',
                    marginBottom: 3,
                  }}>
                    {day}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {dayVoyages.slice(0, 3).map(v => {
                      const c = vesselColorMap[v.vessel_id] || VESSEL_COLORS[0];
                      const isStart = v.departure_date === `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                      return (
                        <div
                          key={v.id}
                          onMouseEnter={e => handleVoyageHover(v.id, e)}
                          onMouseLeave={() => { setHoveredVoyage(null); setTooltipPos(null); }}
                          onClick={e => { e.stopPropagation(); onNavigate('guest-list'); }}
                          style={{
                            fontSize: 10, fontWeight: 600, color: c.text,
                            background: c.bg, borderLeft: `3px solid ${c.bar}`,
                            padding: '2px 5px', borderRadius: 4,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            cursor: 'pointer',
                          }}
                        >
                          {isStart ? v.name : '·'}
                        </div>
                      );
                    })}
                    {dayVoyages.length > 3 && (
                      <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, paddingLeft: 4 }}>
                        +{dayVoyages.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredData && tooltipPos && (
        <div style={{
          position: 'fixed',
          left: tooltipPos.x, top: tooltipPos.y,
          transform: 'translate(-50%, -100%)',
          background: '#111827', color: 'white',
          borderRadius: 10, padding: '10px 14px',
          fontSize: 12, zIndex: 60,
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          pointerEvents: 'none', maxWidth: 260,
          whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{hoveredData.name}</div>
          <div style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <MapPin size={10} /> {hoveredData.departure_port} → {hoveredData.arrival_port}
          </div>
          <div style={{ color: '#9ca3af', marginBottom: 3 }}>
            {formatFullDate(hoveredData.departure_date)} — {formatFullDate(hoveredData.arrival_date)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Ship size={10} color="#9ca3af" />
            <span style={{ color: '#d1d5db' }}>{getVesselName(hoveredData.vessel_id)}</span>
            <span style={{
              padding: '1px 6px', borderRadius: 4,
              background: STATUS_STYLES[hoveredData.status]?.bg || '#f9fafb',
              color: STATUS_STYLES[hoveredData.status]?.text || '#6b7280',
              fontSize: 10, fontWeight: 600,
            }}>
              {STATUS_STYLES[hoveredData.status]?.label || hoveredData.status}
            </span>
          </div>
          {hoveredData.notes && (
            <div style={{ color: '#6b7280', marginTop: 4, fontSize: 11, whiteSpace: 'normal' }}>
              {hoveredData.notes}
            </div>
          )}
          <div style={{
            position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)',
            width: 10, height: 10, background: '#111827', rotate: '45deg', borderRadius: 2,
          }} />
        </div>
      )}
    </div>
  );
};

export default UpcomingVoyagesCard;
