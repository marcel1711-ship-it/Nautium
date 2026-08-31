import React, { useState, useEffect } from 'react';
import { Package, Search, AlertTriangle, Plus, Filter, ChevronDown, FileDown, MapPin, SlidersHorizontal, Pencil, Trash2, FileSpreadsheet, Anchor, Sofa, Settings, ChefHat, Shield, DollarSign } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { demoInventoryItems, demoVessels } from '../data/demoData';
import { supabase, fetchByCompany, dbInsert, dbUpdate, dbDelete } from '../lib/supabase';
import { isLowStock, downloadHTML } from '../utils/helpers';
import { useToast } from '../components/UI/Toast';
import { AddInventoryModal, NewInventoryData } from '../components/Inventory/AddInventoryModal';
import { ImportInventoryModal } from '../components/Inventory/ImportInventoryModal';
import { AdjustStockModal } from '../components/Inventory/AdjustStockModal';
import { EditInventoryModal } from '../components/Inventory/EditInventoryModal';
import { LocationsPanel } from '../components/Inventory/LocationsPanel';
import { ConfirmModal } from '../components/UI/ConfirmModal';
import { InventoryItem } from '../types';
import { Pagination } from '../components/UI/Pagination';
import { canCreate, UserRole } from '../types';

const PAGE_SIZE = 30;

// ── PROPS ────────────────────────────────────────────────────────────────────
interface InventoryProps {
  onNavigate: (page: string, params?: any) => void;
  /** When set, locks the department filter for crew roles */
  departmentFilter?: string;
}

interface VesselOption { id: string; name: string; }

const isDemoUser = (email: string) => email === 'admin@yachtmaintenance.pro';

const DEPARTMENTS = [
  { value: 'all',          label: 'All',          labelEs: 'Todos',        icon: null },
  { value: 'Deck',         label: 'Deck',          labelEs: 'Cubierta',     icon: Anchor },
  { value: 'Interior',     label: 'Interior',      labelEs: 'Interior',     icon: Sofa },
  { value: 'Engineering',  label: 'Engineering',   labelEs: 'Ingeniería',   icon: Settings },
  { value: 'Galley',       label: 'Galley',        labelEs: 'Cocina',       icon: ChefHat },
  { value: 'Safety',       label: 'Safety',        labelEs: 'Seguridad',    icon: Shield },
];

