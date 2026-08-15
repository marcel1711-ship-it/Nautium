import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  AlertTriangle, BarChart3, CheckCircle2, ChevronRight, Clock,
  DollarSign, Package, ShieldCheck, ShieldAlert, Ship, Wrench,
  Anchor, TrendingDown, TrendingUp, XCircle, Check, X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { demoInventoryItems, demoMaintenanceHistory, demoMaintenanceTasks, demoVessels } from '../data/demoData';
import { supabase } from '../lib/supabase';
import { formatDate, isLowStock } from '../utils/helpers';
import { InventoryItem, MaintenanceHistory, MaintenanceTask, OperationalExpense, Vessel } from '../types';
import { useToast } from '../components/UI/Toast';

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

const VESSEL_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2'];

const CATEGORY_LABELS: Record<string, string> = {
  mooring: 'Mooring', electricity: 'Electricity', water: 'Water',
  internet: 'Internet', waste_disposal: 'Waste Disposal', port_fees: 'Port Fees',
  insurance: 'Insurance', fuel: 'Fuel', maintenance: 'Maintenance',
  provisions: 'Provisions', day_worker: 'Day Worker', other: 'Other',
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
    <div className="bg-white rounded-2xl border-2 border-amber-200 p-5 shadow-sm"
      style={{ boxShadow: '0 4px 16px rgba(245,158,11,0.08)' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              {pending.length} expense{pending.length > 1 ? 's' : ''} awaiting your approval
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Review and approve or reject — approved expenses count toward budgets
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('financials')}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          View all →
        </button>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {pending.map(expense => {
          const vesselName = vesselNames[expense.vessel_id] || '—';
          return (
            <div key={expense.id} className="rounded-xl border border-amber-100 bg-amber-50 overflow-hidden">
              {/* Info */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-bold text-gray-900 truncate">
                      {expense.description || CATEGORY_LABELS[expense.category] || expense.category}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full uppercase">
                      {CATEGORY_LABELS[expense.category] || expense.category}
                    </span>
                    {/* Nombre del barco — útil cuando se ve "All Fleet" */}
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                      {vesselName}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    By {expense.requested_by_name || 'crew'} · {new Date(expense.expense_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-extrabold text-amber-700 tabular-nums">
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
        const tasks     = demoMaintenanceTasks.filter(t => allowedVesselIds.includes(t.vessel_id)) as MaintenanceTask[];
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

      if (shouldFilterByVesselIds) {
        vesselsQ = vesselsQ.in('id', allowedVesselIds);
        tasksQ   = tasksQ.in('vessel_id', allowedVesselIds);
        invQ     = invQ.in('vessel_id', allowedVesselIds);
        histQ    = histQ.in('vessel_id', allowedVesselIds);
        expQ     = expQ.in('vessel_id', allowedVesselIds);
        compQ    = compQ.in('vessel_id', allowedVesselIds);
        budgetQ  = budgetQ.in('vessel_id', allowedVesselIds);
      } else if (companyId) {
        vesselsQ = vesselsQ.eq('company_id', companyId);
        tasksQ   = tasksQ.eq('company_id', companyId);
        invQ     = invQ.eq('company_id', companyId);
        histQ    = histQ.eq('company_id', companyId);
        expQ     = expQ.eq('company_id', companyId);
        compQ    = compQ.eq('company_id', companyId);
        budgetQ  = budgetQ.eq('company_id', companyId);
      }

      const [vR, tR, iR, hR, eR, cR, bR] = await Promise.all([vesselsQ, tasksQ, invQ, histQ, expQ, compQ, budgetQ]);
      const compliance = (cR.data || []) as ComplianceItem[];
      setAllCompliance(compliance);
      setVesselStats(computeVesselStats(
        (vR.data || []) as Vessel[], (tR.data || []) as MaintenanceTask[],
        (iR.data || []) as InventoryItem[], (hR.data || []) as MaintenanceHistory[],
        (eR.data || []) as OperationalExpense[], compliance,
        (bR.data || []) as BudgetItem[]
      ));
    } catch (err) { console.error('Fleet overview error:', err); }
    finally { setLoading(false); }
  };

  const computeVesselStats = (
    vessels: Vessel[], tasks: MaintenanceTask[], inventory: InventoryItem[],
    history: MaintenanceHistory[], expenses: OperationalExpense[], compliance: ComplianceItem[],
    budgets: BudgetItem[]
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
      const monthlySpend         = vExp.reduce((s, e) => s + Number(e.amount || 0), 0);
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
      if (v.criticalOverdueCount > 0) items.push({ severity: 'warning', vessel: v.vessel.name, message: `${v.criticalOverdueCount} high-priority maintenance task${v.criticalOverdueCount === 1 ? '' : 's'} overdue`, nav: 'maintenance', category: 'Maintenance' });
    });
    return items;
  }, [scopedStats]);

  const hasCriticalBanner = !dismissedBanner && (
    totals.totalExpiredCerts > 0 || totals.totalCriticalOverdue > 0
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <Anchor className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Fleet Overview</h1>
            <p className="text-sm text-gray-500">{new Date().toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
        <button onClick={() => onNavigate('vessels')} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
          Manage vessels <ChevronRight className="w-4 h-4" />
        </button>
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
            <div className="relative overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-r from-red-950 to-red-900 p-5 shadow-lg">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-400 to-transparent" />
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-100 uppercase tracking-wide mb-1">Action required — fleet at risk</p>
                    <p className="text-white/60 text-xs mb-4">The following issues require immediate attention to avoid legal or operational consequences.</p>
                    <div className="flex flex-wrap gap-3">
                      {totals.totalExpiredCerts > 0 && (
                        <button onClick={() => onNavigate('compliance')}
                          className="flex items-center gap-2.5 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl transition-all group">
                          <ShieldAlert className="w-4 h-4 text-red-300 flex-shrink-0" />
                          <div className="text-left">
                            <p className="text-sm font-bold text-white">{totals.totalExpiredCerts} expired certificate{totals.totalExpiredCerts > 1 ? 's' : ''}</p>
                            <p className="text-[11px] text-red-300">Legal & operational risk → View Compliance</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-red-400 group-hover:translate-x-0.5 transition-transform ml-1" />
                        </button>
                      )}
                      {totals.totalCriticalOverdue > 0 && (
                        <button onClick={() => onNavigate('maintenance')}
                          className="flex items-center gap-2.5 px-4 py-2.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-xl transition-all group">
                          <Wrench className="w-4 h-4 text-orange-300 flex-shrink-0" />
                          <div className="text-left">
                            <p className="text-sm font-bold text-white">{totals.totalCriticalOverdue} high-priority task{totals.totalCriticalOverdue > 1 ? 's' : ''} overdue</p>
                            <p className="text-[11px] text-orange-300">Safety risk → View Maintenance</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-orange-400 group-hover:translate-x-0.5 transition-transform ml-1" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setDismissedBanner(true)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0">
                  <XCircle className="w-4 h-4 text-white/40 hover:text-white/70" />
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

          {/* ── VESSEL PILLS ── */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide mr-1 flex items-center gap-1">
              <Ship className="w-3.5 h-3.5" /> Viewing:
            </span>
            <button
              onClick={() => setSelectedVesselId('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-sm transition-all ${activeFilter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}
            >
              All Fleet
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeFilter === 'all' ? 'bg-white/20' : 'bg-gray-100'}`}>
                {vesselStats.length}
              </span>
            </button>
            {vesselStats.map((v, i) => {
              const isActive = activeFilter === v.vessel.id;
              const color = VESSEL_COLORS[i % VESSEL_COLORS.length];
              return (
                <button key={v.vessel.id} onClick={() => setSelectedVesselId(v.vessel.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-sm transition-all ${isActive ? 'text-white border-transparent' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}
                  style={isActive ? { background: color } : undefined}>
                  <span className="w-2 h-2 rounded-full" style={{ background: isActive ? 'white' : color }} />
                  {v.vessel.name}
                </button>
              );
            })}
          </div>

          {/* ── KPI ROW ── */}
          <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            <KpiCard label="Monthly Spend" value={fmtCurrency(totals.totalSpend)} sub={new Date().toLocaleString('en-US', { month: 'long' })} icon={DollarSign} tone="blue" onClick={() => onNavigate('financials')} />
            <KpiCard label="Budget Used" value={totals.totalBudget > 0 ? `${totals.fleetBudgetUsedPct}%` : '—'} sub={totals.totalBudget > 0 ? getBudgetTone(totals.fleetBudgetUsedPct).label : 'No budget set'} icon={BarChart3} tone={totals.totalBudget === 0 ? 'gray' : totals.fleetBudgetUsedPct > 100 ? 'red' : totals.fleetBudgetUsedPct >= 85 ? 'amber' : 'green'} onClick={() => onNavigate('financials')} />
            <KpiCard label="Expired Certs" value={String(totals.totalExpiredCerts)} sub={totals.totalExpiredCerts > 0 ? 'Needs immediate action' : 'None expired'} icon={ShieldAlert} tone={totals.totalExpiredCerts > 0 ? 'red' : 'gray'} onClick={() => onNavigate('compliance')} />
            <KpiCard label="Fleet Health" value={`${totals.fleetHealth}%`} sub={getScoreTone(totals.fleetHealth).label} icon={ShieldCheck} tone={totals.fleetHealth >= 85 ? 'green' : totals.fleetHealth >= 70 ? 'amber' : 'red'} />
            <KpiCard label="Maintenance" value={String(totals.totalCriticalOverdue)} sub={totals.totalCriticalOverdue > 0 ? 'High-priority overdue' : `${totals.totalOpenTasks} open tasks, on track`} icon={Wrench} tone={totals.totalCriticalOverdue > 0 ? 'red' : 'gray'} onClick={() => onNavigate('maintenance')} />
          </section>

          {/* ── NEEDS ATTENTION ── */}
          {attentionItems.length > 0 && (
            <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Needs Attention</h2>
              </div>
              <p className="text-xs text-gray-400 mb-4">Legal, financial and safety-critical items — sorted by risk, not by category.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {attentionItems.map((item, i) => (
                  <button key={i} onClick={() => onNavigate(item.nav)}
                    className={`text-left rounded-xl border p-3.5 transition-colors hover:brightness-95 ${item.severity === 'critical' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-gray-900 truncate">{item.vessel}</p>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${item.severity === 'critical' ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>{item.category}</span>
                    </div>
                    <p className="text-xs text-gray-600">{item.message}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── VESSEL CARDS ── */}
          <section className={`grid grid-cols-1 ${scopedStats.length > 1 ? 'lg:grid-cols-2 2xl:grid-cols-3' : ''} gap-5`}>
            {scopedStats.map(stats => (
              <VesselCommandCard
                key={stats.vessel.id}
                stats={stats}
                onView={() => handleViewVessel(stats.vessel.id)}
                onNavigateCompliance={() => onNavigate('compliance')}
              />
            ))}
          </section>

          {/* ── SPEND VS BUDGET ── */}
          <section className="bg-white rounded-2xl border border-gray-200 p-5 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-gray-900">Spend vs Budget by Vessel</h2>
              <button onClick={() => onNavigate('financials')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700">
                Financials <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-5">Current month — how much of each vessel's budget has been used so far.</p>
            <div className="space-y-4">
              {scopedStats.map(v => {
                const budgetTone = getBudgetTone(v.budgetUsedPct);
                const maxSpend = Math.max(...scopedStats.map(s => s.monthlySpend), 1);
                return (
                  <div key={v.vessel.id}>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <p className="text-sm font-semibold text-gray-800 truncate">{v.vessel.name}</p>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-gray-900 tabular-nums">
                          {fmtCurrency(v.monthlySpend)}{v.monthlyBudget > 0 && <span className="text-gray-400 font-normal"> / {fmtCurrency(v.monthlyBudget)}</span>}
                        </span>
                        {v.monthlyBudget > 0 && <span className={`ml-2 text-xs font-bold ${budgetTone.text}`}>{v.budgetUsedPct}%</span>}
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
    green: { icon: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', subText: 'text-emerald-600' },
    amber: { icon: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100',   subText: 'text-amber-600' },
    red:   { icon: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-100',     subText: 'text-red-600' },
    blue:  { icon: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100',    subText: 'text-gray-400' },
    gray:  { icon: 'text-gray-500',    bg: 'bg-gray-50',    border: 'border-gray-100',    subText: 'text-gray-400' },
  }[tone];
  return (
    <div onClick={onClick} className={`bg-white rounded-2xl border border-gray-200 p-4 ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''} transition-all`}>
      <div className={`w-9 h-9 rounded-lg ${tones.bg} ${tones.border} border flex items-center justify-center mb-3`}>
        <Icon className={`w-4 h-4 ${tones.icon}`} />
      </div>
      <p className="text-xl font-extrabold text-gray-900 tabular-nums truncate">{value}</p>
      <p className="text-xs font-semibold text-gray-500 mt-0.5">{label}</p>
      <p className={`text-[11px] font-medium mt-1 ${tones.subText}`}>{sub}</p>
    </div>
  );
};

const VesselCommandCard: React.FC<{
  stats: VesselStats; onView: () => void; onNavigateCompliance: () => void;
}> = ({ stats, onView, onNavigateCompliance }) => {
  const { vessel } = stats;
  const tone = getScoreTone(stats.readinessScore);
  const budgetTone = getBudgetTone(stats.budgetUsedPct);
  const hasComplianceIssues = stats.expiredCerts > 0 || stats.expiringSoonCerts > 0;
  const isOverBudget = stats.monthlyBudget > 0 && stats.budgetUsedPct > 100;

  return (
    <article className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-blue-700 to-slate-950">
        {vessel.photo_url ? (
          <img src={vessel.photo_url} alt={vessel.name} className="w-full h-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Ship className="w-10 h-10 text-white/30" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
        <div className="absolute top-3 right-3">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold border ${tone.bg} ${tone.text} ${tone.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
            {stats.readinessScore}% · {tone.label}
          </div>
        </div>
        <div className="absolute left-4 right-4 bottom-3">
          <h3 className="text-lg font-extrabold text-white tracking-tight truncate">{vessel.name}</h3>
          <p className="text-xs text-white/70 truncate">{getVesselTypeLabel(vessel)}</p>
        </div>
      </div>

      <div className="p-4">
        {stats.monthlyBudget > 0 ? (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">This month's spend</span>
              <span className={`text-xs font-bold ${budgetTone.text}`}>{budgetTone.label}</span>
            </div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-gray-900 tabular-nums">{fmtCurrency(stats.monthlySpend)} <span className="text-gray-400 font-normal">/ {fmtCurrency(stats.monthlyBudget)}</span></span>
              <span className={`text-xs font-bold ${budgetTone.text}`}>{stats.budgetUsedPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full ${budgetTone.bar} transition-all duration-700`} style={{ width: `${Math.min(stats.budgetUsedPct, 100)}%` }} />
            </div>
          </div>
        ) : (
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">This month's spend</span>
            <span className="text-sm font-bold text-gray-900 tabular-nums">{fmtCurrency(stats.monthlySpend)} <span className="text-gray-400 font-normal text-xs">no budget set</span></span>
          </div>
        )}

        {hasComplianceIssues ? (
          <button onClick={onNavigateCompliance}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 mb-3 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold hover:bg-purple-100 transition-colors">
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
              {stats.expiredCerts > 0 ? `${stats.expiredCerts} expired cert${stats.expiredCerts > 1 ? 's' : ''}` : `${stats.expiringSoonCerts} expiring soon`}
            </span>
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
          </button>
        ) : (
          <div className="w-full flex items-center gap-2 px-2.5 py-2 mb-3 rounded-lg bg-gray-50 border border-gray-100 text-gray-500 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />
            All certificates valid
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-3">
          <CompactMetric label="Critical" value={stats.criticalOverdueCount} icon={AlertTriangle} tone={stats.criticalOverdueCount > 0 ? 'red' : 'gray'} />
          <CompactMetric label="Open tasks" value={stats.openTaskCount} icon={Wrench} tone="blue" />
          <CompactMetric label="Low stock" value={stats.lowStockCount} icon={Package} tone={stats.lowStockCount > 0 ? 'amber' : 'gray'} />
        </div>

        {isOverBudget && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 mb-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
            <TrendingDown className="w-3.5 h-3.5 flex-shrink-0" />
            {fmtCurrency(stats.monthlySpend - stats.monthlyBudget)} over budget this month
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 truncate">
            {stats.lastActivityDate ? `Active ${formatDate(stats.lastActivityDate)}` : 'No recent activity'}
          </p>
          <button onClick={onView} className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors">
            Open <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
};

const CompactMetric: React.FC<{
  label: string; value: number; icon: React.ElementType; tone: 'red' | 'amber' | 'blue' | 'gray';
}> = ({ label, value, icon: Icon, tone }) => {
  const tones = {
    red:   'bg-red-50 border-red-100 text-red-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    blue:  'bg-blue-50 border-blue-100 text-blue-700',
    gray:  'bg-gray-50 border-gray-100 text-gray-400',
  }[tone];
  return (
    <div className={`rounded-xl border p-2 text-center ${tones}`}>
      <Icon className="w-3 h-3 mx-auto mb-0.5" />
      <p className="text-base font-extrabold leading-none tabular-nums">{value}</p>
      <p className="text-[9px] font-bold mt-0.5 truncate">{label}</p>
    </div>
  );
};
