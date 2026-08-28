import React, { useState } from 'react';
import {
  LayoutDashboard, Wrench, Package, Ship, Building2, Users, Users2,
  Settings, History, FileText, FolderOpen, Boxes, Fuel, DollarSign,
  X, Layers, ClipboardList, ShieldCheck, ChevronDown, ChevronUp,
  ShoppingCart, Compass,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  userDepartment?: string | null;
  userRole?: string;
}
interface NavItem {
  id: string;
  labelKey: string;
  icon: React.ElementType;
  roles: string[];
  badge?: string;
}

const FULL_ACCESS_ROLES  = ['master_admin', 'customer_admin', 'standard_user'];
const FLEET_ROLES        = ['fleet_manager', 'captain'];
const CREW_ROLES         = ['chief_engineer', 'engineer', 'chief_stew', 'deck_officer', 'chef', 'safety_officer', 'crew'];
const FLEET_MANAGER_ROLES= ['customer_admin', 'fleet_manager'];

const navItems: NavItem[] = [
  { id: 'dashboard',              labelKey: 'nav.dashboard',             icon: LayoutDashboard, roles: [...FULL_ACCESS_ROLES, ...FLEET_ROLES, ...CREW_ROLES] },
  { id: 'financials',             labelKey: 'nav.financials',            icon: DollarSign,      roles: ['customer_admin', 'fleet_manager'] },
  { id: 'customers',              labelKey: 'nav.customers',             icon: Building2,       roles: ['master_admin'], badge: 'Admin' },
  { id: 'onboarding-submissions', labelKey: 'nav.onboardingSubmissions', icon: ClipboardList,   roles: ['master_admin'], badge: 'Admin' },
  { id: 'users',                  labelKey: 'nav.users',                 icon: Users,           roles: ['master_admin'], badge: 'Admin' },
  { id: 'fleet-overview',         labelKey: 'nav.fleetOverview',         icon: Layers,          roles: ['captain'] },
  { id: 'vessels',                labelKey: 'nav.vessels',               icon: Ship,            roles: ['customer_admin', 'fleet_manager', 'captain'] },
  { id: 'users-customer',         labelKey: 'nav.users',                 icon: Users,           roles: ['customer_admin', 'fleet_manager', 'captain'] },
  { id: 'crew',                   labelKey: 'nav.crew',                  icon: Users2,          roles: ['customer_admin', 'fleet_manager', 'captain', ...CREW_ROLES] },
  { id: 'maintenance',            labelKey: 'nav.maintenance',           icon: Wrench,          roles: ['customer_admin', 'standard_user', ...FLEET_ROLES, ...CREW_ROLES] },
  { id: 'inventory',              labelKey: 'nav.inventory',             icon: Package,         roles: ['customer_admin', 'standard_user', ...FLEET_ROLES, ...CREW_ROLES] },
  { id: 'equipment',              labelKey: 'nav.equipment',             icon: Boxes,           roles: ['customer_admin', 'standard_user', ...FLEET_ROLES, ...CREW_ROLES] },
  { id: 'history',                labelKey: 'nav.history',               icon: History,         roles: ['customer_admin', 'standard_user', ...FLEET_ROLES, ...CREW_ROLES] },
  { id: 'fuel',                   labelKey: 'nav.fuel',                  icon: Fuel,            roles: ['customer_admin', 'standard_user', ...FLEET_ROLES, 'chief_engineer', 'engineer'] },
  { id: 'procurement',             labelKey: 'nav.procurement',           icon: ShoppingCart,     roles: ['customer_admin', 'standard_user', ...FLEET_ROLES, 'chief_engineer', 'chief_stew', 'deck_officer', 'chef', 'safety_officer'] },
  { id: 'costs',                  labelKey: 'nav.costs',                 icon: DollarSign,      roles: ['standard_user', 'captain', 'chief_engineer', 'chief_stew', 'deck_officer', 'chef', 'safety_officer'] },
  { id: 'budget',                 labelKey: 'nav.budget',                icon: DollarSign,      roles: ['captain'] },
  { id: 'compliance',             labelKey: 'nav.compliance',            icon: ShieldCheck,     roles: ['customer_admin', 'standard_user', ...FLEET_ROLES, ...CREW_ROLES] },
  // ── Contractors — fleet_manager / customer_admin primario, captain en More ──
  { id: 'contractors',            labelKey: 'nav.contractors',           icon: Building2,       roles: ['customer_admin', 'fleet_manager', 'captain'] },
  { id: 'manuals',                labelKey: 'nav.manuals',               icon: FolderOpen,      roles: ['customer_admin', 'standard_user', ...FLEET_ROLES, ...CREW_ROLES] },
  { id: 'settings',               labelKey: 'nav.settings',              icon: Settings,        roles: [...FULL_ACCESS_ROLES, ...FLEET_ROLES, ...CREW_ROLES] },
];

