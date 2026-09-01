import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, ChevronDown, Image, XCircle, Upload, Package, Plus, Trash2, CheckSquare, RefreshCw, Pin, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY, dbUpdate } from '../../lib/supabase';
import { demoEquipment, demoVessels, demoUsers } from '../../data/demoData';
import { MaintenanceTask } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../UI/Toast';
import { validateImageFile } from '../../lib/security';

interface EditTaskModalProps {
  task: MaintenanceTask;
  onClose: () => void;
  onSaved: () => void;
}
interface VesselOption { id: string; name: string; }
interface UserOption { id: string; full_name: string; role: string; vessel_ids: string[]; }
interface InventoryOption { id: string; name: string; part_number?: string; unit_of_measure?: string; current_stock?: number; }
interface RequiredPart { inventory_id: string; name: string; quantity: number; }

const MAINTENANCE_CATEGORIES = ['Engine','Electrical','Hull','Hydraulic','Fuel System','Cooling System','Navigation','Safety','Plumbing','Deck Equipment','HVAC','Rigging','Generator Maintenance','Water Systems','Sanitation','Other'];
const isDemoUser = (email: string) => email === 'admin@yachtmaintenance.pro';

export const EditTaskModal: React.FC<EditTaskModalProps> = ({ task, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: task.title,
    description: task.description || '',
    category: task.category,
    priority: task.priority,
    vessel_id: task.vessel_id,
    equipment_id: task.equipment_id || '',
    assigned_user_id: task.assigned_user_id || '',
    next_due_date: task.next_due_date,
    status: task.status,
    is_recurring: (task as any).is_recurring !== false,
    hours_interval: (task as any).hours_interval?.toString() || '',
    next_due_hours: (task as any).next_due_hours?.toString() || '',
  });
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [companyUsers, setCompanyUsers] = useState<UserOption[]>([]);
  const [realEquipment, setRealEquipment] = useState<{ id: string; name: string }[]>([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);
  const [checklistItems, setChecklistItems] = useState<string[]>(task.checklist_items || []);
  const [newCheckItem, setNewCheckItem] = useState('');
  const checkInputRef = useRef<HTMLInputElement>(null);
  const [requiredParts, setRequiredParts] = useState<RequiredPart[]>(
    (task.required_parts || []).map((p: any) => ({ inventory_id: p.inventory_id, name: p.name || '', quantity: p.quantity || 1 }))
  );
  const [inventoryItems, setInventoryItems] = useState<InventoryOption[]>([]);
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);
  const [existingPhotos, setExistingPhotos] = useState<string[]>(task.photos || []);
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const totalPhotos = existingPhotos.length + newPhotoFiles.length;

  const filteredCategories = MAINTENANCE_CATEGORIES.filter(c => c.toLowerCase().includes(categoryInput.toLowerCase()));
  const showAddNew = categoryInput.trim().length > 0 && !MAINTENANCE_CATEGORIES.some(c => c.toLowerCase() === categoryInput.trim().toLowerCase());

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) setCategoryOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => { loadVessels(); loadCompanyUsers(); }, [currentUser]);
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
    const { data } = await query;
    if (data) setVessels(data);
  };

  const loadCompanyUsers = async () => {
    if (!currentUser) return;
    if (isDemoUser(currentUser.email)) {
      const users = currentUser.role === 'master_admin' ? demoUsers.filter(u => u.role !== 'master_admin') : demoUsers.filter(u => u.company_id === currentUser.company_id);
      setCompanyUsers(users.map(u => ({ id: u.id, full_name: u.full_name, role: u.role, vessel_ids: u.vessel_ids })));
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch(`${SUPABASE_URL}/functions/v1/list-users`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json', 'Apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ company_id: currentUser.company_id || null }),
      });
      const result = await response.json();
      if (response.ok && result.users) {
        setCompanyUsers(result.users.map((u: any) => ({ id: u.id, full_name: u.user_metadata?.full_name || u.email, role: u.user_metadata?.role || 'standard_user', vessel_ids: u.user_metadata?.vessel_ids || [] })));
      }
    } catch {}
  };

  const availableEquipment = isDemoUser(currentUser?.email || '') ? demoEquipment.filter(e => e.vessel_id === formData.vessel_id) : realEquipment;
  const availableUsers = companyUsers.filter(u => { if (!formData.vessel_id) return true; if (u.role === 'customer_admin') return true; return u.vessel_ids.includes(formData.vessel_id); });

  const addCheckItem = () => { const val = newCheckItem.trim(); if (!val) return; setChecklistItems(prev => [...prev, val]); setNewCheckItem(''); checkInputRef.current?.focus(); };
  const removeCheckItem = (i: number) => setChecklistItems(prev => prev.filter((_, idx) => idx !== i));
  const addPart = () => {
    const item = inventoryItems.find(i => i.id === selectedInventoryId);
    if (!item) return;
    if (requiredParts.some(p => p.inventory_id === selectedInventoryId)) {
      setRequiredParts(prev => prev.map(p => p.inventory_id === selectedInventoryId ? { ...p, quantity: p.quantity + selectedQty } : p));
    } else {
      setRequiredParts(prev => [...prev, { inventory_id: item.id, name: item.name, quantity: selectedQty }]);
    }
    setSelectedInventoryId(''); setSelectedQty(1);
  };
  const removePart = (id: string) => setRequiredParts(prev => prev.filter(p => p.inventory_id !== id));
  const updatePartQty = (id: string, qty: number) => setRequiredParts(prev => prev.map(p => p.inventory_id === id ? { ...p, quantity: Math.max(1, qty) } : p));

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => !validateImageFile(f));
    if (valid.length < files.length) showToast('Some files were skipped (invalid type or too large).', 'warning');
    const selected = valid.slice(0, 5 - totalPhotos);
    setNewPhotoFiles(prev => [...prev, ...selected]);
    selected.forEach(file => { const reader = new FileReader(); reader.onload = (ev) => setNewPhotoPreviews(prev => [...prev, ev.target?.result as string]); reader.readAsDataURL(file); });
    if (photoInputRef.current) photoInputRef.current.value = '';
  };
  const removeExistingPhoto = (url: string) => setExistingPhotos(prev => prev.filter(p => p !== url));
  const removeNewPhoto = (idx: number) => { setNewPhotoFiles(prev => prev.filter((_, i) => i !== idx)); setNewPhotoPreviews(prev => prev.filter((_, i) => i !== idx)); };
  const uploadNewPhotos = async (): Promise<string[]> => {
    if (newPhotoFiles.length === 0 || !currentUser || isDemoUser(currentUser.email)) return [];
    setUploadingPhotos(true);
    const urls: string[] = [];
    for (const file of newPhotoFiles) {
      const ext = file.name.split('.').pop();
      const path = `${currentUser.id}/${task.id}_ref_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('task-photos').upload(path, file);
      if (!error) { const { data } = supabase.storage.from('task-photos').getPublicUrl(path); urls.push(data.publicUrl); }
    }
    setUploadingPhotos(false);
    return urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.vessel_id || !formData.next_due_date) { showToast('Please fill in all required fields', 'warning'); return; }
    if (!currentUser || isDemoUser(currentUser.email)) { onClose(); return; }
    setSaving(true);
    const today = new Date();
    const dueDate = new Date(formData.next_due_date);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const autoStatus = formData.status === 'completed' ? 'completed' : diffDays < 0 ? 'overdue' : diffDays <= 7 ? 'due_soon' : 'upcoming';
    const uploadedUrls = await uploadNewPhotos();
    try {
      await dbUpdate('maintenance_tasks', task.id, {
        title: formData.title, description: formData.description, category: formData.category, priority: formData.priority,
        vessel_id: formData.vessel_id, equipment_id: formData.equipment_id || null, assigned_user_id: formData.assigned_user_id || null,
        next_due_date: formData.next_due_date, status: autoStatus,
        photos: [...existingPhotos, ...uploadedUrls],
        checklist_items: checklistItems, required_parts: requiredParts,
        is_recurring: formData.is_recurring,
        hours_interval: formData.hours_interval ? Number(formData.hours_interval) : null,
        next_due_hours: formData.next_due_hours ? Number(formData.next_due_hours) : null,
      });
      showToast('Task updated', 'success'); onSaved(); onClose();
    } catch { showToast('Error saving task. Please try again.', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Edit Maintenance Task</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X className="w-6 h-6 text-gray-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('maintenance.taskTitle')} *</label>
            <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
          </div>

          {/* Task type toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Task type</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setFormData({ ...formData, is_recurring: true })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${formData.is_recurring ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${formData.is_recurring ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  <RefreshCw className={`w-5 h-5 ${formData.is_recurring ? 'text-blue-600' : 'text-gray-400'}`} />
                </div>
                <div className="text-left">
                  <div className={`text-sm font-semibold ${formData.is_recurring ? 'text-blue-700' : 'text-gray-600'}`}>Recurring</div>
                  <div className="text-xs text-gray-400">Repeats on schedule</div>
                </div>
              </button>
              <button type="button" onClick={() => setFormData({ ...formData, is_recurring: false })}
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

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.description')}</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          {/* Category + Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div ref={categoryRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('maintenance.category')} *</label>
              <div className="w-full px-4 py-3 border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 flex items-center gap-2 cursor-text" onClick={() => setCategoryOpen(true)}>
                <input type="text" value={categoryInput || formData.category}
                  onChange={e => { setCategoryInput(e.target.value); setFormData({ ...formData, category: '' }); setCategoryOpen(true); }}
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
                      className="w-full text-left px-4 py-2.5 text-sm text-blue-600 font-medium hover:bg-blue-50 border-t border-gray-100 flex items-center gap-2"
                      onMouseDown={e => { e.preventDefault(); setFormData({ ...formData, category: categoryInput.trim() }); setCategoryInput(''); setCategoryOpen(false); }}>
                      <span className="text-blue-500 font-bold">+</span> Add "{categoryInput.trim()}"
                    </button>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('maintenance.priority')} *</label>
              <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="low">{t('common.low')}</option>
                <option value="medium">{t('common.medium')}</option>
                <option value="high">{t('common.high')}</option>
                <option value="critical">{t('common.critical')}</option>
              </select>
            </div>
          </div>

          {/* Vessel + Equipment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.vessel')} *</label>
              <select value={formData.vessel_id} onChange={e => setFormData({ ...formData, vessel_id: e.target.value, equipment_id: '', assigned_user_id: '' })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
                <option value="">{t('maintenance.selectVessel')}</option>
                {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.equipment')}</label>
              <select value={formData.equipment_id} onChange={e => setFormData({ ...formData, equipment_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={!formData.vessel_id}>
                <option value="">{t('maintenance.noEquipment')}</option>
                {availableEquipment.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
              </select>
            </div>
          </div>

          {/* Assigned */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('maintenance.assignedTo')}</label>
            <select value={formData.assigned_user_id} onChange={e => setFormData({ ...formData, assigned_user_id: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="">{t('maintenance.unassigned')}</option>
              {availableUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>

          {/* Date + Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('maintenance.nextDueDate')} *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="date" value={formData.next_due_date} onChange={e => setFormData({ ...formData, next_due_date: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('maintenance.status')}</label>
              <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="upcoming">{t('maintenance.upcoming')}</option>
                <option value="due_soon">{t('maintenance.dueSoon')}</option>
                <option value="overdue">{t('maintenance.overdue')}</option>
                <option value="completed">{t('maintenance.completed')}</option>
              </select>
            </div>
          </div>

          {/* Hours-based schedule */}
          {formData.is_recurring && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <label className="block text-sm font-medium text-blue-700 flex items-center gap-2">
                <Clock className="w-4 h-4" />Hours-Based Schedule (optional)
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-blue-600 mb-1">Every X hours</label>
                  <input type="number" value={formData.hours_interval}
                    onChange={e => setFormData({ ...formData, hours_interval: e.target.value })}
                    min="0" step="1"
                    className="w-full px-4 py-2.5 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    placeholder="e.g., 250" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-600 mb-1">Next due at hours</label>
                  <input type="number" value={formData.next_due_hours}
                    onChange={e => setFormData({ ...formData, next_due_hours: e.target.value })}
                    min="0" step="1"
                    className="w-full px-4 py-2.5 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    placeholder="e.g., 500" />
                </div>
              </div>
              <p className="text-xs text-blue-500">Leave empty if this task is only time-based. Hours are read from the equipment's hourmeter.</p>
            </div>
          )}

          {/* Checklist */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-green-600" />
              Checklist
              {checklistItems.length > 0 && <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{checklistItems.length} steps</span>}
            </label>
            {checklistItems.length > 0 && (
              <div className="space-y-2 mb-3">
                {checklistItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl group">
                    <div className="w-4 h-4 border-2 border-gray-300 rounded flex-shrink-0" />
                    <span className="text-sm text-gray-700 flex-1">{item}</span>
                    <button type="button" onClick={() => removeCheckItem(i)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input ref={checkInputRef} type="text" value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCheckItem(); } }}
                placeholder="Add a checklist step and press Enter..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm" />
              <button type="button" onClick={addCheckItem} disabled={!newCheckItem.trim()}
                className="px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center gap-1.5 font-medium text-sm">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>

          {/* Required Parts */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Package className="w-4 h-4 text-orange-500" />
              Required Parts & Consumables
              {requiredParts.length > 0 && <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{requiredParts.length} items</span>}
            </label>
            {requiredParts.length > 0 && (
              <div className="space-y-2 mb-3">
                {requiredParts.map(part => {
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
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm">
                  <option value="">Select part from inventory...</option>
                  {inventoryItems.map(item => <option key={item.id} value={item.id}>{item.name}{item.part_number ? ` (${item.part_number})` : ''} — Stock: {item.current_stock ?? '?'}</option>)}
                </select>
                <input type="number" min="1" value={selectedQty} onChange={e => setSelectedQty(parseInt(e.target.value) || 1)}
                  className="w-20 px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-400 text-sm text-center" />
                <button type="button" onClick={addPart} disabled={!selectedInventoryId}
                  className="px-4 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center gap-1.5 font-medium text-sm">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400 py-2">{formData.vessel_id ? 'No inventory items found for this vessel.' : 'Select a vessel to load inventory items.'}</p>
            )}
          </div>

          {/* Photos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                <Image className="w-4 h-4 text-gray-500" /> Reference Photos
              </label>
              <span className="text-xs text-gray-400">{totalPhotos}/5</span>
            </div>
            {(existingPhotos.length > 0 || newPhotoPreviews.length > 0) && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                {existingPhotos.map((url, idx) => (
                  <div key={`e-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeExistingPhoto(url)} className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <XCircle className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
                {newPhotoPreviews.map((src, idx) => (
                  <div key={`n-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-blue-300 group">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <div className="absolute top-1 left-1 w-2 h-2 bg-blue-500 rounded-full" />
                    <button type="button" onClick={() => removeNewPhoto(idx)} className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <XCircle className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {totalPhotos < 5 && (
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-colors cursor-pointer" onClick={() => photoInputRef.current?.click()}>
                <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                <p className="text-sm text-gray-600 font-medium">Click to add reference photos</p>
                <p className="text-xs text-gray-400 mt-0.5">JPEG, PNG, WebP up to 10 MB</p>
              </div>
            )}
            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handlePhotoSelect} />
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">{t('common.cancel')}</button>
            <button type="submit" disabled={saving || uploadingPhotos}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg disabled:opacity-50">
              {saving || uploadingPhotos ? t('common.loading') : t('common.saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
