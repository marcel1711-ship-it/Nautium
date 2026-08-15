import React, { useState } from 'react';
import { X, Fuel, Droplets, Plus, Minus } from 'lucide-react';
import { FuelResource } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface LogFuelEntryModalProps {
  resource: FuelResource;
  initialEntryType?: 'refill' | 'consumption';
  onClose: () => void;
  onSave: (entry: {
    entry_type: 'refill' | 'consumption';
    quantity: number;
    price_per_unit: number | null;
    total_cost: number | null;
    currency: string;
    supplier: string;
    location: string;
    engine_hours: number | null;
    notes: string;
    log_date: string;
  }) => void;
}

export const LogFuelEntryModal: React.FC<LogFuelEntryModalProps> = ({ resource, initialEntryType, onClose, onSave }) => {
  const { t } = useLanguage();
  const today = new Date().toISOString().split('T')[0];
  const [entryType, setEntryType] = useState<'refill' | 'consumption'>(initialEntryType ?? 'refill');
  const [quantity, setQuantity] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [supplier, setSupplier] = useState('');
  const [location, setLocation] = useState('');
  const [engineHours, setEngineHours] = useState('');
  const [notes, setNotes] = useState('');
  const [logDate, setLogDate] = useState(today);
  const [saving, setSaving] = useState(false);

  const qty = parseFloat(quantity) || 0;
  const ppu = parseFloat(pricePerUnit) || null;
  const totalCost = ppu && qty ? parseFloat((ppu * qty).toFixed(2)) : null;

  const isConsumable = ['fresh_water', 'grey_water', 'black_water'].includes(resource.resource_type);
  const isDiesel = resource.resource_type === 'diesel_main' || resource.resource_type === 'diesel_generator';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qty || qty <= 0) return;
    setSaving(true);
    await onSave({
      entry_type: entryType,
      quantity: qty,
      price_per_unit: ppu,
      total_cost: totalCost,
      currency,
      supplier,
      location,
      engine_hours: engineHours ? parseFloat(engineHours) : null,
      notes,
      log_date: logDate,
    });
    setSaving(false);
  };

  const maxRefill = resource.capacity - resource.current_level;
  const maxConsume = resource.current_level;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Fuel className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t('fuel.logEntry')}</h2>
              <p className="text-sm text-gray-500">{resource.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Current level indicator */}
        <div className="mx-6 mt-5 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Current level</span>
            <span className="text-sm font-semibold text-gray-900">
              {resource.current_level.toLocaleString()} / {resource.capacity.toLocaleString()} {resource.unit}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                resource.current_level / resource.capacity < 0.2
                  ? 'bg-red-500'
                  : resource.current_level / resource.capacity < 0.4
                  ? 'bg-amber-400'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, (resource.current_level / resource.capacity) * 100)}%` }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Entry type toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setEntryType('refill')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                entryType === 'refill'
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Plus className="w-4 h-4" />
              {t('fuel.refillType')}
            </button>
            <button
              type="button"
              onClick={() => setEntryType('consumption')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                entryType === 'consumption'
                  ? 'bg-white text-orange-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Minus className="w-4 h-4" />
              {t('fuel.consumptionType')}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Quantity */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Quantity ({resource.unit}) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                max={entryType === 'refill' ? maxRefill : maxConsume}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder={`Max ${(entryType === 'refill' ? maxRefill : maxConsume).toLocaleString()} ${resource.unit}`}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Price per unit — only for refills that cost money */}
            {entryType === 'refill' && !isConsumable && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Price / {resource.unit}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={pricePerUnit}
                    onChange={e => setPricePerUnit(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('fuel.currency')}</label>
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  >
                    {['EUR', 'USD', 'GBP', 'CHF'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Total cost display */}
            {totalCost !== null && (
              <div className="col-span-2 flex items-center justify-between px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                <span className="text-sm text-green-700">Total cost</span>
                <span className="text-base font-bold text-green-800">
                  {currency} {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('fuel.logDate')} <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={logDate}
                onChange={e => setLogDate(e.target.value)}
                max={today}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Engine hours — only for diesel */}
            {isDiesel && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('fuel.engineHours')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={engineHours}
                  onChange={e => setEngineHours(e.target.value)}
                  placeholder="e.g. 4920"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            )}

            {/* Supplier */}
            {entryType === 'refill' && (
              <div className={isDiesel ? '' : 'col-span-2'}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('fuel.supplierLabel')}</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  placeholder="e.g. Repsol Marina"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            )}

            {/* Location */}
            <div className={entryType === 'refill' && isDiesel ? 'col-span-2' : entryType === 'refill' ? '' : 'col-span-2'}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('fuel.locationLabel')}</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder={entryType === 'refill' ? 'e.g. Palma de Mallorca' : 'e.g. Palma → Ibiza'}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Notes */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.notes')}</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Additional details..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !qty || qty <= 0}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all disabled:opacity-50 ${
                entryType === 'refill'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
              }`}
            >
              {saving ? t('common.loading') : t('fuel.saveEntry')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