// ── Items primarios para fleet manager — siempre visibles ─────────────────
const FLEET_MANAGER_PRIMARY = [
  'dashboard',      // Fleet Overview (relabelado)
  'financials',     // Financials
  'procurement',    // Purchase Requests / Orders
  'vessels',        // Vessels
  'users-customer', // Users
  'crew',           // Crew Management
  'compliance',     // Compliance
  'contractors',    // Preferred Contractors
  'settings',       // Settings — siempre al final
];

// ── Items secundarios para fleet manager — bajo "More" ────────────────────
const FLEET_MANAGER_SECONDARY = [
  'maintenance',
  'inventory',
  'equipment',
  'history',
  'fuel',
  'manuals',
];

const SidebarContent: React.FC<SidebarProps & { onClose?: () => void }> = ({
  currentPage, onNavigate, onClose, userDepartment, userRole,
}) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [showMore, setShowMore] = useState(false);

  const role           = userRole || currentUser?.role || '';
  const isFleetManager = FLEET_MANAGER_ROLES.includes(role);

  const filteredNavItems = navItems
    .filter(item => {
      if (!currentUser) return false;
      if (!item.roles.includes(role)) return false;
      if (item.id === 'fleet-overview' && currentUser.vessel_ids.length <= 1) return false;
      return true;
    })
    .reduce((acc, item) => {
      const existing = acc.find(i => i.labelKey === item.labelKey && i.id !== item.id);
      if (!existing) acc.push(item);
      return acc;
    }, [] as NavItem[]);

  // Para fleet manager: separar primary y secondary
  const primaryItems   = isFleetManager
    ? filteredNavItems.filter(item => FLEET_MANAGER_PRIMARY.includes(item.id))
    : filteredNavItems;

  const secondaryItems = isFleetManager
    ? filteredNavItems.filter(item => FLEET_MANAGER_SECONDARY.includes(item.id))
    : [];

  // Si la página activa está en secondary, abrir "More" automáticamente
  const activeIsInSecondary = secondaryItems.some(item => {
    const pageToCheck = item.id === 'users-customer' ? 'users' : item.id;
    return currentPage === pageToCheck;
  });

  const isMoreOpen = showMore || activeIsInSecondary;

  const handleNavClick = (itemId: string) => {
    onNavigate(itemId === 'users-customer' ? 'users' : itemId);
    onClose?.();
  };

  const getLabel = (item: NavItem) => {
    if (item.id === 'dashboard' && isFleetManager) return t('nav.fleetOverview');
    if (item.id === 'contractors') return 'Contractors';
    return t(item.labelKey);
  };

  const deptColors: Record<string, string> = {
    Engineering: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
    Deck:        'bg-blue-500/15 text-blue-400 border-blue-500/25',
    Interior:    'bg-purple-500/15 text-purple-400 border-purple-500/25',
    Galley:      'bg-green-500/15 text-green-400 border-green-500/25',
    Safety:      'bg-red-500/15 text-red-400 border-red-500/25',
  };

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const pageToCheck = item.id === 'users-customer' ? 'users' : item.id;
    const isActive = currentPage === pageToCheck;
    return (
      <li key={item.id}>
        <button
          onClick={() => handleNavClick(item.id)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-200 text-left group
            ${isActive
              ? 'bg-gradient-to-r from-sky-500/20 to-cyan-500/10 text-white border border-cyan-500/30 shadow-sm'
              : 'text-slate-400 hover:bg-white/[0.05] hover:text-white border border-transparent'
            }`}
        >
          <Icon className={`w-5 h-5 transition-colors flex-shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
          <span className="font-medium">{getLabel(item)}</span>
          {item.badge && (
            <span className="ml-auto px-2 py-0.5 bg-cyan-500/10 text-cyan-400 text-xs rounded-full font-medium border border-cyan-500/20">
              {item.badge}
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#05111e]">
      {/* ── Logo ── */}
      <div className="p-6 border-b border-white/[0.07]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Ship className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Nautium</h1>
              {userDepartment ? (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${deptColors[userDepartment] || 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'}`}>
                  {userDepartment}
                </span>
              ) : isFleetManager ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                  Fleet Management
                </span>
              ) : (
                <p className="text-xs text-slate-400">{t('login.subtitle')}</p>
              )}
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/[0.06] transition-colors text-slate-400 hover:text-white lg:hidden">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {/* Items primarios — sin settings */}
          {primaryItems
            .filter(item => item.id !== 'settings')
            .map(renderNavItem)}

          {/* ── Sección "More" — solo fleet manager ── */}
          {isFleetManager && secondaryItems.length > 0 && (
            <>
              <li>
                <div className="my-2 h-px bg-white/[0.05]" />
                <button
                  onClick={() => setShowMore(!isMoreOpen)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all text-left text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] border border-transparent"
                >
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {isMoreOpen
                      ? <ChevronUp className="w-4 h-4" />
                      : <ChevronDown className="w-4 h-4" />
                    }
                  </div>
                  <span className="text-sm font-medium">
                    {isMoreOpen ? 'Show less' : 'More'}
                  </span>
                  {!isMoreOpen && activeIsInSecondary && (
                    <span className="ml-auto w-2 h-2 bg-cyan-400 rounded-full" />
                  )}
                </button>
              </li>

              {isMoreOpen && (
                <>
                  {secondaryItems.map(item => {
                    const Icon = item.icon;
                    const pageToCheck = item.id === 'users-customer' ? 'users' : item.id;
                    const isActive = currentPage === pageToCheck;
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => handleNavClick(item.id)}
                          className={`w-full flex items-center gap-3 px-4 py-2 rounded-2xl transition-all duration-200 text-left group
                            ${isActive
                              ? 'bg-gradient-to-r from-sky-500/20 to-cyan-500/10 text-white border border-cyan-500/30 shadow-sm'
                              : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300 border border-transparent'
                            }`}
                        >
                          <Icon className={`w-4 h-4 transition-colors flex-shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
                          <span className="text-sm font-medium">{t(item.labelKey)}</span>
                        </button>
                      </li>
                    );
                  })}
                  <li><div className="my-2 h-px bg-white/[0.05]" /></li>
                </>
              )}
            </>
          )}

          {/* Settings — siempre al final */}
          {primaryItems
            .filter(item => item.id === 'settings')
            .map(renderNavItem)}
        </ul>
      </nav>

      {/* ── Footer ── */}
      <div className="p-4 border-t border-white/[0.07] space-y-3">
        {(isFleetManager || role === 'captain') && (
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('nautium:open-tour'));
              onClose?.();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-cyan-500/15 to-sky-500/10 border border-cyan-500/25 text-cyan-400 hover:from-cyan-500/25 hover:to-sky-500/20 transition-all text-left group"
          >
            <Compass className="w-5 h-5 text-cyan-400 group-hover:rotate-45 transition-transform" />
            <div>
              <p className="text-sm font-semibold">Take a Tour</p>
              <p className="text-[11px] text-slate-500">Explore the platform</p>
            </div>
          </button>
        )}
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('nautium:open-support'));
            onClose?.();
          }}
          className="w-full bg-gradient-to-br from-sky-500/10 to-cyan-500/5 rounded-2xl p-4 border border-cyan-500/20 text-left hover:from-sky-500/20 hover:to-cyan-500/10 transition-all"
        >
          <p className="text-sm font-medium text-white/90">{t('nav.needHelp')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('nav.contactSupport')}</p>
        </button>
      </div>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage, onNavigate, mobileOpen = false, onMobileClose, userDepartment, userRole,
}) => {
  return (
    <>
      <aside className="hidden lg:flex w-64 flex-col h-screen fixed left-0 top-0 bg-[#05111e] border-r border-white/[0.07]">
        <SidebarContent currentPage={currentPage} onNavigate={onNavigate} userDepartment={userDepartment} userRole={userRole} />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onMobileClose} />
      )}
      <aside className={`fixed top-0 left-0 h-full w-72 bg-[#05111e] z-50 shadow-2xl border-r border-white/[0.07] transform transition-transform duration-300 ease-in-out lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent currentPage={currentPage} onNavigate={onNavigate} onClose={onMobileClose} userDepartment={userDepartment} userRole={userRole} />
      </aside>
    </>
  );
};
