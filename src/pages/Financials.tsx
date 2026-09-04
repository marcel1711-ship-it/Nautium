import React, { useState, useEffect } from 'react';
import { DollarSign, BarChart3, Receipt, TrendingUp, Calendar, Ship, FileDown, Anchor } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, fetchByCompany } from '../lib/supabase';
import { Costs } from './Costs';
import { Budget } from './Budget';
import { downloadHTML } from '../utils/helpers';
import { Voyage } from '../types';

interface FinancialsProps {
  onNavigate: (page: string, params?: any) => void;
}

interface VesselOption { id: string; name: string; }

interface MonthlyVesselSpend {
  month: string;
  monthLabel: string;
  [vesselId: string]: string | number;
}

export interface PeriodFilter {
  year: number;
  month: number;
  isFullYear: boolean;
}

const fmtCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const VESSEL_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2'];

const getPeriodRange = (p: PeriodFilter) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  if (p.isFullYear) return { start: `${p.year}-01-01`, end: `${p.year}-12-31` };
  const lastDay = new Date(p.year, p.month, 0).getDate();
  return { start: `${p.year}-${pad(p.month)}-01`, end: `${p.year}-${pad(p.month)}-${pad(lastDay)}` };
};

type Tab = 'overview' | 'expenses' | 'budget' | 'voyages';

