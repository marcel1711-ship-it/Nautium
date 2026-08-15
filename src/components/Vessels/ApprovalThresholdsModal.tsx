import React, { useState, useEffect } from 'react';
import { X, Settings2, AlertCircle, Info, Anchor, Zap, Droplets, Wifi, Trash, Ship, Shield, Fuel, Wrench, Package, Users, MoreHorizontal } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../UI/Toast';

interface ApprovalThresholdsModalProps {
  vesselId: string;
  vesselName: string;
  companyId: string;
  onClose: () => void;
}

interface ThresholdRow {
  category: string;
  label: string;
  icon: React.ElementType;
  color: string;
  value: string; // kept as string for the input; '' = never needs approval
}

const CATEGORIES = [
  { value: 'mooring', label: 'Mooring / Berth Fees', icon: Anchor, color: 'text-blue-600' },
  { value: 'electricity', label: 'Electricity', icon: Zap, color: 'text-yellow-600' },
  { value: 'water', label: 'Water', icon: Droplets, color: 'text-cyan-600' },
  { value: 'internet', label: 'Internet / Connectivity', icon: Wifi, color: 'text-green-600' },
  { value: 'waste_disposal', label: 'Waste Disposal', icon: Trash, color: 'text-orange-600' },
  { value: 'port_fees', label: 'Port Fees', icon: Ship, color: 'text-slate-600' },
  { value: 'insurance', label: 'Insurance', icon: Shield, color: 'text-red-600' },
  { value: 'fuel', label: 'Fuel', icon: Fuel, color: 'text-amber-600' },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench, color: 'text-orange-700' },
  { value: 'provisions', label: 'Provisions', icon: Package, color: 'text-teal-600' },
  { value: 'day_worker', label: 'Day Worker', icon: Users, color: 'text-indigo-600' },
  { value: 'other', label: 'Other', icon: MoreHorizontal, color: 'text-gray-600' },
];

export const ApprovalThresholdsModal: React.FC<ApprovalThresholdsModalProps> = ({ vesselId, vesselName, companyId, onClose }) => {
  const { showToast } = useToast();
  const [rows, setRows] = useState<ThresholdRow[]>(
    CATEGORIES.map(c => ({ category: c.value, label: c.label, icon: c.icon, color: c.color, value: '' }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadThresholds(); }, [vesselId]);

  const loadThresholds = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('vessel_approval_thresholds')
        .select('category, threshold')
        .eq('vessel_id', vesselId);

      if (data) {
        setRows(prev => prev.map(row => {
          const existing = data.find((d: any) => d.category === row.category);
          return existing && existing.threshold !== null ? { ...row, value: String(existing.threshold) } : row;
        }));
      }
    } catch (err) { console.error('Error loading approval thresholds:', err); }
    finally { setLoading(false); }
  };

  const handleChange = (category: string, value: string) => {
    setRows(prev => prev.map(r => r.category === category ? { ...r, value } : r));
  };

  const handleApplyToAll = (value: string) => {
    setRows(prev => prev.map(r => ({ ...r, value })));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const upserts = rows.map(r => ({
        vessel_id: vesselId,
        company_id: companyId,
        category: r.category,
        threshold: r.value.trim() === '' ? null : parseFloat(r.value),
      }));

      const { error } = await supabase
        .from('vessel_approval_thresholds')
        .upsert(upserts, { onConflict: 'vessel_id,category' });

      if (error) throw error;
      showToast('Approval thresholds saved', 'success');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to save thresholds', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg">
              <Settings2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Approval Thresholds</h2>
              <p className="text-sm text-gray-500">{vesselName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Explanation banner */}
          <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-700 space-y-1">
              <p><strong>Leave blank</strong> — this category never needs approval, always auto-approved.</p>
              <p><strong>Set to 0</strong> — every expense in this category always needs approval.</p>
              <p><strong>Set an amount</strong> — only expenses at or above this amount need approval.</p>
            </div>
          </div>

          {/* Quick apply-to-all shortcut */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quick set all:</label>
            <input
              type="number"
              placeholder="e.g. 500"
              min="0"
              step="0.01"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleApplyToAll((e.target as HTMLInputElement).value); } }}
              className="w-28 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <span className="text-xs text-gray-400">— press Enter to apply to all categories</span>
          </div>

          {/* Category rows */}
          {loading ? (
            <div className="space-y-2">
              {[1,2,3,4,5,6].map(i => <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
              {rows.map(row => {
                const Icon = row.icon;
                return (
                  <div key={row.category} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                      <Icon className={`w-4 h-4 ${row.color}`} />
                    </div>
                    <span className="flex-1 text-sm font-medium text-gray-700">{row.label}</span>
                    <div className="relative w-32 flex-shrink-0">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        value={row.value}
                        onChange={e => handleChange(row.category, e.target.value)}
                        placeholder="Never"
                        min="0"
                        step="0.01"
                        className="w-full pl-6 pr-2 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Thresholds'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
