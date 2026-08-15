import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, CheckCircle, Clock, Package, Calendar,
  Building2, Users as UsersIcon, CreditCard, Activity,
  TrendingUp, Anchor, DollarSign, BarChart3, TrendingDown, Ship,
  ShieldCheck, ShieldAlert, Check, X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  demoMaintenanceTasks, demoInventoryItems,
  demoMaintenanceHistory, demoVessels,
} from '../data/demoData';
import { supabase, fetchByCompany } from '../lib/supabase';
import { calculateDaysUntilDue, formatDate, isLowStock, sortTasksByUrgency } from '../utils/helpers';
import { MaintenanceTask, InventoryItem, MaintenanceHistory, getRoleDepartment, UserRole } from '../types';
import { FleetOverview } from './FleetOverview';
import { useToast } from '../components/UI/Toast';

interface DashboardProps {
  onNavigate: (page: string, params?: any) => void;
}
interface Company {
  id: string; name: string; customer_type: string; yacht_name: string;
  contact_name: string; subscription_status: 'active' | 'trial' | 'inactive'; vessel_limit: number;
}
interface VesselInfo { id: string; name: string; photo_url: string | null; }
interface ComplianceAlert { id: string; name: string; expiry_date: string; type: 'vessel' | 'crew'; assigned_to: string | null; daysLeft: number; }

// ── Nuevo interface para gastos pendientes ────────────────────────────────
interface PendingExpense {
  id: string; category: string; description: string | null;
  amount: number; currency: string; expense_date: string;
  requested_by_name: string | null; vessel_id: string;
}

const isDemoUser = (email: string) => email === 'admin@yachtmaintenance.pro';

const DEPT_COLORS: Record<string, { bg: string; text: string; border: string; hex: string }> = {
  Engineering: { bg: 'rgba(249,115,22,0.12)', text: '#f97316', border: 'rgba(249,115,22,0.25)', hex: '#eb6834' },
  Deck:        { bg: 'rgba(37,99,235,0.12)',  text: '#3b82f6', border: 'rgba(37,99,235,0.25)',  hex: '#2a78d6' },
  Interior:    { bg: 'rgba(147,51,234,0.12)', text: '#9333ea', border: 'rgba(147,51,234,0.25)', hex: '#9333ea' },
  Galley:      { bg: 'rgba(22,163,74,0.12)',  text: '#16a34a', border: 'rgba(22,163,74,0.25)',  hex: '#16a34a' },
  Safety:      { bg: 'rgba(220,38,38,0.12)',  text: '#dc2626', border: 'rgba(220,38,38,0.25)',  hex: '#dc2626' },
  General:     { bg: 'rgba(107,114,128,0.12)', text: '#6b7280', border: 'rgba(107,114,128,0.25)', hex: '#6b7280' },
};
const DEPT_ORDER = ['Engineering', 'Deck', 'Interior', 'Galley', 'Safety', 'General'];
const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const getDaysUntilExpiry = (date: string) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const CATEGORY_LABELS: Record<string, string> = {
  mooring: 'Mooring', electricity: 'Electricity', water: 'Water',
  internet: 'Internet', waste_disposal: 'Waste Disposal', port_fees: 'Port Fees',
  insurance: 'Insurance', fuel: 'Fuel', maintenance: 'Maintenance',
  provisions: 'Provisions', day_worker: 'Day Worker', other: 'Other',
};

