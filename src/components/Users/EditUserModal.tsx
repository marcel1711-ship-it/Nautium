import React, { useState, useEffect } from 'react';
import { X, User, AlertCircle, Eye, EyeOff, Ship, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../contexts/LanguageContext';

interface AuthUser {
  id: string;
  email: string;
  user_metadata: {
    role?: string;
    company_id?: string;
    company_name?: string;
    full_name?: string;
    vessel_ids?: string[];
    department?: string;
  };
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: AuthUser | null;
  isMasterAdmin: boolean;
}

interface Vessel {
  id: string;
  name: string;
  type: string;
}

// ── Role definitions (same as AddUserModal) ───────────────────────────────
const ROLE_GROUPS = [
  {
    group: 'Management',
    roles: [
      { value: 'customer_admin', label: 'Admin',         description: 'Full access to all departments and settings', dept: null },
      { value: 'fleet_manager',  label: 'Fleet Manager', description: 'Full access to all vessels in the fleet',     dept: null },
      { value: 'captain',        label: 'Captain',       description: 'Full access to assigned vessel, all departments', dept: null },
      { value: 'owner',          label: 'Owner',         description: 'Read-only summary dashboard',                 dept: null },
    ],
  },
  {
    group: 'Engineering',
    roles: [
      { value: 'chief_engineer', label: 'Chief Engineer', description: 'Engineering dept — can create & edit tasks', dept: 'Engineering' },
      { value: 'engineer',       label: 'Engineer',       description: 'Engineering dept — view & update only',      dept: 'Engineering' },
    ],
  },
  {
    group: 'Deck',
    roles: [
      { value: 'deck_officer', label: 'Deck Officer', description: 'Deck dept — can create & edit tasks', dept: 'Deck' },
    ],
  },
  {
    group: 'Interior',
    roles: [
      { value: 'chief_stew', label: 'Chief Stew', description: 'Interior dept — can create & edit tasks', dept: 'Interior' },
    ],
  },
  {
    group: 'Galley',
    roles: [
      { value: 'chef', label: 'Chef', description: 'Galley dept — can create & edit tasks', dept: 'Galley' },
    ],
  },
  {
    group: 'Safety',
    roles: [
      { value: 'safety_officer', label: 'Safety Officer', description: 'Safety dept — can create & edit tasks', dept: 'Safety' },
    ],
  },
  {
    group: 'Crew',
    roles: [
      { value: 'crew', label: 'Crew', description: 'View & update only in their department', dept: null },
    ],
  },
];

const ALL_ROLES = ROLE_GROUPS.flatMap(g => g.roles);
const VESSEL_ROLES = ['captain', 'chief_engineer', 'engineer', 'chief_stew', 'deck_officer', 'chef', 'safety_officer', 'crew'];
const DEPT_ROLES = ['crew'];
const DEPARTMENTS = ['Engineering', 'Deck', 'Interior', 'Galley', 'Safety'];

export const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen, onClose, onSuccess, user, isMasterAdmin,
}) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    role: 'captain',
    password: '',
    vessel_ids: [] as string[],
    department: '',
  });

  const selectedRoleDef = ALL_ROLES.find(r => r.value === formData.role);
  const autoDept = selectedRoleDef?.dept || null;

  useEffect(() => {
    if (user && isOpen) {
      const currentRole = user.user_metadata.role || 'captain';
      const roleDef = ALL_ROLES.find(r => r.value === currentRole);
      setFormData({
        full_name: user.user_metadata.full_name || '',
        role: currentRole,
        password: '',
        vessel_ids: user.user_metadata.vessel_ids || [],
        department: user.user_metadata.department || roleDef?.dept || '',
      });
      setError(null);
      setShowPassword(false);
      const companyId = user.user_metadata.company_id;
      if (companyId) {
        supabase.from('vessels').select('id, name, type').eq('company_id', companyId).order('name')
          .then(({ data }) => setVessels(data || []));
      } else {
        setVessels([]);
      }
    }
  }, [user, isOpen]);

  const handleRoleChange = (role: string) => {
    const roleDef = ALL_ROLES.find(r => r.value === role);
    setFormData(prev => ({
      ...prev,
      role,
      department: roleDef?.dept || '',
      vessel_ids: [],
    }));
  };

  const toggleVessel = (vesselId: string) => {
    setFormData(prev => ({
      ...prev,
      vessel_ids: prev.vessel_ids.includes(vesselId)
        ? prev.vessel_ids.filter(id => id !== vesselId)
        : [...prev.vessel_ids, vesselId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');
      const department = autoDept || formData.department || null;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'update',
          user_id: user.id,
          full_name: formData.full_name,
          role: formData.role,
          vessel_ids: formData.vessel_ids,
          department,
          password: formData.password || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update user');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  const showVesselSelector = VESSEL_ROLES.includes(formData.role) && vessels.length > 0;
  const showDeptSelector = DEPT_ROLES.includes(formData.role) && !autoDept;
  const isFullAccess = ['customer_admin', 'fleet_manager', 'master_admin'].includes(formData.role);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t('users.editUserTitle')}</h2>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Full name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('users.fullName')}</label>
            <input type="text" value={formData.full_name}
              onChange={(e) => setFormData(p => ({ ...p, full_name: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Full name" />
          </div>

          {/* Role — grouped selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('users.role')}</label>
            <div className="space-y-3">
              {ROLE_GROUPS.filter(g => {
                // Only show master_admin option if current user is master_admin
                if (g.group === 'Management' && !isMasterAdmin) return true;
                return true;
              }).map(group => (
                <div key={group.group}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 px-1">{group.group}</p>
                  <div className="space-y-1.5">
                    {group.roles.map(role => (
                      <div key={role.value}
                        onClick={() => handleRoleChange(role.value)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          formData.role === role.value
                            ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                        }`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          formData.role === role.value ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                        }`}>
                          {formData.role === role.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">{role.label}</p>
                            {role.dept && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">{role.dept}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Department — crew only */}
          {showDeptSelector && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Department *</label>
              <div className="relative">
                <select value={formData.department}
                  onChange={e => setFormData(p => ({ ...p, department: e.target.value }))}
                  required className="w-full appearance-none px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                  <option value="">Select department</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Auto-assigned department */}
          {autoDept && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
              <p className="text-xs text-blue-700 font-medium">Department: <strong>{autoDept}</strong></p>
            </div>
          )}

          {/* Full access notice */}
          {isFullAccess && vessels.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs text-blue-700 flex items-center gap-2">
                <Ship className="w-4 h-4 flex-shrink-0" />
                This role has access to all vessels in the company.
              </p>
            </div>
          )}

          {/* Vessel selector */}
          {showVesselSelector && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="flex items-center gap-2">
                  <Ship className="w-4 h-4 text-blue-500" />
                  Vessel Access
                  <span className="text-xs text-gray-400 font-normal">(empty = all vessels)</span>
                </span>
              </label>
              <div className="space-y-2 border border-gray-200 rounded-xl p-3 max-h-40 overflow-y-auto">
                {vessels.map(v => (
                  <label key={v.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <input type="checkbox" checked={formData.vessel_ids.includes(v.id)}
                      onChange={() => toggleVessel(v.id)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{v.name}</p>
                      <p className="text-xs text-gray-500">{v.type}</p>
                    </div>
                  </label>
                ))}
              </div>
              {formData.vessel_ids.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No vessels selected — user will have access to all vessels.</p>
              )}
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
            </label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={formData.password}
                onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="New password..." minLength={6} />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={isLoading}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? t('common.loading') : t('users.saveUser')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
