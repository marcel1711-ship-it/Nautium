import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck, Plus, Search, AlertTriangle, CheckCircle,
  Clock, X, Calendar, FileText, User, Ship, ChevronDown, Trash2,
  ArrowLeft, Upload, ExternalLink, Pencil, Download,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, fetchByCompany, dbInsert, dbUpdate } from '../lib/supabase';
import { useToast } from '../components/UI/Toast';
import { canCreate, UserRole } from '../types';
import { validateDocumentFile } from '../lib/security';

interface ComplianceProps {
  onNavigate: (page: string, params?: any) => void;
}
interface ComplianceItem {
  id: string;
  company_id: string;
  vessel_id: string;
  type: 'vessel' | 'crew';
  name: string;
  issuing_authority: string | null;
  issued_date: string | null;
  expiry_date: string;
  document_url: string | null;
  assigned_to: string | null;
  crew_member_id: string | null;
  notes: string | null;
}
interface VesselOption { id: string; name: string; }
interface CrewOption { id: string; full_name: string; position: string; vessel_id: string; photo_url: string | null; }

const VESSEL_CERTIFICATES = [
  'Safety Management Certificate', 'Certificate of Registry', 'Radio License',
  'Hull & Machinery Insurance', 'P&I Insurance', 'Tonnage Certificate',
  'Safety Equipment Certificate', 'Load Line Certificate', 'Passenger Ship Safety Certificate',
  'International Oil Pollution Prevention', 'International Air Pollution Prevention',
  'Anti-fouling System Certificate', 'Other',
];
const CREW_CERTIFICATES = [
  'STCW Basic Safety Training', 'ENG1 Medical Certificate', 'VHF/DSC Radio Operator',
  'Firefighting Advanced', 'Medical First Aid', 'Proficiency in Survival Craft',
  'Advanced Fire Fighting', 'GMDSS Operator', 'Officer of the Watch',
  'Chief Mate Certificate', 'Master Certificate', 'Chief Engineer Certificate',
  'PADI Rescue Diver', 'Other',
];

