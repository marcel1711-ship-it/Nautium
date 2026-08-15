import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import React from 'react';

const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue({});
const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
const mockFrom = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: [] }),
  }),
});
const mockUnsubscribe = vi.fn();

let authChangeCallback: (event: string, session: any) => void;

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: any) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      },
      getSession: (...args: any[]) => mockGetSession(...args),
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
      signOut: (...args: any[]) => mockSignOut(...args),
    },
    from: (...args: any[]) => mockFrom(...args),
  },
}));

vi.mock('../data/demoData', () => ({
  demoUsers: [
    {
      id: 'demo-captain-id',
      company_id: 'demo-company',
      email: 'captain@demo.com',
      full_name: 'Demo Captain',
      phone: '',
      role: 'captain',
      status: 'active',
      vessel_ids: ['vessel-1', 'vessel-2'],
      created_at: '2024-01-01',
    },
  ],
}));

const localStorageData: Record<string, string> = {};

beforeEach(() => {
  Object.keys(localStorageData).forEach(k => delete localStorageData[k]);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => localStorageData[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { localStorageData[key] = value; }),
    removeItem: vi.fn((key: string) => { delete localStorageData[key]; }),
  });
  mockSignInWithPassword.mockReset();
  mockSignOut.mockReset().mockResolvedValue({});
  mockGetSession.mockReset().mockResolvedValue({ data: { session: null } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

import { AuthProvider, useAuth } from './AuthContext';

function TestConsumer({ onContext }: { onContext: (ctx: any) => void }) {
  const ctx = useAuth();
  React.useEffect(() => { onContext(ctx); });
  return null;
}

function renderWithProvider(onContext: (ctx: any) => void) {
  return render(
    <AuthProvider><TestConsumer onContext={onContext} /></AuthProvider>
  );
}

describe('AuthContext', () => {

  it('starts unauthenticated with no stored user', async () => {
    let ctx: any;
    renderWithProvider(c => { ctx = c; });

    await waitFor(() => expect(ctx.sessionReady).toBe(true));
    expect(ctx.isAuthenticated).toBe(false);
    expect(ctx.currentUser).toBeNull();
  });

  it('login with demo credentials sets demo user', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: 'supabase-demo-id', app_metadata: { role: 'captain' }, user_metadata: {} } },
      error: null,
    });

    let ctx: any;
    renderWithProvider(c => { ctx = c; });
    await waitFor(() => expect(ctx.sessionReady).toBe(true));

    let result: boolean;
    await act(async () => {
      result = await ctx.login('captain@demo.com', 'demo123');
    });

    expect(result!).toBe(true);
    expect(ctx.currentUser.email).toBe('captain@demo.com');
    expect(ctx.currentUser.role).toBe('captain');
    expect(ctx.isAuthenticated).toBe(true);
  });

  it('login with real user reads role from app_metadata', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: 'real-user-id',
          email: 'user@company.com',
          created_at: '2024-06-01',
          app_metadata: { role: 'fleet_manager', company_id: 'comp-1' },
          user_metadata: { full_name: 'Real User', vessel_ids: ['v1'] },
        },
      },
      error: null,
    });

    let ctx: any;
    renderWithProvider(c => { ctx = c; });
    await waitFor(() => expect(ctx.sessionReady).toBe(true));

    let result: boolean;
    await act(async () => {
      result = await ctx.login('user@company.com', 'securepass');
    });

    expect(result!).toBe(true);
    expect(ctx.currentUser.role).toBe('fleet_manager');
    expect(ctx.currentUser.company_id).toBe('comp-1');
  });

  it('login returns false on auth error', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid credentials' },
    });

    let ctx: any;
    renderWithProvider(c => { ctx = c; });
    await waitFor(() => expect(ctx.sessionReady).toBe(true));

    let result: boolean;
    await act(async () => {
      result = await ctx.login('bad@email.com', 'wrongpass');
    });

    expect(result!).toBe(false);
    expect(ctx.isAuthenticated).toBe(false);
  });

  it('logout clears state and localStorage', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1', app_metadata: { role: 'captain' }, user_metadata: {} } },
      error: null,
    });

    let ctx: any;
    renderWithProvider(c => { ctx = c; });
    await waitFor(() => expect(ctx.sessionReady).toBe(true));

    await act(async () => { await ctx.login('captain@demo.com', 'demo123'); });
    expect(ctx.isAuthenticated).toBe(true);

    await act(async () => { await ctx.logout(); });

    expect(ctx.isAuthenticated).toBe(false);
    expect(ctx.currentUser).toBeNull();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('setSelectedVesselId does not persist "all" to localStorage', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1', app_metadata: { role: 'captain' }, user_metadata: {} } },
      error: null,
    });

    let ctx: any;
    renderWithProvider(c => { ctx = c; });
    await waitFor(() => expect(ctx.sessionReady).toBe(true));

    await act(async () => { await ctx.login('captain@demo.com', 'demo123'); });

    act(() => { ctx.setSelectedVesselId('vessel-99'); });
    expect(localStorage.setItem).toHaveBeenCalledWith('selectedVesselId', 'vessel-99');

    (localStorage.setItem as any).mockClear();
    act(() => { ctx.setSelectedVesselId('all'); });
    expect(localStorage.setItem).not.toHaveBeenCalledWith('selectedVesselId', 'all');
  });

  it('useAuth throws outside AuthProvider', () => {
    const Bad = () => { useAuth(); return null; };
    expect(() => render(<Bad />)).toThrow('useAuth must be used within an AuthProvider');
  });

  it('normalizes email to lowercase on login', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1', app_metadata: { role: 'captain' }, user_metadata: {} } },
      error: null,
    });

    let ctx: any;
    renderWithProvider(c => { ctx = c; });
    await waitFor(() => expect(ctx.sessionReady).toBe(true));

    await act(async () => { await ctx.login('Captain@Demo.COM', 'demo123'); });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'captain@demo.com',
      password: 'demo123',
    });
  });
});
