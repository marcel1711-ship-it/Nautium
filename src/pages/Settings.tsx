import React, { useState, useEffect } from 'react';
import { User, Bell, Lock, Globe, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { demoCompanies, demoVessels } from '../data/demoData';
import { supabase } from '../lib/supabase';
import { formatDate } from '../utils/helpers';

interface SettingsProps {
  onNavigate: (page: string, params?: any) => void;
}

interface CompanyInfo {
  id: string;
  name: string;
  subscription_status: string;
  subscription_renewal_date: string;
  email_notifications_enabled: boolean;
  notification_emails: string[];
}

interface VesselInfo { id: string; name: string; type: string; }

const isDemoUser = (email: string) => email === 'admin@yachtmaintenance.pro';

export const Settings: React.FC<SettingsProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [userVessels, setUserVessels] = useState<VesselInfo[]>([]);

  // Notification emails state (customer_admin only)
  const [notificationEmails, setNotificationEmails] = useState<string[]>([]);
  const [newNotifEmail, setNewNotifEmail] = useState('');
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    setFullName(currentUser.full_name);
    setPhone(currentUser.phone || '');
    loadCompanyAndVessels();
  }, [currentUser]);

  const loadCompanyAndVessels = async () => {
    if (!currentUser) return;

    if (isDemoUser(currentUser.email)) {
      const demoCompany = demoCompanies.find(c => c.id === currentUser.company_id);
      if (demoCompany) {
        setCompany({
          id: demoCompany.id,
          name: demoCompany.name,
          subscription_status: demoCompany.subscription_status,
          subscription_renewal_date: demoCompany.subscription_renewal_date,
          email_notifications_enabled: false,
          notification_emails: [],
        });
      }
      const vessels = demoVessels.filter(v => currentUser.vessel_ids.includes(v.id));
      setUserVessels(vessels.map(v => ({ id: v.id, name: v.name, type: v.type })));
      return;
    }

    if (currentUser.company_id) {
      const { data } = await supabase
        .from('companies')
        .select('id, name, subscription_status, subscription_renewal_date, email_notifications_enabled, notification_emails')
        .eq('id', currentUser.company_id)
        .maybeSingle();
      if (data) {
        setCompany(data);
        setNotificationEmails(data.notification_emails ?? []);
      }
    }

    if (currentUser.vessel_ids.length > 0) {
      const { data } = await supabase
        .from('vessels')
        .select('id, name, type')
        .in('id', currentUser.vessel_ids);
      if (data) setUserVessels(data);
    } else if (currentUser.company_id && currentUser.role === 'customer_admin') {
      const { data } = await supabase
        .from('vessels')
        .select('id, name, type')
        .eq('company_id', currentUser.company_id);
      if (data) setUserVessels(data);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (isDemoUser(currentUser.email)) {
      setSaveMsg('Profile saved (demo mode)');
      setTimeout(() => setSaveMsg(''), 3000);
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName, phone },
    });

    if (!error) {
      setSaveMsg('Profile updated successfully');
    } else {
      setSaveMsg('Error updating profile');
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (newPassword !== confirmPassword) {
      setPwMsg('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setPwMsg('Password must be at least 6 characters');
      return;
    }

    if (isDemoUser(currentUser.email)) {
      setPwMsg('Password change not available in demo mode');
      setTimeout(() => setPwMsg(''), 3000);
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (!error) {
      setPwMsg('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPwMsg('Error updating password');
    }
    setChangingPassword(false);
    setTimeout(() => setPwMsg(''), 3000);
  };

  const addNotificationEmail = () => {
    const trimmed = newNotifEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) return;
    if (notificationEmails.includes(trimmed)) return;
    setNotificationEmails(prev => [...prev, trimmed]);
    setNewNotifEmail('');
  };

  const removeNotificationEmail = (email: string) => {
    setNotificationEmails(prev => prev.filter(e => e !== email));
  };

  const handleSaveNotifications = async () => {
    if (!company || isDemoUser(currentUser?.email ?? '')) {
      setNotifMsg('Saved (demo mode)');
      setTimeout(() => setNotifMsg(''), 3000);
      return;
    }

    setSavingNotif(true);
    const { error } = await supabase
      .from('companies')
      .update({ notification_emails: notificationEmails })
      .eq('id', company.id);

    if (!error) {
      setNotifMsg('Notification recipients updated');
      setCompany(prev => prev ? { ...prev, notification_emails: notificationEmails } : prev);
    } else {
      setNotifMsg('Error saving changes');
    }
    setSavingNotif(false);
    setTimeout(() => setNotifMsg(''), 3000);
  };

  if (!currentUser) return null;

  const isCustomerAdmin = currentUser.role === 'customer_admin';
  const notificationsActive = company?.email_notifications_enabled ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight">{t('settings.title')}</h1>
        <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">{t('settings.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Profile */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-xl">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">{t('settings.profile')}</h2>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('settings.fullName')}</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-[10px] focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.emailAddress')}</label>
                <input
                  type="email"
                  value={currentUser.email}
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.phoneNumber')}</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.role')}</label>
                <input
                  type="text"
                  value={currentUser.role === 'master_admin' ? t('settings.masterAdmin') : currentUser.role === 'customer_admin' ? t('settings.admin') : t('settings.user')}
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-gray-600"
                />
              </div>

              {saveMsg && (
                <p className={`text-sm font-medium ${saveMsg.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                  {saveMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? t('common.loading') : t('settings.save')}
              </button>
            </form>
          </div>

          {/* Language */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Globe className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">{t('settings.language')}</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">{t('settings.selectLanguage')}</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-4 py-3 rounded-xl border-2 transition-all text-left ${language === 'en' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">🇺🇸</div>
                    <div>
                      <p className={`font-medium ${language === 'en' ? 'text-blue-900' : 'text-gray-900'}`}>{t('settings.english')}</p>
                      <p className={`text-xs ${language === 'en' ? 'text-blue-600' : 'text-gray-500'}`}>English</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setLanguage('es')}
                  className={`px-4 py-3 rounded-xl border-2 transition-all text-left ${language === 'es' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">🇪🇸</div>
                    <div>
                      <p className={`font-medium ${language === 'es' ? 'text-blue-900' : 'text-gray-900'}`}>{t('settings.spanish')}</p>
                      <p className={`text-xs ${language === 'es' ? 'text-blue-600' : 'text-gray-500'}`}>Español</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Lock className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">{t('settings.security')}</h2>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.currentPassword')}</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.newPassword')}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.confirmPassword')}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {pwMsg && (
                <p className={`text-sm font-medium ${pwMsg.includes('Error') || pwMsg.includes('not') || pwMsg.includes('least') ? 'text-red-600' : 'text-green-600'}`}>
                  {pwMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={changingPassword}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {changingPassword ? t('common.loading') : t('settings.updatePassword')}
              </button>
            </form>
          </div>

          {/* Notifications — customer_admin only */}
          {isCustomerAdmin && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-100 rounded-xl">
                  <Bell className="w-5 h-5 text-amber-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">{t('settings.notifications')}</h2>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[11px] font-semibold rounded-full leading-5">Premium</span>
              </div>

              {!notificationsActive ? (
                <div className="mt-4 flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Email notifications not enabled</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Email alerts for overdue maintenance and low stock are not active for your account. Contact your Nautium administrator to enable this feature.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <Bell className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                      Daily alerts for <strong>overdue maintenance</strong> and <strong>low stock</strong> are active. The contact email on file always receives them. Add additional recipients below.
                    </p>
                  </div>

                  {/* Contact email — read-only */}
                  {company?.name && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Always notified</p>
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className="text-sm text-gray-600">Contact email on file</span>
                        <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">managed by Nautium</span>
                      </div>
                    </div>
                  )}

                  {/* Additional recipients */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Additional recipients</p>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={newNotifEmail}
                        onChange={e => setNewNotifEmail(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNotificationEmail(); }}}
                        placeholder="crew@example.com"
                        className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={addNotificationEmail}
                        className="px-3 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-1.5 text-sm font-medium"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </button>
                    </div>

                    {notificationEmails.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {notificationEmails.map(email => (
                          <div key={email} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
                            <span className="text-sm text-gray-700">{email}</span>
                            <button
                              type="button"
                              onClick={() => removeNotificationEmail(email)}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-gray-400">No additional recipients yet.</p>
                    )}
                  </div>

                  {notifMsg && (
                    <p className={`text-sm font-medium ${notifMsg.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                      {notifMsg}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveNotifications}
                    disabled={savingNotif}
                    className="px-6 py-2.5 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
                  >
                    {savingNotif ? t('common.loading') : 'Save recipients'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {company && currentUser.role !== 'master_admin' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">{t('settings.companyDetails')}</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">{t('settings.companyName')}</p>
                  <p className="font-medium text-gray-900">{company.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t('settings.subscriptionStatus')}</p>
                  <span className={`inline-block mt-1 px-3 py-1 rounded-xl text-sm font-medium ${
                    company.subscription_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {company.subscription_status.charAt(0).toUpperCase() + company.subscription_status.slice(1)}
                  </span>
                </div>
                {company.subscription_renewal_date && (
                  <div>
                    <p className="text-sm text-gray-600">{t('settings.renewalDate')}</p>
                    <p className="font-medium text-gray-900">{formatDate(company.subscription_renewal_date)}</p>
                  </div>
                )}
                {isCustomerAdmin && (
                  <div>
                    <p className="text-sm text-gray-600">Email Notifications</p>
                    <span className={`inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-xl text-sm font-medium ${
                      notificationsActive ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${notificationsActive ? 'bg-amber-500' : 'bg-gray-400'}`} />
                      {notificationsActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {userVessels.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">{t('settings.assignedVessels')}</h2>
              <div className="space-y-2">
                {userVessels.map(vessel => (
                  <div key={vessel.id} className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="font-medium text-blue-900">{vessel.name}</p>
                    <p className="text-sm text-blue-700">{vessel.type}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">{t('common.needHelp')}</h3>
            <p className="text-sm text-blue-800 mb-4">
              {t('settings.supportHint')}
            </p>
            <button className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
              {t('common.contactSupport')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
