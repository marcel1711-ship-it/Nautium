import React, { useState, useEffect } from 'react';
import { Ship, Search, Plus, MapPin, Building2, AlertCircle, Mail, Pencil, X, Check, Lock, ArrowLeft, Users, UserCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { demoVessels } from '../data/demoData';
import { AddVesselModal } from '../components/Vessels/AddVesselModal';
import { EditVesselModal } from '../components/Vessels/EditVesselModal';
import { ApprovalThresholdsModal } from '../components/Vessels/ApprovalThresholdsModal';
import { useToast } from '../components/UI/Toast';

interface Vessel {
  id: string;
  company_id: string;
  name: string;
  type: string;
  manufacturer: string;
  model: string;
  year_built: number | null;
  flag: string;
  imo_number: string;
  mmsi: string;
  call_sign: string;
  registration_id: string;
  length_overall: number | null;
  beam: number | null;
  gross_tonnage: number | null;
  location: string;
  notes: string;
  photo_url: string | null;
  notification_email: string | null;
  owner_email?: string | null;
  owner_name?: string | null;
  has_management: boolean;
  requires_approval?: boolean;
  approval_chain?: string;
  company?: { name: string };
}

interface VesselsProps {
  onNavigate: (page: string, params?: any) => void;
  companyId?: string;
  companyName?: string;
}

const VESSEL_TYPE_LABELS: Record<string, string> = {
  motor_yacht: 'Motor Yacht', sailing_yacht: 'Sailing Yacht', catamaran: 'Catamaran',
  explorer_yacht: 'Explorer Yacht', superyacht: 'Superyacht', gulet: 'Gulet', other: 'Other',
};

interface NotificationEmailModalProps {
  vessel: Vessel; onClose: () => void; onSaved: (vesselId: string, email: string | null) => void;
}
const NotificationEmailModal: React.FC<NotificationEmailModalProps> = ({ vessel, onClose, onSaved }) => {
  const [email, setEmail] = useState(vessel.notification_email || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      const { error: updateError } = await supabase.from('vessels').update({ notification_email: email.trim() || null }).eq('id', vessel.id);
      if (updateError) throw updateError;
      onSaved(vessel.id, email.trim() || null);
      onClose();
    } catch (err: any) { setError(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg"><Mail className="w-5 h-5 text-amber-600" /></div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Vessel Notification Email</h3>
              <p className="text-sm text-gray-500">{vessel.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">This person will receive daily alert emails for <strong>{vessel.name}</strong> only.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Owner / Contact Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="owner@example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-transparent" autoFocus />
            <p className="text-xs text-gray-400 mt-1">Leave empty to disable per-vessel notifications.</p>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export const Vessels: React.FC<VesselsProps> = ({ onNavigate, companyId: filterCompanyId, companyName: filterCompanyName }) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterManagement, setFilterManagement] = useState<string>('all');
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingNotifVessel, setEditingNotifVessel] = useState<Vessel | null>(null);
  const [vesselLimit, setVesselLimit] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const { showToast } = useToast();
  const isDemoUser = currentUser?.email === 'admin@yachtmaintenance.pro';
  const [editingVessel, setEditingVessel] = useState<Vessel | null>(null);
  // NEW — holds the vessel_id whose approval thresholds are being configured
  const [approvalThresholdsVesselId, setApprovalThresholdsVesselId] = useState<string | null>(null);

  useEffect(() => { fetchVessels(); }, [currentUser]);

  const fetchVessels = async () => {
    try {
      setIsLoading(true); setError(null);
      if (isDemoUser) {
        const targetCompanyId = filterCompanyId || currentUser?.company_id;
        const companyVessels = targetCompanyId ? demoVessels.filter(v => v.company_id === targetCompanyId) : demoVessels;
        setVessels(companyVessels as any);
        return;
      }
      let query = supabase.from('vessels').select('*, company:companies(name)').order('name', { ascending: true });
      if (filterCompanyId) query = query.eq('company_id', filterCompanyId);
      else if (currentUser?.role === 'customer_admin' && currentUser.company_id) query = query.eq('company_id', currentUser.company_id);
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setVessels(data || []);
      const companyIdForLimit = filterCompanyId || (currentUser?.role === 'customer_admin' ? currentUser.company_id : null);
      if (companyIdForLimit) {
        const { data: company } = await supabase.from('companies').select('vessel_limit').eq('id', companyIdForLimit).maybeSingle();
        if (company) setVesselLimit(company.vessel_limit);
      }
    } catch (err: any) { setError(err.message || 'Failed to load vessels'); }
    finally { setIsLoading(false); }
  };

  const handleNotifSaved = (vesselId: string, email: string | null) => {
    setVessels(prev => prev.map(v => v.id === vesselId ? { ...v, notification_email: email } : v));
    showToast('Notification email updated', 'success');
  };

  const getFilteredVessels = () => {
    let filtered = vessels;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(v =>
        v.name.toLowerCase().includes(term) ||
        (v.registration_id || '').toLowerCase().includes(term) ||
        (v.type || '').toLowerCase().includes(term) ||
        (v.location || '').toLowerCase().includes(term)
      );
    }
    if (filterType !== 'all') filtered = filtered.filter(v => v.type === filterType);
    if (filterManagement === 'managed') filtered = filtered.filter(v => v.has_management);
    if (filterManagement === 'independent') filtered = filtered.filter(v => !v.has_management);
    return filtered;
  };

  const filteredVessels = getFilteredVessels();
  const types = Array.from(new Set(vessels.map(v => v.type).filter(Boolean)));
  const canEditVessel = currentUser?.role === 'master_admin' || currentUser?.role === 'customer_admin';
  const canEditNotif = !isDemoUser && canEditVessel;
  const atVesselLimit = vesselLimit !== null && vessels.length >= vesselLimit;
  const canAddVessel = !isDemoUser && canEditVessel;
  const addVesselCompanyId = filterCompanyId || currentUser?.company_id || '';

  const managedCount = vessels.filter(v => v.has_management).length;
  const independentCount = vessels.filter(v => !v.has_management).length;

  // Resolve vessel name + company_id for the currently open thresholds modal
  const approvalThresholdsVessel = vessels.find(v => v.id === approvalThresholdsVesselId);

  return (
    <div className="space-y-6">
      {filterCompanyName && (
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('customers')} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">
            <ArrowLeft className="w-4 h-4" />Customers
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-900">{filterCompanyName}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            {filterCompanyName ? filterCompanyName : t('vessels.title')}
          </h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">{t('vessels.subtitle')}</p>
          {vesselLimit !== null && (
            <div className="mt-2 flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold leading-5 ${atVesselLimit ? 'bg-red-100 text-red-700' : vessels.length >= vesselLimit * 0.8 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                <Ship className="w-3 h-3" />{vessels.length} / {vesselLimit} vessels
              </div>
              {atVesselLimit && <span className="text-xs text-red-600 font-semibold">Fleet limit reached</span>}
            </div>
          )}
        </div>
        {canAddVessel && (
          atVesselLimit ? (
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-400 rounded-xl font-medium cursor-not-allowed shrink-0 self-start sm:self-auto border border-gray-200">
              <Lock className="w-5 h-5" />{t('vessels.addVessel')}
            </div>
          ) : (
            <button onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shrink-0 self-start sm:self-auto">
              <Plus className="w-5 h-5" />{t('vessels.addVessel')}
            </button>
          )
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={t('vessels.search')}
              className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="all">{t('vessels.allTypes')}</option>
            {types.map(type => <option key={type} value={type}>{VESSEL_TYPE_LABELS[type] || type}</option>)}
          </select>
        </div>

        {/* Management filter pills */}
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => setFilterManagement('all')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-semibold text-xs transition-all ${filterManagement === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
            All
            <span className={`px-1.5 py-0.5 rounded-full font-bold ${filterManagement === 'all' ? 'bg-white/20' : 'bg-gray-100'}`}>{vessels.length}</span>
          </button>
          <button onClick={() => setFilterManagement('managed')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-semibold text-xs transition-all ${filterManagement === 'managed' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-200 hover:border-blue-400'}`}>
            <Users className="w-3.5 h-3.5" />Managed
            <span className={`px-1.5 py-0.5 rounded-full font-bold ${filterManagement === 'managed' ? 'bg-white/20' : 'bg-blue-50'}`}>{managedCount}</span>
          </button>
          <button onClick={() => setFilterManagement('independent')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-semibold text-xs transition-all ${filterManagement === 'independent' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-700 border-green-200 hover:border-green-400'}`}>
            <UserCheck className="w-3.5 h-3.5" />Independent
            <span className={`px-1.5 py-0.5 rounded-full font-bold ${filterManagement === 'independent' ? 'bg-white/20' : 'bg-green-50'}`}>{independentCount}</span>
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600">{t('vessels.loading')}</p>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <p className="text-red-600 font-medium mb-2">{t('vessels.errorLoading')}</p>
            <p className="text-gray-600 mb-4">{error}</p>
            <button onClick={fetchVessels} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{t('common.tryAgain')}</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVessels.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <Ship className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 font-medium mb-1">{t('vessels.notFound')}</p>
                <p className="text-sm text-gray-500">{vessels.length === 0 ? t('vessels.createdWithCustomers') : t('vessels.adjustFilters')}</p>
              </div>
            ) : (
              filteredVessels.map(vessel => (
                <div key={vessel.id} className="border border-gray-200 rounded-2xl hover:border-blue-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.09)] hover:-translate-y-0.5 transition-all overflow-hidden">
                  <div className="cursor-pointer" onClick={() => onNavigate('vessel-detail', { vesselId: vessel.id })}>
                    {vessel.photo_url ? (
                      <div className="relative h-44 overflow-hidden">
                        <img src={vessel.photo_url} alt={vessel.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        {/* Management badge on photo */}
                        <div className="absolute top-3 left-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border backdrop-blur-sm ${vessel.has_management ? 'bg-blue-900/60 text-blue-200 border-blue-400/40' : 'bg-green-900/60 text-green-200 border-green-400/40'}`}>
                            {vessel.has_management ? <Users className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                            {vessel.has_management ? 'Managed' : 'Independent'}
                          </span>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <h3 className="text-lg font-bold text-white truncate">{vessel.name}</h3>
                          <span className="inline-block mt-1 px-2 py-0.5 bg-white/20 backdrop-blur-sm text-white rounded-lg text-xs font-medium">
                            {VESSEL_TYPE_LABELS[vessel.type] || vessel.type || t('common.unknown')}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-24 bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-between px-4">
                        <Ship className="w-10 h-10 text-white/50" />
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${vessel.has_management ? 'bg-blue-400/20 text-blue-100 border-blue-300/40' : 'bg-green-400/20 text-green-100 border-green-300/40'}`}>
                          {vessel.has_management ? <Users className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                          {vessel.has_management ? 'Managed' : 'Independent'}
                        </span>
                      </div>
                    )}

                    <div className="p-5">
                      {!vessel.photo_url && (
                        <div className="mb-4">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">{vessel.name}</h3>
                          <span className="inline-block mt-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                            {VESSEL_TYPE_LABELS[vessel.type] || vessel.type || t('common.unknown')}
                          </span>
                        </div>
                      )}
                      <div className="space-y-2">
                        {vessel.registration_id && (
                          <div>
                            <p className="text-xs text-gray-500">{t('vessels.registrationId')}</p>
                            <p className="text-sm font-medium text-gray-900">{vessel.registration_id}</p>
                          </div>
                        )}
                        {vessel.year_built && (
                          <div>
                            <p className="text-xs text-gray-500">{t('vessels.yearBuilt')}</p>
                            <p className="text-sm font-medium text-gray-900">{vessel.year_built}</p>
                          </div>
                        )}
                        {vessel.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <p className="text-sm text-gray-700">{vessel.location}</p>
                          </div>
                        )}
                        {vessel.company && (
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <p className="text-sm text-gray-700 truncate">{vessel.company.name}</p>
                          </div>
                        )}
                      </div>
                      {vessel.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-sm text-gray-600 line-clamp-2">{vessel.notes}</p>
                        </div>
                      )}
                      {(vessel.length_overall || vessel.flag) && (
                        <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4">
                          {vessel.length_overall && <div><p className="text-xs text-gray-500">{t('vessels.loa')}</p><p className="text-sm font-medium text-gray-900">{vessel.length_overall}m</p></div>}
                          {vessel.flag && <div><p className="text-xs text-gray-500">{t('vessels.flag')}</p><p className="text-sm font-medium text-gray-900">{vessel.flag}</p></div>}
                        </div>
                      )}
                    </div>
                  </div>

                  {canEditVessel && (
                    <div className="px-5 pb-5 pt-0 space-y-2">
                      <button onClick={e => { e.stopPropagation(); setEditingVessel(vessel); }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 text-sm transition-all">
                        <Pencil className="w-3.5 h-3.5" />Edit Vessel
                      </button>
                      {canEditNotif && (
                        <button onClick={e => { e.stopPropagation(); setEditingNotifVessel(vessel); }}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${vessel.notification_email ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100' : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <Mail className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{vessel.notification_email || 'Set vessel notification email'}</span>
                          </div>
                          <Pencil className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {editingNotifVessel && <NotificationEmailModal vessel={editingNotifVessel} onClose={() => setEditingNotifVessel(null)} onSaved={handleNotifSaved} />}

      {editingVessel && (
        <EditVesselModal
          vessel={editingVessel}
          onClose={() => setEditingVessel(null)}
          onSuccess={() => { setEditingVessel(null); showToast('Vessel updated', 'success'); fetchVessels(); }}
          // NEW — opens the thresholds modal for this same vessel, on top of Edit
          onOpenApprovalThresholds={(vesselId) => setApprovalThresholdsVesselId(vesselId)}
        />
      )}

      {showAddModal && addVesselCompanyId && (
        <AddVesselModal companyId={addVesselCompanyId} vesselLimit={vesselLimit ?? 1} currentCount={vessels.length}
          onClose={() => setShowAddModal(false)} onSuccess={() => { setShowAddModal(false); fetchVessels(); }} />
      )}

      {/* NEW — approval thresholds modal, rendered on top when opened from within EditVesselModal */}
      {approvalThresholdsVesselId && approvalThresholdsVessel && (
        <ApprovalThresholdsModal
          vesselId={approvalThresholdsVesselId}
          vesselName={approvalThresholdsVessel.name}
          companyId={approvalThresholdsVessel.company_id}
          onClose={() => setApprovalThresholdsVesselId(null)}
        />
      )}
    </div>
  );
};
