import React, { useState, useEffect } from 'react';
import { History as HistoryIcon, Search, CheckCircle, Calendar, User, Filter, ChevronDown, FileDown, Image, X, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, fetchByCompany } from '../lib/supabase';
import { formatDate, downloadCSV } from '../utils/helpers';
import { MaintenanceHistory } from '../types';
import { Pagination } from '../components/UI/Pagination';

const PAGE_SIZE = 20;

interface HistoryProps {
  onNavigate: (page: string, params?: any) => void;
  params?: any;
}

interface VesselOption { id: string; name: string; }
interface EquipmentOption { id: string; name: string; }

export const History: React.FC<HistoryProps> = ({ onNavigate, params }) => {
  const { currentUser, selectedVesselId } = useAuth();
  const { t } = useLanguage();
  const companyId: string | undefined = params?.companyId;
  const companyName: string | undefined = params?.companyName;
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVessel, setFilterVessel] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<string>('all');
  const [history, setHistory] = useState<MaintenanceHistory[]>([]);
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [equipmentMap, setEquipmentMap] = useState<Record<string, EquipmentOption>>({});
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadData();
  }, [currentUser, selectedVesselId, companyId]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);

    const effectiveCompanyId = companyId || currentUser.company_id || null;
    if (!effectiveCompanyId) { setLoading(false); return; }

    const [history, vessels, equipment] = await Promise.all([
      fetchByCompany('maintenance_history', effectiveCompanyId, 'completion_date', false),
      fetchByCompany('vessels', effectiveCompanyId, 'name', true),
      fetchByCompany('equipment', effectiveCompanyId, 'name', true),
    ]);

    setHistory(history);
    setVessels(vessels.map((v: any) => ({ id: v.id, name: v.name })));

    const eqMap: Record<string, EquipmentOption> = {};
    equipment.forEach((e: any) => { eqMap[e.id] = e; });
    setEquipmentMap(eqMap);

    setLoading(false);
  };

  const getFilteredHistory = () => {
    let filtered = history;

    if (searchTerm) {
      filtered = filtered.filter(h =>
        h.task_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.completed_by_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterVessel !== 'all') {
      filtered = filtered.filter(h => h.vessel_id === filterVessel);
    }

    if (filterDateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      if (filterDateRange === 'week') filterDate.setDate(now.getDate() - 7);
      else if (filterDateRange === 'month') filterDate.setMonth(now.getMonth() - 1);
      else if (filterDateRange === 'quarter') filterDate.setMonth(now.getMonth() - 3);
      else if (filterDateRange === 'year') filterDate.setFullYear(now.getFullYear() - 1);
      filtered = filtered.filter(h => new Date(h.completion_date) >= filterDate);
    }

    return filtered.sort((a, b) =>
      new Date(b.completion_date).getTime() - new Date(a.completion_date).getTime()
    );
  };

  const filtered = getFilteredHistory();
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset to page 1 when filters change
  const handleFilterChange = (setter: (v: any) => void) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    const rows: string[][] = [
      ['Task', 'Vessel', 'Equipment', 'Due Date', 'Completion Date', 'Completed By', 'Parts Used', 'External Service Cost', 'Issues Detected', 'Comments'],
      ...filtered.map(record => {
        const vessel = vessels.find(v => v.id === record.vessel_id);
        const equipment = record.equipment_id ? equipmentMap[record.equipment_id] : null;
        const partsUsed = Array.isArray(record.parts_used) ? record.parts_used : [];
        const partsStr = partsUsed.length > 0
          ? partsUsed.map((p: any) => `${p.name || p.inventory_id} x${p.quantity}`).join('; ')
          : '';
        return [
          record.task_title,
          vessel?.name || '',
          equipment?.name || '',
          record.due_date ? new Date(record.due_date).toLocaleDateString('en-GB') : '',
          new Date(record.completion_date).toLocaleDateString('en-GB'),
          record.completed_by_name,
          partsStr,
          String(record.external_service_cost || 0),
          record.issues_detected || '',
          record.comments || '',
        ];
      }),
    ];
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCSV(rows, `maintenance-history-${dateStr}.csv`);
  };

  const handleExportPDF = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const vesselLabel = filterVessel !== 'all'
      ? vessels.find(v => v.id === filterVessel)?.name || 'All Vessels'
      : 'All Vessels';

    const dateLabel: Record<string, string> = {
      all: 'All Time', week: 'Last Week', month: 'Last Month', quarter: 'Last Quarter', year: 'Last Year',
    };

    const issueCount = filtered.filter(h => h.issues_detected).length;

    const rows = filtered.map(record => {
      const vessel = vessels.find(v => v.id === record.vessel_id);
      const equipment = record.equipment_id ? equipmentMap[record.equipment_id] : null;
      const partsUsed = Array.isArray(record.parts_used) ? record.parts_used : [];
      const partsStr = partsUsed.length > 0
        ? partsUsed.map((p: any) => `${p.name || p.inventory_id} (x${p.quantity})`).join(', ')
        : '—';
      const hasIssue = !!record.issues_detected;

      return `
        <tr class="${hasIssue ? 'has-issue' : ''}">
          <td>
            <strong>${record.task_title}</strong>
            ${equipment ? `<br/><small>Equip: ${equipment.name}</small>` : ''}
            ${vessel ? `<br/><small>Vessel: ${vessel.name}</small>` : ''}
          </td>
          <td>${record.due_date ? new Date(record.due_date).toLocaleDateString('en-GB') : '—'}</td>
          <td>${new Date(record.completion_date).toLocaleDateString('en-GB')}</td>
          <td>${record.completed_by_name}</td>
          <td>${partsStr}</td>
          <td class="${hasIssue ? 'issue-yes' : 'issue-no'}">${hasIssue ? record.issues_detected! : 'None'}</td>
          <td class="comments-cell">${record.comments || '—'}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Maintenance History Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #fff; font-size: 12px; }
    .header { background: #1e3a5f; color: #fff; padding: 28px 32px 24px; }
    .header h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; margin-bottom: 4px; }
    .header p { font-size: 12px; opacity: 0.75; }
    .meta { display: flex; gap: 32px; padding: 14px 32px; background: #f4f7fa; border-bottom: 1px solid #dde3eb; flex-wrap: wrap; }
    .meta-item { display: flex; flex-direction: column; gap: 2px; }
    .meta-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; }
    .meta-value { font-size: 13px; font-weight: 600; color: #1a1a1a; }
    .summary { display: flex; gap: 16px; padding: 16px 32px; }
    .summary-card { flex: 1; padding: 12px 16px; border-radius: 8px; border: 1px solid #e5e7eb; }
    .summary-card.total { border-color: #bfdbfe; background: #eff6ff; }
    .summary-card.issue { border-color: #fde68a; background: #fffbeb; }
    .summary-card.ok { border-color: #bbf7d0; background: #f0fdf4; }
    .summary-card .num { font-size: 26px; font-weight: 700; }
    .summary-card.total .num { color: #1d4ed8; }
    .summary-card.issue .num { color: #d97706; }
    .summary-card.ok .num { color: #15803d; }
    .summary-card .lbl { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .table-wrap { padding: 8px 32px 32px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; table-layout: fixed; }
    col.c1 { width: 22%; }
    col.c2 { width: 9%; }
    col.c3 { width: 9%; }
    col.c4 { width: 13%; }
    col.c5 { width: 15%; }
    col.c6 { width: 16%; }
    col.c7 { width: 16%; }
    th { background: #f8fafc; text-align: left; padding: 10px 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #4b5563; border-bottom: 2px solid #e5e7eb; }
    td { padding: 9px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; word-wrap: break-word; }
    td small { color: #6b7280; font-size: 10px; }
    tr.has-issue { background: #fffbeb; }
    .issue-yes { color: #b45309; font-weight: 500; }
    .issue-no { color: #15803d; }
    .comments-cell { color: #6b7280; font-style: italic; }
    .footer { margin-top: 24px; padding: 12px 32px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Maintenance History Report</h1>
    <p>Generated on ${dateStr} at ${timeStr}</p>
  </div>
  <div class="meta">
    <div class="meta-item"><span class="meta-label">Vessel</span><span class="meta-value">${vesselLabel}</span></div>
    <div class="meta-item"><span class="meta-label">Period</span><span class="meta-value">${dateLabel[filterDateRange]}</span></div>
    ${searchTerm ? `<div class="meta-item"><span class="meta-label">Search</span><span class="meta-value">"${searchTerm}"</span></div>` : ''}
  </div>
  <div class="summary">
    <div class="summary-card total"><div class="num">${filtered.length}</div><div class="lbl">Total Records</div></div>
    <div class="summary-card ok"><div class="num">${filtered.length - issueCount}</div><div class="lbl">No Issues</div></div>
    <div class="summary-card issue"><div class="num">${issueCount}</div><div class="lbl">Issues Detected</div></div>
  </div>
  <div class="table-wrap">
    <table>
      <colgroup>
        <col class="c1"/><col class="c2"/><col class="c3"/><col class="c4"/>
        <col class="c5"/><col class="c6"/><col class="c7"/>
      </colgroup>
      <thead>
        <tr>
          <th>Task</th>
          <th>Due Date</th>
          <th>Completed</th>
          <th>Completed By</th>
          <th>Parts Used</th>
          <th>Issues Detected</th>
          <th>Comments</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div class="footer">YachtMaint &mdash; Maintenance History Report &mdash; ${dateStr}</div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maintenance-history-${now.toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openLightbox = (photos: string[], index: number) => setLightbox({ photos, index });
  const closeLightbox = () => setLightbox(null);
  const lightboxPrev = () => setLightbox(lb => lb ? { ...lb, index: (lb.index - 1 + lb.photos.length) % lb.photos.length } : null);
  const lightboxNext = () => setLightbox(lb => lb ? { ...lb, index: (lb.index + 1) % lb.photos.length } : null);

  return (
    <div className="space-y-8">
    {companyId && (
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate('customers')}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Building2 className="w-4 h-4" />
          Back to Customers
        </button>
        <span className="text-gray-400">/</span>
        <span className="text-sm font-medium text-gray-900">{companyName || 'Customer'} — History</span>
      </div>
    )}
    {lightbox && (
      <div
        className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
        onClick={closeLightbox}
      >
        <button
          onClick={closeLightbox}
          className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>
        {lightbox.photos.length > 1 && (
          <>
            <button
              onClick={e => { e.stopPropagation(); lightboxPrev(); }}
              className="absolute left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); lightboxNext(); }}
              className="absolute right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </>
        )}
        <img
          src={lightbox.photos[lightbox.index]}
          alt={`Photo ${lightbox.index + 1}`}
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl"
          onClick={e => e.stopPropagation()}
        />
        {lightbox.photos.length > 1 && (
          <div className="absolute bottom-4 flex gap-2">
            {lightbox.photos.map((_, i) => (
              <button
                key={i}
                onClick={e => { e.stopPropagation(); setLightbox(lb => lb ? { ...lb, index: i } : null); }}
                className={`w-2 h-2 rounded-full transition-colors ${i === lightbox.index ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
        )}
      </div>
    )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            {companyId && companyName ? `${companyName} — ${t('history.title')}` : t('history.title')}
          </h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">{t('history.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <button
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            <FileDown className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            <FileDown className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-7">
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-bold text-gray-900">{t('common.filters')}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-7">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('history.search')}
              className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="relative">
            <select
              value={filterVessel}
              onChange={(e) => setFilterVessel(e.target.value)}
              className="w-full appearance-none px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
            >
              <option value="all">{t('common.allVessels')}</option>
              {vessels.map(vessel => (
                <option key={vessel.id} value={vessel.id}>{vessel.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.target.value)}
              className="w-full appearance-none px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
            >
              <option value="all">{t('history.allTime')}</option>
              <option value="week">{t('history.lastWeek')}</option>
              <option value="month">{t('history.lastMonth')}</option>
              <option value="quarter">{t('history.lastQuarter')}</option>
              <option value="year">{t('history.lastYear')}</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">
            {t('history.showing')} <span className="font-semibold text-gray-900">{filtered.length}</span> {filtered.length === 1 ? t('history.record') : t('history.records')}
          </p>
        </div>


        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-50 rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <HistoryIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">{t('history.notFound')}</p>
              </div>
            ) : (
              paginated.map(record => {
                const vessel = vessels.find(v => v.id === record.vessel_id);
                const equipment = record.equipment_id ? equipmentMap[record.equipment_id] : null;
                const partsUsed = Array.isArray(record.parts_used) ? record.parts_used : [];
                const hasIssue = !!record.issues_detected;

                return (
                  <div
                    key={record.id}
                    className={`p-6 rounded-2xl hover:shadow-[0_8px_24px_rgba(0,0,0,0.09)] hover:-translate-y-0.5 transition-all ${
                      hasIssue
                        ? 'bg-amber-50 border border-amber-200'
                        : 'bg-green-50 border border-green-200'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl flex-shrink-0 ${hasIssue ? 'bg-amber-100' : 'bg-green-100'}`}>
                        <CheckCircle className={`w-6 h-6 ${hasIssue ? 'text-amber-600' : 'text-green-600'}`} />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">{record.task_title}</h3>
                            {equipment && (
                              <p className="text-sm text-gray-500 mt-0.5">{t('history.equipmentLabel')} {equipment.name}</p>
                            )}
                            {vessel && (
                              <p className="text-sm text-gray-500">{t('history.vesselLabel')} {vessel.name}</p>
                            )}
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold leading-5 flex-shrink-0 ${
                            hasIssue ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {hasIssue ? 'Issues Found' : t('history.completed')}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                          {record.due_date && (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span>{t('history.dueDate')}: <span className="font-medium text-gray-700">{formatDate(record.due_date)}</span></span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <CheckCircle className="w-4 h-4 text-gray-400" />
                            <span>{t('history.completed')}: <span className="font-medium text-gray-700">{formatDate(record.completion_date)}</span></span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-700">{record.completed_by_name}</span>
                          </div>
                        </div>

                        {record.comments && (
                          <div className="bg-white/70 rounded-xl p-4 mb-3 border border-white">
                            <p className="text-sm font-semibold text-gray-700 mb-1">{t('history.comments')}</p>
                            <p className="text-sm text-gray-600">{record.comments}</p>
                          </div>
                        )}

                        {partsUsed.length > 0 && (
                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <p className="text-sm font-semibold text-blue-900 mb-2">{t('history.partsUsed')}</p>
                            <div className="space-y-1">
                              {partsUsed.map((part: any, index: number) => (
                                <p key={index} className="text-sm text-blue-800">
                                  {part.name ? `• ${part.name} - Quantity: ${part.quantity}` : `• Part ID: ${part.inventory_id} - Qty: ${part.quantity}`}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {record.issues_detected && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-3">
                            <p className="text-sm font-semibold text-amber-900 mb-1">{t('history.issuesDetected')}</p>
                            <p className="text-sm text-amber-800">{record.issues_detected}</p>
                          </div>
                        )}

                        {Array.isArray(record.photos) && record.photos.length > 0 && (
                          <div className="mt-4">
                            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                              <Image className="w-4 h-4 text-gray-500" />
                              {t('common.photos')} ({record.photos.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {record.photos.map((url, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => openLightbox(record.photos!, idx)}
                                  className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all group"
                                >
                                  <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
};
