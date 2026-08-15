import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { demoVessels, demoUsers } from '../../data/demoData';
import { useToast } from '../UI/Toast';

interface AddEquipmentModalProps {
  onClose: () => void;
  onSave: (equipment: NewEquipmentData[]) => void;
}

export interface NewEquipmentData {
  name: string;
  type: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  installation_date: string;
  vessel_id: string;
  specifications: string;
  location: string;
}

interface VesselOption {
  id: string;
  name: string;
}

const EQUIPMENT_TYPES = [
  'Main Engine',
  'Auxiliary Engine',
  'Generator',
  'Pump',
  'Compressor',
  'HVAC',
  'Navigation',
  'Communication',
  'Safety Equipment',
  'Other',
];

// Types that commonly come in pairs (Port & Starboard)
const DUAL_TYPES = ['Main Engine', 'Auxiliary Engine', 'Generator'];

const isDemoUser = (email: string) =>
  demoUsers.some(u => u.email === email);

export const AddEquipmentModal: React.FC<AddEquipmentModalProps> = ({ onClose, onSave }) => {
  const { currentUser, selectedVesselId } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState<NewEquipmentData>({
    name: '',
    type: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    installation_date: '',
    vessel_id: selectedVesselId || '',
    specifications: '',
    location: '',
  });
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [typeInput, setTypeInput] = useState('');
  const [typeOpen, setTypeOpen] = useState(false);
  const [isDual, setIsDual] = useState(false);
  const typeRef = useRef<HTMLDivElement>(null);

  const showDualOption = DUAL_TYPES.includes(formData.type);

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

  useEffect(() => {
    loadVessels();
  }, [currentUser]);

  useEffect(() => {
    if (vessels.length === 1 && !formData.vessel_id) {
      setFormData(prev => ({ ...prev, vessel_id: vessels[0].id }));
    }
  }, [vessels]);

  // Reset dual flag if the chosen type no longer supports it
  useEffect(() => {
    if (!showDualOption && isDual) setIsDual(false);
  }, [showDualOption]);

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
    if (currentUser.role === 'master_admin') {
      // no filter
    } else if (currentUser.company_id) {
      query = query.eq('company_id', currentUser.company_id);
    } else if (currentUser.vessel_ids.length > 0) {
      query = query.in('id', currentUser.vessel_ids);
    } else {
      setVessels([]);
      return;
    }
    const { data } = await query;
    if (data) setVessels(data);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.type || !formData.manufacturer || !formData.vessel_id) {
      showToast('Please fill in all required fields', 'warning');
      return;
    }

    if (isDual && showDualOption) {
      const portEntry: NewEquipmentData = { ...formData, name: `${formData.name} — Port` };
      const starboardEntry: NewEquipmentData = { ...formData, name: `${formData.name} — Starboard` };
      onSave([portEntry, starboardEntry]);
    } else {
      onSave([formData]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Add New Equipment</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Equipment Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Main Engine"
              required
            />
            {isDual && showDualOption && (
              <p className="mt-1.5 text-xs text-blue-600">
                Will create: <strong>{formData.name || 'Name'} — Port</strong> and <strong>{formData.name || 'Name'} — Starboard</strong>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div ref={typeRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type *
              </label>
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
                  placeholder="Select or type a type..."
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
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setFormData({ ...formData, type: t });
                        setTypeInput('');
                        setTypeOpen(false);
                      }}
                    >
                      {t}
                    </button>
                  ))}
                  {showAddNew && (
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-sm text-blue-600 font-medium hover:bg-blue-50 transition-colors border-t border-gray-100 flex items-center gap-2"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const newType = typeInput.trim();
                        setFormData({ ...formData, type: newType });
                        setTypeInput('');
                        setTypeOpen(false);
                      }}
                    >
                      <span className="text-blue-500 font-bold">+</span>
                      Add "{typeInput.trim()}"
                    </button>
                  )}
                  {filteredTypes.length === 0 && !showAddNew && (
                    <p className="px-4 py-3 text-sm text-gray-400">No matches found</p>
                  )}
                </div>
              )}

              {showDualOption && (
                <label className="flex items-center gap-2 mt-2.5 text-sm text-blue-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDual}
                    onChange={(e) => setIsDual(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  This vessel has 2 (Port & Starboard)
                </label>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vessel *
              </label>
              <select
                value={formData.vessel_id}
                onChange={(e) => setFormData({ ...formData, vessel_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Vessel</option>
                {vessels.map(vessel => (
                  <option key={vessel.id} value={vessel.id}>
                    {vessel.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Manufacturer *
              </label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Caterpillar"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model
              </label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., C32 ACERT"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Serial Number {isDual && showDualOption && <span className="text-xs text-gray-400 font-normal">(leave blank, fill in per-unit later)</span>}
              </label>
              <input
                type="text"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., SN123456789"
                disabled={isDual && showDualOption}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Installation Date
              </label>
              <input
                type="date"
                value={formData.installation_date}
                onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location on Vessel
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Engine Room Deck 2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Specifications & Notes
            </label>
            <textarea
              value={formData.specifications}
              onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Technical specifications, power ratings, capacity, etc..."
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">
              After adding equipment, you can create maintenance tasks and link manuals to it.
            </p>
          </div>

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
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg"
            >
              {isDual && showDualOption ? 'Add 2 Equipment (Port + Starboard)' : 'Add Equipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