const getDaysUntilExpiry = (date: string) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};
const getStatus = (days: number) => {
  if (days < 0) return 'expired';
  if (days <= 30) return 'critical';
  if (days <= 90) return 'expiring';
  return 'valid';
};
const STATUS_STYLES = {
  expired:  { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500',    label: 'Expired',        color: 'text-red-600' },
  critical: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', label: 'Expiring soon',  color: 'text-orange-600' },
  expiring: { bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400',  label: 'Expiring',       color: 'text-amber-600' },
  valid:    { bg: 'bg-white',     border: 'border-gray-200',   badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500',  label: 'Valid',          color: 'text-green-600' },
};
const formatDate = (date: string | null) => date ? new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const isPDF = (url: string) => url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf');

// ── DOCUMENT UPLOAD HELPER ───────────────────────────────────────────────────
const uploadDocument = async (file: File, userId: string, itemId: string): Promise<string | null> => {
  const ext = file.name.split('.').pop();
  const path = `compliance/${userId}/${itemId}_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('task-photos').upload(path, file, { upsert: true });
  if (error) return null;
  const { data } = supabase.storage.from('task-photos').getPublicUrl(path);
  return data.publicUrl;
};

// ── ADD / EDIT MODAL ─────────────────────────────────────────────────────────
const ComplianceModal: React.FC<{
  item?: ComplianceItem | null;
  vessels: VesselOption[];
  crewMembers: CrewOption[];
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ item, vessels, crewMembers, companyId, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    vessel_id: item?.vessel_id || vessels[0]?.id || '',
    type: item?.type || 'vessel' as 'vessel' | 'crew',
    name: item?.name || '',
    issuing_authority: item?.issuing_authority || '',
    issued_date: item?.issued_date || '',
    expiry_date: item?.expiry_date || '',
    crew_member_id: item?.crew_member_id || '',
    assigned_to: item?.assigned_to || '',
    notes: item?.notes || '',
    document_url: item?.document_url || '',
  });

  const filteredCrew = crewMembers.filter(c => !form.vessel_id || c.vessel_id === form.vessel_id);

  const suggestions = form.type === 'vessel' ? VESSEL_CERTIFICATES : CREW_CERTIFICATES;

  const handleDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const valErr = validateDocumentFile(file);
    if (valErr) { showToast(valErr, 'warning'); return; }
    setDocFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => setDocPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setDocPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.expiry_date || !form.vessel_id) { showToast('Please fill in required fields', 'warning'); return; }
    setSaving(true);
    try {
      let document_url = form.document_url || null;
      // Upload document if selected
      if (docFile && currentUser) {
        setUploadingDoc(true);
        const tmpId = item?.id || `tmp_${Date.now()}`;
        const url = await uploadDocument(docFile, currentUser.id, tmpId);
        if (url) document_url = url;
        setUploadingDoc(false);
      }
      const selectedCrew = crewMembers.find(c => c.id === form.crew_member_id);
      const data = {
        ...form, company_id: companyId, document_url,
        issuing_authority: form.issuing_authority || null,
        issued_date: form.issued_date || null,
        crew_member_id: form.crew_member_id || null,
        assigned_to: selectedCrew ? selectedCrew.full_name : (form.assigned_to || null),
        notes: form.notes || null,
      };
      if (item) { await dbUpdate('compliance_items', item.id, data); }
      else { await dbInsert('compliance_items', data); }
      showToast(item ? 'Certificate updated' : 'Certificate added', 'success');
      onSaved(); onClose();
    } catch { showToast('Error saving certificate', 'error'); }
    finally { setSaving(false); }
  };

  const currentDoc = docFile ? (docPreview || docFile.name) : form.document_url;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{item ? 'Edit Certificate' : 'Add Certificate'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X className="w-5 h-5 text-gray-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Type toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Certificate type *</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setForm({ ...form, type: 'vessel', name: '' })}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${form.type === 'vessel' ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-gray-200'}`}>
                <Ship className={`w-5 h-5 ${form.type === 'vessel' ? 'text-blue-600' : 'text-gray-400'}`} />
                <div className="text-left">
                  <div className={`text-sm font-semibold ${form.type === 'vessel' ? 'text-blue-700' : 'text-gray-600'}`}>Vessel</div>
                  <div className="text-xs text-gray-400">Ship certificates</div>
                </div>
              </button>
              <button type="button" onClick={() => setForm({ ...form, type: 'crew', name: '' })}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${form.type === 'crew' ? 'bg-purple-50 border-purple-400' : 'bg-gray-50 border-gray-200'}`}>
                <User className={`w-5 h-5 ${form.type === 'crew' ? 'text-purple-600' : 'text-gray-400'}`} />
                <div className="text-left">
                  <div className={`text-sm font-semibold ${form.type === 'crew' ? 'text-purple-700' : 'text-gray-600'}`}>Crew</div>
                  <div className="text-xs text-gray-400">Personal certificates</div>
                </div>
              </button>
            </div>
          </div>

          {/* Vessel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Vessel *</label>
            <select value={form.vessel_id} onChange={e => setForm({ ...form, vessel_id: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
              {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>

          {/* Certificate name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Certificate name *</label>
            <select value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
              <option value="">Select certificate...</option>
              {suggestions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Crew member */}
          {form.type === 'crew' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Crew member *</label>
              {filteredCrew.length > 0 ? (
                <select value={form.crew_member_id} onChange={e => {
                  const cm = crewMembers.find(c => c.id === e.target.value);
                  setForm({ ...form, crew_member_id: e.target.value, assigned_to: cm?.full_name || '' });
                }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
                  <option value="">Select crew member...</option>
                  {filteredCrew.map(c => <option key={c.id} value={c.id}>{c.full_name} — {c.position}</option>)}
                </select>
              ) : (
                <input type="text" value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Captain James" required />
              )}
            </div>
          )}

          {/* Issuing authority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Issuing authority</label>
            <input type="text" value={form.issuing_authority} onChange={e => setForm({ ...form, issuing_authority: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. MCA, USCG, Flag State..." />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Issue date</label>
              <input type="date" value={form.issued_date} onChange={e => setForm({ ...form, issued_date: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Expiry date *</label>
              <input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
            </div>
          </div>

          {/* Document upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />Certificate document (PDF or photo)
            </label>
            {currentDoc ? (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <FileText className="w-8 h-8 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-900 truncate">
                    {docFile ? docFile.name : 'Document attached'}
                  </p>
                  <p className="text-xs text-blue-600">
                    {docFile ? `${(docFile.size / 1024 / 1024).toFixed(1)} MB` : 'Click to replace'}
                  </p>
                </div>
                <button type="button" onClick={() => { setDocFile(null); setDocPreview(null); setForm({ ...form, document_url: '' }); }}
                  className="p-1.5 hover:bg-blue-200 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-blue-600" />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-colors cursor-pointer"
                onClick={() => docInputRef.current?.click()}>
                <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1.5" />
                <p className="text-sm text-gray-600 font-medium">Click to upload certificate</p>
                <p className="text-xs text-gray-400 mt-0.5">PDF, JPEG, PNG up to 10 MB</p>
              </div>
            )}
            <input ref={docInputRef} type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={handleDocSelect} />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Renewal pending, special conditions..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving || uploadingDoc}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg disabled:opacity-50">
              {saving || uploadingDoc ? 'Saving...' : item ? 'Save changes' : 'Add certificate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── CERTIFICATE DETAIL ───────────────────────────────────────────────────────
const CertificateDetail: React.FC<{
  item: ComplianceItem;
  vessels: VesselOption[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  userCanCreate: boolean;
}> = ({ item, vessels, onBack, onEdit, onDelete, userCanCreate }) => {
  const days = getDaysUntilExpiry(item.expiry_date);
  const status = getStatus(days);
  const s = STATUS_STYLES[status];
  const vessel = vessels.find(v => v.id === item.vessel_id);
  const isImage = item.document_url && !isPDF(item.document_url);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-gray-900">{item.name}</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${s.badge}`}>{s.label}</span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${item.type === 'vessel' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
              {item.type === 'vessel' ? '🚢 Vessel' : '👤 Crew'}
            </span>
          </div>
          {item.assigned_to && <p className="text-gray-500 mt-1">{item.assigned_to}</p>}
        </div>
        {userCanCreate && (
          <div className="flex items-center gap-2">
            <button onClick={onDelete} className="flex items-center gap-2 px-4 py-3 border border-red-200 text-red-600 bg-red-50 rounded-xl font-medium hover:bg-red-100 transition-colors">
              <Trash2 className="w-4 h-4" />Delete
            </button>
            <button onClick={onEdit} className="flex items-center gap-2 px-5 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
              <Pencil className="w-4 h-4" />Edit
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — document */}
        <div className="lg:col-span-2 space-y-6">

          {/* Document viewer */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />Certificate Document
            </h2>
            {item.document_url ? (
              <div>
                {isImage ? (
                  <div className="rounded-xl overflow-hidden border border-gray-200 mb-4">
                    <img src={item.document_url} alt={item.name} className="w-full max-h-[500px] object-contain bg-gray-50" />
                  </div>
                ) : (
                  <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-xl mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-blue-900">{item.name}</p>
                      <p className="text-sm text-blue-600">PDF Document</p>
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <a href={item.document_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
                    <ExternalLink className="w-4 h-4" />Open document
                  </a>
                  <a href={item.document_url} download
                    className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
                    <Download className="w-4 h-4" />Download
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No document attached</p>
                <p className="text-gray-400 text-sm mt-1">Edit this certificate to upload a PDF or photo</p>
                {userCanCreate && (
                  <button onClick={onEdit} className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors mx-auto">
                    <Upload className="w-4 h-4" />Upload document
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          {item.notes && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-3">Notes</h2>
              <p className="text-gray-700 text-sm leading-relaxed">{item.notes}</p>
            </div>
          )}
        </div>

        {/* Right — details */}
        <div className="space-y-6">
          {/* Status card */}
          <div className={`rounded-2xl border p-6 ${s.bg} ${s.border}`}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Status</h2>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-3 h-3 rounded-full ${s.dot}`} />
              <span className={`font-bold text-lg ${s.color}`}>{s.label}</span>
            </div>
            <div className={`text-2xl font-bold mb-1 ${s.color}`}>
              {status === 'expired' ? `${Math.abs(days)} days ago` : `${days} days left`}
            </div>
            <p className="text-sm text-gray-500">Expires {formatDate(item.expiry_date)}</p>
          </div>

          {/* Certificate details */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Details</h2>
            <div className="space-y-4">
              {vessel && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Vessel</label>
                  <p className="text-gray-900 font-medium mt-1">{vessel.name}</p>
                </div>
              )}
              {item.assigned_to && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Crew member</label>
                  <p className="text-gray-900 font-medium mt-1">{item.assigned_to}</p>
                </div>
              )}
              {item.issuing_authority && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Issuing authority</label>
                  <p className="text-gray-900 font-medium mt-1">{item.issuing_authority}</p>
                </div>
              )}
              {item.issued_date && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Issue date</label>
                  <p className="text-gray-900 font-medium mt-1">{formatDate(item.issued_date)}</p>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry date</label>
                <p className="text-gray-900 font-medium mt-1">{formatDate(item.expiry_date)}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Type</label>
                <p className="text-gray-900 font-medium mt-1 capitalize">{item.type} certificate</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
export const Compliance: React.FC<ComplianceProps> = ({ onNavigate }) => {
  const { currentUser, selectedVesselId } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [crewMembers, setCrewMembers] = useState<CrewOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'vessel' | 'crew'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'expired' | 'critical' | 'expiring' | 'valid'>('all');
  const [filterVessel, setFilterVessel] = useState('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ComplianceItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<ComplianceItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const role = currentUser?.role as UserRole;
  const userCanCreate = canCreate(role);
  const companyId = currentUser?.company_id || '';

  useEffect(() => { loadData(); }, [currentUser, selectedVesselId]);

  useEffect(() => {
    setFilterVessel(selectedVesselId && selectedVesselId !== 'all' ? selectedVesselId : 'all');
  }, [selectedVesselId]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    const cid = currentUser.company_id;
    if (!cid) { setLoading(false); return; }
    const [compliance, vessels, crew] = await Promise.all([
      fetchByCompany('compliance_items', cid, 'expiry_date', true),
      fetchByCompany('vessels', cid, 'name', true),
      fetchByCompany('crew_members', cid, 'full_name', true),
    ]);
    setItems(compliance);
    setVessels(vessels.map((v: any) => ({ id: v.id, name: v.name })));
    setCrewMembers((crew as any[]).filter(c => c.status === 'active').map(c => ({ id: c.id, full_name: c.full_name, position: c.position, vessel_id: c.vessel_id, photo_url: c.photo_url })));
    // Refresh selected item if open
    if (selectedItem) {
      const refreshed = compliance.find((i: ComplianceItem) => i.id === selectedItem.id);
      if (refreshed) setSelectedItem(refreshed);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('compliance_items').delete().eq('id', id);
      showToast('Certificate deleted', 'success');
      setSelectedItem(null);
      loadData();
    } catch { showToast('Error deleting', 'error'); }
    finally { setDeletingId(null); }
  };

  const filtered = items.filter(item => {
    const days = getDaysUntilExpiry(item.expiry_date);
    const status = getStatus(days);
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (filterStatus !== 'all' && status !== filterStatus) return false;
    if (filterVessel !== 'all' && item.vessel_id !== filterVessel) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase()) && !(item.assigned_to || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const vesselFilteredItems = filterVessel !== 'all' ? items.filter(i => i.vessel_id === filterVessel) : items;
  const expired  = vesselFilteredItems.filter(i => getStatus(getDaysUntilExpiry(i.expiry_date)) === 'expired').length;
  const critical = vesselFilteredItems.filter(i => getStatus(getDaysUntilExpiry(i.expiry_date)) === 'critical').length;
  const expiring = vesselFilteredItems.filter(i => getStatus(getDaysUntilExpiry(i.expiry_date)) === 'expiring').length;
  const valid    = vesselFilteredItems.filter(i => getStatus(getDaysUntilExpiry(i.expiry_date)) === 'valid').length;

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────
  if (selectedItem) {
    return (
      <>
        <CertificateDetail
          item={selectedItem}
          vessels={vessels}
          onBack={() => setSelectedItem(null)}
          onEdit={() => { setEditingItem(selectedItem); setShowModal(true); }}
          onDelete={() => setDeletingId(selectedItem.id)}
          userCanCreate={userCanCreate}
        />
        {showModal && (
          <ComplianceModal
            item={editingItem}
            vessels={vessels}
            crewMembers={crewMembers}
            companyId={companyId}
            onClose={() => { setShowModal(false); setEditingItem(null); }}
            onSaved={loadData}
          />
        )}
        {deletingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center"><Trash2 className="w-5 h-5 text-red-600" /></div>
                <h3 className="text-lg font-bold text-gray-900">Delete Certificate</h3>
              </div>
              <p className="text-gray-600 mb-6">Are you sure you want to delete <strong>"{selectedItem.name}"</strong>? This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeletingId(null)} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50">Cancel</button>
                <button onClick={() => handleDelete(deletingId)} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700">Delete</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight">Compliance</h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">Track vessel and crew certificates — never miss an expiry date</p>
        </div>
        {userCanCreate && (
          <button onClick={() => { setEditingItem(null); setShowModal(true); }}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shrink-0 self-start sm:self-auto">
            <Plus className="w-5 h-5" />Add Certificate
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Expired',        count: expired,  icon: AlertTriangle, iconColor: '#ef4444', iconBg: '#fef2f2', accent: expired > 0,  status: 'expired' },
          { label: 'Within 30 days', count: critical, icon: Clock,         iconColor: '#f97316', iconBg: '#fff7ed', accent: critical > 0, status: 'critical' },
          { label: 'Within 90 days', count: expiring, icon: Calendar,      iconColor: '#f59e0b', iconBg: '#fffbeb', accent: false,        status: 'expiring' },
          { label: 'Valid',          count: valid,    icon: CheckCircle,   iconColor: '#16a34a', iconBg: '#f0fdf4', accent: false,        status: 'valid' },
        ].map((kpi, i) => { const Icon = kpi.icon; return (
          <div key={i} onClick={() => setFilterStatus(filterStatus === kpi.status ? 'all' : kpi.status as any)}
            style={{ background: 'white', borderRadius: 16, padding: '18px 20px', border: kpi.accent ? `1.5px solid ${kpi.iconColor}30` : '1px solid #e5e7eb', cursor: 'pointer', transition: 'box-shadow 0.2s, transform 0.2s', position: 'relative', overflow: 'hidden' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.09)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}>
            {kpi.accent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: kpi.iconColor, borderRadius: '16px 16px 0 0' }} />}
            <div style={{ width: 38, height: 38, borderRadius: 10, background: kpi.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Icon size={18} style={{ color: kpi.iconColor }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111827', marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>{loading ? '—' : kpi.count}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>{kpi.label}</div>
          </div>
        ); })}
      </div>

      {/* Filters + List */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex flex-wrap gap-3 mb-6">
          {(['all', 'vessel', 'crew'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-sm transition-all ${filterType === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}>
              {t === 'vessel' ? <Ship className="w-4 h-4" /> : t === 'crew' ? <User className="w-4 h-4" /> : null}
              {t === 'all' ? 'All' : t === 'vessel' ? 'Vessel' : 'Crew'}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${filterType === t ? 'bg-white/20' : 'bg-gray-100'}`}>
                {t === 'all' ? items.length : items.filter(i => i.type === t).length}
              </span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search certificates..."
              className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div className="relative">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
              className="w-full appearance-none px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
              <option value="all">All statuses</option>
              <option value="expired">Expired</option>
              <option value="critical">Expiring within 30 days</option>
              <option value="expiring">Expiring within 90 days</option>
              <option value="valid">Valid</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={filterVessel} onChange={e => setFilterVessel(e.target.value)}
              className="w-full appearance-none px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
              <option value="all">All vessels</option>
              {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4">Showing <span className="font-semibold text-gray-900">{filtered.length}</span> certificates</p>

        {loading ? (
          <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <ShieldCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">No certificates found</p>
            <p className="text-gray-400 text-sm mt-1">Add your first certificate to start tracking compliance</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const days = getDaysUntilExpiry(item.expiry_date);
              const status = getStatus(days);
              const s = STATUS_STYLES[status];
              const vessel = vessels.find(v => v.id === item.vessel_id);
              return (
                <div key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${s.bg} ${s.border}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${s.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 text-sm">{item.name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.badge}`}>{s.label}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${item.type === 'vessel' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {item.type === 'vessel' ? '🚢 Vessel' : '👤 Crew'}
                          </span>
                          {item.document_url && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600 flex items-center gap-1">
                              <FileText className="w-3 h-3" />Doc
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                          {vessel && <span>📍 {vessel.name}</span>}
                          {item.assigned_to && <span>👤 {item.assigned_to}</span>}
                          {item.issuing_authority && <span>🏛 {item.issuing_authority}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <div className={`text-sm font-bold ${s.color}`}>
                          {status === 'expired' ? `${Math.abs(days)}d expired` : `${days}d left`}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">Expires {formatDate(item.expiry_date)}</div>
                      </div>
                      {userCanCreate && (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button onClick={() => { setEditingItem(item); setShowModal(true); }}
                            className="p-2 hover:bg-white rounded-lg transition-colors text-gray-400 hover:text-blue-600">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeletingId(item.id)}
                            className="p-2 hover:bg-white rounded-lg transition-colors text-gray-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {item.notes && <p className="text-xs text-gray-500 mt-2 ml-5">{item.notes}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <ComplianceModal
          item={editingItem}
          vessels={vessels}
          crewMembers={crewMembers}
          companyId={companyId}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
          onSaved={loadData}
        />
      )}

      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center"><Trash2 className="w-5 h-5 text-red-600" /></div>
              <h3 className="text-lg font-bold text-gray-900">Delete Certificate</h3>
            </div>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this certificate? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingId(null)} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleDelete(deletingId)} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
