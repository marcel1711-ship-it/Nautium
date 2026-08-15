import React, { useState, useEffect } from 'react';
import {
  Ship,
  User,
  Mail,
  Phone,
  Building2,
  MapPin,
  Anchor,
  Hash,
  Ruler,
  Weight,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Bell,
  FileText,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface OnboardingToken {
  token: string;
  contact_email: string;
  contact_name: string;
  used: boolean;
  expires_at: string;
}

type AccountType = 'owner' | 'agency';

interface FormData {
  customer_type: AccountType;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  vessel_limit: string;
  vessel_name: string;
  vessel_type: string;
  manufacturer: string;
  model: string;
  year_built: string;
  flag_state: string;
  current_location: string;
  imo_number: string;
  mmsi: string;
  call_sign: string;
  registration_no: string;
  length_overall: string;
  beam: string;
  gross_tonnage: string;
  owner_name: string;
  owner_email: string;
  daily_alert_notifications: boolean;
  notes: string;
}

const VESSEL_TYPES = [
  'Motor Yacht',
  'Sailing Yacht',
  'Catamaran',
  'Explorer Yacht',
  'Superyacht',
  'Gulet',
  'Other',
];

const STEPS = [
  { id: 1, label: 'Account Type', labelEs: 'Tipo de cuenta' },
  { id: 2, label: 'Contact Info', labelEs: 'Información de contacto' },
  { id: 3, label: 'Vessel Details', labelEs: 'Detalles del barco' },
  { id: 4, label: 'Technical', labelEs: 'Técnico' },
  { id: 5, label: 'Owner Access', labelEs: 'Acceso propietario' },
  { id: 6, label: 'Notes', labelEs: 'Notas' },
];

const InputField: React.FC<{
  label: string;
  labelEs?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  icon?: React.ReactNode;
  hint?: string;
}> = ({ label, labelEs, value, onChange, type = 'text', placeholder, required, readOnly, icon, hint }) => (
  <div>
    <label className="block mb-1.5">
      <span className="text-sm font-semibold text-white/90">{label}{required && <span className="text-[#38bdf8] ml-1">*</span>}</span>
      {labelEs && <span className="text-xs text-white/30 ml-2">/ {labelEs}</span>}
    </label>
    <div className="relative">
      {icon && (
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">
          {icon}
        </div>
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        readOnly={readOnly}
        className={`w-full ${icon ? 'pl-10' : 'pl-4'} pr-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all
          ${readOnly
            ? 'bg-white/[0.04] border border-white/[0.06] text-white/50 cursor-not-allowed'
            : 'bg-white/[0.06] border border-white/[0.10] focus:border-[#38bdf8]/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-[#38bdf8]/10 hover:border-white/20'
          }`}
      />
    </div>
    {hint && <p className="mt-1 text-xs text-white/30">{hint}</p>}
  </div>
);

const SelectField: React.FC<{
  label: string;
  labelEs?: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  required?: boolean;
  icon?: React.ReactNode;
}> = ({ label, labelEs, value, onChange, options, required, icon }) => (
  <div>
    <label className="block mb-1.5">
      <span className="text-sm font-semibold text-white/90">{label}{required && <span className="text-[#38bdf8] ml-1">*</span>}</span>
      {labelEs && <span className="text-xs text-white/30 ml-2">/ {labelEs}</span>}
    </label>
    <div className="relative">
      {icon && (
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">
          {icon}
        </div>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className={`w-full ${icon ? 'pl-10' : 'pl-4'} pr-10 py-3 rounded-xl text-sm text-white outline-none transition-all appearance-none
          bg-white/[0.06] border border-white/[0.10] focus:border-[#38bdf8]/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-[#38bdf8]/10 hover:border-white/20`}
        style={{ backgroundImage: 'none' }}
      >
        <option value="" className="bg-[#0d1f3c]">Select...</option>
        {options.map(o => <option key={o} value={o} className="bg-[#0d1f3c]">{o}</option>)}
      </select>
      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none rotate-90" />
    </div>
  </div>
);

export const Onboarding: React.FC = () => {
  const [tokenStr, setTokenStr] = useState('');
  const [tokenData, setTokenData] = useState<OnboardingToken | null>(null);
  const [tokenStatus, setTokenStatus] = useState<'loading' | 'valid' | 'invalid' | 'used' | 'expired'>('loading');
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [form, setForm] = useState<FormData>({
    customer_type: 'owner',
    company_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    vessel_limit: '',
    vessel_name: '',
    vessel_type: '',
    manufacturer: '',
    model: '',
    year_built: '',
    flag_state: '',
    current_location: '',
    imo_number: '',
    mmsi: '',
    call_sign: '',
    registration_no: '',
    length_overall: '',
    beam: '',
    gross_tonnage: '',
    owner_name: '',
    owner_email: '',
    daily_alert_notifications: false,
    notes: '',
  });

  const set = (field: keyof FormData, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') || '';
    setTokenStr(t);
    if (!t) { setTokenStatus('invalid'); return; }
    validateToken(t);
  }, []);

  const validateToken = async (t: string) => {
    const { data, error } = await supabase
      .from('onboarding_tokens')
      .select('token, contact_email, contact_name, used, expires_at')
      .eq('token', t)
      .maybeSingle();

    if (error || !data) { setTokenStatus('invalid'); return; }
    if (data.used) { setTokenStatus('used'); return; }
    if (new Date(data.expires_at) < new Date()) { setTokenStatus('expired'); return; }

    setTokenData(data);
    setForm(prev => ({
      ...prev,
      contact_name: data.contact_name,
      contact_email: data.contact_email,
    }));
    setTokenStatus('valid');
  };

  const handleSubmit = async () => {
    if (!tokenData) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      const { error: insertError } = await supabase
        .from('onboarding_submissions')
        .insert({
          token: tokenStr,
         customer_type: form.customer_type === 'owner' ? 'yacht_owner_captain' : 'agency',
          company_name: form.customer_type === 'agency' ? form.company_name : null,
          contact_name: form.contact_name,
          contact_email: form.contact_email,
          contact_phone: form.contact_phone || null,
          vessel_limit: form.vessel_limit ? parseInt(form.vessel_limit) : null,
          vessel_name: form.vessel_name || null,
          vessel_type: form.vessel_type || null,
          current_location: form.current_location || null,
          manufacturer: form.manufacturer || null,
          model: form.model || null,
          year_built: form.year_built ? parseInt(form.year_built) : null,
          flag_state: form.flag_state || null,
          imo_number: form.imo_number || null,
          mmsi: form.mmsi || null,
          call_sign: form.call_sign || null,
          registration_no: form.registration_no || null,
          length_overall: form.length_overall ? parseFloat(form.length_overall) : null,
          beam: form.beam ? parseFloat(form.beam) : null,
          gross_tonnage: form.gross_tonnage ? parseFloat(form.gross_tonnage) : null,
          owner_name: form.owner_name || null,
          owner_email: form.owner_email || null,
          daily_alert_notifications: form.daily_alert_notifications,
          notes: form.notes || null,
          status: 'pending',
        });

      if (insertError) throw insertError;

      await supabase
        .from('onboarding_tokens')
        .update({ used: true })
        .eq('token', tokenStr);

      setSubmitted(true);
    } catch (err: any) {
      setSubmitError('Something went wrong. Please try again or contact support.');
    } finally {
      setSubmitting(false);
    }
  };

  const canProceedStep1 = true;
  const canProceedStep2 = !!form.contact_name && !!form.contact_email;
  const canProceedStep3 = !!form.vessel_name && !!form.vessel_type;
  const canProceed = [true, canProceedStep1, canProceedStep2, canProceedStep3, true, true, true][step] ?? true;

  // ── Loading ──
  if (tokenStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#05111e] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#38bdf8] animate-spin" />
      </div>
    );
  }

  // ── Invalid / Used / Expired ──
  if (tokenStatus !== 'valid') {
    const msgs: Record<string, { title: string; titleEs: string; body: string; bodyEs: string }> = {
      invalid: {
        title: 'Invalid invitation link',
        titleEs: 'Enlace de invitación no válido',
        body: 'This link does not exist or has already been used. If you believe this is an error, contact us at hello@nautium.app',
        bodyEs: 'Este enlace no existe o ya ha sido utilizado. Si crees que es un error, contáctanos en hello@nautium.app',
      },
      used: {
        title: 'Link already used',
        titleEs: 'Enlace ya utilizado',
        body: 'This invitation has already been submitted. If you need to make changes, contact us at hello@nautium.app',
        bodyEs: 'Esta invitación ya fue enviada. Si necesitas hacer cambios, contáctanos en hello@nautium.app',
      },
      expired: {
        title: 'Link expired',
        titleEs: 'Enlace caducado',
        body: 'This invitation link has expired. Please contact us at hello@nautium.app to receive a new one.',
        bodyEs: 'Este enlace de invitación ha caducado. Contáctanos en hello@nautium.app para recibir uno nuevo.',
      },
    };
    const m = msgs[tokenStatus] ?? msgs.invalid;
    return (
      <div className="min-h-screen bg-[#05111e] flex items-center justify-center p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-[radial-gradient(circle,rgba(14,116,144,0.06),transparent_65%)]" />
        </div>
        <div className="relative w-full max-w-md text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Ship className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Nautium</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{m.title}</h1>
          <p className="text-sm text-white/40 mb-4">{m.titleEs}</p>
          <p className="text-sm text-white/60 leading-relaxed mb-2">{m.body}</p>
          <p className="text-xs text-white/30 leading-relaxed italic">{m.bodyEs}</p>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#05111e] flex items-center justify-center p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-[radial-gradient(circle,rgba(14,116,144,0.07),transparent_65%)]" />
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(92,196,176,0.04),transparent_65%)]" />
        </div>
        <div className="relative w-full max-w-md text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Ship className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Nautium</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">You're on board!</h1>
          <p className="text-sm text-white/40 mb-6">¡Estás a bordo!</p>
          <p className="text-white/70 text-sm leading-relaxed mb-2">
            We've received your details and will set up your account shortly. You'll get an email at <strong className="text-[#38bdf8]">{form.contact_email}</strong> once everything is ready.
          </p>
          <p className="text-white/30 text-xs leading-relaxed italic">
            Hemos recibido tus datos y configuraremos tu cuenta en breve. Recibirás un correo en <strong className="text-[#38bdf8]/60">{form.contact_email}</strong> cuando todo esté listo.
          </p>
        </div>
      </div>
    );
  }

  // ── Step indicator ──
  const StepIndicator = () => (
    <div className="flex items-center gap-1 justify-center mb-8">
      {STEPS.map((s, i) => {
        const done = step > s.id;
        const active = step === s.id;
        return (
          <React.Fragment key={s.id}>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
              done ? 'bg-[#5cc4b0] text-white' :
              active ? 'bg-[#38bdf8] text-white ring-4 ring-[#38bdf8]/20' :
              'bg-white/[0.06] text-white/30'
            }`}>
              {done ? <CheckCircle className="w-4 h-4" /> : s.id}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 max-w-8 transition-all ${done ? 'bg-[#5cc4b0]' : 'bg-white/[0.08]'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; titleEs: string; subtitle?: string }> = ({ icon, title, titleEs, subtitle }) => (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2 rounded-xl bg-[#38bdf8]/10 text-[#38bdf8]">{icon}</div>
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="text-xs text-white/30">{titleEs}</p>
        </div>
      </div>
      {subtitle && <p className="text-sm text-white/40 mt-2 ml-11">{subtitle}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#05111e] py-10 px-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-60 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] rounded-full bg-[radial-gradient(circle,rgba(14,116,144,0.07),transparent_65%)]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(92,196,176,0.04),transparent_65%)]" />
      </div>

      <div className="relative max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Ship className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Nautium</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Welcome aboard</h1>
          <p className="text-white/40 text-sm">Bienvenido a bordo</p>
          {tokenData?.contact_name && (
            <p className="mt-3 text-[#38bdf8] text-sm font-medium">
              Hi {tokenData.contact_name} — your beta access has been approved.
            </p>
          )}
        </div>

        {/* Step indicator */}
        <StepIndicator />

        {/* Card */}
        <div className="bg-[#0d1f3c] rounded-3xl border border-white/[0.07] shadow-2xl shadow-black/40 overflow-hidden">
          <div className="p-8">

            {/* ── STEP 1: Account Type ── */}
            {step === 1 && (
              <div>
                <SectionHeader
                  icon={<Layers className="w-5 h-5" />}
                  title="Account Type"
                  titleEs="Tipo de cuenta"
                  subtitle="How will you use Nautium? / ¿Cómo usarás Nautium?"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([
                    {
                      value: 'owner' as AccountType,
                      icon: <Anchor className="w-6 h-6" />,
                      title: 'Yacht Owner / Captain / Engineer',
                      titleEs: 'Propietario / Capitán / Ingeniero',
                      desc: 'Single vessel management',
                      descEs: 'Gestión de un barco',
                    },
                    {
                      value: 'agency' as AccountType,
                      icon: <Building2 className="w-6 h-6" />,
                      title: 'Agency / Fleet Manager',
                      titleEs: 'Agencia / Gestor de flota',
                      desc: 'Multiple vessels',
                      descEs: 'Varios barcos',
                    },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set('customer_type', opt.value)}
                      className={`relative p-5 rounded-2xl border text-left transition-all group ${
                        form.customer_type === opt.value
                          ? 'bg-[#38bdf8]/10 border-[#38bdf8]/50 ring-2 ring-[#38bdf8]/20'
                          : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/20'
                      }`}
                    >
                      <div className={`mb-3 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                        form.customer_type === opt.value ? 'bg-[#38bdf8]/20 text-[#38bdf8]' : 'bg-white/[0.06] text-white/40 group-hover:text-white/60'
                      }`}>
                        {opt.icon}
                      </div>
                      <p className="font-bold text-white text-sm mb-0.5">{opt.title}</p>
                      <p className="text-xs text-white/30 mb-1">{opt.titleEs}</p>
                      <p className="text-xs text-white/50">{opt.desc}</p>
                      <p className="text-xs text-white/25 italic">{opt.descEs}</p>
                      {form.customer_type === opt.value && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#38bdf8] flex items-center justify-center">
                          <CheckCircle className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── STEP 2: Contact Info ── */}
            {step === 2 && (
              <div className="space-y-4">
                <SectionHeader
                  icon={<User className="w-5 h-5" />}
                  title="Contact Information"
                  titleEs="Información de contacto"
                />

                {form.customer_type === 'agency' && (
                  <InputField
                    label="Company Name"
                    labelEs="Nombre de empresa"
                    value={form.company_name}
                    onChange={v => set('company_name', v)}
                    placeholder="e.g. Blue Ocean Yachting"
                    required
                    icon={<Building2 className="w-4 h-4" />}
                  />
                )}

                <InputField
                  label="Contact Name"
                  labelEs="Nombre de contacto"
                  value={form.contact_name}
                  onChange={v => set('contact_name', v)}
                  placeholder="Full name"
                  required
                  icon={<User className="w-4 h-4" />}
                />

                <InputField
                  label="Contact Email"
                  labelEs="Correo electrónico"
                  value={form.contact_email}
                  onChange={() => {}}
                  type="email"
                  required
                  readOnly
                  icon={<Mail className="w-4 h-4" />}
                  hint="Pre-filled from your invitation / Completado desde tu invitación"
                />

                <InputField
                  label="Phone / WhatsApp"
                  labelEs="Teléfono / WhatsApp"
                  value={form.contact_phone}
                  onChange={v => set('contact_phone', v)}
                  placeholder="+1 555 000 0000"
                  type="tel"
                  icon={<Phone className="w-4 h-4" />}
                />

                {form.customer_type === 'agency' && (
                  <InputField
                    label="Number of Vessels"
                    labelEs="Número de barcos"
                    value={form.vessel_limit}
                    onChange={v => set('vessel_limit', v)}
                    type="number"
                    placeholder="e.g. 5"
                    icon={<Ship className="w-4 h-4" />}
                    hint="Approximate fleet size / Tamaño aproximado de la flota"
                  />
                )}
              </div>
            )}

            {/* ── STEP 3: Vessel Details ── */}
            {step === 3 && (
              <div className="space-y-4">
                <SectionHeader
                  icon={<Ship className="w-5 h-5" />}
                  title="Vessel Details"
                  titleEs="Detalles del barco"
                  subtitle={form.customer_type === 'agency' ? 'Primary vessel / Barco principal' : undefined}
                />

                <InputField
                  label="Vessel Name"
                  labelEs="Nombre del barco"
                  value={form.vessel_name}
                  onChange={v => set('vessel_name', v)}
                  placeholder="e.g. Azure Dream"
                  required
                  icon={<Anchor className="w-4 h-4" />}
                />

                <SelectField
                  label="Vessel Type"
                  labelEs="Tipo de barco"
                  value={form.vessel_type}
                  onChange={v => set('vessel_type', v)}
                  options={VESSEL_TYPES}
                  required
                  icon={<Ship className="w-4 h-4" />}
                />

                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Manufacturer"
                    labelEs="Fabricante"
                    value={form.manufacturer}
                    onChange={v => set('manufacturer', v)}
                    placeholder="e.g. Ferretti"
                  />
                  <InputField
                    label="Model / Series"
                    labelEs="Modelo / Serie"
                    value={form.model}
                    onChange={v => set('model', v)}
                    placeholder="e.g. Custom 96"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Year Built"
                    labelEs="Año de construcción"
                    value={form.year_built}
                    onChange={v => set('year_built', v)}
                    type="number"
                    placeholder="e.g. 2018"
                  />
                  <InputField
                    label="Flag State"
                    labelEs="País de bandera"
                    value={form.flag_state}
                    onChange={v => set('flag_state', v)}
                    placeholder="e.g. Cayman Islands"
                    icon={<Anchor className="w-4 h-4" />}
                  />
                </div>

                <InputField
                  label="Current Location / Home Port"
                  labelEs="Ubicación actual / Puerto base"
                  value={form.current_location}
                  onChange={v => set('current_location', v)}
                  placeholder="e.g. Monaco"
                  icon={<MapPin className="w-4 h-4" />}
                />
              </div>
            )}

            {/* ── STEP 4: Technical Identifiers ── */}
            {step === 4 && (
              <div className="space-y-4">
                <SectionHeader
                  icon={<Hash className="w-5 h-5" />}
                  title="Technical Identifiers"
                  titleEs="Identificadores técnicos"
                  subtitle="All optional — fill in what you have / Todo opcional"
                />

                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="IMO Number"
                    labelEs="Número IMO"
                    value={form.imo_number}
                    onChange={v => set('imo_number', v)}
                    placeholder="e.g. 9876543"
                  />
                  <InputField
                    label="MMSI"
                    value={form.mmsi}
                    onChange={v => set('mmsi', v)}
                    placeholder="e.g. 123456789"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Call Sign"
                    labelEs="Indicativo"
                    value={form.call_sign}
                    onChange={v => set('call_sign', v)}
                    placeholder="e.g. VABC"
                  />
                  <InputField
                    label="Registration No."
                    labelEs="Nº de registro"
                    value={form.registration_no}
                    onChange={v => set('registration_no', v)}
                    placeholder="e.g. MY-2018-ADR"
                  />
                </div>

                <div className="pt-2 border-t border-white/[0.06]">
                  <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">
                    Dimensions / Dimensiones
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <InputField
                      label="LOA (m)"
                      labelEs="Eslora"
                      value={form.length_overall}
                      onChange={v => set('length_overall', v)}
                      type="number"
                      placeholder="85"
                      icon={<Ruler className="w-4 h-4" />}
                    />
                    <InputField
                      label="Beam (m)"
                      labelEs="Manga"
                      value={form.beam}
                      onChange={v => set('beam', v)}
                      type="number"
                      placeholder="12"
                      icon={<Ruler className="w-4 h-4" />}
                    />
                    <InputField
                      label="GT"
                      labelEs="GT"
                      value={form.gross_tonnage}
                      onChange={v => set('gross_tonnage', v)}
                      type="number"
                      placeholder="1200"
                      icon={<Weight className="w-4 h-4" />}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 5: Owner Access ── */}
            {step === 5 && (
              <div className="space-y-5">
                <SectionHeader
                  icon={<User className="w-5 h-5" />}
                  title="Owner Access"
                  titleEs="Acceso del propietario"
                  subtitle="Optional: give the vessel owner read-only access / Opcional: acceso de solo lectura para el propietario"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Owner Full Name"
                    labelEs="Nombre completo del propietario"
                    value={form.owner_name}
                    onChange={v => set('owner_name', v)}
                    placeholder="e.g. Richard Morgan"
                    icon={<User className="w-4 h-4" />}
                  />
                  <InputField
                    label="Owner Email"
                    labelEs="Correo del propietario"
                    value={form.owner_email}
                    onChange={v => set('owner_email', v)}
                    type="email"
                    placeholder="owner@example.com"
                    icon={<Mail className="w-4 h-4" />}
                  />
                </div>

                {/* Daily alert toggle */}
                <button
                  type="button"
                  onClick={() => set('daily_alert_notifications', !form.daily_alert_notifications)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                    form.daily_alert_notifications
                      ? 'bg-[#38bdf8]/10 border-[#38bdf8]/40'
                      : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    form.daily_alert_notifications ? 'bg-[#38bdf8]/20 text-[#38bdf8]' : 'bg-white/[0.06] text-white/30'
                  }`}>
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-white">Daily Alert Notifications</p>
                    <p className="text-xs text-white/30">Notificaciones de alertas diarias</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      Send daily maintenance & stock alerts to the owner email
                    </p>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-all relative flex-shrink-0 ${
                    form.daily_alert_notifications ? 'bg-[#38bdf8]' : 'bg-white/10'
                  }`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                      form.daily_alert_notifications ? 'left-7' : 'left-1'
                    }`} />
                  </div>
                </button>
              </div>
            )}

            {/* ── STEP 6: Notes & Submit ── */}
            {step === 6 && (
              <div className="space-y-5">
                <SectionHeader
                  icon={<FileText className="w-5 h-5" />}
                  title="Additional Notes"
                  titleEs="Notas adicionales"
                  subtitle="Anything else we should know? / ¿Algo más que debamos saber?"
                />

                <div>
                  <label className="block mb-1.5">
                    <span className="text-sm font-semibold text-white/90">Notes</span>
                    <span className="text-xs text-white/30 ml-2">/ Notas</span>
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={e => set('notes', e.target.value)}
                    rows={4}
                    placeholder="Special requirements, current maintenance status, anything you'd like to mention..."
                    className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all resize-none bg-white/[0.06] border border-white/[0.10] focus:border-[#38bdf8]/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-[#38bdf8]/10 hover:border-white/20"
                  />
                </div>

                {/* Summary */}
                <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5 space-y-2.5">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Summary / Resumen</p>
                  {[
                    { label: 'Type', value: form.customer_type === 'owner' ? 'Yacht Owner / Captain' : 'Agency / Fleet Manager' },
                    { label: 'Contact', value: `${form.contact_name} — ${form.contact_email}` },
                    form.customer_type === 'agency' && form.company_name ? { label: 'Company', value: form.company_name } : null,
                    { label: 'Vessel', value: `${form.vessel_name}${form.vessel_type ? ` (${form.vessel_type})` : ''}` },
                    form.current_location ? { label: 'Location', value: form.current_location } : null,
                    form.owner_email ? { label: 'Owner', value: `${form.owner_name} — ${form.owner_email}` } : null,
                  ].filter(Boolean).map((row: any) => (
                    <div key={row.label} className="flex gap-3 text-sm">
                      <span className="text-white/30 w-16 shrink-0">{row.label}</span>
                      <span className="text-white/80 font-medium">{row.value}</span>
                    </div>
                  ))}
                </div>

                {submitError && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {submitError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation footer */}
          <div className="flex items-center justify-between px-8 py-5 border-t border-white/[0.06] bg-white/[0.02]">
            <button
              type="button"
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white/50 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-0 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" />
              Back / Atrás
            </button>

            <div className="flex items-center gap-1">
              {STEPS.map(s => (
                <div
                  key={s.id}
                  className={`rounded-full transition-all ${
                    step === s.id ? 'w-5 h-2 bg-[#38bdf8]' :
                    step > s.id ? 'w-2 h-2 bg-[#5cc4b0]' :
                    'w-2 h-2 bg-white/10'
                  }`}
                />
              ))}
            </div>

            {step < STEPS.length ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-[#38bdf8] to-[#5cc4b0] text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-[1.02] transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                Next / Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-[#38bdf8] to-[#5cc4b0] text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Submit / Enviar</>
                )}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-white/20 mt-6">
          nautium.app — Beta Access / Acceso Beta
        </p>
      </div>
    </div>
  );
};
