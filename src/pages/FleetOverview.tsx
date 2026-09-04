import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  AlertTriangle, BarChart3, ChevronRight, Clock,
  DollarSign, Package, ShieldCheck, ShieldAlert, Ship, Wrench,
  TrendingDown, XCircle, Check, X, FileDown,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { demoInventoryItems, demoMaintenanceHistory, demoMaintenanceTasks, demoVessels } from '../data/demoData';
import { supabase } from '../lib/supabase';
import { formatDate, isLowStock, recalculateTaskStatuses } from '../utils/helpers';
import { InventoryItem, MaintenanceHistory, MaintenanceTask, OperationalExpense, Vessel } from '../types';
import { useToast } from '../components/UI/Toast';
import { generateOwnerReport, downloadReport, OwnerReportData } from '../lib/reports';
import { UpcomingVoyagesCard } from '../components/Voyages/VoyageCalendar';

interface FleetOverviewProps { onNavigate: (page: string, params?: any) => void; }

interface VesselStats {
  vessel: Vessel;
  overdueCount: number; criticalOverdueCount: number; dueSoonCount: number; openTaskCount: number; lowStockCount: number;
  inventoryHealth: number; maintenanceHealth: number; complianceHealth: number;
  readinessScore: number; monthlySpend: number; topSpendDepartment: string | null;
  lastActivityDate: string | null; expiredCerts: number; expiringSoonCerts: number;
  monthlyBudget: number; budgetUsedPct: number;
}

interface ComplianceItem {
  id: string; vessel_id: string; name: string; expiry_date: string;
  type: 'vessel' | 'crew'; assigned_to: string | null;
}

interface BudgetItem {
  vessel_id: string; department: string; budget_amount: number;
}

interface PendingExpense {
  id: string; category: string; description: string | null;
  amount: number; currency: string; expense_date: string;
  requested_by_name: string | null; vessel_id: string;
}

const isDemoUser = (email: string) => email === 'admin@yachtmaintenance.pro';
const fmtCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);
const getCurrentMonthStart = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0]; };
const getCurrentMonth = () => new Date().getMonth() + 1;
const getCurrentYear = () => new Date().getFullYear();
const getDaysUntilExpiry = (date: string) => { const t = new Date(); t.setHours(0,0,0,0); return Math.ceil((new Date(date).getTime() - t.getTime()) / 86400000); };


const CATEGORY_LABELS: Record<string, string> = {
  mooring: 'Mooring', electricity: 'Electricity', water: 'Water',
  internet: 'Internet', waste_disposal: 'Waste Disposal', port_fees: 'Port Fees',
  insurance: 'Insurance', fuel: 'Fuel', maintenance: 'Maintenance',
  provisions: 'Provisions', crew_salary: 'Crew Salaries', day_worker: 'Day Worker', other: 'Other',
};