export const Inventory: React.FC<InventoryProps> = ({ onNavigate, departmentFilter }) => {
  const { currentUser, selectedVesselId } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  // ── Role-based permissions ──────────────────────────────────────────────
  const role = currentUser?.role as UserRole;
  const userCanCreate = canCreate(role);
  const isDeptLocked = !!departmentFilter;

  const [searchTerm, setSearchTerm] = useState('');
  // Initialize department filter — locked for crew roles
  const [filterDepartment, setFilterDepartment] = useState<string>(departmentFilter || 'all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterVessel, setFilterVessel] = useState<string>('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [allEquipment, setAllEquipment] = useState<{ id: string; name: string; vessel_id: string }[]>([]);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [activeTab, setActiveTab] = useState<'items' | 'locations'>('items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { loadData(); }, [currentUser, selectedVesselId]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    if (isDemoUser(currentUser.email)) {
      const sessionEdits = JSON.parse(sessionStorage.getItem('demoInventoryEdits') || '{}');
      let filtered = demoInventoryItems.map(i =>
        sessionEdits[i.id] ? { ...i, ...sessionEdits[i.id] } : i
      );
      if (selectedVesselId && selectedVesselId !== 'all') {
        filtered = filtered.filter(i => i.vessel_id === selectedVesselId);
      } else if (currentUser.role !== 'master_admin') {
        filtered = filtered.filter(i => currentUser.vessel_ids.includes(i.vessel_id));
      }
      setItems(filtered as InventoryItem[]);
      const userVessels = currentUser.role === 'master_admin'
        ? demoVessels
        : demoVessels.filter(v => currentUser.vessel_ids.includes(v.id));
      setVessels(userVessels.map(v => ({ id: v.id, name: v.name })));
      setLoading(false);
      return;
    }
    const effectiveCompanyId = currentUser.company_id || null;
    if (!effectiveCompanyId) { setLoading(false); return; }
    const [items, vessels] = await Promise.all([
      fetchByCompany('inventory_items', effectiveCompanyId, 'created_at', false),
      fetchByCompany('vessels', effectiveCompanyId, 'name', true),
    ]);
    setItems(items);
    setVessels(vessels.map((v: any) => ({ id: v.id, name: v.name })));
    const { data: eqData } = await supabase
      .from('equipment').select('id, name, vessel_id').eq('company_id', effectiveCompanyId);
    setAllEquipment(eqData || []);
    setLoading(false);
  };

  const handleImportItems = async (importedItems: NewInventoryData[]) => {
    if (!currentUser) return;
    if (isDemoUser(currentUser.email)) { setShowImportModal(false); return; }
    for (const itemData of importedItems) {
      await dbInsert('inventory_items', {
        name: itemData.name, part_number: itemData.part_number,
        category: itemData.category, type: itemData.type,
        vessel_id: itemData.vessel_id, equipment_id: itemData.equipment_id || null,
        current_stock: itemData.current_stock, minimum_stock: itemData.minimum_stock,
        unit_of_measure: itemData.unit_of_measure, unit_cost: itemData.unit_cost ?? null,
        storage_location: itemData.location, notes: itemData.notes,
        photo_url: null, company_id: currentUser.company_id || null,
        department: itemData.department || 'Engineering',
      });
    }
    showToast(`${importedItems.length} items imported`, 'success');
    setShowImportModal(false);
    loadData();
  };

  const handleSave = async (itemData: any) => {
    if (!currentUser) return;
    if (isDemoUser(currentUser.email)) { setShowAddModal(false); return; }
    try {
      await dbInsert('inventory_items', {
        name: itemData.name, part_number: itemData.part_number,
        category: itemData.category, type: itemData.type,
        vessel_id: itemData.vessel_id, equipment_id: itemData.equipment_id || null,
        current_stock: itemData.current_stock, minimum_stock: itemData.minimum_stock,
        unit_of_measure: itemData.unit_of_measure, unit_cost: itemData.unit_cost ?? null,
        storage_location: itemData.location, notes: itemData.notes,
        photo_url: itemData.photo_url || null, company_id: currentUser.company_id || null,
        department: itemData.department || 'Engineering',
      });
      showToast('Item added', 'success');
      setShowAddModal(false);
      loadData();
    } catch { showToast('Error saving inventory item', 'error'); }
  };

  const handleAdjustStock = async (movementType: 'in' | 'out' | 'adjustment', quantity: number, reason: string, notes: string) => {
    if (!adjustingItem || !currentUser) return;
    const newStock = movementType === 'in' ? adjustingItem.current_stock + quantity
      : movementType === 'out' ? Math.max(0, adjustingItem.current_stock - quantity) : quantity;
    if (isDemoUser(currentUser.email)) {
      const sessionEdits = JSON.parse(sessionStorage.getItem('demoInventoryEdits') || '{}');
      sessionEdits[adjustingItem.id] = { ...sessionEdits[adjustingItem.id], current_stock: newStock };
      sessionStorage.setItem('demoInventoryEdits', JSON.stringify(sessionEdits));
      setItems(prev => prev.map(i => i.id === adjustingItem.id ? { ...i, current_stock: newStock } : i));
      setAdjustingItem(null);
      return;
    }
    await dbUpdate('inventory_items', adjustingItem.id, { current_stock: newStock });
    await dbInsert('stock_movements', {
      inventory_id: adjustingItem.id, vessel_id: adjustingItem.vessel_id,
      movement_type: movementType, quantity, reason, notes,
      performed_by_id: currentUser.id, performed_by_name: currentUser.full_name,
    });
    showToast('Stock adjusted', 'success');
    setAdjustingItem(null);
    loadData();
  };

  const handleDelete = async (item: InventoryItem) => {
    if (isDemoUser(currentUser?.email || '')) {
      setItems(prev => prev.filter(i => i.id !== item.id));
      setDeletingItem(null);
      return;
    }
    await dbDelete('inventory_items', item.id);
    showToast('Item deleted', 'success');
    setDeletingItem(null);
    loadData();
  };

  const handleEditSaved = (updatedItem?: InventoryItem) => {
    if (updatedItem) {
      const sessionEdits = JSON.parse(sessionStorage.getItem('demoInventoryEdits') || '{}');
      sessionEdits[updatedItem.id] = updatedItem;
      sessionStorage.setItem('demoInventoryEdits', JSON.stringify(sessionEdits));
      setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
    } else {
      loadData();
    }
    setEditingItem(null);
  };

  const getFilteredItems = () => {
    let filtered = items;
    // Department filter — locked for crew roles
    if (filterDepartment !== 'all') filtered = filtered.filter(i => (i as any).department === filterDepartment);
    if (searchTerm) filtered = filtered.filter(i =>
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.part_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filterType !== 'all') filtered = filtered.filter(i => i.type === filterType);
    if (filterCategory !== 'all') filtered = filtered.filter(i => i.category === filterCategory);
    if (filterVessel !== 'all') filtered = filtered.filter(i => i.vessel_id === filterVessel);
    if (showLowStockOnly) filtered = filtered.filter(isLowStock);
    return filtered;
  };

  const filtered = getFilteredItems();
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const categories = Array.from(new Set(items.map(i => i.category)));
  const lowStockCount = filtered.filter(isLowStock).length;
  const getVesselName = (vesselId: string) => vessels.find(v => v.id === vesselId)?.name || '';
  const isDemo = isDemoUser(currentUser?.email || '');

  const deptCounts = DEPARTMENTS.filter(d => d.value !== 'all').reduce((acc, d) => {
    acc[d.value] = items.filter(i => (i as any).department === d.value).length;
    return acc;
  }, {} as Record<string, number>);

  // ── EXPORT PDF (HTML) ─────────────────────────────────────────────────────
  const handleExportPDF = () => {
    const now = new Date();
    const dateLabel = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeLabel = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const lowStockCount = filtered.filter(i => isLowStock(i)).length;
    const totalValue = filtered.reduce((s, i) => s + (i.unit_cost ? i.unit_cost * i.current_stock : 0), 0);

    const tableRows = filtered.map(item => {
      const vesselName = getVesselName(item.vessel_id);
      const dept = (item as any).department || 'Engineering';
      const val = item.unit_cost ? item.unit_cost * item.current_stock : 0;
      const low = isLowStock(item);
      return `<tr${low ? ' style="background:#fffbeb"' : ''}>
        <td><strong>${item.name}</strong>${item.part_number ? `<br/><small>${item.part_number}</small>` : ''}</td>
        <td>${item.category}</td><td>${dept}</td><td>${vesselName}</td>
        <td class="amount"${low ? ' style="color:#b45309;font-weight:700"' : ''}>${item.current_stock}${low ? ' ⚠' : ''}</td>
        <td>${item.unit_of_measure}</td>
        <td class="amount">${item.unit_cost ? fmt(item.unit_cost) : '—'}</td>
        <td class="amount">${val > 0 ? fmt(val) : '—'}</td>
        <td>${item.storage_location || '—'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Inventory Report</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;background:#fff;font-size:11px}
      .header{background:#1e3a5f;color:#fff;padding:28px 32px 24px}
      .header h1{font-size:22px;font-weight:700;margin-bottom:4px}
      .header p{font-size:12px;opacity:.75}
      .meta{display:flex;gap:32px;padding:14px 32px;background:#f4f7fa;border-bottom:1px solid #dde3eb;flex-wrap:wrap}
      .meta-item{display:flex;flex-direction:column;gap:2px}
      .meta-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#6b7280}
      .meta-value{font-size:13px;font-weight:600;color:#1a1a1a}
      .summary{display:flex;gap:16px;padding:16px 32px}
      .summary-card{flex:1;padding:12px 16px;border-radius:8px;border:1px solid #e5e7eb}
      .summary-card .num{font-size:24px;font-weight:700;color:#1d4ed8}
      .summary-card.warn .num{color:#d97706}
      .summary-card .lbl{font-size:11px;color:#6b7280;margin-top:2px}
      .table-wrap{padding:8px 32px 32px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th{background:#f8fafc;text-align:left;padding:8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#4b5563;border-bottom:2px solid #e5e7eb}
      td{padding:7px 8px;border-bottom:1px solid #f0f0f0;vertical-align:top}
      td small{color:#6b7280;font-size:10px}
      td.amount,th.amount{text-align:right;font-variant-numeric:tabular-nums}
      .footer{margin-top:24px;padding:12px 32px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
      <div class="header"><h1>Inventory Report</h1><p>Generated on ${dateLabel} at ${timeLabel}</p></div>
      <div class="meta">
        <div class="meta-item"><span class="meta-label">Department</span><span class="meta-value">${filterDepartment === 'all' ? 'All Departments' : filterDepartment}</span></div>
        <div class="meta-item"><span class="meta-label">Items</span><span class="meta-value">${filtered.length}</span></div>
      </div>
      <div class="summary">
        <div class="summary-card"><div class="num">${filtered.length}</div><div class="lbl">Total Items</div></div>
        <div class="summary-card"><div class="num">$${fmt(totalValue)}</div><div class="lbl">Total Value</div></div>
        <div class="summary-card${lowStockCount > 0 ? ' warn' : ''}"><div class="num">${lowStockCount}</div><div class="lbl">Low Stock</div></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Category</th><th>Dept</th><th>Vessel</th><th class="amount">Stock</th><th>Unit</th><th class="amount">Unit Cost</th><th class="amount">Total</th><th>Location</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table></div>
      <div class="footer">Nautium — Inventory Report — ${dateLabel}</div>
    </body></html>`;

    downloadHTML(html, `inventory-report-${filterDepartment}-${now.toISOString().slice(0, 10)}.html`);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            {t('inventory.title')}
            {/* Show department badge if locked */}
            {isDeptLocked && (
              <span className="ml-3 text-lg font-semibold text-blue-600">· {departmentFilter}</span>
            )}
          </h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">{t('inventory.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {activeTab === 'items' && (
            <button onClick={handleExportPDF} disabled={filtered.length === 0}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <FileDown className="w-5 h-5" />{t('common.exportPDF')}
            </button>
          )}
          {/* Import and Add only for users who can create */}
          {userCanCreate && (
            <>
              <button onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-5 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all">
                <FileSpreadsheet className="w-5 h-5" />Import Excel
              </button>
              <button onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl">
                <Plus className="w-5 h-5" />{t('inventory.addItem')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl w-fit">
        <button onClick={() => setActiveTab('items')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${activeTab === 'items' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Package className="w-4 h-4" />{t('inventory.allItems')}
        </button>
        <button onClick={() => setActiveTab('locations')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${activeTab === 'locations' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <MapPin className="w-4 h-4" />{t('inventory.locationsQR')}
        </button>
      </div>

      {/* DEPARTMENT FILTER PILLS — hidden if department is locked for crew role */}
      {activeTab === 'items' && !isDeptLocked && (
        <div className="flex flex-wrap gap-2">
          {DEPARTMENTS.map(dept => {
            const Icon = dept.icon;
            const count = dept.value === 'all' ? items.length : deptCounts[dept.value] || 0;
            const isActive = filterDepartment === dept.value;
            const colors: Record<string, string> = {
              all: 'bg-gray-900 text-white border-gray-900',
              Deck: 'bg-blue-600 text-white border-blue-600',
              Interior: 'bg-purple-600 text-white border-purple-600',
              Engineering: 'bg-orange-500 text-white border-orange-500',
              Galley: 'bg-green-600 text-white border-green-600',
              Safety: 'bg-red-600 text-white border-red-600',
            };
            const inactiveColors: Record<string, string> = {
              all: 'bg-white text-gray-700 border-gray-200 hover:border-gray-400',
              Deck: 'bg-white text-blue-700 border-blue-200 hover:border-blue-400',
              Interior: 'bg-white text-purple-700 border-purple-200 hover:border-purple-400',
              Engineering: 'bg-white text-orange-700 border-orange-200 hover:border-orange-400',
              Galley: 'bg-white text-green-700 border-green-200 hover:border-green-400',
              Safety: 'bg-white text-red-700 border-red-200 hover:border-red-400',
            };
            return (
              <button key={dept.value} onClick={() => { setFilterDepartment(dept.value); setCurrentPage(1); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-sm transition-all ${isActive ? colors[dept.value] : inactiveColors[dept.value]}`}>
                {Icon && <Icon className="w-4 h-4" />}
                {language === 'es' ? dept.labelEs : dept.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/20' : 'bg-gray-100'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {showAddModal && <AddInventoryModal onClose={() => setShowAddModal(false)} onSave={handleSave} />}
      {showImportModal && <ImportInventoryModal vessels={vessels} equipment={allEquipment} onClose={() => setShowImportModal(false)} onImport={handleImportItems} />}
      {adjustingItem && <AdjustStockModal item={adjustingItem} onClose={() => setAdjustingItem(null)} onSave={handleAdjustStock} />}
      {editingItem && <EditInventoryModal item={editingItem} onClose={() => setEditingItem(null)} onSaved={handleEditSaved} />}
      {deletingItem && (
        <ConfirmModal title="Delete Item" message={`Are you sure you want to delete "${deletingItem.name}"? This action cannot be undone.`}
          confirmLabel="Delete" danger={true} onConfirm={() => handleDelete(deletingItem)} onCancel={() => setDeletingItem(null)} />
      )}

      {activeTab === 'locations' && <LocationsPanel items={items} onNavigate={onNavigate} isDemo={isDemo} />}

      {activeTab === 'items' && lowStockCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-900">{t('inventory.lowStockAlert')}</h3>
            <p className="text-sm text-yellow-800 mt-1">{lowStockCount} {lowStockCount === 1 ? t('inventory.item') : t('inventory.items')} below minimum stock level.</p>
          </div>
          <button onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className="px-4 py-2 bg-yellow-600 text-white rounded-xl text-sm font-medium hover:bg-yellow-700 transition-colors">
            {showLowStockOnly ? t('inventory.showAll') : t('inventory.viewLowStock')}
          </button>
        </div>
      )}

      {activeTab === 'items' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-7">
          <div className="flex items-center gap-3 mb-6">
            <Filter className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-bold text-gray-900">{t('common.filters')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={t('inventory.search')}
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
            </div>
            <div className="relative">
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="w-full appearance-none px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white">
                <option value="all">{t('inventory.allTypes')}</option>
                <option value="spare_part">{t('inventory.spareParts')}</option>
                <option value="consumable">{t('inventory.consumables')}</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                className="w-full appearance-none px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white">
                <option value="all">{t('inventory.allCategories')}</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select value={filterVessel} onChange={e => setFilterVessel(e.target.value)}
                className="w-full appearance-none px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white">
                <option value="all">{t('common.allVessels')}</option>
                {vessels.map(vessel => <option key={vessel.id} value={vessel.id}>{vessel.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              {t('inventory.showing')} <span className="font-semibold text-gray-900">{filtered.length}</span> {filtered.length === 1 ? t('inventory.item') : t('inventory.items')}
              {filterDepartment !== 'all' && <span className="ml-2 text-blue-600 font-medium">· {filterDepartment}</span>}
            </p>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-[0.08em]">{t('inventory.itemName')}</th>
                    <th className="text-left py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-[0.08em]">{t('inventory.partNumber')}</th>
                    <th className="text-left py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-[0.08em]">{t('inventory.category')}</th>
                    {/* Hide department column when locked — it's already in the title */}
                    {!isDeptLocked && <th className="text-left py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-[0.08em]">Department</th>}
                    <th className="text-center py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-[0.08em]">{t('inventory.currentStock')}</th>
                    <th className="text-center py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-[0.08em]">{t('inventory.minStock')}</th>
                    <th className="text-right py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-[0.08em]">Unit Cost</th>
                    <th className="text-right py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-[0.08em]">Total Value</th>
                    <th className="text-left py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-[0.08em]">{t('common.status')}</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={isDeptLocked ? 9 : 10} className="text-center py-12">
                      <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600">{t('inventory.notFound')}</p>
                    </td></tr>
                  ) : (
                    paginated.map(item => {
                      const lowStock = isLowStock(item);
                      const vesselName = getVesselName(item.vessel_id);
                      const dept = (item as any).department || 'Engineering';
                      const totalValue = item.unit_cost ? item.unit_cost * item.current_stock : null;
                      const deptColors: Record<string, string> = {
                        Deck: 'bg-blue-100 text-blue-700',
                        Interior: 'bg-purple-100 text-purple-700',
                        Engineering: 'bg-orange-100 text-orange-700',
                        Galley: 'bg-green-100 text-green-700',
                        Safety: 'bg-red-100 text-red-700',
                      };
                      return (
                        <tr key={item.id}
                          className={`border-b transition-colors cursor-pointer ${lowStock ? 'bg-red-50 border-red-100 hover:bg-red-100/50' : 'border-gray-100 hover:bg-gray-50'}`}
                          onClick={() => onNavigate('inventory-detail', { itemId: item.id, demoItem: item })}>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              {item.photo_url ? (
                                <img src={item.photo_url} alt={item.name} className="w-10 h-10 rounded-xl object-cover border border-gray-200 flex-shrink-0 bg-gray-50" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                                  <Package className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-gray-900">{item.name}</p>
                                {vesselName && <p className="text-sm text-gray-500">{vesselName}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-sm text-gray-600 font-mono">{item.part_number}</td>
                          <td className="py-4 px-4 text-sm text-gray-600">{item.category}</td>
                          {/* Hide department column when locked */}
                          {!isDeptLocked && (
                            <td className="py-4 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold leading-5 ${deptColors[dept] || 'bg-gray-100 text-gray-600'}`}>
                                {dept}
                              </span>
                            </td>
                          )}
                          <td className="py-4 px-4 text-center">
                            <span className={`font-bold text-sm ${lowStock ? 'text-red-600' : 'text-gray-900'}`}>
                              {item.current_stock} {item.unit_of_measure}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center text-sm text-gray-500">{item.minimum_stock} {item.unit_of_measure}</td>
                          <td className="py-4 px-4 text-right">
                            {item.unit_cost ? (
                              <div className="flex items-center justify-end gap-1">
                                <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-sm font-semibold text-gray-900">{item.unit_cost.toFixed(2)}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            {totalValue ? (
                              <span className="text-sm font-bold text-blue-700">${totalValue.toFixed(2)}</span>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            {lowStock ? (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[11px] font-semibold flex items-center gap-1 w-fit leading-5">
                                <AlertTriangle className="w-3 h-3" />{t('inventory.lowStock')}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[11px] font-semibold leading-5">{t('inventory.inStock')}</span>
                            )}
                          </td>
                          <td className="py-4 px-4" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              {/* Adjust stock — all roles can adjust */}
                              <button onClick={() => setAdjustingItem(item)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 hover:border-blue-200">
                                <SlidersHorizontal className="w-3.5 h-3.5" />{t('inventory.adjust')}
                              </button>
                              {/* Edit and Delete — only for users who can create */}
                              {userCanCreate && (
                                <>
                                  <button onClick={() => setEditingItem(item)}
                                    className="p-1.5 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 hover:border-blue-200">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => setDeletingItem(item)}
                                    className="p-1.5 text-gray-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-gray-200 hover:border-red-200">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE}
              onPageChange={(page) => { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          </div>
        </div>
      )}
    </div>
  );
};
