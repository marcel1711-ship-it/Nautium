import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FolderKanban, Plus, Search, Calendar, MapPin, DollarSign,
  ChevronLeft, Clock, CheckCircle2, XCircle, AlertTriangle,
  Wrench, Snowflake, Ship, Anchor, Settings2, Filter,
  ClipboardList, Receipt, BarChart3, Edit2, Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchByCompany, fetchFiltered, dbInsert, dbUpdate, dbDelete } from '../lib/supabase';
import { useToast } from '../components/UI/Toast';
import { ConfirmModal } from '../components/UI/ConfirmModal';
import { UserRole, FULL_ACCESS_ROLES } from '../types';

interface ProjectsProps {
  onNavigate: (page: string, params?: any) => void;
}

interface Project {
  id: string;
  company_id: string;
  vessel_id: string;
  name: string;
  project_type: ProjectType;
  status: ProjectStatus;
  budget_amount: number;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type ProjectType = 'dry_dock' | 'winterizing' | 'refit' | 'survey' | 'custom';
type ProjectStatus = 'planning' | 'in_progress' | 'completed' | 'cancelled';

const PROJECT_TYPES: { value: ProjectType; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'dry_dock',    label: 'Dry Dock',    icon: Anchor,    color: 'text-blue-600 bg-blue-50' },
  { value: 'winterizing', label: 'Winterizing',  icon: Snowflake, color: 'text-cyan-600 bg-cyan-50' },
  { value: 'refit',       label: 'Refit',        icon: Wrench,    color: 'text-orange-600 bg-orange-50' },
  { value: 'survey',      label: 'Survey',       icon: ClipboardList, color: 'text-purple-600 bg-purple-50' },
  { value: 'custom',      label: 'Custom',       icon: Settings2, color: 'text-gray-600 bg-gray-100' },
];

