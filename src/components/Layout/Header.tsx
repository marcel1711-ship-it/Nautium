import React, { useState, useEffect, useCallback } from 'react';
import { Bell, User, LogOut, ChevronDown, Ship, Settings, Menu, Users, Building2,
  CheckCheck, WifiOff, Wifi, Layers, DollarSign, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { demoVessels } from '../../data/demoData';
import { supabase } from '../../lib/supabase';

interface HeaderProps {
  onNavigate?: (page: string) => void;
  onMenuToggle?: () => void;
}
interface VesselOption { id: string; name: string; type: string; }
interface AdminNotification {
  id: string; type: string; title: string;
  message: string; read: boolean; created_at: string;
}

const isDemoUser = (email: string) => email === 'admin@yachtmaintenance.pro';

const FLEET_ROLES = ['fleet_manager', 'customer_admin'];

const NOTIFICATION_ROLES = ['master_admin', 'fleet_manager', 'customer_admin', 'captain'];

const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? 'Just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const getRoleBadge = (role: string) => {
  const labels: Record<string, string> = {
    master_admin: 'Master Admin', customer_admin: 'Admin',
    standard_user: 'User', fleet_manager: 'Fleet Manager',
    captain: 'Captain', chief_engineer: 'Chief Engineer',
    engineer: 'Engineer', chief_stew: 'Chief Stew',
    deck_officer: 'Deck Officer', chef: 'Chef',
    safety_officer: 'Safety Officer', crew: 'Crew', owner: 'Owner',
  };
  return labels[role] || role;
};

const getNotificationStyle = (type: string) => {
  switch (type) {
    case 'expense_approval':
      return { icon: DollarSign, bg: 'bg-amber-500/15', color: 'text-amber-400' };
    case 'new_customer':
      return { icon: Building2, bg: 'bg-emerald-500/15', color: 'text-emerald-400' };
    default:
      return { icon: Users, bg: 'bg-cyan-500/15', color: 'text-cyan-400' };
  }
};

