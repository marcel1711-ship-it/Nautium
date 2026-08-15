import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, AlertCircle, ChevronDown, Plus, Trash2, CheckSquare, Package, Anchor, Sofa, Settings, ChefHat, Shield, RefreshCw, Pin } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../lib/supabase';
import { demoEquipment, demoVessels, demoUsers } from '../../data/demoData';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../UI/Toast';

interface NewTaskModalProps {
  onClose: () => void;
  onSave: (task: NewTaskData) => void;
}
export interface NewTaskData {
  title: string; description: string; category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  vessel_id: string; equipment_id: string; assigned_user_id: string;
  next_due_date: string; interval_type: 'hours' | 'days' | 'months';
  interval_value: number; checklist_items: string[];
  required_parts: { inventory_id: string; name: string; quantity: number }[];
  department: string;
  is_recurring: boolean;
}
interface VesselOption { id: string; name: string; }
interface UserOption { id: string; full_name: string; role: string; vessel_ids: string[]; }

const MAINTENANCE_CATEGORIES = ['Engine','Electrical','Hull','Hydraulic','Fuel System','Cooling System','Navigation','Safety','Plumbing','Deck Equipment','HVAC','Rigging','Generator Maintenance','Water Systems','Sanitation','Other'];
const DEPARTMENTS = [
  { value: 'Engineering', label: 'Engineering', icon: Settings, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-300' },
  { value: 'Deck',        label: 'Deck',        icon: Anchor,   color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-300' },
  { value: 'Interior',    label: 'Interior',    icon: Sofa,     color: 'text-purple-600', bg: 'bg-purple-50 border-purple-300' },
  { value: 'Galley',      label: 'Galley',      icon: ChefHat,  color: 'text-green-600',  bg: 'bg-green-50 border-green-300' },
  { value: 'Safety',      label: 'Safety',      icon: Shield,   color: 'text-red-600',    bg: 'bg-red-50 border-red-300' },
];
const isDemoUser = (email: string) => email === 'admin@yachtmaintenance.pro';

export const NewTaskModal: React.FC<NewTaskModalProps> = ({ onClose, onSave }) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [formData, setFormData] = useState<NewTaskData>({
    title: '', description: '', category: '', priority: 'medium',
    vessel_id: '', equipment_id: '', assigned_user_id: currentUser?.id || '',
    next_due_date: '', interval_type: 'days', interval_value: 30,
    checklist_items: [], required_parts: [], department: 'Engineering',
    is_recurring: true,
  });
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [companyUsers, setCompanyUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newCheckItem, setNewCheckItem] = useState('');
  const checkInputRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const [inventoryItems, setInventoryItems] = useState<{ id: string; name: string; part_number?: string; unit_of_measure?: string; current_stock?: number }[]>([]);
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);
  const [realEquipment, setRealEquipment] = useState<{ id: string; name: string }[]>([]);
  const filteredCategories = MAINTENANCE_CATEGORIES.filter(c => c.toLowerCase().includes(categoryInput.toLowerCase()));
  const showAddNew = categoryInput.trim().length > 0 && !MAINTENANCE_CATEGORIES.some(c => c.toLowerCase() === categoryInput.trim().toLowerCase());

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) setCategoryOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => { loadVessels(); loadCompanyUsers(); }, [currentUser]);
  useEffect(() => { if (vessels.length === 1 && !formData.vessel_id) setFormData(prev => ({ ...prev, vessel_id: vessels[0].id })); }, [vessels]);
  useEffect(() => {
    if (!formData.vessel_id || isDemoUser(currentUser?.email || '')) return;
    supabase.from('equipment').select('id, name').eq('vessel_id', formData.vessel_id).then(({ data }) => setRealEquipment(data || []));
    supabase.from('inventory_items').select('id, name, part_number, unit_of_measure, current_stock').eq('vessel_id', formData.vessel_id).order('name').then(({ data }) => setInventoryItems(data || []));
  }, [formData.vessel_id]);

  const loadVessels = async () => {
    if (!currentUser) return;
    if (isDemoUser(currentUser.email)) {
      const userVessels = currentUser.role === 'master_admin' ? demoVessels : demoVessels.filter(v => currentUser.vessel_ids.includes(v.id));
      setVessels(userVessels.map(v => ({ id: v.id, name: v.name })));
      return;
    }
    let query = supabase.from('vessels').select('id, name');
    if (currentUser.role === 'customer_admin' && currentUser.company_id) query = query.eq('company_id', currentUser.company_id);
    else if (currentUser.vessel_ids.length > 0) query = query.in('id', currentUser.vessel_ids);
    else if (currentUser.role !== 'master_admin') { setVessels([]); return; }
    const { data } = await query;
    if (data) setVessels(data);
  };

  const loadCompanyUsers = async () => {
    if (!currentUser) return;
    setLoadingUsers(true);
    try {
      if (isDemoUser(currentUser.email)) {
        const users = currentUser.role === 'master_admin' ? demoUsers.filter(u => u.role !== 'master_admin') : demoUsers.filter(u => u.company_id === currentUser.company_id);
        setCompanyUsers(users.map(u => ({ id: u.id, full_name: u.full_name, role: u.role, vessel_ids: u.vessel_ids })));
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch(`${SUPABASE_URL}/functions/v1/list-users`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json', 'Apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ company_id: currentUser.company_id || null }),
      });
      const result = await response.json();
      if (response.ok && result.users) {
        setCompanyUsers(result.users.map((u: any) => ({
          id: u.id, full_name: u.user_metadata?.full_name || u.email,
          role: u.user_metadata?.role || 'standard_user', vessel_ids: u.user_metadata?.vessel_ids || [],
        })));
      }
    } finally { setLoadingUsers(false); }
  };

  const availableEquipment = isDemoUser(currentUser?.email || '') ? demoEquipment.filter(e => e.vessel_id === formData.vessel_id) : realEquipment;
  const availableUsers = companyUsers.filter(u => { if (!formData.vessel_id) return true; if (u.role === 'customer_admin') return true; return u.vessel_ids.includes(formData.vessel_id); });
  const getRoleLabel = (role: string) => { if (role === 'customer_admin') return 'Admin'; if (role === 'standard_user') return 'User'; return role; };

  const addCheckItem = () => {
    const val = newCheckItem.trim();
    if (!val) return;
    setFormData(prev => ({ ...prev, checklist_items: [...prev.checklist_items, val] }));
    setNewCheckItem('');
    checkInputRef.current?.focus();
  };
  const removeCheckItem = (index: number) => setFormData(prev => ({ ...prev, checklist_items: prev.checklist_items.filter((_, i) => i !== index) }));
  const handleCheckKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); addCheckItem(); } };

  const addPart = () => {
    const item = inventoryItems.find(i => i.id === selectedInventoryId);
    if (!item) return;
    if (formData.required_parts.some(p => p.inventory_id === selectedInventoryId)) {
      setFormData(prev => ({ ...prev, required_parts: prev.required_parts.map(p => p.inventory_id === selectedInventoryId ? { ...p, quantity: p.quantity + selectedQty } : p) }));
    } else {
      setFormData(prev => ({ ...prev, required_parts: [...prev.required_parts, { inventory_id: item.id, name: item.name, quantity: selectedQty }] }));
    }
    setSelectedInventoryId(''); setSelectedQty(1);
  };
  const removePart = (id: string) => setFormData(prev => ({ ...prev, required_parts: prev.required_parts.filter(p => p.inventory_id !== id) }));
  const updatePartQty = (id: string, qty: number) => setFormData(prev => ({ ...prev, required_parts: prev.required_parts.map(p => p.inventory_id === id ? { ...p, quantity: Math.max(1, qty) } : p) }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.vessel_id || !formData.equipment_id || !formData.next_due_date) { showToast('Please fill in all required fields', 'warning'); return; }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{t('maintenance.createTask')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X className="w-6 h-6 text-gray-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* TITLE */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('maintenance.taskTitle')} *</label>
            <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t('maintenance.taskTitlePlaceholder')} required />
          </div>

          {/* TASK TYPE — Recurring vs One-time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Task type *</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button"
                onClick={() => setFormData({ ...formData, is_recurring: true })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${formData.is_recurring ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${formData.is_recurring ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  <RefreshCw className={`w-5 h-5 ${formData.is_recurring ? 'text-blue-600' : 'text-gray-400'}`} />
                </div>
                <div className="text-left">
                  <div className={`text-sm font-semibold ${formData.is_recurring ? 'text-blue-700' : 'text-gray-600'}`}>Recurring</div>
                  <div className="text-xs text-gray-400">Repeats on schedule</div>
                </div>
              </button>
              <button type="button"
                onClick={() => setFormData({ ...formData, is_recurring: false })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${!formData.is_recurring ? 'bg-orange-50 border-orange-400' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${!formData.is_recurring ? 'bg-orange-100' : 'bg-gray-100'}`}>
                  <Pin className={`w-5 h-5 ${!formData.is_recurring ? 'text-orange-600' : 'text-gray-400'}`} />
                </div>
                <div className="text-left">
                  <div className={`text-sm font-semibold ${!formData.is_recurring ? 'text-orange-700' : 'text-gray-600'}`}>One-time</div>
                  <div className="text-xs text-gray-400">Single occurrence</div>
                </div>
              </button>
            </div>
          </div>

          {/* DEPARTMENT */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Department *</label>
            <div className="grid grid-cols-5 gap-2">
              {DEPARTMENTS.map(dept => {
                const Icon = dept.icon;
                const isActive = formData.department === dept.value;
                return (
                  <button key={dept.value} type="button"
                    onClick={() => setFormData({ ...formData, department: dept.value })}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${isActive ? dept.bg + ' border-2' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                    <Icon className={`w-5 h-5 ${isActive ? dept.color : 'text-gray-400'}`} />
                    <span className={`text-[11px] font-semibold ${isActive ? dept.color : 'text-gray-500'}`}>{dept.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DESCRIPTION */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.description')}</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t('maintenance.descriptionPlaceholder')} />
          </div>

          {/* CATEGORY + PRIORITY */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div ref={categoryRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('maintenance.category')} *</label>
              <div className="w-full px-4 py-3 border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 flex items-center gap-2 cursor-text" onClick={() => setCategoryOpen(true)}>
                <input type="text" value={categoryInput || formData.category} onChange={e => { setCategoryInput(e.target.value); setFormData({ ...formData, category: '' }); setCategoryOpen(true); }}
                  onFocus={() => setCategoryOpen(true)} placeholder={t('maintenance.categoryPlaceholder')}
                  className="flex-1 outline-none bg-transparent text-gray-900 placeholder-gray-400 text-sm" required={!formData.category} />
                <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${categoryOpen ? 'rotate-180' : ''}`} />
              </div>
              {categoryOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                  {filteredCategories.map(cat => (
                    <button key={cat} type="button"
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors ${formData.category === cat ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                      onMouseDown={e => { e.preventDefault(); setFormData({ ...formData, category: cat }); setCategoryInput(''); setCategoryOpen(false); }}>
                      {cat}
                    </button>
                  ))}
                  {showAddNew && (
                    <button type="button"
                      className="w-full text-left px-4 py-2.5 text-sm text-blue-600 font-medium hover:bg-blue-50 transition-colors border-t border-gray-100 flex items-center gap-2"
                      onMouseDown={e => { e.preventDefault(); setFormData({ ...formData, category: categoryInput.trim() }); setCategoryInput(''); setCategoryOpen(false); }}>
                      <span className="text-blue-500 font-bold">+</span>Add "{categoryInput.trim()}"
                    </button>
                  )}
                  {filteredCategories.length === 0 && !showAddNew && <p className="px-4 py-3 text-sm text-gray-400">No matches found</p>}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('maintenance.priority')} *</label>
              <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
                <option value="low">{t('common.low')}</option>
                <option value="medium">{t('common.medium')}</option>
                <option value="high">{t('common.high')}</option>
                <option value="critical">{t('common.critical')}</option>
              </select>
            </div>
          </div>

          {/* VESSEL + EQUIPMENT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.vessel')} *</label>
              <select value={formData.vessel_id} onChange={e => setFormData({ ...formData, vessel_id: e.target.value, equipment_id: '', assigned_user_id: '' })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
                <option value="">{t('maintenance.selectVessel')}</option>
                {vessels.map(vessel => <option key={vessel.id} value={vessel.id}>{vessel.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.equipment')} *</label>
              <select value={formData.equipment_id} onChange={e => setFormData({ ...formData, equipment_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required disabled={!formData.vessel_id}>
                <option value="">{t('maintenance.selectEquipment')}</option>
                {availableEquipment.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
              </select>
            </div>
          </div>

          {/* ASSIGNED TO */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('maintenance.assignedTo')}</label>
            <select value={formData.assigned_user_id} onChange={e => setFormData({ ...formData, assigned_user_id: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={loadingUsers}>
              <option value="">{t('maintenance.unassigned')}</option>
              {availableUsers.map(user => <option key={user.id} value={user.id}>{user.full_name} ({getRoleLabel(user.role)})</option>)}
            </select>
            {formData.vessel_id && availableUsers.length === 0 && !loadingUsers && <p className="mt-1.5 text-xs text-gray-500">No users assigned to this vessel</p>}
          </div>

          {/* DUE DATE */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('maintenance.nextDueDate')} *</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="date" value={formData.next_due_date} onChange={e => setFormData({ ...formData, next_due_date: e.target.value })}
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
            </div>
          </div>

          {/* RECURRENCE INTERVAL — only if recurring */}
          {formData.is_recurring && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('maintenance.recurrenceInterval')}</label>
              <div className="flex gap-3">
                <input type="number" value={formData.interval_value} onChange={e => setFormData({ ...formData, interval_value: parseInt(e.target.value) || 0 })}
                  className="w-32 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" min="1" placeholder="30" />
                <select value={formData.interval_type} onChange={e => setFormData({ ...formData, interval_type: e.target.value as any })}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                </select>
              </div>
            </div>
          )}

          {/* CHECKLIST */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-green-600" />
              Checklist
              {formData.checklist_items.length > 0 && <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{formData.checklist_items.length} steps</span>}
            </label>
            {formData.checklist_items.length > 0 && (
              <div className="space-y-2 mb-3">
                {formData.checklist_items.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl group">
                    <div className="w-4 h-4 border-2 border-gray-300 rounded flex-shrink-0" />
                    <span className="text-sm text-gray-700 flex-1">{item}</span>
                    <button type="button" onClick={() => removeCheckItem(index)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input ref={checkInputRef} type="text" value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)} onKeyDown={handleCheckKeyDown}
                placeholder="Add a checklist step and press Enter..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm" />
              <button type="button" onClick={addCheckItem} disabled={!newCheckItem.trim()}
                className="px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center gap-1.5 font-medium text-sm">
                <Plus className="w-4 h-4" />Add
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Press Enter to add each step quickly</p>
          </div>

          {/* REQUIRED PARTS */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Package className="w-4 h-4 text-orange-500" />
              Required Parts & Consumables
              {formData.required_parts.length > 0 && <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{formData.required_parts.length} items</span>}
            </label>
            {formData.required_parts.length > 0 && (
              <div className="space-y-2 mb-3">
                {formData.required_parts.map(part => {
                  const inv = inventoryItems.find(i => i.id === part.inventory_id);
                  return (
                    <div key={part.inventory_id} className="flex items-center gap-3 px-3 py-2.5 bg-orange-50 border border-orange-200 rounded-xl group">
                      <Package className="w-4 h-4 text-orange-400 flex-shrink-0" />
                      <span className="text-sm text-gray-800 flex-1">{part.name}</span>
                      {inv && <span className="text-xs text-gray-400">Stock: {inv.current_stock}</span>}
                      <input type="number" min="1" value={part.quantity} onChange={e => updatePartQty(part.inventory_id, parseInt(e.target.value) || 1)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm text-center" />
                      <span className="text-xs text-gray-400">{inv?.unit_of_measure || 'units'}</span>
                      <button type="button" onClick={() => removePart(part.inventory_id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {inventoryItems.length > 0 ? (
              <div className="flex gap-2">
                <select value={selectedInventoryId} onChange={e => setSelectedInventoryId(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-400 text-sm">
                  <option value="">Select part from inventory...</option>
                  {inventoryItems.map(item => <option key={item.id} value={item.id}>{item.name}{item.part_number ? ` (${item.part_number})` : ''} — Stock: {item.current_stock ?? '?'}</option>)}
                </select>
                <input type="number" min="1" value={selectedQty} onChange={e => setSelectedQty(parseInt(e.target.value) || 1)}
                  className="w-20 px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-400 text-sm text-center" />
                <button type="button" onClick={addPart} disabled={!selectedInventoryId}
                  className="px-4 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center gap-1.5 font-medium text-sm">
                  <Plus className="w-4 h-4" />Add
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400 py-2">{formData.vessel_id ? 'No inventory items found for this vessel.' : 'Select a vessel first to load inventory items.'}</p>
            )}
          </div>

          {/* NOTE */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">
              {formData.is_recurring
                ? t('maintenance.taskScheduleNote')
                : 'This task will not repeat after completion. It will be marked as done and removed from the active task list.'}
            </p>
          </div>

          {/* ACTIONS */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">{t('common.cancel')}</button>
            <button type="submit" className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg">{t('maintenance.createTask2')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