/* ─────────────────────────────────────────────
   PENDING APPROVALS CARD
───────────────────────────────────────────── */
const PendingApprovalsCard: React.FC<{
  companyId: string;
  vesselId: string | null;
  currentUser: any;
  onNavigate: (page: string) => void;
}> = ({ companyId, vesselId, currentUser, onNavigate }) => {
  const { showToast } = useToast();
  const [pending, setPending]         = useState<PendingExpense[]>([]);
  const [loading, setLoading]         = useState(true);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});
  const [processing, setProcessing]   = useState<string | null>(null);
  const [showNoteFor, setShowNoteFor] = useState<string | null>(null);

  useEffect(() => { loadPending(); }, [companyId, vesselId]);

  const loadPending = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('operational_expenses')
        .select('id, category, description, amount, currency, expense_date, requested_by_name, vessel_id')
        .eq('company_id', companyId)
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false });

      if (vesselId) query = query.eq('vessel_id', vesselId);

      const { data } = await query;
      setPending(data || []);
    } catch (err) {
      console.error('Error loading pending expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (expense: PendingExpense) => {
    setProcessing(expense.id);
    try {
      await supabase.from('operational_expenses').update({
        status:            'approved',
        approved_by:       currentUser.id,
        approved_by_name:  currentUser.full_name,
        approved_at:       new Date().toISOString(),
        approval_notes:    approvalNotes[expense.id] || null,
      }).eq('id', expense.id);

      // Notificar al crew que fue aprobado
      await supabase.from('admin_notifications').insert({
        company_id: companyId,
        type:       'expense_approved',
        title:      'Expense approved',
        message:    `${CATEGORY_LABELS[expense.category] || expense.category} — ${expense.currency} ${fmt(expense.amount)} approved by ${currentUser.full_name}`,
        read:       false,
      });

      setPending(prev => prev.filter(e => e.id !== expense.id));
      showToast('Expense approved', 'success');
      setShowNoteFor(null);
    } catch (err) {
      showToast('Failed to approve expense', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (expense: PendingExpense) => {
    if (!approvalNotes[expense.id]?.trim()) {
      showToast('Please add a note explaining why this is rejected', 'error');
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

      // Notificar al crew que fue rechazado
      await supabase.from('admin_notifications').insert({
        company_id: companyId,
        type:       'expense_rejected',
        title:      'Expense rejected',
        message:    `${CATEGORY_LABELS[expense.category] || expense.category} — ${expense.currency} ${fmt(expense.amount)} rejected by ${currentUser.full_name}: ${approvalNotes[expense.id]}`,
        read:       false,
      });

      setPending(prev => prev.filter(e => e.id !== expense.id));
      showToast('Expense rejected', 'info');
      setShowNoteFor(null);
    } catch (err) {
      showToast('Failed to reject expense', 'error');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return (
    <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e5e7eb', padding: '20px 22px' }}>
      <div style={{ height: 20, background: '#f9fafb', borderRadius: 8, width: '40%', marginBottom: 12 }} />
      {[1,2].map(i => <div key={i} style={{ height: 64, background: '#f9fafb', borderRadius: 12, marginBottom: 8 }} />)}
    </div>
  );

  if (pending.length === 0) return null; // No mostrar si no hay pendientes

  return (
    <div style={{
      background: 'white', borderRadius: 20,
      border: '1.5px solid #fde68a',
      padding: '20px 22px',
      boxShadow: '0 4px 16px rgba(245,158,11,0.08)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={18} style={{ color: '#d97706' }} />
          </div>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>
              Expenses awaiting your approval
            </h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>
              {pending.length} expense{pending.length > 1 ? 's' : ''} pending — review and approve or reject
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('costs')}
          style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          View all →
        </button>
      </div>

      {/* Lista de gastos pendientes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pending.map(expense => (
          <div key={expense.id} style={{
            background: '#fffbeb', borderRadius: 14,
            border: '1px solid #fde68a', overflow: 'hidden',
          }}>
            {/* Info del gasto */}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                    {expense.description || CATEGORY_LABELS[expense.category] || expense.category}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: 100 }}>
                    {CATEGORY_LABELS[expense.category] || expense.category}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>
                  Requested by {expense.requested_by_name || 'crew'} · {new Date(expense.expense_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#d97706', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {expense.currency} {fmt(expense.amount)}
              </div>
            </div>

            {/* Nota de aprobación */}
            {showNoteFor === expense.id && (
              <div style={{ padding: '0 16px 12px' }}>
                <input
                  type="text"
                  placeholder="Add a note (required for rejection)..."
                  value={approvalNotes[expense.id] || ''}
                  onChange={e => setApprovalNotes(prev => ({ ...prev, [expense.id]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, outline: 'none', background: 'white', boxSizing: 'border-box' }}
                  autoFocus
                />
              </div>
            )}

            {/* Botones */}
            <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  if (showNoteFor !== expense.id) setShowNoteFor(expense.id);
                  else handleReject(expense);
                }}
                disabled={processing === expense.id}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 10,
                  background: '#fef2f2', border: '1px solid #fecaca',
                  color: '#dc2626', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: processing === expense.id ? 0.5 : 1,
                }}
              >
                <X size={14} />
                {showNoteFor === expense.id ? 'Confirm reject' : 'Reject'}
              </button>
              <button
                onClick={() => handleApprove(expense)}
                disabled={processing === expense.id}
                style={{
                  flex: 2, padding: '8px 0', borderRadius: 10,
                  background: '#16a34a', border: 'none',
                  color: 'white', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: processing === expense.id ? 0.5 : 1,
                  boxShadow: '0 2px 8px rgba(22,163,74,0.25)',
                }}
              >
                <Check size={14} />
                {processing === expense.id ? 'Processing...' : 'Approve'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   VESSEL HEADER — sin cambios
───────────────────────────────────────────── */
const VesselHeader: React.FC<{
  vessel: VesselInfo | null;
  maintenanceHealth: number;
  inventoryHealth: number;
  complianceHealth: number;
  overallHealth: number;
  loading: boolean;
  department?: string | null;
}> = ({ vessel, maintenanceHealth, inventoryHealth, complianceHealth, overallHealth, loading, department }) => {
  const gaugeColor  = overallHealth >= 85 ? '#34d399' : overallHealth >= 70 ? '#fbbf24' : '#f87171';
  const statusLabel = overallHealth >= 85 ? 'Operational' : overallHealth >= 70 ? 'Attention needed' : 'Critical';
  const statusColor = overallHealth >= 85 ? '#34d399' : overallHealth >= 70 ? '#fbbf24' : '#f87171';
  const statusBg    = overallHealth >= 85 ? 'rgba(52,211,153,0.15)' : overallHealth >= 70 ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.15)';
  const statusBorder= overallHealth >= 85 ? 'rgba(52,211,153,0.3)'  : overallHealth >= 70 ? 'rgba(251,191,36,0.3)'  : 'rgba(248,113,113,0.3)';
  const gaugeAngle  = (pct: number) => -220 + (260 * pct) / 100;
  const polarToXY   = (deg: number, r: number, cx: number, cy: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const describeArc = (cx: number, cy: number, r: number, s: number, e: number) => {
    const sp = polarToXY(s, r, cx, cy); const ep = polarToXY(e, r, cx, cy);
    return `M ${sp.x} ${sp.y} A ${r} ${r} 0 ${e - s > 180 ? 1 : 0} 1 ${ep.x} ${ep.y}`;
  };
  const endAngle = loading ? -220 : gaugeAngle(overallHealth);
  const needlePt = polarToXY(endAngle, 28, 40, 42);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 100%)', borderRadius: 20, padding: '22px 26px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: '30%', width: '40%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.4), transparent)' }} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0, letterSpacing: '-0.01em' }}>
              {loading ? '—' : vessel?.name || 'My Vessel'}
            </h2>
            {department && <span style={{ padding: '3px 10px', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 100, fontSize: 11, fontWeight: 600, color: '#38bdf8' }}>{department}</span>}
          </div>
          {!loading && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: statusBg, border: `1px solid ${statusBorder}`, borderRadius: 100 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: statusColor }}>{statusLabel}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[
            { label: 'Maintenance', value: maintenanceHealth, colorA: '#38bdf8', colorB: '#22d3ee' },
            { label: 'Inventory',   value: inventoryHealth,   colorA: '#34d399', colorB: '#10b981' },
            { label: 'Compliance',  value: complianceHealth,  colorA: '#a78bfa', colorB: '#7c3aed' },
          ].map(bar => (
            <div key={bar.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{bar.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'white', fontVariantNumeric: 'tabular-nums' }}>{loading ? '—' : `${bar.value}%`}</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 100, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${loading ? 0 : bar.value}%`, background: `linear-gradient(90deg, ${bar.colorA}, ${bar.colorB})`, borderRadius: 100, transition: 'width 0.7s ease' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderRadius: 20, overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.25)', minHeight: 160, background: 'linear-gradient(135deg, #0d1f3c 0%, #0a1628 100%)' }}>
        {vessel?.photo_url ? (
          <>
            <img src={vessel.photo_url} alt={vessel.name || 'Vessel'} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(10,22,40,0.45) 0%, rgba(10,22,40,0.15) 100%)' }} />
          </>
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.06 }}>
            <Ship size={72} color="white" />
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 16, right: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg width="80" height="76" viewBox="0 0 80 76" style={{ overflow: 'visible', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}>
            <defs>
              <linearGradient id="cg2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={gaugeColor} stopOpacity="0.6" />
                <stop offset="100%" stopColor={gaugeColor} />
              </linearGradient>
            </defs>
            <path d={describeArc(40,42,28,-220,40)} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" strokeLinecap="round"/>
            {[0,25,50,75,100].map(p => { const a=gaugeAngle(p); const i=polarToXY(a,22,40,42); const o=polarToXY(a,27,40,42); return <line key={p} x1={i.x} y1={i.y} x2={o.x} y2={o.y} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeLinecap="round"/>; })}
            {!loading && overallHealth > 0 && <path d={describeArc(40,42,28,-220,endAngle)} fill="none" stroke="url(#cg2)" strokeWidth="8" strokeLinecap="round" style={{transition:'all 0.9s ease'}}/>}
            {!loading && <circle cx={needlePt.x} cy={needlePt.y} r="4" fill={gaugeColor}/>}
            <text x="40" y="46" textAnchor="middle" fontSize="16" fontWeight="700" fill="white" fontFamily="system-ui">{loading ? '—' : `${overallHealth}%`}</text>
          </svg>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginTop: -4 }}>OVERALL</span>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   CAPTAIN DASHBOARD — con Pending Approvals
───────────────────────────────────────────── */
interface DeptExpense  { dept: string; amount: number; }
interface DeptInventory { dept: string; value: number; }

const CaptainDashboard: React.FC<{
  tasks: MaintenanceTask[]; inventory: InventoryItem[]; history: MaintenanceHistory[];
  loading: boolean; overallHealth: number; maintenanceHealth: number; inventoryHealth: number;
  complianceHealth: number; complianceAlerts: ComplianceAlert[];
  vessel: VesselInfo | null;
  onNavigate: (page: string, params?: any) => void;
  t: (key: string) => string; companyId: string;
  currentUser: any;
  selectedVesselId: string | null;
}> = ({ tasks, inventory, history, loading, overallHealth, maintenanceHealth, inventoryHealth, complianceHealth, complianceAlerts, vessel, onNavigate, t, companyId, currentUser, selectedVesselId }) => {
  const [expenses, setExpenses] = useState<DeptExpense[]>([]);
  const [deptInventory, setDeptInventory] = useState<DeptInventory[]>([]);
  const [loadingCosts, setLoadingCosts] = useState(true);
  const [monthlyTrend, setMonthlyTrend] = useState<{ month: string; total: number }[]>([]);

  useEffect(() => { if (companyId) loadCosts(); }, [companyId]);

  const loadCosts = async () => {
    setLoadingCosts(true);
    try {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
      const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const allExp = await fetchByCompany('operational_expenses', companyId, 'expense_date', false);
      const byDept: Record<string, number> = {};
      allExp.filter((e: any) => e.expense_date >= monthStart).forEach((e: any) => {
        const d = e.department || 'General';
        byDept[d] = (byDept[d] || 0) + (e.amount || 0);
      });
      setExpenses(DEPT_ORDER.filter(d => byDept[d]).map(d => ({ dept: d, amount: byDept[d] })));
      const byMonth: Record<string, number> = {};
      allExp.filter((e: any) => e.expense_date >= sixMonthsAgo).forEach((e: any) => {
        const m = e.expense_date?.substring(0, 7);
        if (m) byMonth[m] = (byMonth[m] || 0) + (e.amount || 0);
      });
      const trend = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        trend.push({ month: d.toLocaleString('en-US', { month: 'short' }), total: byMonth[key] || 0 });
      }
      setMonthlyTrend(trend);
      const allInv = await fetchByCompany('inventory_items', companyId, 'name', true);
      const byDeptInv: Record<string, number> = {};
      allInv.forEach((i: any) => { const d = i.department || 'General'; if (i.unit_cost) byDeptInv[d] = (byDeptInv[d] || 0) + (i.unit_cost * i.current_stock); });
      setDeptInventory(DEPT_ORDER.filter(d => byDeptInv[d]).map(d => ({ dept: d, value: byDeptInv[d] })));
    } catch { /* cost data is supplementary, silent fail is acceptable */ }
    finally { setLoadingCosts(false); }
  };

  const totalExpenses       = expenses.reduce((s, e) => s + e.amount, 0);
  const totalInventoryValue = deptInventory.reduce((s, i) => s + i.value, 0);
  const overdueTasks        = tasks.filter(t => t.status === 'overdue');
  const lowStockItems       = inventory.filter(isLowStock);
  const sortedTasks         = sortTasksByUrgency(tasks.filter(t => t.status !== 'completed')).slice(0, 4);

  const totalCirc = 2 * Math.PI * 40;
  let offset = 0;
  const segments = expenses.map(e => {
    const pct = totalExpenses > 0 ? e.amount / totalExpenses : 0;
    const dash = pct * totalCirc;
    const seg = { dept: e.dept, amount: e.amount, pct, dash, offset, color: DEPT_COLORS[e.dept]?.hex || '#6b7280' };
    offset += dash + 1.5;
    return seg;
  });

  const sparkW = 220; const sparkH = 52;
  const trendMax = Math.max(...monthlyTrend.map(m => m.total), 1);
  const sparkPts = monthlyTrend.map((m, i) => ({
    x: (i / Math.max(monthlyTrend.length - 1, 1)) * sparkW,
    y: sparkH - (m.total / trendMax) * (sparkH - 8),
  }));
  const sparkPath = sparkPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const sparkFill = `${sparkPath} L ${sparkW} ${sparkH} L 0 ${sparkH} Z`;
  const lastPt    = sparkPts[sparkPts.length - 1];
  const prevTotal = monthlyTrend[monthlyTrend.length - 2]?.total || 0;
  const currTotal = monthlyTrend[monthlyTrend.length - 1]?.total || 0;
  const trendPct  = prevTotal > 0 ? Math.round(((currTotal - prevTotal) / prevTotal) * 100) : 0;

  const expiredCerts  = complianceAlerts.filter(a => a.daysLeft < 0).length;
  const criticalCerts = complianceAlerts.filter(a => a.daysLeft >= 0 && a.daysLeft <= 30).length;
  const upcomingCerts = complianceAlerts.slice(0, 4);

  return (
    <div className="space-y-5 pt-4">
      {/* VESSEL HEADER */}
      <VesselHeader
        vessel={vessel} maintenanceHealth={maintenanceHealth}
        inventoryHealth={inventoryHealth} complianceHealth={complianceHealth}
        overallHealth={overallHealth} loading={loading}
      />

      {/* ── PENDING APPROVALS — aparece solo si hay gastos pendientes ── */}
      <PendingApprovalsCard
        companyId={companyId}
        vesselId={selectedVesselId}
        currentUser={currentUser}
        onNavigate={onNavigate}
      />

      {/* KPI ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Expenses this month', value: loadingCosts ? '—' : fmt(totalExpenses), icon: TrendingDown, iconColor: '#ef4444', iconBg: '#fef2f2', sub: `${expenses.length} departments`, nav: 'costs', accent: false },
          { label: 'Inventory on board',  value: loadingCosts ? '—' : fmt(totalInventoryValue), icon: Package, iconColor: '#3b82f6', iconBg: '#eff6ff', sub: `${inventory.length} items`, nav: 'inventory', accent: false },
          { label: 'Overdue tasks', value: loading ? '—' : String(overdueTasks.length), icon: AlertTriangle, iconColor: overdueTasks.length > 0 ? '#ef4444' : '#9ca3af', iconBg: overdueTasks.length > 0 ? '#fef2f2' : '#f9fafb', sub: overdueTasks.length > 0 ? 'Needs attention' : 'All clear', nav: 'maintenance', accent: overdueTasks.length > 0 },
          { label: 'Low stock alerts', value: loading ? '—' : String(lowStockItems.length), icon: BarChart3, iconColor: lowStockItems.length > 0 ? '#f59e0b' : '#9ca3af', iconBg: lowStockItems.length > 0 ? '#fffbeb' : '#f9fafb', sub: lowStockItems.length > 0 ? 'Reorder needed' : 'Stock OK', nav: 'inventory', accent: lowStockItems.length > 0 },
        ].map((kpi, i) => { const Icon = kpi.icon; return (
          <div key={i} onClick={() => onNavigate(kpi.nav)}
            style={{ background: 'white', borderRadius: 16, padding: '18px 20px', border: kpi.accent ? `1.5px solid ${kpi.iconColor}30` : '1px solid #e5e7eb', cursor: 'pointer', transition: 'box-shadow 0.2s, transform 0.2s', position: 'relative', overflow: 'hidden' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.09)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}>
            {kpi.accent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: kpi.iconColor, borderRadius: '16px 16px 0 0' }} />}
            <div style={{ width: 38, height: 38, borderRadius: 10, background: kpi.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Icon size={18} style={{ color: kpi.iconColor }} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>{kpi.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 2 }}>{kpi.label}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{kpi.sub}</div>
          </div>
        ); })}
      </div>

      {/* COSTS + INVENTORY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e5e7eb', padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 2 }}>Expenses by department</h2>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>{new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}</div>
            </div>
            <button onClick={() => onNavigate('costs')} style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
          </div>
          {loadingCosts ? <div style={{ height: 140, background: '#f9fafb', borderRadius: 12 }} />
          : totalExpenses === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <DollarSign size={36} style={{ color: '#d1d5db', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13, color: '#9ca3af' }}>No expenses this month</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid #f3f4f6' }}>
                <svg width="100" height="100" viewBox="0 0 100 100" role="img" aria-label="Expenses by department">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="14"/>
                  {segments.map((seg, i) => (
                    <circle key={i} cx="50" cy="50" r="40" fill="none" stroke={seg.color} strokeWidth="14"
                      strokeDasharray={`${seg.dash} ${totalCirc}`} strokeDashoffset={totalCirc / 4 - seg.offset} transform="rotate(-90 50 50)" />
                  ))}
                  <text x="50" y="46" textAnchor="middle" fontSize="11" fontWeight="700" fill="#111827" fontFamily="system-ui">{fmt(totalExpenses)}</text>
                  <text x="50" y="59" textAnchor="middle" fontSize="9" fill="#9ca3af" fontFamily="system-ui">this month</text>
                </svg>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {segments.map(seg => (
                    <div key={seg.dept} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#6b7280', flex: 1 }}>{seg.dept}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmt(seg.amount)}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 28, textAlign: 'right' }}>{Math.round(seg.pct * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Monthly spend — last 6 months</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: trendPct >= 0 ? '#ef4444' : '#16a34a' }}>
                    {trendPct >= 0 ? '↑' : '↓'} {Math.abs(trendPct)}% vs last month
                  </span>
                </div>
                <svg width="100%" height="56" viewBox={`0 0 ${sparkW} ${sparkH}`} preserveAspectRatio="none">
                  <defs><linearGradient id="sfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2a78d6" stopOpacity="0.15"/><stop offset="100%" stopColor="#2a78d6" stopOpacity="0"/></linearGradient></defs>
                  <path d={sparkFill} fill="url(#sfill)"/>
                  <path d={sparkPath} fill="none" stroke="#2a78d6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  {lastPt && <circle cx={lastPt.x} cy={lastPt.y} r="4" fill="#2a78d6" stroke="white" strokeWidth="2"/>}
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  {monthlyTrend.map((m, i) => (
                    <span key={i} style={{ fontSize: 10, color: i === monthlyTrend.length - 1 ? '#111827' : '#9ca3af', fontWeight: i === monthlyTrend.length - 1 ? 600 : 400 }}>{m.month}</span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e5e7eb', padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 2 }}>Inventory value</h2>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>By department · on board</div>
            </div>
            <button onClick={() => onNavigate('inventory')} style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>Details →</button>
          </div>
          {loadingCosts ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3,4].map(i => <div key={i} style={{ height: 32, background: '#f9fafb', borderRadius: 8 }} />)}</div>
          : deptInventory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <Package size={36} style={{ color: '#d1d5db', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13, color: '#9ca3af' }}>No inventory with unit cost</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {deptInventory.map(d => {
                const pct = totalInventoryValue > 0 ? (d.value / totalInventoryValue) * 100 : 0;
                const color = DEPT_COLORS[d.dept]?.hex || '#6b7280';
                return (
                  <div key={d.dept}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{d.dept}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmt(d.value)}</span>
                    </div>
                    <div style={{ height: 5, background: '#f3f4f6', borderRadius: 100, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 100, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>Total on board</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalInventoryValue)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* COMPLIANCE ALERTS */}
      <div style={{ background: 'white', borderRadius: 20, border: expiredCerts > 0 || criticalCerts > 0 ? '1px solid #fecaca' : '1px solid #e5e7eb', padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={16} style={{ color: expiredCerts > 0 ? '#ef4444' : criticalCerts > 0 ? '#f97316' : '#7c3aed' }} />
              Compliance Alerts
            </h2>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              {expiredCerts > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>{expiredCerts} expired · </span>}
              {criticalCerts > 0 && <span style={{ color: '#f97316', fontWeight: 600 }}>{criticalCerts} expiring within 30 days · </span>}
              <span>{complianceAlerts.filter(a => a.daysLeft > 30 && a.daysLeft <= 90).length} within 90 days</span>
            </div>
          </div>
          <button onClick={() => onNavigate('compliance')} style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
        </div>
        {complianceAlerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <ShieldCheck size={36} style={{ color: '#34d399', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 13, color: '#9ca3af' }}>All certificates valid</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {upcomingCerts.map(alert => {
              const isExpired  = alert.daysLeft < 0;
              const isCritical = alert.daysLeft >= 0 && alert.daysLeft <= 30;
              const bg     = isExpired ? '#fff5f5' : isCritical ? '#fff7ed' : '#fefce8';
              const border = isExpired ? '1px solid #fecaca' : isCritical ? '1px solid #fed7aa' : '1px solid #fde68a';
              const color  = isExpired ? '#dc2626' : isCritical ? '#ea580c' : '#ca8a04';
              const dotColor = isExpired ? '#ef4444' : isCritical ? '#f97316' : '#eab308';
              return (
                <div key={alert.id} onClick={() => onNavigate('compliance')}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', background: bg, border }}>
                  <div style={{ width: 3, height: 36, borderRadius: 2, background: dotColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{alert.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                      {alert.type === 'vessel' ? '🚢 Vessel' : '👤 Crew'}{alert.assigned_to ? ` · ${alert.assigned_to}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>
                    {isExpired ? `${Math.abs(alert.daysLeft)}d expired` : `${alert.daysLeft}d left`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* URGENT TASKS + LOW STOCK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e5e7eb', padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Urgent maintenance</h2>
            <button onClick={() => onNavigate('maintenance')} style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>{t('dashboard.viewAll')} →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {loading ? [1,2,3].map(i => <div key={i} style={{ height: 52, background: '#f9fafb', borderRadius: 10 }} />) :
            sortedTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <CheckCircle size={36} style={{ color: '#34d399', margin: '0 auto 8px' }} />
                <p style={{ fontSize: 13, color: '#9ca3af' }}>{t('dashboard.allCaughtUp')}</p>
              </div>
            ) : sortedTasks.map(task => {
              const days = calculateDaysUntilDue(task.next_due_date);
              const isOv = days < 0;
              const dept = (task as any).department || 'Engineering';
              const deptColor = DEPT_COLORS[dept]?.hex || '#6b7280';
              return (
                <div key={task.id} onClick={() => onNavigate('maintenance', { taskId: task.id })}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', background: isOv ? '#fff5f5' : '#f9fafb', border: isOv ? '1px solid #fecaca' : '1px solid transparent' }}>
                  <div style={{ width: 3, height: 36, borderRadius: 2, background: deptColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{dept} · {task.category}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isOv ? '#dc2626' : days <= 3 ? '#d97706' : '#2563eb', flexShrink: 0 }}>
                    {isOv ? `${Math.abs(days)}d overdue` : `${days}d`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e5e7eb', padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>{t('dashboard.lowStockAlerts')}</h2>
            <button onClick={() => onNavigate('inventory')} style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>{t('dashboard.viewAll')} →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {loading ? [1,2,3].map(i => <div key={i} style={{ height: 52, background: '#f9fafb', borderRadius: 10 }} />) :
            lowStockItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <Package size={36} style={{ color: '#34d399', margin: '0 auto 8px' }} />
                <p style={{ fontSize: 13, color: '#9ca3af' }}>{t('dashboard.allItemsInStock')}</p>
              </div>
            ) : lowStockItems.slice(0, 4).map(item => {
              const isCrit = item.current_stock === 0;
              const dept = (item as any).department || 'Engineering';
              const deptColor = DEPT_COLORS[dept]?.hex || '#6b7280';
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: isCrit ? '#fff7ed' : '#fefce8', border: `1px solid ${isCrit ? '#fed7aa' : '#fde68a'}` }}>
                  <div style={{ width: 3, height: 36, borderRadius: 2, background: deptColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{dept} · min {item.minimum_stock} {item.unit_of_measure}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isCrit ? '#dc2626' : '#d97706', flexShrink: 0 }}>{item.current_stock} {item.unit_of_measure}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RECENT ACTIVITY */}
      <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e5e7eb', padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>{t('dashboard.recentActivity')}</h2>
          <button onClick={() => onNavigate('history')} style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>{t('dashboard.viewAll')} →</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {loading ? [1,2,3].map(i => <div key={i} style={{ height: 44, background: '#f9fafb', borderRadius: 10 }} />) :
          history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <Activity size={36} style={{ color: '#d1d5db', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13, color: '#9ca3af' }}>{t('dashboard.noRecentActivity')}</p>
            </div>
          ) : history.slice(0, 4).map(record => (
            <div key={record.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircle size={15} style={{ color: '#16a34a' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.task_title}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{record.completed_by_name} · {formatDate(record.completion_date)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   MASTER ADMIN — sin cambios
───────────────────────────────────────────── */
const MasterAdminDashboard: React.FC<{ onNavigate: (page: string, params?: any) => void }> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => { fetchData(); }, []);
  const fetchData = async () => {
    try { setIsLoading(true); const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false }); setCompanies(data || []); }
    catch { showToast('Failed to load customer data', 'error'); } finally { setIsLoading(false); }
  };
  const activeCustomers   = companies.filter(c => c.subscription_status === 'active').length;
  const trialCustomers    = companies.filter(c => c.subscription_status === 'trial').length;
  const inactiveCustomers = companies.filter(c => c.subscription_status === 'inactive').length;
  const retentionPct      = companies.length > 0 ? Math.round((activeCustomers / companies.length) * 100) : 0;
  const kpis = [
    { label: t('dashboard.totalCustomers'), value: companies.length, sub: t('dashboard.allAccounts'), icon: Building2, iconColor: '#38bdf8', iconBg: 'rgba(56,189,248,0.12)', accent: false },
    { label: t('dashboard.activeSubscriptions'), value: activeCustomers, sub: `${trialCustomers} ${t('dashboard.inTrial')}`, icon: CreditCard, iconColor: '#34d399', iconBg: 'rgba(52,211,153,0.12)', accent: false },
    { label: t('dashboard.trialAccounts'), value: trialCustomers, sub: t('dashboard.pendingConversion'), icon: Clock, iconColor: '#fbbf24', iconBg: 'rgba(251,191,36,0.12)', accent: false },
    { label: t('dashboard.inactiveAccounts'), value: inactiveCustomers, sub: t('dashboard.churned'), icon: UsersIcon, iconColor: inactiveCustomers > 0 ? '#f87171' : '#9ca3af', iconBg: inactiveCustomers > 0 ? 'rgba(248,113,113,0.12)' : 'rgba(156,163,175,0.1)', accent: inactiveCustomers > 0 },
  ];
  return (
    <div className="space-y-6 pt-4">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">{t('dashboard.masterTitle')}</h1>
          <p className="text-gray-400 mt-2 text-sm font-medium tracking-wide uppercase" style={{ letterSpacing: '0.08em' }}>{t('dashboard.masterSubtitle')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 100%)', borderRadius: 12, border: '1px solid rgba(56,189,248,0.2)', flexShrink: 0 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d39980' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{t('dashboard.masterAdmin')}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => { const Icon = kpi.icon; return (
          <div key={i} style={{ background: 'white', borderRadius: 16, padding: '20px 22px', border: kpi.accent ? '1.5px solid rgba(248,113,113,0.3)' : '1px solid #e5e7eb', position: 'relative', overflow: 'hidden', transition: 'box-shadow 0.2s, transform 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.09)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}>
            {kpi.accent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#f87171', borderRadius: '16px 16px 0 0' }} />}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: kpi.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={22} style={{ color: kpi.iconColor }} /></div>
              <div style={{ fontSize: 38, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{isLoading ? <span style={{ color: '#d1d5db' }}>—</span> : kpi.value}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{kpi.label}</div>
            <div style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 100, background: '#f3f4f6', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>{kpi.sub}</div>
          </div>
        ); })}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div style={{ gridColumn: 'span 2', background: 'white', borderRadius: 20, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9ca3af' }}>{t('dashboard.recentCustomers')}</span>
            <button onClick={() => onNavigate('customers')} style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>{t('dashboard.viewAllCustomers')} →</button>
          </div>
          <div style={{ padding: '8px 16px 16px' }}>
            {isLoading ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>{[1,2,3].map(i => <div key={i} style={{ height: 56, background: '#f9fafb', borderRadius: 12 }} />)}</div>
            : companies.slice(0, 5).map(c => {
              const name = c.customer_type === 'yacht_owner' ? c.yacht_name : c.name;
              const sc: Record<string, { bg: string; text: string }> = { active: { bg: '#dcfce7', text: '#15803d' }, trial: { bg: '#fef9c3', text: '#854d0e' }, inactive: { bg: '#fee2e2', text: '#991b1b' } };
              const s = sc[c.subscription_status] || sc.inactive;
              return (
                <div key={c.id} onClick={() => onNavigate('customers')}
                  style={{ padding: '12px 14px', borderRadius: 12, cursor: 'pointer', background: '#f9fafb', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#f0f9ff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#f9fafb'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#0ea5e9,#0369a1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Building2 size={15} style={{ color: 'white' }} /></div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.contact_name}</div>
                    </div>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 100, background: s.bg, color: s.text, fontSize: 11, fontWeight: 700 }}>{c.subscription_status.charAt(0).toUpperCase() + c.subscription_status.slice(1)}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'linear-gradient(135deg,#0a1628,#0d1f3c,#081422)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', padding: '20px 22px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}><Activity size={13} style={{ color: 'rgba(56,189,248,0.6)' }} /><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>{t('dashboard.platformInfo')}</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{t('dashboard.platformStatus')}</span><span style={{ padding: '2px 8px', borderRadius: 100, background: 'rgba(52,211,153,0.15)', color: '#34d399', fontSize: 11, fontWeight: 700 }}>● {t('common.operational')}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{t('dashboard.customerRetention')}</span><span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{isLoading ? '—' : `${retentionPct}%`}</span></div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${retentionPct}%`, background: retentionPct >= 80 ? '#34d399' : '#fbbf24', borderRadius: 4, transition: 'width 0.9s' }} /></div>
            </div>
          </div>
          <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e5e7eb', padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><TrendingUp size={13} style={{ color: '#9ca3af' }} /><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9ca3af' }}>{t('dashboard.quickActions')}</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => onNavigate('customers')} style={{ width: '100%', padding: '9px 14px', textAlign: 'left', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('dashboard.addNewCustomer')}</button>
              <button onClick={() => onNavigate('users')} style={{ width: '100%', padding: '9px 14px', textAlign: 'left', background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('dashboard.createUserAccount')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────────── */
const FLEET_MANAGER_ROLES: UserRole[] = ["fleet_manager", "customer_admin"];
const CAPTAIN_ROLES: UserRole[] = ["captain"];

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { currentUser, selectedVesselId } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [tasks, setTasks]           = useState<MaintenanceTask[]>([]);
  const [inventory, setInventory]   = useState<InventoryItem[]>([]);
  const [history, setHistory]       = useState<MaintenanceHistory[]>([]);
  const [vessel, setVessel]         = useState<VesselInfo | null>(null);
  const [compliance, setCompliance] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  const role           = currentUser?.role as UserRole;
  const userDepartment = getRoleDepartment(role);
  const isCaptainView  = CAPTAIN_ROLES.includes(role);

  useEffect(() => {
    if (currentUser?.role === 'master_admin') return;
    loadData();
  }, [currentUser, selectedVesselId]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    if (isDemoUser(currentUser.email)) {
      const invEdits   = JSON.parse(sessionStorage.getItem('demoInventoryEdits') || '{}');
      const taskEdits  = JSON.parse(sessionStorage.getItem('demoTaskEdits') || '{}');
      const mergedInv  = demoInventoryItems.map(i => invEdits[i.id] ? { ...i, ...invEdits[i.id] } : i);
      const mergedTasks= demoMaintenanceTasks.map(t => taskEdits[t.id] ? { ...t, ...taskEdits[t.id] } : t);
      const v = demoVessels.find(v => v.id === selectedVesselId) || demoVessels[0];
      if (v) setVessel({ id: v.id, name: v.name, photo_url: (v as any).photo_url || null });
      if (selectedVesselId) {
        setTasks(mergedTasks.filter(t => t.vessel_id === selectedVesselId) as MaintenanceTask[]);
        setInventory(mergedInv.filter(i => i.vessel_id === selectedVesselId) as InventoryItem[]);
        setHistory(demoMaintenanceHistory.filter(h => h.vessel_id === selectedVesselId) as MaintenanceHistory[]);
      } else {
        setTasks(mergedTasks.filter(t => currentUser.vessel_ids.includes(t.vessel_id)) as MaintenanceTask[]);
        setInventory(mergedInv.filter(i => currentUser.vessel_ids.includes(i.vessel_id)) as InventoryItem[]);
        setHistory(demoMaintenanceHistory.filter(h => currentUser.vessel_ids.includes(h.vessel_id)) as MaintenanceHistory[]);
      }
      setLoading(false);
      return;
    }
    const cid = currentUser.company_id;
    if (!cid) { setLoading(false); return; }
    try {
      const [tasksData, inventoryData, historyData, vessels, complianceData] = await Promise.all([
        fetchByCompany('maintenance_tasks', cid, 'next_due_date', true),
        fetchByCompany('inventory_items', cid, 'created_at', false),
        fetchByCompany('maintenance_history', cid, 'completion_date', false),
        fetchByCompany('vessels', cid, 'name', true),
        fetchByCompany('compliance_items', cid, 'expiry_date', true),
      ]);
      setTasks(tasksData);
      setInventory(inventoryData);
      setHistory(historyData.slice(0, 5));
      setCompliance(complianceData);
      const v = selectedVesselId ? vessels.find((v: any) => v.id === selectedVesselId) : vessels[0];
      if (v) setVessel({ id: v.id, name: v.name, photo_url: v.photo_url || null });
    } catch {
      showToast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (currentUser?.role === 'master_admin') return <MasterAdminDashboard onNavigate={onNavigate} />;
  if (FLEET_MANAGER_ROLES.includes(role)) return <FleetOverview onNavigate={onNavigate} />;

  const filteredTasks     = userDepartment ? tasks.filter(t => (t as any).department === userDepartment) : tasks;
  const filteredInventory = userDepartment ? inventory.filter(i => (i as any).department === userDepartment) : inventory;

  const overdueTasks  = filteredTasks.filter(t => t.status === 'overdue');
  const dueSoonTasks  = filteredTasks.filter(t => t.status === 'due_soon');
  const upcomingTasks = filteredTasks.filter(t => t.status === 'upcoming');
  const lowStockItems = filteredInventory.filter(isLowStock);
  const sortedTasks   = sortTasksByUrgency(filteredTasks.filter(t => t.status !== 'completed')).slice(0, 5);

  const totalTasks       = filteredTasks.length;
  const criticalCount    = overdueTasks.length;
  const dueSoonCount     = dueSoonTasks.filter(t => calculateDaysUntilDue(t.next_due_date) <= 2).length;
  const lowStockCritical = lowStockItems.filter(i => i.current_stock === 0).length;

  const maintenanceHealth = totalTasks > 0 ? Math.round(((totalTasks - overdueTasks.length) / totalTasks) * 100) : 100;
  const inventoryHealth   = filteredInventory.length > 0 ? Math.round(((filteredInventory.length - lowStockItems.length) / filteredInventory.length) * 100) : 100;
  const complianceHealth  = compliance.length > 0
    ? Math.round((compliance.filter(c => getDaysUntilExpiry(c.expiry_date) >= 0).length / compliance.length) * 100)
    : 100;

  const complianceAlerts: ComplianceAlert[] = compliance
    .map(c => ({ id: c.id, name: c.name, expiry_date: c.expiry_date, type: c.type, assigned_to: c.assigned_to, daysLeft: getDaysUntilExpiry(c.expiry_date) }))
    .filter(a => a.daysLeft <= 90)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const overallHealth = Math.round((maintenanceHealth + inventoryHealth + complianceHealth) / 3);

  // CAPTAIN VIEW
  if (isCaptainView) {
    return (
      <CaptainDashboard
        tasks={tasks} inventory={inventory} history={history}
        loading={loading} overallHealth={overallHealth}
        maintenanceHealth={maintenanceHealth} inventoryHealth={inventoryHealth}
        complianceHealth={complianceHealth} complianceAlerts={complianceAlerts}
        vessel={vessel} onNavigate={onNavigate} t={t}
        companyId={currentUser?.company_id || ''}
        currentUser={currentUser}
        selectedVesselId={selectedVesselId}
      />
    );
  }

  // CREW VIEW — sin cambios
  const deptStyle = userDepartment ? DEPT_COLORS[userDepartment] : null;
  const stats = [
    { label: t('dashboard.overdueTasks'), value: overdueTasks.length,  icon: AlertTriangle, iconColor: '#ef4444', iconBg: '#fef2f2', trend: t('common.critical'),        trendColor: '#ef4444', trendBg: '#fef2f2', nav: 'maintenance', accent: overdueTasks.length > 0 },
    { label: t('dashboard.dueSoon'),      value: dueSoonTasks.length,  icon: Clock,         iconColor: '#f59e0b', iconBg: '#fffbeb', trend: 'This week',                  trendColor: '#92400e', trendBg: '#fffbeb', nav: 'maintenance', accent: false },
    { label: t('dashboard.upcoming'),     value: upcomingTasks.length, icon: Calendar,      iconColor: '#3b82f6', iconBg: '#eff6ff', trend: 'Scheduled',                  trendColor: '#1e40af', trendBg: '#eff6ff', nav: 'maintenance', accent: false },
    { label: t('dashboard.lowStockItems'),value: lowStockItems.length, icon: Package,       iconColor: '#f59e0b', iconBg: '#fefce8', trend: t('dashboard.reorderNeeded'), trendColor: '#854d0e', trendBg: '#fefce8', nav: 'inventory',  accent: lowStockItems.length > 0 },
  ];

  return (
    <div className="space-y-6 pt-4">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">{t('dashboard.title')}</h1>
        {userDepartment && deptStyle && (
          <span style={{ padding: '4px 12px', borderRadius: 100, background: deptStyle.bg, color: deptStyle.text, border: `1px solid ${deptStyle.border}`, fontSize: 12, fontWeight: 700 }}>{userDepartment}</span>
        )}
      </div>

      <VesselHeader vessel={vessel} maintenanceHealth={maintenanceHealth} inventoryHealth={inventoryHealth} complianceHealth={complianceHealth} overallHealth={overallHealth} loading={loading} department={userDepartment} />

      {!loading && (criticalCount > 0 || dueSoonCount > 0 || lowStockCritical > 0) && (
        <div style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', borderRadius: 14, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><AlertTriangle size={18} style={{ color: '#fde68a' }} /></div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{t('dashboard.actionRequired')}</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 2 }}>
                {criticalCount > 0    && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}><strong style={{ color: 'white' }}>{criticalCount}</strong> {t('common.critical')}</span>}
                {dueSoonCount > 0     && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}><strong style={{ color: 'white' }}>{dueSoonCount}</strong> {t('dashboard.due48h')}</span>}
                {lowStockCritical > 0 && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}><strong style={{ color: 'white' }}>{lowStockCritical}</strong> {t('dashboard.outStock')}</span>}
              </div>
            </div>
          </div>
          <button onClick={() => onNavigate('maintenance')} style={{ padding: '8px 20px', background: 'white', color: '#dc2626', borderRadius: 10, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>{t('dashboard.resolveNow')}</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => { const Icon = stat.icon; return (
          <div key={i} onClick={() => onNavigate(stat.nav)}
            style={{ background: 'white', borderRadius: 16, padding: '20px 22px', border: stat.accent ? `1.5px solid ${stat.iconColor}30` : '1px solid #e5e7eb', cursor: 'pointer', transition: 'box-shadow 0.2s, transform 0.2s', position: 'relative', overflow: 'hidden' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.09)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}>
            {stat.accent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: stat.iconColor, borderRadius: '16px 16px 0 0' }} />}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: stat.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={22} style={{ color: stat.iconColor }} /></div>
              <div style={{ fontSize: 38, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{loading ? <span style={{ color: '#d1d5db' }}>—</span> : stat.value}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{stat.label}</div>
            <div style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 100, background: stat.trendBg, fontSize: 11, fontWeight: 600, color: stat.trendColor }}>{stat.trend}</div>
          </div>
        ); })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">{t('dashboard.urgentMaintenance')}</h2>
            <button onClick={() => onNavigate('maintenance')} className="text-sm text-blue-600 font-semibold">{t('dashboard.viewAll')}</button>
          </div>
          <div className="space-y-2.5">
            {loading ? [1,2,3].map(i => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />) :
            sortedTasks.length === 0 ? (
              <div className="text-center py-10"><CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" /><p className="text-gray-500 text-sm">{t('dashboard.allCaughtUp')}</p></div>
            ) : sortedTasks.map(task => {
              const days = calculateDaysUntilDue(task.next_due_date);
              const isOv = days < 0; const urg = isOv ? 'overdue' : days <= 3 ? 'soon' : 'ok';
              return (
                <div key={task.id} onClick={() => onNavigate('maintenance', { taskId: task.id })}
                  style={{ padding: '12px 14px', borderRadius: 12, cursor: 'pointer', background: urg === 'overdue' ? '#fff5f5' : '#f9fafb', border: urg === 'overdue' ? '1px solid #fecaca' : '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: urg === 'overdue' ? '#ef4444' : urg === 'soon' ? '#f59e0b' : '#3b82f6', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{task.category}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: urg === 'overdue' ? '#dc2626' : urg === 'soon' ? '#d97706' : '#2563eb', flexShrink: 0 }}>{isOv ? `${Math.abs(days)}d overdue` : `${days}d`}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">{t('dashboard.lowStockAlerts')}</h2>
            <button onClick={() => onNavigate('inventory')} className="text-sm text-blue-600 font-semibold">{t('dashboard.viewAll')}</button>
          </div>
          <div className="space-y-2.5">
            {loading ? [1,2,3].map(i => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />) :
            lowStockItems.length === 0 ? (
              <div className="text-center py-10"><Package className="w-12 h-12 text-emerald-400 mx-auto mb-3" /><p className="text-gray-500 text-sm">{t('dashboard.allItemsInStock')}</p></div>
            ) : lowStockItems.slice(0, 5).map(item => {
              const isCrit = item.current_stock === 0;
              return (
                <div key={item.id} style={{ padding: '12px 14px', borderRadius: 12, background: isCrit ? '#fff7ed' : '#fefce8', border: `1px solid ${isCrit ? '#fed7aa' : '#fde68a'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{item.category}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isCrit ? '#dc2626' : '#d97706' }}>{item.current_stock} {item.unit_of_measure}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>Min: {item.minimum_stock}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{t('dashboard.recentActivity')}</h2>
          <button onClick={() => onNavigate('history')} className="text-sm text-blue-600 font-semibold">{t('dashboard.viewAll')}</button>
        </div>
        <div className="space-y-2.5">
          {loading ? [1,2,3].map(i => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />) :
          history.length === 0 ? (
            <div className="text-center py-10"><Activity className="w-12 h-12 text-gray-200 mx-auto mb-3" /><p className="text-gray-500 text-sm">{t('dashboard.noRecentActivity')}</p></div>
          ) : history.slice(0, 5).map(record => (
            <div key={record.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CheckCircle size={18} style={{ color: '#16a34a' }} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.task_title}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{t('history.completedBy')} {record.completed_by_name} · {formatDate(record.completion_date)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