const STATUS_CONFIG: Record<ProjectStatus, { label: string; icon: React.ElementType; dot: string; bg: string; text: string }> = {
  planning:    { label: 'Planning',    icon: Clock,        dot: 'bg-amber-500',   bg: 'bg-amber-50',   text: 'text-amber-700' },
  in_progress: { label: 'In Progress', icon: AlertTriangle, dot: 'bg-blue-500',   bg: 'bg-blue-50',    text: 'text-blue-700' },
  completed:   { label: 'Completed',   icon: CheckCircle2, dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  cancelled:   { label: 'Cancelled',   icon: XCircle,      dot: 'bg-red-400',     bg: 'bg-red-50',     text: 'text-red-700' },
};

const fmtCurrency = (v: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const canManageProjects = (role: UserRole) =>
  ['master_admin', 'customer_admin', 'fleet_manager', 'captain'].includes(role);

type ViewMode = 'list' | 'detail';
type DetailTab = 'overview' | 'tasks' | 'expenses';

export const Projects: React.FC<ProjectsProps> = ({ onNavigate }) => {
  const { currentUser, selectedVesselId } = useAuth();
  const { showToast } = useToast();
  const role = currentUser?.role as UserRole;
  const companyId = currentUser?.company_id || '';
  const canManage = canManageProjects(role);

  const [projects, setProjects] = useState<Project[]>([]);
  const [vessels, setVessels] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const [view, setView] = useState<ViewMode>('list');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');

  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);

  const [tasks, setTasks] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<ProjectType>('dry_dock');
  const [formVessel, setFormVessel] = useState('');
  const [formBudget, setFormBudget] = useState('');
  const [formCurrency, setFormCurrency] = useState('USD');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<ProjectStatus>('planning');

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const filters: any[] = [];
      if (selectedVesselId && selectedVesselId !== 'all') {
        filters.push({ field: 'vessel_id', op: 'eq' as const, value: selectedVesselId });
      }
      const [projData, vesselData] = await Promise.all([
        filters.length > 0
          ? fetchFiltered('projects', companyId, filters)
          : fetchByCompany('projects', companyId, 'created_at', false),
        fetchByCompany('vessels', companyId, 'name'),
      ]);
      setProjects(projData || []);
      setVessels((vesselData || []).map((v: any) => ({ id: v.id, name: v.name })));
    } catch (err) {
      showToast('Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedVesselId]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadProjectDetail = useCallback(async (project: Project) => {
    setLoadingDetail(true);
    try {
      const [taskData, expData] = await Promise.all([
        fetchFiltered('maintenance_tasks', companyId, [
          { field: 'project_id', op: 'eq' as const, value: project.id },
        ]),
        fetchFiltered('operational_expenses', companyId, [
          { field: 'project_id', op: 'eq' as const, value: project.id },
        ]),
      ]);
      setTasks(taskData || []);
      setExpenses(expData || []);
    } catch {
      showToast('Failed to load project details', 'error');
    } finally {
      setLoadingDetail(false);
    }
  }, [companyId]);

  const filtered = useMemo(() => {
    let result = projects;
    if (statusFilter !== 'all') result = result.filter(p => p.status === statusFilter);
    if (typeFilter !== 'all') result = result.filter(p => p.project_type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [projects, statusFilter, typeFilter, search]);

  const openCreate = () => {
    setEditingProject(null);
    setFormName('');
    setFormType('dry_dock');
    setFormVessel(selectedVesselId && selectedVesselId !== 'all' ? selectedVesselId : (vessels[0]?.id || ''));
    setFormBudget('');
    setFormCurrency('USD');
    setFormStartDate('');
    setFormEndDate('');
    setFormLocation('');
    setFormNotes('');
    setFormStatus('planning');
    setShowModal(true);
  };

  const openEdit = (p: Project) => {
    setEditingProject(p);
    setFormName(p.name);
    setFormType(p.project_type);
    setFormVessel(p.vessel_id);
    setFormBudget(String(p.budget_amount || ''));
    setFormCurrency(p.currency);
    setFormStartDate(p.start_date || '');
    setFormEndDate(p.end_date || '');
    setFormLocation(p.location || '');
    setFormNotes(p.notes || '');
    setFormStatus(p.status);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { showToast('Project name is required', 'error'); return; }
    if (!formVessel) { showToast('Please select a vessel', 'error'); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        company_id: companyId,
        vessel_id: formVessel,
        name: formName.trim(),
        project_type: formType,
        status: formStatus,
        budget_amount: parseFloat(formBudget) || 0,
        currency: formCurrency,
        start_date: formStartDate || null,
        end_date: formEndDate || null,
        location: formLocation.trim() || null,
        notes: formNotes.trim() || null,
      };
      if (editingProject) {
        await dbUpdate('projects', editingProject.id, payload);
        showToast('Project updated', 'success');
        if (selectedProject?.id === editingProject.id) {
          setSelectedProject({ ...editingProject, ...payload } as Project);
        }
      } else {
        payload.created_by = currentUser?.id || null;
        await dbInsert('projects', payload);
        showToast('Project created', 'success');
      }
      setShowModal(false);
      loadData();
    } catch {
      showToast('Failed to save project', 'error');
    } finally {
      setSaving(false);
    }
  };

  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  const handleDelete = async (p: Project) => {
    try {
      await dbDelete('projects', p.id);
      showToast('Project deleted', 'success');
      setDeletingProject(null);
      if (selectedProject?.id === p.id) {
        setView('list');
        setSelectedProject(null);
      }
      loadData();
    } catch {
      showToast('Failed to delete project', 'error');
    }
  };

  const openDetail = (p: Project) => {
    setSelectedProject(p);
    setDetailTab('overview');
    setView('detail');
    loadProjectDetail(p);
  };

  const vesselName = (vid: string) => vessels.find(v => v.id === vid)?.name || 'Unknown';

  const getTypeConfig = (t: ProjectType) => PROJECT_TYPES.find(pt => pt.value === t) || PROJECT_TYPES[4];

  const totalSpent = useMemo(() => {
    return expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  }, [expenses]);

  // ── LIST VIEW ────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <FolderKanban className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
              <p className="text-sm text-gray-500">Dry dock, winterizing, refits & more</p>
            </div>
          </div>
          {canManage && (
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm">
              <Plus className="w-4 h-4" /> New Project
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Types</option>
            {PROJECT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Projects', value: projects.length, color: 'text-indigo-600' },
            { label: 'In Progress', value: projects.filter(p => p.status === 'in_progress').length, color: 'text-blue-600' },
            { label: 'Planning', value: projects.filter(p => p.status === 'planning').length, color: 'text-amber-600' },
            { label: 'Completed', value: projects.filter(p => p.status === 'completed').length, color: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Project list */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <FolderKanban className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No projects found</p>
            <p className="text-sm text-gray-400 mt-1">
              {projects.length === 0 ? 'Create your first project to get started' : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map(p => {
              const typeConf = getTypeConfig(p.project_type);
              const TypeIcon = typeConf.icon;
              const sc = STATUS_CONFIG[p.status];
              return (
                <div
                  key={p.id}
                  onClick={() => openDetail(p)}
                  className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${typeConf.color}`}>
                      <TypeIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1"><Ship className="w-3.5 h-3.5" /> {vesselName(p.vessel_id)}</span>
                        {p.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {p.location}</span>}
                        {p.start_date && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {fmtDate(p.start_date)}{p.end_date ? ` – ${fmtDate(p.end_date)}` : ''}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-gray-500">Budget</p>
                      <p className="text-lg font-bold text-gray-900">{fmtCurrency(p.budget_amount, p.currency)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">{editingProject ? 'Edit Project' : 'New Project'}</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                  <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. 2026 Dry Dock" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select value={formType} onChange={e => setFormType(e.target.value as ProjectType)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                      {PROJECT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={formStatus} onChange={e => setFormStatus(e.target.value as ProjectStatus)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vessel *</label>
                  <select value={formVessel} onChange={e => setFormVessel(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select vessel</option>
                    {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
                    <input type="number" value={formBudget} onChange={e => setFormBudget(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                    <select value={formCurrency} onChange={e => setFormCurrency(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input type="text" value={formLocation} onChange={e => setFormLocation(e.target.value)} placeholder="e.g. Barcelona, Spain" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} placeholder="Additional details..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50">
                  {saving ? 'Saving...' : editingProject ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── DETAIL VIEW ──────────────────────────────────────────────────────
  if (!selectedProject) return null;

  const typeConf = getTypeConfig(selectedProject.project_type);
  const TypeIcon = typeConf.icon;
  const sc = STATUS_CONFIG[selectedProject.status];
  const budgetPct = selectedProject.budget_amount > 0
    ? Math.min(100, Math.round((totalSpent / selectedProject.budget_amount) * 100))
    : 0;
  const budgetBarColor = budgetPct > 90 ? 'bg-red-500' : budgetPct > 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button onClick={() => { setView('list'); setSelectedProject(null); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeConf.color}`}>
          <TypeIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">{selectedProject.name}</h1>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
              {sc.label}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            {vesselName(selectedProject.vessel_id)}
            {selectedProject.location && ` · ${selectedProject.location}`}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button onClick={() => openEdit(selectedProject)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Edit">
              <Edit2 className="w-4 h-4 text-gray-500" />
            </button>
            <button onClick={() => setDeletingProject(selectedProject)} className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          </div>
        )}
      </div>

      {/* Budget bar */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Budget Progress</span>
          <span className="text-sm text-gray-500">
            {fmtCurrency(totalSpent, selectedProject.currency)} / {fmtCurrency(selectedProject.budget_amount, selectedProject.currency)}
          </span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${budgetBarColor}`} style={{ width: `${budgetPct}%` }} />
        </div>
        <p className="text-xs text-gray-400 mt-1">{budgetPct}% used</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['overview', 'tasks', 'expenses'] as DetailTab[]).map(t => (
          <button
            key={t}
            onClick={() => setDetailTab(t)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              detailTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'overview' && <BarChart3 className="w-4 h-4" />}
            {t === 'tasks' && <ClipboardList className="w-4 h-4" />}
            {t === 'expenses' && <Receipt className="w-4 h-4" />}
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'tasks' && <span className="ml-1 px-1.5 py-0.5 bg-gray-200 rounded text-xs">{tasks.length}</span>}
            {t === 'expenses' && <span className="ml-1 px-1.5 py-0.5 bg-gray-200 rounded text-xs">{expenses.length}</span>}
          </button>
        ))}
      </div>

      {loadingDetail ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Overview */}
          {detailTab === 'overview' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium">{typeConf.label}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Vessel</span><span className="font-medium">{vesselName(selectedProject.vessel_id)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Start Date</span><span className="font-medium">{fmtDate(selectedProject.start_date)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">End Date</span><span className="font-medium">{fmtDate(selectedProject.end_date)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Location</span><span className="font-medium">{selectedProject.location || '—'}</span></div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-700">{tasks.length}</p>
                    <p className="text-xs text-blue-600">Tasks</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-700">{tasks.filter((t: any) => t.status === 'completed').length}</p>
                    <p className="text-xs text-green-600">Completed</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-700">{expenses.length}</p>
                    <p className="text-xs text-purple-600">Expenses</p>
                  </div>
                  <div className="text-center p-3 bg-amber-50 rounded-lg">
                    <p className="text-2xl font-bold text-amber-700">{fmtCurrency(totalSpent, selectedProject.currency)}</p>
                    <p className="text-xs text-amber-600">Total Spent</p>
                  </div>
                </div>
                {selectedProject.notes && (
                  <div>
                    <h4 className="text-xs text-gray-500 font-medium mb-1">Notes</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedProject.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tasks */}
          {detailTab === 'tasks' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{tasks.length} task{tasks.length !== 1 ? 's' : ''} linked to this project</p>
                {canManage && (
                  <button
                    onClick={() => onNavigate('maintenance', { project_id: selectedProject.id })}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    + Add from Maintenance
                  </button>
                )}
              </div>
              {tasks.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                  <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No tasks linked yet</p>
                  <p className="text-gray-400 text-xs mt-1">Assign tasks from the Maintenance page</p>
                </div>
              ) : (
                tasks.map((t: any) => (
                  <div key={t.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      t.status === 'completed' ? 'bg-emerald-500' :
                      t.status === 'in_progress' ? 'bg-blue-500' :
                      t.status === 'overdue' ? 'bg-red-500' : 'bg-gray-300'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                      <p className="text-xs text-gray-500">{t.department || 'Unbudgeted'} · {t.priority || 'medium'} priority</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      t.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                      t.status === 'in_progress' ? 'bg-blue-50 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{(t.status || 'pending').replace('_', ' ')}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Expenses */}
          {detailTab === 'expenses' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{expenses.length} expense{expenses.length !== 1 ? 's' : ''} · Total: {fmtCurrency(totalSpent, selectedProject.currency)}</p>
                {canManage && (
                  <button
                    onClick={() => onNavigate('costs', { project_id: selectedProject.id })}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    + Add from Costs
                  </button>
                )}
              </div>
              {expenses.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                  <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No expenses linked yet</p>
                  <p className="text-gray-400 text-xs mt-1">Assign expenses from the Costs page</p>
                </div>
              ) : (
                expenses.map((e: any) => (
                  <div key={e.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                      <DollarSign className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{e.description || 'Expense'}</p>
                      <p className="text-xs text-gray-500">
                        {(e.department === 'General' ? 'Unbudgeted' : e.department) || 'Unbudgeted'}
                        {e.expense_date && ` · ${fmtDate(e.expense_date)}`}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{fmtCurrency(Number(e.amount || 0), e.currency || selectedProject.currency)}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {deletingProject && (
        <ConfirmModal
          title="Delete Project"
          message={`Delete "${deletingProject.name}"? Tasks and expenses linked to it will be unlinked, not deleted.`}
          onConfirm={() => handleDelete(deletingProject)}
          onCancel={() => setDeletingProject(null)}
        />
      )}

      {/* Modal for edit from detail view */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editingProject ? 'Edit Project' : 'New Project'}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. 2026 Dry Dock" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={formType} onChange={e => setFormType(e.target.value as ProjectType)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                    {PROJECT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={formStatus} onChange={e => setFormStatus(e.target.value as ProjectStatus)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vessel *</label>
                <select value={formVessel} onChange={e => setFormVessel(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select vessel</option>
                  {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
                  <input type="number" value={formBudget} onChange={e => setFormBudget(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select value={formCurrency} onChange={e => setFormCurrency(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input type="text" value={formLocation} onChange={e => setFormLocation(e.target.value)} placeholder="e.g. Barcelona, Spain" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} placeholder="Additional details..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : editingProject ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
