import React, { useState } from 'react';
import { X, Plus, Minus, RotateCcw } from 'lucide-react';
import { InventoryItem } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

type MovementType = 'in' | 'out' | 'adjustment';

const REASONS: Record<MovementType, string[]> = {
  in: ['Restocking', 'Purchase', 'Transfer in', 'Return to stock', 'Other'],
  out: ['Used in maintenance', 'Consumed', 'Transfer out', 'Damaged/Disposed', 'Other'],
  adjustment: ['Inventory count correction', 'System correction', 'Other'],
};

interface AdjustStockModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSave: (movementType: MovementType, quantity: number, reason: string, notes: string) => void;
}

export const AdjustStockModal: React.FC<AdjustStockModalProps> = ({ item, onClose, onSave }) => {
  const { t } = useLanguage();
  const [movementType, setMovementType] = useState<MovementType>('in');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState(REASONS.in[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const newStock =
    movementType === 'in'
      ? item.current_stock + quantity
      : movementType === 'out'
      ? item.current_stock - quantity
      : quantity;

  const isNegativeStock = newStock < 0;

  const handleTypeChange = (t: MovementType) => {
    setMovementType(t);
    setReason(REASONS[t][0]);
    if (t === 'adjustment') setQuantity(item.current_stock);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0 && movementType !== 'adjustment') return;
    if (isNegativeStock) return;
    setSaving(true);
    await onSave(movementType, quantity, reason, notes);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t('inventory.adjustStock')}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{item.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Current stock badge */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">Current stock</span>
            <span className="font-bold text-gray-900 text-lg">
              {item.current_stock} <span className="text-sm font-normal text-gray-500">{item.unit_of_measure}</span>
            </span>
          </div>

          {/* Movement type tabs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('inventory.adjustmentType')}</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange('in')}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-sm font-semibold ${
                  movementType === 'in'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <Plus className="w-4 h-4" />
                {t('inventory.addStock')}
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('out')}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-sm font-semibold ${
                  movementType === 'out'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <Minus className="w-4 h-4" />
                {t('inventory.recordUsage')}
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('adjustment')}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-sm font-semibold ${
                  movementType === 'adjustment'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                {t('inventory.setLevel')}
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {movementType === 'adjustment' ? `New total (${item.unit_of_measure})` : `Quantity (${item.unit_of_measure})`}
              <span className="text-red-500"> *</span>
            </label>
            <input
              type="number"
              min={movementType === 'adjustment' ? '0' : '1'}
              step="1"
              value={quantity || ''}
              onChange={e => setQuantity(parseFloat(e.target.value) || 0)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.reason')}</label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all"
            >
              {REASONS[movementType].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional details..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            />
          </div>

          {/* Preview */}
          <div className={`rounded-xl p-4 flex items-center justify-between ${
            isNegativeStock ? 'bg-red-50 border-2 border-red-400' :
            movementType === 'in' ? 'bg-green-50 border border-green-200' :
            movementType === 'out' ? 'bg-red-50 border border-red-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <div>
              <span className={`text-sm font-medium ${
                isNegativeStock ? 'text-red-700' :
                movementType === 'in' ? 'text-green-700' :
                movementType === 'out' ? 'text-red-700' :
                'text-blue-700'
              }`}>New stock after adjustment</span>
              {isNegativeStock && (
                <p className="text-xs text-red-600 font-semibold mt-0.5">
                  Cannot go below 0 — reduce quantity by {Math.abs(newStock)} {item.unit_of_measure}
                </p>
              )}
            </div>
            <span className={`text-lg font-bold ${
              isNegativeStock ? 'text-red-700' :
              movementType === 'in' ? 'text-green-800' :
              movementType === 'out' ? 'text-red-800' :
              'text-blue-800'
            }`}>
              {newStock} {item.unit_of_measure}
            </span>
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
              disabled={saving || (movementType !== 'adjustment' && quantity <= 0) || isNegativeStock}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t('common.loading') : t('common.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
