import React, { useState, useEffect } from 'react';
import { X, FileText, ClipboardList, Users, Ship, Map } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase, dbUpdate } from '../../lib/supabase';
import { demoVessels, demoEquipment } from '../../data/demoData';
import { useToast } from '../UI/Toast';
import { MaintenanceManual } from '../../types';

interface EditManualModalProps {
  manual: MaintenanceManual;
  onClose: () => void;
  onSaved?: () => void;
}

interface VesselOption { id: string; name: string; }
interface EquipmentOption { id: string; name: string; vessel_id: string; }

const isDemoUser = (email: string) => email === 'admin@yachtmaintenance.pro';

const UPLOAD_CATEGORIES = [
  { key: 'Manuals',                icon: FileText,      label: 'Manuals',           labelEs: 'Manuales' },
  { key: 'Plans & Drawings',       icon: Map,           label: 'Plans & Drawings',  labelEs: 'Planos y Diagramas' },
  { key: 'Clearances',             icon: ClipboardList, label: 'Clearances',        labelEs: 'Despachos' },
  { key: 'Crew & Guest',           icon: Users,         label: 'Crew & Guest',      labelEs: 'Tripulación e Invitados' },
  { key: 'Vessel Documentation',   icon: Ship,          label: 'Vessel Docs',       labelEs: 'Docs del Barco' },
];

export const EditManualModal: React.FC<EditManualModalProps> = ({ manual, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [title, setTitle] = useState(manual.title);
  const [category, setCategory] = useState(manual.category || 'Manuals');
  const [description, setDescription] = useState(manual.description || '');
  const [vesselId, setVesselId] = useState(manual.vessel_id);
  const [equipmentId, setEquipmentId] = useState(manual.equipment_id || '');
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [equipment, setEquipment] = useState<EquipmentOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadOptions();
  }, [currentUser]);

  useEffect(() => {
    if (vesselId) loadEquipment(vesselId);
  }, [vesselId]);

  const loadOptions = async () => {
    if (!currentUser) return;
    if (isDemoUser(currentUser.email)) {
      const userVessels = currentUser.role === 'master_admin'
        ? demoVessels
        : demoVessels.filter(v => currentUser.vessel_ids.includes(v.id));
      setVessels(userVessels.map(v => ({ id: v.id, name: v.name })));
      const eq = demoEquipment.filter(e => userVessels.some(v => v.id === e.vessel_id));
      setEquipment(eq.map(e => ({ id: e.id, name: e.name, vessel_id: e.vessel_id })));
      return;
    }
    const { data } = await supabase.from('vessels').select('id, name').eq('company_id', currentUser.company_id);
    if (data) setVessels(data);
  };

  const loadEquipment = async (vid: string) => {
    if (!currentUser || isDemoUser(currentUser.email)) return;
    const { data } = await supabase.from('equipment').select('id, name, vessel_id').eq('vessel_id', vid);
    if (data) setEquipment(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !vesselId) { showToast('Please fill in all required fields', 'warning'); return; }
    if (!currentUser) return;
    if (isDemoUser(currentUser.email)) { onClose(); return; }

    setSaving(true);
    try {
      await dbUpdate('maintenance_manuals', manual.id, {
        title,
        category,
        description,
        vessel_id: vesselId,
        equipment_id: equipmentId || null,
      });
      showToast('Document updated', 'success');
      onSaved?.();
      onClose();
    } catch {
      showToast('Error updating document', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredEquipment = equipment.filter(e => e.vessel_id === vesselId);
  const isEs = t('manuals.category') === 'Categoría';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{t('common.edit')} {t('manuals.title').toLowerCase()}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('manuals.manualTitle')} *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('manuals.category')} *</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {UPLOAD_CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const isActive = category === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCategory(cat.key)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      isActive
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{isEs ? cat.labelEs : cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('manuals.manualDesc')}</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vessel *</label>
              <select
                value={vesselId}
                onChange={(e) => { setVesselId(e.target.value); setEquipmentId(''); }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Vessel</option>
                {vessels.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Equipment (Optional)</label>
              <select
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!vesselId}
              >
                <option value="">{t('manuals.selectEquipment')}</option>
                {filteredEquipment.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-500">
              <span className="font-medium text-gray-700">File:</span> {manual.file_name}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !title || !vesselId}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? t('common.loading') : t('common.saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
