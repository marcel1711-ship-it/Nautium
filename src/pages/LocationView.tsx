import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Package,
  AlertTriangle,
  ArrowLeft,
  Plus,
  Minus,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { demoInventoryItems } from '../data/demoData';
import { isLowStock } from '../utils/helpers';
import { InventoryItem } from '../types';
import { useToast } from '../components/UI/Toast';

interface LocationViewProps {
  onNavigate: (page: string, params?: any) => void;
  location: string;
}

const isDemoUser = (email: string) => email === 'admin@yachtmaintenance.pro';

export const LocationView: React.FC<LocationViewProps> = ({ onNavigate, location }) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustType, setAdjustType] = useState<'in' | 'out'>('in');
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [successItem, setSuccessItem] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
  }, [location, currentUser]);

  const loadItems = async () => {
    if (!currentUser) return;
    setLoading(true);

    if (isDemoUser(currentUser.email)) {
      const demo = demoInventoryItems.filter(
        i => i.storage_location?.toLowerCase() === location.toLowerCase()
      );
      setItems(demo as InventoryItem[]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('inventory_items')
      .select('*')
      .ilike('storage_location', location);

    setItems(data || []);
    setLoading(false);
  };

  const handleAdjust = async () => {
    if (!selectedItem || !currentUser || isDemoUser(currentUser.email)) return;
    if (!adjustReason.trim()) { showToast('Please provide a reason', 'warning'); return; }

    setAdjusting(true);

    const newStock =
      adjustType === 'in'
        ? selectedItem.current_stock + adjustQty
        : Math.max(0, selectedItem.current_stock - adjustQty);

    const { error: moveErr } = await supabase.from('stock_movements').insert({
      inventory_id: selectedItem.id,
      vessel_id: selectedItem.vessel_id,
      movement_type: adjustType,
      quantity: adjustQty,
      reason: adjustReason,
      performed_by_id: currentUser.id,
      performed_by_name: currentUser.full_name,
    });

    if (!moveErr) {
      await supabase.from('inventory_items').update({ current_stock: newStock }).eq('id', selectedItem.id);
      setSuccessItem(selectedItem.id);
      setTimeout(() => setSuccessItem(null), 2500);
      setSelectedItem(null);
      setAdjustReason('');
      setAdjustQty(1);
      loadItems();
    }

    setAdjusting(false);
  };

  const openAdjust = (item: InventoryItem, type: 'in' | 'out') => {
    setSelectedItem(item);
    setAdjustType(type);
    setAdjustQty(1);
    setAdjustReason('');
  };

  const isDemo = isDemoUser(currentUser?.email || '');
  const lowCount = items.filter(isLowStock).length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-lg flex-shrink-0">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={() => onNavigate('inventory')}
            className="p-2 hover:bg-white/10 active:bg-white/20 rounded-xl transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 bg-white/10 rounded-xl flex-shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">{t('location.storageLocation')}</p>
              <h1 className="text-base font-bold truncate leading-tight mt-0.5">{location}</h1>
            </div>
          </div>
          <div className="text-right flex-shrink-0 pl-2">
            <p className="text-2xl font-bold leading-none">{items.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t('location.items')}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 py-5 space-y-3 max-w-lg mx-auto w-full">
        {/* Low stock warning */}
        {lowCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-red-800">
              {lowCount} {lowCount === 1 ? t('location.itemNeedsRestock') : t('location.itemsNeedRestock')} {t('location.restockingHere')}
            </p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-36 bg-white rounded-2xl animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Package className="w-14 h-14 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">{t('location.noItems')}</p>
            <p className="text-sm text-gray-500 mt-1">{t('location.noItemsHint')}</p>
          </div>
        ) : (
          items.map(item => {
            const low = isLowStock(item);
            const success = successItem === item.id;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
                  success
                    ? 'border-green-300 shadow-green-100 shadow-md'
                    : low
                    ? 'border-red-200'
                    : 'border-gray-200'
                }`}
              >
                <div className="p-4">
                  {/* Item header */}
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="font-semibold text-gray-900 text-base leading-tight">{item.name}</h3>
                        {low && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            {t('inventory.lowStock')}
                          </span>
                        )}
                        {success && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                            <CheckCircle className="w-3 h-3" />
                            {t('location.updatedLabel')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{item.part_number} · {item.category}</p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className={`text-3xl font-bold leading-none ${low ? 'text-red-600' : 'text-gray-900'}`}>
                        {item.current_stock}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.unit_of_measure}</p>
                    </div>
                  </div>

                  {/* Stock bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">{t('location.minLabel')} {item.minimum_stock} {item.unit_of_measure}</span>
                      <span className="text-xs text-gray-400">
                        {item.minimum_stock > 0
                          ? `${Math.round((item.current_stock / item.minimum_stock) * 100)}%`
                          : '—'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${low ? 'bg-red-400' : 'bg-emerald-400'}`}
                        style={{
                          width: item.minimum_stock > 0
                            ? `${Math.min((item.current_stock / item.minimum_stock) * 100, 100)}%`
                            : '100%'
                        }}
                      />
                    </div>
                  </div>

                  {/* Action buttons */}
                  {!isDemo ? (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <button
                        onClick={() => openAdjust(item, 'in')}
                        className="flex items-center justify-center gap-1.5 px-2 py-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-semibold active:bg-emerald-200 hover:bg-emerald-100 transition-colors border border-emerald-200"
                      >
                        <TrendingUp className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{t('location.addStock')}</span>
                      </button>
                      <button
                        onClick={() => openAdjust(item, 'out')}
                        className="flex items-center justify-center gap-1.5 px-2 py-3 bg-orange-50 text-orange-700 rounded-xl text-sm font-semibold active:bg-orange-200 hover:bg-orange-100 transition-colors border border-orange-200"
                      >
                        <TrendingDown className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{t('location.recordUsage')}</span>
                      </button>
                      <button
                        onClick={() => onNavigate('inventory-detail', { itemId: item.id })}
                        className="flex items-center justify-center px-2 py-3 bg-gray-50 text-gray-600 rounded-xl text-sm font-semibold active:bg-gray-200 hover:bg-gray-100 transition-colors border border-gray-200"
                      >
                        {t('common.view')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onNavigate('inventory-detail', { itemId: item.id })}
                      className="mt-3 w-full px-3 py-3 bg-gray-50 text-gray-600 rounded-xl text-sm font-semibold active:bg-gray-200 hover:bg-gray-100 transition-colors border border-gray-200"
                    >
                      {t('inventory.viewDetails')}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Adjust bottom sheet */}
      {selectedItem && !isDemo && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedItem(null); }}
        >
          <div
            className="bg-white rounded-t-3xl w-full max-w-lg p-6"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
          >
            {/* Sheet header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${adjustType === 'in' ? 'bg-emerald-100' : 'bg-orange-100'}`}>
                  {adjustType === 'in'
                    ? <TrendingUp className="w-5 h-5 text-emerald-600" />
                    : <TrendingDown className="w-5 h-5 text-orange-600" />
                  }
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 leading-tight">
                    {adjustType === 'in' ? t('location.addStock') : t('location.recordUsage')}
                  </h2>
                  <p className="text-sm text-gray-500 truncate max-w-[200px]">{selectedItem.name}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Quantity stepper */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('common.quantity')} ({selectedItem.unit_of_measure})
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setAdjustQty(Math.max(1, adjustQty - 1))}
                    className="w-14 h-14 flex items-center justify-center bg-gray-100 rounded-2xl hover:bg-gray-200 active:bg-gray-300 transition-colors flex-shrink-0"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <input
                    type="number"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    className="flex-1 text-center text-3xl font-bold px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => setAdjustQty(adjustQty + 1)}
                    className="w-14 h-14 flex items-center justify-center bg-gray-100 rounded-2xl hover:bg-gray-200 active:bg-gray-300 transition-colors flex-shrink-0"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.reason')} *</label>
                <textarea
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                  placeholder={adjustType === 'in' ? t('location.receivedShipment') : t('location.usedDuringMaintenance')}
                />
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setSelectedItem(null)}
                className="flex-1 px-4 py-4 border border-gray-200 text-gray-700 rounded-2xl font-semibold hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAdjust}
                disabled={adjusting || !adjustReason.trim()}
                className={`flex-1 px-4 py-4 text-white rounded-2xl font-semibold transition-all disabled:opacity-50 ${
                  adjustType === 'in' ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800' : 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800'
                }`}
              >
                {adjusting ? t('common.loading') : t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
