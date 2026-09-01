import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, ChevronDown, ChevronUp, Edit2, Trash2, X,
  Waves, Ship, Anchor, Wind, AlertCircle, Camera, ImageIcon,
  Building2, Eye,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, fetchByCompany, dbInsert, dbUpdate, dbDelete } from '../lib/supabase';
import { WaterToy, WaterToyType, WaterToyStatus, canCreate } from '../types';
import { ConfirmModal } from '../components/UI/ConfirmModal';
import { useToast } from '../components/UI/Toast';

interface WaterToysProps {
  onNavigate: (page: string, params?: any) => void;
  params?: any;
}
interface VesselOption { id: string; name: string; }

const WATER_TOY_TYPES: WaterToyType[] = [
  'Tender', 'Jet Ski', 'SeaBob', 'Kayak', 'Paddleboard', 'Wakeboard', 'Inflatable', 'Other',
];

const TYPE_ICONS: Record<string, React.ElementType> = {
  Tender: Ship,
  'Jet Ski': Wind,
  SeaBob: Waves,
  Kayak: Anchor,
  Paddleboard: Waves,
  Wakeboard: Wind,
  Inflatable: Waves,
  Other: Waves,
};

const TYPE_COLORS: Record<string, string> = {
  Tender:      'bg-blue-100 text-blue-700',
  'Jet Ski':   'bg-orange-100 text-orange-700',
  SeaBob:      'bg-cyan-100 text-cyan-700',
  Kayak:       'bg-green-100 text-green-700',
  Paddleboard: 'bg-teal-100 text-teal-700',
  Wakeboard:   'bg-purple-100 text-purple-700',
  Inflatable:  'bg-yellow-100 text-yellow-700',
  Other:       'bg-gray-100 text-gray-700',
};

const STATUS_COLORS: Record<WaterToyStatus, string> = {
  active:     'bg-green-100 text-green-700',
  in_service: 'bg-yellow-100 text-yellow-700',
  retired:    'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<WaterToyStatus, string> = {
  active:     'Active',
  in_service: 'In Service',
  retired:    'Retired',
};

