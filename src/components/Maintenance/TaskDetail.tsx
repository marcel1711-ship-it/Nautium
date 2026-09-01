import React, { useState } from 'react';
import {
  ArrowLeft, User, Wrench, FileText, CheckSquare,
  Package, AlertCircle, Pencil, Image, X, ChevronLeft, ChevronRight,
  Check, Trash2, Anchor, Sofa, Settings, ChefHat, Shield,
  RefreshCw, Pin, Clock
} from 'lucide-react';
import { MaintenanceTask, MaintenanceHistory } from '../../types';
import { formatDate, calculateDaysUntilDue, getTaskStatusColor, getPriorityColor } from '../../utils/helpers';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../UI/Toast';

interface TaskDetailProps {
  task: MaintenanceTask;
  onBack: () => void;
  onComplete: () => void;
  onEdit?: () => void;
  onDeleted?: () => void;
  equipmentMap?: Record<string, { id: string; name: string; type?: string; vessel_id: string }>;
  vesselMap?: Record<string, { id: string; name: string; type?: string }>;
  usersMap?: Record<string, { id: string; full_name: string; email?: string }>;
  lastCompletion?: MaintenanceHistory | null;
}

const DEPT_STYLES: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  Deck:        { color: 'text-blue-700',   bg: 'bg-blue-100',   icon: Anchor },
  Interior:    { color: 'text-purple-700', bg: 'bg-purple-100', icon: Sofa },
  Engineering: { color: 'text-orange-700', bg: 'bg-orange-100', icon: Settings },
  Galley:      { color: 'text-green-700',  bg: 'bg-green-100',  icon: ChefHat },
  Safety:      { color: 'text-red-700',    bg: 'bg-red-100',    icon: Shield },
};

