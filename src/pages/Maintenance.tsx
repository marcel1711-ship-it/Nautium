import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, CheckCircle2, Filter, Plus, Search,
  ChevronDown, Building2, Wand2, X, FileText, Loader2,
  AlertCircle, Anchor, Sofa, Settings, ChefHat, Shield,
  RefreshCw, Pin, Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, fetchByCompany, dbInsert, dbUpdate } from '../lib/supabase';
import { useToast } from '../components/UI/Toast';
import { Pagination } from '../components/UI/Pagination';
import { canCreate, UserRole } from '../types';
const PAGE_SIZE = 25;
import { calculateDaysUntilDue, formatDate, sortTasksByUrgency } from '../utils/helpers';
import { TaskDetail } from '../components/Maintenance/TaskDetail';
import { CompleteTaskModal } from '../components/Maintenance/CompleteTaskModal';
import { NewTaskModal } from '../components/Maintenance/NewTaskModal';
import { EditTaskModal } from '../components/Maintenance/EditTaskModal';
import { MaintenanceTask, MaintenanceHistory } from '../types';

interface MaintenanceProps {
  onNavigate: (page: string, params?: any) => void;
  params?: any;
  departmentFilter?: string;
}
interface VesselOption { id: string; name: string; }
interface EquipmentOption { id: string; name: string; vessel_id: string; equipment_hours?: number; }
interface UserOption { id: string; full_name: string; }
interface ManualOption { id: string; title: string; file_url: string; file_name: string; }
interface ExtractedTask {
  title: string; description: string; category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  interval_days: number; next_due_date: string;
  equipment_name?: string; isDuplicate?: boolean;
}

const DEPARTMENTS = [
  { value: 'all',         label: 'All',         icon: null,     activeColor: 'bg-gray-900 text-white border-gray-900', inactiveColor: 'bg-white text-gray-700 border-gray-200 hover:border-gray-400' },
  { value: 'Deck',        label: 'Deck',         icon: Anchor,   activeColor: 'bg-blue-600 text-white border-blue-600', inactiveColor: 'bg-white text-blue-700 border-blue-200 hover:border-blue-400' },
  { value: 'Interior',    label: 'Interior',     icon: Sofa,     activeColor: 'bg-purple-600 text-white border-purple-600', inactiveColor: 'bg-white text-purple-700 border-purple-200 hover:border-purple-400' },
  { value: 'Engineering', label: 'Engineering',  icon: Settings, activeColor: 'bg-orange-500 text-white border-orange-500', inactiveColor: 'bg-white text-orange-700 border-orange-200 hover:border-orange-400' },
  { value: 'Galley',      label: 'Galley',       icon: ChefHat,  activeColor: 'bg-green-600 text-white border-green-600', inactiveColor: 'bg-white text-green-700 border-green-200 hover:border-green-400' },
  { value: 'Safety',      label: 'Safety',       icon: Shield,   activeColor: 'bg-red-600 text-white border-red-600', inactiveColor: 'bg-white text-red-700 border-red-200 hover:border-red-400' },
];

