import React, { useState, useEffect, useCallback } from 'react';
import { Rocket, Target, TrendingUp, Zap, Crown, Check, ChevronDown, Save, StickyNote, Plus, X, Anchor, User, DollarSign, Ruler, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RoadmapProps {
  onNavigate: (page: string, params?: any) => void;
}

interface ClosedDeal {
  id: string;
  boat_name: string;
  length_meters: number;
  monthly_fee: number;
  setup_fee: number;
  currency: string;
  closed_by: string;
  closed_date: string;
  notes: string | null;
}

const PHASES = [
  {
    id: 'phase0',
    name: 'Fase 0',
    title: 'Validación + Primeros Clientes',
    dates: 'Sep – Dic 2026',
    icon: Rocket,
    color: '#3b82f6',
    gradient: 'from-blue-500 to-blue-600',
    boatsMin: 5, boatsMax: 7,
    arrMin: 10000, arrMax: 15000,
    tasks: [
      'Cerrar Soulmate — enviar contrato $2,388/yr + $1,500 setup',
      'Kickoff call con captain de Soulmate',
      'Setup completo Soulmate: equipos, inventario, departamentos',
      'Follow-up fleet manager después de prueba de fin de semana',
      'Follow-up usuario A (2 cats): ¿qué necesita para decidir?',
      'Follow-up usuario B (1 cat): misma conversación',
      'Graycliff: mantener contacto, preparar para cuando salga del yard',
      'Crear video demo 3-4 minutos (Loom)',
      'Crear PDF de ventas 1-página',
      'Crear templates WhatsApp/email (primer contacto, follow-up, referido)',
      'Subir precio nuevos clientes yates: $249/mes',
      'Check-in #1 con Soulmate (semana 3-4)',
      'Pedir primer referido a captain de Soulmate',
      'Identificar 5 fleet managers en Fort Lauderdale',
      'Contactar 2-3 fleet managers con video demo',
      'FLIBS o evento alternativo: hablar con 15-20 captains',
      'Follow-up post-evento dentro de 48h',
      'Check-in con TODOS los clientes (diciembre)',
      'Documentar features pedidos y problemas',
      'Pedir testimonial a Soulmate (3+ meses)',
    ],
  },
  {
    id: 'phase1',
    name: 'Fase 1',
    title: 'Tracción + Producto',
    dates: 'Ene – Dic 2027',
    icon: TrendingUp,
    color: '#8b5cf6',
    gradient: 'from-violet-500 to-purple-600',
    boatsMin: 12, boatsMax: 20,
    arrMin: 25000, arrMax: 45000,
    tasks: [
      'Cerrar 2-3 clientes por referidos de Fase 0',
      'Lanzar programa de referidos: 1 mes gratis por referido que cierre',
      'Subir precio yates nuevos a $249/mo si no lo hiciste',
      'Mejorar PWA: offline capability para uso en alta mar',
      'Agregar push notifications para tareas vencidas',
      'Evaluar si fleet managers necesitan dashboard diferente',
      'Presencia en 1 boat show (FLIBS o Miami)',
      'Crear caso de estudio con Soulmate (si permiten)',
      'Construir pipeline de 20+ leads calificados',
      'Definir proceso de onboarding estandarizado (<2 horas)',
      'Evaluar primer hire: ¿closer de ventas o soporte?',
      'Llegar a 12 boats pagando (conservador)',
      'Llegar a 20 boats pagando (optimista)',
    ],
  },
  {
    id: 'phase2',
    name: 'Fase 2',
    title: 'Escalar + Primer Hire',
    dates: 'Ene – Dic 2028',
    icon: Zap,
    color: '#f59e0b',
    gradient: 'from-amber-500 to-orange-500',
    boatsMin: 40, boatsMax: 70,
    arrMin: 80000, arrMax: 150000,
    tasks: [
      'Contratar primer closer/account manager',
      'Precio yates: $299/mo para nuevos clientes',
      'Expandir a fleet managers grandes (5+ boats)',
      'Integración con calendarios y proveedores',
      'Lanzar módulo avanzado de reportes',
      'Presencia en 2 boat shows',
      'Expandir a 2-3 marinas nuevas como canal',
      'Evaluar expansión geográfica (Bahamas, Virgin Islands)',
      'Sistema de soporte escalable (helpdesk/knowledge base)',
      'Llegar a $80K ARR (conservador)',
      'Llegar a $150K ARR (optimista)',
    ],
  },
  {
    id: 'phase3',
    name: 'Fase 3',
    title: 'Producto Premium + Telemetría',
    dates: 'Ene – Dic 2029',
    icon: Target,
    color: '#10b981',
    gradient: 'from-emerald-500 to-teal-500',
    boatsMin: 100, boatsMax: 180,
    arrMin: 200000, arrMax: 400000,
    tasks: [
      'Equipo de 3-4 personas',
      'Lanzar integración NMEA / telemetría en vivo',
      'Tier Enterprise para fleets grandes',
      'Precio yates: $349/mo para nuevos clientes',
      'API pública para integraciones de terceros',
      'Programa de partnerships con marinas',
      'Presencia constante en boat shows principales',
      'Evaluar mercados internacionales (Med, Caribe completo)',
      'Llegar a $200K ARR (conservador)',
      'Llegar a $400K ARR (optimista)',
    ],
  },
  {
    id: 'phase4',
    name: 'Fase 4',
    title: 'Escala o Exit',
    dates: 'Ene – Dic 2030',
    icon: Crown,
    color: '#ec4899',
    gradient: 'from-pink-500 to-rose-500',
    boatsMin: 200, boatsMax: 350,
    arrMin: 400000, arrMax: 700000,
    tasks: [
      'Decisión estratégica: seguir creciendo vs buscar adquisición',
      '200+ boats en plataforma (conservador)',
      '350+ boats en plataforma (optimista)',
      '$400K ARR (conservador)',
      '$700K ARR (optimista)',
      'Equipo de 5-6 personas si crecimiento orgánico',
      'Mercado internacional activo',
      'Producto maduro con telemetría + marketplace',
      'Marca reconocida en el mercado superyacht',
      'Evaluar Series A o exit si hay interés',
    ],
  },
];

const QUOTES = [
  "The best time to plant a tree was 20 years ago. The second best time is now.",
  "Ships don't sink because of the water around them. They sink because of the water that gets in them.",
  "You're not building software. You're building the future of yacht management.",
  "Every empire started with a single decision to begin.",
  "Discipline is choosing between what you want now and what you want most.",
  "The ocean rewards those who respect it — and outwork everyone else.",
  "Small steps, massive results. Trust the compound effect.",
  "The difference between a dream and a goal is a deadline.",
  "You didn't come this far to only come this far.",
  "From 3 boats to 350. One client at a time.",
  "Winners build. Losers wait for the perfect moment.",
  "Every 'no' gets you closer to the next 'yes'.",
];

const fmtCurrency = (v: number) =>
  v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M`
  : v >= 1000 ? `$${(v / 1000).toFixed(0)}K`
  : `$${v}`;

const fmtNum = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function getPhaseStatus(phaseId: string): 'current' | 'done' | 'upcoming' {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  if (phaseId === 'phase0') return (y === 2026 && m >= 8) ? 'current' : y > 2026 ? 'done' : 'upcoming';
  if (phaseId === 'phase1') return y === 2027 ? 'current' : y > 2027 ? 'done' : 'upcoming';
  if (phaseId === 'phase2') return y === 2028 ? 'current' : y > 2028 ? 'done' : 'upcoming';
  if (phaseId === 'phase3') return y === 2029 ? 'current' : y > 2029 ? 'done' : 'upcoming';
  if (phaseId === 'phase4') return y >= 2030 ? 'current' : 'upcoming';
  return 'upcoming';
}

const EMPTY_DEAL = { boat_name: '', length_meters: '', monthly_fee: '', setup_fee: '', currency: 'USD', closed_by: 'Marcel', closed_date: new Date().toISOString().slice(0, 10), notes: '' };

export const Roadmap: React.FC<RoadmapProps> = ({ onNavigate }) => {
  const [currentBoats, setCurrentBoats] = useState(3);
  const [currentARR, setCurrentARR] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>('phase0');
  const [editBoats, setEditBoats] = useState('3');
  const [editARR, setEditARR] = useState('0');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const [deals, setDeals] = useState<ClosedDeal[]>([]);
  const [showDealForm, setShowDealForm] = useState(false);
  const [dealForm, setDealForm] = useState(EMPTY_DEAL);
  const [dealSaving, setDealSaving] = useState(false);

  const quote = QUOTES[Math.floor(new Date().getDate() % QUOTES.length)];

  useEffect(() => { loadState(); loadDeals(); }, []);

  const loadState = async () => {
    const { data } = await supabase.from('roadmap_state').select('*').eq('id', 'master').single();
    if (data) {
      setCurrentBoats(data.current_boats || 0);
      setCurrentARR(data.current_arr || 0);
      setChecked(data.checked || {});
      setNotes(data.notes || {});
      setEditBoats(String(data.current_boats || 0));
      setEditARR(String(data.current_arr || 0));
    }
  };

  const loadDeals = async () => {
    const { data } = await supabase.from('closed_deals').select('*').order('closed_date', { ascending: false });
    if (data) setDeals(data);
  };

  const saveState = useCallback(async (updates: Record<string, any>) => {
    setSaving(true);
    await supabase.from('roadmap_state').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', 'master');
    setSaving(false);
    setToast('Guardado');
    setTimeout(() => setToast(''), 1500);
  }, []);

  const toggleCheck = (key: string) => {
    const next = { ...checked, [key]: !checked[key] };
    setChecked(next);
    saveState({ checked: next });
  };

  const updateNotes = (phaseId: string, text: string) => {
    setNotes(prev => ({ ...prev, [phaseId]: text }));
  };

  const saveNotes = () => {
    saveState({ notes });
  };

  const saveMetrics = () => {
    const b = parseInt(editBoats) || 0;
    const a = parseInt(editARR) || 0;
    setCurrentBoats(b);
    setCurrentARR(a);
    saveState({ current_boats: b, current_arr: a });
  };

  const saveDeal = async () => {
    if (!dealForm.boat_name || !dealForm.monthly_fee) return;
    setDealSaving(true);
    const payload = {
      boat_name: dealForm.boat_name,
      length_meters: parseFloat(dealForm.length_meters) || 0,
      monthly_fee: parseFloat(dealForm.monthly_fee) || 0,
      setup_fee: parseFloat(dealForm.setup_fee) || 0,
      currency: dealForm.currency,
      closed_by: dealForm.closed_by || 'Marcel',
      closed_date: dealForm.closed_date,
      notes: dealForm.notes || null,
    };
    await supabase.from('closed_deals').insert(payload);
    setDealForm({ ...EMPTY_DEAL, closed_date: new Date().toISOString().slice(0, 10) });
    setShowDealForm(false);
    setDealSaving(false);
    loadDeals();
    setToast('Deal registrado');
    setTimeout(() => setToast(''), 1500);
  };

  const deleteDeal = async (id: string) => {
    await supabase.from('closed_deals').delete().eq('id', id);
    loadDeals();
    setToast('Deal eliminado');
    setTimeout(() => setToast(''), 1500);
  };

  const getCheckedCount = (phaseId: string) => {
    const phase = PHASES.find(p => p.id === phaseId);
    if (!phase) return 0;
    return phase.tasks.filter((_, i) => checked[`${phaseId}_${i}`]).length;
  };

  const totalChecked = PHASES.reduce((s, p) => s + getCheckedCount(p.id), 0);
  const totalTasks = PHASES.reduce((s, p) => s + p.tasks.length, 0);
  const totalPct = Math.round((totalChecked / totalTasks) * 100);

  const totalMRR = deals.reduce((s, d) => s + d.monthly_fee, 0);
  const totalSetupFees = deals.reduce((s, d) => s + d.setup_fee, 0);
  const computedARR = totalMRR * 12;

  return (
    <div className="min-h-screen -m-4 sm:-m-6 lg:-m-8">
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-lg animate-pulse">
          {toast}
        </div>
      )}

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950 px-6 py-10 sm:px-10 sm:py-14">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #3b82f6 0%, transparent 50%), radial-gradient(circle at 80% 20%, #8b5cf6 0%, transparent 50%), radial-gradient(circle at 60% 80%, #ec4899 0%, transparent 50%)' }} />
        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Nautium Growth Tracker</h1>
              <p className="text-sm text-slate-400 mt-0.5">5-Phase Roadmap — Sep 2026 → Dec 2030</p>
            </div>
          </div>

          {/* Motivational */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-5 mb-6">
            <p className="text-xl sm:text-2xl font-black text-white italic">"{quote}"</p>
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <div>
                <span className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                  {fmtCurrency(400000)} – {fmtCurrency(700000)}
                </span>
                <span className="text-sm text-slate-400 ml-3">ARR Target 2030</span>
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-2">De 3 barcos a 350. Cada deal que cierras te acerca a la meta.</p>
          </div>

          {/* Live stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Boats Cerrados</p>
              <p className="text-2xl font-black text-sky-400 mt-1 tabular-nums">{deals.length}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">MRR</p>
              <p className="text-2xl font-black text-emerald-400 mt-1 tabular-nums">${fmtNum(totalMRR)}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ARR (calc)</p>
              <p className="text-2xl font-black text-emerald-400 mt-1 tabular-nums">{fmtCurrency(computedARR)}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Setup Fees</p>
              <p className="text-2xl font-black text-amber-400 mt-1 tabular-nums">${fmtNum(totalSetupFees)}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Progreso</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-black text-white tabular-nums">{totalPct}%</p>
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500 transition-all duration-500" style={{ width: `${totalPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-8 space-y-6">

        {/* ===== DEALS TRACKER ===== */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Anchor className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900">Deals Cerrados</h2>
                <p className="text-xs text-gray-500">{deals.length} barco{deals.length !== 1 ? 's' : ''} cerrado{deals.length !== 1 ? 's' : ''} — ${fmtNum(totalMRR)}/mo MRR</p>
              </div>
            </div>
            <button onClick={() => setShowDealForm(!showDealForm)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${showDealForm ? 'bg-gray-100 text-gray-600' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}>
              {showDealForm ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Nuevo Deal</>}
            </button>
          </div>

          {/* Deal form */}
          {showDealForm && (
            <div className="p-5 sm:p-6 bg-gray-50 border-b border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nombre del Barco *</label>
                  <input type="text" value={dealForm.boat_name} onChange={e => setDealForm(p => ({ ...p, boat_name: e.target.value }))} placeholder="e.g. Soulmate"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Eslora (metros)</label>
                  <input type="number" value={dealForm.length_meters} onChange={e => setDealForm(p => ({ ...p, length_meters: e.target.value }))} placeholder="e.g. 24" step="0.1"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Membresía Mensual * ($)</label>
                  <input type="number" value={dealForm.monthly_fee} onChange={e => setDealForm(p => ({ ...p, monthly_fee: e.target.value }))} placeholder="e.g. 199" step="1"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Setup Fee ($)</label>
                  <input type="number" value={dealForm.setup_fee} onChange={e => setDealForm(p => ({ ...p, setup_fee: e.target.value }))} placeholder="e.g. 1500" step="1"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cerrado por</label>
                  <input type="text" value={dealForm.closed_by} onChange={e => setDealForm(p => ({ ...p, closed_by: e.target.value }))} placeholder="Marcel"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Fecha de Cierre</label>
                  <input type="date" value={dealForm.closed_date} onChange={e => setDealForm(p => ({ ...p, closed_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Notas</label>
                <input type="text" value={dealForm.notes} onChange={e => setDealForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notas opcionales..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={saveDeal} disabled={dealSaving || !dealForm.boat_name || !dealForm.monthly_fee}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors disabled:opacity-50">
                  <Save className="w-4 h-4" /> Guardar Deal
                </button>
              </div>
            </div>
          )}

          {/* Deals table */}
          {deals.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Barco</th>
                    <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Metros</th>
                    <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mensual</th>
                    <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Setup</th>
                    <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cerrado por</th>
                    <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fecha</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {deals.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Anchor className="w-4 h-4 text-sky-500 shrink-0" />
                          <span className="font-semibold text-gray-900">{d.boat_name}</span>
                        </div>
                        {d.notes && <p className="text-xs text-gray-400 mt-0.5 ml-6">{d.notes}</p>}
                      </td>
                      <td className="px-3 py-3 text-gray-600 tabular-nums">{d.length_meters}m</td>
                      <td className="px-3 py-3 font-semibold text-emerald-600 tabular-nums">${fmtNum(d.monthly_fee)}/mo</td>
                      <td className="px-3 py-3 text-amber-600 tabular-nums">${fmtNum(d.setup_fee)}</td>
                      <td className="px-3 py-3 text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          {d.closed_by}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-500 tabular-nums">{d.closed_date}</td>
                      <td className="px-3 py-3">
                        <button onClick={() => deleteDeal(d.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td className="px-5 py-3 font-bold text-gray-700">{deals.length} barcos</td>
                    <td className="px-3 py-3"></td>
                    <td className="px-3 py-3 font-bold text-emerald-700 tabular-nums">${fmtNum(totalMRR)}/mo</td>
                    <td className="px-3 py-3 font-bold text-amber-700 tabular-nums">${fmtNum(totalSetupFees)}</td>
                    <td colSpan={3} className="px-3 py-3 text-right font-bold text-gray-700">ARR: {fmtCurrency(computedARR)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {deals.length === 0 && !showDealForm && (
            <div className="p-10 text-center">
              <Anchor className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No hay deals cerrados todavia.</p>
              <p className="text-xs text-gray-300 mt-1">Haz click en "Nuevo Deal" para registrar tu primer cierre.</p>
            </div>
          )}
        </div>

        {/* Manual override metrics */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Override Manual (si los deals no reflejan todo)</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Boats Activos</label>
              <input type="number" value={editBoats} onChange={e => setEditBoats(e.target.value)} min="0"
                className="w-28 px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold tabular-nums focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">ARR Manual ($)</label>
              <input type="number" value={editARR} onChange={e => setEditARR(e.target.value)} min="0" step="100"
                className="w-32 px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold tabular-nums focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
            </div>
            <button onClick={saveMetrics} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold transition-colors disabled:opacity-50">
              <Save className="w-4 h-4" /> Actualizar
            </button>
          </div>
        </div>

        {/* ===== PHASES ===== */}
        {PHASES.map(phase => {
          const Icon = phase.icon;
          const status = getPhaseStatus(phase.id);
          const checkedCount = getCheckedCount(phase.id);
          const phasePct = phase.tasks.length > 0 ? Math.round((checkedCount / phase.tasks.length) * 100) : 0;
          const isExpanded = expanded === phase.id;

          return (
            <div key={phase.id} className={`bg-white rounded-2xl border overflow-hidden transition-all ${status === 'current' ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}>
              <button
                onClick={() => setExpanded(isExpanded ? null : phase.id)}
                className="w-full flex items-center gap-4 p-5 sm:p-6 text-left hover:bg-gray-50 transition-colors"
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${phase.gradient} flex items-center justify-center shrink-0 shadow-lg`} style={{ boxShadow: `0 8px 24px ${phase.color}20` }}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black text-gray-900">{phase.name}: {phase.title}</h3>
                    {status === 'current' && <span className="text-[10px] font-black uppercase tracking-widest bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Activa</span>}
                    {status === 'done' && <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Check className="w-3 h-3" />Done</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{phase.dates}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-gray-400">Boats: {phase.boatsMin}–{phase.boatsMax}</p>
                    <p className="text-xs font-semibold" style={{ color: phase.color }}>ARR: {fmtCurrency(phase.arrMin)}–{fmtCurrency(phase.arrMax)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold tabular-nums ${phasePct === 100 ? 'text-emerald-500' : 'text-gray-500'}`}>{checkedCount}/{phase.tasks.length}</span>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 px-5 sm:px-6 pb-6">
                  <div className="grid grid-cols-2 gap-3 py-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Boats Target</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Conservador</span><span className="font-bold">{phase.boatsMin}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Optimista</span><span className="font-bold">{phase.boatsMax}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Actual</span><span className="font-bold text-sky-600">{deals.length || currentBoats}</span></div>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">ARR Target</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Conservador</span><span className="font-bold">{fmtCurrency(phase.arrMin)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Optimista</span><span className="font-bold">{fmtCurrency(phase.arrMax)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Actual</span><span className="font-bold text-emerald-600">{fmtCurrency(computedARR || currentARR)}</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between text-xs font-bold text-gray-500 mb-2">
                      <span>Checklist</span>
                      <span>{checkedCount}/{phase.tasks.length} ({phasePct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${phasePct === 100 ? 'bg-emerald-500' : ''}`}
                        style={{ width: `${phasePct}%`, background: phasePct < 100 ? phase.color : undefined }} />
                    </div>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {phase.tasks.map((task, i) => {
                      const key = `${phase.id}_${i}`;
                      const isDone = checked[key];
                      return (
                        <button key={i} onClick={() => toggleCheck(key)}
                          className={`w-full flex items-start gap-3 py-3 px-1 text-left transition-colors hover:bg-gray-50 rounded-lg ${isDone ? 'opacity-60' : ''}`}
                        >
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${isDone ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>
                            {isDone && <Check className="w-3.5 h-3.5 text-white" />}
                          </div>
                          <span className={`text-sm ${isDone ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <StickyNote className="w-4 h-4 text-gray-400" />
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notas — {phase.name}</span>
                    </div>
                    <textarea
                      value={notes[phase.id] || ''}
                      onChange={e => updateNotes(phase.id, e.target.value)}
                      onBlur={saveNotes}
                      placeholder={`Notas para ${phase.name}...`}
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Bottom */}
        <div className="bg-gradient-to-r from-gray-900 via-slate-900 to-gray-900 rounded-2xl p-6 sm:p-8 text-center">
          <p className="text-3xl sm:text-4xl font-black text-white mb-2">
            {fmtCurrency(400000)} – {fmtCurrency(700000)}
          </p>
          <p className="text-sm text-slate-400 mb-4">ARR Target 2030 — 200 a 350 boats</p>
          <p className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-violet-400 to-pink-400">
            De 3 barcos a 350. Cada deal que cierras construye el futuro.
          </p>
        </div>
      </div>
    </div>
  );
};
