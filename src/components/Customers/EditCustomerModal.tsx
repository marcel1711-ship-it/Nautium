import React, { useState, useEffect, useRef } from 'react';
import { X, Building2, AlertCircle, Ship, Camera, Upload, Bell, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../contexts/LanguageContext';

interface Company {
  id: string;
  name: string;
  customer_type: 'yacht_owner' | 'agency';
  yacht_name: string;
  vessel_limit: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  subscription_status: 'active' | 'trial' | 'inactive';
  subscription_renewal_date: string;
  notes: string;
  email_notifications_enabled?: boolean;
  notification_emails?: string[];
}

interface Vessel {
  id: string;
  name: string;
  type: string;
  manufacturer: string;
  model: string;
  year_built: number | null;
  flag: string;
  imo_number: string;
  mmsi: string;
  call_sign: string;
  registration_id: string;
  length_overall: number | null;
  beam: number | null;
  gross_tonnage: number | null;
  location: string;
  notes: string;
  photo_url: string | null;
  notification_email: string | null;
}

interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customer: Company | null;
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

export const EditCustomerModal: React.FC<EditCustomerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  customer,
}) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingVessel, setIsFetchingVessel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vessel, setVessel] = useState<Vessel | null>(null);
  const [vesselPhoto, setVesselPhoto] = useState<File | null>(null);
  const [vesselPhotoPreview, setVesselPhotoPreview] = useState<string | null>(null);
  const [notificationEmails, setNotificationEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customerType, setCustomerType] = useState<'yacht_owner' | 'agency'>(customer?.customer_type ?? 'yacht_owner');

  const [formData, setFormData] = useState({
    name: '',
    yacht_name: '',
    vessel_limit: 1,
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    subscription_status: 'trial' as 'active' | 'trial' | 'inactive',
    subscription_renewal_date: '',
    notes: '',
    email_notifications_enabled: false,
  });

  const [vesselData, setVesselData] = useState({
    name: '',
    type: 'motor_yacht',
    manufacturer: '',
    model: '',
    year_built: '',
    flag: '',
    imo_number: '',
    mmsi: '',
    call_sign: '',
    registration_id: '',
    length_overall: '',
    beam: '',
    gross_tonnage: '',
    location: '',
    notes: '',
    notification_email: '',
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        yacht_name: customer.yacht_name || '',
        vessel_limit: customer.vessel_limit || 1,
        contact_name: customer.contact_name || '',
        contact_email: customer.contact_email || '',
        contact_phone: customer.contact_phone || '',
        subscription_status: customer.subscription_status || 'trial',
        subscription_renewal_date: customer.subscription_renewal_date
          ? customer.subscription_renewal_date.split('T')[0]
          : '',
        notes: customer.notes || '',
        email_notifications_enabled: customer.email_notifications_enabled ?? false,
      });
      setCustomerType(customer.customer_type);
      setNotificationEmails(customer.notification_emails ?? []);
      setNewEmail('');
      setError(null);

      if (customer.customer_type === 'yacht_owner') {
        fetchVessel(customer.id);
      }
    }
  }, [customer]);

  const fetchVessel = async (companyId: string) => {
    setIsFetchingVessel(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('vessels')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        setVessel(data);
        setVesselData({
          name: data.name || '',
          type: data.type || 'motor_yacht',
          manufacturer: data.manufacturer || '',
          model: data.model || '',
          year_built: data.year_built ? String(data.year_built) : '',
          flag: data.flag || '',
          imo_number: data.imo_number || '',
          mmsi: data.mmsi || '',
          call_sign: data.call_sign || '',
          registration_id: data.registration_id || '',
          length_overall: data.length_overall ? String(data.length_overall) : '',
          beam: data.beam ? String(data.beam) : '',
          gross_tonnage: data.gross_tonnage ? String(data.gross_tonnage) : '',
          location: data.location || '',
          notes: data.notes || '',
          notification_email: data.notification_email || '',
        });
        setVesselPhotoPreview(data.photo_url || null);
        setVesselPhoto(null);
      }
    } catch (err: any) {
      console.error('Error fetching vessel:', err);
    } finally {
      setIsFetchingVessel(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleVesselChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setVesselData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVesselPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setVesselPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    setError(null);
    setIsLoading(true);

    try {
      const isYachtOwner = customerType === 'yacht_owner';

      const updateData = {
        customer_type: customerType,
        name: isYachtOwner ? vesselData.name : formData.name,
        yacht_name: isYachtOwner ? vesselData.name : customer.yacht_name,
        vessel_limit: isYachtOwner ? 1 : Number(formData.vessel_limit),
        contact_name: formData.contact_name,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone,
        subscription_status: formData.subscription_status,
        subscription_renewal_date: formData.subscription_renewal_date || null,
        notes: formData.notes,
        email_notifications_enabled: formData.email_notifications_enabled,
        notification_emails: notificationEmails,
      };

      const { error: companyError } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', customer.id);

      if (companyError) throw companyError;

      if (isYachtOwner) {
        let photoUrl: string | null | undefined = undefined;

        if (vesselPhoto) {
          const fileExt = vesselPhoto.name.split('.').pop();
          const fileName = `${customer.id}-${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('vessel-photos')
            .upload(fileName, vesselPhoto, { upsert: true });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('vessel-photos')
              .getPublicUrl(fileName);
            photoUrl = urlData.publicUrl;
          }
        } else if (vesselPhotoPreview === null) {
          photoUrl = null;
        }

        const vesselUpdate: Record<string, any> = {
          name: vesselData.name,
          type: vesselData.type,
          manufacturer: vesselData.manufacturer,
          model: vesselData.model,
          year_built: vesselData.year_built ? parseInt(vesselData.year_built) : null,
          flag: vesselData.flag,
          imo_number: vesselData.imo_number,
          mmsi: vesselData.mmsi,
          call_sign: vesselData.call_sign,
          registration_id: vesselData.registration_id,
          length_overall: vesselData.length_overall ? parseFloat(vesselData.length_overall) : null,
          beam: vesselData.beam ? parseFloat(vesselData.beam) : null,
          gross_tonnage: vesselData.gross_tonnage ? parseFloat(vesselData.gross_tonnage) : null,
          location: vesselData.location,
          notes: vesselData.notes,
          notification_email: vesselData.notification_email || null,
        };

        if (photoUrl !== undefined) {
          vesselUpdate.photo_url = photoUrl;
        }

        if (vessel) {
          const { error: vesselError } = await supabase
            .from('vessels')
            .update(vesselUpdate)
            .eq('id', vessel.id);

          if (vesselError) throw vesselError;
        } else {
          const { error: vesselError } = await supabase
            .from('vessels')
            .insert([{ ...vesselUpdate, company_id: customer.id }]);

          if (vesselError) throw vesselError;
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating customer:', err);
      setError(err.message || 'Failed to update customer');
    } finally {
      setIsLoading(false);
    }
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

  if (!isOpen || !customer) return null;

  const isYachtOwner = customerType === 'yacht_owner';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              {isYachtOwner ? <Ship className="w-6 h-6 text-white" /> : <Building2 className="w-6 h-6 text-white" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{t('customers.editCustomerTitle')}</h2>
              <p className="text-sm text-gray-500">
                {isYachtOwner ? 'Yacht Owner' : 'Agency / Armador'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Client Type</label>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setCustomerType('yacht_owner')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  customerType === 'yacht_owner'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Ship className="w-4 h-4" />
                Yacht Owner
              </button>
              <button
                type="button"
                onClick={() => setCustomerType('agency')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-l border-gray-200 ${
                  customerType === 'agency'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Building2 className="w-4 h-4" />
                Agency / Armador
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {isYachtOwner && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Ship className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-semibold text-gray-900">Vessel Information</h3>
              </div>

              {isFetchingVessel ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                  Loading vessel data...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vessel Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={vesselData.name}
                      onChange={handleVesselChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vessel Type</label>
                    <select
                      name="type"
                      value={vesselData.type}
                      onChange={handleVesselChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {VESSEL_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Manufacturer</label>
                    <input
                      type="text"
                      name="manufacturer"
                      value={vesselData.manufacturer}
                      onChange={handleVesselChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g. Feadship, Lurssen"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                    <input
                      type="text"
                      name="model"
                      value={vesselData.model}
                      onChange={handleVesselChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Year Built</label>
                    <input
                      type="number"
                      name="year_built"
                      value={vesselData.year_built}
                      onChange={handleVesselChange}
                      min={1900}
                      max={new Date().getFullYear()}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Flag</label>
                    <input
                      type="text"
                      name="flag"
                      value={vesselData.flag}
                      onChange={handleVesselChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g. Cayman Islands, Malta"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">IMO Number</label>
                    <input
                      type="text"
                      name="imo_number"
                      value={vesselData.imo_number}
                      onChange={handleVesselChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">MMSI</label>
                    <input
                      type="text"
                      name="mmsi"
                      value={vesselData.mmsi}
                      onChange={handleVesselChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Call Sign</label>
                    <input
                      type="text"
                      name="call_sign"
                      value={vesselData.call_sign}
                      onChange={handleVesselChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Registration ID</label>
                    <input
                      type="text"
                      name="registration_id"
                      value={vesselData.registration_id}
                      onChange={handleVesselChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Length Overall (m)</label>
                    <input
                      type="number"
                      name="length_overall"
                      value={vesselData.length_overall}
                      onChange={handleVesselChange}
                      step="0.1"
                      min={0}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Beam (m)</label>
                    <input
                      type="number"
                      name="beam"
                      value={vesselData.beam}
                      onChange={handleVesselChange}
                      step="0.1"
                      min={0}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Gross Tonnage (GT)</label>
                    <input
                      type="number"
                      name="gross_tonnage"
                      value={vesselData.gross_tonnage}
                      onChange={handleVesselChange}
                      step="0.1"
                      min={0}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current Location / Port</label>
                    <input
                      type="text"
                      name="location"
                      value={vesselData.location}
                      onChange={handleVesselChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g. Palma de Mallorca"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vessel Notes</label>
                    <textarea
                      name="notes"
                      value={vesselData.notes}
                      onChange={handleVesselChange}
                      rows={2}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Owner / Vessel Notification Email
                    </label>
                    <input
                      type="email"
                      name="notification_email"
                      value={vesselData.notification_email}
                      onChange={handleVesselChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="owner@example.com"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This person receives daily alerts for this vessel only, independently of company notifications.
                    </p>
                  </div>

                  <div className="md:col-span-2">
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
                          alt="Vessel"
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
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-semibold text-gray-900">
                {isYachtOwner ? 'Owner Information' : 'Company Information'}
              </h3>
            </div>

            {!isYachtOwner && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company / Armador Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('customers.contactPhone')}</label>
                <input
                  type="tel"
                  name="contact_phone"
                  value={formData.contact_phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-gray-900">Subscription</h3>
            </div>
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
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Renewal Date</label>
                <input
                  type="date"
                  name="subscription_renewal_date"
                  value={formData.subscription_renewal_date}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {!isYachtOwner && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('customers.vesselLimit')} *</label>
                  <input
                    type="number"
                    name="vessel_limit"
                    value={formData.vessel_limit}
                    onChange={handleChange}
                    min={1}
                    max={100}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
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
              placeholder="Internal notes..."
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-semibold text-gray-900">Email Notifications</h3>
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
                  Automated daily alerts for overdue maintenance and low stock. Contact email is always included.
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

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? t('common.loading') : t('common.saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
