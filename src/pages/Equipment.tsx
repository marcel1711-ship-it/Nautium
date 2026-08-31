import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Filter, ChevronDown, ChevronUp,
  Wrench, Settings, Anchor, Zap, Droplets, Wind,
  Shield, Boxes, MoreHorizontal, Edit2, Trash2,
  X, AlertCircle, FileText, CheckCircle,
  Download, Upload, FileDown, Camera, ImageIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, fetchByCompany, dbInsert, dbUpdate, dbDelete } from '../lib/supabase';
import { demoEquipment, demoVessels } from '../data/demoData';
import { Equipment as EquipmentType, UserRole, getRoleDepartment, canCreate } from '../types';
import { ConfirmModal } from '../components/UI/ConfirmModal';
import { useToast } from '../components/UI/Toast';
import { downloadCSV } from '../utils/helpers';

const isDemoUser = (email: string) => email === 'admin@yachtmaintenance.pro';

interface EquipmentProps {
  onNavigate: (page: string, params?: any) => void;
  params?: any;
  departmentFilter?: string;
}
interface VesselOption { id: string; name: string; }

const EQUIPMENT_TYPES = [
  'Main Engine', 'Generator', 'Watermaker', 'Air Conditioning', 'Navigation System',
  'Communication System', 'Hydraulic System', 'Electrical Panel', 'Fuel System',
  'Bilge Pump', 'Anchor Windlass', 'Stabilizer', 'Bow Thruster', 'Stern Thruster',
  'Refrigeration', 'Water Heater', 'Exhaust System', 'Fire Suppression',
  'Life Raft', 'Safety Equipment', 'Winch', 'Furling System', 'Sail Drive',
  'Autopilot', 'Radar', 'Chartplotter', 'AIS', 'VHF Radio', 'Satellite Phone',
  'Entertainment System', 'Lighting System', 'Other',
];

const DEPT_ICONS: Record<string, React.ElementType> = {
  Engineering: Settings,
  Deck:        Anchor,
  Interior:    Boxes,
  Galley:      Droplets,
  Safety:      Shield,
  Navigation:  Zap,
  General:     Wrench,
};

const DEPT_COLORS: Record<string, string> = {
  Engineering: 'bg-orange-100 text-orange-700',
  Deck:        'bg-blue-100 text-blue-700',
  Interior:    'bg-purple-100 text-purple-700',
  Galley:      'bg-green-100 text-green-700',
  Safety:      'bg-red-100 text-red-700',
  Navigation:  'bg-indigo-100 text-indigo-700',
  General:     'bg-gray-100 text-gray-700',
};

// ── CSV Template ──────────────────────────────────────────────────────────
const CSV_HEADERS = [
  'name', 'type', 'manufacturer', 'model',
  'serial_number', 'installation_date',
  'location_on_vessel', 'department', 'notes',
];

const CSV_EXAMPLE_ROWS = [
  ['Main Engine Port', 'Main Engine', 'Caterpillar', 'C32 ACERT', 'CAT-SN-001', '2020-03-15', 'Engine Room', 'Engineering', '3200hp diesel engine'],
  ['Generator 1', 'Generator', 'Northern Lights', 'M60C3', 'NL-SN-002', '2020-03-15', 'Engine Room', 'Engineering', '60kW generator'],
  ['Watermaker', 'Watermaker', 'Spectra', 'Newport 400', 'SP-SN-003', '2021-06-01', 'Engine Room', 'Engineering', '400 GPD watermaker'],
  ['Anchor Windlass', 'Anchor Windlass', 'Maxwell', 'VWC4000', 'MW-SN-004', '2020-03-15', 'Foredeck', 'Deck', 'Electric windlass 4000W'],
  ['Main Chartplotter', 'Chartplotter', 'Garmin', 'GPSMAP 8616', 'GM-SN-005', '2022-01-10', 'Helm Station', 'Navigation', '16 inch MFD'],
];

