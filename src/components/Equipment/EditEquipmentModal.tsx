import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { demoVessels, demoUsers } from '../../data/demoData';
import { Equipment } from '../../types';
import { useToast } from '../UI/Toast';

interface EditEquipmentModalProps {
  equipment: Equipment;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: (id: string) => void;
}

interface VesselOption { id: string; name: string; }

const EQUIPMENT_TYPES = [
  'Main Engine', 'Auxiliary Engine', 'Generator', 'Pump', 'Compressor',
  'HVAC', 'Navigation', 'Communication', 'Safety Equipment', 'Other',
];

const isDemoUser = (email: string) => demoUsers.some(u => u.email === email);

export const EditEquipmentModal: React.FC<EditEquipmentModalProps> = ({ equipment, onClose, onSaved, onDelete }) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [formData, setFormData] = useState({
    name: equipment.name,
    type: equipment.type,
    manufacturer: equipment.manufacturer || '',
    model: equipment.model || '',
    serial_number: equipment.serial_number || '',
    location: equipment.location || '',
    vessel_id: equipment.vessel_id,
    specifications: (equipment as any).specifications || '',
    installation_date: (equipment as any).installation_date || '',
  });

  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [typeInput, setTypeInput] = useState('');
  const [typeOpen, setTypeOpen] = useState(false);
  const typeRef = useRef<HTMLDivElement>(null);

  const filteredTypes = EQUIPMENT_TYPES.filter(t =>
    t.toLowerCase().includes(typeInput.toLowerCase())
  );
  const showAddNew =
    typeInput.trim().length > 0 &&
    !EQUIPMENT_TYPES.some(t => t.toLowerCase() === typeInput.trim().toLowerCase());

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) {
        setTypeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => { loadVessels(); }, [currentUser]);

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
    if (currentUser.role === 'customer_admin' && currentUser.company_id) {
      query = query.eq('company_id', currentUser.company_id);
    } else if (currentUser.vessel_ids.length > 0) {
      query = query.in('id', currentUser.vessel_ids);
    }
    const { data } = await query;
    if (data) setVessels(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.type || !formData.vessel_id) {
      showToast('Please fill in all required fields', 'warning');
      return;
    }
    if (!currentUser || isDemoUser(currentUser.email)) { onClose(); return; }

    setSaving(true);
    const { error } = await supabase.from('equipment').update({
      name: formData.name,
      type: formData.type,
      manufacturer: formData.manufacturer,
      model: formData.model,
      serial_number: formData.serial_number,
      location: formData.location,
      vessel_id: formData.vessel_id,
      specifications: formData.specifications,
      installation_date: formData.installation_date || null,
    }).eq('id', equipment.id);

    setSaving(false);
    if (!error) { onSaved(); onClose(); }
    else showToast('Error saving equipment. Please try again.', 'error');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Edit Equipment</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Equipment Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div ref={typeRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
              <div
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent flex items-center gap-2 cursor-text"
                onClick={() => setTypeOpen(true)}
              >
                <input
                  type="text"
                  value={typeInput || formData.type}
                  onChange={(e) => {
                    setTypeInput(e.target.value);
                    setFormData({ ...formData, type: '' });
                    setTypeOpen(true);
                  }}
                  onFocus={() => setTypeOpen(true)}
                  placeholder="Select or type..."
                  className="flex-1 outline-none bg-transparent text-gray-900 placeholder-gray-400 text-sm"
                  required={!formData.type}
                />
                <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${typeOpen ? 'rotate-180' : ''}`} />
              </div>
              {typeOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                  {filteredTypes.map(t => (
                    <button
                      key={t}
                      type="button"
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors ${formData.type === t ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                      onMouseDown={(e) => { e.preventDefault(); setFormData({ ...formData, type: t }); setTypeInput(''); setTypeOpen(false); }}
                    >
                      {t}
                    </button>
                  ))}
                  {showAddNew && (
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-sm text-blue-600 font-medium hover:bg-blue-50 transition-colors border-t border-gray-100 flex items-center gap-2"
                      onMouseDown={(e) => { e.preventDefault(); setFormData({ ...formData, type: typeInput.trim() }); setTypeInput(''); setTypeOpen(false); }}
                    >
                      <span className="text-blue-500 font-bold">+</span>
                      Add "{typeInput.trim()}"
                    </button>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vessel *</label>
              <select
                value={formData.vessel_id}
                onChange={(e) => setFormData({ ...formData, vessel_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Vessel</option>
                {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Manufacturer *</label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Serial Number</label>
              <input
                type="text"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Installation Date</label>
              <input
                type="date"
                value={formData.installation_date}
                onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location on Vessel</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Engine Room Deck 2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Specifications & Notes</label>
            <textarea
              value={formData.specifications}
              onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Technical specifications, power ratings, capacity, etc..."
            />
          </div>

          {onDelete && (
            <div className="border-t border-gray-100 pt-4">
              {confirmDelete ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-red-800 mb-3">
                    Delete "{equipment.name}"? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(equipment.id)}
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all"
                    >
                      Delete permanently
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete equipment
                </button>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
