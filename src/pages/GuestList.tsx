import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, ChevronDown, ChevronUp, Ship, Calendar, MapPin,
  Users, Edit2, Trash2, X, Printer, UserPlus, Anchor, Clock,
  FileText, Eye, AlertCircle, Download,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { fetchByCompany, dbInsert, dbUpdate, dbDelete } from '../lib/supabase';
import { useToast } from '../components/UI/Toast';
import { Voyage, VoyageGuest, UserRole } from '../types';
import { ConfirmModal } from '../components/UI/ConfirmModal';

interface GuestListProps {
  onNavigate: (page: string, params?: any) => void;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  planned:   { label: 'Planned',   dot: 'bg-blue-500',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  active:    { label: 'Active',    dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  completed: { label: 'Completed', dot: 'bg-gray-400',    bg: 'bg-gray-100',   text: 'text-gray-600' },
};

const NATIONALITIES = [
  'American', 'Argentine', 'Australian', 'Bahamian', 'Brazilian', 'British', 'Canadian',
  'Chinese', 'Colombian', 'Croatian', 'Dutch', 'Filipino', 'French', 'German', 'Greek',
  'Indian', 'Indonesian', 'Italian', 'Jamaican', 'Japanese', 'Mexican', 'Monegasque',
  'New Zealander', 'Norwegian', 'Panamanian', 'Polish', 'Portuguese', 'Russian',
  'South African', 'Spanish', 'Swedish', 'Swiss', 'Turkish', 'Ukrainian', 'Venezuelan',
];

const canManageGuests = (role: UserRole) =>
  ['master_admin', 'customer_admin', 'fleet_manager', 'captain', 'chief_stew', 'deck_officer'].includes(role);

const fmtDate = (d?: string) => {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const GuestList: React.FC<GuestListProps> = ({ onNavigate }) => {
  const { currentUser, selectedVesselId } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const role = currentUser?.role as UserRole;
  const companyId = currentUser?.company_id || '';
  const canEdit = canManageGuests(role);

  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [guests, setGuests] = useState<VoyageGuest[]>([]);
  const [vessels, setVessels] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [showVoyageModal, setShowVoyageModal] = useState(false);
  const [editingVoyage, setEditingVoyage] = useState<Voyage | null>(null);
  const [expandedVoyageId, setExpandedVoyageId] = useState<string | null>(null);

  const [showGuestModal, setShowGuestModal] = useState(false);
  const [editingGuest, setEditingGuest] = useState<VoyageGuest | null>(null);
  const [guestVoyageId, setGuestVoyageId] = useState<string | null>(null);

  const [confirmDeleteVoyage, setConfirmDeleteVoyage] = useState<string | null>(null);
  const [confirmDeleteGuest, setConfirmDeleteGuest] = useState<string | null>(null);

  const [printingVoyageId, setPrintingVoyageId] = useState<string | null>(null);

  useEffect(() => { if (currentUser) loadData(); }, [currentUser, selectedVesselId, companyId]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    const cid = companyId || currentUser.company_id;
    if (!cid) { setLoading(false); return; }
    const [vesselsData, voyagesData, guestsData] = await Promise.all([
      fetchByCompany('vessels', cid, 'name', true),
      fetchByCompany('voyages', cid, 'departure_date', false),
      fetchByCompany('voyage_guests', cid, 'full_name', true),
    ]);
    setVessels(vesselsData.map((v: any) => ({ id: v.id, name: v.name })));
    const filtered = selectedVesselId && selectedVesselId !== 'all'
      ? voyagesData.filter((v: any) => v.vessel_id === selectedVesselId)
      : voyagesData;
    setVoyages(filtered);
    setGuests(guestsData);
    setLoading(false);
  };

  const vesselName = (id: string) => vessels.find(v => v.id === id)?.name || '—';

  const filteredVoyages = useMemo(() => {
    let result = voyages;
    if (statusFilter !== 'all') result = result.filter(v => v.status === statusFilter);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(v =>
        v.name.toLowerCase().includes(s) ||
        v.departure_port.toLowerCase().includes(s) ||
        v.arrival_port.toLowerCase().includes(s) ||
        vesselName(v.vessel_id).toLowerCase().includes(s)
      );
    }
    return result;
  }, [voyages, statusFilter, search, vessels]);

  const guestsForVoyage = (voyageId: string) => guests.filter(g => g.voyage_id === voyageId);

  const handleDeleteVoyage = async (id: string) => {
    try {
      await dbDelete('voyages', id);
      setVoyages(prev => prev.filter(v => v.id !== id));
      setGuests(prev => prev.filter(g => g.voyage_id !== id));
      showToast('Voyage deleted', 'success');
    } catch { showToast('Error deleting voyage', 'error'); }
    finally { setConfirmDeleteVoyage(null); }
  };

  const handleDeleteGuest = async (id: string) => {
    try {
      await dbDelete('voyage_guests', id);
      setGuests(prev => prev.filter(g => g.id !== id));
      showToast('Guest removed', 'success');
    } catch { showToast('Error removing guest', 'error'); }
    finally { setConfirmDeleteGuest(null); }
  };

  const handlePrintGuestList = (voyageId: string) => {
    setPrintingVoyageId(voyageId);
    setTimeout(() => {
      window.print();
      setPrintingVoyageId(null);
    }, 300);
  };

  const handleExportGuestListPDF = (voyageId: string) => {
    const voyage = voyages.find(v => v.id === voyageId);
    if (!voyage) return;
    const vGuests = guestsForVoyage(voyageId);
    const vName = vesselName(voyage.vessel_id);

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Guest List - ${voyage.name} - ${vName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; padding: 40px; }
  .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; }
  .header h1 { font-size: 18px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
  .header p { font-size: 11px; color: #555; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 20px; border: 1px solid #333; }
  .info-row { display: flex; border-bottom: 1px solid #ccc; }
  .info-row:last-child { border-bottom: none; }
  .info-label { font-weight: 700; padding: 6px 10px; width: 140px; background: #f5f5f5; border-right: 1px solid #ccc; }
  .info-value { padding: 6px 10px; flex: 1; }
  .info-grid > div:nth-child(odd) { border-right: 1px solid #333; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #2c3e50; color: white; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
  tr:nth-child(even) { background: #f9f9f9; }
  .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 10px; color: #777; border-top: 1px solid #ccc; padding-top: 12px; }
  .signature-area { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .signature-box { border-top: 1px solid #333; padding-top: 8px; font-size: 10px; color: #555; }
  @media print { body { padding: 20px; } }
  @page { size: A4 landscape; margin: 15mm; }
</style></head><body>
<div class="header">
  <h1>Passenger List</h1>
  <p>IMO FAL Form 6 &mdash; ${vName}</p>
</div>
<div class="info-grid">
  <div>
    <div class="info-row"><span class="info-label">Vessel Name</span><span class="info-value">${vName}</span></div>
    <div class="info-row"><span class="info-label">Voyage</span><span class="info-value">${voyage.name}</span></div>
    <div class="info-row"><span class="info-label">Departure Date</span><span class="info-value">${fmtDate(voyage.departure_date)}</span></div>
  </div>
  <div>
    <div class="info-row"><span class="info-label">Departure Port</span><span class="info-value">${voyage.departure_port || '—'}</span></div>
    <div class="info-row"><span class="info-label">Arrival Port</span><span class="info-value">${voyage.arrival_port || '—'}</span></div>
    <div class="info-row"><span class="info-label">Arrival Date</span><span class="info-value">${fmtDate(voyage.arrival_date)}</span></div>
  </div>
</div>
<table>
  <thead><tr>
    <th>#</th><th>Full Name</th><th>Nationality</th><th>Date of Birth</th>
    <th>Document Type</th><th>Document No.</th><th>Expiry</th>
    <th>Port Embark</th><th>Port Disembark</th><th>Type</th>
  </tr></thead>
  <tbody>${vGuests.length === 0
    ? '<tr><td colspan="10" style="text-align:center;color:#999;padding:20px;">No passengers registered</td></tr>'
    : vGuests.map((g, i) => `<tr>
      <td>${i + 1}</td>
      <td style="font-weight:600">${g.full_name}</td>
      <td>${g.nationality || '—'}</td>
      <td>${fmtDate(g.date_of_birth)}</td>
      <td style="text-transform:capitalize">${g.document_type.replace('_', ' ')}</td>
      <td>${g.document_number || '—'}</td>
      <td>${fmtDate(g.document_expiry)}</td>
      <td>${g.port_of_embarkation || '—'}</td>
      <td>${g.port_of_disembarkation || '—'}</td>
      <td style="text-transform:uppercase">${g.guest_type}</td>
    </tr>`).join('')}
  </tbody>
</table>
<div class="signature-area">
  <div class="signature-box">Captain's Signature</div>
  <div class="signature-box">Date &amp; Stamp</div>
</div>
<div class="footer">
  <span>Total passengers: ${vGuests.length}</span>
  <span>Generated by Nautium &mdash; ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
</div>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) {
      w.onload = () => {
        URL.revokeObjectURL(url);
        setTimeout(() => w.print(), 500);
      };
    }
  };

  const printVoyage = printingVoyageId ? voyages.find(v => v.id === printingVoyageId) : null;
  const printGuests = printingVoyageId ? guestsForVoyage(printingVoyageId) : [];
  const printVesselName = printVoyage ? vesselName(printVoyage.vessel_id) : '';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* ── Print view ── */}
      {printVoyage && (
        <div className="hidden print:block print-guest-list p-8">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold uppercase">Passenger List</h1>
            <p className="text-sm text-gray-600">IMO FAL Form 6</p>
          </div>
          <table className="w-full text-sm mb-4 border-collapse">
            <tbody>
              <tr>
                <td className="border px-2 py-1 font-semibold w-1/4">Vessel Name</td>
                <td className="border px-2 py-1 w-1/4">{printVesselName}</td>
                <td className="border px-2 py-1 font-semibold w-1/4">Departure Port</td>
                <td className="border px-2 py-1 w-1/4">{printVoyage.departure_port}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 font-semibold">Voyage</td>
                <td className="border px-2 py-1">{printVoyage.name}</td>
                <td className="border px-2 py-1 font-semibold">Arrival Port</td>
                <td className="border px-2 py-1">{printVoyage.arrival_port}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 font-semibold">Departure Date</td>
                <td className="border px-2 py-1">{fmtDate(printVoyage.departure_date)}</td>
                <td className="border px-2 py-1 font-semibold">Arrival Date</td>
                <td className="border px-2 py-1">{fmtDate(printVoyage.arrival_date)}</td>
              </tr>
            </tbody>
          </table>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1 text-left">#</th>
                <th className="border px-2 py-1 text-left">Full Name</th>
                <th className="border px-2 py-1 text-left">Nationality</th>
                <th className="border px-2 py-1 text-left">Date of Birth</th>
                <th className="border px-2 py-1 text-left">Document Type</th>
                <th className="border px-2 py-1 text-left">Document No.</th>
                <th className="border px-2 py-1 text-left">Port Embark</th>
                <th className="border px-2 py-1 text-left">Port Disembark</th>
              </tr>
            </thead>
            <tbody>
              {printGuests.map((g, i) => (
                <tr key={g.id}>
                  <td className="border px-2 py-1">{i + 1}</td>
                  <td className="border px-2 py-1">{g.full_name}</td>
                  <td className="border px-2 py-1">{g.nationality}</td>
                  <td className="border px-2 py-1">{fmtDate(g.date_of_birth)}</td>
                  <td className="border px-2 py-1 capitalize">{g.document_type.replace('_', ' ')}</td>
                  <td className="border px-2 py-1">{g.document_number}</td>
                  <td className="border px-2 py-1">{g.port_of_embarkation}</td>
                  <td className="border px-2 py-1">{g.port_of_disembarkation}</td>
                </tr>
              ))}
              {printGuests.length === 0 && (
                <tr><td colSpan={8} className="border px-2 py-4 text-center text-gray-400">No passengers</td></tr>
              )}
            </tbody>
          </table>
          <div className="mt-6 text-xs text-gray-500 flex justify-between">
            <span>Total passengers: {printGuests.length}</span>
            <span>Generated: {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      )}

      {/* ── Screen view ── */}
      <div className="space-y-6 print:hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Guest List</h1>
            <p className="text-gray-500 text-sm mt-1">Manage voyage passengers and generate port authority documents</p>
          </div>
          {canEdit && (
            <button
              onClick={() => { setEditingVoyage(null); setShowVoyageModal(true); }}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />New Voyage
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search voyages..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Voyages list */}
        {filteredVoyages.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Ship className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No voyages found</p>
            <p className="text-sm text-gray-400 mt-1">Create a new voyage to start managing your guest list</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredVoyages.map(voyage => {
              const vGuests = guestsForVoyage(voyage.id);
              const isExpanded = expandedVoyageId === voyage.id;
              const sc = STATUS_CONFIG[voyage.status] || STATUS_CONFIG.planned;
              return (
                <div key={voyage.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Voyage header */}
                  <div
                    className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedVoyageId(isExpanded ? null : voyage.id)}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Ship className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 truncate">{voyage.name || 'Untitled Voyage'}</h3>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1"><Anchor className="w-3 h-3" />{vesselName(voyage.vessel_id)}</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{voyage.departure_port || '—'} → {voyage.arrival_port || '—'}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(voyage.departure_date)} — {fmtDate(voyage.arrival_date)}</span>
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{vGuests.length} guest{vGuests.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <>
                          <button
                            onClick={e => { e.stopPropagation(); handleExportGuestListPDF(voyage.id); }}
                            className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Export Guest List as PDF (FAL Form 6)"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handlePrintGuestList(voyage.id); }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Print Guest List (FAL Form 6)"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setEditingVoyage(voyage); setShowVoyageModal(true); }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDeleteVoyage(voyage.id); }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>

                  {/* Expanded guest list */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/50">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                          <Users className="w-4 h-4" />Passengers ({vGuests.length})
                        </h4>
                        {canEdit && (
                          <button
                            onClick={() => { setGuestVoyageId(voyage.id); setEditingGuest(null); setShowGuestModal(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <UserPlus className="w-3.5 h-3.5" />Add Guest
                          </button>
                        )}
                      </div>
                      {vGuests.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">No guests added yet</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-gray-500 uppercase tracking-wider">
                                <th className="text-left pb-2 pr-3">Name</th>
                                <th className="text-left pb-2 pr-3">Nationality</th>
                                <th className="text-left pb-2 pr-3">DOB</th>
                                <th className="text-left pb-2 pr-3">Document</th>
                                <th className="text-left pb-2 pr-3">Embark</th>
                                <th className="text-left pb-2 pr-3">Disembark</th>
                                <th className="text-left pb-2 pr-3">Type</th>
                                {canEdit && <th className="text-right pb-2">Actions</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {vGuests.map(g => (
                                <tr key={g.id} className="hover:bg-white transition-colors">
                                  <td className="py-2 pr-3 font-medium text-gray-900">{g.full_name}</td>
                                  <td className="py-2 pr-3 text-gray-600">{g.nationality || '—'}</td>
                                  <td className="py-2 pr-3 text-gray-600">{fmtDate(g.date_of_birth)}</td>
                                  <td className="py-2 pr-3 text-gray-600">
                                    <span className="capitalize">{g.document_type.replace('_', ' ')}</span>
                                    {g.document_number && <span className="text-gray-400 ml-1">#{g.document_number}</span>}
                                  </td>
                                  <td className="py-2 pr-3 text-gray-600">{g.port_of_embarkation || '—'}</td>
                                  <td className="py-2 pr-3 text-gray-600">{g.port_of_disembarkation || '—'}</td>
                                  <td className="py-2 pr-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                      g.guest_type === 'owner' ? 'bg-purple-50 text-purple-700' :
                                      g.guest_type === 'vip' ? 'bg-amber-50 text-amber-700' :
                                      'bg-gray-100 text-gray-600'
                                    }`}>{g.guest_type.toUpperCase()}</span>
                                  </td>
                                  {canEdit && (
                                    <td className="py-2 text-right">
                                      <button
                                        onClick={() => { setGuestVoyageId(voyage.id); setEditingGuest(g); setShowGuestModal(true); }}
                                        className="p-1 text-gray-400 hover:text-blue-600 rounded"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => setConfirmDeleteGuest(g.id)}
                                        className="p-1 text-gray-400 hover:text-red-600 rounded ml-1"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Voyage Modal ── */}
      {showVoyageModal && (
        <VoyageModal
          item={editingVoyage}
          vessels={vessels}
          selectedVesselId={selectedVesselId}
          companyId={companyId}
          onClose={() => { setShowVoyageModal(false); setEditingVoyage(null); }}
          onSaved={() => { setShowVoyageModal(false); setEditingVoyage(null); loadData(); showToast(editingVoyage ? 'Voyage updated' : 'Voyage created', 'success'); }}
        />
      )}

      {/* ── Guest Modal ── */}
      {showGuestModal && guestVoyageId && (
        <GuestModal
          item={editingGuest}
          voyageId={guestVoyageId}
          voyage={voyages.find(v => v.id === guestVoyageId)!}
          companyId={companyId}
          onClose={() => { setShowGuestModal(false); setEditingGuest(null); setGuestVoyageId(null); }}
          onSaved={() => { setShowGuestModal(false); setEditingGuest(null); setGuestVoyageId(null); loadData(); showToast(editingGuest ? 'Guest updated' : 'Guest added', 'success'); }}
        />
      )}

      {/* Delete confirms */}
      {confirmDeleteVoyage && (
        <ConfirmModal
          title="Delete Voyage"
          message="This will permanently delete this voyage and all its guests. Are you sure?"
          confirmLabel="Delete"
          onConfirm={() => handleDeleteVoyage(confirmDeleteVoyage)}
          onCancel={() => setConfirmDeleteVoyage(null)}
        />
      )}
      {confirmDeleteGuest && (
        <ConfirmModal
          title="Remove Guest"
          message="Remove this guest from the voyage?"
          confirmLabel="Remove"
          onConfirm={() => handleDeleteGuest(confirmDeleteGuest)}
          onCancel={() => setConfirmDeleteGuest(null)}
        />
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-guest-list, .print-guest-list * { visibility: visible; }
          .print-guest-list { position: absolute; top: 0; left: 0; width: 100%; }
        }
      `}</style>
    </>
  );
};

/* ── Voyage Modal ──────────────────────────────────────────────────────────── */
const VoyageModal: React.FC<{
  item: Voyage | null;
  vessels: { id: string; name: string }[];
  selectedVesselId: string | null;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ item, vessels, selectedVesselId, companyId, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name:           item?.name || '',
    vessel_id:      item?.vessel_id || (selectedVesselId && selectedVesselId !== 'all' ? selectedVesselId : (vessels.length === 1 ? vessels[0].id : '')),
    departure_port: item?.departure_port || '',
    arrival_port:   item?.arrival_port || '',
    departure_date: item?.departure_date || '',
    arrival_date:   item?.arrival_date || '',
    status:         item?.status || 'planned',
    notes:          item?.notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.vessel_id) return;
    setSaving(true);
    try {
      const payload = {
        vessel_id:      form.vessel_id,
        company_id:     companyId,
        name:           form.name,
        departure_port: form.departure_port,
        arrival_port:   form.arrival_port,
        departure_date: form.departure_date || null,
        arrival_date:   form.arrival_date || null,
        status:         form.status,
        notes:          form.notes,
      };
      if (item) {
        await dbUpdate('voyages', item.id, payload);
      } else {
        await dbInsert('voyages', payload);
      }
      onSaved();
    } catch { showToast('Error saving voyage', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-16 px-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{item ? 'Edit Voyage' : 'New Voyage'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Voyage Name *</label>
            <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Monaco to Sardinia"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vessel *</label>
            <select required value={form.vessel_id} onChange={e => setForm({ ...form, vessel_id: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="">Select vessel</option>
              {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Departure Port</label>
              <input type="text" value={form.departure_port} onChange={e => setForm({ ...form, departure_port: e.target.value })}
                placeholder="e.g., Port Hercules, Monaco"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Port</label>
              <input type="text" value={form.arrival_port} onChange={e => setForm({ ...form, arrival_port: e.target.value })}
                placeholder="e.g., Marina di Olbia"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Departure Date</label>
              <input type="date" value={form.departure_date} onChange={e => setForm({ ...form, departure_date: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Date</label>
              <input type="date" value={form.arrival_date} onChange={e => setForm({ ...form, arrival_date: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
              placeholder="Additional information..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : item ? 'Update Voyage' : 'Create Voyage'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ── Guest Modal ───────────────────────────────────────────────────────────── */
const GuestModal: React.FC<{
  item: VoyageGuest | null;
  voyageId: string;
  voyage: Voyage;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ item, voyageId, voyage, companyId, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name:             item?.full_name || '',
    nationality:           item?.nationality || '',
    date_of_birth:         item?.date_of_birth || '',
    document_type:         item?.document_type || 'passport',
    document_number:       item?.document_number || '',
    document_expiry:       item?.document_expiry || '',
    port_of_embarkation:   item?.port_of_embarkation || voyage.departure_port || '',
    port_of_disembarkation:item?.port_of_disembarkation || voyage.arrival_port || '',
    embark_date:           item?.embark_date || voyage.departure_date || '',
    disembark_date:        item?.disembark_date || voyage.arrival_date || '',
    guest_type:            item?.guest_type || 'guest',
    phone:                 item?.phone || '',
    email:                 item?.email || '',
    notes:                 item?.notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name) return;
    setSaving(true);
    try {
      const payload = {
        voyage_id:              voyageId,
        vessel_id:              voyage.vessel_id,
        company_id:             companyId,
        full_name:              form.full_name,
        nationality:            form.nationality,
        date_of_birth:          form.date_of_birth || null,
        document_type:          form.document_type,
        document_number:        form.document_number,
        document_expiry:        form.document_expiry || null,
        port_of_embarkation:    form.port_of_embarkation,
        port_of_disembarkation: form.port_of_disembarkation,
        embark_date:            form.embark_date || null,
        disembark_date:         form.disembark_date || null,
        guest_type:             form.guest_type,
        phone:                  form.phone,
        email:                  form.email,
        notes:                  form.notes,
      };
      if (item) {
        await dbUpdate('voyage_guests', item.id, payload);
      } else {
        await dbInsert('voyage_guests', payload);
      }
      onSaved();
    } catch { showToast('Error saving guest', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-16 px-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{item ? 'Edit Guest' : 'Add Guest'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input type="text" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
              placeholder="As shown on travel document"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
              <input type="text" value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })}
                list="nationalities-list" placeholder="e.g., American"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              <datalist id="nationalities-list">
                {NATIONALITIES.map(n => <option key={n} value={n} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
              <select value={form.document_type} onChange={e => setForm({ ...form, document_type: e.target.value as any })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="passport">Passport</option>
                <option value="id_card">ID Card</option>
                <option value="seamans_book">Seaman's Book</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Document Number</label>
              <input type="text" value={form.document_number} onChange={e => setForm({ ...form, document_number: e.target.value })}
                placeholder="e.g., AB1234567"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document Expiry</label>
            <input type="date" value={form.document_expiry} onChange={e => setForm({ ...form, document_expiry: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Port of Embarkation</label>
              <input type="text" value={form.port_of_embarkation} onChange={e => setForm({ ...form, port_of_embarkation: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Port of Disembarkation</label>
              <input type="text" value={form.port_of_disembarkation} onChange={e => setForm({ ...form, port_of_disembarkation: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Embark Date</label>
              <input type="date" value={form.embark_date} onChange={e => setForm({ ...form, embark_date: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Disembark Date</label>
              <input type="date" value={form.disembark_date} onChange={e => setForm({ ...form, disembark_date: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Guest Type</label>
            <select value={form.guest_type} onChange={e => setForm({ ...form, guest_type: e.target.value as any })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="guest">Guest</option>
              <option value="owner">Owner</option>
              <option value="vip">VIP</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 234 567 8900"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="guest@email.com"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
              placeholder="Dietary requirements, allergies, preferences..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : item ? 'Update Guest' : 'Add Guest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
