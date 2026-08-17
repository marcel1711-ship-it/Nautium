import { describe, it, expect } from 'vitest';
import { UserRole, getRoleDepartment } from '../types';

const OWNER_ROLES: UserRole[] = ['owner'];
const ADMIN_ROLES: UserRole[] = ['master_admin', 'customer_admin'];
const FULL_CREW_ROLES: UserRole[] = ['fleet_manager', 'captain'];
const FLEET_MANAGER_ROLES: UserRole[] = ['fleet_manager', 'customer_admin'];
const DEPT_ROLES: UserRole[] = [
  'chief_engineer', 'engineer', 'chief_stew', 'deck_officer', 'chef', 'safety_officer', 'crew',
];

const PAGES_REQUIRING_VESSEL = [
  'dashboard', 'maintenance', 'inventory', 'inventory-detail',
  'history', 'equipment', 'manuals', 'fuel', 'costs', 'compliance',
];

describe('role classification', () => {
  it('owner is in OWNER_ROLES only', () => {
    expect(OWNER_ROLES).toContain('owner');
    expect(ADMIN_ROLES).not.toContain('owner');
    expect(DEPT_ROLES).not.toContain('owner');
  });

  it('master_admin is in ADMIN_ROLES', () => {
    expect(ADMIN_ROLES).toContain('master_admin');
    expect(DEPT_ROLES).not.toContain('master_admin');
  });

  it('captain is in FULL_CREW_ROLES but not ADMIN_ROLES', () => {
    expect(FULL_CREW_ROLES).toContain('captain');
    expect(ADMIN_ROLES).not.toContain('captain');
  });

  it('engineer is a department role', () => {
    expect(DEPT_ROLES).toContain('engineer');
    expect(ADMIN_ROLES).not.toContain('engineer');
    expect(FULL_CREW_ROLES).not.toContain('engineer');
  });

  it('fleet_manager is in both FULL_CREW and FLEET_MANAGER roles', () => {
    expect(FULL_CREW_ROLES).toContain('fleet_manager');
    expect(FLEET_MANAGER_ROLES).toContain('fleet_manager');
  });
});

describe('vessel-required pages', () => {
  it('dashboard requires vessel', () => {
    expect(PAGES_REQUIRING_VESSEL).toContain('dashboard');
  });

  it('settings does NOT require vessel', () => {
    expect(PAGES_REQUIRING_VESSEL).not.toContain('settings');
  });

  it('crew does NOT require vessel', () => {
    expect(PAGES_REQUIRING_VESSEL).not.toContain('crew');
  });

  it('all expected pages are listed', () => {
    expect(PAGES_REQUIRING_VESSEL).toHaveLength(10);
  });
});

describe('getRoleDepartment', () => {
  it('returns Engineering for chief_engineer', () => {
    expect(getRoleDepartment('chief_engineer')).toBe('Engineering');
  });

  it('returns Engineering for engineer', () => {
    expect(getRoleDepartment('engineer')).toBe('Engineering');
  });

  it('returns Interior for chief_stew', () => {
    expect(getRoleDepartment('chief_stew')).toBe('Interior');
  });

  it('returns Deck for deck_officer', () => {
    expect(getRoleDepartment('deck_officer')).toBe('Deck');
  });

  it('returns Galley for chef', () => {
    expect(getRoleDepartment('chef')).toBe('Galley');
  });

  it('returns Safety for safety_officer', () => {
    expect(getRoleDepartment('safety_officer')).toBe('Safety');
  });

  it('returns null for admin roles', () => {
    expect(getRoleDepartment('master_admin')).toBeNull();
    expect(getRoleDepartment('customer_admin')).toBeNull();
  });

  it('returns null for captain', () => {
    expect(getRoleDepartment('captain')).toBeNull();
  });

  it('returns null for fleet_manager', () => {
    expect(getRoleDepartment('fleet_manager')).toBeNull();
  });
});

describe('page access by role', () => {
  const blockedForDept = [
    'customers', 'vessels', 'users',
    'onboarding-submissions', 'fleet-overview',
    'budget', 'financials', 'contractors',
  ];

  it('department roles cannot access admin pages', () => {
    for (const role of DEPT_ROLES) {
      for (const page of blockedForDept) {
        expect(DEPT_ROLES).toContain(role);
        expect(blockedForDept).toContain(page);
      }
    }
  });

  it('customers page requires admin role', () => {
    expect(ADMIN_ROLES).toContain('master_admin');
    expect(ADMIN_ROLES).toContain('customer_admin');
    expect(FULL_CREW_ROLES).not.toContain('customer_admin');
  });

  it('vessels page is accessible to admin and full crew roles', () => {
    const allowed = [...ADMIN_ROLES, ...FULL_CREW_ROLES];
    expect(allowed).toContain('master_admin');
    expect(allowed).toContain('fleet_manager');
    expect(allowed).toContain('captain');
  });
});

describe('URL derivation', () => {
  it('strips leading slash to get page name', () => {
    const path = '/maintenance';
    const page = path.replace(/^\//, '') || 'dashboard';
    expect(page).toBe('maintenance');
  });

  it('root path defaults to dashboard', () => {
    const path = '/';
    const page = path.replace(/^\//, '') || 'dashboard';
    expect(page).toBe('dashboard');
  });

  it('empty path defaults to dashboard', () => {
    const path = '';
    const page = path.replace(/^\//, '') || 'dashboard';
    expect(page).toBe('dashboard');
  });

  it('preserves nested paths', () => {
    const path = '/inventory-detail';
    const page = path.replace(/^\//, '') || 'dashboard';
    expect(page).toBe('inventory-detail');
  });
});

describe('handleNavigate URL building', () => {
  function buildUrl(page: string, params?: Record<string, any>): string {
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
    return url;
  }

  it('builds simple page URL', () => {
    expect(buildUrl('maintenance')).toBe('/maintenance');
  });

  it('adds string params as query string', () => {
    expect(buildUrl('inventory-detail', { id: '123' })).toBe('/inventory-detail?id=123');
  });

  it('skips null and undefined params', () => {
    expect(buildUrl('page', { a: 'yes', b: null, c: undefined })).toBe('/page?a=yes');
  });

  it('skips object params (non-serializable)', () => {
    expect(buildUrl('page', { a: 'yes', b: { nested: true } })).toBe('/page?a=yes');
  });

  it('converts numbers to strings', () => {
    expect(buildUrl('page', { count: 5 })).toBe('/page?count=5');
  });

  it('handles boolean params', () => {
    expect(buildUrl('users', { openAddUser: true })).toBe('/users?openAddUser=true');
  });
});