export const Financials: React.FC<FinancialsProps> = ({ onNavigate }) => {
  // ── selectedVesselId del Header es la fuente de verdad ──────────────────
  const { currentUser, selectedVesselId } = useAuth();

  const [tab, setTab] = useState<Tab>('overview');
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [trendData, setTrendData] = useState<MonthlyVesselSpend[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVessels, setActiveVessels] = useState<string[]>([]);

  // Alias reactivo — 'all' cuando selectedVesselId es null o 'all'
  const overviewVessel: string = (!selectedVesselId || selectedVesselId === 'all') ? 'all' : selectedVesselId;

  const now = new Date();
  const [filter, setFilter] = useState<PeriodFilter>({ year: now.getFullYear(), month: now.getMonth() + 1, isFullYear: false });
  const [periodSpend, setPeriodSpend] = useState(0);
  const [periodBudget, setPeriodBudget] = useState(0);
  const [spendBreakdown, setSpendBreakdown] = useState({ operational: 0, fuel: 0, parts: 0, service: 0, crew: 0 });

  const companyId = currentUser?.company_id;

  useEffect(() => { if (companyId) loadTrend(); }, [companyId]);

  // Re-carga cuando cambia el filtro O cuando cambia el barco seleccionado en el Header
  useEffect(() => { if (companyId) loadPeriodTotals(); }, [companyId, filter.year, filter.month, filter.isFullYear, overviewVessel]);

  // Sincroniza activeVessels cuando el Header cambia el barco seleccionado
  useEffect(() => {
    if (vessels.length === 0) return;
    if (overviewVessel === 'all') setActiveVessels(vessels.map(v => v.id));
    else setActiveVessels([overviewVessel]);
  }, [overviewVessel, vessels]);

  const loadTrend = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const vesselsData = await fetchByCompany('vessels', companyId, 'name', true);
      const vList = vesselsData.map((v: any) => ({ id: v.id, name: v.name }));
      setVessels(vList);

      // Inicializa activeVessels respetando el barco seleccionado en el Header
      if (overviewVessel === 'all') setActiveVessels(vList.map((v: VesselOption) => v.id));
      else setActiveVessels([overviewVessel]);

      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split('T')[0];
      const { data: expenses } = await supabase
        .from('operational_expenses')
        .select('vessel_id, amount, expense_date')
        .eq('company_id', companyId)
        .gte('expense_date', twelveMonthsAgo);

      const months: MonthlyVesselSpend[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const row: MonthlyVesselSpend = { month: key, monthLabel: d.toLocaleString('en-US', { month: 'short' }) };
        vList.forEach((v: VesselOption) => { row[v.id] = 0; });
        months.push(row);
      }
      (expenses || []).forEach((e: any) => {
        const key = e.expense_date?.substring(0, 7);
        const row = months.find(m => m.month === key);
        if (row) row[e.vessel_id] = (Number(row[e.vessel_id]) || 0) + Number(e.amount || 0);
      });
      setTrendData(months);
    } catch (err) { console.error('Financials trend load error:', err); }
    finally { setLoading(false); }
  };

  const loadPeriodTotals = async () => {
    if (!companyId) return;
    const { start, end } = getPeriodRange(filter);
    const vesselClause = (q: any) => overviewVessel !== 'all' ? q.eq('vessel_id', overviewVessel) : q;

    // 1) Operational expenses
    let expQuery = supabase.from('operational_expenses').select('amount')
      .eq('company_id', companyId).gte('expense_date', start).lte('expense_date', end);
    expQuery = vesselClause(expQuery);
    const { data: expenses } = await expQuery;
    const operationalTotal = (expenses || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

    // 2) Fuel
    let fuelQuery = supabase.from('fuel_log').select('total_cost, vessel_id, entry_type, log_date')
      .eq('company_id', companyId).eq('entry_type', 'refill')
      .gte('log_date', start).lte('log_date', end)
      .not('total_cost', 'is', null);
    fuelQuery = vesselClause(fuelQuery);
    const { data: fuelEntries } = await fuelQuery;
    const fuelTotal = (fuelEntries || []).reduce((s: number, r: any) => s + Number(r.total_cost || 0), 0);

    // 3) Maintenance history — parts consumed + external service cost
    let histQuery = supabase.from('maintenance_history').select('vessel_id, external_service_cost, parts_used, completion_date')
      .eq('company_id', companyId)
      .gte('completion_date', start).lte('completion_date', end);
    histQuery = vesselClause(histQuery);
    const { data: histEntries } = await histQuery;

    let serviceTotal = 0;
    let partsTotal = 0;
    const allPartIds: string[] = [];
    (histEntries || []).forEach((h: any) => {
      if (h.external_service_cost && h.external_service_cost > 0) serviceTotal += Number(h.external_service_cost);
      if (h.parts_used && h.parts_used.length > 0) h.parts_used.forEach((p: any) => allPartIds.push(p.inventory_id));
    });

    if (allPartIds.length > 0) {
      const { data: invData } = await supabase.from('inventory_items').select('id, unit_cost').in('id', allPartIds);
      const invMap: Record<string, number> = {};
      (invData || []).forEach((inv: any) => { if (inv.unit_cost != null) invMap[inv.id] = inv.unit_cost; });
      (histEntries || []).forEach((h: any) => {
        if (!h.parts_used) return;
        h.parts_used.forEach((p: any) => {
          const unitCost = invMap[p.inventory_id];
          if (unitCost != null) partsTotal += unitCost * (p.quantity || 0);
        });
      });
    }

    // 4) Crew salaries (fixed monthly cost)
    let crewQuery = supabase.from('crew_members').select('monthly_salary')
      .eq('company_id', companyId!).eq('status', 'active');
    crewQuery = vesselClause(crewQuery);
    const { data: crewData } = await crewQuery;
    const crewSalaryTotal = (crewData || []).reduce((s: number, c: any) => s + Number(c.monthly_salary || 0), 0);
    const monthsInPeriod = filter.isFullYear ? 12 : 1;
    const crewCostForPeriod = crewSalaryTotal * monthsInPeriod;

    const totalSpend = operationalTotal + fuelTotal + partsTotal + serviceTotal + crewCostForPeriod;
    setSpendBreakdown({ operational: operationalTotal, fuel: fuelTotal, parts: partsTotal, service: serviceTotal, crew: crewCostForPeriod });
    setPeriodSpend(totalSpend);

    // Budget
    let budgetQuery = supabase.from('vessel_budgets').select('budget_amount')
      .eq('company_id', companyId).eq('department', 'Total');
    if (filter.isFullYear) budgetQuery = budgetQuery.eq('year', filter.year);
    else budgetQuery = budgetQuery.eq('year', filter.year).eq('month', filter.month);
    budgetQuery = vesselClause(budgetQuery);
    const { data: budgets } = await budgetQuery;
    setPeriodBudget((budgets || []).reduce((s: number, b: any) => s + Number(b.budget_amount || 0), 0));
  };

  const toggleVessel = (id: string) => {
    setActiveVessels(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
  };

  const budgetUsedPct = periodBudget > 0 ? Math.round((periodSpend / periodBudget) * 100) : 0;
  const periodLabel = filter.isFullYear ? `${filter.year} (Full Year)` : `${MONTHS[filter.month - 1]} ${filter.year}`;
  const vesselLabel = overviewVessel === 'all' ? 'All Vessels' : vessels.find(v => v.id === overviewVessel)?.name || '';

  const handleExportOverview = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Financial Report — ${vesselLabel} — ${periodLabel}</title>
    <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;margin:0;padding:40px;color:#111}
    h1{font-size:22px;margin-bottom:4px}h2{font-size:16px;margin:24px 0 8px;color:#374151}
    .meta{color:#6b7280;font-size:13px;margin-bottom:24px}.kpi-row{display:flex;gap:16px;margin-bottom:24px}
    .kpi{flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px}
    .kpi .label{font-size:11px;text-transform:uppercase;color:#9ca3af;font-weight:600;letter-spacing:0.05em}
    .kpi .value{font-size:24px;font-weight:700;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:8px}th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px}
    th{font-weight:600;color:#6b7280;text-transform:uppercase;font-size:11px;letter-spacing:0.05em}
    .right{text-align:right}.footer{margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af}
    @media print{body{padding:20px}.kpi-row{break-inside:avoid}}</style></head><body>
    <h1>Financial Overview</h1><p class="meta">${vesselLabel} · ${periodLabel} · Generated ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</p>
    <div class="kpi-row"><div class="kpi"><div class="label">Period Spend</div><div class="value">${fmtCurrency(periodSpend)}</div></div>
    <div class="kpi"><div class="label">Budget Used</div><div class="value">${periodBudget > 0 ? budgetUsedPct + '%' : 'No budget'}</div></div>
    <div class="kpi"><div class="label">Remaining</div><div class="value">${periodBudget > 0 ? fmtCurrency(Math.max(0, periodBudget - periodSpend)) : '—'}</div></div></div>
    <h2>Spend Breakdown</h2><table><thead><tr><th>Category</th><th class="right">Amount</th></tr></thead><tbody>
    <tr><td>Operational</td><td class="right">${fmtCurrency(spendBreakdown.operational)}</td></tr>
    <tr><td>Fuel</td><td class="right">${fmtCurrency(spendBreakdown.fuel)}</td></tr>
    <tr><td>Parts Used</td><td class="right">${fmtCurrency(spendBreakdown.parts)}</td></tr>
    <tr><td>External Service</td><td class="right">${fmtCurrency(spendBreakdown.service)}</td></tr>
    ${spendBreakdown.crew > 0 ? `<tr><td>Crew Salaries</td><td class="right">${fmtCurrency(spendBreakdown.crew)}</td></tr>` : ''}
    <tr style="font-weight:700;border-top:2px solid #374151"><td>Total</td><td class="right">${fmtCurrency(periodSpend)}</td></tr>
    </tbody></table><div class="footer">Nautium — www.nautium.app</div></body></html>`;
    downloadHTML(html, `financial-overview-${vesselLabel.replace(/\s+/g,'-').toLowerCase()}-${periodLabel.replace(/\s+/g,'-').toLowerCase()}`);
  };

  return (
    <div className="space-y-6 pt-4">
      <div>
        <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight">Financials</h1>
        <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">Fleet-wide budgets, expenses, and spend trends in one place</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
          <button onClick={() => setTab('overview')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === 'overview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <TrendingUp className="w-4 h-4" />Overview
          </button>
          <button onClick={() => setTab('expenses')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === 'expenses' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Receipt className="w-4 h-4" />Expenses
          </button>
          <button onClick={() => setTab('budget')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === 'budget' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <BarChart3 className="w-4 h-4" />Budget
          </button>
          <button onClick={() => setTab('voyages')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === 'voyages' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Anchor className="w-4 h-4" />Voyages
          </button>
        </div>

        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <Calendar className="w-4 h-4 text-gray-400" />
          <select
            value={filter.month}
            disabled={filter.isFullYear}
            onChange={e => setFilter(f => ({ ...f, month: Number(e.target.value) }))}
            className="text-sm font-medium text-gray-700 bg-transparent outline-none disabled:opacity-40">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={filter.year}
            onChange={e => setFilter(f => ({ ...f, year: Number(e.target.value) }))}
            className="text-sm font-medium text-gray-700 bg-transparent outline-none">
            {[filter.year - 1, filter.year, filter.year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <label className="flex items-center gap-1.5 pl-2 ml-1 border-l border-gray-200 text-sm font-medium text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={filter.isFullYear}
              onChange={e => setFilter(f => ({ ...f, isFullYear: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Full Year
          </label>
        </div>
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={handleExportOverview} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors">
              <FileDown className="w-4 h-4" /> Export Report
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3"><DollarSign className="w-5 h-5 text-blue-600" /></div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">{periodLabel}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{fmtCurrency(periodSpend)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{vesselLabel}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3"><BarChart3 className="w-5 h-5 text-emerald-600" /></div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Budget Used</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{periodBudget > 0 ? `${budgetUsedPct}%` : 'No budget'}</p>
              {periodBudget > 0 && <p className="text-xs text-gray-400 mt-0.5">of {fmtCurrency(periodBudget)}</p>}
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mb-3"><TrendingUp className="w-5 h-5 text-purple-600" /></div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Remaining</p>
              <p className={`text-2xl font-bold mt-1 ${periodSpend > periodBudget && periodBudget > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {periodBudget > 0 ? fmtCurrency(Math.max(0, periodBudget - periodSpend)) : '—'}
              </p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">What's included in {fmtCurrency(periodSpend)}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <BreakdownItem label="Operational" value={spendBreakdown.operational} />
              <BreakdownItem label="Fuel" value={spendBreakdown.fuel} />
              <BreakdownItem label="Parts used" value={spendBreakdown.parts} />
              <BreakdownItem label="External service" value={spendBreakdown.service} />
              {spendBreakdown.crew > 0 && <BreakdownItem label="Crew salaries" value={spendBreakdown.crew} />}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-900">Monthly Spend by Vessel</h2>
              <span className="text-sm text-gray-500">Last 12 months (trend)</span>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              {overviewVessel === 'all'
                ? 'Click a vessel below to show or hide it from the chart'
                : `Showing only ${vesselLabel} — select "All Fleet" above to compare vessels`}
            </p>
            <MonthlySpendChart
              data={trendData}
              vessels={vessels}
              loading={loading}
              activeVessels={activeVessels}
              onToggle={toggleVessel}
              lockToggle={overviewVessel !== 'all'}
            />
          </div>
        </div>
      )}

      {tab === 'expenses' && (
        <div className="-mt-2">
          <Costs onNavigate={onNavigate} controlledPeriod={filter} />
        </div>
      )}

      {tab === 'budget' && (
        <div className="-mt-2">
          <Budget onNavigate={onNavigate} controlledYear={filter.year} controlledMonth={filter.month} isFullYear={filter.isFullYear} />
        </div>
      )}

      {tab === 'voyages' && companyId && (
        <VoyagePL companyId={companyId} vesselId={overviewVessel} vessels={vessels} filter={filter} />
      )}
    </div>
  );
};

/* ── VOYAGE P&L ──────────────────────────────────────────────────────────────── */

interface VoyagePLRow {
  voyage: Voyage;
  vesselName: string;
  expenses: number;
  fuelCost: number;
  net: number;
}

const CHARTER_LABELS: Record<string, string> = {
  charter: 'Charter',
  owner_use: 'Owner Use',
  repositioning: 'Repositioning',
  event: 'Event',
};

const VoyagePL: React.FC<{
  companyId: string;
  vesselId: string;
  vessels: VesselOption[];
  filter: PeriodFilter;
}> = ({ companyId, vesselId, vessels, filter }) => {
  const [rows, setRows] = useState<VoyagePLRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadVoyages(); }, [companyId, vesselId, filter]);

  const loadVoyages = async () => {
    setLoading(true);
    try {
      const { start, end } = getPeriodRange(filter);
      let q = supabase.from('voyages').select('*').eq('company_id', companyId).gte('departure_date', start).lte('departure_date', end).order('departure_date', { ascending: false });
      if (vesselId !== 'all') q = q.eq('vessel_id', vesselId);
      const { data: voyages } = await q;
      if (!voyages || voyages.length === 0) { setRows([]); setLoading(false); return; }

      const voyageIds = voyages.map((v: any) => v.id);
      const vesselMap = Object.fromEntries(vessels.map(v => [v.id, v.name]));

      const { data: expenses } = await supabase.from('operational_expenses').select('voyage_id, amount').eq('company_id', companyId).in('voyage_id', voyageIds);
      const expenseByVoyage: Record<string, number> = {};
      (expenses || []).forEach((e: any) => { if (e.voyage_id) expenseByVoyage[e.voyage_id] = (expenseByVoyage[e.voyage_id] || 0) + Number(e.amount || 0); });

      const result: VoyagePLRow[] = voyages.map((v: any) => {
        const rev = Number(v.revenue || 0);
        const exp = expenseByVoyage[v.id] || 0;
        return { voyage: v, vesselName: vesselMap[v.vessel_id] || 'Unknown', expenses: exp, fuelCost: 0, net: rev - exp };
      });
      setRows(result);
    } catch (err) { console.error('VoyagePL load error:', err); }
    finally { setLoading(false); }
  };

  const totalRevenue = rows.reduce((s, r) => s + Number(r.voyage.revenue || 0), 0);
  const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0);
  const totalNet = totalRevenue - totalExpenses;
  const periodLabel = filter.isFullYear ? `${filter.year}` : `${MONTHS[filter.month - 1]} ${filter.year}`;

  const handleExport = () => {
    const rowsHtml = rows.map(r => `<tr>
      <td>${r.voyage.name}</td><td>${r.vesselName}</td>
      <td>${r.voyage.charter_type ? (CHARTER_LABELS[r.voyage.charter_type] || r.voyage.charter_type) : '—'}</td>
      <td>${r.voyage.departure_date || '—'}</td><td>${r.voyage.status}</td>
      <td class="right">${fmtCurrency(Number(r.voyage.revenue || 0))}</td>
      <td class="right">${fmtCurrency(r.expenses)}</td>
      <td class="right" style="font-weight:600;color:${r.net >= 0 ? '#16a34a' : '#dc2626'}">${fmtCurrency(r.net)}</td>
    </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Voyage P&L — ${periodLabel}</title>
    <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;margin:0;padding:40px;color:#111}
    h1{font-size:22px;margin-bottom:4px}.meta{color:#6b7280;font-size:13px;margin-bottom:24px}
    .kpi-row{display:flex;gap:16px;margin-bottom:24px}.kpi{flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px}
    .kpi .label{font-size:11px;text-transform:uppercase;color:#9ca3af;font-weight:600;letter-spacing:0.05em}.kpi .value{font-size:24px;font-weight:700;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:8px}th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px}
    th{font-weight:600;color:#6b7280;text-transform:uppercase;font-size:11px;letter-spacing:0.05em}.right{text-align:right}
    .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af}
    @media print{body{padding:20px}}</style></head><body>
    <h1>Voyage P&L</h1><p class="meta">${periodLabel} · Generated ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</p>
    <div class="kpi-row"><div class="kpi"><div class="label">Total Revenue</div><div class="value">${fmtCurrency(totalRevenue)}</div></div>
    <div class="kpi"><div class="label">Total Expenses</div><div class="value">${fmtCurrency(totalExpenses)}</div></div>
    <div class="kpi"><div class="label">Net P&L</div><div class="value" style="color:${totalNet >= 0 ? '#16a34a' : '#dc2626'}">${fmtCurrency(totalNet)}</div></div></div>
    <table><thead><tr><th>Voyage</th><th>Vessel</th><th>Type</th><th>Date</th><th>Status</th><th class="right">Revenue</th><th class="right">Expenses</th><th class="right">Net</th></tr></thead>
    <tbody>${rowsHtml}
    <tr style="font-weight:700;border-top:2px solid #374151"><td colspan="5">Total</td><td class="right">${fmtCurrency(totalRevenue)}</td><td class="right">${fmtCurrency(totalExpenses)}</td><td class="right" style="color:${totalNet >= 0 ? '#16a34a' : '#dc2626'}">${fmtCurrency(totalNet)}</td></tr>
    </tbody></table><div class="footer">Nautium — www.nautium.app</div></body></html>`;
    downloadHTML(html, `voyage-pl-${periodLabel.replace(/\s+/g,'-').toLowerCase()}`);
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmtCurrency(totalRevenue)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{rows.length} voyage{rows.length !== 1 ? 's' : ''} in {periodLabel}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-3"><Receipt className="w-5 h-5 text-red-500" /></div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Voyage Expenses</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmtCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3"><DollarSign className="w-5 h-5 text-blue-600" /></div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Net P&L</p>
          <p className={`text-2xl font-bold mt-1 ${totalNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtCurrency(totalNet)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-sm font-bold text-gray-900">Voyage Details</h3>
          {rows.length > 0 && (
            <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <FileDown className="w-3.5 h-3.5" /> Export
            </button>
          )}
        </div>
        {rows.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Anchor className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No voyages found for this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-gray-100">
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Voyage</th>
                  <th className="text-left px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Vessel</th>
                  <th className="text-left px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Type</th>
                  <th className="text-left px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Dates</th>
                  <th className="text-right px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Revenue</th>
                  <th className="text-right px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Expenses</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const rev = Number(r.voyage.revenue || 0);
                  return (
                    <tr key={r.voyage.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-gray-900">{r.voyage.name}</p>
                        <span className={`inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${r.voyage.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : r.voyage.status === 'active' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                          {r.voyage.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-600">{r.vesselName}</td>
                      <td className="px-3 py-3 text-gray-600">{r.voyage.charter_type ? (CHARTER_LABELS[r.voyage.charter_type] || r.voyage.charter_type) : '—'}</td>
                      <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {r.voyage.departure_date ? new Date(r.voyage.departure_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                        {r.voyage.arrival_date ? ` → ${new Date(r.voyage.arrival_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-gray-900 tabular-nums">{rev > 0 ? fmtCurrency(rev) : '—'}</td>
                      <td className="px-3 py-3 text-right text-gray-600 tabular-nums">{r.expenses > 0 ? fmtCurrency(r.expenses) : '—'}</td>
                      <td className={`px-5 py-3 text-right font-bold tabular-nums ${r.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{(rev > 0 || r.expenses > 0) ? fmtCurrency(r.net) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td colSpan={4} className="px-5 py-3 font-bold text-gray-900">Total</td>
                  <td className="px-3 py-3 text-right font-bold text-gray-900 tabular-nums">{fmtCurrency(totalRevenue)}</td>
                  <td className="px-3 py-3 text-right font-bold text-gray-900 tabular-nums">{fmtCurrency(totalExpenses)}</td>
                  <td className={`px-5 py-3 text-right font-bold tabular-nums ${totalNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtCurrency(totalNet)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── SUB-COMPONENTS — sin cambios ───────────────────────────────────────────── */

const BreakdownItem: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-gray-50 rounded-xl p-3">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtCurrency(value)}</p>
  </div>
);

const MonthlySpendChart: React.FC<{
  data: MonthlyVesselSpend[];
  vessels: VesselOption[];
  loading: boolean;
  activeVessels: string[];
  onToggle: (id: string) => void;
  lockToggle?: boolean;
}> = ({ data, vessels, loading, activeVessels, onToggle, lockToggle }) => {
  const W = 640, H = 240, PAD = 36;
  const maxVal = Math.max(...data.flatMap(row => activeVessels.map(id => Number(row[id]) || 0)), 1);
  const xFor = (i: number) => PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2);
  const yFor = (v: number) => H - PAD - (v / maxVal) * (H - PAD * 2);

  if (loading) return <div className="h-56 bg-gray-50 rounded-xl animate-pulse" />;
  if (vessels.length === 0) return (
    <div className="text-center py-16 text-gray-400">
      <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" />
      <p className="text-sm">No vessels found</p>
    </div>
  );

  return (
    <div>
      {!lockToggle && (
        <div className="flex flex-wrap gap-2 mb-5">
          {vessels.map((v, i) => {
            const isActive = activeVessels.includes(v.id);
            const color = VESSEL_COLORS[i % VESSEL_COLORS.length];
            return (
              <button key={v.id} onClick={() => onToggle(v.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${isActive ? 'bg-white border-gray-300' : 'bg-gray-50 border-gray-200 opacity-40'}`}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                {v.name}
              </button>
            );
          })}
        </div>
      )}
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {[0, 0.25, 0.5, 0.75, 1].map(p => (
          <line key={p} x1={PAD} x2={W - PAD} y1={yFor(maxVal * p)} y2={yFor(maxVal * p)} stroke="#f3f4f6" strokeWidth="1" />
        ))}
        {[0, 0.5, 1].map(p => (
          <text key={p} x={PAD - 8} y={yFor(maxVal * p) + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{fmtCurrency(maxVal * p)}</text>
        ))}
        {vessels.map((v, i) => {
          if (!activeVessels.includes(v.id)) return null;
          const color = VESSEL_COLORS[i % VESSEL_COLORS.length];
          const points = data.map((row, idx) => `${xFor(idx)},${yFor(Number(row[v.id]) || 0)}`).join(' ');
          return (
            <g key={v.id}>
              <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {data.map((row, idx) => <circle key={idx} cx={xFor(idx)} cy={yFor(Number(row[v.id]) || 0)} r="3" fill={color} />)}
            </g>
          );
        })}
        {data.map((row, i) => <text key={i} x={xFor(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="#9ca3af">{row.monthLabel}</text>)}
      </svg>
    </div>
  );
};
