import React, { useState, useEffect } from 'react';
import { FileText, Upload, Search, Download, Trash2, Filter, ChevronDown, BookOpen, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, fetchByCompany } from '../lib/supabase';
import { useToast } from '../components/UI/Toast';
import { demoMaintenanceManuals, demoEquipment, demoVessels } from '../data/demoData';
import { formatFileSize, formatDateTime } from '../utils/helpers';
import { UploadManualModal } from '../components/Manuals/UploadManualModal';
import { MaintenanceManual } from '../types';

interface ManualsProps {
  onNavigate: (page: string, params?: any) => void;
}

interface VesselOption { id: string; name: string; }
interface EquipmentOption { id: string; name: string; vessel_id: string; }

const isDemoUser = (email: string) => email === 'admin@yachtmaintenance.pro';

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: 'bg-red-100 text-red-700',
  doc: 'bg-blue-100 text-blue-700',
  docx: 'bg-blue-100 text-blue-700',
};

function getFileExt(fileName: string) {
  return fileName?.split('.').pop()?.toLowerCase() || 'file';
}

export const Manuals: React.FC<ManualsProps> = ({ onNavigate }) => {
  const { currentUser, selectedVesselId } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVessel, setFilterVessel] = useState<string>('all');
  const [filterEquipment, setFilterEquipment] = useState<string>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [manuals, setManuals] = useState<MaintenanceManual[]>([]);
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [equipment, setEquipment] = useState<EquipmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [currentUser, selectedVesselId]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);

    if (isDemoUser(currentUser.email)) {
      let filtered = demoMaintenanceManuals;
      const userVessels = currentUser.role === 'master_admin'
        ? demoVessels
        : demoVessels.filter(v => currentUser.vessel_ids.includes(v.id));
      const vesselIds = userVessels.map(v => v.id);

      if (selectedVesselId) {
        filtered = filtered.filter(m => m.vessel_id === selectedVesselId);
      } else if (currentUser.role !== 'master_admin') {
        filtered = filtered.filter(m => vesselIds.includes(m.vessel_id));
      }

      setManuals(filtered as MaintenanceManual[]);
      setVessels(userVessels.map(v => ({ id: v.id, name: v.name })));

      const eqFiltered = demoEquipment.filter(e => vesselIds.includes(e.vessel_id));
      setEquipment(eqFiltered.map(e => ({ id: e.id, name: e.name, vessel_id: e.vessel_id })));
      setLoading(false);
      return;
    }

    const cid = currentUser.company_id;
    if (!cid) { setLoading(false); return; }

    const [manuals, vessels, equipment] = await Promise.all([
      fetchByCompany('maintenance_manuals', cid, 'created_at', false),
      fetchByCompany('vessels', cid, 'name', true),
      fetchByCompany('equipment', cid, 'name', true),
    ]);

    setManuals(manuals);
    setVessels(vessels.map((v: any) => ({ id: v.id, name: v.name })));
    setEquipment(equipment.map((e: any) => ({ id: e.id, name: e.name, vessel_id: e.vessel_id })));

    setLoading(false);
  };

  const handleDelete = async (manualId: string) => {
    if (!currentUser || isDemoUser(currentUser.email)) return;
    const { error } = await supabase.from('maintenance_manuals').delete().eq('id', manualId);
    if (!error) { showToast('Manual deleted', 'success'); setDeleteConfirm(null); loadData(); }
  };

  const getFilteredManuals = () => {
    let filtered = manuals;

    if (filterVessel !== 'all') filtered = filtered.filter(m => m.vessel_id === filterVessel);
    if (filterEquipment !== 'all') {
      filtered = filtered.filter(m => m.equipment_id === filterEquipment);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(m =>
        m.title.toLowerCase().includes(term) ||
        m.description?.toLowerCase().includes(term) ||
        m.file_name?.toLowerCase().includes(term)
      );
    }

    return filtered;
  };

  const filtered = getFilteredManuals();
  const getVesselName = (vesselId: string) => vessels.find(v => v.id === vesselId)?.name || null;
  const getEquipmentName = (equipmentId: string | null) =>
    equipmentId ? equipment.find(e => e.id === equipmentId)?.name || null : null;

  const filteredEquipmentOptions = filterVessel !== 'all'
    ? equipment.filter(e => e.vessel_id === filterVessel)
    : equipment;

  const isDemo = isDemoUser(currentUser?.email || '');

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight">{t('manuals.title')}</h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">{t('manuals.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl shrink-0 self-start sm:self-auto"
        >
          <Upload className="w-5 h-5" />
          {t('manuals.upload')}
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.09)] hover:-translate-y-0.5 transition-all">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.08em]">{t('manuals.totalManuals')}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1.5">{manuals.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.09)] hover:-translate-y-0.5 transition-all">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.08em]">{t('manuals.vesselsCovered')}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1.5">
            {new Set(manuals.map(m => m.vessel_id)).size}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.09)] hover:-translate-y-0.5 transition-all">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.08em]">{t('manuals.equipmentLinked')}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1.5">
            {manuals.filter(m => m.equipment_id).length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-7">
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-bold text-gray-900">{t('common.filters')}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('manuals.search')}
              className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="relative">
            <select
              value={filterVessel}
              onChange={(e) => { setFilterVessel(e.target.value); setFilterEquipment('all'); }}
              className="w-full appearance-none px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
            >
              <option value="all">{t('common.allVessels')}</option>
              {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={filterEquipment}
              onChange={(e) => setFilterEquipment(e.target.value)}
              className="w-full appearance-none px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
              disabled={filteredEquipmentOptions.length === 0}
            >
              <option value="all">{t('manuals.allEquipment')}</option>
              {filteredEquipmentOptions.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600">
            {t('manuals.showing')} <span className="font-semibold text-gray-900">{filtered.length}</span> {filtered.length === 1 ? t('manuals.manual') : t('manuals.manuals')}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-52 bg-gray-50 rounded-2xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-700 font-semibold text-lg">{t('manuals.notFound')}</p>
            <p className="text-sm text-gray-500 mt-2">
              {searchTerm || filterVessel !== 'all' || filterEquipment !== 'all'
                ? t('manuals.adjustFilters')
                : t('manuals.uploadFirst')}
            </p>
            {!searchTerm && filterVessel === 'all' && filterEquipment === 'all' && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="mt-4 flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors mx-auto"
              >
                <Upload className="w-4 h-4" />
                {t('manuals.upload')}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(manual => {
              const equipmentName = getEquipmentName(manual.equipment_id);
              const vesselName = getVesselName(manual.vessel_id);
              const ext = getFileExt(manual.file_name);
              const extColor = FILE_TYPE_COLORS[ext] || 'bg-gray-100 text-gray-700';

              return (
                <div
                  key={manual.id}
                  className="p-5 bg-gray-50 border border-transparent rounded-2xl hover:bg-white hover:border-gray-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.09)] hover:-translate-y-0.5 transition-all flex flex-col"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-3 bg-blue-50 rounded-xl flex-shrink-0">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 leading-tight">{manual.title}</h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${extColor}`}>
                          {ext}
                        </span>
                        <span className="text-xs text-gray-500">{formatFileSize(manual.file_size)}</span>
                      </div>
                    </div>
                  </div>

                  {manual.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2 flex-grow">{manual.description}</p>
                  )}

                  <div className="space-y-1.5 mb-4 mt-auto">
                    {vesselName && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <span className="text-gray-400">Vessel:</span>
                        <span className="font-medium text-gray-800">{vesselName}</span>
                      </div>
                    )}
                    {equipmentName && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <span className="text-gray-400">Equipment:</span>
                        <span className="font-medium text-gray-800">{equipmentName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span>Uploaded by {manual.uploaded_by_name}</span>
                      <span className="text-gray-300">·</span>
                      <span>{formatDateTime(manual.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    {manual.file_url ? (
                      <a
                        href={manual.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {t('common.open')}
                      </a>
                    ) : (
                      <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-gray-100 text-gray-400 rounded-xl text-sm font-medium cursor-not-allowed">
                        <Download className="w-4 h-4" />
                        {t('common.noFile')}
                      </div>
                    )}
                    {!isDemo && (
                      deleteConfirm === manual.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDelete(manual.id)}
                            className="px-3 py-2.5 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700 transition-colors"
                          >
                            {t('common.confirm')}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-3 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(manual.id)}
                          className="px-3 py-2.5 border border-gray-200 text-gray-500 rounded-xl hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                          title={t('manuals.deleteManual')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showUploadModal && (
        <UploadManualModal
          onClose={() => setShowUploadModal(false)}
          onSaved={loadData}
        />
      )}
    </div>
  );
};
