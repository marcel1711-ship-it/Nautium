import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, CheckCircle, Package, DollarSign,
  Wrench, Shield, Anchor, LogOut, Droplets, ChevronDown, ChevronUp, Globe,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { isLowStock, formatDate, calculateDaysUntilDue } from '../utils/helpers';
import {
  demoMaintenanceTasks, demoInventoryItems, demoMaintenanceHistory,
  demoVessels,
} from '../data/demoData';
import { MaintenanceTask, InventoryItem, MaintenanceHistory, Vessel } from '../types';

const isDemoUser = (email: string) => email === 'admin@yachtmaintenance.pro';

interface OwnerDashboardProps {
  onNavigate: (page: string, params?: any) => void;
}

type Lang = 'en' | 'es';

// ── Translations ──────────────────────────────────────────
const T = {
  en: {
    vesselLabel: 'Vessel',
    statusOk: 'All systems operational',
    statusWarn: 'Attention needed',
    statusCritical: 'Critical — action required',
    actionRequired: 'Action required',
    overdueTasks: (n: number) => `${n} overdue task${n > 1 ? 's' : ''}`,
    outOfStock: (n: number) => `${n} out of stock`,
    vesselStatus: 'Vessel status',
    maintenance: 'Maintenance',
    maintenanceHealth: 'Maintenance health',
    inventory: 'Inventory',
    inventoryHealth: 'Inventory health',
    fuel: 'Fuel level',
    fuelLabel: 'Fuel level',
    costs: 'This month',
    costsLabel: 'Monthly costs',
    overdue: 'Overdue',
    dueSoon: 'Due soon',
    upcoming: 'Upcoming',
    onTrack: '✓ On track',
    fullyStocked: '✓ Fully stocked',
    itemsLow: (n: number) => `${n} item${n > 1 ? 's' : ''} need reorder`,
    itemsNeedReorder: 'Items needing reorder',
    tankDetails: 'Tank details',
    fuelLow: 'Low — refill soon',
    fuelHalf: 'Below half',
    fuelGood: 'Good level',
    topExpenses: (m: string) => `Top expenses · ${m}`,
    last3Months: 'Last 3 months',
    current: 'current',
    recentWork: 'Recent work done',
    readOnly: 'Owner view — read only',
    readOnlySub: "Full visibility into your vessel's operations. Contact your fleet manager for any changes.",
    wordmark: 'Nautium · Every vessel under control',
    noPending: 'No pending tasks',
    overdueDays: (d: number) => `${d}d overdue`,
    daysLeft: (d: number) => `${d}d left`,
    vsLastMonth: (d: number) => `${d > 0 ? '+' : ''}€${Math.abs(d).toLocaleString()} vs last month`,
    operationalCosts: 'Operational costs',
  },
  es: {
    vesselLabel: 'Embarcación',
    statusOk: 'Todos los sistemas operativos',
    statusWarn: 'Requiere atención',
    statusCritical: 'Crítico — acción requerida',
    actionRequired: 'Acción requerida',
    overdueTasks: (n: number) => `${n} tarea${n > 1 ? 's' : ''} vencida${n > 1 ? 's' : ''}`,
    outOfStock: (n: number) => `${n} sin stock`,
    vesselStatus: 'Estado de la embarcación',
    maintenance: 'Mantenimiento',
    maintenanceHealth: 'Estado de mantenimiento',
    inventory: 'Inventario',
    inventoryHealth: 'Estado de inventario',
    fuel: 'Nivel de combustible',
    fuelLabel: 'Nivel de combustible',
    costs: 'Este mes',
    costsLabel: 'Costes mensuales',
    overdue: 'Vencido',
    dueSoon: 'Próximo a vencer',
    upcoming: 'Próximamente',
    onTrack: '✓ Al día',
    fullyStocked: '✓ Stock completo',
    itemsLow: (n: number) => `${n} artículo${n > 1 ? 's' : ''} necesitan reposición`,
    itemsNeedReorder: 'Artículos a reponer',
    tankDetails: 'Detalles del tanque',
    fuelLow: 'Bajo — reponer pronto',
    fuelHalf: 'Por debajo de la mitad',
    fuelGood: 'Nivel adecuado',
    topExpenses: (m: string) => `Principales gastos · ${m}`,
    last3Months: 'Últimos 3 meses',
    current: 'actual',
    recentWork: 'Trabajos recientes',
    readOnly: 'Vista de propietario — solo lectura',
    readOnlySub: 'Visibilidad completa de las operaciones de su embarcación. Contacte a su gestor de flota para cualquier cambio.',
    wordmark: 'Nautium · Cada embarcación bajo control',
    noPending: 'Sin tareas pendientes',
    overdueDays: (d: number) => `${d}d de retraso`,
    daysLeft: (d: number) => `${d}d restantes`,
    vsLastMonth: (d: number) => `${d > 0 ? '+' : ''}€${Math.abs(d).toLocaleString()} vs mes anterior`,
    operationalCosts: 'Costes operativos',
  },
};