const getScoreTone = (score: number) => {
  if (score >= 85) return { label: 'Ready',    text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' };
  if (score >= 70) return { label: 'Attention', text: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',  dot: 'bg-amber-500' };
  return               { label: 'Critical',  text: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    dot: 'bg-red-500' };
};
const getBudgetTone = (pct: number) => {
  if (pct > 100) return { text: 'text-red-600',     bar: 'bg-red-500',     label: 'Over budget' };
  if (pct >= 85) return { text: 'text-amber-600',   bar: 'bg-amber-500',   label: 'Nearing limit' };
  return              { text: 'text-emerald-600', bar: 'bg-emerald-500', label: 'On track' };
};
const getVesselTypeLabel = (vessel: Vessel) => {
  const parts = [vessel.type, vessel.length_overall ? `${vessel.length_overall}m` : null, vessel.flag].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Managed vessel';
};

/* ── PENDING APPROVALS CARD — fleet manager ve todos los barcos ─────────── */
const FleetPendingApprovalsCard: React.FC<{
  companyId: string;
  vesselFilter: string; // 'all' o un vessel_id específico
  vesselNames: Record<string, string>; // map id → name
  currentUser: any;
  onNavigate: (page: string) => void;
}> = ({ companyId, vesselFilter, vesselNames, currentUser, onNavigate }) => {
  const { showToast } = useToast();
  const [pending, setPending]             = useState<PendingExpense[]>([]);
  const [loading, setLoading]             = useState(true);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});
  const [processing, setProcessing]       = useState<string | null>(null);
  const [showNoteFor, setShowNoteFor]     = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('operational_expenses')
        .select('id, category, description, amount, currency, expense_date, requested_by_name, vessel_id')
        .eq('company_id', companyId)
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false });

      // Si hay un barco específico seleccionado, filtrar por él
      if (vesselFilter !== 'all') {
        query = query.eq('vessel_id', vesselFilter);
      }

      const { data } = await query;
      setPending(data || []);
    } catch (err) {
      console.error('Error loading pending expenses:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, vesselFilter]);

  useEffect(() => { loadPending(); }, [loadPending]);

  const handleApprove = async (expense: PendingExpense) => {
    setProcessing(expense.id);
    try {
      await supabase.from('operational_expenses').update({
        status:           'approved',
        approved_by:      currentUser.id,
        approved_by_name: currentUser.full_name,
        approved_at:      new Date().toISOString(),
        approval_notes:   approvalNotes[expense.id] || null,
      }).eq('id', expense.id);

      await supabase.from('admin_notifications').insert({
        company_id: companyId,
        type:    'expense_approved',
        title:   'Expense approved',
        message: `${CATEGORY_LABELS[expense.category] || expense.category} — ${expense.currency} ${fmtCurrency(expense.amount)} approved by ${currentUser.full_name}`,
        read:    false,
      });

      setPending(prev => prev.filter(e => e.id !== expense.id));
      showToast('Expense approved', 'success');
      setShowNoteFor(null);
    } catch {
      showToast('Failed to approve expense', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (expense: PendingExpense) => {
    if (!approvalNotes[expense.id]?.trim()) {
      showToast('Please add a note explaining the rejection', 'error');
      setShowNoteFor(expense.id);
      return;
    }
    setProcessing(expense.id);
    try {
      await supabase.from('operational_expenses').update({
        status:           'rejected',
        approved_by:      currentUser.id,
        approved_by_name: currentUser.full_name,
        approved_at:      new Date().toISOString(),
        approval_notes:   approvalNotes[expense.id],
      }).eq('id', expense.id);

      await supabase.from('admin_notifications').insert({
        company_id: companyId,
        type:    'expense_rejected',
        title:   'Expense rejected',
        message: `${CATEGORY_LABELS[expense.category] || expense.category} — ${fmtCurrency(expense.amount)} rejected by ${currentUser.full_name}: ${approvalNotes[expense.id]}`,
        read:    false,
      });

      setPending(prev => prev.filter(e => e.id !== expense.id));
      showToast('Expense rejected', 'info');
      setShowNoteFor(null);
    } catch {
      showToast('Failed to reject expense', 'error');
    } finally {
      setProcessing(null);
    }
  };

  if (loading || pending.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 border-l-4 border-l-amber-400 p-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              {pending.length} pending approval{pending.length > 1 ? 's' : ''}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Approved expenses count toward vessel budgets
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('financials')}
          className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          View all
        </button>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {pending.map(expense => {
          const vesselName = vesselNames[expense.vessel_id] || '—';
          return (
            <div key={expense.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              {/* Info */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {expense.description || CATEGORY_LABELS[expense.category] || expense.category}
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                      {CATEGORY_LABELS[expense.category] || expense.category}
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                      {vesselName}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {expense.requested_by_name || 'Crew'} · {new Date(expense.expense_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-bold text-gray-900 tabular-nums">
                    {expense.currency} {fmtCurrency(expense.amount)}
                  </p>
                </div>
              </div>

              {/* Campo de nota — aparece al intentar rechazar */}
              {showNoteFor === expense.id && (
                <div className="px-4 pb-3">
                  <input
                    type="text"
                    placeholder="Reason for rejection (required)..."
                    value={approvalNotes[expense.id] || ''}
                    onChange={e => setApprovalNotes(prev => ({ ...prev, [expense.id]: e.target.value }))}
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleReject(expense); if (e.key === 'Escape') setShowNoteFor(null); }}
                  />
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-2 px-4 pb-3">
                <button
                  onClick={() => showNoteFor === expense.id ? handleReject(expense) : setShowNoteFor(expense.id)}
                  disabled={processing === expense.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  {showNoteFor === expense.id ? 'Confirm reject' : 'Reject'}
                </button>
                <button
                  onClick={() => handleApprove(expense)}
                  disabled={processing === expense.id}
                  className="flex-[2] flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  {processing === expense.id ? 'Processing...' : 'Approve'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── PENDING PURCHASE REQUESTS CARD ───────────────────────────────────────── */
const FleetPendingPRsCard: React.FC<{
  companyId: string;
  vesselFilter: string;
  vesselNames: Record<string, string>;
  currentUser: any;
  onNavigate: (page: string) => void;
}> = ({ companyId, vesselFilter, vesselNames, currentUser, onNavigate }) => {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPending = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('purchase_requests')
        .select('id, pr_number, total_estimated_cost, currency, department, requested_by_name, vessel_id, status, urgency, created_at')
        .eq('company_id', companyId)
        .in('status', ['pending_captain', 'pending_fleet_manager'])
        .order('created_at', { ascending: false });

      if (vesselFilter !== 'all') {
        query = query.eq('vessel_id', vesselFilter);
      }

      const { data } = await query;
      setPending(data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [companyId, vesselFilter]);

  useEffect(() => { loadPending(); }, [loadPending]);

  if (loading || pending.length === 0) return null;

  const urgencyColors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-amber-100 text-amber-700',
    critical: 'bg-red-100 text-red-700',
  };

  return (
    <div className="bg-white border-2 border-blue-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-100 rounded-xl">
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Pending Purchase Requests</h3>
            <p className="text-xs text-gray-500">{pending.length} request{pending.length !== 1 ? 's' : ''} awaiting approval</p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('procurement')}
          className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
        >
          View all <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2.5">
        {pending.map(pr => (
          <div
            key={pr.id}
            onClick={() => onNavigate('procurement')}
            className="flex items-center justify-between p-3 bg-blue-50/50 rounded-xl hover:bg-blue-50 cursor-pointer transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 text-sm">{pr.pr_number}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${pr.status === 'pending_captain' ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700'}`}>
                  {pr.status === 'pending_captain' ? 'Captain' : 'Fleet Mgr'}
                </span>
                {pr.urgency !== 'medium' && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${urgencyColors[pr.urgency] || ''}`}>
                    {pr.urgency}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {vesselNames[pr.vessel_id] || 'Unknown'} · {pr.department} · {pr.requested_by_name}
              </p>
            </div>
            <span className="font-bold text-gray-900 text-sm shrink-0 ml-3">
              {pr.currency} {pr.total_estimated_cost?.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const FleetOverview: React.FC<FleetOverviewProps> = ({ onNavigate }) => {
  const { currentUser, setSelectedVesselId, selectedVesselId } = useAuth();
  const [vesselStats, setVesselStats]       = useState<VesselStats[]>([]);
  const [allCompliance, setAllCompliance]   = useState<ComplianceItem[]>([]);
  const [loading, setLoading]               = useState(true);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  const activeFilter: string = (!selectedVesselId || selectedVesselId === 'all') ? 'all' : selectedVesselId;

  useEffect(() => { if (currentUser) loadData(); }, [currentUser]);
  useEffect(() => { setDismissedBanner(false); }, [activeFilter]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const allowedVesselIds = currentUser.vessel_ids || [];
      const companyId = currentUser.company_id;
      const shouldFilterByVesselIds = allowedVesselIds.length > 0;

      if (isDemoUser(currentUser.email)) {
        const vessels   = demoVessels.filter(v => allowedVesselIds.includes(v.id));
        const tasks     = recalculateTaskStatuses(demoMaintenanceTasks.filter(t => allowedVesselIds.includes(t.vessel_id)) as MaintenanceTask[]);
        const inventory = demoInventoryItems.filter(i => allowedVesselIds.includes(i.vessel_id)) as InventoryItem[];
        const history   = demoMaintenanceHistory.filter(h => allowedVesselIds.includes(h.vessel_id)) as MaintenanceHistory[];
        setVesselStats(computeVesselStats(vessels, tasks, inventory, history, [], [], []));
        setLoading(false); return;
      }

      let vesselsQ = supabase.from('vessels').select('*').order('name', { ascending: true });
      let tasksQ   = supabase.from('maintenance_tasks').select('*');
      let invQ     = supabase.from('inventory_items').select('*');
      let histQ    = supabase.from('maintenance_history').select('*').order('completion_date', { ascending: false });
      let expQ     = supabase.from('operational_expenses').select('*').gte('expense_date', getCurrentMonthStart());
      let compQ    = supabase.from('compliance_items').select('*');
      let budgetQ  = supabase.from('vessel_budgets').select('vessel_id, department, budget_amount')
        .eq('year', getCurrentYear()).eq('month', getCurrentMonth()).eq('department', 'Total');
      let crewQ    = supabase.from('crew_members').select('vessel_id, monthly_salary').eq('status', 'active');

      if (shouldFilterByVesselIds) {
        vesselsQ = vesselsQ.in('id', allowedVesselIds);
        tasksQ   = tasksQ.in('vessel_id', allowedVesselIds);
        invQ     = invQ.in('vessel_id', allowedVesselIds);
        histQ    = histQ.in('vessel_id', allowedVesselIds);
        expQ     = expQ.in('vessel_id', allowedVesselIds);
        compQ    = compQ.in('vessel_id', allowedVesselIds);
        budgetQ  = budgetQ.in('vessel_id', allowedVesselIds);
        crewQ    = crewQ.in('vessel_id', allowedVesselIds);
      } else if (companyId) {
        vesselsQ = vesselsQ.eq('company_id', companyId);
        tasksQ   = tasksQ.eq('company_id', companyId);
        invQ     = invQ.eq('company_id', companyId);
        histQ    = histQ.eq('company_id', companyId);
        expQ     = expQ.eq('company_id', companyId);
        compQ    = compQ.eq('company_id', companyId);
        budgetQ  = budgetQ.eq('company_id', companyId);
        crewQ    = crewQ.eq('company_id', companyId);
      }

      const [vR, tR, iR, hR, eR, cR, bR, crR] = await Promise.all([vesselsQ, tasksQ, invQ, histQ, expQ, compQ, budgetQ, crewQ]);
      const compliance = (cR.data || []) as ComplianceItem[];
      setAllCompliance(compliance);
      const crewSalaries = (crR.data || []) as { vessel_id: string; monthly_salary: number }[];
      setVesselStats(computeVesselStats(
        (vR.data || []) as Vessel[], recalculateTaskStatuses((tR.data || []) as MaintenanceTask[]),
        (iR.data || []) as InventoryItem[], (hR.data || []) as MaintenanceHistory[],
        (eR.data || []) as OperationalExpense[], compliance,
        (bR.data || []) as BudgetItem[], crewSalaries
      ));
    } catch (err) { console.error('Fleet overview error:', err); }
    finally { setLoading(false); }
  };

  const computeVesselStats = (
    vessels: Vessel[], tasks: MaintenanceTask[], inventory: InventoryItem[],
    history: MaintenanceHistory[], expenses: OperationalExpense[], compliance: ComplianceItem[],
    budgets: BudgetItem[], crewSalaries: { vessel_id: string; monthly_salary: number }[] = []
  ): VesselStats[] => {
    const today = new Date();
    const sevenDaysFromNow = new Date(today); sevenDaysFromNow.setDate(today.getDate() + 7);
    return vessels.map(vessel => {
      const vTasks  = tasks.filter(t => t.vessel_id === vessel.id);
      const vInv    = inventory.filter(i => i.vessel_id === vessel.id);
      const vHist   = history.filter(h => h.vessel_id === vessel.id);
      const vExp    = expenses.filter(e => e.vessel_id === vessel.id);
      const vComp   = compliance.filter(c => c.vessel_id === vessel.id);
      const vBudget = budgets.filter(b => b.vessel_id === vessel.id);

      const overdueCount         = vTasks.filter(t => t.status === 'overdue').length;
      const criticalOverdueCount = vTasks.filter(t => t.status === 'overdue' && (t.priority === 'high' || t.priority === 'critical')).length;
      const dueSoonCount         = vTasks.filter(t => t.status === 'due_soon' && t.next_due_date && new Date(t.next_due_date) <= sevenDaysFromNow).length;
      const openTaskCount        = vTasks.filter(t => t.status !== 'completed').length;
      const lowStockCount        = vInv.filter(isLowStock).length;
      const maintenanceHealth    = vTasks.length > 0 ? Math.max(0, Math.round(((vTasks.length - overdueCount) / vTasks.length) * 100)) : 100;
      const inventoryHealth      = vInv.length > 0 ? Math.max(0, Math.round(((vInv.length - lowStockCount) / vInv.length) * 100)) : 100;
      const expiredCerts         = vComp.filter(c => getDaysUntilExpiry(c.expiry_date) < 0).length;
      const expiringSoonCerts    = vComp.filter(c => { const d = getDaysUntilExpiry(c.expiry_date); return d >= 0 && d <= 90; }).length;
      const complianceHealth     = vComp.length > 0 ? Math.round((vComp.filter(c => getDaysUntilExpiry(c.expiry_date) >= 0).length / vComp.length) * 100) : 100;
      const taskPressureScore    = Math.max(0, 100 - overdueCount * 12 - dueSoonCount * 4);
      const readinessScore       = Math.round((maintenanceHealth * 0.4) + (inventoryHealth * 0.25) + (complianceHealth * 0.2) + (taskPressureScore * 0.15));
      const vesselCrewSalary     = crewSalaries.filter(c => c.vessel_id === vessel.id).reduce((s, c) => s + Number(c.monthly_salary || 0), 0);
      const monthlySpend         = vExp.reduce((s, e) => s + Number(e.amount || 0), 0) + vesselCrewSalary;
      const spendByDept: Record<string, number> = {};
      vExp.forEach(e => { const d = e.department || 'General'; spendByDept[d] = (spendByDept[d] || 0) + Number(e.amount || 0); });
      const topSpendDepartment   = Object.entries(spendByDept).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      const sortedHist           = [...vHist].sort((a, b) => new Date(b.completion_date).getTime() - new Date(a.completion_date).getTime());
      const lastActivityDate     = sortedHist[0]?.completion_date || null;
      const monthlyBudget        = vBudget.reduce((s, b) => s + Number(b.budget_amount || 0), 0);
      const budgetUsedPct        = monthlyBudget > 0 ? Math.round((monthlySpend / monthlyBudget) * 100) : 0;

      return { vessel, overdueCount, criticalOverdueCount, dueSoonCount, openTaskCount, lowStockCount, inventoryHealth, maintenanceHealth, complianceHealth, readinessScore, monthlySpend, topSpendDepartment, lastActivityDate, expiredCerts, expiringSoonCerts, monthlyBudget, budgetUsedPct };
    }).sort((a, b) => a.readinessScore - b.readinessScore);
  };

  const handleViewVessel = (vesselId: string) => {
    setSelectedVesselId(vesselId);
    localStorage.setItem('selectedVesselId', vesselId);
    onNavigate('dashboard');
  };

  const handleExportReport = async (vesselId: string) => {
    const vs = vesselStats.find(v => v.vessel.id === vesselId);
    if (!vs) return;

    let fuelResources: any[] = [];
    let complianceItems: any[] = [];
    let prStats = { pending: 0, approved: 0, totalValue: 0 };
    let expenses: any[] = [];
    let history: any[] = [];

    try {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const [fuelRes, compRes, prRes, expRes, histRes] = await Promise.all([
        supabase.from('fuel_resources').select('name, current_level, capacity, unit').eq('vessel_id', vesselId),
        supabase.from('compliance_items').select('title, expiry_date, status').eq('vessel_id', vesselId),
        supabase.from('purchase_requests').select('status, total_estimated_cost').eq('vessel_id', vesselId),
        supabase.from('operational_expenses').select('amount, department, expense_date, category').eq('vessel_id', vesselId).gte('expense_date', threeMonthsAgo.toISOString().slice(0, 10)),
        supabase.from('maintenance_history').select('task_name, completion_date, completed_by_name').eq('vessel_id', vesselId).order('completion_date', { ascending: false }).limit(10),
      ]);
      fuelResources = fuelRes.data || [];
      complianceItems = compRes.data || [];
      history = histRes.data || [];
      expenses = expRes.data || [];
      const prs = prRes.data || [];
      prStats.pending = prs.filter((p: any) => p.status === 'pending_captain' || p.status === 'pending_fleet_manager').length;
      prStats.approved = prs.filter((p: any) => p.status === 'approved').length;
      prStats.totalValue = prs.filter((p: any) => p.status === 'approved').reduce((s: number, p: any) => s + (p.total_estimated_cost || 0), 0);
    } catch { /* silent */ }

    const monthMap: Record<string, { total: number; cats: Record<string, number> }> = {};
    expenses.forEach((e: any) => {
      const d = new Date(e.expense_date);
      const key = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      if (!monthMap[key]) monthMap[key] = { total: 0, cats: {} };
      monthMap[key].total += Number(e.amount || 0);
      const cat = e.category || e.department || 'General';
      monthMap[key].cats[cat] = (monthMap[key].cats[cat] || 0) + Number(e.amount || 0);
    });
    const costMonths = Object.entries(monthMap).slice(-3).map(([month, d]) => ({
      month,
      total: d.total,
      items: Object.entries(d.cats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label, amount]) => ({ label, amount })),
    }));

    let maintenanceTasks: any[] = [];
    try {
      const { data } = await supabase.from('maintenance_tasks').select('*').eq('vessel_id', vesselId);
      maintenanceTasks = data || [];
    } catch { /* silent */ }

    let inventoryItems: any[] = [];
    try {
      const { data } = await supabase.from('inventory_items').select('*').eq('vessel_id', vesselId);
      inventoryItems = data || [];
    } catch { /* silent */ }

    const reportData: OwnerReportData = {
      vessel: {
        vesselName: vs.vessel.name,
        vesselType: vs.vessel.type,
        vesselFlag: vs.vessel.flag,
        vesselLength: vs.vessel.length_overall ? `${vs.vessel.length_overall}m` : undefined,
      },
      maintenance: {
        tasks: maintenanceTasks,
        recentHistory: history,
      },
      inventory: { items: inventoryItems },
      costs: { months: costMonths, currency: 'EUR' },
      fuel: { resources: fuelResources },
      compliance: { items: complianceItems },
      procurement: prStats,
      generatedBy: currentUser?.full_name || 'Fleet Manager',
    };

    const html = generateOwnerReport(reportData);
    downloadReport(html, vs.vessel.name);
  };

  const scopedStats = useMemo(() =>
    activeFilter === 'all'
      ? vesselStats
      : vesselStats.filter(v => v.vessel.id === activeFilter),
  [vesselStats, activeFilter]);

  const totals = useMemo(() => {
    const vesselCount          = scopedStats.length;
    const totalOverdue         = scopedStats.reduce((s, v) => s + v.overdueCount, 0);
    const totalCriticalOverdue = scopedStats.reduce((s, v) => s + v.criticalOverdueCount, 0);
    const totalOpenTasks       = scopedStats.reduce((s, v) => s + v.openTaskCount, 0);
    const totalLowStock        = scopedStats.reduce((s, v) => s + v.lowStockCount, 0);
    const totalSpend           = scopedStats.reduce((s, v) => s + v.monthlySpend, 0);
    const totalBudget          = scopedStats.reduce((s, v) => s + v.monthlyBudget, 0);
    const totalExpiredCerts    = scopedStats.reduce((s, v) => s + v.expiredCerts, 0);
    const totalExpiringSoon    = scopedStats.reduce((s, v) => s + v.expiringSoonCerts, 0);
    const fleetHealth          = vesselCount > 0 ? Math.round(scopedStats.reduce((s, v) => s + v.readinessScore, 0) / vesselCount) : 100;
    const fleetBudgetUsedPct   = totalBudget > 0 ? Math.round((totalSpend / totalBudget) * 100) : 0;
    return { vesselCount, totalOverdue, totalCriticalOverdue, totalOpenTasks, totalLowStock, totalSpend, totalBudget, totalExpiredCerts, totalExpiringSoon, fleetHealth, fleetBudgetUsedPct };
  }, [scopedStats]);

  const attentionItems = useMemo(() => {
    const items: { severity: 'critical' | 'warning'; vessel: string; message: string; nav: string; category: string }[] = [];
    scopedStats.forEach(v => {
      if (v.expiredCerts > 0) items.push({ severity: 'critical', vessel: v.vessel.name, message: `${v.expiredCerts} expired certificate${v.expiredCerts === 1 ? '' : 's'} — legal/operational risk`, nav: 'compliance', category: 'Compliance' });
    });
    scopedStats.forEach(v => {
      if (v.budgetUsedPct > 100) items.push({ severity: 'critical', vessel: v.vessel.name, message: `${fmtCurrency(v.monthlySpend - v.monthlyBudget)} over budget this month`, nav: 'financials', category: 'Budget' });
    });
    scopedStats.forEach(v => {
      if (v.expiringSoonCerts > 0) items.push({ severity: 'warning', vessel: v.vessel.name, message: `${v.expiringSoonCerts} certificate${v.expiringSoonCerts === 1 ? '' : 's'} expiring within 90 days`, nav: 'compliance', category: 'Compliance' });
    });
    scopedStats.forEach(v => {
      if (v.overdueCount > 0) items.push({ severity: v.criticalOverdueCount > 0 ? 'critical' : 'warning', vessel: v.vessel.name, message: `${v.overdueCount} maintenance task${v.overdueCount === 1 ? '' : 's'} overdue`, nav: 'maintenance', category: 'Maintenance' });
    });
    return items;
  }, [scopedStats]);

  const hasCriticalBanner = !dismissedBanner && (
    totals.totalExpiredCerts > 0 || totals.totalOverdue > 0
  );

  // Map vessel id → name para mostrar en la card de aprobaciones
  const vesselNames = useMemo(() =>
    Object.fromEntries(vesselStats.map(v => [v.vessel.id, v.vessel.name])),
  [vesselStats]);

  if (loading) return (
    <div className="space-y-5 pt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">{[1,2,3,4,5].map(i => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse border border-gray-200" />)}</div>
      <div className="h-40 bg-white rounded-2xl animate-pulse border border-gray-200" />
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">{[1,2,3].map(i => <div key={i} className="h-72 bg-white rounded-2xl animate-pulse border border-gray-200" />)}</div>
    </div>
  );

  return (
    <div className="space-y-5 pt-4">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Fleet overview</h1>
          <p className="text-sm text-gray-400">{new Date().toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (activeFilter !== 'all') {
                handleExportReport(activeFilter);
              } else if (vesselStats.length > 0) {
                handleExportReport(vesselStats[0].vessel.id);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            Export Report
          </button>
          <button onClick={() => onNavigate('vessels')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Manage vessels <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {vesselStats.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
          <Ship className="w-14 h-14 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">No vessels found</p>
          <p className="text-sm text-gray-500 mt-1">No vessels are associated with your account.</p>
        </div>
      ) : (
        <>
          {/* ── BANNER CRÍTICO ── */}
          {hasCriticalBanner && (
            <div className="rounded-2xl border border-red-200 bg-white p-5 border-l-4 border-l-red-500">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 mb-0.5">Action required</p>
                    <p className="text-xs text-gray-500 mb-3">These issues need immediate attention.</p>
                    <div className="flex flex-wrap gap-2">
                      {totals.totalExpiredCerts > 0 && (
                        <button onClick={() => onNavigate('compliance')}
                          className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all group">
                          <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" />
                          <div className="text-left">
                            <p className="text-sm font-semibold text-gray-900">{totals.totalExpiredCerts} expired certificate{totals.totalExpiredCerts > 1 ? 's' : ''}</p>
                            <p className="text-xs text-red-500">View compliance</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      )}
                      {totals.totalOverdue > 0 && (
                        <button onClick={() => onNavigate('maintenance')}
                          className="flex items-center gap-2 px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all group">
                          <Wrench className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <div className="text-left">
                            <p className="text-sm font-semibold text-gray-900">{totals.totalOverdue} overdue task{totals.totalOverdue > 1 ? 's' : ''}</p>
                            <p className="text-xs text-amber-600">View maintenance</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setDismissedBanner(true)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
                  <XCircle className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              </div>
            </div>
          )}

          {/* ── PENDING APPROVALS — fleet manager ve todos los barcos ── */}
          {currentUser && currentUser.company_id && (
            <FleetPendingApprovalsCard
              companyId={currentUser.company_id}
              vesselFilter={activeFilter}
              vesselNames={vesselNames}
              currentUser={currentUser}
              onNavigate={onNavigate}
            />
          )}

          {/* ── PENDING PURCHASE REQUESTS ── */}
          {currentUser && currentUser.company_id && (
            <FleetPendingPRsCard
              companyId={currentUser.company_id}
              vesselFilter={activeFilter}
              vesselNames={vesselNames}
              currentUser={currentUser}
              onNavigate={onNavigate}
            />
          )}

          {/* ── KPI ROW ── */}
          <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            <KpiCard label="Monthly spend" value={fmtCurrency(totals.totalSpend)} sub={new Date().toLocaleString('en-US', { month: 'long' })} icon={DollarSign} tone="blue" onClick={() => onNavigate('financials')} />
            <KpiCard label="Budget used" value={totals.totalBudget > 0 ? `${totals.fleetBudgetUsedPct}%` : '—'} sub={totals.totalBudget > 0 ? getBudgetTone(totals.fleetBudgetUsedPct).label : 'No budget set'} icon={BarChart3} tone={totals.totalBudget === 0 ? 'gray' : totals.fleetBudgetUsedPct > 100 ? 'red' : totals.fleetBudgetUsedPct >= 85 ? 'amber' : 'green'} onClick={() => onNavigate('financials')} />
            <KpiCard label="Expired certs" value={String(totals.totalExpiredCerts)} sub={totals.totalExpiredCerts > 0 ? 'Needs immediate action' : 'None expired'} icon={ShieldAlert} tone={totals.totalExpiredCerts > 0 ? 'red' : 'gray'} onClick={() => onNavigate('compliance')} />
            <KpiCard label="Fleet health" value={`${totals.fleetHealth}%`} sub={getScoreTone(totals.fleetHealth).label} icon={ShieldCheck} tone={totals.fleetHealth >= 85 ? 'green' : totals.fleetHealth >= 70 ? 'amber' : 'red'} />
            <KpiCard label="Maintenance" value={String(totals.totalOverdue)} sub={totals.totalOverdue > 0 ? 'Overdue' : `${totals.totalOpenTasks} open tasks`} icon={Wrench} tone={totals.totalOverdue > 0 ? 'red' : 'gray'} onClick={() => onNavigate('maintenance')} />
          </section>

          {/* ── NEEDS ATTENTION ── */}
          {attentionItems.length > 0 && (
            <section className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-gray-900">Needs attention</h2>
                <span className="text-xs font-medium text-gray-400 ml-1">{attentionItems.length} items</span>
              </div>
              <p className="text-xs text-gray-400 mb-4">Sorted by risk — compliance, budget, then maintenance.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {attentionItems.map((item, i) => (
                  <button key={i} onClick={() => onNavigate(item.nav)}
                    className={`text-left rounded-xl bg-white border border-gray-200 p-3.5 transition-all hover:border-gray-300 hover:shadow-sm ${item.severity === 'critical' ? 'border-l-[3px] border-l-red-400' : 'border-l-[3px] border-l-amber-400'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.vessel}</p>
                      <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{item.category}</span>
                    </div>
                    <p className="text-xs text-gray-500">{item.message}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── UPCOMING VOYAGES ── */}
          {currentUser?.company_id && (
            <UpcomingVoyagesCard
              companyId={currentUser.company_id}
              vessels={vesselStats.map(s => s.vessel)}
              onNavigate={onNavigate}
            />
          )}

          {/* ── VESSEL CARDS ── */}
          <section className={`grid grid-cols-1 ${scopedStats.length > 1 ? 'lg:grid-cols-2 2xl:grid-cols-3' : ''} gap-5`}>
            {scopedStats.map(stats => (
              <VesselCommandCard
                key={stats.vessel.id}
                stats={stats}
                onView={() => handleViewVessel(stats.vessel.id)}
                onNavigateCompliance={() => onNavigate('compliance')}
                onExport={() => handleExportReport(stats.vessel.id)}
              />
            ))}
          </section>

          {/* ── SPEND VS BUDGET ── */}
          <section className="bg-white rounded-2xl border border-gray-200 p-5 md:p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-gray-900">Spend vs budget</h2>
              <button onClick={() => onNavigate('financials')} className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">
                Financials <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-5">Current month usage per vessel.</p>
            <div className="space-y-4">
              {scopedStats.map(v => {
                const budgetTone = getBudgetTone(v.budgetUsedPct);
                const maxSpend = Math.max(...scopedStats.map(s => s.monthlySpend), 1);
                return (
                  <div key={v.vessel.id}>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <p className="text-sm font-medium text-gray-700 truncate">{v.vessel.name}</p>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-semibold text-gray-900 tabular-nums">
                          {fmtCurrency(v.monthlySpend)}{v.monthlyBudget > 0 && <span className="text-gray-400 font-normal"> / {fmtCurrency(v.monthlyBudget)}</span>}
                        </span>
                        {v.monthlyBudget > 0 && <span className={`ml-2 text-xs font-medium ${budgetTone.text}`}>{v.budgetUsedPct}%</span>}
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${v.monthlyBudget > 0 ? budgetTone.bar : 'bg-blue-500'}`}
                        style={{ width: `${v.monthlyBudget > 0 ? Math.min(v.budgetUsedPct, 100) : Math.round((v.monthlySpend / maxSpend) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

/* ── SUB-COMPONENTS — sin cambios ─────────────────────────────────────────── */
const KpiCard: React.FC<{
  label: string; value: string; sub: string; icon: React.ElementType;
  tone: 'green' | 'amber' | 'red' | 'blue' | 'gray'; onClick?: () => void;
}> = ({ label, value, sub, icon: Icon, tone, onClick }) => {
  const tones = {
    green: { icon: 'text-emerald-600', dot: 'bg-emerald-500', subText: 'text-emerald-600' },
    amber: { icon: 'text-amber-600',   dot: 'bg-amber-500',   subText: 'text-amber-600' },
    red:   { icon: 'text-red-600',     dot: 'bg-red-500',     subText: 'text-red-600' },
    blue:  { icon: 'text-blue-600',    dot: 'bg-blue-500',    subText: 'text-gray-400' },
    gray:  { icon: 'text-gray-400',    dot: 'bg-gray-300',    subText: 'text-gray-400' },
  }[tone];
  return (
    <div onClick={onClick} className={`bg-white rounded-2xl border border-gray-200 p-4 ${onClick ? 'cursor-pointer hover:border-gray-300 hover:shadow-sm' : ''} transition-all`}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
          <Icon className={`w-4 h-4 ${tones.icon}`} />
        </div>
        {tone !== 'gray' && tone !== 'blue' && <span className={`w-2 h-2 rounded-full ${tones.dot}`} />}
      </div>
      <p className="text-xl font-bold text-gray-900 tabular-nums truncate">{value}</p>
      <p className="text-xs font-medium text-gray-500 mt-0.5">{label}</p>
      <p className={`text-xs mt-1 ${tones.subText}`}>{sub}</p>
    </div>
  );
};

const VesselCommandCard: React.FC<{
  stats: VesselStats; onView: () => void; onNavigateCompliance: () => void; onExport: () => void;
}> = ({ stats, onView, onNavigateCompliance, onExport }) => {
  const { vessel } = stats;
  const tone = getScoreTone(stats.readinessScore);
  const budgetTone = getBudgetTone(stats.budgetUsedPct);
  const hasComplianceIssues = stats.expiredCerts > 0 || stats.expiringSoonCerts > 0;
  const isOverBudget = stats.monthlyBudget > 0 && stats.budgetUsedPct > 100;
  const issueCount = stats.criticalOverdueCount + stats.lowStockCount + stats.expiredCerts;

  return (
    <article className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-gray-300 hover:shadow-sm transition-all">
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900">
        {vessel.photo_url ? (
          <img src={vessel.photo_url} alt={vessel.name} className="w-full h-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Ship className="w-10 h-10 text-white/20" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/10 to-transparent" />
        <div className="absolute top-3 right-3">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-sm ${stats.readinessScore >= 85 ? 'bg-white/90 text-emerald-700' : stats.readinessScore >= 70 ? 'bg-white/90 text-amber-700' : 'bg-white/90 text-red-700'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
            {stats.readinessScore}%
          </div>
        </div>
        <div className="absolute left-4 right-4 bottom-3">
          <h3 className="text-lg font-bold text-white tracking-tight truncate">{vessel.name}</h3>
          <p className="text-xs text-white/60 truncate">{getVesselTypeLabel(vessel)}</p>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Spend / Budget */}
        {stats.monthlyBudget > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-400 font-medium">Monthly spend</span>
              <span className={`text-xs font-semibold ${budgetTone.text}`}>{stats.budgetUsedPct}%</span>
            </div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-gray-900 tabular-nums">{fmtCurrency(stats.monthlySpend)} <span className="text-gray-400 font-normal">/ {fmtCurrency(stats.monthlyBudget)}</span></span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full ${budgetTone.bar} transition-all duration-700`} style={{ width: `${Math.min(stats.budgetUsedPct, 100)}%` }} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Monthly spend</span>
            <span className="text-sm font-semibold text-gray-900 tabular-nums">{fmtCurrency(stats.monthlySpend)}</span>
          </div>
        )}

        {/* Issues summary — single row instead of 3 colored boxes */}
        <div className="flex items-center gap-4 py-2 border-t border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">{stats.openTaskCount} open</span>
            {stats.overdueCount > 0 && <span className="text-xs font-semibold text-red-600">{stats.overdueCount} overdue</span>}
          </div>
          {stats.lowStockCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs text-amber-600 font-medium">{stats.lowStockCount} low stock</span>
            </div>
          )}
        </div>

        {/* Compliance */}
        {hasComplianceIssues ? (
          <button onClick={onNavigateCompliance}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:border-gray-300 transition-colors">
            <span className="flex items-center gap-2">
              <ShieldAlert className={`w-3.5 h-3.5 flex-shrink-0 ${stats.expiredCerts > 0 ? 'text-red-500' : 'text-amber-500'}`} />
              {stats.expiredCerts > 0 ? `${stats.expiredCerts} expired cert${stats.expiredCerts > 1 ? 's' : ''}` : `${stats.expiringSoonCerts} expiring soon`}
            </span>
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
          </button>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />
            All certificates valid
          </div>
        )}

        {isOverBudget && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-medium">
            <TrendingDown className="w-3.5 h-3.5 flex-shrink-0" />
            {fmtCurrency(stats.monthlySpend - stats.monthlyBudget)} over budget
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-gray-400 truncate">
            {stats.lastActivityDate ? `Active ${formatDate(stats.lastActivityDate)}` : 'No recent activity'}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onExport} className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-50 transition-colors" title="Export report">
              <FileDown className="w-3.5 h-3.5" />
            </button>
            <button onClick={onView} className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors">
              Open <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

