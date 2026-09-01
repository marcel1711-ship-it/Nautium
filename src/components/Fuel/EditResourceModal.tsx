import React, { useState, useEffect, useRef } from 'react';
import { X, Fuel, ChevronDown, Trash2 } from 'lucide-react';
import { FuelResource } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

const RESOURCE_TYPE_OPTIONS = [
  'Diesel — Main Engines',
  'Diesel — Generator',
  'Fresh Water',
  'Engine Oil',
  'Hydraulic Oil',
  'Grey Water',
  'Black Water',
  'Other',
];

const UNIT_OPTIONS = ['L', 'kg', 'm³', 'gal', 'qt'];

interface EditResourceModalProps {
  resource: FuelResource;
  vesselName: string;
  onClose: () => void;
  onSave: (updated: Partial<FuelResource>) => void;
  onDelete: () => void;
}

export const EditResourceModal: React.FC<EditResourceModalProps> = ({
  resource,
  vesselName,
  onClose,
  onSave,
  onDelete,
}) => {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    name: resource.name,
    resource_type: resource.resource_type,
    unit: resource.unit,
    capacity: resource.capacity,
    current_level: resource.current_level,
    low_level_alert: resource.low_level_alert,
    notes: resource.notes,
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // combobox state
  const [typeInput, setTypeInput] = useState('');
  const [typeOpen, setTypeOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(resource.resource_type);
  const typeRef = useRef<HTMLDivElement>(null);

  const filteredTypes = RESOURCE_TYPE_OPTIONS.filter(t =>
    t.toLowerCase().includes(typeInput.toLowerCase())
  );
  const showAddNew =
    typeInput.trim().length > 0 &&
    !RESOURCE_TYPE_OPTIONS.some(t => t.toLowerCase() === typeInput.trim().toLowerCase()) &&
    typeInput.trim().toLowerCase() !== selectedType.toLowerCase();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) {
        setTypeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const set = (field: keyof typeof form, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const pctCurrent = form.capacity > 0
    ? Math.min(100, (form.current_level / form.capacity) * 100)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || form.capacity <= 0 || !selectedType) return;
    setSaving(true);
    await onSave({ ...form, resource_type: selectedType });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Fuel className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{t('fuel.editResource')}</h2>
              <p className="text-xs text-gray-500">{vesselName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('fuel.resourceName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Type combobox + Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div ref={typeRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('fuel.resourceType')}</label>
              <div
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent flex items-center gap-2 cursor-text"
                onClick={() => setTypeOpen(true)}
              >
                <input
                  type="text"
                  value={typeInput || selectedType}
                  onChange={e => {
                    setTypeInput(e.target.value);
                    setSelectedType('');
                    setTypeOpen(true);
                  }}
                  onFocus={() => setTypeOpen(true)}
                  placeholder="Select or type..."
                  className="flex-1 outline-none bg-transparent text-gray-900 placeholder-gray-400 text-sm"
                />
                <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${typeOpen ? 'rotate-180' : ''}`} />
              </div>

              {typeOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                  {filteredTypes.map(t => (
                    <button
                      key={t}
                      type="button"
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors ${selectedType === t ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                      onMouseDown={e => {
                        e.preventDefault();
                        setSelectedType(t);
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
                      onMouseDown={e => {
                        e.preventDefault();
                        const val = typeInput.trim();
                        setSelectedType(val);
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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.unit')}</label>
              <div className="relative">
                <select
                  value={form.unit}
                  onChange={e => set('unit', e.target.value)}
                  className="w-full appearance-none px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all"
                >
                  {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Capacity + Low alert */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Tank Capacity ({form.unit}) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.capacity || ''}
                onChange={e => set('capacity', parseFloat(e.target.value) || 0)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {selectedType === 'grey_water' || selectedType === 'black_water' ? 'High Level Alert' : 'Low Level Alert'} ({form.unit})
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.low_level_alert || ''}
                onChange={e => set('low_level_alert', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Current level with live bar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Current Level ({form.unit})
            </label>
            <input
              type="number"
              min="0"
              step="1"
              max={form.capacity || undefined}
              value={form.current_level || ''}
              onChange={e => set('current_level', Math.min(form.capacity, parseFloat(e.target.value) || 0))}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {form.capacity > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>0</span>
                  <span className="font-medium text-gray-600">{pctCurrent.toFixed(0)}%</span>
                  <span>{form.capacity.toLocaleString()} {form.unit}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pctCurrent < 20 ? 'bg-red-500' : pctCurrent < 40 ? 'bg-amber-400' : 'bg-green-500'
                    }`}
                    style={{ width: `${pctCurrent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.notes')}</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            />
          </div>

          {/* Delete zone */}
          <div className="border-t border-gray-100 pt-4">
            {confirmDelete ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-800 mb-3">
                  Delete "{resource.name}"? This will also delete all log entries for this resource. This cannot be undone.
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
                    onClick={onDelete}
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
                Delete resource
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !form.name || form.capacity <= 0 || !selectedType}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t('common.loading') : t('fuel.saveResource')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
