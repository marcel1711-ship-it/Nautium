import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzeGpiZ29weHhidGlkbGtrYWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTQ4NDQsImV4cCI6MjA5MzU3MDg0NH0.6EHgsE9jvSyfC9aNDuq4bTOCj3r4qWS-OHlM5fS7-U4';
const FAKE_JWT = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.fake';
const EDGE_URL = 'https://fsxjbgopxxbtidlkkafc.supabase.co/functions/v1/get-company-data';

let authChangeCallback: (event: string, session: any) => void;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: (cb: any) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('supabase data layer', () => {

  it('waits for auth init before making edge function calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [{ id: '1' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchByCompany } = await import('./supabase');

    const resultPromise = fetchByCompany('vessels', 'company-123');

    await new Promise(r => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();

    authChangeCallback('SIGNED_IN', { access_token: FAKE_JWT });

    const result = await resultPromise;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: '1' }]);
  });

  it('uses cached token from onAuthStateChange', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchByCompany } = await import('./supabase');

    authChangeCallback('SIGNED_IN', { access_token: FAKE_JWT });
    await fetchByCompany('vessels', 'c1');

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(EDGE_URL);
    expect(opts.headers['Authorization']).toBe(`Bearer ${FAKE_JWT}`);
    expect(opts.headers['apikey']).toBe(ANON_KEY);
  });

  it('falls back to localStorage when session is null', async () => {
    const storedSession = JSON.stringify({ access_token: 'ls-token-123' });
    (localStorage.getItem as any).mockReturnValue(storedSession);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchByCompany } = await import('./supabase');

    authChangeCallback('SIGNED_OUT', null);
    await fetchByCompany('vessels', 'c1');

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers['Authorization']).toBe('Bearer ls-token-123');
  });

  it('falls back to anon key when no session and no localStorage', async () => {
    (localStorage.getItem as any).mockReturnValue(null);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchByCompany } = await import('./supabase');

    authChangeCallback('SIGNED_OUT', null);
    await fetchByCompany('vessels', 'c1');

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers['Authorization']).toBe(`Bearer ${ANON_KEY}`);
  });

  it('retries on 401/403 response', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 403, json: () => Promise.resolve({ error: 'Unauthorized' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ data: [{ id: '1' }] }) });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchByCompany } = await import('./supabase');

    authChangeCallback('SIGNED_IN', { access_token: FAKE_JWT });
    const result = await fetchByCompany('vessels', 'c1');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual([{ id: '1' }]);
  });

  it('returns empty array when edge function returns no data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchByCompany } = await import('./supabase');

    authChangeCallback('SIGNED_IN', { access_token: FAKE_JWT });
    const result = await fetchByCompany('vessels', 'c1');

    expect(result).toEqual([]);
  });

  it('sends correct body for fetchByCompany', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchByCompany } = await import('./supabase');

    authChangeCallback('SIGNED_IN', { access_token: FAKE_JWT });
    await fetchByCompany('maintenance_tasks', 'company-abc', 'next_due_date', true);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      action: 'select',
      table: 'maintenance_tasks',
      company_id: 'company-abc',
      filters: { order_by: 'next_due_date', ascending: true },
    });
  });

  it('dbInsert throws on error response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ error: 'Duplicate key' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { dbInsert } = await import('./supabase');

    authChangeCallback('SIGNED_IN', { access_token: FAKE_JWT });
    await expect(dbInsert('vessels', { name: 'Test' })).rejects.toThrow('Duplicate key');
  });

  it('dbUpdate sends correct payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { id: '1', name: 'Updated' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { dbUpdate } = await import('./supabase');

    authChangeCallback('SIGNED_IN', { access_token: FAKE_JWT });
    await dbUpdate('vessels', 'vessel-1', { name: 'Updated' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      action: 'update',
      table: 'vessels',
      id: 'vessel-1',
      data: { name: 'Updated' },
    });
  });

  it('dbDelete sends correct payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { dbDelete } = await import('./supabase');

    authChangeCallback('SIGNED_IN', { access_token: FAKE_JWT });
    await dbDelete('vessels', 'vessel-1');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ action: 'delete', table: 'vessels', id: 'vessel-1' });
  });
});
