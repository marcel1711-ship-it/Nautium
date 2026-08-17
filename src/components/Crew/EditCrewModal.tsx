import React, { useState, useRef } from 'react';
import { X, Trash2, Camera } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../UI/Toast';
import { POSITIONS, DEPARTMENTS } from '../../pages/Crew';
import { CrewMember, UserRole } from '../../types';

interface EditCrewModalProps {
  member: CrewMember;
  vessels: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

const canSeeSalary = (role: UserRole) =>
  ['master_admin', 'customer_admin', 'fleet_manager', 'captain'].includes(role);

export const EditCrewModal: React.FC<EditCrewModalProps> = ({ member, vessels, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const role = currentUser?.role as UserRole;
  const showSalary = canSeeSalary(role);

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(member.photo_url || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const [form, setForm] = useState({
    full_name: member.full_name,
    position: member.position,
    department: member.department,
    vessel_id: member.vessel_id,
    nationality: member.nationality || '',
    date_of_birth: member.date_of_birth || '',
    phone: member.phone || '',
    email: member.email || '',
    emergency_contact_name: member.emergency_contact_name || '',
    emergency_contact_phone: member.emergency_contact_phone || '',
    embark_date: member.embark_date || '',
    disembark_date: member.disembark_date || '',
    contract_end_date: member.contract_end_date || '',
    monthly_salary: member.monthly_salary ? String(member.monthly_salary) : '',
    salary_currency: member.salary_currency || 'USD',
    status: member.status,
    notes: member.notes || '',
  });

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.position || !form.vessel_id) {
      showToast('Name, position and vessel are required', 'warning');
      return;
    }

    setSaving(true);
    try {
      let photoUrl = member.photo_url || null;
      if (photo && currentUser) {
        const ext = photo.name.split('.').pop();
        const fileName = `crew/${currentUser.company_id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('vessel-photos').upload(fileName, photo, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('vessel-photos').getPublicUrl(fileName);
          photoUrl = urlData.publicUrl;
        }
      }

      const { error } = await supabase.from('crew_members').update({
        full_name: form.full_name,
        position: form.position,
        department: form.department,
        vessel_id: form.vessel_id,
        nationality: form.nationality || null,
        date_of_birth: form.date_of_birth || null,
        phone: form.phone || null,
        email: form.email || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        embark_date: form.embark_date || null,
        disembark_date: form.disembark_date || null,
        contract_end_date: form.contract_end_date || null,
        monthly_salary: form.monthly_salary ? Number(form.monthly_salary) : 0,
        salary_currency: form.salary_currency,
        photo_url: photoUrl,
        status: form.status,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      }).eq('id', member.id);

      if (error) throw error;
      showToast('Crew member updated', 'success');
      onSaved();
    } catch {
      showToast('Error updating crew member', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('crew_members').delete().eq('id', member.id);
      if (error) throw error;
      showToast(`${member.full_name} removed from crew`, 'info');
      onSaved();
    } catch {
      showToast('Error removing crew member', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">Edit crew member</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Photo */}
          <div className="flex justify-center">
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="relative w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors flex items-center justify-center overflow-hidden group">
              {photoPreview ? (
                <img src={photoPreview} alt={member.full_name} className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-8 h-8 text-gray-400 group-hover:text-blue-500 transition-colors" />
              )}
              {photoPreview && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>

          {/* Name + Position */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name *</label>
              <input type="text" value={form.full_name} onChange={e => set('full_name', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
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
                {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>

          {/* Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="active">Active</option>
                <option value="on_leave">On leave</option>
                <option value="off_vessel">Off vessel</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nationality</label>
              <input type="text" value={form.nationality} onChange={e => set('nationality', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>

          {/* DOB + Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date of birth</label>
              <input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          {/* Emergency contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Emergency contact</label>
              <input type="text" value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Emergency phone</label>
              <input type="tel" value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Embark date</label>
              <input type="date" value={form.embark_date} onChange={e => set('embark_date', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Disembark date</label>
              <input type="date" value={form.disembark_date} onChange={e => set('disembark_date', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contract end</label>
              <input type="date" value={form.contract_end_date} onChange={e => set('contract_end_date', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>

          {/* Salary */}
          {showSalary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Monthly salary</label>
                <input type="number" value={form.monthly_salary} onChange={e => set('monthly_salary', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0" step="100" />
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
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
            {!confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-red-600 text-sm font-medium hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" /> Remove
              </button>
            ) : (
              <button type="button" onClick={handleDelete} disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                <Trash2 className="w-4 h-4" /> Confirm remove
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