// ── EXTRACT TASKS FROM MANUAL MODAL ────────────────────────────────────────
const ExtractTasksFromManualModal: React.FC<{
  companyId: string; onClose: () => void; onTasksCreated: () => void;
}> = ({ companyId, onClose, onTasksCreated }) => {
  const [step, setStep] = useState<'select' | 'preview' | 'done'>('select');
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [selectedVesselId, setSelectedVesselId] = useState('');
  const [manuals, setManuals] = useState<ManualOption[]>([]);
  const [selectedManualIds, setSelectedManualIds] = useState<string[]>([]);
  const [existingTasks, setExistingTasks] = useState<MaintenanceTask[]>([]);
  const [isLoadingVessels, setIsLoadingVessels] = useState(true);
  const [isLoadingManuals, setIsLoadingManuals] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [extractProgress, setExtractProgress] = useState('');
  const { showToast } = useToast();
  useEffect(() => { loadVessels(); }, []);
  useEffect(() => { if (selectedVesselId) loadManuals(); }, [selectedVesselId]);
  const loadVessels = async () => {
    setIsLoadingVessels(true);
    try {
      const vs = await fetchByCompany('vessels', companyId, 'name', true);
      setVessels(vs.map((v: any) => ({ id: v.id, name: v.name })));
      if (vs.length > 0) setSelectedVesselId(vs[0].id);
    } finally { setIsLoadingVessels(false); }
  };
  const loadManuals = async () => {
    setIsLoadingManuals(true);
    setSelectedManualIds([]);
    try {
      const { data } = await supabase.from('maintenance_manuals').select('id, title, file_url, file_name').eq('vessel_id', selectedVesselId).not('file_url', 'is', null);
      setManuals(data || []);
      const tasks = await fetchByCompany('maintenance_tasks', companyId, 'title', true);
      setExistingTasks(tasks.filter((t: any) => t.vessel_id === selectedVesselId));
    } finally { setIsLoadingManuals(false); }
  };
  const toggleManual = (id: string) => setSelectedManualIds(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  const handleExtract = async () => {
    if (selectedManualIds.length === 0) { setError('Please select at least one manual.'); return; }
    setError(null); setIsExtracting(true);
    const selectedManuals = manuals.filter(m => selectedManualIds.includes(m.id));
    let allExtracted: ExtractedTask[] = [];
    for (const manual of selectedManuals) {
      setExtractProgress(`Analyzing ${manual.title}...`);
      try {
        const apiResponse = await fetch('https://fsxjbgopxxbtidlkkafc.supabase.co/functions/v1/extract-from-manual', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdf_url: manual.file_url, extract_type: 'maintenance' }),
        });
        const data = await apiResponse.json();
        if (data.items && Array.isArray(data.items)) allExtracted = [...allExtracted, ...data.items];
      } catch { showToast(`Failed to extract tasks from ${manual.title}`, 'warning'); }
    }
    const seen = new Set<string>();
    const withDuplicates = allExtracted.map(item => {
      const key = item.title.toLowerCase();
      const existsInDB = existingTasks.some(t => t.title.toLowerCase().includes(item.title.toLowerCase()) || item.title.toLowerCase().includes(t.title.toLowerCase()));
      const existsInExtracted = seen.has(key);
      seen.add(key);
      return { ...item, isDuplicate: existsInDB || existsInExtracted };
    });
    setExtracted(withDuplicates); setIsExtracting(false); setExtractProgress(''); setStep('preview');
  };
  const handleSave = async () => {
    const toSave = extracted.filter(e => !e.isDuplicate);
    if (toSave.length === 0) { showToast('No new tasks to save', 'info'); onClose(); return; }
    setIsSaving(true);
    try {
      for (const task of toSave) {
        const dueDate = new Date(task.next_due_date);
        const today = new Date();
        const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const status = diffDays < 0 ? 'overdue' : diffDays <= 7 ? 'due_soon' : 'upcoming';
        await dbInsert('maintenance_tasks', {
          title: task.title, description: task.description, category: task.category, priority: task.priority,
          vessel_id: selectedVesselId, equipment_id: null, assigned_user_id: null,
          next_due_date: task.next_due_date, frequency: 'custom', custom_interval_days: task.interval_days,
          status, company_id: companyId, reminder_days_before: [], required_parts: [], checklist_items: [],
          is_recurring: true,
        });
      }
      showToast(`${toSave.length} maintenance task${toSave.length > 1 ? 's' : ''} created`, 'success');
      setStep('done'); onTasksCreated();
    } catch { showToast('Failed to save some tasks', 'error'); }
    finally { setIsSaving(false); }
  };
  const toggleDuplicate = (index: number) => setExtracted(prev => prev.map((item, i) => i === index ? { ...item, isDuplicate: !item.isDuplicate } : item));
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg"><Wand2 className="w-5 h-5 text-white" /></div>
            <div><h2 className="text-lg font-bold text-gray-900">Extract from Manual</h2><p className="text-xs text-gray-500">Nautius AI reads your manuals and generates maintenance tasks</p></div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="p-6 space-y-5">
          {step === 'select' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Vessel</label>
                {isLoadingVessels ? <div className="flex items-center gap-2 py-3"><Loader2 className="w-4 h-4 animate-spin text-blue-500" /><span className="text-sm text-gray-500">Loading vessels...</span></div>
                  : <select value={selectedVesselId} onChange={e => setSelectedVesselId(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">{vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Select manuals to analyze <span className="ml-2 text-xs font-normal text-gray-400">{selectedManualIds.length} selected</span></label>
                {isLoadingManuals ? <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
                  : manuals.length === 0 ? <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200"><FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-500 font-medium">No manuals found for this vessel</p></div>
                  : <div className="space-y-2 max-h-60 overflow-y-auto">{manuals.map(manual => (
                    <div key={manual.id} onClick={() => toggleManual(manual.id)} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedManualIds.includes(manual.id) ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${selectedManualIds.includes(manual.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>{selectedManualIds.includes(manual.id) && <CheckCircle2 className="w-3 h-3 text-white" />}</div>
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 truncate">{manual.title}</p><p className="text-xs text-gray-400 truncate">{manual.file_name}</p></div>
                    </div>
                  ))}</div>}
              </div>
              {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl"><AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" /><p className="text-sm text-red-700">{error}</p></div>}
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleExtract} disabled={isExtracting || selectedManualIds.length === 0} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                  {isExtracting ? <><Loader2 className="w-4 h-4 animate-spin" />{extractProgress || 'Analyzing...'}</> : <><Wand2 className="w-4 h-4" />Analyze {selectedManualIds.length} Manual{selectedManualIds.length !== 1 ? 's' : ''}</>}
                </button>
              </div>
            </>
          )}
          {step === 'preview' && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{extracted.filter(e => !e.isDuplicate).length} new tasks to create{extracted.filter(e => e.isDuplicate).length > 0 && <span className="ml-2 text-amber-600">· {extracted.filter(e => e.isDuplicate).length} already exist</span>}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Click duplicates to include them anyway</p>
                </div>
                <button onClick={() => setStep('select')} className="text-xs text-blue-600 hover:text-blue-700 font-medium">← Back</button>
              </div>
              {extracted.length === 0 ? <div className="text-center py-8 bg-gray-50 rounded-xl"><p className="text-sm text-gray-500">No maintenance tasks detected.</p></div>
                : <div className="space-y-2 max-h-80 overflow-y-auto">{extracted.map((task, i) => (
                  <div key={i} onClick={() => toggleDuplicate(i)} className={`p-4 rounded-xl border transition-all cursor-pointer ${task.isDuplicate ? 'bg-amber-50 border-amber-200 opacity-60' : 'bg-blue-50 border-blue-200'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 text-sm">{task.title}</p>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${task.priority === 'critical' ? 'bg-red-100 text-red-700' : task.priority === 'high' ? 'bg-orange-100 text-orange-700' : task.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{task.priority.toUpperCase()}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{task.category} · Every {task.interval_days} days</p>
                      </div>
                      <div className="flex-shrink-0">{task.isDuplicate ? <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-full">EXISTS</span> : <CheckCircle2 className="w-5 h-5 text-blue-500" />}</div>
                    </div>
                  </div>
                ))}</div>}
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={isSaving || extracted.filter(e => !e.isDuplicate).length === 0} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Creating tasks...</> : <><Plus className="w-4 h-4" />Create {extracted.filter(e => !e.isDuplicate).length} Tasks</>}
                </button>
              </div>
            </>
          )}
          {step === 'done' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-8 h-8 text-blue-500" /></div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Tasks created successfully</h3>
              <button onClick={onClose} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────
export const Maintenance: React.FC<MaintenanceProps> = ({ onNavigate, params, departmentFilter }) => {
  const { currentUser, selectedVesselId } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const companyId: string | undefined = params?.companyId;
  const companyName: string | undefined = params?.companyName;
  const role = currentUser?.role as UserRole;
  const userCanCreate = canCreate(role);
  const isDeptLocked = !!departmentFilter;
  const [selectedTask, setSelectedTask] = useState<string | null>(params?.taskId || null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>(departmentFilter || 'all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterVessel, setFilterVessel] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all'); // ← NEW: recurring / one-time filter
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [equipmentMap, setEquipmentMap] = useState<Record<string, EquipmentOption>>({});
  const [usersMap, setUsersMap] = useState<Record<string, UserOption>>({});
  const [loading, setLoading] = useState(true);
  const [lastCompletionMap, setLastCompletionMap] = useState<Record<string, MaintenanceHistory>>({});
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { loadData(); }, [currentUser, selectedVesselId, companyId]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    const effectiveCompanyId = companyId || currentUser.company_id || null;
    if (!effectiveCompanyId) { setLoading(false); return; }
    const [tasks, vessels, equipment, history] = await Promise.all([
      fetchByCompany('maintenance_tasks', effectiveCompanyId, 'next_due_date', true),
      fetchByCompany('vessels', effectiveCompanyId, 'name', true),
      fetchByCompany('equipment', effectiveCompanyId, 'name', true),
      fetchByCompany('maintenance_history', effectiveCompanyId, 'completion_date', false),
    ]);
    setVessels(vessels.map((v: any) => ({ id: v.id, name: v.name })));
    const eqMap: Record<string, EquipmentOption> = {};
    equipment.forEach((e: any) => { eqMap[e.id] = e; });
    setEquipmentMap(eqMap);
    const statusPriority: Record<string, number> = { overdue: 3, due_soon: 2, upcoming: 1, completed: 0 };
    const updatedTasks = tasks.map((task: any) => {
      if (task.status === 'completed') return task;

      // Time-based status
      let timeStatus = 'upcoming';
      if (task.next_due_date) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const dueDate = new Date(task.next_due_date);
        const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) timeStatus = 'overdue';
        else if (diffDays <= 7) timeStatus = 'due_soon';
      }

      // Hours-based status
      let hoursStatus = 'upcoming';
      if (task.next_due_hours && task.equipment_id) {
        const eq = eqMap[task.equipment_id];
        if (eq && eq.equipment_hours != null) {
          const currentHours = Number(eq.equipment_hours);
          const nextDueHours = Number(task.next_due_hours);
          const reminderBefore = Number(task.reminder_hours_before || 0);
          if (currentHours >= nextDueHours) hoursStatus = 'overdue';
          else if (reminderBefore > 0 && currentHours >= nextDueHours - reminderBefore) hoursStatus = 'due_soon';
        }
      }

      // Whichever is more urgent wins
      const finalStatus = (statusPriority[hoursStatus] || 0) >= (statusPriority[timeStatus] || 0) ? hoursStatus : timeStatus;
      if (finalStatus !== task.status) return { ...task, status: finalStatus };
      return task;
    });
    setTasks(updatedTasks);
    const lcMap: Record<string, MaintenanceHistory> = {};
    history.forEach((h: MaintenanceHistory) => { if (!lcMap[h.task_id!]) lcMap[h.task_id!] = h; });
    setLastCompletionMap(lcMap);
    setLoading(false);
  };

  const handleNewTask = async (taskData: any) => {
    if (!currentUser) return;
    const today = new Date();
    const dueDate = new Date(taskData.next_due_date);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const status = diffDays < 0 ? 'overdue' : diffDays <= 7 ? 'due_soon' : 'upcoming';
    const effectiveCompanyId = companyId || currentUser.company_id || null;
    try {
      const isHoursBased = taskData.interval_type === 'hours';
      await dbInsert('maintenance_tasks', {
        title: taskData.title, description: taskData.description, category: taskData.category, priority: taskData.priority,
        vessel_id: taskData.vessel_id, equipment_id: taskData.equipment_id || null, assigned_user_id: taskData.assigned_user_id || null,
        next_due_date: taskData.next_due_date,
        frequency: isHoursBased ? 'custom' : taskData.interval_type === 'months' ? 'monthly' : 'custom',
        custom_interval_days: taskData.interval_type === 'days' ? taskData.interval_value : null,
        hours_interval: isHoursBased ? taskData.interval_value : null,
        next_due_hours: isHoursBased ? taskData.interval_value : null,
        status, company_id: effectiveCompanyId, reminder_days_before: [],
        required_parts: taskData.required_parts || [], checklist_items: taskData.checklist_items || [],
        is_recurring: taskData.is_recurring ?? true,
        department: taskData.department || 'Engineering',
      });
      setShowNewTaskModal(false);
      showToast('Task created', 'success');
      loadData();
    } catch { showToast('Error creating task', 'error'); }
  };

  const handleComplete = async (completionData: any) => {
  if (!currentUser || !selectedTaskObj) return;

  // ── Fuente de verdad para company_id ──────────────────────────────────
  const effectiveCompanyId = selectedTaskObj.company_id || currentUser.company_id || '';

  try {
    // 1. Guardar en maintenance_history
    await dbInsert('maintenance_history', {
      task_id:              selectedTaskObj.id,
      vessel_id:            selectedTaskObj.vessel_id,
      company_id:           effectiveCompanyId,
      equipment_id:         selectedTaskObj.equipment_id || null,
      task_title:           selectedTaskObj.title,
      due_date:             selectedTaskObj.next_due_date,
      completion_date:      completionData.completion_date,
      completed_by_id:      currentUser.id,
      completed_by_name:    completionData.completed_by_name,
      completed_by_email:   completionData.completed_by_email,
      comments:             completionData.comments,
      photos:               completionData.photos,
      parts_used:           completionData.parts_used,
      issues_detected:      completionData.issues_detected,
      external_service_cost: completionData.external_service_cost ?? null,
    });

    // 2. Actualizar tarea — reschedule si es recurrente
    const completionDate = completionData.completion_date || new Date().toISOString().split('T')[0];
    const isRecurring = (selectedTaskObj as any).is_recurring !== false;
    const intervalDays = (selectedTaskObj as any).custom_interval_days;
    const frequency = (selectedTaskObj as any).frequency;

    if (isRecurring && (intervalDays || frequency)) {
      let daysToAdd = intervalDays || 30;
      if (!intervalDays && frequency) {
        const freqMap: Record<string, number> = {
          daily: 1, weekly: 7, monthly: 30, quarterly: 90,
          semi_annual: 180, annual: 365,
        };
        daysToAdd = freqMap[frequency] || 30;
      }
      const nextDate = new Date(completionDate);
      nextDate.setDate(nextDate.getDate() + daysToAdd);
      const nextDueStr = nextDate.toISOString().split('T')[0];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const nextStatus = diffDays < 0 ? 'overdue' : diffDays <= 7 ? 'due_soon' : 'upcoming';

      const hoursUpdate: Record<string, any> = {
        status: nextStatus,
        last_completed_date: completionDate,
        next_due_date: nextDueStr,
      };
      if ((selectedTaskObj as any).hours_interval && selectedTaskObj.equipment_id) {
        const eq = equipmentMap[selectedTaskObj.equipment_id];
        const currentHours = Number((eq as any)?.equipment_hours || 0);
        hoursUpdate.last_hours_reading = currentHours;
        hoursUpdate.next_due_hours = currentHours + Number((selectedTaskObj as any).hours_interval);
      }
      await dbUpdate('maintenance_tasks', selectedTaskObj.id, hoursUpdate);
    } else {
      await dbUpdate('maintenance_tasks', selectedTaskObj.id, {
        status: 'completed',
        last_completed_date: completionDate,
      });
    }

    // 3. Descontar stock — UNA sola query antes del loop
    const partsUsed: { inventory_id: string; quantity: number; name: string }[] =
      completionData.parts_used || [];

    if (partsUsed.length > 0) {
      // ✅ fetch FUERA del loop — no dentro
      const allItems = await fetchByCompany('inventory_items', effectiveCompanyId, 'name', true);

      for (const part of partsUsed) {
        if (!part.inventory_id || part.quantity <= 0) continue;

        const invData = allItems.find((i: any) => i.id === part.inventory_id);
        if (!invData) {
          console.warn(`[handleComplete] Part not found in inventory: ${part.inventory_id}`);
          continue;
        }

        const newStock = Math.max(0, invData.current_stock - part.quantity);

        // Descontar stock
        await dbUpdate('inventory_items', part.inventory_id, {
          current_stock: newStock,
        });

        // Registrar movimiento
        await dbInsert('stock_movements', {
          inventory_id:       part.inventory_id,
          vessel_id:          selectedTaskObj.vessel_id,
          movement_type:      'out',
          quantity:           part.quantity,
          reason:             'Used in maintenance',
          reference_id:       selectedTaskObj.id,
          performed_by_id:    currentUser.id,
          performed_by_name:  currentUser.full_name,
        });
      }
    }

    setShowCompleteModal(false);
    setSelectedTask(null);
    showToast('Task marked as complete', 'success');
    loadData();

  } catch (err) {
    // ✅ Ya no silencia errores — el usuario se entera si algo falla
    console.error('[handleComplete] Error:', err);
    showToast('Error completing task — please try again', 'error');
  }
};

  const getFilteredTasks = () => {
    let filtered = tasks;
    if (filterDepartment !== 'all') filtered = filtered.filter(t => (t as any).department === filterDepartment);
    if (filterStatus !== 'all') filtered = filtered.filter(t => t.status === filterStatus);
    if (filterPriority !== 'all') filtered = filtered.filter(t => t.priority === filterPriority);
    if (filterCategory !== 'all') filtered = filtered.filter(t => t.category === filterCategory);
    if (filterVessel !== 'all') filtered = filtered.filter(t => t.vessel_id === filterVessel);
    // ← NEW: filter by type
    if (filterType === 'recurring') filtered = filtered.filter(t => (t as any).is_recurring !== false);
    if (filterType === 'one_time') filtered = filtered.filter(t => (t as any).is_recurring === false);
    if (searchTerm) filtered = filtered.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()) || t.category.toLowerCase().includes(searchTerm.toLowerCase()));
    return sortTasksByUrgency(filtered);
  };

  const filteredTasks = getFilteredTasks();
  const totalPages = Math.ceil(filteredTasks.length / PAGE_SIZE);
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const categories = Array.from(new Set(tasks.map(t => t.category)));
  const selectedTaskObj = selectedTask ? tasks.find(t => t.id === selectedTask) || null : null;
  const effectiveCompanyId = companyId || currentUser?.company_id || '';
  const deptCounts = DEPARTMENTS.filter(d => d.value !== 'all').reduce((acc, d) => {
    acc[d.value] = tasks.filter(t => (t as any).department === d.value).length;
    return acc;
  }, {} as Record<string, number>);

  if (selectedTaskObj) {
    return (
      <>
        <TaskDetail
          task={selectedTaskObj} equipmentMap={equipmentMap}
          vesselMap={Object.fromEntries(vessels.map(v => [v.id, v]))}
          usersMap={usersMap} lastCompletion={lastCompletionMap[selectedTaskObj.id] || null}
          onBack={() => setSelectedTask(null)} onComplete={() => setShowCompleteModal(true)} onEdit={() => setShowEditModal(true)}
        />
        {showCompleteModal && <CompleteTaskModal task={selectedTaskObj} onClose={() => setShowCompleteModal(false)} onComplete={handleComplete} />}
        {showEditModal && <EditTaskModal task={selectedTaskObj} onClose={() => setShowEditModal(false)} onSaved={() => { setShowEditModal(false); showToast('Task updated', 'success'); loadData(); }} />}
      </>
    );
  }

  return (
    <div className="space-y-8">
      {companyId && (
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('customers')} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
            <Building2 className="w-4 h-4" />Back to Customers
          </button>
          <span className="text-gray-400">/</span>
          <span className="text-sm font-medium text-gray-900">{companyName || 'Customer'} — Maintenance</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            {companyId && companyName ? `${companyName} — ${t('maintenance.title')}` : t('maintenance.title')}
            {isDeptLocked && <span className="ml-3 text-lg font-semibold text-blue-600">· {departmentFilter}</span>}
          </h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">{t('maintenance.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {currentUser?.role === 'master_admin' && (
            <button onClick={() => setShowExtractModal(true)} className="flex items-center gap-2 px-4 py-3 border border-blue-300 text-blue-700 bg-blue-50 rounded-xl font-semibold hover:bg-blue-100 transition-all shrink-0">
              <Wand2 className="w-4 h-4" />Extract from Manual
            </button>
          )}
          {userCanCreate && (
            <button onClick={() => setShowNewTaskModal(true)} className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl shrink-0">
              <Plus className="w-5 h-5" />{t('maintenance.newTask')}
            </button>
          )}
        </div>
      </div>

      {/* Department filter pills */}
      {!isDeptLocked && (
        <div className="flex flex-wrap gap-2">
          {DEPARTMENTS.map(dept => {
            const Icon = dept.icon;
            const count = dept.value === 'all' ? tasks.length : deptCounts[dept.value] || 0;
            const isActive = filterDepartment === dept.value;
            return (
              <button key={dept.value} onClick={() => { setFilterDepartment(dept.value); setCurrentPage(1); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-sm transition-all ${isActive ? dept.activeColor : dept.inactiveColor}`}>
                {Icon && <Icon className="w-4 h-4" />}
                {dept.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/20' : 'bg-gray-100'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {showNewTaskModal && <NewTaskModal onClose={() => setShowNewTaskModal(false)} onSave={handleNewTask} />}

      <div className="bg-white rounded-2xl border border-gray-200 p-7">
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-bold text-gray-900">{t('common.filters')}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-7">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={t('maintenance.search')}
              className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
          </div>
          {/* ← NEW: Type filter */}
          <div className="relative">
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
              className="w-full appearance-none px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white">
              <option value="all">All types</option>
              <option value="recurring">🔄 Recurring</option>
              <option value="one_time">📌 One-time</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full appearance-none px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white">
              <option value="all">{t('maintenance.allStatus')}</option>
              <option value="overdue">{t('maintenance.overdue')}</option>
              <option value="due_soon">{t('maintenance.dueSoon')}</option>
              <option value="upcoming">{t('maintenance.upcoming')}</option>
              <option value="completed">{t('maintenance.completed')}</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="w-full appearance-none px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white">
              <option value="all">{t('maintenance.allPriorities')}</option>
              <option value="critical">{t('common.critical')}</option>
              <option value="high">{t('common.high')}</option>
              <option value="medium">{t('common.medium')}</option>
              <option value="low">{t('common.low')}</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={filterVessel} onChange={e => setFilterVessel(e.target.value)} className="w-full appearance-none px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white">
              <option value="all">{t('maintenance.allVessels')}</option>
              {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">
            {t('maintenance.showing')} <span className="font-semibold text-gray-900">{filteredTasks.length}</span> {filteredTasks.length === 1 ? t('maintenance.task') : t('maintenance.tasks')}
            {filterDepartment !== 'all' && <span className="ml-2 text-blue-600 font-medium">· {filterDepartment}</span>}
            {filterType !== 'all' && <span className="ml-2 text-gray-500 font-medium">· {filterType === 'recurring' ? '🔄 Recurring' : '📌 One-time'}</span>}
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />)}</div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">{t('maintenance.notFound')}</p>
              </div>
            ) : (
              paginatedTasks.map(task => {
                const daysUntil = calculateDaysUntilDue(task.next_due_date);
                const equipment = equipmentMap[task.equipment_id];
                const vessel = vessels.find(v => v.id === task.vessel_id);
                const assignedUser = usersMap[task.assigned_user_id];
                const dept = (task as any).department || 'Engineering';
                const isRecurring = (task as any).is_recurring !== false;
                const deptBadge: Record<string, string> = { Deck: 'bg-blue-100 text-blue-700', Interior: 'bg-purple-100 text-purple-700', Engineering: 'bg-orange-100 text-orange-700', Galley: 'bg-green-100 text-green-700', Safety: 'bg-red-100 text-red-700' };
                const rowBg = task.status === 'overdue' ? 'bg-red-50 border border-red-200' : task.status === 'due_soon' ? 'bg-amber-50 border border-amber-200' : task.status === 'completed' ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-transparent hover:border-gray-200';
                const statusPill = task.status === 'overdue' ? 'bg-red-100 text-red-700' : task.status === 'due_soon' ? 'bg-amber-100 text-amber-700' : task.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700';
                const priorityPill = task.priority === 'critical' ? 'bg-red-100 text-red-700' : task.priority === 'high' ? 'bg-orange-100 text-orange-700' : task.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600';
                const dot = task.status === 'overdue' ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]' : task.status === 'due_soon' ? 'bg-amber-500' : task.status === 'completed' ? 'bg-green-500' : 'bg-blue-500';
                return (
                  <div key={task.id} onClick={() => setSelectedTask(task.id)} className={`p-4 rounded-xl hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5 ${rowBg}`}>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words">{task.title}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 leading-5 ${statusPill}`}>{task.status.replace('_', ' ').toUpperCase()}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 leading-5 ${priorityPill}`}>{task.priority.toUpperCase()}</span>
                          {/* ← NEW: Recurring / One-time badge */}
                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 leading-5 ${isRecurring ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                            {isRecurring ? <RefreshCw className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                            {isRecurring ? 'Recurring' : 'One-time'}
                          </span>
                          {filterDepartment === 'all' && !isDeptLocked && <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 leading-5 ${deptBadge[dept] || 'bg-gray-100 text-gray-600'}`}>{dept}</span>}
                        </div>
                        <p className="text-sm text-gray-500 mb-3">{task.category}</p>
                        <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                          {equipment && <div className="flex items-center gap-1"><span className="font-semibold text-gray-700">{t('maintenance.equipmentLabel')}</span><span>{equipment.name}</span></div>}
                          {vessel && <div className="flex items-center gap-1"><span className="font-semibold text-gray-700">{t('maintenance.vesselLabel')}</span><span>{vessel.name}</span></div>}
                          {assignedUser && <div className="flex items-center gap-1"><span className="font-semibold text-gray-700">{t('maintenance.assignedLabel')}</span><span>{assignedUser.full_name}</span></div>}
                          {(task as any).hours_interval && (
                            <div className="flex items-center gap-1 text-blue-600">
                              <Clock className="w-3.5 h-3.5" />
                              <span className="font-semibold">Every {Number((task as any).hours_interval).toLocaleString()} hrs</span>
                              {(task as any).next_due_hours && equipment && (equipment as any).equipment_hours != null && (
                                <span className={`ml-1 ${Number((equipment as any).equipment_hours) >= Number((task as any).next_due_hours) ? 'text-red-600 font-bold' : ''}`}>
                                  ({Number((equipment as any).equipment_hours).toLocaleString()} / {Number((task as any).next_due_hours).toLocaleString()} hrs)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex sm:flex-col sm:text-right items-center sm:items-end gap-3 sm:gap-0 sm:ml-6 shrink-0">
                        <div className={`text-base sm:text-lg font-bold ${task.status === 'overdue' ? 'text-red-600' : task.status === 'due_soon' ? 'text-amber-600' : 'text-blue-600'}`}>
                          {task.status === 'overdue' ? `${Math.abs(daysUntil)} ${t('maintenance.dOverdue')}` : `${daysUntil}d`}
                        </div>
                        <p className="text-sm text-gray-400 sm:mt-1">{formatDate(task.next_due_date)}</p>
                        {task.status === 'overdue' && <div className="sm:mt-2 flex items-center gap-1 text-red-600"><AlertTriangle className="w-4 h-4" /><span className="text-xs font-semibold">{t('maintenance.urgent')}</span></div>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
        <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredTasks.length} pageSize={PAGE_SIZE}
          onPageChange={page => { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
      </div>
      {showExtractModal && <ExtractTasksFromManualModal companyId={effectiveCompanyId} onClose={() => setShowExtractModal(false)} onTasksCreated={loadData} />}
    </div>
  );
};
