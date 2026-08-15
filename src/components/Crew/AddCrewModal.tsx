import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../UI/Toast';
import { POSITIONS, DEPARTMENTS } from '../../pages/Crew';
import { UserRole } from '../../types';

interface AddCrewModalProps {
  vessels: { id: string; name: string }[];
  defaultVesselId: string;
  onClose: () => void;
  onSaved: () => void;
}

const canSeeSalary = (role: UserRole) =>
  ['master_admin', 'customer_admin', 'fleet_manager', 'captain'].includes(role);

export const AddCrewModal: React.FC<AddCrewModalProps> = ({ vessels, defaultVesselId, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const role = currentUser?.role as UserRole;
  const showSalary = canSeeSalary(role);

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    position: '',
    department: 'Deck',
    vessel_id: defaultVesselId,
    nationality: '',
    date_of_birth: '',
    phone: '',
    email: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    embark_date: '',
    contract_end_date: '',
    monthly_salary: '',
    salary_currency: 'USD',
    notes: '',
  });

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.position || !form.vessel_id) {
      showToast('Name, position and vessel are required', 'warning');
      return;
    }
    if (!currentUser) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('crew_members').insert({
        vessel_id: form.vessel_id,
        company_id: currentUser.company_id,
        full_name: form.full_name,
        position: form.position,
        department: form.department,
        nationality: form.nationality || null,
        date_of_birth: form.date_of_birth || null,
        phone: form.phone || null,
        email: form.email || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        embark_date: form.embark_date || null,
        contract_end_date: form.contract_end_date || null,
        monthly_salary: form.monthly_salary ? Number(form.monthly_salary) : 0,
        salary_currency: form.salary_currency,
        notes: form.notes || null,
        status: 'active',
      });

      if (error) throw error;
      showToast(`${form.full_name} added to crew`, 'success');
      onSaved();
    } catch {
      showToast('Error adding crew member', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">Add crew member</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name + Position */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name *</label>
              <input type="text" value={form.full_name} onChange={e => set('full_name', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="John Smith" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Position *</label>
              <select value={form.position} onChange={e => set('position', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
                <option value="">Select position</option>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Department + Vessel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
              <select value={form.department} onChange={e => set('department', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Vessel *</label>
              <select value={form.vessel_id} onChange={e => set('vessel_id', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
                <option value="">Select vessel</option>
                {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>

          {/* Nationality + DOB */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nationality</label>
              <input type="text" value={form.nationality} onChange={e => set('nationality', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. British" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date of birth</label>
              <input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+1 555 000 0000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="john@example.com" />
            </div>
          </div>

          {/* Emergency contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Emergency contact</label>
              <input type="text" value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Contact name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Emergency phone</label>
              <input type="tel" value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+1 555 000 0000" />
            </div>
          </div>

          {/* Embark + Contract end */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Embark date</label>
              <input type="date" value={form.embark_date} onChange={e => set('embark_date', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contract end date</label>
              <input type="date" value={form.contract_end_date} onChange={e => set('contract_end_date', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>

          {/* Salary — only for captain/fleet_manager */}
          {showSalary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Monthly salary</label>
                <input type="number" value={form.monthly_salary} onChange={e => set('monthly_salary', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0" min="0" step="100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency</label>
                <select value={form.salary_currency} onChange={e => set('salary_currency', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Any additional notes..." />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-3 border-t border-gray-200">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Add crew member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
