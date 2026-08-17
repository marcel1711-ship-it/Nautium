import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Plus, Search, ChevronRight, Phone, Mail, Calendar,
  Ship, Filter, UserCheck, UserMinus, Clock, AlertTriangle, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, fetchByCompany } from '../lib/supabase';
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

export const Crew: React.FC<CrewProps> = ({ onNavigate }) => {
  const { currentUser, selectedVesselId } = useAuth();
  const { showToast } = useToast();
  const role = currentUser?.role as UserRole;
  const companyId = currentUser?.company_id || '';
  const showSalary = canSeeSalary(role);
  const canEdit = canEditCrew(role);

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

      let query = supabase.from('crew_members').select('*').eq('company_id', companyId).order('full_name');
      if (activeVessel !== 'all') {
        query = query.eq('vessel_id', activeVessel);
      }
      const { data, error } = await query;
      if (error) throw error;
      setCrew(data || []);

      const { data: compData } = await supabase.from('compliance_items')
        .select('crew_member_id, expiry_date')
        .eq('company_id', companyId)
        .not('crew_member_id', 'is', null);
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
        {canEdit && (
          <button onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> Add crew
          </button>
        )}
      </div>

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
