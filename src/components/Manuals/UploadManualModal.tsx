import React, { useState, useEffect, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import { demoVessels, demoEquipment } from '../../data/demoData';
import { useToast } from '../UI/Toast';
import { validateDocumentFile } from '../../lib/security';

interface UploadManualModalProps {
  onClose: () => void;
  onSaved?: () => void;
}

interface VesselOption { id: string; name: string; }
interface EquipmentOption { id: string; name: string; vessel_id: string; }

const isDemoUser = (email: string) => email === 'admin@yachtmaintenance.pro';

export const UploadManualModal: React.FC<UploadManualModalProps> = ({ onClose, onSaved }) => {
  const { currentUser, selectedVesselId } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [vesselId, setVesselId] = useState(selectedVesselId || '');
  const [equipmentId, setEquipmentId] = useState('');
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [equipment, setEquipment] = useState<EquipmentOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadVessels(); }, [currentUser]);
  useEffect(() => {
    if (vessels.length === 1 && !vesselId) setVesselId(vessels[0].id);
  }, [vessels]);
  useEffect(() => {
    setEquipmentId('');
    loadEquipment();
  }, [vesselId]);

  const loadVessels = async () => {
    if (!currentUser) return;

    if (isDemoUser(currentUser.email)) {
      const userVessels = currentUser.role === 'master_admin'
        ? demoVessels
        : demoVessels.filter(v => currentUser.vessel_ids.includes(v.id));
      setVessels(userVessels.map(v => ({ id: v.id, name: v.name })));
      return;
    }

    let query = supabase.from('vessels').select('id, name');
    if (currentUser.role !== 'master_admin' && currentUser.company_id) {
      query = query.eq('company_id', currentUser.company_id);
    } else if (currentUser.vessel_ids.length > 0) {
      query = query.in('id', currentUser.vessel_ids);
    }
    const { data } = await query;
    if (data) setVessels(data);
  };

  const loadEquipment = async () => {
    if (!vesselId) { setEquipment([]); return; }

    if (isDemoUser(currentUser?.email || '')) {
      const filtered = demoEquipment.filter(e => e.vessel_id === vesselId);
      setEquipment(filtered.map(e => ({ id: e.id, name: e.name, vessel_id: e.vessel_id })));
      return;
    }

    const { data } = await supabase.from('equipment').select('id, name, vessel_id').eq('vessel_id', vesselId);
    if (data) setEquipment(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !vesselId) { showToast('Please fill in all required fields', 'warning'); return; }
    if (!currentUser) return;

    if (isDemoUser(currentUser.email)) { onClose(); return; }

    if (!file) { showToast('Please select a file to upload', 'warning'); return; }
    const valErr = validateDocumentFile(file);
    if (valErr) { showToast(valErr, 'warning'); return; }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `manuals/${vesselId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('manuals')
        .upload(filePath, file);

      let fileUrl = '';
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('manuals').getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
      } else {
        fileUrl = '';
      }

      const { error: dbError } = await supabase.from('maintenance_manuals').insert({
        vessel_id: vesselId,
        company_id: currentUser.company_id || null,
        equipment_id: equipmentId || null,
        title,
        description,
        file_name: file.name,
        file_url: fileUrl,
        file_size: file.size,
        uploaded_by_id: currentUser.id,
        uploaded_by_name: currentUser.full_name,
      });

      if (!dbError) {
        onSaved?.();
        onClose();
      } else {
        showToast('Error saving manual. Please try again.', 'error');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{t('manuals.uploadTitle')}</h2>
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
              placeholder="e.g., MTU Engine Operation Manual"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('manuals.manualDesc')}</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Brief description of the manual contents..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vessel *</label>
              <select
                value={vesselId}
                onChange={(e) => setVesselId(e.target.value)}
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
                {equipment.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.name}</option>
                ))}
              </select>
              {vesselId && equipment.length === 0 && (
                <p className="mt-1.5 text-xs text-gray-400">No equipment found for this vessel</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload File {!isDemoUser(currentUser?.email || '') && '*'}
            </label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              {file ? (
                <>
                  <p className="text-gray-900 font-medium">{file.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </>
              ) : (
                <>
                  <p className="text-gray-700 font-medium">Click to upload or drag and drop</p>
                  <p className="text-sm text-gray-500 mt-2">PDF, DOC, DOCX up to 50MB</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg disabled:opacity-50"
            >
              {uploading ? t('common.loading') : t('manuals.uploadBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
