import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Trash2, TrendingDown, Fuel, Wrench, Package,
  Anchor, Zap, Droplets, Wifi, Trash, Ship, Shield, MoreHorizontal, Calendar,
  Boxes, AlertCircle, X, FileDown, Building2, Sofa, Settings, ChefHat, Users,
  Clock, AlertTriangle, ShoppingCart
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, fetchByCompany, dbInsert, dbDelete } from '../lib/supabase';
import { demoOperationalExpenses, demoInventoryItems, demoVessels, demoFuelLog, demoMaintenanceHistory } from '../data/demoData';
import { OperationalExpense, OperationalExpenseCategory, OperationalExpenseDepartment, getRoleDepartment, UserRole } from '../types';
import { downloadCSV } from '../utils/helpers';
import { ConfirmModal } from '../components/UI/ConfirmModal';
import { useToast } from '../components/UI/Toast';

const isDemoUser = (email: string) => email === 'admin@yachtmaintenance.pro';

interface CostsProps {
  onNavigate: (page: string, params?: any) => void;
  params?: any;
  departmentFilter?: string;
  controlledPeriod?: { year: number; month: number; isFullYear: boolean };
}
interface VesselOption { id: string; name: string; }
interface SparePartCost { name: string; quantity: number; unit_cost: number; total: number; task_title: string; date: string; vessel_id: string; }
interface FuelCost { resource_name: string; quantity: number; total_cost: number; currency: string; date: string; vessel_id: string; }
interface ServiceCost { task_title: string; amount: number; date: string; vessel_id: string; }
interface InventoryValueItem {
  id: string; name: string; type: string; current_stock: number;
  unit_of_measure: string; unit_cost: number; total_value: number;
  vessel_name: string; department: string;
}

const DEPARTMENTS = [
  { value: 'all',         label: 'All',         icon: null,     color: 'bg-gray-900 text-white', inactive: 'bg-white text-gray-700 border-gray-200' },
  { value: 'Deck',        label: 'Deck',         icon: Anchor,   color: 'bg-blue-600 text-white', inactive: 'bg-white text-blue-700 border-blue-200' },
  { value: 'Interior',    label: 'Interior',     icon: Sofa,     color: 'bg-purple-600 text-white', inactive: 'bg-white text-purple-700 border-purple-200' },
  { value: 'Engineering', label: 'Engineering',  icon: Settings, color: 'bg-orange-500 text-white', inactive: 'bg-white text-orange-700 border-orange-200' },
  { value: 'Galley',      label: 'Galley',       icon: ChefHat,  color: 'bg-green-600 text-white', inactive: 'bg-white text-green-700 border-green-200' },
  { value: 'Safety',      label: 'Safety',       icon: Shield,   color: 'bg-red-600 text-white', inactive: 'bg-white text-red-700 border-red-200' },
];

const EXPENSE_CATEGORIES: { value: OperationalExpenseCategory; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'mooring',       label: 'Mooring / Amarre',      icon: Anchor,        color: 'text-blue-600' },
  { value: 'electricity',   label: 'Electricity',           icon: Zap,           color: 'text-yellow-600' },
  { value: 'water',         label: 'Water',                 icon: Droplets,      color: 'text-cyan-600' },
  { value: 'internet',      label: 'Internet / Connectivity',icon: Wifi,         color: 'text-green-600' },
  { value: 'waste_disposal',label: 'Waste Disposal',        icon: Trash,         color: 'text-orange-600' },
  { value: 'port_fees',     label: 'Port Fees',             icon: Ship,          color: 'text-slate-600' },
  { value: 'insurance',     label: 'Insurance',             icon: Shield,        color: 'text-red-600' },
  { value: 'fuel',          label: 'Fuel',                  icon: Fuel,          color: 'text-amber-600' },
  { value: 'maintenance',   label: 'Maintenance',           icon: Wrench,        color: 'text-orange-700' },
  { value: 'provisions',    label: 'Provisions',            icon: Package,       color: 'text-teal-600' },
  { value: 'day_worker',    label: 'Day Worker',            icon: Users,         color: 'text-indigo-600' },
  { value: 'other',         label: 'Other',                 icon: MoreHorizontal,color: 'text-gray-600' },
];

// ── Categorías filtradas por departamento ────────────────────────────────────
const CATEGORIES_BY_DEPT: Record<string, OperationalExpenseCategory[]> = {
  Deck:        ['mooring', 'port_fees', 'waste_disposal', 'provisions', 'day_worker', 'other'],
  Engineering: ['maintenance', 'fuel', 'electricity', 'water', 'day_worker', 'other'],
  Interior:    ['provisions', 'internet', 'day_worker', 'other'],
  Galley:      ['provisions', 'day_worker', 'other'],
  Safety:      ['insurance', 'maintenance', 'other'],
  General:     ['mooring', 'electricity', 'water', 'internet', 'waste_disposal', 'port_fees', 'insurance', 'fuel', 'maintenance', 'provisions', 'day_worker', 'other'],
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'NOK', 'SEK', 'DKK', 'AUD', 'CAD'];
const PERIOD_OPTIONS = [
  { value: '1m', label: 'Last Month' },
  { value: '3m', label: 'Last 3 Months' },
  { value: '6m', label: 'Last 6 Months' },
  { value: '1y', label: 'Last Year' },
  { value: 'all', label: 'All Time' },
];

function getPeriodStart(period: string): Date | null {
  const now = new Date();
  if (period === '1m') return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  if (period === '3m') return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  if (period === '6m') return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  if (period === '1y') return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  return null;
}
function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

type Tab = 'period' | 'inventory';

