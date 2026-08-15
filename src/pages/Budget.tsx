import React, { useState, useEffect } from 'react';
import {
  DollarSign, Plus, Edit2, Check, X, TrendingUp, TrendingDown,
  AlertTriangle, ChevronDown, Ship, Settings, Anchor, Sofa,
  ChefHat, Shield, Package,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, fetchByCompany } from '../lib/supabase';
import { useToast } from '../components/UI/Toast';
import { canCreate, UserRole } from '../types';

interface BudgetProps {
  onNavigate: (page: string, params?: any) => void;
  controlledYear?: number;
  controlledMonth?: number;
  isFullYear?: boolean;
}

interface VesselBudget {
  id: string;
  vessel_id: string;
  year: number;
  month: number;
  department: string;
  budget_amount: number;
}

interface VesselOption { id: string; name: string; photo_url: string | null; }

const DEPARTMENTS = ['Total', 'Engineering', 'Deck', 'Interior', 'Galley', 'Safety', 'General'];

const DEPT_COLORS: Record<string, { bg: string; text: string; icon: React.ElementType; bar: string }> = {
  Total:       { bg: 'bg-blue-50',   text: 'text-blue-700',   icon: DollarSign, bar: 'bg-blue-500' },
  Engineering: { bg: 'bg-orange-50', text: 'text-orange-700', icon: Settings,   bar: 'bg-orange-500' },
  Deck:        { bg: 'bg-sky-50',    text: 'text-sky-700',    icon: Anchor,     bar: 'bg-sky-500' },
  Interior:    { bg: 'bg-purple-50', text: 'text-purple-700', icon: Sofa,       bar: 'bg-purple-500' },
  Galley:      { bg: 'bg-green-50',  text: 'text-green-700',  icon: ChefHat,    bar: 'bg-green-500' },
  Safety:      { bg: 'bg-red-50',    text: 'text-red-700',    icon: Shield,     bar: 'bg-red-500' },
  General:     { bg: 'bg-gray-50',   text: 'text-gray-700',   icon: Package,    bar: 'bg-gray-400' },
};

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export const Budget: React.FC<BudgetProps> = ({ onNavigate, controlledYear, controlledMonth, isFullYear }) => {
  const { currentUser, selectedVesselId, setSelectedVesselId } = useAuth();
  const { showToast } = useToast();
  const role = currentUser?.role as UserRole;
  const userCanEdit = canCreate(role);
  const companyId = currentUser?.company_id || '';

  const now = new Date();
  const [selectedYear, setSelectedYear]   = useState(controlledYear ?? now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(controlledMonth ?? now.getMonth() + 1);

  // Alias reactivo — renombrado para no colisionar con el del AuthContext
  const budgetVesselFilter: string = (!selectedVesselId || selectedVesselId === 'all') ? 'all' : selectedVesselId;

  const [vessels, setVessels]   = useState<VesselOption[]>([]);
  const [budgets, setBudgets]   = useState<VesselBudget[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  const [editingKey, setEditingKey]     = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  useEffect(() => {
    if (controlledYear)  setSelectedYear(controlledYear);
    if (controlledMonth) setSelectedMonth(controlledMonth);
  }, [controlledYear, controlledMonth]);

  useEffect(() => { loadData(); }, [currentUser, selectedYear, selectedMonth, selectedVesselId]);

  const loadData = async () => {
    if (!currentUser || !companyId) return;
    setLoading(true);
    try {
      const [vesselsData, budgetsRes, expensesRes] = await Promise.all([
        fetchByCompany('vessels', companyId, 'name', true),
        supabase.from('vessel_budgets').select('*')
          .eq('company_id', companyId)
          .eq('year', selectedYear)
          .eq('month', selectedMonth),
        supabase.from('operational_expenses').select('*')
          .eq('company_id', companyId)
          .gte('expense_date', `${selectedYear}-${String(selectedMonth).padStart(2,'0')}-01`)
          .lt('expense_date', selectedMonth === 12
            ? `${selectedYear + 1}-01-01`
            : `${selectedYear}-${String(selectedMonth + 1).padStart(2,'0')}-01`),
      ]);
      setVessels(vesselsData.map((v: any) => ({ id: v.id, name: v.name, photo_url: v.photo_url || null })));
      setBudgets(budgetsRes.data || []);
      setExpenses(expensesRes.data || []);
    } catch { showToast('Error loading budget data', 'error'); }
    finally { setLoading(false); }
  };

  const getBudget = (vesselId: string, dept: string) =>
    budgets.find(b => b.vessel_id === vesselId && b.department === dept)?.budget_amount || 0;

  const getSpent = (vesselId: string, dept: string) => {
    const vesselExpenses = expenses.filter(e => e.vessel_id === vesselId);
    if (dept === 'Total') return vesselExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    return vesselExpenses.filter(e => (e.department || 'General') === dept).reduce((s, e) => s + Number(e.amount || 0), 0);
  };

  const saveBudget = async (vesselId: string, dept: string, amount: number) => {
    const existing = budgets.find(b => b.vessel_id === vesselId && b.department === dept);
    try {
      if (existing) {
        await supabase.from('vessel_budgets').update({ budget_amount: amount }).eq('id', existing.id);
      } else {
        await supabase.from('vessel_budgets').insert({
          company_id: companyId, vessel_id: vesselId,
          year: selectedYear, month: selectedMonth,
          department: dept, budget_amount: amount,
        });
      }
      showToast('Budget saved', 'success');
      loadData();
    } catch { showToast('Error saving budget', 'error'); }
  };

  const handleEditStart = (vesselId: string, dept: string) => {
    const key = `${vesselId}-${dept}`;
    setEditingKey(key);
    setEditingValue(String(getBudget(vesselId, dept) || ''));
  };

  const handleEditSave = async (vesselId: string, dept: string) => {
    const amount = parseFloat(editingValue) || 0;
    await saveBudget(vesselId, dept, amount);
    setEditingKey(null);
  };

  // ── filteredVessels respeta el filtro del Header ──────────────────────
  const filteredVessels = budgetVesselFilter === 'all'
    ? vessels
    : vessels.filter(v => v.id === budgetVesselFilter);

  // ── KPI cards usan filteredVessels, no vessels ────────────────────────
  const isSingleVessel = budgetVesselFilter !== 'all';
  const selectedVesselName = isSingleVessel
    ? vessels.find(v => v.id === budgetVesselFilter)?.name || ''
    : '';

  const fleetBudget = filteredVessels.reduce((s, v) => s + getBudget(v.id, 'Total'), 0);
  const fleetSpent  = filteredVessels.reduce((s, v) => s + getSpent(v.id, 'Total'), 0);
  const fleetPct    = fleetBudget > 0 ? Math.round((fleetSpent / fleetBudget) * 100) : 0;

  return (
    <div className="space-y-6 pt-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight">Budget</h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-sm">Set and track monthly budgets per vessel and department</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-blue-500 bg-white">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-blue-500 bg-white">
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ── KPI cards — respetan filtro, labels dinámicos ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Fleet / Vessel budget */}
        <div style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 100%)', borderRadius: 20, padding: '20px 24px', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.4), transparent)' }} />
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
            {isSingleVessel ? 'Vessel budget' : 'Fleet budget'}
          </p>
          <p style={{ fontSize: 28, fontWeight: 800, color: 'white', fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>{fmt(fleetBudget)}</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            {MONTHS[selectedMonth - 1]} {selectedYear} · {isSingleVessel ? selectedVesselName : `${vessels.length} vessels`}
          </p>
        </div>

        {/* Fleet / Vessel spent */}
        <div style={{ background: 'white', borderRadius: 20, padding: '20px 24px', border: fleetPct > 90 ? '1.5px solid #fecaca' : '1px solid #e5e7eb', position: 'relative', overflow: 'hidden' }}>
          {fleetPct > 90 && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#ef4444', borderRadius: '20px 20px 0 0' }} />}
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
            {isSingleVessel ? 'Vessel spent' : 'Fleet spent'}
          </p>
          <p style={{ fontSize: 28, fontWeight: 800, color: '#111827', fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>{fmt(fleetSpent)}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {fleetPct > 90
              ? <AlertTriangle size={13} style={{ color: '#ef4444' }} />
              : fleetPct > 75
              ? <TrendingUp size={13} style={{ color: '#f59e0b' }} />
              : <TrendingDown size={13} style={{ color: '#16a34a' }} />}
            <p style={{ fontSize: 12, color: fleetPct > 90 ? '#ef4444' : fleetPct > 75 ? '#f59e0b' : '#16a34a', fontWeight: 600 }}>
              {fleetPct}% of budget used
            </p>
          </div>
        </div>

        {/* Remaining */}
        <div style={{ background: 'white', borderRadius: 20, padding: '20px 24px', border: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Remaining</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: fleetBudget - fleetSpent < 0 ? '#ef4444' : '#111827', fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
            {fmt(Math.max(0, fleetBudget - fleetSpent))}
          </p>
          <div style={{ height: 6, background: '#f3f4f6', borderRadius: 100, overflow: 'hidden', marginTop: 8 }}>
            <div style={{ height: '100%', width: `${Math.min(fleetPct, 100)}%`, background: fleetPct > 90 ? '#ef4444' : fleetPct > 75 ? '#f59e0b' : '#3b82f6', borderRadius: 100, transition: 'width 0.7s ease' }} />
          </div>
        </div>
      </div>

      {/* ── Vessel filter pills — sincronizan con el Header ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedVesselId('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-sm transition-all ${budgetVesselFilter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}
        >
          All vessels
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${budgetVesselFilter === 'all' ? 'bg-white/20' : 'bg-gray-100'}`}>
            {vessels.length}
          </span>
        </button>
        {vessels.map(v => (
          <button
            key={v.id}
            onClick={() => setSelectedVesselId(v.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-sm transition-all ${budgetVesselFilter === v.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}
          >
            <Ship className="w-3.5 h-3.5" />{v.name}
          </button>
        ))}
      </div>

      {/* Vessel budget cards */}
      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-64 bg-white rounded-2xl animate-pulse border border-gray-200" />)}</div>
      ) : filteredVessels.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <Ship className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No vessels found</p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredVessels.map(vessel => {
            const totalBudget = getBudget(vessel.id, 'Total');
            const totalSpent  = getSpent(vessel.id, 'Total');
            const totalPct    = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
            const overBudget  = totalSpent > totalBudget && totalBudget > 0;

            return (
              <div key={vessel.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Vessel header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    {vessel.photo_url ? (
                      <img src={vessel.photo_url} alt={vessel.name} className="w-10 h-10 rounded-xl object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Ship className="w-5 h-5 text-blue-600" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-gray-900">{vessel.name}</h3>
                      <p className="text-xs text-gray-500">{MONTHS[selectedMonth - 1]} {selectedYear}</p>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{fmt(totalSpent)} <span className="text-gray-400 font-normal">/ {fmt(totalBudget)}</span></p>
                        <p className={`text-xs font-semibold ${overBudget ? 'text-red-600' : totalPct > 75 ? 'text-amber-600' : 'text-green-600'}`}>
                          {totalBudget > 0 ? `${totalPct}% used` : 'No budget set'}
                        </p>
                      </div>
                      <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div style={{ width: `${Math.min(totalPct, 100)}%` }}
                          className={`h-full rounded-full transition-all duration-700 ${overBudget ? 'bg-red-500' : totalPct > 75 ? 'bg-amber-500' : 'bg-blue-500'}`} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Department rows */}
                <div className="divide-y divide-gray-50">
                  {DEPARTMENTS.map(dept => {
                    const budget    = getBudget(vessel.id, dept);
                    const spent     = getSpent(vessel.id, dept);
                    const pct       = budget > 0 ? Math.round((spent / budget) * 100) : 0;
                    const over      = spent > budget && budget > 0;
                    const key       = `${vessel.id}-${dept}`;
                    const isEditing = editingKey === key;
                    const deptStyle = DEPT_COLORS[dept] || DEPT_COLORS.General;
                    const Icon      = deptStyle.icon;

                    return (
                      <div key={dept} className={`px-6 py-3.5 flex items-center gap-4 ${dept === 'Total' ? 'bg-gray-50/80' : 'hover:bg-gray-50/50'} transition-colors`}>
                        <div className="flex items-center gap-2.5 w-36 flex-shrink-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${deptStyle.bg}`}>
                            <Icon className={`w-3.5 h-3.5 ${deptStyle.text}`} />
                          </div>
                          <span className={`text-sm font-semibold ${dept === 'Total' ? 'text-gray-900' : 'text-gray-700'}`}>{dept}</span>
                        </div>
                        <div className="w-28 flex-shrink-0">
                          <p className="text-sm font-bold text-gray-900 tabular-nums">{fmt(spent)}</p>
                          <p className="text-xs text-gray-400">spent</p>
                        </div>
                        <div className="w-36 flex-shrink-0">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-400 text-sm">$</span>
                              <input
                                type="number" value={editingValue}
                                onChange={e => setEditingValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleEditSave(vessel.id, dept); if (e.key === 'Escape') setEditingKey(null); }}
                                className="w-24 px-2 py-1 border border-blue-400 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                              />
                              <button onClick={() => handleEditSave(vessel.id, dept)} className="p-1 text-green-600 hover:bg-green-50 rounded-lg transition-colors"><Check className="w-4 h-4" /></button>
                              <button onClick={() => setEditingKey(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 group">
                              <div>
                                <p className="text-sm font-bold text-gray-900 tabular-nums">{budget > 0 ? fmt(budget) : '—'}</p>
                                <p className="text-xs text-gray-400">budget</p>
                              </div>
                              {userCanEdit && (
                                <button onClick={() => handleEditStart(vessel.id, dept)}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {budget > 0 ? (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-bold ${over ? 'text-red-600' : pct > 75 ? 'text-amber-600' : 'text-gray-500'}`}>
                                  {pct}%{over ? ' over budget' : ''}
                                </span>
                                <span className="text-xs text-gray-400">{fmt(Math.max(0, budget - spent))} left</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div style={{ width: `${Math.min(pct, 100)}%` }}
                                  className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : deptStyle.bar}`} />
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic">
                              {userCanEdit ? 'Click edit to set budget' : 'No budget set'}
                            </p>
                          )}
                        </div>
                        {over && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 rounded-lg flex-shrink-0">
                            <AlertTriangle className="w-3 h-3 text-red-500" />
                            <span className="text-xs font-bold text-red-600">{fmt(spent - budget)} over</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