export const Header: React.FC<HeaderProps> = ({ onNavigate, onMenuToggle }) => {
  const { currentUser, logout, selectedVesselId, setSelectedVesselId } = useAuth();
  const { t } = useLanguage();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showVesselMenu, setShowVesselMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [userVessels, setUserVessels] = useState<VesselOption[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const canSeeNotifications = NOTIFICATION_ROLES.includes(currentUser?.role || '');

  const loadNotifications = useCallback(async () => {
    if (!canSeeNotifications || isDemoUser(currentUser?.email || '')) return;

    let query = supabase
      .from('admin_notifications')
      .select('id, type, title, message, read, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (currentUser?.role !== 'master_admin' && currentUser?.company_id) {
      query = query.eq('company_id', currentUser.company_id);
    }

    if (currentUser?.role === 'captain') {
      query = query.eq('type', 'expense_approval');
    }

    const { data } = await query;
    if (data) setNotifications(data);
  }, [currentUser, canSeeNotifications]);

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('admin_notifications').update({ read: true }).in('id', unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await supabase.from('admin_notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleNotificationClick = (n: AdminNotification) => {
    markRead(n.id);
    setShowNotifications(false);
    if (n.type === 'expense_approval') {
      onNavigate?.('costs');
    } else if (n.type === 'new_customer') {
      onNavigate?.('customers');
    }
  };

  useEffect(() => { loadVessels(); loadNotifications(); }, [currentUser]);

  useEffect(() => {
    if (!canSeeNotifications) return;
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [loadNotifications, canSeeNotifications]);

  const loadVessels = async () => {
    if (!currentUser) return;
    if (isDemoUser(currentUser.email)) {
      const vessels = currentUser.role === 'master_admin'
        ? demoVessels
        : demoVessels.filter(v => currentUser.vessel_ids.includes(v.id));
      setUserVessels(vessels.map(v => ({ id: v.id, name: v.name, type: v.type })));
      return;
    }
    if (currentUser.role === 'master_admin') { setUserVessels([]); return; }

    // FIX: customer_admin y fleet_manager cargan TODOS los vessels de su company
    const isAdminRole = ['customer_admin', 'fleet_manager'].includes(currentUser.role);

    let query = supabase.from('vessels').select('id, name, type');
    if (isAdminRole && currentUser.company_id) {
      query = query.eq('company_id', currentUser.company_id);
    } else if (currentUser.vessel_ids.length > 0) {
      query = query.in('id', currentUser.vessel_ids);
    } else if (currentUser.company_id) {
      query = query.eq('company_id', currentUser.company_id);
    } else {
      setUserVessels([]);
      return;
    }

    const { data } = await query;
    if (data) setUserVessels(data);
  };

  if (!currentUser) return null;

  const isFleetRole    = FLEET_ROLES.includes(currentUser.role);
  const isAllFleet     = selectedVesselId === 'all';
  const currentVessel  = isAllFleet ? null : userVessels.find(v => v.id === selectedVesselId);

  // FIX: mostrar switcher si tiene al menos 1 vessel o es fleet role
  const showVesselSwitcher = currentUser.role !== 'master_admin' &&
    (userVessels.length >= 1 || isFleetRole);
  const showVesselBadge = currentUser.role !== 'master_admin' &&
    !showVesselSwitcher && currentVessel;

  const vesselButtonLabel     = isAllFleet ? 'All Fleet' : (currentVessel?.name ?? '');
  const vesselButtonIconColor = isAllFleet ? 'text-emerald-400' : 'text-cyan-400';

  const unreadCount = notifications.filter(n => !n.read).length;

  const pendingApprovalCount = notifications.filter(
    n => n.type === 'expense_approval' && !n.read
  ).length;

  return (
    <>
      {!isOnline && (
        <div className="fixed top-0 left-0 lg:left-64 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2 bg-red-500/90 backdrop-blur-sm text-white text-sm font-medium">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>No internet connection — changes will sync when you're back online.</span>
        </div>
      )}

      {showReconnected && (
        <div className="fixed top-0 left-0 lg:left-64 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/90 backdrop-blur-sm text-white text-sm font-medium transition-all">
          <Wifi className="w-4 h-4 flex-shrink-0" />
          <span>Back online — syncing your data.</span>
        </div>
      )}

      <header className={`bg-[#05111e] border-b border-white/[0.07] h-16 fixed right-0 z-30 shadow-lg shadow-black/20 transition-all
        ${!isOnline || showReconnected ? 'top-9' : 'top-0'} left-0 lg:left-64`}>
        <div className="h-full px-4 lg:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 lg:gap-4">
            <button onClick={onMenuToggle}
              className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors text-slate-400 hover:text-white lg:hidden">
              <Menu className="w-5 h-5" />
            </button>

            {showVesselSwitcher && (
              <div className="relative">
                <button
                  onClick={() => setShowVesselMenu(!showVesselMenu)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] rounded-2xl transition-all border border-white/[0.08] hover:border-white/[0.15]"
                >
                  {isAllFleet
                    ? <Layers className={`w-4 h-4 ${vesselButtonIconColor}`} />
                    : <Ship className={`w-4 h-4 ${vesselButtonIconColor}`} />
                  }
                  <span className="font-medium text-white">{vesselButtonLabel}</span>
                  {isAllFleet && (
                    <span className="text-xs px-2 py-0.5 bg-emerald-500/15 text-emerald-300 rounded-full border border-emerald-500/20">
                      {userVessels.length} vessels
                    </span>
                  )}
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {showVesselMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowVesselMenu(false)} />
                    <div className="absolute top-full mt-2 left-0 w-64 bg-[#071828] rounded-2xl shadow-xl border border-white/[0.08] py-2 z-20">
                      <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {t('header.switchVessel')}
                      </div>
                      {isFleetRole && (
                        <>
                          <button
                            onClick={() => { setSelectedVesselId('all'); setShowVesselMenu(false); }}
                            className={`w-full px-4 py-2.5 text-left transition-colors flex items-center gap-3 ${isAllFleet ? 'bg-emerald-500/10' : 'hover:bg-white/[0.04]'}`}
                          >
                            <Layers className={`w-4 h-4 ${isAllFleet ? 'text-emerald-400' : 'text-slate-500'}`} />
                            <div className="flex-1">
                              <div className={`font-medium ${isAllFleet ? 'text-emerald-300' : 'text-slate-300'}`}>All Fleet</div>
                              <div className="text-xs text-slate-500">{userVessels.length} vessels</div>
                            </div>
                            {isAllFleet && <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0" />}
                          </button>
                          <div className="my-1 h-px bg-white/[0.06]" />
                        </>
                      )}
                      {userVessels.map(vessel => (
                        <button
                          key={vessel.id}
                          onClick={() => { setSelectedVesselId(vessel.id); setShowVesselMenu(false); }}
                          className={`w-full px-4 py-2.5 text-left transition-colors flex items-center gap-3 ${vessel.id === selectedVesselId ? 'bg-cyan-500/10' : 'hover:bg-white/[0.04]'}`}
                        >
                          <Ship className={`w-4 h-4 ${vessel.id === selectedVesselId ? 'text-cyan-400' : 'text-slate-500'}`} />
                          <div>
                            <div className={`font-medium ${vessel.id === selectedVesselId ? 'text-cyan-300' : 'text-slate-300'}`}>{vessel.name}</div>
                            <div className="text-xs text-slate-500">{vessel.type}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {showVesselBadge && (
              <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] rounded-2xl border border-white/[0.08]">
                <Ship className="w-4 h-4 text-cyan-400" />
                <span className="font-medium text-white">{currentVessel!.name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">

            {canSeeNotifications && (
              <div className="relative">
                <button
                  onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) loadNotifications(); }}
                  className="relative p-2 hover:bg-white/[0.06] rounded-xl transition-colors"
                >
                  <Bell className="w-5 h-5 text-slate-400 hover:text-white transition-colors" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[#05111e]" />
                  )}
                </button>

                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
                    <div className="absolute top-full right-0 mt-2 w-96 bg-[#071828] rounded-2xl shadow-xl border border-white/[0.08] z-20 overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">
                          Notifications
                          {unreadCount > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full">
                              {unreadCount}
                            </span>
                          )}
                        </h3>
                        {unreadCount > 0 && (
                          <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                            <CheckCheck className="w-3.5 h-3.5" />Mark all read
                          </button>
                        )}
                      </div>

                      {pendingApprovalCount > 0 && currentUser.role !== 'master_admin' && (
                        <div
                          className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-3 cursor-pointer hover:bg-amber-500/15 transition-colors"
                          onClick={() => { setShowNotifications(false); onNavigate?.('costs'); }}
                        >
                          <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                            <Clock className="w-4 h-4 text-amber-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-amber-300">
                              {pendingApprovalCount} expense{pendingApprovalCount > 1 ? 's' : ''} awaiting your approval
                            </p>
                            <p className="text-xs text-amber-500">Tap to review and approve</p>
                          </div>
                        </div>
                      )}

                      <div className="max-h-[28rem] overflow-y-auto divide-y divide-white/[0.05]">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                            <p className="text-sm text-slate-500">No notifications yet</p>
                          </div>
                        ) : notifications.map(n => {
                          const style = getNotificationStyle(n.type);
                          const Icon  = style.icon;
                          return (
                            <div
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              className={`px-4 py-3 cursor-pointer transition-colors ${!n.read ? 'bg-cyan-500/5 hover:bg-cyan-500/10' : 'hover:bg-white/[0.03]'}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                                  <Icon className={`w-4 h-4 ${style.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm ${!n.read ? 'font-semibold text-white' : 'font-medium text-slate-300'}`}>{n.title}</p>
                                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                                  <p className="text-xs text-slate-600 mt-1">{timeAgo(n.created_at)}</p>
                                </div>
                                {!n.read && <span className="w-2 h-2 bg-cyan-400 rounded-full flex-shrink-0 mt-1.5" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="w-px h-6 bg-white/[0.08]" />

            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.06] rounded-2xl transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-sm shadow-cyan-500/20">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-sm font-medium text-white">{currentUser.full_name}</p>
                  <p className="text-xs text-slate-400">{getRoleBadge(currentUser.role)}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute top-full right-0 mt-2 w-64 bg-[#071828] rounded-2xl shadow-xl border border-white/[0.08] py-2 z-20">
                    <div className="px-4 py-3 border-b border-white/[0.07]">
                      <p className="text-sm font-medium text-white">{currentUser.full_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{currentUser.email}</p>
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-cyan-500/10 text-cyan-400 text-xs font-medium rounded-full border border-cyan-500/20">
                        {getRoleBadge(currentUser.role)}
                      </div>
                    </div>
                    <button
                      onClick={() => { onNavigate?.('settings'); setShowUserMenu(false); }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-white/[0.04] text-slate-300 hover:text-white transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="text-sm">{t('nav.settings')}</span>
                    </button>
                    <div className="my-1 h-px bg-white/[0.06]" />
                    <button
                      onClick={() => { logout(); setShowUserMenu(false); }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm">{t('nav.logout')}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
};