export const Costs: React.FC<CostsProps> = ({ onNavigate, params, departmentFilter, controlledPeriod }) => {
  const { currentUser, selectedVesselId } = useAuth();
  const { t } = useLanguage();
  const companyId: string | undefined = params?.companyId;
  const companyName: string | undefined = params?.companyName;

  const role = currentUser?.role as UserRole;
  const isDeptLocked = !!departmentFilter;
  const userDepartment = departmentFilter || getRoleDepartment(role) || null;

  const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
    mooring: t('costs.mooring'), electricity: t('costs.electricity'), water: t('costs.water'),
    internet: t('costs.internet'), waste_disposal: t('costs.wasteDisposal'), port_fees: t('costs.portFees'),
    insurance: t('costs.insurance'), fuel: 'Fuel', maintenance: 'Maintenance', provisions: 'Provisions',
    crew_expenses: 'Crew Expenses', crew_salary: 'Crew Salaries', repairs: 'Repairs', communications: 'Communications',
    entertainment: 'Entertainment', transport: 'Transport', day_worker: 'Day Worker',
    other: t('costs.otherExpense'),
  };

  const [tab, setTab] = useState<Tab>('period');
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const selectedVessel: string = (!selectedVesselId || selectedVesselId === 'all') ? 'all' : selectedVesselId;
  const [period, setPeriod] = useState('3m');
  const [filterDepartment, setFilterDepartment] = useState<string>(departmentFilter || 'all');
  const [sparePartCosts, setSparePartCosts] = useState<SparePartCost[]>([]);
  const [fuelCosts, setFuelCosts] = useState<FuelCost[]>([]);
  const [serviceCosts, setServiceCosts] = useState<ServiceCost[]>([]);
  const [opExpenses, setOpExpenses] = useState<OperationalExpense[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryValueItem[]>([]);
  const [itemsWithoutCost, setItemsWithoutCost] = useState(0);
  const { showToast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) loadAll();
  }, [currentUser, selectedVesselId, period, companyId]);

  const getEffectiveCompanyId = () => companyId || currentUser?.company_id || null;

  const loadAll = async () => {
    if (!currentUser) return;
    setLoading(true);
    if (isDemoUser(currentUser.email)) {
      const invEdits = JSON.parse(sessionStorage.getItem('demoInventoryEdits') || '{}');
      const mergedInventory = demoInventoryItems.map(i => invEdits[i.id] ? { ...i, ...invEdits[i.id] } : i);
      const opEdits = JSON.parse(sessionStorage.getItem('demoOpExpenseEdits') || '{}');
      const deletedOp = JSON.parse(sessionStorage.getItem('demoOpExpenseDeleted') || '[]');
      const addedOp = JSON.parse(sessionStorage.getItem('demoOpExpenseAdded') || '[]');
      let mergedOp = [...demoOperationalExpenses.map(e => opEdits[e.id] ? { ...e, ...opEdits[e.id] } : e), ...addedOp].filter(e => !deletedOp.includes(e.id));
      const userVessels = currentUser.role === 'master_admin' ? demoVessels : demoVessels.filter(v => currentUser.vessel_ids.includes(v.id));
      setVessels(userVessels.map(v => ({ id: v.id, name: v.name })));
      const vesselFilter = (id: string) => selectedVessel === 'all' ? (currentUser.role === 'master_admin' || currentUser.vessel_ids.includes(id)) : id === selectedVessel;
      const periodStart = getPeriodStart(period);
      const afterPeriod = (date: string) => !periodStart || new Date(date) >= periodStart;
      const filteredInv = mergedInventory.filter(i => vesselFilter(i.vessel_id) && i.unit_cost && i.unit_cost > 0);
      setItemsWithoutCost(mergedInventory.filter(i => vesselFilter(i.vessel_id)).length - filteredInv.length);
      setInventoryItems(filteredInv.map(i => ({
        id: i.id, name: i.name, type: i.type, current_stock: i.current_stock,
        unit_of_measure: i.unit_of_measure, unit_cost: i.unit_cost!, total_value: i.unit_cost! * i.current_stock,
        vessel_name: userVessels.find(v => v.id === i.vessel_id)?.name || '—',
        department: (i as any).department || 'Engineering',
      })));
      setOpExpenses(mergedOp.filter(e => vesselFilter(e.vessel_id) && afterPeriod(e.expense_date)) as OperationalExpense[]);
      const fuelEntries = demoFuelLog.filter(l => l.entry_type === 'refill' && l.total_cost && vesselFilter(l.vessel_id) && afterPeriod(l.log_date));
      setFuelCosts(fuelEntries.map(l => ({ resource_name: l.resource_id, quantity: l.quantity, total_cost: l.total_cost || 0, currency: l.currency, date: l.log_date, vessel_id: l.vessel_id })));
      const histEntries = demoMaintenanceHistory.filter(h => vesselFilter(h.vessel_id) && afterPeriod(h.completion_date));
      setServiceCosts(histEntries.filter(h => h.external_service_cost && h.external_service_cost > 0).map(h => ({ task_title: h.task_title, amount: h.external_service_cost!, date: h.completion_date, vessel_id: h.vessel_id })));
      setSparePartCosts([]);
      setLoading(false);
      return;
    }
    await Promise.all([loadVessels(), loadPeriodCosts(), loadInventoryValue()]);
    setLoading(false);
  };

  const loadVessels = async () => {
    const effectiveCompanyId = getEffectiveCompanyId();
    if (!effectiveCompanyId) return;
    const data = await fetchByCompany('vessels', effectiveCompanyId, 'name', true);
    setVessels(data);
  };

  const loadPeriodCosts = async () => {
    const periodStart = getPeriodStart(period);
    await Promise.all([loadFuelCosts(periodStart), loadMaintenanceCosts(periodStart), loadOpExpenses(periodStart)]);
  };

  const loadFuelCosts = async (periodStart: Date | null) => {
    const effectiveCompanyId = getEffectiveCompanyId();
    if (!effectiveCompanyId) return;
    const periodStr = periodStart ? periodStart.toISOString().split('T')[0] : null;
    const allFuelLog = await fetchByCompany('fuel_log', effectiveCompanyId, 'log_date', false);
    const allResources = await fetchByCompany('fuel_resources', effectiveCompanyId, 'name', true);
    const resMap: Record<string, string> = {};
    allResources.forEach((r: any) => { resMap[r.id] = r.name; });
    const filtered = allFuelLog.filter((r: any) =>
      r.entry_type === 'refill' && r.total_cost != null &&
      (selectedVessel === 'all' || r.vessel_id === selectedVessel) &&
      (!periodStr || r.log_date >= periodStr)
    );
    setFuelCosts(filtered.map((r: any) => ({ resource_name: resMap[r.resource_id] || 'Unknown resource', quantity: r.quantity, total_cost: r.total_cost, currency: r.currency || 'USD', date: r.log_date, vessel_id: r.vessel_id })));
  };

  const loadMaintenanceCosts = async (periodStart: Date | null) => {
    const effectiveCompanyId = getEffectiveCompanyId();
    if (!effectiveCompanyId) return;
    const periodStr = periodStart ? periodStart.toISOString().split('T')[0] : null;
    const allHistory = await fetchByCompany('maintenance_history', effectiveCompanyId, 'completion_date', false);
    const histData = allHistory.filter((h: any) =>
      (selectedVessel === 'all' || h.vessel_id === selectedVessel) && (!periodStr || h.completion_date >= periodStr)
    );
    const partCosts: SparePartCost[] = [];
    const svcCosts: ServiceCost[] = [];
    for (const hist of (histData || [])) {
      if (hist.external_service_cost && hist.external_service_cost > 0) {
        svcCosts.push({ task_title: hist.task_title, amount: hist.external_service_cost, date: hist.completion_date, vessel_id: hist.vessel_id });
      }
      if (!hist.parts_used || hist.parts_used.length === 0) continue;
      const partIds = hist.parts_used.map((p: any) => p.inventory_id);
      const { data: invData } = await supabase.from('inventory_items').select('id, name, unit_cost').in('id', partIds);
      const invMap: Record<string, { name: string; unit_cost: number | null }> = {};
      for (const inv of (invData || [])) invMap[inv.id] = inv;
      for (const part of hist.parts_used) {
        const inv = invMap[part.inventory_id];
        if (!inv || inv.unit_cost === null) continue;
        partCosts.push({ name: inv.name, quantity: part.quantity, unit_cost: inv.unit_cost, total: inv.unit_cost * part.quantity, task_title: hist.task_title, date: hist.completion_date, vessel_id: hist.vessel_id });
      }
    }
    setSparePartCosts(partCosts);
    setServiceCosts(svcCosts);
  };

  const loadOpExpenses = async (periodStart: Date | null) => {
    const effectiveCompanyId = getEffectiveCompanyId();
    if (!effectiveCompanyId) return;
    const periodStr = periodStart ? periodStart.toISOString().split('T')[0] : null;
    const all = await fetchByCompany('operational_expenses', effectiveCompanyId, 'expense_date', false);
    setOpExpenses(all.filter((e: any) =>
      (selectedVessel === 'all' || e.vessel_id === selectedVessel) &&
      (!periodStr || e.expense_date >= periodStr)
    ));
  };

  const loadInventoryValue = async () => {
    const effectiveCompanyId = getEffectiveCompanyId();
    if (!effectiveCompanyId) return;
    const allVessels = await fetchByCompany('vessels', effectiveCompanyId, 'name', true);
    const vesselMap: Record<string, string> = {};
    allVessels.forEach((v: any) => { vesselMap[v.id] = v.name; });
    const all = await fetchByCompany('inventory_items', effectiveCompanyId, 'name', true);
    const filtered = all.filter((i: any) => selectedVessel === 'all' || i.vessel_id === selectedVessel);
    const withCost = filtered.filter((i: any) => i.unit_cost !== null && i.unit_cost > 0);
    setItemsWithoutCost(filtered.length - withCost.length);
    setInventoryItems(withCost.map((i: any) => ({
      id: i.id, name: i.name, type: i.type, current_stock: i.current_stock,
      unit_of_measure: i.unit_of_measure, unit_cost: i.unit_cost,
      total_value: i.unit_cost * i.current_stock,
      vessel_name: vesselMap[i.vessel_id] || '—',
      department: i.department || 'Engineering',
    })));
  };

  const handleDeleteExpense = async (id: string) => {
    if (isDemoUser(currentUser?.email || '')) {
      const deleted = JSON.parse(sessionStorage.getItem('demoOpExpenseDeleted') || '[]');
      deleted.push(id);
      sessionStorage.setItem('demoOpExpenseDeleted', JSON.stringify(deleted));
      const added = JSON.parse(sessionStorage.getItem('demoOpExpenseAdded') || '[]');
      sessionStorage.setItem('demoOpExpenseAdded', JSON.stringify(added.filter((e: any) => e.id !== id)));
      setOpExpenses(prev => prev.filter(e => e.id !== id));
      setConfirmDeleteId(null);
      showToast('Expense deleted', 'success');
      return;
    }
    setDeletingId(id);
    try {
      await dbDelete('operational_expenses', id);
      setOpExpenses(prev => prev.filter(e => e.id !== id));
      showToast('Expense deleted', 'success');
    } catch {
      showToast('Failed to delete expense', 'error');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  // ── Solo mostrar gastos aprobados en los totales ──────────────────────────
  const approvedExpenses = opExpenses.filter(e => (e as any).status !== 'pending_approval');
  const pendingExpenses  = opExpenses.filter(e => (e as any).status === 'pending_approval');

  const filteredOpExpenses = isDeptLocked
    ? approvedExpenses.filter(e => e.department === departmentFilter || e.department === 'General')
    : approvedExpenses;

  const filteredPendingExpenses = isDeptLocked
    ? pendingExpenses.filter(e => e.department === departmentFilter || e.department === 'General')
    : pendingExpenses;

  const totalFuel    = isDeptLocked ? 0 : fuelCosts.reduce((s, r) => s + r.total_cost, 0);
  const totalParts   = sparePartCosts.reduce((s, r) => s + r.total, 0);
  const totalService = isDeptLocked ? 0 : serviceCosts.reduce((s, r) => s + r.amount, 0);
  const totalOp      = filteredOpExpenses.reduce((s, r) => s + r.amount, 0);
  const grandTotal   = totalFuel + totalParts + totalService + totalOp;

  const getVesselName = (id: string) => vessels.find(v => v.id === id)?.name || '—';
  const showFleetBreakdown = selectedVessel === 'all' && vessels.length > 1;

  const vesselTotals = () => {
    const map: Record<string, number> = {};
    filteredOpExpenses.forEach(e => { map[e.vessel_id] = (map[e.vessel_id] || 0) + e.amount; });
    if (!isDeptLocked) {
      fuelCosts.forEach(r => { if (r.vessel_id) map[r.vessel_id] = (map[r.vessel_id] || 0) + r.total_cost; });
      serviceCosts.forEach(r => { if (r.vessel_id) map[r.vessel_id] = (map[r.vessel_id] || 0) + r.amount; });
    }
    sparePartCosts.forEach(r => { if (r.vessel_id) map[r.vessel_id] = (map[r.vessel_id] || 0) + r.total; });
    return Object.entries(map)
      .map(([id, total]) => ({ id, name: getVesselName(id), total }))
      .sort((a, b) => b.total - a.total);
  };

  const filteredInventory = filterDepartment === 'all'
    ? inventoryItems
    : inventoryItems.filter(i => i.department === filterDepartment);
  const totalInventoryValue = filteredInventory.reduce((s, i) => s + i.total_value, 0);
  const sparesValue         = filteredInventory.filter(i => i.type === 'spare_part').reduce((s, i) => s + i.total_value, 0);
  const consumablesValue    = filteredInventory.filter(i => i.type === 'consumable').reduce((s, i) => s + i.total_value, 0);
  const deptCounts = DEPARTMENTS.filter(d => d.value !== 'all').reduce((acc, d) => {
    acc[d.value] = inventoryItems.filter(i => i.department === d.value).length;
    return acc;
  }, {} as Record<string, number>);

  const dateStr = new Date().toISOString().slice(0, 10);

  const handleExportPeriodCSV = () => {
    const rows: string[][] = [['Vessel', 'Category', 'Description', 'Department', 'Date', 'Amount', 'Currency']];
    for (const r of filteredOpExpenses) rows.push([getVesselName(r.vessel_id), 'Operational', r.description || r.category, r.department || 'General', r.expense_date, String(r.amount), r.currency]);
    if (!isDeptLocked) {
      for (const r of fuelCosts) rows.push([getVesselName(r.vessel_id), 'Fuel', r.resource_name, 'Engineering', r.date, String(r.total_cost), r.currency]);
      for (const r of serviceCosts) rows.push([getVesselName(r.vessel_id), 'External Service', r.task_title, 'Engineering', r.date, String(r.amount), 'USD']);
    }
    for (const r of sparePartCosts) rows.push([getVesselName(r.vessel_id), 'Spare Parts', `${r.name} × ${r.quantity} (${r.task_title})`, '', r.date, String(r.total), 'USD']);
    downloadCSV(rows, `costs-${departmentFilter || 'all'}-${dateStr}.csv`);
  };

  const handleExportInventoryCSV = () => {
    const rows: string[][] = [['Name', 'Type', 'Department', 'Vessel', 'Stock', 'Unit', 'Unit Cost (USD)', 'Total Value (USD)']];
    [...filteredInventory].sort((a, b) => b.total_value - a.total_value).forEach(i =>
      rows.push([i.name, i.type, i.department, i.vessel_name, String(i.current_stock), i.unit_of_measure, String(i.unit_cost), String(i.total_value)])
    );
    downloadCSV(rows, `inventory-value-${filterDepartment}-${dateStr}.csv`);
  };

  return (
    <div className="space-y-8">
      {companyId && (
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('customers')} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
            <Building2 className="w-4 h-4" />Back to Customers
          </button>
          <span className="text-gray-400">/</span>
          <span className="text-sm font-medium text-gray-900">{companyName || 'Customer'} — Costs</span>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            {companyId && companyName ? `${companyName} — ${t('costs.title')}` : t('costs.title')}
            {isDeptLocked && <span className="ml-3 text-lg font-semibold text-blue-600">· {departmentFilter}</span>}
          </h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">{t('costs.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
          {tab === 'period' && grandTotal > 0 && (
            <button onClick={handleExportPeriodCSV} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all text-sm">
              <FileDown className="w-4 h-4" />CSV
            </button>
          )}
          {tab === 'inventory' && filteredInventory.length > 0 && (
            <button onClick={handleExportInventoryCSV} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all text-sm">
              <FileDown className="w-4 h-4" />CSV {filterDepartment !== 'all' && `— ${filterDepartment}`}
            </button>
          )}
          {tab === 'period' && (
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />{t('costs.addExpense')}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
        <button onClick={() => setTab('period')} className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === 'period' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          {t('costs.periodCosts')}
        </button>
        <button onClick={() => setTab('inventory')} className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === 'inventory' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          {t('costs.inventoryValue')}
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        {tab === 'period' && (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select value={period} onChange={e => setPeriod(e.target.value)} className="text-sm font-medium text-gray-700 bg-transparent outline-none">
              {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {tab === 'period' && (
        <div className="space-y-8">
          {isDeptLocked && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
              <DollarSign className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <p className="text-sm text-blue-700 font-medium">
                Showing expenses for <strong>{departmentFilter}</strong> department only.
              </p>
            </div>
          )}

          {/* ── PENDING APPROVAL BANNER ── */}
          {filteredPendingExpenses.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-amber-900">
                  {filteredPendingExpenses.length} expense{filteredPendingExpenses.length > 1 ? 's' : ''} pending approval
                </h3>
              </div>
              <p className="text-xs text-amber-700 mb-3">These expenses are not included in the totals until approved.</p>
              <div className="space-y-2">
                {filteredPendingExpenses.map(exp => {
                  const cat = EXPENSE_CATEGORIES.find(c => c.value === exp.category);
                  const Icon = cat?.icon || MoreHorizontal;
                  return (
                    <div key={exp.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-amber-100">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Icon className={`w-4 h-4 ${cat?.color || 'text-gray-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{exp.description || exp.category}</p>
                        <p className="text-xs text-gray-500">{(exp as any).requested_by_name || 'Unknown'} · {fmtDate(exp.expense_date)}</p>
                      </div>
                      <span className="text-sm font-bold text-amber-700">{formatCurrency(exp.amount, exp.currency)}</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-1 bg-amber-100 text-amber-700 rounded-full">Pending</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {!isDeptLocked && <SummaryCard label={t('costs.fuelFluids')} amount={totalFuel} icon={Fuel} colorClass="text-amber-600" bgClass="bg-amber-50" />}
            <SummaryCard label={t('costs.partsUsed')} amount={totalParts} icon={Package} colorClass="text-blue-600" bgClass="bg-blue-50" />
            {!isDeptLocked && <SummaryCard label={t('costs.externalService')} amount={totalService} icon={Wrench} colorClass="text-orange-600" bgClass="bg-orange-50" />}
            <SummaryCard label={t('costs.operational')} amount={totalOp} icon={DollarSign} colorClass="text-green-600" bgClass="bg-green-50" />
          </div>
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 flex items-center justify-between text-white">
            <div>
              <p className="text-gray-400 text-sm font-medium">{t('costs.totalPeriodCost')}</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(grandTotal)}</p>
              {filteredPendingExpenses.length > 0 && (
                <p className="text-xs text-amber-400 mt-1">
                  + {formatCurrency(filteredPendingExpenses.reduce((s, e) => s + e.amount, 0))} pending approval
                </p>
              )}
            </div>
            <TrendingDown className="w-12 h-12 text-gray-600" />
          </div>

          {showFleetBreakdown && (
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-4">Cost by Vessel</h2>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {vesselTotals().map(v => {
                    const pct = grandTotal > 0 ? Math.round((v.total / grandTotal) * 100) : 0;
                    return (
                      <div key={v.id} className="px-5 py-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-900">{v.name}</span>
                          <span className="text-sm font-bold text-gray-900">{formatCurrency(v.total)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div style={{ width: `${pct}%` }} className="h-full bg-blue-500 rounded-full transition-all duration-700" />
                          </div>
                          <span className="text-xs text-gray-400 font-semibold w-10 text-right">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{t('costs.operationalExpenses')}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{t('costs.opExpensesHint')}</p>
              </div>
              <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors">
                <Plus className="w-4 h-4" />{t('common.add')}
              </button>
            </div>
            {filteredOpExpenses.length === 0 ? (
              <EmptyState icon={DollarSign} title={t('costs.noOpExpenses')} subtitle={t('costs.opExpensesHint')} addLabel={t('costs.addFirstEntry')} onAdd={() => setShowAddModal(true)} />
            ) : (
              <CostTableWithDelete
                rows={filteredOpExpenses.map(exp => {
                  const cat = EXPENSE_CATEGORIES.find(c => c.value === exp.category);
                  const Icon = cat?.icon || MoreHorizontal;
                  const catLabel = EXPENSE_CATEGORY_LABELS[exp.category] || exp.category;
                  const vesselTag = showFleetBreakdown ? `${getVesselName(exp.vessel_id)} · ` : '';
                  return { label: exp.description || catLabel, sub: `${vesselTag}${catLabel} · ${exp.department || 'General'} · ${fmtDate(exp.expense_date)}`, amount: exp.amount, currency: exp.currency, icon: <Icon className={`w-5 h-5 ${cat?.color || 'text-gray-500'}`} />, iconBg: 'bg-gray-100', id: exp.id };
                })}
                total={totalOp}
                onDelete={(id) => setConfirmDeleteId(id)}
              />
            )}
          </section>

          {!isDeptLocked && fuelCosts.length > 0 && (
            <section>
              <div className="mb-4"><h2 className="text-lg font-bold text-gray-900">{t('costs.fuelCostsTitle')}</h2></div>
              <CostTable rows={fuelCosts.map(r => ({ label: r.resource_name, sub: showFleetBreakdown ? `${getVesselName(r.vessel_id)} · ${fmtDate(r.date)}` : fmtDate(r.date), amount: r.total_cost, currency: r.currency, icon: <Fuel className="w-5 h-5 text-amber-600" />, iconBg: 'bg-amber-50' }))} total={totalFuel} />
            </section>
          )}
          {sparePartCosts.length > 0 && (
            <section>
              <div className="mb-4"><h2 className="text-lg font-bold text-gray-900">{t('costs.partsConsumedTitle')}</h2></div>
              <CostTable rows={sparePartCosts.map(r => ({ label: r.name, sub: `${showFleetBreakdown ? getVesselName(r.vessel_id) + ' · ' : ''}${r.quantity} × ${formatCurrency(r.unit_cost)} · ${r.task_title} · ${fmtDate(r.date)}`, amount: r.total, currency: 'USD', icon: <Package className="w-5 h-5 text-blue-600" />, iconBg: 'bg-blue-50' }))} total={totalParts} />
            </section>
          )}
          {!isDeptLocked && serviceCosts.length > 0 && (
            <section>
              <div className="mb-4"><h2 className="text-lg font-bold text-gray-900">{t('costs.externalServiceTitle')}</h2></div>
              <CostTable rows={serviceCosts.map(r => ({ label: r.task_title, sub: showFleetBreakdown ? `${getVesselName(r.vessel_id)} · ${fmtDate(r.date)}` : fmtDate(r.date), amount: r.amount, currency: 'USD', icon: <Wrench className="w-5 h-5 text-orange-600" />, iconBg: 'bg-orange-50' }))} total={totalService} />
            </section>
          )}
          {grandTotal === 0 && filteredPendingExpenses.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">{t('costs.noCostsRecorded')}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'inventory' && (
        <div className="space-y-6">
          {!isDeptLocked && (
            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.map(dept => {
                const Icon = dept.icon;
                const count = dept.value === 'all' ? inventoryItems.length : deptCounts[dept.value] || 0;
                const isActive = filterDepartment === dept.value;
                return (
                  <button key={dept.value} onClick={() => setFilterDepartment(dept.value)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-sm transition-all ${isActive ? dept.color : dept.inactive + ' border'}`}>
                    {Icon && <Icon className="w-4 h-4" />}
                    {dept.label}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/20' : 'bg-gray-100'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard label={t('costs.totalStockValue')} amount={totalInventoryValue} icon={Boxes} colorClass="text-teal-600" bgClass="bg-teal-50" />
            <SummaryCard label={t('costs.spareParts')} amount={sparesValue} icon={Package} colorClass="text-blue-600" bgClass="bg-blue-50" />
            <SummaryCard label={t('costs.consumables')} amount={consumablesValue} icon={Fuel} colorClass="text-amber-600" bgClass="bg-amber-50" />
          </div>
          <div className="bg-gradient-to-r from-teal-900 to-teal-800 rounded-2xl p-6 flex items-center justify-between text-white">
            <div>
              <p className="text-teal-300 text-sm font-medium">
                {filterDepartment === 'all' ? t('costs.totalInventoryValue') : `${filterDepartment} Department — Total Value`}
              </p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(totalInventoryValue)}</p>
              <p className="text-teal-400 text-xs mt-1.5">{filteredInventory.length} {t('costs.itemsWithUnitCost')}</p>
            </div>
            <Boxes className="w-12 h-12 text-teal-700" />
          </div>
          {itemsWithoutCost > 0 && filterDepartment === 'all' && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                <span className="font-semibold">{itemsWithoutCost} item{itemsWithoutCost > 1 ? 's' : ''}</span> without a unit cost are excluded from this valuation.
              </p>
            </div>
          )}
          {filteredInventory.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Boxes className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">{t('costs.noInventoryWithCost')}</p>
            </div>
          ) : (
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-4">{t('costs.itemsByValue')}</h2>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <div className="col-span-4">{t('common.name')}</div>
                  {!isDeptLocked && <div className="col-span-2">Department</div>}
                  <div className={`${isDeptLocked ? 'col-span-3' : 'col-span-2'} text-right`}>{t('costs.unitCost')}</div>
                  <div className={`${isDeptLocked ? 'col-span-3' : 'col-span-2'} text-right`}>{t('costs.stock')}</div>
                  <div className="col-span-2 text-right">{t('costs.total')}</div>
                </div>
                <div className="divide-y divide-gray-100">
                  {[...filteredInventory].sort((a, b) => b.total_value - a.total_value).map(item => {
                    const deptColors: Record<string, string> = {
                      Deck: 'bg-blue-100 text-blue-700', Interior: 'bg-purple-100 text-purple-700',
                      Engineering: 'bg-orange-100 text-orange-700', Galley: 'bg-green-100 text-green-700',
                      Safety: 'bg-red-100 text-red-700',
                    };
                    return (
                      <div key={item.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-gray-50 transition-colors">
                        <div className="col-span-8 sm:col-span-4 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${item.type === 'spare_part' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                            {item.type === 'spare_part' ? t('costs.sparePart') : t('costs.consumable')}
                          </span>
                        </div>
                        {!isDeptLocked && (
                          <div className="hidden sm:block col-span-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${deptColors[item.department] || 'bg-gray-100 text-gray-600'}`}>{item.department}</span>
                          </div>
                        )}
                        <div className={`hidden sm:block ${isDeptLocked ? 'col-span-3' : 'col-span-2'} text-right text-sm text-gray-600`}>{formatCurrency(item.unit_cost)}</div>
                        <div className={`hidden sm:block ${isDeptLocked ? 'col-span-3' : 'col-span-2'} text-right text-sm text-gray-600`}>{item.current_stock} {item.unit_of_measure}</div>
                        <div className="col-span-4 sm:col-span-2 text-right">
                          <span className="text-sm font-bold text-gray-900">{formatCurrency(item.total_value)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-sm text-gray-500 font-medium">Total {filterDepartment !== 'all' && `— ${filterDepartment}`}</span>
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(totalInventoryValue)}</span>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {showAddModal && (
        <AddExpenseModal
          vessels={vessels}
          companyId={currentUser?.company_id || ''}
          defaultDepartment={userDepartment as OperationalExpenseDepartment | null}
          onClose={() => setShowAddModal(false)}
          onNavigate={onNavigate}
          onSaved={(result?: string) => {
            setShowAddModal(false);
            if (currentUser) {
              if (isDemoUser(currentUser.email)) loadAll();
              else loadOpExpenses(getPeriodStart(period));
            }
            if (result === 'pending') {
              showToast('Expense submitted for approval', 'info');
            } else {
              showToast('Expense added', 'success');
            }
          }}
        />
      )}
      {confirmDeleteId && (
        <ConfirmModal
          title="Delete Expense" message="This will permanently remove this expense record."
          confirmLabel="Delete" onConfirm={() => handleDeleteExpense(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)} isLoading={deletingId === confirmDeleteId}
        />
      )}
    </div>
  );
};

// ── Sub-components ───────────────────────────────────────────────────────────
const SummaryCard: React.FC<{ label: string; amount: number; icon: React.ElementType; colorClass: string; bgClass: string }> = ({ label, amount, icon: Icon, colorClass, bgClass }) => (
  <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.09)] hover:-translate-y-0.5 transition-all">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${bgClass}`}><Icon className={`w-5 h-5 ${colorClass}`} /></div>
    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.08em]">{label}</p>
    <p className="text-xl font-bold text-gray-900 mt-1.5">{formatCurrency(amount)}</p>
  </div>
);

const EmptyState: React.FC<{ icon: React.ElementType; title: string; subtitle: string; onAdd: () => void; addLabel?: string }> = ({ icon: Icon, title, subtitle, onAdd, addLabel }) => (
  <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
    <Icon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
    <p className="text-sm font-semibold text-gray-500">{title}</p>
    <p className="text-xs text-gray-400 mt-1 mb-4">{subtitle}</p>
    <button onClick={onAdd} className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:underline"><Plus className="w-4 h-4" />{addLabel || title}</button>
  </div>
);

interface CostRow { label: string; sub: string; amount: number; currency: string; icon: React.ReactNode; iconBg: string; }
const CostTable: React.FC<{ rows: CostRow[]; total: number }> = ({ rows, total }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
    <div className="divide-y divide-gray-100">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${row.iconBg}`}>{row.icon}</div>
          <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 truncate">{row.label}</p><p className="text-xs text-gray-500 mt-0.5 truncate">{row.sub}</p></div>
          <p className="text-sm font-bold text-gray-900 shrink-0">{formatCurrency(row.amount, row.currency)}</p>
        </div>
      ))}
    </div>
    <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
      <span className="text-sm text-gray-500 font-medium">Total</span>
      <span className="text-sm font-bold text-gray-900">{formatCurrency(total)}</span>
    </div>
  </div>
);

interface CostRowWithDelete extends CostRow { id: string; }
const CostTableWithDelete: React.FC<{ rows: CostRowWithDelete[]; total: number; onDelete: (id: string) => void }> = ({ rows, total, onDelete }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
    <div className="divide-y divide-gray-100">
      {rows.map(row => (
        <div key={row.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${row.iconBg}`}>{row.icon}</div>
          <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 truncate">{row.label}</p><p className="text-xs text-gray-500 mt-0.5 truncate">{row.sub}</p></div>
          <p className="text-sm font-bold text-gray-900 shrink-0">{formatCurrency(row.amount, row.currency)}</p>
          <button onClick={() => onDelete(row.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
    </div>
    <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
      <span className="text-sm text-gray-500 font-medium">Total</span>
      <span className="text-sm font-bold text-gray-900">{formatCurrency(total)}</span>
    </div>
  </div>
);

// ── AddExpenseModal — con categorías por dept, campo libre en Other,
//    y verificación de threshold ────────────────────────────────────────────
const AddExpenseModal: React.FC<{
  vessels: VesselOption[];
  companyId: string;
  defaultDepartment?: OperationalExpenseDepartment | null;
  onClose: () => void;
  onSaved: (result?: string) => void;
  onNavigate: (page: string, params?: any) => void;
}> = ({ vessels, companyId, defaultDepartment, onClose, onSaved, onNavigate }) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [thresholdBlock, setThresholdBlock] = useState<{ threshold: number; amount: number } | null>(null);

  const DEPT_OPTIONS: OperationalExpenseDepartment[] = ['Engineering', 'Deck', 'Interior', 'Galley', 'Safety', 'General'];

  const [form, setForm] = useState({
    vessel_id:    vessels.length === 1 ? vessels[0].id : '',
    category:     'mooring' as OperationalExpenseCategory,
    description:  '',
    amount:       '',
    currency:     'USD',
    expense_date: new Date().toISOString().split('T')[0],
    department:   defaultDepartment || 'General' as OperationalExpenseDepartment,
  });

  // Categorías filtradas según el departamento seleccionado
  const availableCategories = EXPENSE_CATEGORIES.filter(cat =>
    (CATEGORIES_BY_DEPT[form.department] || CATEGORIES_BY_DEPT.General).includes(cat.value)
  );

  // Reset categoría si no está disponible en el nuevo dept
  useEffect(() => {
    const available = CATEGORIES_BY_DEPT[form.department] || CATEGORIES_BY_DEPT.General;
    if (!available.includes(form.category)) {
      setForm(prev => ({ ...prev, category: available[0] }));
    }
  }, [form.department]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !form.vessel_id || !form.amount) return;
    setSaving(true);

    // ── Demo path ──────────────────────────────────────────────────────────
    if (isDemoUser(currentUser.email)) {
      const newExpense = {
        id: `demo-op-${Date.now()}`,
        vessel_id: form.vessel_id, company_id: companyId,
        category: form.category,
        description: form.category === 'other' && customCategory ? customCategory : form.description,
        amount: parseFloat(form.amount), currency: form.currency,
        expense_date: form.expense_date, department: form.department,
        created_by: currentUser.id, created_at: new Date().toISOString(),
        status: 'approved',
      };
      const added = JSON.parse(sessionStorage.getItem('demoOpExpenseAdded') || '[]');
      added.push(newExpense);
      sessionStorage.setItem('demoOpExpenseAdded', JSON.stringify(added));
      setSaving(false);
      onSaved('approved');
      return;
    }

    try {
      // ── Verificar threshold — si supera, bloquear y pedir PR ─────────
      const { data: vesselData } = await supabase
        .from('vessels')
        .select('requires_approval, approval_chain')
        .eq('id', form.vessel_id)
        .single();

      const amount = parseFloat(form.amount);

      if (vesselData?.requires_approval) {
        const { data: thresholdData } = await supabase
          .from('vessel_approval_thresholds')
          .select('threshold')
          .eq('vessel_id', form.vessel_id)
          .eq('category', form.category)
          .maybeSingle();

        const threshold = thresholdData?.threshold;
        const needsPR =
          threshold !== null &&
          threshold !== undefined &&
          amount >= threshold;

        if (needsPR) {
          setThresholdBlock({ threshold, amount });
          setSaving(false);
          return;
        }
      }

      // ── Guardar (bajo el umbral, aprobado directo) ────────────────────
      await dbInsert('operational_expenses', {
        vessel_id:          form.vessel_id,
        company_id:         companyId,
        category:           form.category,
        description:        form.category === 'other' && customCategory
                              ? customCategory
                              : form.description,
        amount,
        currency:           form.currency,
        expense_date:       form.expense_date,
        department:         form.department,
        created_by:         currentUser.id,
        status:             'approved',
        requested_by:       currentUser.id,
        requested_by_name:  currentUser.full_name,
      });

      onSaved('approved');

    } catch (err) {
      console.error('AddExpenseModal error:', err);
      showToast('Error saving expense. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{t('costs.addExpenseTitle')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        {thresholdBlock && (
          <div className="p-6 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800">Amount exceeds approval threshold</p>
                <p className="text-sm text-amber-700 mt-1">
                  This expense of <strong>{form.currency} {thresholdBlock.amount.toLocaleString()}</strong> exceeds
                  the <strong>{form.currency} {thresholdBlock.threshold.toLocaleString()}</strong> threshold
                  for <strong>{form.category}</strong>. A Purchase Request is required.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setThresholdBlock(null)}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigate('procurement', {
                    createPR: true,
                    category: form.category,
                    amount: String(thresholdBlock.amount),
                    description: form.description || customCategory,
                    vesselId: form.vessel_id,
                    department: form.department,
                  });
                }}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" /> Create Purchase Request
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className={`p-6 space-y-5 ${thresholdBlock ? 'hidden' : ''}`}>

          {/* Vessel */}
          {vessels.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.vessel')} *</label>
              <select value={form.vessel_id} onChange={e => setForm({ ...form, vessel_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
                <option value="">Select vessel</option>
                {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          )}

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Department *</label>
            {defaultDepartment ? (
              <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-sm font-medium text-blue-700">{defaultDepartment} — auto-assigned</span>
              </div>
            ) : (
              <select value={form.department}
                onChange={e => setForm({ ...form, department: e.target.value as OperationalExpenseDepartment })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                {DEPT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
          </div>

          {/* Category — filtradas por dept */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('costs.category')} *</label>
            <div className="grid grid-cols-2 gap-2">
              {availableCategories.map(cat => {
                const Icon = cat.icon;
                return (
                  <button key={cat.value} type="button"
                    onClick={() => { setForm({ ...form, category: cat.value as OperationalExpenseCategory }); setCustomCategory(''); }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      form.category === cat.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}>
                    <Icon className={`w-4 h-4 flex-shrink-0 ${form.category === cat.value ? 'text-blue-600' : cat.color}`} />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Campo libre cuando selecciona Other */}
            {form.category === 'other' && (
              <div className="mt-3">
                <input
                  type="text"
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                  placeholder="Describe the expense category (e.g. Safety gear, Spare rope...)"
                  className="w-full px-4 py-3 border border-blue-300 bg-blue-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.description')}</label>
            <input type="text" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Marina Ibiza — July berth fee" />
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('costs.amount')} *</label>
              <input type="number" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00" min="0" step="0.01" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('fuel.currency')}</label>
              <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('costs.expenseDate')} *</label>
            <input type="date" value={form.expense_date}
              onChange={e => setForm({ ...form, expense_date: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required />
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-200">
            <button type="button" onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg disabled:opacity-50">
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
