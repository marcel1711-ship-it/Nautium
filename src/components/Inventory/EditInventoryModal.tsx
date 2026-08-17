import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Anchor, Sofa, Settings, ChefHat, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase, dbUpdate } from '../../lib/supabase';
import { demoVessels, demoEquipment } from '../../data/demoData';
import { InventoryItem } from '../../types';
import { PartPhotoUpload } from './PartPhotoUpload';
import { useToast } from '../UI/Toast';

const isDemoUser = (email: string) => email === 'admin@yachtmaintenance.pro';

interface EditInventoryModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSaved: (updatedItem?: InventoryItem) => void;
}
interface VesselOption { id: string; name: string; }
interface EquipmentOption { id: string; name: string; vessel_id: string; }

const CATEGORIES = ['Engine Parts','Electrical','Hydraulic','Fuel System','Cooling System','Safety Equipment','Lubricants','Filters','Gaskets & Seals','Fasteners','Other'];
const UNITS = ['pcs', 'liters', 'kg', 'meters', 'boxes', 'sets'];

const DEPARTMENTS = [
  { value: 'Engineering', label: 'Engineering', icon: Settings, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-300' },
  { value: 'Deck',        label: 'Deck',         icon: Anchor,   color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-300' },
  { value: 'Interior',    label: 'Interior',     icon: Sofa,     color: 'text-purple-600', bg: 'bg-purple-50 border-purple-300' },
  { value: 'Galley',      label: 'Galley',       icon: ChefHat,  color: 'text-green-600',  bg: 'bg-green-50 border-green-300' },
  { value: 'Safety',      label: 'Safety',       icon: Shield,   color: 'text-red-600',    bg: 'bg-red-50 border-red-300' },
];

export const EditInventoryModal: React.FC<EditInventoryModalProps> = ({ item, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: item.name,
    part_number: item.part_number || '',
    category: item.category,
    type: item.type,
    vessel_id: item.vessel_id,
    equipment_id: item.equipment_id || '',
    current_stock: item.current_stock,
    minimum_stock: item.minimum_stock,
    unit_of_measure: item.unit_of_measure,
    unit_cost: item.unit_cost ?? null as number | null,
    storage_location: item.storage_location || '',
    notes: item.notes || '',
    supplier_name: item.supplier_name || '',
    supplier_email: item.supplier_email || '',
    supplier_phone: item.supplier_phone || '',
    photo_url: item.photo_url ?? null as string | null,
    department: (item as any).department || 'Engineering',
  });
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [equipment, setEquipment] = useState<EquipmentOption[]>([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  const filteredCategories = CATEGORIES.filter(c => c.toLowerCase().includes(categoryInput.toLowerCase()));
  const showAddNew = categoryInput.trim().length > 0 && !CATEGORIES.some(c => c.toLowerCase() === categoryInput.trim().toLowerCase());

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) setCategoryOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => { loadVessels(); }, [currentUser]);
  useEffect(() => { if (formData.vessel_id) loadEquipment(formData.vessel_id); else setEquipment([]); }, [formData.vessel_id]);

  const loadVessels = async () => {
    if (!currentUser) return;
    if (isDemoUser(currentUser.email)) {
      const userVessels = currentUser.role === 'master_admin' ? demoVessels : demoVessels.filter(v => currentUser.vessel_ids.includes(v.id));
      setVessels(userVessels.map(v => ({ id: v.id, name: v.name })));
      return;
    }
    let query = supabase.from('vessels').select('id, name');
    if (currentUser.role === 'customer_admin' && currentUser.company_id) query = query.eq('company_id', currentUser.company_id);
    else if (currentUser.role === 'standard_user' && currentUser.vessel_ids.length > 0) query = query.in('id', currentUser.vessel_ids);
    const { data } = await query;
    if (data) setVessels(data);
  };

  const loadEquipment = async (vesselId: string) => {
    if (isDemoUser(currentUser?.email || '')) {
      const eq = demoEquipment.filter(e => e.vessel_id === vesselId);
      setEquipment(eq.map(e => ({ id: e.id, name: e.name, vessel_id: e.vessel_id })));
      return;
    }
    const { data } = await supabase.from('equipment').select('id, name, vessel_id').eq('vessel_id', vesselId);
    if (data) setEquipment(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.vessel_id) { showToast('Please fill in all required fields', 'warning'); return; }
    if (!currentUser) { onClose(); return; }
    setSaving(true);
    if (isDemoUser(currentUser.email)) {
      const updatedItem: InventoryItem = { ...item, ...formData, equipment_id: formData.equipment_id || null };
      setSaving(false);
      onSaved(updatedItem);
      onClose();
      return;
    }
    try {
      await dbUpdate('inventory_items', item.id, {
        name: formData.name, part_number: formData.part_number,
        category: formData.category, type: formData.type,
        vessel_id: formData.vessel_id, equipment_id: formData.equipment_id || null,
        current_stock: formData.current_stock, minimum_stock: formData.minimum_stock,
        unit_of_measure: formData.unit_of_measure, unit_cost: formData.unit_cost,
        storage_location: formData.storage_location, notes: formData.notes,
        supplier_name: formData.supplier_name, supplier_email: formData.supplier_email,
        supplier_phone: formData.supplier_phone, photo_url: formData.photo_url,
        department: formData.department,
      });
      showToast('Item updated', 'success'); onSaved(); onClose();
    } catch { showToast('Error saving item. Please try again.', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{t('common.edit')} Item</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X className="w-6 h-6 text-gray-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('inventory.itemName')} *</label>
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('inventory.partNumber')}</label>
              <input type="text" value={formData.part_number} onChange={e => setFormData({ ...formData, part_number: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.type')} *</label>
              <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="spare_part">{t('inventory.sparePart')}</option>
                <option value="consumable">{t('inventory.consumable')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div ref={categoryRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('inventory.category')} *</label>
              <div className="w-full px-4 py-3 border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 flex items-center gap-2 cursor-text" onClick={() => setCategoryOpen(true)}>
                <input type="text" value={categoryInput || formData.category} onChange={e => { setCategoryInput(e.target.value); setFormData({ ...formData, category: '' }); setCategoryOpen(true); }}
                  onFocus={() => setCategoryOpen(true)} placeholder="Select or type..."
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
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.vessel')} *</label>
              <select value={formData.vessel_id} onChange={e => setFormData({ ...formData, vessel_id: e.target.value, equipment_id: '' })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
                <option value="">Select Vessel</option>
                {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Related Equipment (Optional)</label>
            <select value={formData.equipment_id} onChange={e => setFormData({ ...formData, equipment_id: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={!formData.vessel_id}>
              <option value="">Not linked to specific equipment</option>
              {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('inventory.currentStock')} *</label>
              <input type="number" value={formData.current_stock} onChange={e => setFormData({ ...formData, current_stock: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" min="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('inventory.minStock')} *</label>
              <input type="number" value={formData.minimum_stock} onChange={e => setFormData({ ...formData, minimum_stock: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" min="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Unit *</label>
              <select value={formData.unit_of_measure} onChange={e => setFormData({ ...formData, unit_of_measure: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('inventory.storageLocation')}</label>
              <input type="text" value={formData.storage_location} onChange={e => setFormData({ ...formData, storage_location: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Store Room A, Shelf 3" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('inventory.unitCost')}</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                <input type="number" value={formData.unit_cost ?? ''} onChange={e => setFormData({ ...formData, unit_cost: e.target.value === '' ? null : parseFloat(e.target.value) })}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00" min="0" step="0.01" />
              </div>
              <p className="mt-1.5 text-xs text-gray-500">Used for cost tracking reports</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Supplier Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('inventory.supplierName')}</label>
                <input type="text" value={formData.supplier_name} onChange={e => setFormData({ ...formData, supplier_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Supplier Email</label>
                <input type="email" value={formData.supplier_email} onChange={e => setFormData({ ...formData, supplier_email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Supplier Phone</label>
                <input type="tel" value={formData.supplier_phone} onChange={e => setFormData({ ...formData, supplier_phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
          </div>

          <PartPhotoUpload currentUrl={formData.photo_url} onUploaded={url => setFormData({ ...formData, photo_url: url })} onUploadingChange={setPhotoUploading} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.notes')}</label>
            <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">{t('common.cancel')}</button>
            <button type="submit" disabled={saving || photoUploading} className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg disabled:opacity-50">
              {photoUploading ? 'Uploading photo...' : saving ? t('common.loading') : t('inventory.saveItem')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
