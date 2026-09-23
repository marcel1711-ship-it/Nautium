import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, Plus, Search, ChevronRight, Phone, Mail, Calendar,
  Ship, Filter, UserCheck, UserMinus, Clock, AlertTriangle, ShieldCheck,
  ClipboardCheck, ChevronLeft, Check, X, FileDown, Shield,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchByCompany, fetchFiltered, dbInsert, dbUpdate } from '../lib/supabase';
import { useToast } from '../components/UI/Toast';
import { CrewMember, UserRole, FULL_ACCESS_ROLES } from '../types';
import { AddCrewModal } from '../components/Crew/AddCrewModal';
import { EditCrewModal } from '../components/Crew/EditCrewModal';

interface CrewProps {
  onNavigate: (page: string, params?: any) => void;
}

const POSITIONS = [
  'Captain', 'First Officer', 'Chief Engineer', 'Engineer', '2nd Engineer',
  'Bosun', 'Deckhand', 'Chief Stewardess', 'Stewardess', '2nd Stewardess', '3rd Stewardess',
  'Chef', 'Sous Chef', 'Purser', 'ETO', 'Dive Instructor',
  'Security Officer', 'Laundry', 'Other',
];

const DEPARTMENTS = ['Deck', 'Engineering', 'Interior', 'Galley', 'Safety', 'General'];

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  active:     { label: 'Active',     dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  on_leave:   { label: 'On leave',   dot: 'bg-amber-500',   bg: 'bg-amber-50',   text: 'text-amber-700' },
  off_vessel: { label: 'Off vessel', dot: 'bg-gray-400',    bg: 'bg-gray-100',   text: 'text-gray-600' },
};

const fmtCurrency = (v: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);

const canSeeSalary = (role: UserRole) =>
  ['master_admin', 'customer_admin', 'fleet_manager', 'captain'].includes(role);

const canEditCrew = (role: UserRole) =>
  ['master_admin', 'customer_admin', 'fleet_manager', 'captain'].includes(role);

type CrewTab = 'roster' | 'hours_of_rest';