export const Equipment: React.FC<EquipmentProps> = ({ onNavigate, params, departmentFilter }) => {
  const { currentUser, selectedVesselId } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const role = currentUser?.role as UserRole;
  const userDepartment = departmentFilter || getRoleDepartment(role) || null;
  const isDeptLocked = !!departmentFilter;
  const userCanCreate = canCreate(role);

  const [equipment, setEquipment]           = useState<EquipmentType[]>([]);
  const [vessels, setVessels]               = useState<VesselOption[]>([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState('');
  const [filterType, setFilterType]         = useState('all');
  const [filterDept, setFilterDept]         = useState(userDepartment || 'all');
  const [expandedId, setExpandedId]         = useState<string | null>(null);
  const [showModal, setShowModal]           = useState(false);
  const [editingItem, setEditingItem]       = useState<EquipmentType | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Cost tracking per equipment
  const [costMap, setCostMap] = useState<Record<string, { parts: number; service: number; count: number }>>({});

  // Import state
  const [importing, setImporting]           = useState(false);
  const [importResults, setImportResults]   = useState<{ success: number; errors: string[] } | null>(null);
  const [showImportResults, setShowImportResults] = useState(false);

  useEffect(() => { if (currentUser) loadData(); }, [currentUser, selectedVesselId]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    if (isDemoUser(currentUser.email)) {
      const userVessels = currentUser.role === 'master_admin'
        ? demoVessels
        : demoVessels.filter(v => currentUser.vessel_ids.includes(v.id));
      setVessels(userVessels.map(v => ({ id: v.id, name: v.name })));
      const filtered = selectedVesselId && selectedVesselId !== 'all'
        ? demoEquipment.filter(e => e.vessel_id === selectedVesselId)
        : demoEquipment.filter(e => currentUser.vessel_ids.includes(e.vessel_id));
      setEquipment(filtered as EquipmentType[]);
      setLoading(false);
      return;
    }
    const cid = currentUser.company_id;
    if (!cid) { setLoading(false); return; }
    const [vesselsData, equipmentData, historyData] = await Promise.all([
      fetchByCompany('vessels', cid, 'name', true),
      fetchByCompany('equipment', cid, 'name', true),
      fetchByCompany('maintenance_history', cid, 'completion_date', false),
    ]);
    setVessels(vesselsData.map((v: any) => ({ id: v.id, name: v.name })));
    const filtered = selectedVesselId && selectedVesselId !== 'all'
      ? equipmentData.filter((e: any) => e.vessel_id === selectedVesselId)
      : equipmentData;
    setEquipment(filtered);

    const cm: Record<string, { parts: number; service: number; count: number }> = {};
    for (const h of historyData) {
      if (!h.equipment_id) continue;
      if (!cm[h.equipment_id]) cm[h.equipment_id] = { parts: 0, service: 0, count: 0 };
      cm[h.equipment_id].count++;
      cm[h.equipment_id].service += Number(h.external_service_cost || 0);
      const parts: any[] = h.parts_used || [];
      for (const p of parts) {
        cm[h.equipment_id].parts += Number(p.unit_cost || 0) * Number(p.quantity || 0);
      }
    }
    setCostMap(cm);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await dbDelete('equipment', id);
      setEquipment(prev => prev.filter(e => e.id !== id));
      showToast('Equipment removed', 'success');
    } catch { showToast('Error removing equipment', 'error'); }
    finally { setConfirmDeleteId(null); }
  };

  // ── EXPORT CSV ────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (filteredEquipment.length === 0) {
      showToast('No equipment to export', 'info');
      return;
    }
    const rows: string[][] = [CSV_HEADERS];
    filteredEquipment.forEach(e => {
      rows.push([
        e.name || '',
        e.type || '',
        e.manufacturer || '',
        e.model || '',
        e.serial_number || '',
        e.installation_date || '',
        e.location_on_vessel || '',
        (e as any).department || '',
        e.notes || '',
      ]);
    });
    const vesselName = vessels.find(v => v.id === selectedVesselId)?.name || 'all-vessels';
    downloadCSV(rows, `equipment-${vesselName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0,10)}.csv`);
    showToast(`${filteredEquipment.length} items exported`, 'success');
  };

  // ── DOWNLOAD TEMPLATE ─────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const rows = [CSV_HEADERS, ...CSV_EXAMPLE_ROWS];
    downloadCSV(rows, 'equipment-import-template.csv');
    showToast('Template downloaded — fill it in and import', 'success');
  };

  // ── IMPORT CSV ────────────────────────────────────────────────────────────
  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (!selectedVesselId || selectedVesselId === 'all') {
      showToast('Please select a specific vessel before importing', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setImporting(true);
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());

    if (lines.length < 2) {
      showToast('CSV file is empty or has no data rows', 'error');
      setImporting(false);
      return;
    }

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''));

    const nameIdx         = headers.indexOf('name');
    const typeIdx         = headers.indexOf('type');
    const manufacturerIdx = headers.indexOf('manufacturer');
    const modelIdx        = headers.indexOf('model');
    const serialIdx       = headers.indexOf('serial_number');
    const installIdx      = headers.indexOf('installation_date');
    const locationIdx     = headers.indexOf('location_on_vessel');
    const deptIdx         = headers.indexOf('department');
    const notesIdx        = headers.indexOf('notes');

    if (nameIdx === -1 || typeIdx === -1) {
      showToast('CSV must have at least "name" and "type" columns', 'error');
      setImporting(false);
      return;
    }

    const results = { success: 0, errors: [] as string[] };

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map(c => c.trim().replace(/"/g, ''));
      const name = cols[nameIdx];
      const type = cols[typeIdx];

      if (!name || !type) {
        results.errors.push(`Row ${i + 1}: missing name or type — skipped`);
        continue;
      }

      try {
        await dbInsert('equipment', {
          vessel_id:         selectedVesselId,
          company_id:        currentUser.company_id,
          name,
          type,
          manufacturer:      manufacturerIdx !== -1 ? cols[manufacturerIdx] || null : null,
          model:             modelIdx !== -1 ? cols[modelIdx] || null : null,
          serial_number:     serialIdx !== -1 ? cols[serialIdx] || null : null,
          installation_date: installIdx !== -1 && cols[installIdx] ? cols[installIdx] : null,
          location_on_vessel:locationIdx !== -1 ? cols[locationIdx] || null : null,
          department:        deptIdx !== -1 ? cols[deptIdx] || 'Engineering' : 'Engineering',
          notes:             notesIdx !== -1 ? cols[notesIdx] || null : null,
        });
        results.success++;
      } catch {
        results.errors.push(`Row ${i + 1} (${name}): failed to save`);
      }
    }

    setImportResults(results);
    setShowImportResults(true);
    if (results.success > 0) {
      showToast(`${results.success} items imported successfully`, 'success');
      loadData();
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredEquipment = equipment.filter(e => {
    const matchSearch = !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.type?.toLowerCase().includes(search.toLowerCase()) ||
      e.manufacturer?.toLowerCase().includes(search.toLowerCase()) ||
      e.model?.toLowerCase().includes(search.toLowerCase()) ||
      e.serial_number?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || e.type === filterType;
    const matchDept = isDeptLocked
      ? (e as any).department === userDepartment
      : filterDept === 'all' || (e as any).department === filterDept;
    return matchSearch && matchType && matchDept;
  });

  const uniqueTypes = [...new Set(equipment.map(e => e.type).filter(Boolean))].sort();
  const groupedByDept = filteredEquipment.reduce((acc, item) => {
    const dept = (item as any).department || 'General';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(item);
    return acc;
  }, {} as Record<string, EquipmentType[]>);

  const DEPT_ORDER = ['Engineering', 'Deck', 'Interior', 'Galley', 'Safety', 'Navigation', 'General'];
  const sortedDepts = DEPT_ORDER.filter(d => groupedByDept[d]);

  return (
    <div className="space-y-6 pt-4">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            {t('equipment.title')}
            {isDeptLocked && <span className="ml-3 text-lg font-semibold text-blue-600">· {departmentFilter}</span>}
          </h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">{t('equipment.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">

          {/* Export */}
          {equipment.length > 0 && (
            <button onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all text-sm">
              <FileDown className="w-4 h-4" />CSV
            </button>
          )}

          {/* Template */}
          {userCanCreate && (
            <button onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all text-sm">
              <Download className="w-4 h-4" />Template
            </button>
          )}

          {/* Import */}
          {userCanCreate && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all text-sm disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {importing ? 'Importing...' : 'Import'}
              </button>
              <input ref={fileInputRef} type="file" accept=".csv"
                onChange={handleImportCSV} className="hidden" />
            </>
          )}

          {/* Add */}
          {userCanCreate && (
            <button
              onClick={() => { setEditingItem(null); setShowModal(true); }}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />{t('equipment.addEquipment')}
            </button>
          )}
        </div>
      </div>

      {/* ── Import results banner ── */}
      {showImportResults && importResults && (
        <div className={`rounded-2xl border p-4 ${importResults.errors.length === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {importResults.errors.length === 0
                ? <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              }
              <div>
                <p className={`text-sm font-semibold ${importResults.errors.length === 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {importResults.success} equipment items imported successfully
                  {importResults.errors.length > 0 && ` · ${importResults.errors.length} rows skipped`}
                </p>
                {importResults.errors.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {importResults.errors.map((err, i) => (
                      <li key={i} className="text-xs text-amber-700">{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <button onClick={() => setShowImportResults(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Vessel hint para import */}
      {(!selectedVesselId || selectedVesselId === 'all') && userCanCreate && (
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <p className="text-sm text-blue-700">
            Select a specific vessel from the top bar before importing equipment.
          </p>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm flex-1 min-w-48">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('equipment.searchPlaceholder')}
            className="bg-transparent outline-none text-sm text-gray-700 w-full placeholder-gray-400" />
          {search && (
            <button onClick={() => setSearch('')}><X className="w-4 h-4 text-gray-400" /></button>
          )}
        </div>
        {!isDeptLocked && (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
            <Filter className="w-4 h-4 text-gray-400" />
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
              className="text-sm font-medium text-gray-700 bg-transparent outline-none">
              <option value="all">{t('common.allDepartments')}</option>
              {DEPT_ORDER.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
          <Wrench className="w-4 h-4 text-gray-400" />
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="text-sm font-medium text-gray-700 bg-transparent outline-none">
            <option value="all">{t('equipment.allTypes')}</option>
            {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse border border-gray-200" />)}
        </div>
      ) : filteredEquipment.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center shadow-sm">
          <Wrench className="w-14 h-14 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">{t('equipment.noEquipment')}</p>
          <p className="text-sm text-gray-500 mt-1 mb-4">{t('equipment.noEquipmentDesc')}</p>
          {userCanCreate && (
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button onClick={() => { setEditingItem(null); setShowModal(true); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors">
                <Plus className="w-4 h-4" />Add manually
              </button>
              <button onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors">
                <Download className="w-4 h-4" />Download CSV template
              </button>
            </div>
          )}
        </div>
      ) : (
        // ── MODO LISTA — igual que el original, agrupado por departamento ──
        <div className="space-y-6">
          {sortedDepts.map(dept => {
            const items = groupedByDept[dept];
            const DeptIcon = DEPT_ICONS[dept] || Wrench;
            return (
              <div key={dept} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Department header */}
                <div className={`px-5 py-3 flex items-center gap-3 border-b border-gray-100 ${DEPT_COLORS[dept] || 'bg-gray-50 text-gray-700'}`}>
                  <DeptIcon className="w-4 h-4 flex-shrink-0" />
                  <h2 className="text-sm font-bold uppercase tracking-wide">{dept}</h2>
                  <span className="text-xs font-bold px-2 py-0.5 bg-white/50 rounded-full">{items.length}</span>
                </div>

                {/* Equipment rows */}
                <div className="divide-y divide-gray-100">
                  {items.map(item => {
                    const isExpanded = expandedId === item.id;
                    const vesselName = vessels.find(v => v.id === item.vessel_id)?.name;
                    return (
                      <div key={item.id}>
                        {/* Main row */}
                        <div
                          className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        >
                          {item.photo_url ? (
                            <img src={item.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <ImageIcon className="w-4 h-4 text-gray-300" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                              {vesselName && (!selectedVesselId || selectedVesselId === 'all') && (
                                <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium flex-shrink-0">
                                  {vesselName}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {item.type}
                              {item.manufacturer && ` · ${item.manufacturer}`}
                              {item.model && ` ${item.model}`}
                              {item.location_on_vessel && ` · ${item.location_on_vessel}`}
                            </p>
                          </div>
                          {item.serial_number && (
                            <span className="text-xs text-gray-400 font-mono hidden sm:block flex-shrink-0">
                              S/N {item.serial_number}
                            </span>
                          )}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {userCanCreate && (
                              <>
                                <button
                                  onClick={e => { e.stopPropagation(); setEditingItem(item); setShowModal(true); }}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); setConfirmDeleteId(item.id); }}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            {isExpanded
                              ? <ChevronUp className="w-4 h-4 text-gray-400" />
                              : <ChevronDown className="w-4 h-4 text-gray-400" />
                            }
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
                            {item.photo_url && (
                              <div className="mb-4">
                                <img src={item.photo_url} alt={item.name}
                                  className="w-full max-w-xs h-48 object-cover rounded-xl border border-gray-200 shadow-sm" />
                              </div>
                            )}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                              {item.manufacturer && (
                                <div>
                                  <p className="text-xs text-gray-500 font-medium mb-0.5">Manufacturer</p>
                                  <p className="text-sm font-semibold text-gray-900">{item.manufacturer}</p>
                                </div>
                              )}
                              {item.model && (
                                <div>
                                  <p className="text-xs text-gray-500 font-medium mb-0.5">Model</p>
                                  <p className="text-sm font-semibold text-gray-900">{item.model}</p>
                                </div>
                              )}
                              {item.serial_number && (
                                <div>
                                  <p className="text-xs text-gray-500 font-medium mb-0.5">Serial Number</p>
                                  <p className="text-sm font-semibold text-gray-900 font-mono">{item.serial_number}</p>
                                </div>
                              )}
                              {item.installation_date && (
                                <div>
                                  <p className="text-xs text-gray-500 font-medium mb-0.5">Installation Date</p>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {new Date(item.installation_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </p>
                                </div>
                              )}
                              {item.location_on_vessel && (
                                <div>
                                  <p className="text-xs text-gray-500 font-medium mb-0.5">Location</p>
                                  <p className="text-sm font-semibold text-gray-900">{item.location_on_vessel}</p>
                                </div>
                              )}
                              {vesselName && (
                                <div>
                                  <p className="text-xs text-gray-500 font-medium mb-0.5">Vessel</p>
                                  <p className="text-sm font-semibold text-gray-900">{vesselName}</p>
                                </div>
                              )}
                            </div>
                            {item.notes && (
                              <div className="mb-4">
                                <p className="text-xs text-gray-500 font-medium mb-1">Notes</p>
                                <p className="text-sm text-gray-700 leading-relaxed">{item.notes}</p>
                              </div>
                            )}
                            {costMap[item.id] && (
                              <div className="mb-4 p-3 bg-white border border-gray-200 rounded-xl">
                                <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wide">Maintenance Cost History</p>
                                <div className="flex gap-6">
                                  <div>
                                    <p className="text-lg font-bold text-gray-900">${(costMap[item.id].parts + costMap[item.id].service).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    <p className="text-[10px] text-gray-400 font-medium">TOTAL SPENT</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-blue-600">${costMap[item.id].parts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    <p className="text-[10px] text-gray-400 font-medium">PARTS</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-orange-600">${costMap[item.id].service.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    <p className="text-[10px] text-gray-400 font-medium">EXTERNAL SERVICE</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-600">{costMap[item.id].count}</p>
                                    <p className="text-[10px] text-gray-400 font-medium">COMPLETIONS</p>
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => onNavigate('maintenance', { equipmentId: item.id, equipmentName: item.name })}
                                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                              >
                                <Wrench className="w-3.5 h-3.5" />{t('equipment.viewTasks')}
                              </button>
                              <button
                                onClick={() => onNavigate('manuals', { equipmentId: item.id })}
                                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5" />{t('equipment.viewManuals')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {showModal && (
        <EquipmentModal
          item={editingItem}
          vessels={vessels}
          selectedVesselId={selectedVesselId}
          companyId={currentUser?.company_id || ''}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
          onSaved={() => { setShowModal(false); setEditingItem(null); loadData(); showToast(editingItem ? 'Equipment updated' : 'Equipment added', 'success'); }}
        />
      )}
      {confirmDeleteId && (
        <ConfirmModal
          title={t('equipment.deleteTitle')}
          message={t('equipment.deleteMessage')}
          confirmLabel={t('common.delete')}
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
};

/* ── Equipment Modal — sin cambios vs el original ───────────────────────── */
const EquipmentModal: React.FC<{
  item: EquipmentType | null;
  vessels: VesselOption[];
  selectedVesselId: string | null;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ item, vessels, selectedVesselId, companyId, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [typeInput, setTypeInput] = useState(item?.type || '');
  const [showTypeSuggestions, setShowTypeSuggestions] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(item?.photo_url || null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name:              item?.name || '',
    type:              item?.type || '',
    manufacturer:      item?.manufacturer || '',
    model:             item?.model || '',
    serial_number:     item?.serial_number || '',
    installation_date: item?.installation_date || '',
    location_on_vessel:item?.location_on_vessel || '',
    department:        (item as any)?.department || 'Engineering',
    notes:             item?.notes || '',
    vessel_id:         item?.vessel_id || (selectedVesselId && selectedVesselId !== 'all' ? selectedVesselId : (vessels.length === 1 ? vessels[0].id : '')),
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Photo must be under 5MB', 'warning'); return; }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const filteredTypes = EQUIPMENT_TYPES.filter(t =>
    t.toLowerCase().includes(typeInput.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !form.name || !form.vessel_id) return;
    setSaving(true);
    try {
      let photo_url = item?.photo_url || null;
      if (photoFile) {
        const ext = photoFile.name.split('.').pop();
        const path = `equipment/${form.vessel_id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('task-photos').upload(path, photoFile, { upsert: true });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('task-photos').getPublicUrl(path);
          photo_url = urlData.publicUrl;
        }
      }
      const payload = {
        vessel_id:         form.vessel_id,
        company_id:        companyId,
        name:              form.name,
        type:              form.type || null,
        manufacturer:      form.manufacturer || null,
        model:             form.model || null,
        serial_number:     form.serial_number || null,
        installation_date: form.installation_date || null,
        location_on_vessel:form.location_on_vessel || null,
        department:        form.department,
        notes:             form.notes || null,
        photo_url,
      };
      if (item) {
        await dbUpdate('equipment', item.id, payload);
      } else {
        await dbInsert('equipment', payload);
      }
      onSaved();
    } catch { showToast('Error saving equipment', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{item ? t('equipment.editTitle') : t('equipment.addTitle')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('equipment.name')} *</label>
            <input type="text" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Main Engine" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('equipment.type')} *</label>
              <input type="text" value={typeInput}
                onChange={e => { setTypeInput(e.target.value); setForm({ ...form, type: e.target.value }); setShowTypeSuggestions(true); }}
                onFocus={() => setShowTypeSuggestions(true)}
                onBlur={() => setTimeout(() => setShowTypeSuggestions(false), 150)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Select or type a type..." />
              {showTypeSuggestions && filteredTypes.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredTypes.map(t => (
                    <button key={t} type="button"
                      onMouseDown={() => { setTypeInput(t); setForm(f => ({ ...f, type: t })); setShowTypeSuggestions(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.vessel')} *</label>
              <select value={form.vessel_id}
                onChange={e => setForm({ ...form, vessel_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
                <option value="">Select vessel</option>
                {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
            <select value={form.department}
              onChange={e => setForm({ ...form, department: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              {Object.keys(DEPT_ICONS).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('equipment.manufacturer')} *</label>
              <input type="text" value={form.manufacturer}
                onChange={e => setForm({ ...form, manufacturer: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Caterpillar" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('equipment.model')}</label>
              <input type="text" value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., C32 ACERT" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('equipment.serialNumber')}</label>
              <input type="text" value={form.serial_number}
                onChange={e => setForm({ ...form, serial_number: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., SN123456789" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('equipment.installationDate')}</label>
              <input type="date" value={form.installation_date}
                onChange={e => setForm({ ...form, installation_date: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('equipment.location')}</label>
            <input type="text" value={form.location_on_vessel}
              onChange={e => setForm({ ...form, location_on_vessel: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Engine Room Deck 2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Photo</label>
            <div className="flex items-center gap-4">
              {photoPreview ? (
                <div className="relative group">
                  <img src={photoPreview} alt="Equipment" className="w-24 h-24 rounded-xl object-cover border border-gray-200" />
                  <button type="button"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => photoInputRef.current?.click()}
                  className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer">
                  <Camera className="w-5 h-5 text-gray-400" />
                  <span className="text-[10px] text-gray-400 font-medium">Add Photo</span>
                </button>
              )}
              {photoPreview && (
                <button type="button" onClick={() => photoInputRef.current?.click()}
                  className="text-xs text-blue-600 font-medium hover:underline">Change photo</button>
              )}
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('equipment.notes')}</label>
            <textarea value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Technical specifications, power ratings, capacity, etc..." />
          </div>
          <div className="bg-blue-50 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">{t('equipment.addHint')}</p>
          </div>
          <div className="flex gap-3 pt-2 border-t border-gray-200">
            <button type="button" onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg disabled:opacity-50">
              {saving ? t('common.loading') : item ? t('common.save') : t('equipment.addEquipment')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
