import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle, Eye, EyeOff, Ship, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId?: string;
}

interface Company {
  id: string;
  name: string;
  customer_type: string;
  yacht_name: string;
}

interface Vessel {
  id: string;
  name: string;
  type: string;
}

// ── Role definitions ─────────────────────────────────────────────────────────
const ROLE_GROUPS = [
  {
    group: 'Management',
    roles: [
      { value: 'customer_admin', label: 'Admin', description: 'Full access to all departments and settings', dept: null },
      { value: 'fleet_manager',  label: 'Fleet Manager', description: 'Full access to all vessels in the fleet', dept: null },
      { value: 'captain',        label: 'Captain', description: 'Full access to assigned vessel, all departments', dept: null },
      { value: 'owner',          label: 'Owner', description: 'Read-only summary dashboard', dept: null },
    ],
  },
  {
    group: 'Engineering',
    roles: [
      { value: 'chief_engineer', label: 'Chief Engineer', description: 'Engineering dept — can create & edit tasks', dept: 'Engineering' },
      { value: 'engineer',       label: 'Engineer', description: 'Engineering dept — view & update only', dept: 'Engineering' },
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

// Flatten for easy lookup
const ALL_ROLES = ROLE_GROUPS.flatMap(g => g.roles);

// Roles that get vessel access selector
const VESSEL_ROLES = ['captain', 'chief_engineer', 'engineer', 'chief_stew', 'deck_officer', 'chef', 'safety_officer', 'crew'];

// Roles that need a department selector
const DEPT_ROLES = ['crew'];

const DEPARTMENTS = ['Engineering', 'Deck', 'Interior', 'Galley', 'Safety'];

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
}) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: 'Nautium2024!',
    full_name: '',
    company_id: companyId || '',
    role: 'captain' as string,
    vessel_ids: [] as string[],
    department: '' as string,
  });

  // Auto-set department when role changes
  const selectedRoleDef = ALL_ROLES.find(r => r.value === formData.role);
  const autoDept = selectedRoleDef?.dept || null;

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setShowPassword(false);
      setVessels([]);
      setFormData({
        email: '',
        password: 'Nautium2024!',
        full_name: '',
        company_id: companyId || '',
        role: 'captain',
        vessel_ids: [],
        department: '',
      });
      if (currentUser?.role === 'master_admin' && !companyId) {
        fetchCompanies();
      } else if (companyId) {
        fetchVessels(companyId);
      } else if (currentUser?.company_id) {
        fetchVessels(currentUser.company_id);
      }
    }
  }, [isOpen, currentUser, companyId]);

  // Auto-load vessels when role requires it
  useEffect(() => {
    const cid = formData.company_id;
    if (cid && VESSEL_ROLES.includes(formData.role)) {
      fetchVessels(cid);
    }
  }, [formData.role, formData.company_id]);

  const fetchCompanies = async () => {
    const { data } = await supabase.from('companies').select('id, name, customer_type, yacht_name').order('name');
    setCompanies(data || []);
  };

  const fetchVessels = async (cid: string) => {
    const { data } = await supabase.from('vessels').select('id, name, type').eq('company_id', cid).order('name');
    setVessels(data || []);
  };

  const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value;
    setFormData(prev => ({ ...prev, company_id: cid, vessel_ids: [] }));
    if (cid) fetchVessels(cid);
    else setVessels([]);
  };

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
    setError(null);
    setIsLoading(true);
    try {
      if (!formData.company_id) throw new Error('Please select a company');
      const selectedCompany = companies.find(c => c.id === formData.company_id);
      const companyName = selectedCompany
        ? (selectedCompany.customer_type === 'yacht_owner' ? selectedCompany.yacht_name : selectedCompany.name)
        : currentUser?.company_name || '';
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error('No active session. Please log in again.');
      const department = autoDept || formData.department || null;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-customer-user`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          company_id: formData.company_id,
          company_name: companyName,
          full_name: formData.full_name,
          role: formData.role,
          vessel_ids: formData.vessel_ids,
          department,
        }),
      });
      let result: any;
      try { result = await response.json(); } catch { throw new Error(`Server error: ${response.status}`); }
      if (!response.ok) throw new Error(result.error || `Error ${response.status}: Failed to create user`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const showVesselSelector = VESSEL_ROLES.includes(formData.role) && vessels.length > 0;
  const showDeptSelector = DEPT_ROLES.includes(formData.role) && !autoDept;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">{t('users.addUserTitle')}</h2>
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
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('users.fullName')} *</label>
            <input type="text" value={formData.full_name}
              onChange={(e) => setFormData(p => ({ ...p, full_name: e.target.value }))}
              required className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="John Doe" />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('users.emailAddress')} *</label>
            <input type="email" value={formData.email}
              onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
              required className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="user@example.com" />
          </div>

          {/* Company — master_admin only */}
          {!companyId && currentUser?.role === 'master_admin' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Company *</label>
              <div className="relative">
                <select value={formData.company_id} onChange={handleCompanyChange} required
                  className="w-full appearance-none px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                  <option value="">Select a company</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.customer_type === 'yacht_owner' ? c.yacht_name : c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Role — grouped selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Role *</label>
            <div className="space-y-3">
              {ROLE_GROUPS.map(group => (
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

          {/* Department — only for crew role (others auto-assigned) */}
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
              <p className="text-xs text-gray-400 mt-1">This crew member will only see their department.</p>
            </div>
          )}

          {/* Auto-assigned department info */}
          {autoDept && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
              <p className="text-xs text-blue-700 font-medium">Department auto-assigned: <strong>{autoDept}</strong></p>
            </div>
          )}

          {/* Vessel selector */}
          {showVesselSelector && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="flex items-center gap-2">
                  <Ship className="w-4 h-4 text-blue-500" />
                  Vessel Access
                  <span className="text-xs text-gray-400 font-normal">(leave empty for all vessels)</span>
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
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Initial Password *</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={formData.password}
                onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                required minLength={6}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">The user can change this after their first login.</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={isLoading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? t('common.loading') : t('users.createUser')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