export const WaterToys: React.FC<WaterToysProps> = ({ onNavigate, params }) => {
  const { currentUser, selectedVesselId } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const companyId: string | undefined = params?.companyId;
  const companyName: string | undefined = params?.companyName;

  const userCanCreate = canCreate(currentUser?.role as any);

  const [items, setItems]                 = useState<WaterToy[]>([]);
  const [vessels, setVessels]             = useState<VesselOption[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [filterType, setFilterType]       = useState('all');
  const [filterStatus, setFilterStatus]   = useState('all');
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [showModal, setShowModal]         = useState(false);
  const [editingItem, setEditingItem]     = useState<WaterToy | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => { if (currentUser) loadData(); }, [currentUser, selectedVesselId, companyId]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    const cid = companyId || currentUser.company_id;
    if (!cid) { setLoading(false); return; }
    const [toysData, vesselsData] = await Promise.all([
      fetchByCompany('water_toys', cid, 'name', true),
      fetchByCompany('vessels', cid, 'name', true),
    ]);
    setVessels(vesselsData.map((v: any) => ({ id: v.id, name: v.name })));
    const filtered = selectedVesselId && selectedVesselId !== 'all'
      ? toysData.filter((t: any) => t.vessel_id === selectedVesselId)
      : toysData;
    setItems(filtered);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await dbDelete('water_toys', id);
      setItems(prev => prev.filter(i => i.id !== id));
      showToast('Water toy removed', 'success');
    } catch { showToast('Error removing water toy', 'error'); }
    finally { setConfirmDeleteId(null); }
  };

  const vesselName = (vid: string) => vessels.find(v => v.id === vid)?.name || '';

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (filterStatus !== 'all' && item.status !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          item.name.toLowerCase().includes(s) ||
          (item.manufacturer || '').toLowerCase().includes(s) ||
          (item.model || '').toLowerCase().includes(s) ||
          (item.serial_number || '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [items, filterType, filterStatus, search]);

  const groupedByType = useMemo(() => {
    const groups: Record<string, WaterToy[]> = {};
    for (const item of filteredItems) {
      const t = item.type || 'Other';
      if (!groups[t]) groups[t] = [];
      groups[t].push(item);
    }
    return groups;
  }, [filteredItems]);

  const sortedTypes = WATER_TOY_TYPES.filter(t => groupedByType[t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">

      {companyId && (
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('customers')} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
            <Building2 className="w-4 h-4" />Back to Customers
          </button>
          <span className="text-gray-400">/</span>
          <span className="text-sm font-medium text-gray-900">{companyName || 'Customer'} — Water Toys</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            {companyId && companyName ? `${companyName} — Water Toys` : 'Water Toys & Tenders'}
          </h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">Manage tenders, jet skis, and water equipment</p>
        </div>
        {userCanCreate && (
          <button
            onClick={() => { setEditingItem(null); setShowModal(true); }}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shrink-0"
          >
            <Plus className="w-5 h-5" /> Add Water Toy
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search water toys..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
          <option value="all">All Types</option>
          {WATER_TOY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="in_service">In Service</option>
          <option value="retired">Retired</option>
        </select>
      </div>

      {/* Empty state */}
      {filteredItems.length === 0 && (
        <div className="text-center py-16">
          <Waves className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600">No water toys yet</h3>
          <p className="text-gray-400 mt-1">Add your first tender, jet ski, or water toy</p>
        </div>
      )}

      {/* Grouped list */}
      {sortedTypes.map(type => {
        const Icon = TYPE_ICONS[type] || Waves;
        const colorClass = TYPE_COLORS[type] || TYPE_COLORS.Other;
        return (
          <div key={type} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${colorClass}`}>
                <Icon className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-gray-800">{type}</h2>
              <span className="text-sm text-gray-400">{groupedByType[type].length}</span>
            </div>

            <div className="space-y-2">
              {groupedByType[type].map(item => {
                const isExpanded = expandedId === item.id;
                return (
                  <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                      {/* Photo thumbnail */}
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                        {item.photo_url
                          ? <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" />
                          : <Waves className="w-6 h-6 text-gray-400" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 truncate">{item.name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status]}`}>
                            {STATUS_LABELS[item.status]}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {[item.manufacturer, item.model].filter(Boolean).join(' · ') || 'No details'}
                          {item.year ? ` · ${item.year}` : ''}
                        </p>
                      </div>

                      <span className="text-xs text-gray-400 hidden sm:block">{vesselName(item.vessel_id)}</span>

                      <div className="flex items-center gap-1">
                        {userCanCreate && (
                          <>
                            <button onClick={e => { e.stopPropagation(); setEditingItem(item); setShowModal(true); }}
                              className="p-2 hover:bg-gray-100 rounded-lg"><Edit2 className="w-4 h-4 text-gray-500" /></button>
                            <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(item.id); }}
                              className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                          </>
                        )}
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                          {item.manufacturer && <Detail label="Manufacturer" value={item.manufacturer} />}
                          {item.model && <Detail label="Model" value={item.model} />}
                          {item.year && <Detail label="Year" value={String(item.year)} />}
                          {item.engine_type && <Detail label="Engine Type" value={item.engine_type} />}
                          {item.engine_power && <Detail label="Engine Power" value={item.engine_power} />}
                          {item.capacity && <Detail label="Capacity" value={`${item.capacity} pax`} />}
                          {item.serial_number && <Detail label="Serial Number" value={item.serial_number} />}
                          {item.value != null && item.value > 0 && <Detail label="Value" value={`$${Number(item.value).toLocaleString()}`} />}
                          {item.insurance_info && <Detail label="Insurance" value={item.insurance_info} />}
                          <Detail label="Vessel" value={vesselName(item.vessel_id)} />
                        </div>
                        {item.notes && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Notes</p>
                            <p className="text-sm text-gray-700">{item.notes}</p>
                          </div>
                        )}
                        {item.photo_url && (
                          <img src={item.photo_url} alt={item.name} className="rounded-xl max-h-64 object-contain" />
                        )}
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => onNavigate('maintenance', { waterToyId: item.id, waterToyName: item.name })}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            <Eye className="w-4 h-4" /> View Maintenance Tasks
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Modals */}
      {showModal && (
        <WaterToyModal
          item={editingItem}
          vessels={vessels}
          selectedVesselId={selectedVesselId}
          companyId={companyId || currentUser?.company_id || ''}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
          onSaved={() => { setShowModal(false); setEditingItem(null); loadData(); showToast(editingItem ? 'Water toy updated' : 'Water toy added', 'success'); }}
        />
      )}
      {confirmDeleteId && (
        <ConfirmModal
          title="Delete Water Toy"
          message="Are you sure you want to delete this water toy? This cannot be undone."
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
};

const Detail: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-sm font-semibold text-gray-900">{value}</p>
  </div>
);

// ── Modal ──────────────────────────────────────────────────────────────────
const WaterToyModal: React.FC<{
  item: WaterToy | null;
  vessels: VesselOption[];
  selectedVesselId: string | null;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ item, vessels, selectedVesselId, companyId, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(item?.photo_url || null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name:           item?.name || '',
    type:           item?.type || 'Tender' as WaterToyType,
    manufacturer:   item?.manufacturer || '',
    model:          item?.model || '',
    year:           item?.year?.toString() || '',
    engine_type:    item?.engine_type || '',
    engine_power:   item?.engine_power || '',
    capacity:       item?.capacity?.toString() || '',
    serial_number:  item?.serial_number || '',
    value:          item?.value?.toString() || '',
    insurance_info: item?.insurance_info || '',
    notes:          item?.notes || '',
    status:         item?.status || 'active' as WaterToyStatus,
    vessel_id:      item?.vessel_id || (selectedVesselId && selectedVesselId !== 'all' ? selectedVesselId : (vessels.length === 1 ? vessels[0].id : '')),
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Photo must be under 5MB', 'warning'); return; }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !form.name || !form.vessel_id) return;
    setSaving(true);
    try {
      let photo_url = item?.photo_url || null;
      if (photoFile) {
        const ext = photoFile.name.split('.').pop();
        const path = `water-toys/${form.vessel_id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('task-photos').upload(path, photoFile, { upsert: true });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('task-photos').getPublicUrl(path);
          photo_url = urlData.publicUrl;
        }
      }
      let effectiveCompanyId = companyId;
      if (!effectiveCompanyId && form.vessel_id) {
        const { data: v } = await supabase.from('vessels').select('company_id').eq('id', form.vessel_id).single();
        if (v) effectiveCompanyId = v.company_id;
      }
      const payload = {
        vessel_id:      form.vessel_id,
        company_id:     effectiveCompanyId,
        name:           form.name,
        type:           form.type,
        manufacturer:   form.manufacturer || null,
        model:          form.model || null,
        year:           form.year ? parseInt(form.year) : null,
        engine_type:    form.engine_type || null,
        engine_power:   form.engine_power || null,
        capacity:       form.capacity ? parseInt(form.capacity) : null,
        serial_number:  form.serial_number || null,
        value:          form.value ? parseFloat(form.value) : null,
        insurance_info: form.insurance_info || null,
        notes:          form.notes || null,
        status:         form.status,
        photo_url,
      };
      if (item) {
        await dbUpdate('water_toys', item.id, payload);
      } else {
        await dbInsert('water_toys', payload);
      }
      onSaved();
    } catch { showToast('Error saving water toy', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{item ? 'Edit Water Toy' : 'Add Water Toy'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Williams 445 Dieseljet" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select required value={form.type} onChange={e => setForm({ ...form, type: e.target.value as WaterToyType })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                {WATER_TOY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vessel *</label>
              <select required value={form.vessel_id} onChange={e => setForm({ ...form, vessel_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">Select Vessel</option>
                {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
              <input type="text" value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Williams" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input type="text" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 445 Dieseljet" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <input type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="2024" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Engine Type</label>
              <input type="text" value={form.engine_type} onChange={e => setForm({ ...form, engine_type: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Diesel, Electric" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Engine Power</label>
              <input type="text" value={form.engine_power} onChange={e => setForm({ ...form, engine_power: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 110 HP" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
              <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Persons" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
              <input type="text" value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Value ($)</label>
              <input type="number" step="0.01" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as WaterToyStatus })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="active">Active</option>
                <option value="in_service">In Service</option>
                <option value="retired">Retired</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Info</label>
              <input type="text" value={form.insurance_info} onChange={e => setForm({ ...form, insurance_info: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Policy number, provider, expiry..." />
            </div>
          </div>

          {/* Photo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Photo</label>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            {photoPreview ? (
              <div className="flex items-center gap-4">
                <img src={photoPreview} alt="Preview" className="w-20 h-20 object-cover rounded-xl border" />
                <button type="button" onClick={() => photoInputRef.current?.click()} className="text-sm text-blue-600 hover:underline">Change photo</button>
              </div>
            ) : (
              <button type="button" onClick={() => photoInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors w-full justify-center">
                <Camera className="w-4 h-4" /> Upload photo
              </button>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Additional details..." />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg disabled:opacity-50">
              {saving ? 'Saving...' : (item ? 'Save Changes' : 'Add Water Toy')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