export const Crew: React.FC<CrewProps> = ({ onNavigate }) => {
  const { currentUser, selectedVesselId } = useAuth();
  const { showToast } = useToast();
  const role = currentUser?.role as UserRole;
  const companyId = currentUser?.company_id || '';
  const showSalary = canSeeSalary(role);
  const canEdit = canEditCrew(role);

  const [tab, setTab] = useState<CrewTab>('roster');
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [vessels, setVessels] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<CrewMember | null>(null);
  const [certCounts, setCertCounts] = useState<Record<string, { total: number; issues: number }>>({});

  const activeVessel = (!selectedVesselId || selectedVesselId === 'all') ? 'all' : selectedVesselId;

  useEffect(() => { if (currentUser) loadData(); }, [currentUser, selectedVesselId]);

  const loadData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [vesselsData] = await Promise.all([
        fetchByCompany('vessels', companyId, 'name', true),
      ]);
      setVessels(vesselsData.map((v: any) => ({ id: v.id, name: v.name })));

      const crewData = activeVessel !== 'all'
        ? await fetchFiltered('crew_members', companyId, [{ field: 'vessel_id', op: 'eq', value: activeVessel }], { order_by: 'full_name' })
        : await fetchByCompany('crew_members', companyId, 'full_name', true);
      setCrew(crewData || []);

      const compData = await fetchFiltered('compliance_items', companyId, [{ field: 'crew_member_id', op: 'not_null' }], { select_cols: 'crew_member_id, expiry_date' });
      if (compData) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const counts: Record<string, { total: number; issues: number }> = {};
        compData.forEach((c: any) => {
          if (!c.crew_member_id) return;
          if (!counts[c.crew_member_id]) counts[c.crew_member_id] = { total: 0, issues: 0 };
          counts[c.crew_member_id].total++;
          const days = Math.ceil((new Date(c.expiry_date).getTime() - today.getTime()) / 86400000);
          if (days <= 30) counts[c.crew_member_id].issues++;
        });
        setCertCounts(counts);
      }
    } catch (err) {
      showToast('Error loading crew data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const vesselName = (id: string) => vessels.find(v => v.id === id)?.name || '—';

  const filtered = useMemo(() => {
    let list = crew;
    if (statusFilter !== 'all') list = list.filter(c => c.status === statusFilter);
    if (deptFilter !== 'all') list = list.filter(c => c.department === deptFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.full_name.toLowerCase().includes(q) ||
        c.position.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    }
    return list;
  }, [crew, search, deptFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = crew.filter(c => c.status === 'active').length;
    const onLeave = crew.filter(c => c.status === 'on_leave').length;
    const expiringSoon = crew.filter(c => {
      if (!c.contract_end_date) return false;
      const days = Math.ceil((new Date(c.contract_end_date).getTime() - Date.now()) / 86400000);
      return days >= 0 && days <= 30;
    }).length;
    const totalMonthlySalary = crew.filter(c => c.status === 'active').reduce((s, c) => s + (c.monthly_salary || 0), 0);
    return { active, onLeave, expiringSoon, totalMonthlySalary };
  }, [crew]);

  const handleSaved = () => {
    loadData();
    setShowAddModal(false);
    setEditingMember(null);
  };

  if (loading) return (
    <div className="space-y-5 pt-2">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse border border-gray-200" />)}
      </div>
      <div className="h-96 bg-white rounded-2xl animate-pulse border border-gray-200" />
    </div>
  );

  return (
    <div className="space-y-5 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Crew</h1>
          <p className="text-sm text-gray-400">
            {activeVessel === 'all' ? 'All vessels' : vesselName(activeVessel)}
            {' · '}{crew.length} member{crew.length !== 1 ? 's' : ''}
          </p>
        </div>
        {tab === 'roster' && canEdit && (
          <button onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> Add crew
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('roster')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === 'roster' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
          <Users className="w-4 h-4" /> Roster <span className="bg-white/20 px-1.5 py-0.5 rounded-md text-xs">{crew.length}</span>
        </button>
        <button onClick={() => setTab('hours_of_rest')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === 'hours_of_rest' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
          <ClipboardCheck className="w-4 h-4" /> Hours of Rest
        </button>
      </div>

      {tab === 'roster' ? (
        <>
          {/* Stats */}
          <div className={`grid grid-cols-2 ${showSalary ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3`}>
            <StatCard icon={UserCheck} label="Active" value={stats.active} tone="green" />
            <StatCard icon={Clock} label="On leave" value={stats.onLeave} tone="amber" />
            <StatCard icon={AlertTriangle} label="Contract expiring" value={stats.expiringSoon} tone={stats.expiringSoon > 0 ? 'red' : 'gray'} />
            {showSalary && (
              <StatCard icon={Users} label="Monthly payroll" value={fmtCurrency(stats.totalMonthlySalary, 'USD')} tone="blue" />
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, position or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white">
              <option value="all">All departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white">
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="on_leave">On leave</option>
              <option value="off_vessel">Off vessel</option>
            </select>
          </div>

          {/* Crew list */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-lg font-semibold text-gray-700">No crew members found</p>
              <p className="text-sm text-gray-400 mt-1">
                {crew.length === 0 ? 'Add your first crew member to get started.' : 'Try adjusting your filters.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Table header */}
              <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-5 py-3 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <div className="col-span-3">Name</div>
                <div className="col-span-2">Position</div>
                <div className="col-span-1">Department</div>
                {activeVessel === 'all' && <div className="col-span-2">Vessel</div>}
                <div className={activeVessel === 'all' ? 'col-span-1' : 'col-span-2'}>Status</div>
                {showSalary && <div className={activeVessel === 'all' ? 'col-span-2' : 'col-span-2'}>Salary</div>}
                <div className="col-span-1"></div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-gray-100">
                {filtered.map(member => {
                  const s = STATUS_CONFIG[member.status] || STATUS_CONFIG.active;
                  const contractDays = member.contract_end_date
                    ? Math.ceil((new Date(member.contract_end_date).getTime() - Date.now()) / 86400000)
                    : null;
                  const contractWarning = contractDays !== null && contractDays >= 0 && contractDays <= 30;

                  return (
                    <div key={member.id}
                      className={`lg:grid lg:grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-gray-50 transition-colors ${canEdit ? 'cursor-pointer' : ''}`}
                      onClick={() => canEdit && setEditingMember(member)}>

                      {/* Name + avatar */}
                      <div className="col-span-3 flex items-center gap-3 mb-2 lg:mb-0">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {member.photo_url ? (
                            <img src={member.photo_url} alt={member.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-semibold text-gray-500">
                              {member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{member.full_name}</p>
                          {member.nationality && <p className="text-xs text-gray-400 truncate">{member.nationality}</p>}
                        </div>
                      </div>

                      {/* Position */}
                      <div className="col-span-2 mb-1 lg:mb-0">
                        <p className="text-sm text-gray-700">{member.position}</p>
                      </div>

                      {/* Department */}
                      <div className="col-span-1 mb-1 lg:mb-0">
                        <span className="text-xs font-medium text-gray-500">{member.department}</span>
                      </div>

                      {/* Vessel (when all fleet) */}
                      {activeVessel === 'all' && (
                        <div className="col-span-2 mb-1 lg:mb-0">
                          <span className="text-xs font-medium text-gray-500">{vesselName(member.vessel_id)}</span>
                        </div>
                      )}

                      {/* Status */}
                      <div className={activeVessel === 'all' ? 'col-span-1' : 'col-span-2'}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                          {contractWarning && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                              <AlertTriangle className="w-3 h-3" />
                              {contractDays}d left
                            </span>
                          )}
                          {certCounts[member.id] && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${certCounts[member.id].issues > 0 ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                              <ShieldCheck className="w-3 h-3" />
                              {certCounts[member.id].total} cert{certCounts[member.id].total !== 1 ? 's' : ''}
                              {certCounts[member.id].issues > 0 && ` (${certCounts[member.id].issues} !)`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Salary */}
                      {showSalary && (
                        <div className={activeVessel === 'all' ? 'col-span-2' : 'col-span-2'}>
                          <span className="text-sm font-semibold text-gray-900 tabular-nums">
                            {member.monthly_salary > 0 ? fmtCurrency(member.monthly_salary, member.salary_currency) : '—'}
                          </span>
                          {member.monthly_salary > 0 && <span className="text-xs text-gray-400 ml-1">/mo</span>}
                        </div>
                      )}

                      {/* Arrow */}
                      <div className="col-span-1 flex justify-end">
                        {canEdit && <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <HoursOfRestTab
          crew={crew.filter(c => c.status === 'active')}
          vessels={vessels}
          companyId={companyId}
          activeVessel={activeVessel}
          currentUser={currentUser}
          canEdit={canEdit}
        />
      )}

      {/* Modals */}
      {showAddModal && (
        <AddCrewModal
          vessels={vessels}
          defaultVesselId={activeVessel !== 'all' ? activeVessel : ''}
          onClose={() => setShowAddModal(false)}
          onSaved={handleSaved}
        />
      )}
      {editingMember && (
        <EditCrewModal
          member={editingMember}
          vessels={vessels}
          onClose={() => setEditingMember(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

// ── HOURS OF REST TAB ────────────────────────────────────────────────────────

interface HorRecord {
  id: string;
  crew_member_id: string;
  vessel_id: string;
  company_id: string;
  date: string;
  work_periods: { start: string; end: string }[];
  total_work_hours: number;
  total_rest_hours: number;
  comments: string | null;
  status: 'draft' | 'crew_confirmed' | 'approved';
  crew_confirmed_at: string | null;
  crew_confirmed_name: string | null;
  master_approved_at: string | null;
  master_approved_by: string | null;
  recorded_by_name: string | null;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const getWeekStart = (d: Date) => {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
};

const fmtDate = (d: Date) => d.toISOString().split('T')[0];
const fmtDateShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const calcHours = (periods: { start: string; end: string }[]) => {
  let total = 0;
  for (const p of periods) {
    const [sh, sm] = p.start.split(':').map(Number);
    const [eh, em] = p.end.split(':').map(Number);
    total += (eh + em / 60) - (sh + sm / 60);
  }
  return Math.round(total * 10) / 10;
};

const checkMlcViolations = (weekRecords: HorRecord[]) => {
  const violations: string[] = [];
  let weeklyRest = 0;

  for (const rec of weekRecords) {
    if (rec.total_rest_hours < 10) {
      violations.push(`${rec.date}: Only ${rec.total_rest_hours}h rest (min 10h required)`);
    }
    if (rec.total_work_hours > 14) {
      violations.push(`${rec.date}: ${rec.total_work_hours}h work (max 14h allowed)`);
    }
    const periods = rec.work_periods || [];
    const restPeriods: { start: number; end: number }[] = [];
    let prev = 0;
    const sorted = [...periods].sort((a, b) => a.start.localeCompare(b.start));
    for (const p of sorted) {
      const [sh] = p.start.split(':').map(Number);
      if (sh > prev) restPeriods.push({ start: prev, end: sh });
      const [eh] = p.end.split(':').map(Number);
      prev = eh;
    }
    if (prev < 24) restPeriods.push({ start: prev, end: 24 });
    const significantRest = restPeriods.filter(r => (r.end - r.start) >= 1);
    if (significantRest.length > 2) {
      violations.push(`${rec.date}: Rest split into ${significantRest.length} periods (max 2 allowed)`);
    }
    const longestRest = significantRest.reduce((max, r) => Math.max(max, r.end - r.start), 0);
    if (significantRest.length > 0 && longestRest < 6) {
      violations.push(`${rec.date}: Longest rest period is ${longestRest}h (min 6h required)`);
    }
    weeklyRest += rec.total_rest_hours;
  }

  if (weekRecords.length === 7 && weeklyRest < 77) {
    violations.push(`Weekly rest: ${weeklyRest}h (min 77h required)`);
  }

  return violations;
};

const HOR_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft' },
  crew_confirmed: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Crew confirmed' },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Approved' },
};

const HoursOfRestTab: React.FC<{
  crew: CrewMember[];
  vessels: { id: string; name: string }[];
  companyId: string;
  activeVessel: string;
  currentUser: any;
  canEdit: boolean;
}> = ({ crew, vessels, companyId, activeVessel, currentUser, canEdit }) => {
  const { showToast } = useToast();
  const [selectedCrew, setSelectedCrew] = useState<string>('');
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [records, setRecords] = useState<HorRecord[]>([]);
  const [loadingHor, setLoadingHor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [editPeriods, setEditPeriods] = useState<{ start: string; end: string }[]>([]);
  const [editComments, setEditComments] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [confirmChecked, setConfirmChecked] = useState(false);

  const weekDates = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }), [weekStart]);

  const filteredCrew = useMemo(() => {
    if (activeVessel === 'all') return crew;
    return crew.filter(c => c.vessel_id === activeVessel);
  }, [crew, activeVessel]);

  useEffect(() => {
    if (filteredCrew.length > 0 && !selectedCrew) {
      setSelectedCrew(filteredCrew[0].id);
    }
  }, [filteredCrew]);

  const loadRecords = useCallback(async () => {
    if (!selectedCrew || !companyId) return;
    setLoadingHor(true);
    try {
      const startStr = fmtDate(weekDates[0]);
      const endStr = fmtDate(weekDates[6]);
      const data = await fetchFiltered('hours_of_rest', companyId, [
        { field: 'crew_member_id', op: 'eq', value: selectedCrew },
        { field: 'date', op: 'gte', value: startStr },
        { field: 'date', op: 'lte', value: endStr },
      ]);
      setRecords(data || []);
    } catch { showToast('Error loading records', 'error'); }
    finally { setLoadingHor(false); }
  }, [selectedCrew, weekDates, companyId]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const selectedMember = crew.find(c => c.id === selectedCrew);
  const vesselId = selectedMember?.vessel_id || '';

  const getRecord = (dateStr: string) => records.find(r => r.date === dateStr);

  const handleEditDay = (dateStr: string) => {
    if (!canEdit) return;
    const existing = getRecord(dateStr);
    if (existing?.status === 'approved') return;
    setEditingDay(dateStr);
    setEditPeriods(existing?.work_periods?.length ? [...existing.work_periods] : [{ start: '08:00', end: '12:00' }, { start: '13:00', end: '17:00' }]);
    setEditComments(existing?.comments || '');
  };

  const handleSaveDay = async () => {
    if (!editingDay || !selectedCrew || !vesselId) return;
    setSaving(true);
    try {
      const workHours = calcHours(editPeriods);
      const restHours = Math.round((24 - workHours) * 10) / 10;
      const existing = getRecord(editingDay);
      const payload = {
        work_periods: editPeriods,
        total_work_hours: workHours,
        total_rest_hours: restHours,
        comments: editComments || null,
        recorded_by_id: currentUser?.id,
        recorded_by_name: currentUser?.full_name || currentUser?.email,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await dbUpdate('hours_of_rest', existing.id, payload);
      } else {
        await dbInsert('hours_of_rest', {
          ...payload,
          company_id: companyId,
          vessel_id: vesselId,
          crew_member_id: selectedCrew,
          date: editingDay,
          status: 'draft',
        });
      }
      showToast('Hours saved', 'success');
      setEditingDay(null);
      loadRecords();
    } catch { showToast('Error saving hours', 'error'); }
    finally { setSaving(false); }
  };

  const handleCrewConfirm = async () => {
    if (!confirmChecked || !confirmName.trim()) return;
    setSaving(true);
    try {
      const drafts = records.filter(r => r.status === 'draft');
      for (const rec of drafts) {
        await dbUpdate('hours_of_rest', rec.id, {
          status: 'crew_confirmed',
          crew_confirmed_at: new Date().toISOString(),
          crew_confirmed_name: confirmName.trim(),
        });
      }
      showToast('Hours confirmed by crew', 'success');
      setShowConfirmModal(false);
      setConfirmName('');
      setConfirmChecked(false);
      loadRecords();
    } catch { showToast('Error confirming hours', 'error'); }
    finally { setSaving(false); }
  };

  const handleMasterApprove = async () => {
    setSaving(true);
    try {
      const confirmed = records.filter(r => r.status === 'crew_confirmed');
      for (const rec of confirmed) {
        await dbUpdate('hours_of_rest', rec.id, {
          status: 'approved',
          master_approved_at: new Date().toISOString(),
          master_approved_by: currentUser?.full_name || currentUser?.email,
        });
      }
      showToast('Hours approved by master', 'success');
      loadRecords();
    } catch { showToast('Error approving hours', 'error'); }
    finally { setSaving(false); }
  };

  const violations = checkMlcViolations(records);
  const hasDrafts = records.some(r => r.status === 'draft');
  const hasConfirmed = records.some(r => r.status === 'crew_confirmed');
  const allApproved = records.length > 0 && records.every(r => r.status === 'approved');
  const weeklyWork = records.reduce((s, r) => s + r.total_work_hours, 0);
  const weeklyRest = records.reduce((s, r) => s + r.total_rest_hours, 0);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <select value={selectedCrew} onChange={e => setSelectedCrew(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white min-w-[200px]">
          {filteredCrew.length === 0 && <option value="">No active crew</option>}
          {filteredCrew.map(c => (
            <option key={c.id} value={c.id}>{c.full_name} — {c.position}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[180px] text-center">
            {fmtDateShort(weekDates[0])} — {fmtDateShort(weekDates[6])}
          </span>
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
          <button onClick={() => setWeekStart(getWeekStart(new Date()))}
            className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
            Today
          </button>
        </div>
      </div>

      {/* MLC Violations */}
      {violations.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <p className="text-sm font-semibold text-red-800">MLC 2006 Violations</p>
          </div>
          <ul className="space-y-1">
            {violations.map((v, i) => <li key={i} className="text-xs text-red-700">• {v}</li>)}
          </ul>
        </div>
      )}

      {/* Weekly summary */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs text-gray-500">Days recorded</p>
            <p className="text-lg font-bold text-gray-900">{records.length}/7</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs text-gray-500">Total work</p>
            <p className="text-lg font-bold text-gray-900">{weeklyWork}h</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs text-gray-500">Total rest</p>
            <p className={`text-lg font-bold ${weeklyRest < 77 && records.length === 7 ? 'text-red-600' : 'text-gray-900'}`}>{weeklyRest}h</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs text-gray-500">Status</p>
            {allApproved ? (
              <p className="text-lg font-bold text-emerald-600">Approved</p>
            ) : hasConfirmed ? (
              <p className="text-lg font-bold text-blue-600">Pending approval</p>
            ) : (
              <p className="text-lg font-bold text-gray-500">Draft</p>
            )}
          </div>
        </div>
      )}

      {/* Weekly grid */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase w-24">Day</th>
                {HOURS.map(h => (
                  <th key={h} className="px-0 py-3 text-[10px] font-medium text-gray-400 w-[28px] text-center">{String(h).padStart(2, '0')}</th>
                ))}
                <th className="px-3 py-3 text-xs font-semibold text-gray-400 text-center w-16">Work</th>
                <th className="px-3 py-3 text-xs font-semibold text-gray-400 text-center w-16">Rest</th>
                <th className="px-3 py-3 text-xs font-semibold text-gray-400 text-center w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {weekDates.map((date, dayIdx) => {
                const dateStr = fmtDate(date);
                const rec = getRecord(dateStr);
                const isEditing = editingDay === dateStr;
                const isToday = dateStr === fmtDate(new Date());
                const periods = rec?.work_periods || [];
                const status = rec ? HOR_STATUS_STYLES[rec.status] : null;

                const isWorkHour = (h: number) => {
                  return periods.some(p => {
                    const [sh] = p.start.split(':').map(Number);
                    const [eh] = p.end.split(':').map(Number);
                    return h >= sh && h < eh;
                  });
                };

                return (
                  <tr key={dateStr} className={`border-b border-gray-50 ${isToday ? 'bg-blue-50/30' : 'hover:bg-gray-50'} ${canEdit && rec?.status !== 'approved' ? 'cursor-pointer' : ''}`}
                    onClick={() => !isEditing && handleEditDay(dateStr)}>
                    <td className="px-4 py-2.5">
                      <p className={`text-sm font-semibold ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>{DAY_LABELS[dayIdx]}</p>
                      <p className="text-[10px] text-gray-400">{fmtDateShort(date)}</p>
                    </td>
                    {HOURS.map(h => (
                      <td key={h} className="px-0 py-2.5">
                        <div className={`w-5 h-5 mx-auto rounded-sm ${isWorkHour(h) ? 'bg-blue-500' : rec ? 'bg-gray-100' : 'bg-gray-50 border border-dashed border-gray-200'}`} />
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-sm font-semibold tabular-nums ${rec && rec.total_work_hours > 14 ? 'text-red-600' : 'text-gray-900'}`}>
                        {rec ? `${rec.total_work_hours}h` : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-sm font-semibold tabular-nums ${rec && rec.total_rest_hours < 10 ? 'text-red-600' : 'text-gray-900'}`}>
                        {rec ? `${rec.total_rest_hours}h` : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {status && (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${status.bg} ${status.text}`}>{status.label}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-blue-500" /> Work</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-gray-100" /> Rest</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-gray-50 border border-dashed border-gray-200" /> No record</div>
        </div>
      </div>

      {/* Action buttons */}
      {canEdit && records.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {hasDrafts && (
            <button onClick={() => setShowConfirmModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
              <ClipboardCheck className="w-4 h-4" /> Crew confirmation
            </button>
          )}
          {hasConfirmed && (
            <button onClick={handleMasterApprove} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50">
              <Shield className="w-4 h-4" /> {saving ? 'Approving...' : 'Master approve'}
            </button>
          )}
        </div>
      )}

      {/* Signatures info */}
      {records.length > 0 && (records.some(r => r.crew_confirmed_name) || records.some(r => r.master_approved_by)) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          {records.find(r => r.crew_confirmed_name) && (
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">Crew confirmed by:</span>{' '}
              {records.find(r => r.crew_confirmed_name)!.crew_confirmed_name}{' — '}
              {new Date(records.find(r => r.crew_confirmed_at)!.crew_confirmed_at!).toLocaleString()}
            </p>
          )}
          {records.find(r => r.master_approved_by) && (
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">Approved by master:</span>{' '}
              {records.find(r => r.master_approved_by)!.master_approved_by}{' — '}
              {new Date(records.find(r => r.master_approved_at)!.master_approved_at!).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Edit day modal */}
      {editingDay && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditingDay(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {DAY_LABELS[weekDates.findIndex(d => fmtDate(d) === editingDay)]} — {editingDay}
              </h3>
              <button onClick={() => setEditingDay(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-500">Define work periods for this day. Rest hours are calculated automatically.</p>

              {editPeriods.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Start</label>
                    <input type="time" value={p.start}
                      onChange={e => { const arr = [...editPeriods]; arr[i].start = e.target.value; setEditPeriods(arr); }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">End</label>
                    <input type="time" value={p.end}
                      onChange={e => { const arr = [...editPeriods]; arr[i].end = e.target.value; setEditPeriods(arr); }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  {editPeriods.length > 1 && (
                    <button onClick={() => setEditPeriods(editPeriods.filter((_, j) => j !== i))}
                      className="p-2 text-red-400 hover:text-red-600 mt-5"><X className="w-4 h-4" /></button>
                  )}
                </div>
              ))}

              <button onClick={() => setEditPeriods([...editPeriods, { start: '18:00', end: '20:00' }])}
                className="text-sm text-blue-600 font-medium hover:text-blue-700">+ Add work period</button>

              <div className="bg-gray-50 rounded-lg p-3 flex gap-6">
                <div>
                  <p className="text-xs text-gray-500">Work</p>
                  <p className="text-sm font-bold text-gray-900">{calcHours(editPeriods)}h</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Rest</p>
                  <p className={`text-sm font-bold ${24 - calcHours(editPeriods) < 10 ? 'text-red-600' : 'text-gray-900'}`}>
                    {Math.round((24 - calcHours(editPeriods)) * 10) / 10}h
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Comments (optional)</label>
                <input type="text" value={editComments} onChange={e => setEditComments(e.target.value)}
                  placeholder="Port watch, night passage, etc."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setEditingDay(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
              <button onClick={handleSaveDay} disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crew confirmation modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowConfirmModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Crew confirmation</h3>
              <button onClick={() => setShowConfirmModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                The crew member confirms that the hours of work and rest recorded for the week
                of <span className="font-semibold">{fmtDateShort(weekDates[0])} — {fmtDateShort(weekDates[6])}</span> are accurate.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 space-y-1 text-sm">
                <p><span className="text-gray-500">Crew member:</span> <span className="font-medium text-gray-900">{selectedMember?.full_name}</span></p>
                <p><span className="text-gray-500">Total work:</span> <span className="font-medium text-gray-900">{weeklyWork}h</span></p>
                <p><span className="text-gray-500">Total rest:</span> <span className="font-medium text-gray-900">{weeklyRest}h</span></p>
              </div>

              {violations.length > 0 && (
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1">Warning: MLC violations detected</p>
                  {violations.slice(0, 3).map((v, i) => <p key={i} className="text-xs text-red-600">• {v}</p>)}
                </div>
              )}

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Crew member's full name *</label>
                <input type="text" value={confirmName} onChange={e => setConfirmName(e.target.value)}
                  placeholder="Type full name to confirm"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={confirmChecked} onChange={e => setConfirmChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-gray-700">I confirm that the hours of work and rest recorded above are correct and complete.</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
              <button onClick={handleCrewConfirm}
                disabled={saving || !confirmChecked || !confirmName.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ElementType; label: string; value: string | number;
  tone: 'green' | 'amber' | 'red' | 'blue' | 'gray';
}> = ({ icon: Icon, label, value, tone }) => {
  const iconColor = {
    green: 'text-emerald-600', amber: 'text-amber-600',
    red: 'text-red-600', blue: 'text-blue-600', gray: 'text-gray-400',
  }[tone];
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center mb-3">
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-xs font-medium text-gray-500 mt-0.5">{label}</p>
    </div>
  );
};

export { POSITIONS, DEPARTMENTS };