export const TaskDetail: React.FC<TaskDetailProps> = ({
  task, onBack, onComplete, onEdit, onDeleted,
  equipmentMap = {}, vesselMap = {}, usersMap = {}, lastCompletion = null,
}) => {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const equipment = equipmentMap[task.equipment_id];
  const vessel = vesselMap[task.vessel_id];
  const assignedUser = usersMap[task.assigned_user_id];
  const daysUntil = calculateDaysUntilDue(task.next_due_date);
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const canDelete = currentUser?.role === 'master_admin' || currentUser?.role === 'customer_admin';
  const dept = (task as any).department || 'Engineering';
  const deptStyle = DEPT_STYLES[dept] || { color: 'text-gray-700', bg: 'bg-gray-100', icon: Settings };
  const DeptIcon = deptStyle.icon;
  const isRecurring = (task as any).is_recurring !== false;

  const toggleCheck = (index: number) => setCheckedItems(prev => ({ ...prev, [index]: !prev[index] }));
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalItems = task.checklist_items?.length || 0;
  const completionPct = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;
  const completionPhotos = lastCompletion?.photos || [];
  const taskPhotos = task.photos || [];

  const openLightbox = (photos: string[], index: number) => setLightbox({ photos, index });
  const closeLightbox = () => setLightbox(null);
  const lightboxPrev = () => setLightbox(lb => lb ? { ...lb, index: (lb.index - 1 + lb.photos.length) % lb.photos.length } : null);
  const lightboxNext = () => setLightbox(lb => lb ? { ...lb, index: (lb.index + 1) % lb.photos.length } : null);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await supabase.from('maintenance_tasks').delete().eq('id', task.id);
      showToast('Task deleted', 'success');
      onDeleted ? onDeleted() : onBack();
    } catch { setIsDeleting(false); setConfirmDelete(false); }
  };

  return (
    <div className="space-y-6">
      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={closeLightbox}>
          <button onClick={closeLightbox} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><X className="w-6 h-6 text-white" /></button>
          {lightbox.photos.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); lightboxPrev(); }} className="absolute left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><ChevronLeft className="w-6 h-6 text-white" /></button>
              <button onClick={e => { e.stopPropagation(); lightboxNext(); }} className="absolute right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><ChevronRight className="w-6 h-6 text-white" /></button>
            </>
          )}
          <img src={lightbox.photos[lightbox.index]} alt={`Photo ${lightbox.index + 1}`} className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl" onClick={e => e.stopPropagation()} />
          {lightbox.photos.length > 1 && (
            <div className="absolute bottom-4 flex gap-2">
              {lightbox.photos.map((_, i) => (
                <button key={i} onClick={e => { e.stopPropagation(); setLightbox(lb => lb ? { ...lb, index: i } : null); }}
                  className={`w-2 h-2 rounded-full transition-colors ${i === lightbox.index ? 'bg-white' : 'bg-white/40'}`} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center"><Trash2 className="w-5 h-5 text-red-600" /></div>
              <h3 className="text-lg font-bold text-gray-900">Delete Task</h3>
            </div>
            <p className="text-gray-600 mb-6">Are you sure you want to delete <strong>"{task.title}"</strong>? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} disabled={isDeleting} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={isDeleting} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">
                {isDeleting ? 'Deleting...' : 'Delete Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><ArrowLeft className="w-6 h-6 text-gray-600" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-gray-900">{task.title}</h1>
            {/* Department badge */}
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${deptStyle.bg} ${deptStyle.color}`}>
              <DeptIcon className="w-4 h-4" />{dept}
            </span>
            {/* Recurring / One-time badge */}
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${isRecurring ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
              {isRecurring ? <RefreshCw className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
              {isRecurring ? 'Recurring' : 'One-time'}
            </span>
          </div>
          <p className="text-gray-600 mt-1">{task.category}</p>
        </div>
        <div className="flex items-center gap-2">
          {canDelete && (
            <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 px-4 py-3 border border-red-200 text-red-600 bg-red-50 rounded-xl font-medium hover:bg-red-100 transition-colors">
              <Trash2 className="w-4 h-4" />Delete
            </button>
          )}
          {onEdit && (
            <button onClick={onEdit} className="flex items-center gap-2 px-5 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
              <Pencil className="w-4 h-4" />{t('common.edit')}
            </button>
          )}
          {task.status !== 'completed' && (
            <button onClick={onComplete} className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-medium hover:from-green-700 hover:to-green-800 transition-all shadow-lg">
              {t('maintenance.completeTask')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Task Details */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Task Details</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">{t('common.description')}</label>
                <p className="text-gray-900 mt-1">{task.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">{t('maintenance.status')}</label>
                  <span className={`inline-block mt-1 px-3 py-1 rounded-lg text-sm font-medium ${getTaskStatusColor(task.status)}`}>{task.status.replace('_', ' ').toUpperCase()}</span>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">{t('maintenance.priority')}</label>
                  <span className={`inline-block mt-1 px-3 py-1 rounded-lg text-sm font-medium ${getPriorityColor(task.priority)}`}>{task.priority.toUpperCase()}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Type</label>
                  <div className={`inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-lg text-sm font-medium ${isRecurring ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                    {isRecurring ? <RefreshCw className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    {isRecurring ? 'Recurring' : 'One-time'}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Frequency</label>
                  <p className="text-gray-900 mt-1 capitalize">{task.frequency?.replace('_', ' ')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          {task.instructions && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-blue-600" />Instructions</h2>
              <div className="bg-blue-50 rounded-xl p-4"><pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">{task.instructions}</pre></div>
            </div>
          )}

          {/* Checklist */}
          {task.checklist_items && task.checklist_items.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><CheckSquare className="w-5 h-5 text-green-600" />Checklist</h2>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-500">{checkedCount}/{totalItems}</span>
                  <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${completionPct}%`, background: completionPct === 100 ? 'linear-gradient(90deg, #16a34a, #22c55e)' : 'linear-gradient(90deg, #2563eb, #3b82f6)' }} />
                  </div>
                  {completionPct === 100 && <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">✓ Complete</span>}
                </div>
              </div>
              <div className="space-y-2">
                {task.checklist_items.map((item, index) => {
                  const isChecked = !!checkedItems[index];
                  return (
                    <div key={index} onClick={() => toggleCheck(index)}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-150 select-none ${isChecked ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-transparent hover:border-gray-200 hover:bg-gray-100'}`}>
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all duration-150 ${isChecked ? 'bg-green-500 border-2 border-green-500' : 'border-2 border-gray-300 bg-white'}`}>
                        {isChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </div>
                      <span className={`text-sm transition-all duration-150 ${isChecked ? 'text-green-700 line-through opacity-60' : 'text-gray-800'}`}>{item}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reference Photos */}
          {taskPhotos.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2"><Image className="w-5 h-5 text-blue-600" />Reference Photos</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {taskPhotos.map((url, idx) => (
                  <button key={idx} type="button" onClick={() => openLightbox(taskPhotos, idx)}
                    className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all group">
                    <img src={url} alt={`Reference ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Required Parts */}
          {task.required_parts && task.required_parts.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2"><Package className="w-5 h-5 text-orange-600" />Required Parts</h2>
              <div className="space-y-3">
                {task.required_parts.map((part, index) => (
                  <div key={index} className="p-4 rounded-xl border bg-gray-50 border-gray-200">
                    <div className="flex items-start justify-between">
                      <div><h3 className="font-medium text-gray-900">Part ID: {part.inventory_id}</h3></div>
                      <div className="text-right"><p className="font-medium text-gray-900">Qty: {part.quantity}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Schedule */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Schedule</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">{t('maintenance.nextDueDate')}</label>
                <p className="text-gray-900 mt-1 font-semibold">{formatDate(task.next_due_date)}</p>
                <p className={`text-sm mt-1 ${daysUntil < 0 ? 'text-red-600' : daysUntil <= 3 ? 'text-orange-600' : 'text-blue-600'}`}>
                  {daysUntil < 0 ? `${Math.abs(daysUntil)} days overdue` : `${daysUntil} days remaining`}
                </p>
              </div>
              {(task as any).hours_interval && (
                <div className="bg-blue-50 rounded-xl p-3 space-y-2">
                  <label className="text-sm font-medium text-blue-700 flex items-center gap-1.5"><Clock className="w-4 h-4" />Hours-Based Schedule</label>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-blue-500 font-medium">Interval</p>
                      <p className="font-semibold text-blue-900">Every {Number((task as any).hours_interval).toLocaleString()} hrs</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-500 font-medium">Next Due</p>
                      <p className="font-semibold text-blue-900">{(task as any).next_due_hours ? `${Number((task as any).next_due_hours).toLocaleString()} hrs` : '—'}</p>
                    </div>
                    {(task as any).last_hours_reading != null && (
                      <div>
                        <p className="text-xs text-blue-500 font-medium">Last Reading</p>
                        <p className="font-semibold text-blue-900">{Number((task as any).last_hours_reading).toLocaleString()} hrs</p>
                      </div>
                    )}
                    {equipment && (equipment as any).equipment_hours != null && (task as any).next_due_hours && (
                      <div>
                        <p className="text-xs text-blue-500 font-medium">Current / Due</p>
                        <p className={`font-semibold ${Number((equipment as any).equipment_hours) >= Number((task as any).next_due_hours) ? 'text-red-600' : Number((equipment as any).equipment_hours) >= Number((task as any).next_due_hours) * 0.9 ? 'text-amber-600' : 'text-blue-900'}`}>
                          {Number((equipment as any).equipment_hours).toLocaleString()} / {Number((task as any).next_due_hours).toLocaleString()} hrs
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {task.last_completed_date && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Last Completed</label>
                  <p className="text-gray-900 mt-1">{formatDate(task.last_completed_date)}</p>
                </div>
              )}
              {task.reminder_days_before && task.reminder_days_before.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Reminders</label>
                  <div className="mt-2 space-y-1">
                    {task.reminder_days_before.map((days, index) => <p key={index} className="text-sm text-gray-700">{days} {days === 1 ? 'day' : 'days'} before</p>)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Assignment */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Assignment</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Department</label>
                <div className={`inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg text-sm font-semibold ${deptStyle.bg} ${deptStyle.color}`}>
                  <DeptIcon className="w-4 h-4" />{dept}
                </div>
              </div>
              {equipment && (
                <div>
                  <label className="text-sm font-medium text-gray-600 flex items-center gap-2"><Wrench className="w-4 h-4" />{t('common.equipment')}</label>
                  <p className="text-gray-900 mt-1 font-medium">{equipment.name}</p>
                  {equipment.type && <p className="text-sm text-gray-600">{equipment.type}</p>}
                </div>
              )}
              {vessel && (
                <div>
                  <label className="text-sm font-medium text-gray-600">{t('common.vessel')}</label>
                  <p className="text-gray-900 mt-1 font-medium">{vessel.name}</p>
                </div>
              )}
              {assignedUser && (
                <div>
                  <label className="text-sm font-medium text-gray-600 flex items-center gap-2"><User className="w-4 h-4" />{t('maintenance.assignedTo')}</label>
                  <p className="text-gray-900 mt-1 font-medium">{assignedUser.full_name}</p>
                  {assignedUser.email && <p className="text-sm text-gray-600">{assignedUser.email}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {task.notes && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-yellow-600" />{t('common.notes')}</h2>
              <p className="text-sm text-gray-700">{task.notes}</p>
            </div>
          )}

          {/* Last Completion */}
          {lastCompletion && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><CheckSquare className="w-5 h-5 text-green-600" />Last Completion</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500">{t('maintenance.completedBy')}</p>
                  <p className="text-sm font-medium text-gray-900">{lastCompletion.completed_by_name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">{t('common.date')}</p>
                  <p className="text-sm text-gray-900">{formatDate(lastCompletion.completion_date)}</p>
                </div>
                {lastCompletion.comments && (
                  <div>
                    <p className="text-xs font-medium text-gray-500">Comments</p>
                    <p className="text-sm text-gray-700">{lastCompletion.comments}</p>
                  </div>
                )}
                {lastCompletion.issues_detected && (
                  <div className="bg-yellow-50 rounded-xl p-3">
                    <p className="text-xs font-medium text-yellow-800 mb-1">{t('maintenance.issuesDetected')}</p>
                    <p className="text-sm text-yellow-700">{lastCompletion.issues_detected}</p>
                  </div>
                )}
                {completionPhotos.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1"><Image className="w-3.5 h-3.5" />Photos ({completionPhotos.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {completionPhotos.map((url, idx) => (
                        <button key={idx} type="button" onClick={() => openLightbox(completionPhotos, idx)}
                          className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all group">
                          <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
