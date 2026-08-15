import React, { useState, useEffect } from 'react';
import {
  Plus, Search, Star, Phone, Mail, Globe, MapPin,
  Anchor, Wrench, Zap, Layers, Wind, Droplets,
  Shield, Waves, MoreHorizontal, Edit2, Trash2,
  X, Check, ChevronDown, Building2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/UI/Toast';
import { ConfirmModal } from '../components/UI/ConfirmModal';
import { canCreate, UserRole } from '../types';

interface ContractorsProps {
  onNavigate: (page: string, params?: any) => void;
}

interface Contractor {
  id: string;
  company_id: string;
  name: string;
  company_name: string | null;
  specialty: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  port_base: string | null;
  website: string | null;
  notes: string | null;
  rating: number | null;
  is_preferred: boolean;
  vessels_worked_with: string[];
  created_at: string;
}

const SPECIALTIES = [
  { value: 'Engine',                    label: 'Engine & Propulsion',       icon: Wrench,        color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  { value: 'Electrical',                label: 'Electrical & Electronics',  icon: Zap,           color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  { value: 'Hull & Paint',              label: 'Hull & Paint',              icon: Layers,        color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  { value: 'HVAC',                      label: 'HVAC & Refrigeration',      icon: Wind,          color: 'text-cyan-600',   bg: 'bg-cyan-50',   border: 'border-cyan-200' },
  { value: 'Navigation & Electronics',  label: 'Navigation & Electronics',  icon: Anchor,        color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  { value: 'Rigging',                   label: 'Rigging & Sails',           icon: Wind,          color: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200' },
  { value: 'Plumbing',                  label: 'Plumbing & Watermakers',    icon: Droplets,      color: 'text-teal-600',   bg: 'bg-teal-50',   border: 'border-teal-200' },
  { value: 'Interior',                  label: 'Interior & Upholstery',     icon: Layers,        color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  { value: 'Safety & Fire',             label: 'Safety & Fire Systems',     icon: Shield,        color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
  { value: 'Diving',                    label: 'Diving & Underwater',       icon: Waves,         color: 'text-emerald-600',bg: 'bg-emerald-50',border: 'border-emerald-200' },
  { value: 'Other',                     label: 'Other',                     icon: MoreHorizontal,color: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-200' },
];

const getSpecialty = (value: string) =>
  SPECIALTIES.find(s => s.value === value) || SPECIALTIES[SPECIALTIES.length - 1];

const StarRating: React.FC<{ rating: number | null; onChange?: (r: number) => void; readonly?: boolean }> = ({ rating, onChange, readonly }) => (
  <div className="flex items-center gap-0.5">
    {[1,2,3,4,5].map(i => (
      <button key={i} type="button" disabled={readonly}
        onClick={() => onChange?.(i)}
        className={`${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}>
        <Star className={`w-4 h-4 ${i <= (rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
      </button>
    ))}
  </div>
);

const ContractorModal: React.FC<{
  contractor?: Contractor | null;
  companyId: string;
  currentUserId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ contractor, companyId, currentUserId, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name:         contractor?.name || '',
    company_name: contractor?.company_name || '',
    specialty:    contractor?.specialty || 'Engine',
    phone:        contractor?.phone || '',
    email:        contractor?.email || '',
    location:     contractor?.location || '',
    port_base:    contractor?.port_base || '',
    website:      contractor?.website || '',
    notes:        contractor?.notes || '',
    rating:       contractor?.rating || null as number | null,
    is_preferred: contractor?.is_preferred || false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.specialty) return;
    setSaving(true);
    try {
      const payload = {
        company_id:   companyId,
        name:         form.name,
        company_name: form.company_name || null,
        specialty:    form.specialty,
        phone:        form.phone || null,
        email:        form.email || null,
        location:     form.location || null,
        port_base:    form.port_base || null,
        website:      form.website || null,
        notes:        form.notes || null,
        rating:       form.rating,
        is_preferred: form.is_preferred,
        created_by:   currentUserId,
        updated_at:   new Date().toISOString(),
      };
      if (contractor) {
        await supabase.from('contractors').update(payload).eq('id', contractor.id);
        showToast('Contractor updated', 'success');
      } else {
        await supabase.from('contractors').insert(payload);
        showToast('Contractor added', 'success');
      }
      onSaved();
    } catch {
      showToast('Error saving contractor', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {contractor ? 'Edit contractor' : 'Add contractor'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Name + Company */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contact name *</label>
              <input type="text" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="John Smith" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Company name</label>
              <input type="text" value={form.company_name}
                onChange={e => setForm({ ...form, company_name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Marine Services Inc." />
            </div>
          </div>

          {/* Specialty */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Specialty *</label>
            <div className="grid grid-cols-2 gap-2">
              {SPECIALTIES.map(s => {
                const Icon = s.icon;
                const isActive = form.specialty === s.value;
                return (
                  <button key={s.value} type="button"
                    onClick={() => setForm({ ...form, specialty: s.value })}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${isActive ? `${s.bg} ${s.border} border ${s.color}` : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}>
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input type="tel" value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+1 (954) 555-0100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input type="email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="john@marineservices.com" />
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location / City</label>
              <input type="text" value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Fort Lauderdale, FL" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Port base</label>
              <input type="text" value={form.port_base}
                onChange={e => setForm({ ...form, port_base: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Port Everglades" />
            </div>
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
            <input type="url" value={form.website}
              onChange={e => setForm({ ...form, website: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://marineservices.com" />
          </div>

          {/* Rating + Preferred */}
          <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Rating</p>
              <StarRating rating={form.rating} onChange={r => setForm({ ...form, rating: r })} />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input type="checkbox" checked={form.is_preferred}
                  onChange={e => setForm({ ...form, is_preferred: e.target.checked })}
                  className="sr-only" />
                <div className={`w-11 h-6 rounded-full transition-colors ${form.is_preferred ? 'bg-blue-600' : 'bg-gray-300'}`} />
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_preferred ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">Preferred</span>
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Response time, payment terms, languages spoken..." />
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-200">
            <button type="button" onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg disabled:opacity-50">
              {saving ? 'Saving...' : contractor ? 'Save changes' : 'Add contractor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const Contractors: React.FC<ContractorsProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('all');
  const [filterPreferred, setFilterPreferred] = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const role = currentUser?.role as UserRole;
  const canEdit = canCreate(role) || ['fleet_manager', 'customer_admin'].includes(role);

  useEffect(() => { if (currentUser) loadContractors(); }, [currentUser]);

  const loadContractors = async () => {
    if (!currentUser?.company_id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('contractors')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .order('is_preferred', { ascending: false })
        .order('rating', { ascending: false })
        .order('name', { ascending: true });
      setContractors(data || []);
    } catch { showToast('Error loading contractors', 'error'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('contractors').delete().eq('id', id);
      setContractors(prev => prev.filter(c => c.id !== id));
      showToast('Contractor removed', 'success');
    } catch { showToast('Error removing contractor', 'error'); }
    finally { setConfirmDeleteId(null); }
  };

  const filtered = contractors.filter(c => {
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.location?.toLowerCase().includes(search.toLowerCase()) ||
      c.port_base?.toLowerCase().includes(search.toLowerCase());
    const matchSpecialty = filterSpecialty === 'all' || c.specialty === filterSpecialty;
    const matchPreferred = !filterPreferred || c.is_preferred;
    return matchSearch && matchSpecialty && matchPreferred;
  });

  const preferred    = filtered.filter(c => c.is_preferred);
  const nonPreferred = filtered.filter(c => !c.is_preferred);

  return (
    <div className="space-y-6 pt-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Preferred Contractors
          </h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-sm">
            Your trusted network of marine service providers
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setEditingContractor(null); setShowModal(true); }}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg self-start sm:self-auto"
          >
            <Plus className="w-5 h-5" />Add contractor
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm flex-1 min-w-48">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text" value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, company, location..."
            className="bg-transparent outline-none text-sm text-gray-700 w-full placeholder-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Specialty filter */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
          <Wrench className="w-4 h-4 text-gray-400" />
          <select value={filterSpecialty} onChange={e => setFilterSpecialty(e.target.value)}
            className="text-sm font-medium text-gray-700 bg-transparent outline-none">
            <option value="all">All specialties</option>
            {SPECIALTIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* Preferred toggle */}
        <button
          onClick={() => setFilterPreferred(!filterPreferred)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-semibold text-sm transition-all ${filterPreferred ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}
        >
          <Star className={`w-4 h-4 ${filterPreferred ? 'text-amber-500 fill-amber-500' : 'text-gray-400'}`} />
          Preferred only
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total contractors', value: contractors.length, color: 'text-gray-900' },
          { label: 'Preferred',         value: contractors.filter(c => c.is_preferred).length, color: 'text-amber-600' },
          { label: 'Specialties',       value: new Set(contractors.map(c => c.specialty)).size, color: 'text-blue-600' },
          { label: 'Avg rating',        value: contractors.filter(c => c.rating).length > 0 ? (contractors.filter(c => c.rating).reduce((s, c) => s + (c.rating || 0), 0) / contractors.filter(c => c.rating).length).toFixed(1) : '—', color: 'text-emerald-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className={`text-2xl font-extrabold ${stat.color} tabular-nums`}>{stat.value}</p>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-48 bg-white rounded-2xl animate-pulse border border-gray-200" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">
            {contractors.length === 0 ? 'No contractors yet' : 'No contractors match your filters'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {contractors.length === 0 ? 'Add your trusted marine service providers.' : 'Try adjusting your search or filters.'}
          </p>
          {canEdit && contractors.length === 0 && (
            <button onClick={() => { setEditingContractor(null); setShowModal(true); }}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4" />Add first contractor
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Preferred section */}
          {preferred.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Preferred</h2>
                <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">{preferred.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {preferred.map(c => (
                  <ContractorCard key={c.id} contractor={c} canEdit={canEdit}
                    onEdit={() => { setEditingContractor(c); setShowModal(true); }}
                    onDelete={() => setConfirmDeleteId(c.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Rest */}
          {nonPreferred.length > 0 && (
            <div>
              {preferred.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Other contractors</h2>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-bold">{nonPreferred.length}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {nonPreferred.map(c => (
                  <ContractorCard key={c.id} contractor={c} canEdit={canEdit}
                    onEdit={() => { setEditingContractor(c); setShowModal(true); }}
                    onDelete={() => setConfirmDeleteId(c.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <ContractorModal
          contractor={editingContractor}
          companyId={currentUser?.company_id || ''}
          currentUserId={currentUser?.id || ''}
          onClose={() => { setShowModal(false); setEditingContractor(null); }}
          onSaved={() => { setShowModal(false); setEditingContractor(null); loadContractors(); }}
        />
      )}

      {confirmDeleteId && (
        <ConfirmModal
          title="Remove contractor"
          message="This will permanently remove this contractor from your list."
          confirmLabel="Remove"
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
};

/* ── Contractor Card ─────────────────────────────────────────────────────── */
const ContractorCard: React.FC<{
  contractor: Contractor;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ contractor: c, canEdit, onEdit, onDelete }) => {
  const spec = getSpecialty(c.specialty);
  const Icon = spec.icon;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${c.is_preferred ? 'border-amber-200' : 'border-gray-200'}`}>
      {/* Top accent bar for preferred */}
      {c.is_preferred && <div className="h-1 bg-gradient-to-r from-amber-400 to-amber-500" />}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl ${spec.bg} ${spec.border} border flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${spec.color}`} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 truncate">{c.name}</h3>
              {c.company_name && <p className="text-xs text-gray-500 truncate">{c.company_name}</p>}
            </div>
          </div>
          {c.is_preferred && (
            <div className="flex-shrink-0">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            </div>
          )}
        </div>

        {/* Specialty badge */}
        <div className="mb-3">
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${spec.bg} ${spec.color} border ${spec.border}`}>
            {spec.label}
          </span>
        </div>

        {/* Rating */}
        {c.rating && (
          <div className="mb-3">
            <StarRating rating={c.rating} readonly />
          </div>
        )}

        {/* Contact info */}
        <div className="space-y-1.5 mb-3">
          {c.location && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{c.location}{c.port_base ? ` · ${c.port_base}` : ''}</span>
            </div>
          )}
          {c.phone && (
            <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 transition-colors">
              <Phone className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{c.phone}</span>
            </a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 transition-colors truncate">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{c.email}</span>
            </a>
          )}
          {c.website && (
            <a href={c.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 transition-colors">
              <Globe className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{c.website.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
        </div>

        {/* Notes */}
        {c.notes && (
          <p className="text-xs text-gray-500 italic line-clamp-2 mb-3">{c.notes}</p>
        )}

        {/* Actions */}
        {canEdit && (
          <div className="flex gap-2 pt-3 border-t border-gray-100">
            <button onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-100 transition-colors">
              <Edit2 className="w-3.5 h-3.5" />Edit
            </button>
            <button onClick={onDelete}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
