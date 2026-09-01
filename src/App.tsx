import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import { Ship, Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LanguageProvider } from './contexts/LanguageContext';
import { Sidebar } from './components/Layout/Sidebar';
import { Header } from './components/Layout/Header';
import { ToastProvider } from './components/UI/Toast';
import { getRoleDepartment, UserRole } from './types';

const Landing = lazy(() => import('./pages/Landing').then(m => ({ default: m.Landing })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Onboarding = lazy(() => import('./pages/Onboarding').then(m => ({ default: m.Onboarding })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard').then(m => ({ default: m.OwnerDashboard })));
const Maintenance = lazy(() => import('./pages/Maintenance').then(m => ({ default: m.Maintenance })));
const Inventory = lazy(() => import('./pages/Inventory').then(m => ({ default: m.Inventory })));
const InventoryDetail = lazy(() => import('./pages/InventoryDetail').then(m => ({ default: m.InventoryDetail })));
const LocationView = lazy(() => import('./pages/LocationView').then(m => ({ default: m.LocationView })));
const History = lazy(() => import('./pages/History').then(m => ({ default: m.History })));
const Equipment = lazy(() => import('./pages/Equipment').then(m => ({ default: m.Equipment })));
const WaterToys = lazy(() => import('./pages/WaterToys').then(m => ({ default: m.WaterToys })));
const Manuals = lazy(() => import('./pages/Manuals').then(m => ({ default: m.Manuals })));
const Vessels = lazy(() => import('./pages/Vessels').then(m => ({ default: m.Vessels })));
const Customers = lazy(() => import('./pages/Customers').then(m => ({ default: m.Customers })));
const OnboardingSubmissions = lazy(() => import('./pages/OnboardingSubmissions').then(m => ({ default: m.OnboardingSubmissions })));
const Users = lazy(() => import('./pages/Users').then(m => ({ default: m.Users })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Fuel = lazy(() => import('./pages/Fuel').then(m => ({ default: m.Fuel })));
const Costs = lazy(() => import('./pages/Costs').then(m => ({ default: m.Costs })));
const FleetOverview = lazy(() => import('./pages/FleetOverview').then(m => ({ default: m.FleetOverview })));
const Compliance = lazy(() => import('./pages/Compliance').then(m => ({ default: m.Compliance })));
const Budget = lazy(() => import('./pages/Budget').then(m => ({ default: m.Budget })));
const Financials = lazy(() => import('./pages/Financials').then(m => ({ default: m.Financials })));
const Contractors = lazy(() => import('./pages/Contractors').then(m => ({ default: m.Contractors })));
const Crew = lazy(() => import('./pages/Crew').then(m => ({ default: m.Crew })));
const GuestList = lazy(() => import('./pages/GuestList').then(m => ({ default: m.GuestList })));
const Procurement = lazy(() => import('./pages/Procurement').then(m => ({ default: m.Procurement })));
const NautiusChat = lazy(() => import('./components/NautiusChat').then(m => ({ default: m.NautiusChat })));
const WelcomeGuide = lazy(() => import('./components/WelcomeGuide').then(m => ({ default: m.WelcomeGuide })));
const SupportModal = lazy(() => import('./components/SupportModal').then(m => ({ default: m.SupportModal })));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
  </div>
);

const OWNER_ROLES: UserRole[]        = ['owner'];
const ADMIN_ROLES: UserRole[]        = ['master_admin', 'customer_admin'];
const FULL_CREW_ROLES: UserRole[]    = ['fleet_manager', 'captain'];
const FLEET_MANAGER_ROLES: UserRole[]= ['fleet_manager', 'customer_admin'];
const CAPTAIN_ROLES: UserRole[]      = ['captain'];
const DEPT_ROLES: UserRole[]         = [
  'chief_engineer', 'engineer',
  'chief_stew',
  'deck_officer',
  'chef',
  'safety_officer',
  'crew',
];

const PAGES_REQUIRING_VESSEL = [
  'dashboard',
];

const AppContent: React.FC = () => {
  const { isAuthenticated, currentUser, selectedVesselId, setSelectedVesselId } = useAuth();
  const location = useLocation();
  const nav = useNavigate();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [pageParams, setPageParams] = useState<any>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const programmaticNav = useRef(false);

  // ── Derive currentPage from URL ──────────────────────────────────────
  const currentPage = location.pathname.replace(/^\//, '') || 'dashboard';

  // ── QR deep-link redirect: /?location=xxx → /location-view?location=xxx
  useEffect(() => {
    if (location.pathname === '/' && location.search) {
      const params = new URLSearchParams(location.search);
      const loc = params.get('location');
      if (loc) {
        nav(`/location-view?location=${encodeURIComponent(loc)}`, { replace: true });
      }
    }
  }, []);

  // ── Welcome Guide (tour) ─────────────────────────────────────────────
  const guideKey = currentUser ? `nautium_guide_seen_${currentUser.id}` : '';
  useEffect(() => {
    if (!currentUser) return;
    const r = currentUser.role;
    if (r === 'fleet_manager' || r === 'captain' || r === 'customer_admin') {
      if (!localStorage.getItem(guideKey)) setShowGuide(true);
    }
  }, [currentUser]);

  useEffect(() => {
    const openTour = () => setShowGuide(true);
    const openSupport = () => setShowSupport(true);
    window.addEventListener('nautium:open-tour', openTour);
    window.addEventListener('nautium:open-support', openSupport);
    return () => {
      window.removeEventListener('nautium:open-tour', openTour);
      window.removeEventListener('nautium:open-support', openSupport);
    };
  }, []);

  // ── Sync pageParams from URL on browser back/forward ─────────────────
  useEffect(() => {
    if (programmaticNav.current) {
      programmaticNav.current = false;
      return;
    }
    const searchParams = new URLSearchParams(location.search);
    const urlParams: Record<string, string> = {};
    searchParams.forEach((value, key) => { urlParams[key] = value; });
    setPageParams(Object.keys(urlParams).length > 0 ? urlParams : null);
  }, [location]);

  // ── Navigate: updates URL + keeps params for child components ────────
  const handleNavigate = (page: string, params?: any) => {
    programmaticNav.current = true;
    setPageParams(params || null);

    let url = `/${page}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && typeof value !== 'object') {
          searchParams.set(key, String(value));
        }
      });
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }
    nav(url);
    setMobileSidebarOpen(false);
  };

  const handleLogin = () => {
    if (currentPage && currentPage !== 'login' && currentPage !== 'dashboard') {
      // User was on a deep link, stay there
    } else {
      nav('/dashboard');
    }
  };

  // ── Unauthenticated: Landing / Login ────────────────────────────────
  if (!isAuthenticated) {
    if (showLanding) return <Suspense fallback={<PageLoader />}><Landing onEnterApp={() => setShowLanding(false)} /></Suspense>;
    return <Suspense fallback={<PageLoader />}><Login onLogin={handleLogin} onBack={() => setShowLanding(true)} /></Suspense>;
  }

  const role = currentUser?.role as UserRole;

  if (OWNER_ROLES.includes(role)) {
    return (
      <Suspense fallback={<PageLoader />}>
        <div className="min-h-screen">
          <OwnerDashboard onNavigate={handleNavigate} />
          <NautiusChat />
        </div>
      </Suspense>
    );
  }

  const userDepartment    = getRoleDepartment(role);
  const isAdminRole       = ADMIN_ROLES.includes(role);
  const isFullCrewRole    = FULL_CREW_ROLES.includes(role);
  const isFleetManagerRole= FLEET_MANAGER_ROLES.includes(role);
  const isCaptainOnly     = role === 'captain';
  const isDeptRole        = DEPT_ROLES.includes(role);

  const renderPage = () => {

    // ── Guard "All Fleet" ────────────────────────────────────────────────
    if (selectedVesselId === 'all' && PAGES_REQUIRING_VESSEL.includes(currentPage)) {
      if (isAdminRole || isFleetManagerRole) {
        return <FleetOverview onNavigate={handleNavigate} />;
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Ship className="w-8 h-8 text-slate-400" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-700">Select a specific vessel</p>
            <p className="text-sm text-slate-400 mt-1">
              Choose a vessel from the selector in the top bar to view this section.
            </p>
          </div>
        </div>
      );
    }

    // ── Dept role blocked pages ──────────────────────────────────────────
    if (isDeptRole) {
      const blockedPages = [
        'customers', 'vessels', 'users',
        'onboarding-submissions', 'fleet-overview',
        'budget', 'financials', 'contractors',
      ];
      if (blockedPages.includes(currentPage)) {
        return <Dashboard onNavigate={handleNavigate} />;
      }
    }

    // ── Router ───────────────────────────────────────────────────────────
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;

      case 'maintenance':
        return (
          <Maintenance
            onNavigate={handleNavigate}
            params={pageParams}
            departmentFilter={userDepartment ?? undefined}
          />
        );

      case 'inventory':
        return (
          <Inventory
            onNavigate={handleNavigate}
            departmentFilter={userDepartment ?? undefined}
          />
        );

      case 'inventory-detail':
        return <InventoryDetail onNavigate={handleNavigate} params={pageParams} />;

      case 'location-view':
        return <LocationView onNavigate={handleNavigate} location={pageParams?.location || ''} />;

      case 'history':
        return <History onNavigate={handleNavigate} params={pageParams} />;

      case 'equipment':
        return (
          <Equipment
            onNavigate={handleNavigate}
            params={pageParams}
            departmentFilter={userDepartment ?? undefined}
          />
        );

      case 'water-toys':
        return <WaterToys onNavigate={handleNavigate} params={pageParams} />;

      case 'manuals':
        return <Manuals onNavigate={handleNavigate} />;

      case 'fuel':
        return <Fuel onNavigate={handleNavigate} params={pageParams} />;

      case 'procurement':
        return <Procurement onNavigate={handleNavigate} />;

      case 'costs':
        return (
          <Costs
            onNavigate={handleNavigate}
            params={pageParams}
            departmentFilter={userDepartment ?? undefined}
          />
        );

      case 'compliance':
        return <Compliance onNavigate={handleNavigate} />;

      case 'budget':
        return isCaptainOnly
          ? <Budget onNavigate={handleNavigate} />
          : <Dashboard onNavigate={handleNavigate} />;

      case 'financials':
        return isFleetManagerRole
          ? <Financials onNavigate={handleNavigate} />
          : <Dashboard onNavigate={handleNavigate} />;

      case 'crew':
        return <Crew onNavigate={handleNavigate} />;

      case 'guest-list':
        return <GuestList onNavigate={handleNavigate} />;

      // ── CONTRACTORS — fleet_manager, customer_admin, captain (read-only) ──
      case 'contractors':
        return isFleetManagerRole || isCaptainOnly
          ? <Contractors onNavigate={handleNavigate} />
          : <Dashboard onNavigate={handleNavigate} />;

      case 'vessels':
        return isAdminRole || isFullCrewRole
          ? <Vessels
              onNavigate={handleNavigate}
              companyId={pageParams?.companyId}
              companyName={pageParams?.companyName}
            />
          : <Dashboard onNavigate={handleNavigate} />;

      case 'customers':
        return isAdminRole
          ? <Customers onNavigate={handleNavigate} />
          : <Dashboard onNavigate={handleNavigate} />;

      case 'onboarding-submissions':
        return isAdminRole
          ? <OnboardingSubmissions onNavigate={handleNavigate} />
          : <Dashboard onNavigate={handleNavigate} />;

      case 'users':
        return isAdminRole || isFullCrewRole
          ? <Users
              onNavigate={handleNavigate}
              companyId={pageParams?.companyId}
              openAddUser={pageParams?.openAddUser}
            />
          : <Dashboard onNavigate={handleNavigate} />;

      case 'fleet-overview':
        return isAdminRole || isFullCrewRole
          ? <FleetOverview onNavigate={handleNavigate} />
          : <Dashboard onNavigate={handleNavigate} />;

      case 'settings':
        return <Settings onNavigate={handleNavigate} />;

      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  if (currentPage === 'location-view') {
    return <Suspense fallback={<PageLoader />}><div className="min-h-screen bg-gray-50">{renderPage()}</div></Suspense>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        userDepartment={userDepartment}
        userRole={role}
      />
      <div className="lg:ml-64">
        <Header
          onNavigate={handleNavigate}
          onMenuToggle={() => setMobileSidebarOpen(prev => !prev)}
        />
        <main className="pt-20 px-4 pb-4 lg:pt-20 lg:px-6 lg:pb-6">
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <div className="max-w-[1600px] mx-auto">{renderPage()}</div>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <Suspense fallback={null}><NautiusChat /></Suspense>
      {showGuide && currentUser && (
        <Suspense fallback={null}>
          <WelcomeGuide
            onClose={() => { setShowGuide(false); localStorage.setItem(guideKey, '1'); }}
            onNavigate={handleNavigate}
            userRole={currentUser.role}
            userName={currentUser.full_name}
          />
        </Suspense>
      )}
      {showSupport && (
        <Suspense fallback={null}>
          <SupportModal onClose={() => setShowSupport(false)} />
        </Suspense>
      )}
    </div>
  );
};

const IS_ONBOARDING = window.location.pathname.startsWith('/onboarding');

function App() {
  if (IS_ONBOARDING) return <Suspense fallback={<PageLoader />}><Onboarding /></Suspense>;
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
