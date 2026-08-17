import React, { useState, useRef } from 'react';
import { X, Ship, AlertCircle, Lock, Camera, Upload, UserCircle, Mail, Check, Users, UserCheck, ClipboardCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AddVesselModalProps {
  companyId: string;
  vesselLimit: number;
  currentCount: number;
  onClose: () => void;
  onSuccess: () => void;
}

const VESSEL_TYPES = [
  { value: 'motor_yacht', label: 'Motor Yacht' },
  { value: 'sailing_yacht', label: 'Sailing Yacht' },
  { value: 'catamaran', label: 'Catamaran' },
  { value: 'explorer_yacht', label: 'Explorer Yacht' },
  { value: 'superyacht', label: 'Superyacht' },
  { value: 'gulet', label: 'Gulet' },
  { value: 'other', label: 'Other' },
];

const APPROVAL_CHAINS = [
  { value: 'captain_only', label: 'Captain only' },
  { value: 'fleet_manager_only', label: 'Fleet Manager only' },
  { value: 'captain_then_fleet_manager', label: 'Captain, then Fleet Manager' },
];

const defaultForm = {
  name: '', type: 'motor_yacht', manufacturer: '', model: '',
  year_built: '', flag: '', imo_number: '', mmsi: '', call_sign: '',
  registration_id: '', length_overall: '', beam: '', gross_tonnage: '',
  location: '', notes: '', owner_email: '', owner_name: '', notification_email: '',
  has_management: false,
  requires_approval: false,
  approval_chain: 'captain_only',
};

import { generateSecurePassword, validateImageFile } from '../../lib/security';

const generatePassword = () => generateSecurePassword();

export const AddVesselModal: React.FC<AddVesselModalProps> = ({
  companyId, vesselLimit, currentCount, onClose, onSuccess,
}) => {
  const [form, setForm] = useState({ ...defaultForm });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { setError(err); return; }
    setPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const atLimit = currentCount >= vesselLimit;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const createOwnerUser = async (vesselId: string, vesselName: string) => {
    if (!form.owner_email.trim()) return;
    const ownerEmail = form.owner_email.trim().toLowerCase();
    const ownerName = form.owner_name.trim() || ownerEmail;
    const tempPassword = generatePassword();
    try {
      const { data: existingProfile } = await supabase.from('profiles').select('id, vessel_ids, role').eq('email', ownerEmail).maybeSingle();
      if (existingProfile) {
        const updatedVesselIds = [...new Set([...(existingProfile.vessel_ids || []), vesselId])];
        await supabase.from('profiles').update({ vessel_ids: updatedVesselIds, role: 'owner' }).eq('id', existingProfile.id);
        return;
      }
      await supabase.functions.invoke('create-owner-user', {
        body: { email: ownerEmail, full_name: ownerName, password: tempPassword, vessel_id: vesselId, vessel_name: vesselName, company_id: companyId },
      });
    } catch (err) { console.error('Owner creation failed:', err); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (atLimit) return;
    setError(null); setIsLoading(true);
    try {
      let photoUrl: string | null = null;
      if (photo) {
        const ext = photo.name.split('.').pop();
        const fileName = `${companyId}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('vessel-photos').upload(fileName, photo, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('vessel-photos').getPublicUrl(fileName);
          photoUrl = urlData.publicUrl;
        }
      }
      const { data: vesselData, error: insertError } = await supabase.from('vessels').insert([{
        company_id: companyId,
        name: form.name.trim(), type: form.type,
        manufacturer: form.manufacturer.trim(), model: form.model.trim(),
        year_built: form.year_built ? parseInt(form.year_built) : null,
        flag: form.flag.trim(), imo_number: form.imo_number.trim(),
        mmsi: form.mmsi.trim(), call_sign: form.call_sign.trim(),
        registration_id: form.registration_id.trim(),
        length_overall: form.length_overall ? parseFloat(form.length_overall) : null,
        beam: form.beam ? parseFloat(form.beam) : null,
        gross_tonnage: form.gross_tonnage ? parseFloat(form.gross_tonnage) : null,
        location: form.location.trim(), notes: form.notes.trim(),
        photo_url: photoUrl,
        notification_email: form.notification_email.trim() || null,
        has_management: form.has_management,
        requires_approval: form.requires_approval,
        approval_chain: form.approval_chain,
      }]).select().single();
      if (insertError) {
        if (insertError.message.includes('VESSEL_LIMIT_REACHED')) {
          setError(`Fleet limit reached (${vesselLimit} vessels). Ask your administrator to increase the limit.`);
        } else { throw insertError; }
        return;
      }
      if (vesselData && form.owner_email.trim()) await createOwnerUser(vesselData.id, form.name.trim());
      onSuccess(); onClose();
    } catch (err: any) { setError(err.message || 'Failed to create vessel'); }
    finally { setIsLoading(false); }
  };

  // Filter approval chain options based on management type
  const availableChains = form.has_management
    ? APPROVAL_CHAINS.filter(c => c.value !== 'captain_only')
    : APPROVAL_CHAINS.filter(c => c.value === 'captain_only');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg"><Ship className="w-6 h-6 text-white" /></div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Add Vessel</h2>
              <p className="text-sm text-gray-500">{currentCount} / {vesselLimit} vessels used</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-6 h-6 text-gray-500" /></button>
        </div>
        {atLimit ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto"><Lock className="w-8 h-8 text-red-500" /></div>
            <h3 className="text-lg font-semibold text-gray-900">Fleet Limit Reached</h3>
            <p className="text-gray-600 max-w-sm mx-auto">This account has reached the maximum of <strong>{vesselLimit} vessel{vesselLimit !== 1 ? 's' : ''}</strong>.</p>
            <button onClick={onClose} className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* ── MANAGEMENT TYPE ── */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Management type *</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setForm(prev => ({ ...prev, has_management: false, approval_chain: 'captain_only' }))}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${!form.has_management ? 'bg-green-50 border-green-400' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${!form.has_management ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <UserCheck className={`w-5 h-5 ${!form.has_management ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <div className={`text-sm font-bold ${!form.has_management ? 'text-green-700' : 'text-gray-600'}`}>Independent</div>
                    <div className="text-xs text-gray-400 mt-0.5">Captain manages the vessel directly</div>
                  </div>
                </button>
                <button type="button" onClick={() => setForm(prev => ({ ...prev, has_management: true, approval_chain: 'fleet_manager_only' }))}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${form.has_management ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${form.has_management ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    <Users className={`w-5 h-5 ${form.has_management ? 'text-blue-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <div className={`text-sm font-bold ${form.has_management ? 'text-blue-700' : 'text-gray-600'}`}>Management company</div>
                    <div className="text-xs text-gray-400 mt-0.5">Fleet manager controls budgets & settings</div>
                  </div>
                </button>
              </div>
              <div className={`mt-3 flex items-start gap-2 px-3 py-2 rounded-lg text-xs font-medium ${form.has_management ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                {form.has_management
                  ? <><Users className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> Fleet manager defines budgets. Captain can view but not edit budget settings.</>
                  : <><UserCheck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> Captain has full control — can set and edit budgets directly.</>
                }
              </div>
            </div>

            {/* ── APPROVAL SETTINGS — new section ── */}
            <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <ClipboardCheck className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-indigo-900">Expense Approval (optional)</p>
                    <p className="text-xs text-indigo-600 mt-0.5">Require sign-off before expenses count as approved.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={form.requires_approval}
                    onChange={e => setForm(prev => ({ ...prev, requires_approval: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>

              {form.requires_approval && (
                <div>
                  <label className="block text-xs font-semibold text-indigo-800 uppercase tracking-wide mb-2">Who approves?</label>
                  <select
                    value={form.approval_chain}
                    onChange={e => setForm(prev => ({ ...prev, approval_chain: e.target.value }))}
                    className="w-full px-4 py-3 border border-indigo-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                    {availableChains.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  {!form.has_management && (
                    <p className="text-xs text-indigo-500 mt-1.5">Independent vessels are approved by the captain only.</p>
                  )}
                  <p className="text-xs text-indigo-400 mt-2">You can configure category-specific thresholds later, from Edit Vessel.</p>
                </div>
              )}
            </div>

            {/* ── VESSEL INFO ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Vessel Name *</label>
                <input type="text" name="name" value={form.name} onChange={handleChange} required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Lady Sarah" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Vessel Type</label>
                <select name="type" value={form.type} onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  {VESSEL_TYPES.map(vt => <option key={vt.value} value={vt.value}>{vt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Location</label>
                <input type="text" name="location" value={form.location} onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Puerto Banus, Spain" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Manufacturer / Shipyard</label>
                <input type="text" name="manufacturer" value={form.manufacturer} onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Amels, Feadship" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Model / Series</label>
                <input type="text" name="model" value={form.model} onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Limited Editions 180" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year Built</label>
                <input type="number" name="year_built" value={form.year_built} onChange={handleChange}
                  min="1900" max={new Date().getFullYear() + 2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="2020" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Flag State</label>
                <input type="text" name="flag" value={form.flag} onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Cayman Islands" />
              </div>
            </div>

            {/* ── TECHNICAL IDENTIFIERS ── */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-4">
              <p className="text-sm font-medium text-gray-700">Technical Identifiers</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">IMO Number</label>
                  <input type="text" name="imo_number" value={form.imo_number} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="IMO 1234567" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">MMSI</label>
                  <input type="text" name="mmsi" value={form.mmsi} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="123456789" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Call Sign</label>
                  <input type="text" name="call_sign" value={form.call_sign} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="VABC1" />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Registration No.</label>
                  <input type="text" name="registration_id" value={form.registration_id} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="REG-001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">LOA (m)</label>
                  <input type="number" name="length_overall" value={form.length_overall} onChange={handleChange} min="0" step="0.1"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="55.0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Beam (m)</label>
                  <input type="number" name="beam" value={form.beam} onChange={handleChange} min="0" step="0.1"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="10.5" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Gross Tonnage</label>
                  <input type="number" name="gross_tonnage" value={form.gross_tonnage} onChange={handleChange} min="0" step="0.1"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="499" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Additional notes about the vessel..." />
            </div>

            {/* ── PHOTO ── */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vessel Photo</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              {photoPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 group">
                  <img src={photoPreview} alt="Preview" className="w-full h-44 object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 bg-white text-gray-800 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-100">
                      <Camera className="w-4 h-4" /> Change
                    </button>
                    <button type="button" onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                      className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-red-700">
                      <X className="w-4 h-4" /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-2 group">
                  <div className="p-2.5 bg-gray-100 rounded-full group-hover:bg-blue-100 transition-colors">
                    <Upload className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <p className="text-sm font-medium text-gray-600 group-hover:text-blue-600">Upload vessel photo</p>
                  <p className="text-xs text-gray-400">PNG, JPG, WEBP</p>
                </button>
              )}
            </div>

            {/* ── OWNER ACCESS ── */}
            <div className="bg-blue-50 rounded-xl p-5 border border-blue-100 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <UserCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900">Owner Access (optional)</p>
                  <p className="text-xs text-blue-600 mt-0.5">The owner gets a read-only dashboard — vessel health, costs, and activity.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">Owner Full Name</label>
                  <input type="text" name="owner_name" value={form.owner_name} onChange={handleChange}
                    className="w-full px-4 py-3 border border-blue-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. John Smith" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">Owner Email</label>
                  <input type="email" name="owner_email" value={form.owner_email} onChange={handleChange}
                    className="w-full px-4 py-3 border border-blue-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="owner@example.com" />
                </div>
              </div>
              {form.owner_email && (
                <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-100 rounded-lg px-3 py-2">
                  <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
                  <span>Nautium will send <strong>{form.owner_email}</strong> an invitation email with login credentials.</span>
                </div>
              )}
            </div>

            {/* ── NOTIFICATION EMAIL ── */}
            <div className="bg-amber-50 rounded-xl p-5 border border-amber-100 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-900">Daily Alert Notifications (optional)</p>
                  <p className="text-xs text-amber-600 mt-0.5">Who receives daily email summaries — overdue tasks and low stock.</p>
                </div>
              </div>
              <input type="email" name="notification_email" value={form.notification_email} onChange={handleChange}
                className="w-full px-4 py-3 border border-amber-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                placeholder="e.g. captain@vessel.com" />
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button type="button" onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">Cancel</button>
              <button type="submit" disabled={isLoading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                {isLoading ? 'Saving...' : 'Add Vessel'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
