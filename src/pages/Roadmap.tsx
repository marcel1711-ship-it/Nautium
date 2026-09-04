import React, { useState, useEffect, useCallback } from 'react';
import { Rocket, Target, TrendingUp, Zap, Crown, Check, ChevronDown, Save, StickyNote } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RoadmapProps {
  onNavigate: (page: string, params?: any) => void;
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
  "Get it fucking done.",
  "Ships don't sink because of the water around them. They sink because of the water that gets in them.",
  "You're not building a product. You're building an empire.",
  "Every whale was once a small fish.",
  "Comfort is the enemy of growth.",
  "The ocean doesn't care about your excuses.",
  "Built different. Ship different.",
  "Stop dreaming. Start shipping.",
  "Your competition is sleeping. You shouldn't be.",
  "700K ARR is not a dream. It's a plan.",
];

const fmtCurrency = (v: number) =>
  v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M`
  : v >= 1000 ? `$${(v / 1000).toFixed(0)}K`
  : `$${v}`;

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

export const Roadmap: React.FC<RoadmapProps> = ({ onNavigate }) => {
  const [currentBoats, setCurrentBoats] = useState(3);
  const [currentARR, setCurrentARR] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [activePhase, setActivePhase] = useState('phase0');
  const [expanded, setExpanded] = useState<string | null>('phase0');
  const [editBoats, setEditBoats] = useState('3');
  const [editARR, setEditARR] = useState('0');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const quote = QUOTES[Math.floor(new Date().getDate() % QUOTES.length)];

  useEffect(() => { loadState(); }, []);

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

  const saveState = useCallback(async (updates: Record<string, any>) => {
    setSaving(true);
    await supabase.from('roadmap_state').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', 'master');
    setSaving(false);
    setToast('Guardado ✓');
    setTimeout(() => setToast(''), 1500);
  }, []);

  const toggleCheck = (key: string) => {
    const next = { ...checked, [key]: !checked[key] };
    setChecked(next);
    saveState({ checked: next });
  };

  const updateNotes = (phaseId: string, text: string) => {
    const next = { ...notes, [phaseId]: text };
    setNotes(next);
  };

  const saveNotes = (phaseId: string) => {
    saveState({ notes });
  };

  const saveMetrics = () => {
    const b = parseInt(editBoats) || 0;
    const a = parseInt(editARR) || 0;
    setCurrentBoats(b);
    setCurrentARR(a);
    saveState({ current_boats: b, current_arr: a });
  };

  const getCheckedCount = (phaseId: string) => {
    const phase = PHASES.find(p => p.id === phaseId);
    if (!phase) return 0;
    return phase.tasks.filter((_, i) => checked[`${phaseId}_${i}`]).length;
  };

  const totalChecked = PHASES.reduce((s, p) => s + getCheckedCount(p.id), 0);
  const totalTasks = PHASES.reduce((s, p) => s + p.tasks.length, 0);
  const totalPct = Math.round((totalChecked / totalTasks) * 100);

  return (
    <div className="min-h-screen -m-4 sm:-m-6 lg:-m-8">
      {/* Toast */}
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

          {/* Motivational quote */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-5 mb-6">
            <p className="text-xl sm:text-2xl font-black text-white italic">"{quote}"</p>
            <div className="flex items-center gap-4 mt-3">
              <span className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                {fmtCurrency(700000)} ARR
              </span>
              <span className="text-sm text-slate-400">← tu meta optimista 2030. Cada barco cuenta.</span>
            </div>
          </div>

          {/* Live stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Boats Hoy</p>
              <p className="text-2xl font-black text-sky-400 mt-1 tabular-nums">{currentBoats}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ARR Actual</p>
              <p className="text-2xl font-black text-emerald-400 mt-1 tabular-nums">{fmtCurrency(currentARR)}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Progreso</p>
              <p className="text-2xl font-black text-white mt-1 tabular-nums">{totalChecked}/{totalTasks}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completado</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-black text-white tabular-nums">{totalPct}%</p>
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500 transition-all duration-500" style={{ width: `${totalPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Edit metrics */}
          <div className="flex flex-wrap items-end gap-3 mt-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Boats Activos</label>
              <input type="number" value={editBoats} onChange={e => setEditBoats(e.target.value)} min="0"
                className="w-28 px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm font-semibold tabular-nums focus:outline-none focus:border-sky-400" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">ARR Actual ($)</label>
              <input type="number" value={editARR} onChange={e => setEditARR(e.target.value)} min="0" step="100"
                className="w-32 px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm font-semibold tabular-nums focus:outline-none focus:border-sky-400" />
            </div>
            <button onClick={saveMetrics} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold transition-colors disabled:opacity-50">
              <Save className="w-4 h-4" /> Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Phases */}
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-8 space-y-4">
        {PHASES.map(phase => {
          const Icon = phase.icon;
          const status = getPhaseStatus(phase.id);
          const checkedCount = getCheckedCount(phase.id);
          const phasePct = phase.tasks.length > 0 ? Math.round((checkedCount / phase.tasks.length) * 100) : 0;
          const isExpanded = expanded === phase.id;

          return (
            <div key={phase.id} className={`bg-white rounded-2xl border overflow-hidden transition-all ${status === 'current' ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}>
              {/* Phase header - clickable */}
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

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-5 sm:px-6 pb-6">
                  {/* Targets */}
                  <div className="grid grid-cols-2 gap-3 py-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Boats Target</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Conservador</span><span className="font-bold">{phase.boatsMin}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Optimista</span><span className="font-bold">{phase.boatsMax}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Actual</span><span className="font-bold text-sky-600">{currentBoats}</span></div>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">ARR Target</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Conservador</span><span className="font-bold">{fmtCurrency(phase.arrMin)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Optimista</span><span className="font-bold">{fmtCurrency(phase.arrMax)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Actual</span><span className="font-bold text-emerald-600">{fmtCurrency(currentARR)}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
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

                  {/* Checklist */}
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

                  {/* Notes */}
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <StickyNote className="w-4 h-4 text-gray-400" />
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notas — {phase.name}</span>
                    </div>
                    <textarea
                      value={notes[phase.id] || ''}
                      onChange={e => updateNotes(phase.id, e.target.value)}
                      onBlur={() => saveNotes(phase.id)}
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

        {/* Bottom CTA */}
        <div className="bg-gradient-to-r from-gray-900 via-slate-900 to-gray-900 rounded-2xl p-6 sm:p-8 text-center">
          <p className="text-3xl sm:text-4xl font-black text-white mb-2">
            {fmtCurrency(700000)}
          </p>
          <p className="text-sm text-slate-400 mb-4">meta ARR optimista 2030</p>
          <p className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-violet-400 to-pink-400">
            Cada barco que onboardeas te acerca. Keep building. 🚢
          </p>
        </div>
      </div>
    </div>
  );
};
