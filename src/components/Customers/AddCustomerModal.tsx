import React, { useState, useRef } from 'react';
import { X, Building2, AlertCircle, Ship, Camera, Upload, Bell, Plus, Trash2 } from 'lucide-react';
import { supabase, SUPABASE_URL } from '../../lib/supabase';
import { validateImageFile } from '../../lib/security';
import { useLanguage } from '../../contexts/LanguageContext';

interface AddCustomerModalProps {
  isOpen: boolean;
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

const defaultFormData = {
  name: '',
  customer_type: 'agency' as 'yacht_owner' | 'agency',
  vessel_limit: 1,
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  subscription_status: 'trial' as 'active' | 'trial' | 'inactive',
  subscription_renewal_date: '',
  notes: '',
  create_user_account: true,
  user_password: '',
  email_notifications_enabled: false,
  vessel_name: '',
  vessel_type: 'motor_yacht',
  vessel_manufacturer: '',
  vessel_model: '',
  vessel_year_built: '',
  vessel_flag: '',
  vessel_imo: '',
  vessel_mmsi: '',
  vessel_call_sign: '',
  vessel_registration_id: '',
  vessel_length_overall: '',
  vessel_beam: '',
  vessel_gross_tonnage: '',
  vessel_location: '',
  vessel_notes: '',
};

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...defaultFormData });
  const [notificationEmails, setNotificationEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [vesselPhoto, setVesselPhoto] = useState<File | null>(null);
  const [vesselPhotoPreview, setVesselPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const renewalDate = formData.subscription_renewal_date || (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d.toISOString().split('T')[0];
      })();

      const isYachtOwner = formData.customer_type === 'yacht_owner';

      const companyData = {
        name: isYachtOwner ? formData.vessel_name : formData.name,
        customer_type: formData.customer_type,
        yacht_name: isYachtOwner ? formData.vessel_name : '',
        vessel_limit: formData.vessel_limit,
        contact_name: formData.contact_name,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone,
        subscription_status: formData.subscription_status,
        subscription_renewal_date: renewalDate,
        notes: formData.notes,
        email_notifications_enabled: formData.email_notifications_enabled,
        notification_emails: notificationEmails,
      };

      const { data, error: insertError } = await supabase
        .from('companies')
        .insert([companyData])
        .select()
        .maybeSingle();

      if (insertError) throw insertError;
      if (!data) throw new Error('Failed to create customer');

      if (isYachtOwner && formData.vessel_name) {
        let photoUrl: string | null = null;

        if (vesselPhoto) {
          const fileExt = vesselPhoto.name.split('.').pop();
          const fileName = `${data.id}-${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('vessel-photos')
            .upload(fileName, vesselPhoto, { upsert: true });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('vessel-photos')
              .getPublicUrl(fileName);
            photoUrl = urlData.publicUrl;
          }
        }

        const vesselData = {
          company_id: data.id,
          name: formData.vessel_name,
          type: formData.vessel_type,
          manufacturer: formData.vessel_manufacturer,
          model: formData.vessel_model,
          year_built: formData.vessel_year_built ? parseInt(formData.vessel_year_built) : null,
          flag: formData.vessel_flag,
          imo_number: formData.vessel_imo,
          mmsi: formData.vessel_mmsi,
          call_sign: formData.vessel_call_sign,
          registration_id: formData.vessel_registration_id,
          length_overall: formData.vessel_length_overall ? parseFloat(formData.vessel_length_overall) : null,
          beam: formData.vessel_beam ? parseFloat(formData.vessel_beam) : null,
          gross_tonnage: formData.vessel_gross_tonnage ? parseFloat(formData.vessel_gross_tonnage) : null,
          location: formData.vessel_location,
          notes: formData.vessel_notes,
          photo_url: photoUrl,
        };

        const { error: vesselError } = await supabase
          .from('vessels')
          .insert([vesselData]);

        if (vesselError) {
          if (vesselError.message.includes('VESSEL_LIMIT_REACHED')) {
            throw new Error(`Fleet limit reached (${formData.vessel_limit} vessel${formData.vessel_limit !== 1 ? 's' : ''}). Increase the vessel limit before adding vessels.`);
          }
          console.error('Error creating vessel:', vesselError);
        }
      }

      if (formData.create_user_account) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('No active session');

          const apiUrl = `${SUPABASE_URL}/functions/v1/create-customer-user`;
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: formData.contact_email,
              password: formData.user_password || 'Nautium2024!',
              company_id: data.id,
              company_name: companyData.name,
              full_name: formData.contact_name,
            }),
          });

          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Failed to create user account');
        } catch (userErr: any) {
          console.error('Error creating user:', userErr);
          setError(`Customer created but failed to create user account: ${userErr.message}`);
        }
      }

      setFormData({ ...defaultFormData });
      setNotificationEmails([]);
      setNewEmail('');
      setVesselPhoto(null);
      setVesselPhotoPreview(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating customer:', err);
      setError(err.message || 'Failed to create customer');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { setError(err); return; }
    setVesselPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setVesselPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const addNotificationEmail = () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) return;
    if (notificationEmails.includes(trimmed)) return;
    setNotificationEmails(prev => [...prev, trimmed]);
    setNewEmail('');
  };

  const removeNotificationEmail = (email: string) => {
    setNotificationEmails(prev => prev.filter(e => e !== email));
  };

  if (!isOpen) return null;

  const isYachtOwner = formData.customer_type === 'yacht_owner';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{t('customers.addCustomerTitle')}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Customer Type</h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, customer_type: 'agency', vessel_limit: 5 }))}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  formData.customer_type === 'agency'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Building2 className={`w-6 h-6 mb-2 ${formData.customer_type === 'agency' ? 'text-blue-600' : 'text-gray-400'}`} />
                <p className={`font-semibold text-sm ${formData.customer_type === 'agency' ? 'text-blue-700' : 'text-gray-700'}`}>
                  Agency / Armador
                </p>
                <p className="text-xs text-gray-500 mt-1">Manages multiple vessels</p>
              </button>

              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, customer_type: 'yacht_owner', vessel_limit: 1 }))}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  formData.customer_type === 'yacht_owner'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Ship className={`w-6 h-6 mb-2 ${formData.customer_type === 'yacht_owner' ? 'text-blue-600' : 'text-gray-400'}`} />
                <p className={`font-semibold text-sm ${formData.customer_type === 'yacht_owner' ? 'text-blue-700' : 'text-gray-700'}`}>
                  Yacht Owner
                </p>
                <p className="text-xs text-gray-500 mt-1">Single yacht owner</p>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {isYachtOwner ? 'Owner Information' : 'Armador / Management Company'}
            </h3>

            {!isYachtOwner && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Armador / Company Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required={!isYachtOwner}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Fraser Yachts, Burgess Yachts, Y.CO"
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('customers.contactName')} *</label>
                <input
                  type="text"
                  name="contact_name"
                  value={formData.contact_name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('customers.contactEmail')} *</label>
                <input
                  type="email"
                  name="contact_email"
                  value={formData.contact_email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('customers.contactPhone')}</label>
              <input
                type="tel"
                name="contact_phone"
                value={formData.contact_phone}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          {isYachtOwner && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Ship className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Vessel Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vessel Name *</label>
                  <input
                    type="text"
                    name="vessel_name"
                    value={formData.vessel_name}
                    onChange={handleChange}
                    required={isYachtOwner}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. Lady Sarah"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vessel Type</label>
                  <select
                    name="vessel_type"
                    value={formData.vessel_type}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {VESSEL_TYPES.map(vt => (
                      <option key={vt.value} value={vt.value}>{vt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Manufacturer / Shipyard</label>
                  <input
                    type="text"
                    name="vessel_manufacturer"
                    value={formData.vessel_manufacturer}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. Amels, Feadship, Lürssen"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Model / Series</label>
                  <input
                    type="text"
                    name="vessel_model"
                    value={formData.vessel_model}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. Limited Editions 180"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Year Built</label>
                  <input
                    type="number"
                    name="vessel_year_built"
                    value={formData.vessel_year_built}
                    onChange={handleChange}
                    min="1900"
                    max={new Date().getFullYear() + 2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="2020"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Flag State</label>
                  <input
                    type="text"
                    name="vessel_flag"
                    value={formData.vessel_flag}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. Cayman Islands"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Current Location</label>
                  <input
                    type="text"
                    name="vessel_location"
                    value={formData.vessel_location}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. Puerto Banus, Spain"
                  />
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                <p className="text-sm font-medium text-gray-700">Technical Identifiers</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">IMO Number</label>
                    <input
                      type="text"
                      name="vessel_imo"
                      value={formData.vessel_imo}
                      onChange={handleChange}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="IMO 1234567"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">MMSI</label>
                    <input
                      type="text"
                      name="vessel_mmsi"
                      value={formData.vessel_mmsi}
                      onChange={handleChange}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="123456789"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">Call Sign</label>
                    <input
                      type="text"
                      name="vessel_call_sign"
                      value={formData.vessel_call_sign}
                      onChange={handleChange}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="VABC1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">Registration No.</label>
                    <input
                      type="text"
                      name="vessel_registration_id"
                      value={formData.vessel_registration_id}
                      onChange={handleChange}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="REG-001"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">LOA (m)</label>
                    <input
                      type="number"
                      name="vessel_length_overall"
                      value={formData.vessel_length_overall}
                      onChange={handleChange}
                      min="0"
                      step="0.1"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="55.0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">Beam (m)</label>
                    <input
                      type="number"
                      name="vessel_beam"
                      value={formData.vessel_beam}
                      onChange={handleChange}
                      min="0"
                      step="0.1"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="10.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">Gross Tonnage</label>
                    <input
                      type="number"
                      name="vessel_gross_tonnage"
                      value={formData.vessel_gross_tonnage}
                      onChange={handleChange}
                      min="0"
                      step="0.1"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="499"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Vessel Notes</label>
                <textarea
                  name="vessel_notes"
                  value={formData.vessel_notes}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Additional notes about the vessel..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Vessel Photo</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                {vesselPhotoPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-gray-200 group">
                    <img
                      src={vesselPhotoPreview}
                      alt="Vessel preview"
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-2 bg-white text-gray-800 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-100 transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => { setVesselPhoto(null); setVesselPhotoPreview(null); }}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-red-700 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-36 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-2 group"
                  >
                    <div className="p-3 bg-gray-100 rounded-full group-hover:bg-blue-100 transition-colors">
                      <Upload className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <p className="text-sm font-medium text-gray-600 group-hover:text-blue-600 transition-colors">
                      Upload vessel photo
                    </p>
                    <p className="text-xs text-gray-400">PNG, JPG, WEBP up to 10MB</p>
                  </button>
                )}
              </div>
            </div>
          )}

          {!isYachtOwner && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Ship className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Fleet</h3>
              </div>
              <p className="text-sm text-gray-500 -mt-2">
                You can add vessels to this customer after creating the account. Set the fleet limit below.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('customers.vesselLimit')} *</label>
                <input
                  type="number"
                  name="vessel_limit"
                  value={formData.vessel_limit}
                  onChange={handleChange}
                  required
                  min="1"
                  max="100"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum vessels this customer can manage</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Subscription Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                <select
                  name="subscription_status"
                  value={formData.subscription_status}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Renewal Date *</label>
                <input
                  type="date"
                  name="subscription_renewal_date"
                  value={formData.subscription_renewal_date}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.notes')}</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Additional notes about this customer..."
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-semibold text-gray-900">Email Notifications</h3>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">Premium</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-gray-600">
                  {formData.email_notifications_enabled ? 'Enabled' : 'Disabled'}
                </span>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, email_notifications_enabled: !prev.email_notifications_enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.email_notifications_enabled ? 'bg-amber-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      formData.email_notifications_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            </div>

            {formData.email_notifications_enabled && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-4">
                <p className="text-sm text-amber-800">
                  Automated daily alerts will be sent for overdue maintenance tasks and low inventory stock.
                  The contact email is always included automatically.
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Additional Recipients</label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNotificationEmail(); }}}
                      placeholder="owner@example.com"
                      className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={addNotificationEmail}
                      className="px-3 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-1.5 text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>

                  {notificationEmails.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {notificationEmails.map(email => (
                        <div key={email} className="flex items-center justify-between bg-white border border-amber-200 rounded-lg px-3 py-2">
                          <span className="text-sm text-gray-700">{email}</span>
                          <button
                            type="button"
                            onClick={() => removeNotificationEmail(email)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">User Account</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.create_user_account}
                  onChange={(e) => setFormData(prev => ({ ...prev, create_user_account: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Create login account</span>
              </label>
            </div>

            {formData.create_user_account && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <p className="text-sm text-blue-800">
                  A user account will be created using the contact email above.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Initial Password (optional)
                  </label>
                  <input
                    type="text"
                    name="user_password"
                    value={formData.user_password}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Leave blank for default: Nautium2024!"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Default password: <span className="font-mono font-semibold">Nautium2024!</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? t('common.loading') : t('customers.addCustomer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