// ── Design tokens ─────────────────────────────────────────
const C = {
  bg:       '#050e1a',
  bg2:      '#0a1828',
  bg3:      '#071520',
  teal:     '#5cc4b0',
  tealMid:  '#8ab4b4',
  tealDim:  'rgba(74,180,160,0.14)',
  blue:     '#7ab8ec',
  blueDim:  'rgba(56,130,200,0.14)',
  amber:    '#d4a852',
  amberDim: 'rgba(180,130,50,0.14)',
  red:      '#e87070',
  redDim:   'rgba(200,70,70,0.14)',
  border:   'rgba(138,180,180,0.12)',
  border2:  'rgba(138,180,180,0.07)',
  textHigh: '#e8f2f2',
  textMid:  '#b0cccc',
  textLow:  '#7a9898',
};

const cardBase: React.CSSProperties = {
  background: C.bg2,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  overflow: 'hidden',
};

const secLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.2em',
  color: C.textLow,
  textTransform: 'uppercase',
  paddingTop: 8,
  paddingBottom: 2,
  marginTop: 2,
};

// ── TaskRow ───────────────────────────────────────────────
const TaskRow: React.FC<{
  title: string; category: string; days: number;
  status: 'overdue' | 'soon' | 'ok'; first?: boolean; t: typeof T['en'];
}> = ({ title, category, days, status, first, t }) => {
  const dotColor = status === 'overdue' ? C.red : status === 'soon' ? C.amber : C.tealMid;
  const badgeColor = status === 'overdue' ? C.red : status === 'soon' ? C.amber : C.teal;
  const badgeBg = status === 'overdue' ? C.redDim : status === 'soon' ? C.amberDim : C.tealDim;
  const label = status === 'overdue' ? t.overdueDays(Math.abs(days)) : t.daysLeft(days);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderTop: first ? 'none' : `1px solid ${C.border2}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.textHigh, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>{category}</div>
        </div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 6, color: badgeColor, background: badgeBg, flexShrink: 0, marginLeft: 10 }}>{label}</div>
    </div>
  );
};

// ── SubLabel ─────────────────────────────────────────────
const SubLabel: React.FC<{ text: string; first?: boolean }> = ({ text, first }) => (
  <div style={{ padding: `${first ? 10 : 12}px 14px 4px`, fontSize: 10, fontWeight: 700, letterSpacing: '.15em', color: C.textLow, textTransform: 'uppercase', borderTop: first ? 'none' : `1px solid ${C.border2}` }}>
    {text}
  </div>
);

// ── ExpandCard ────────────────────────────────────────────
const ExpandCard: React.FC<{
  icon: React.ReactNode; iconColor: string; iconBg: string;
  value: string; label: string;
  badge?: string; badgeColor?: string; badgeBg?: string;
  accentColor?: string; loading?: boolean; children?: React.ReactNode; hasContent?: boolean;
}> = ({ icon, iconColor, iconBg, value, label, badge, badgeColor, badgeBg, accentColor, loading, children, hasContent = true }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ ...cardBase, cursor: hasContent && !loading ? 'pointer' : 'default' }} onClick={() => hasContent && !loading && setOpen(o => !o)}>
      {accentColor && <div style={{ height: 2, background: accentColor }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px' }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: iconColor }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.textHigh, letterSpacing: '-.3px', lineHeight: 1 }}>{loading ? '—' : value}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          {badge && <div style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 6, color: badgeColor, background: badgeBg }}>{badge}</div>}
          {hasContent && !loading && <div style={{ color: C.textLow }}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</div>}
        </div>
      </div>
      {open && !loading && children && <div style={{ borderTop: `1px solid ${C.border2}` }}>{children}</div>}
    </div>
  );
};

const EDGE_URL = `${SUPABASE_URL}/functions/v1/get-company-data`;
const EDGE_HEADERS = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };

async function fetchByVessel(table: string, vesselId: string, opts: {
  date_field?: string; date_from?: string; date_to?: string;
  extra_filters?: Record<string, string>; order_by?: string; ascending?: boolean;
  limit?: number; select_cols?: string;
} = {}): Promise<any[]> {
  const res = await fetch(EDGE_URL, {
    method: 'POST', headers: EDGE_HEADERS,
    body: JSON.stringify({ action: 'select_by_vessel', table, vessel_id: vesselId, ...opts }),
  });
  const json = await res.json();
  return json.data || [];
}

// ── Main component ────────────────────────────────────────
export const OwnerDashboard: React.FC<OwnerDashboardProps> = () => {
  const { currentUser, logout } = useAuth();
  const [lang, setLang] = useState<Lang>('en');
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [history, setHistory] = useState<MaintenanceHistory[]>([]);
  const [vessel, setVessel] = useState<Vessel | null>(null);
  const [fuelResources, setFuelResources] = useState<any[]>([]);
  const [monthlyCosts, setMonthlyCosts] = useState<{ month: string; monthEs: string; total: number; items: { label: string; amount: number }[] }[]>([]);
  const [loading, setLoading] = useState(true);

  const t = T[lang];

  useEffect(() => { loadData(); }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    const vesselId = currentUser.vessel_ids[0];

    if (isDemoUser(currentUser.email)) {
      const v = demoVessels.find(v => v.id === vesselId);
      setVessel(v as Vessel || null);
      setTasks(demoMaintenanceTasks.filter(t => t.vessel_id === vesselId) as MaintenanceTask[]);
      setInventory(demoInventoryItems.filter(i => i.vessel_id === vesselId) as InventoryItem[]);
      setHistory(demoMaintenanceHistory.filter(h => h.vessel_id === vesselId).slice(0, 5) as MaintenanceHistory[]);
      setFuelResources([{ name: 'Diesel Main', resource_type: 'diesel_main', current_level: 4320, capacity: 6000, unit: 'L' }]);
      setMonthlyCosts([
        { month: 'March', monthEs: 'Marzo', total: 12400, items: [{ label: 'Fuel', amount: 8200 }, { label: 'Parts', amount: 2100 }, { label: 'Mooring', amount: 2100 }] },
        { month: 'April', monthEs: 'Abril', total: 15800, items: [{ label: 'Fuel', amount: 9500 }, { label: 'Service', amount: 3800 }, { label: 'Insurance', amount: 2500 }] },
        { month: 'May', monthEs: 'Mayo', total: 18450, items: [{ label: 'Fuel', amount: 11200 }, { label: 'Parts & Service', amount: 4250 }, { label: 'Operational', amount: 3000 }] },
      ]);
      setLoading(false);
      return;
    }

    const [tasksData, invData, histData, fuelResData] = await Promise.all([
      fetchByVessel('maintenance_tasks', vesselId),
      fetchByVessel('inventory_items', vesselId),
      fetchByVessel('maintenance_history', vesselId, { order_by: 'completion_date', ascending: false, limit: 5 }),
      fetchByVessel('fuel_resources', vesselId),
    ]);

    // Fetch vessel by id using a direct select via edge (vessels table has no vessel_id col, use company_id filter)
    const companyId = currentUser.company_id;
    const allVesselsRes = await fetch(EDGE_URL, {
      method: 'POST', headers: EDGE_HEADERS,
      body: JSON.stringify({ action: 'select', table: 'vessels', company_id: companyId }),
    }).then(r => r.json());
    const vesselData = (allVesselsRes.data || []).find((v: any) => v.id === vesselId) || null;

    setTasks(tasksData);
    setInventory(invData);
    setHistory(histData);
    setVessel(vesselData);
    setFuelResources(fuelResData);

    const months: typeof monthlyCosts = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const [expData, fuelLogData] = await Promise.all([
        fetchByVessel('operational_expenses', vesselId, { date_field: 'expense_date', date_from: start, date_to: end, select_cols: 'amount,category' }),
        fetchByVessel('fuel_log', vesselId, { date_field: 'log_date', date_from: start, date_to: end, extra_filters: { entry_type: 'refill' }, select_cols: 'total_cost' }),
      ]);
      const fuelTotal = fuelLogData.reduce((s: number, f: any) => s + Number(f.total_cost || 0), 0);
      const catMap: Record<string, number> = {};
      expData.forEach((e: any) => { catMap[e.category || 'Other'] = (catMap[e.category || 'Other'] || 0) + Number(e.amount || 0); });
      if (fuelTotal > 0) catMap['Fuel'] = (catMap['Fuel'] || 0) + fuelTotal;
      const items = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label, amount]) => ({ label, amount }));
      const total = Object.values(catMap).reduce((s, v) => s + v, 0);
      months.push({
        month: d.toLocaleString('en', { month: 'long' }),
        monthEs: d.toLocaleString('es', { month: 'long' }),
        total, items,
      });
    }
    setMonthlyCosts(months);
    setLoading(false);
  };

  const overdueTasks  = tasks.filter(t => t.status === 'overdue');
  const dueSoonTasks  = tasks.filter(t => t.status === 'due_soon');
  const upcomingTasks = tasks.filter(t => t.status === 'upcoming');
  const lowStockItems = inventory.filter(isLowStock);
  const criticalItems = lowStockItems.filter(i => i.current_stock === 0);
  const maintenanceHealth = tasks.length > 0 ? Math.round(((tasks.length - overdueTasks.length) / tasks.length) * 100) : 100;
  const inventoryHealth   = inventory.length > 0 ? Math.round(((inventory.length - lowStockItems.length) / inventory.length) * 100) : 100;
  const overallHealth     = Math.round((maintenanceHealth + inventoryHealth) / 2);
  const mainFuel  = fuelResources.find(f => f.resource_type?.includes('diesel') || f.resource_type?.includes('fuel'));
  const fuelPct   = mainFuel ? Math.round((mainFuel.current_level / mainFuel.capacity) * 100) : null;
  const thisMonth = monthlyCosts[monthlyCosts.length - 1];
  const prevMonth = monthlyCosts[monthlyCosts.length - 2];
  const thisMonthCost = thisMonth?.total || 0;
  const costDiff  = prevMonth ? thisMonthCost - prevMonth.total : 0;
  const maxCost   = Math.max(...monthlyCosts.map(m => m.total), 1);

  const now = new Date();
  const monthName = now.toLocaleString(lang === 'es' ? 'es' : 'en', { month: 'long', year: 'numeric' });
  const healthLabel = overallHealth >= 85 ? t.statusOk : overallHealth >= 70 ? t.statusWarn : t.statusCritical;
  const healthColor = overallHealth >= 85 ? C.teal : overallHealth >= 70 ? C.amber : C.red;

  const maintenanceBadge = !loading
    ? (overdueTasks.length > 0 ? t.overdueTasks(overdueTasks.length) : dueSoonTasks.length > 0 ? `${dueSoonTasks.length} ${lang === 'es' ? 'próx. a vencer' : 'due soon'}` : t.onTrack)
    : undefined;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'SF Pro Display', system-ui, sans-serif", color: C.textHigh }}>

      {/* ── HERO ── */}
      <div style={{ position: 'relative', height: 270, overflow: 'hidden', background: 'linear-gradient(160deg,#071526 0%,#0a1f3a 60%,#050e1a 100%)' }}>
        {vessel?.photo_url && (
          <img src={`${vessel.photo_url}?t=${Math.floor(Date.now() / 60000)}`} alt={vessel.name}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.38 }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,rgba(5,14,26,.25) 0%,rgba(5,14,26,.55) 55%,rgba(5,14,26,1) 100%)' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(138,180,180,.45),transparent)' }} />

        {/* Topbar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#8ab4b4,#4a8080)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(138,180,180,.3)', boxShadow: '0 4px 12px rgba(74,128,128,.25)' }}>
              <Anchor size={14} color="#050e1a" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '.3px', color: '#e8f0f0' }}>
              Nau<span style={{ color: '#8ab4b4' }}>tium</span>
            </span>
          </div>

          {/* Right: lang + user + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Language toggle */}
            <button
              onClick={() => setLang(l => l === 'en' ? 'es' : 'en')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(138,180,180,.08)', border: '1px solid rgba(138,180,180,.2)',
                borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
              }}
            >
              <Globe size={12} color={C.tealMid} />
              <span style={{ fontSize: 11, fontWeight: 700, color: C.tealMid, letterSpacing: '.08em' }}>
                {lang === 'en' ? 'ES' : 'EN'}
              </span>
            </button>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textHigh }}>{currentUser?.full_name}</div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.18em', color: C.tealMid, textTransform: 'uppercase' }}>Owner</div>
            </div>
            <button onClick={logout} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(138,180,180,.08)', border: '1px solid rgba(138,180,180,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <LogOut size={13} color={C.textMid} />
            </button>
          </div>
        </div>

        {/* Vessel info */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 22px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.2em', color: C.textLow, textTransform: 'uppercase', marginBottom: 4 }}>
            {vessel?.type?.replace('_', ' ') || t.vesselLabel} · {monthName}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-.5px', color: '#fff', lineHeight: 1, marginBottom: 4 }}>
            {loading ? '—' : vessel?.name || 'My Vessel'}
          </div>
          {vessel?.location && (
            <div style={{ fontSize: 12, color: C.textMid, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.tealMid }} />
              {vessel.location}
            </div>
          )}
          {!loading && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(138,180,180,.08)', border: `1px solid ${healthColor}45`, borderRadius: 100, padding: '6px 14px' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: healthColor }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: healthColor }}>{healthLabel}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.textHigh, background: 'rgba(255,255,255,.08)', padding: '1px 8px', borderRadius: 100 }}>{overallHealth}%</span>
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 60px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Critical alert */}
        {!loading && (overdueTasks.length > 0 || criticalItems.length > 0) && (
          <div style={{ background: '#150c0c', border: '1px solid rgba(180,60,60,.35)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: C.redDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={15} color={C.red} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f0b8b8', marginBottom: 2 }}>{t.actionRequired}</div>
              <div style={{ fontSize: 12, color: C.textMid }}>
                {overdueTasks.length > 0 && t.overdueTasks(overdueTasks.length)}
                {overdueTasks.length > 0 && criticalItems.length > 0 && ' · '}
                {criticalItems.length > 0 && t.outOfStock(criticalItems.length)}
              </div>
            </div>
          </div>
        )}

        <div style={secLabel}>{t.vesselStatus}</div>

        {/* MAINTENANCE */}
        <ExpandCard
          icon={<Wrench size={18} />}
          iconColor={overdueTasks.length > 0 ? C.red : C.blue}
          iconBg={overdueTasks.length > 0 ? C.redDim : C.blueDim}
          value={loading ? '—' : `${maintenanceHealth}%`}
          label={t.maintenanceHealth}
          badge={maintenanceBadge}
          badgeColor={overdueTasks.length > 0 ? C.red : dueSoonTasks.length > 0 ? C.amber : C.teal}
          badgeBg={overdueTasks.length > 0 ? C.redDim : dueSoonTasks.length > 0 ? C.amberDim : C.tealDim}
          accentColor={overdueTasks.length > 0 ? `linear-gradient(90deg,${C.red},#c04040)` : undefined}
          loading={loading}
          hasContent={overdueTasks.length > 0 || dueSoonTasks.length > 0 || upcomingTasks.length > 0}
        >
          {overdueTasks.length > 0 && <>
            <SubLabel text={t.overdue} first />
            {overdueTasks.slice(0, 3).map((tk, i) => <TaskRow key={tk.id} title={tk.title} category={tk.category} days={calculateDaysUntilDue(tk.next_due_date)} status="overdue" first={i === 0} t={t} />)}
          </>}
          {dueSoonTasks.length > 0 && <>
            <SubLabel text={t.dueSoon} first={overdueTasks.length === 0} />
            {dueSoonTasks.slice(0, 3).map((tk, i) => <TaskRow key={tk.id} title={tk.title} category={tk.category} days={calculateDaysUntilDue(tk.next_due_date)} status="soon" first={i === 0} t={t} />)}
          </>}
          {upcomingTasks.length > 0 && <>
            <SubLabel text={t.upcoming} first={overdueTasks.length === 0 && dueSoonTasks.length === 0} />
            {upcomingTasks.slice(0, 2).map((tk, i) => <TaskRow key={tk.id} title={tk.title} category={tk.category} days={calculateDaysUntilDue(tk.next_due_date)} status="ok" first={i === 0} t={t} />)}
          </>}
          {overdueTasks.length === 0 && dueSoonTasks.length === 0 && upcomingTasks.length === 0 && (
            <div style={{ padding: '16px 14px', fontSize: 12, color: C.textLow, textAlign: 'center' }}>{t.noPending}</div>
          )}
        </ExpandCard>

        {/* INVENTORY */}
        <ExpandCard
          icon={<Package size={18} />}
          iconColor={lowStockItems.length > 0 ? C.amber : C.teal}
          iconBg={lowStockItems.length > 0 ? C.amberDim : C.tealDim}
          value={loading ? '—' : `${inventoryHealth}%`}
          label={t.inventoryHealth}
          badge={!loading ? (lowStockItems.length > 0 ? t.itemsLow(lowStockItems.length) : t.fullyStocked) : undefined}
          badgeColor={lowStockItems.length > 0 ? C.amber : C.teal}
          badgeBg={lowStockItems.length > 0 ? C.amberDim : C.tealDim}
          accentColor={lowStockItems.length > 0 ? `linear-gradient(90deg,${C.amber},#b07820)` : undefined}
          loading={loading}
          hasContent={lowStockItems.length > 0}
        >
          <SubLabel text={t.itemsNeedReorder} first />
          {lowStockItems.slice(0, 4).map((item, i) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderTop: i === 0 ? 'none' : `1px solid ${C.border2}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.textHigh, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>{item.category}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: item.current_stock === 0 ? C.red : C.amber, background: item.current_stock === 0 ? C.redDim : C.amberDim, padding: '3px 9px', borderRadius: 6, flexShrink: 0, marginLeft: 10 }}>
                {item.current_stock} {item.unit_of_measure} left
              </div>
            </div>
          ))}
        </ExpandCard>

        {/* FUEL */}
        <ExpandCard
          icon={<Droplets size={18} />}
          iconColor={fuelPct !== null && fuelPct < 25 ? '#f97316' : C.blue}
          iconBg={fuelPct !== null && fuelPct < 25 ? 'rgba(249,115,22,.14)' : C.blueDim}
          value={loading ? '—' : fuelPct !== null ? `${fuelPct}%` : 'N/A'}
          label={t.fuelLabel}
          badge={!loading && fuelPct !== null ? (fuelPct < 25 ? t.fuelLow : fuelPct < 50 ? t.fuelHalf : t.fuelGood) : undefined}
          badgeColor={fuelPct !== null && fuelPct < 25 ? '#f97316' : fuelPct !== null && fuelPct < 50 ? C.amber : C.teal}
          badgeBg={fuelPct !== null && fuelPct < 25 ? 'rgba(249,115,22,.14)' : fuelPct !== null && fuelPct < 50 ? C.amberDim : C.tealDim}
          loading={loading}
          hasContent={fuelResources.length > 0}
        >
          <SubLabel text={t.tankDetails} first />
          {fuelResources.map((f, i) => (
            <div key={i} style={{ padding: '11px 14px', borderTop: i === 0 ? 'none' : `1px solid ${C.border2}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.textHigh }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>{f.current_level.toLocaleString()} / {f.capacity.toLocaleString()} {f.unit}</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.textHigh }}>{Math.round((f.current_level / f.capacity) * 100)}%</div>
              </div>
              <div style={{ height: 4, background: 'rgba(138,180,180,.1)', borderRadius: 100, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 100, width: `${Math.round((f.current_level / f.capacity) * 100)}%`, background: f.current_level / f.capacity < .25 ? 'linear-gradient(90deg,#f97316,#fb923c)' : f.current_level / f.capacity < .5 ? `linear-gradient(90deg,${C.amber},#fbbf24)` : `linear-gradient(90deg,#3882c8,${C.teal})`, transition: 'width .6s ease' }} />
              </div>
            </div>
          ))}
        </ExpandCard>

        {/* COSTS */}
        <div style={secLabel}>{t.costsLabel}</div>
        <ExpandCard
          icon={<DollarSign size={18} />}
          iconColor={C.teal}
          iconBg={C.tealDim}
          value={loading ? '—' : thisMonthCost > 0 ? `€${thisMonthCost.toLocaleString()}` : '€0'}
          label={t.costs}
          badge={!loading && costDiff !== 0 ? t.vsLastMonth(costDiff) : undefined}
          badgeColor={costDiff > 0 ? C.red : C.teal}
          badgeBg={costDiff > 0 ? C.redDim : C.tealDim}
          loading={loading}
          hasContent={monthlyCosts.length > 0}
        >
          {thisMonth?.items && thisMonth.items.length > 0 && <>
            <SubLabel text={t.topExpenses(lang === 'es' ? thisMonth.monthEs : thisMonth.month)} first />
            {thisMonth.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderTop: i === 0 ? 'none' : `1px solid ${C.border2}` }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.textHigh }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.tealMid }}>€{item.amount.toLocaleString()}</div>
              </div>
            ))}
          </>}
          <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.border2}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.15em', color: C.textLow, textTransform: 'uppercase', marginBottom: 10 }}>{t.last3Months}</div>
            {monthlyCosts.map((m, i) => {
              const pct = Math.round((m.total / maxCost) * 100);
              const isCurrent = i === monthlyCosts.length - 1;
              const label = lang === 'es' ? m.monthEs : m.month;
              return (
                <div key={m.month} style={{ marginBottom: i < monthlyCosts.length - 1 ? 10 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: isCurrent ? C.tealMid : C.textMid, fontWeight: isCurrent ? 600 : 400 }}>
                      {label}{isCurrent ? ` · ${t.current}` : ''}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isCurrent ? C.tealMid : C.textHigh }}>€{m.total.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 3, background: 'rgba(138,180,180,.08)', borderRadius: 100, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 100, width: `${pct}%`, background: isCurrent ? `linear-gradient(90deg,${C.tealMid},${C.teal})` : 'rgba(138,180,180,.28)', transition: 'width .6s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ExpandCard>

        {/* RECENT ACTIVITY */}
        {!loading && history.length > 0 && <>
          <div style={secLabel}>{t.recentWork}</div>
          <div style={cardBase}>
            {history.map((record, i) => (
              <div key={record.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: i === 0 ? 'none' : `1px solid ${C.border2}` }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: C.tealDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckCircle size={14} color={C.teal} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.textHigh, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.task_title}</div>
                  <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>By {record.completed_by_name} · {formatDate(record.completion_date)}</div>
                </div>
              </div>
            ))}
          </div>
        </>}

        {/* Footer */}
        <div style={{ background: C.bg3, border: `1px solid rgba(138,180,180,.08)`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(138,180,180,.06)', border: `1px solid rgba(138,180,180,.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Shield size={15} color={C.tealMid} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 2 }}>{t.readOnly}</div>
            <div style={{ fontSize: 11, color: C.textLow, lineHeight: 1.6 }}>{t.readOnlySub}</div>
          </div>
        </div>

        <div style={{ fontSize: 9, letterSpacing: '.25em', color: 'rgba(138,180,180,.2)', textAlign: 'center', paddingTop: 12, textTransform: 'uppercase' }}>
          {t.wordmark}
        </div>

      </div>
    </div>
  );
};
