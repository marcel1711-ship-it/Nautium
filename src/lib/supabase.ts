import { createClient } from '@supabase/supabase-js';
import {
  buildCacheKey, getCachedData, setCachedData,
  addToSyncQueue,
  updateCachedRecord, insertCachedRecord, deleteCachedRecord,
} from './offlineStore';

export const SUPABASE_URL = 'https://fsxjbgopxxbtidlkkafc.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzeGpiZ29weHhidGlkbGtrYWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTQ4NDQsImV4cCI6MjA5MzU3MDg0NH0.6EHgsE9jvSyfC9aNDuq4bTOCj3r4qWS-OHlM5fS7-U4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const EDGE_URL = `${SUPABASE_URL}/functions/v1/get-company-data`;

let cachedToken: string | null = null;
let authInitResolve: () => void;
const authInit = new Promise<void>(resolve => { authInitResolve = resolve; });

supabase.auth.onAuthStateChange((_event, session) => {
  cachedToken = session?.access_token ?? null;
  authInitResolve();
});

async function getEdgeHeaders(): Promise<Record<string, string>> {
  await authInit;
  let token = cachedToken;

  if (!token) {
    try {
      const stored = localStorage.getItem('sb-fsxjbgopxxbtidlkkafc-auth-token');
      if (stored) {
        token = JSON.parse(stored).access_token;
      }
    } catch { /* ignore */ }
  }

  if (!token) {
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token ?? null;
      if (token) cachedToken = token;
    } catch { /* ignore */ }
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token ?? SUPABASE_ANON_KEY}`,
    'apikey': SUPABASE_ANON_KEY,
  };
}

async function edgeFetch(body: Record<string, any>): Promise<any> {
  let headers = await getEdgeHeaders();
  let res = await fetch(EDGE_URL, { method: 'POST', headers, body: JSON.stringify(body) });

  if (res.status === 401 || res.status === 403) {
    cachedToken = null;
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session) {
        cachedToken = data.session.access_token;
      }
    } catch { /* ignore */ }
    headers = await getEdgeHeaders();
    res = await fetch(EDGE_URL, { method: 'POST', headers, body: JSON.stringify(body) });
  }

  return res.json();
}

// ── Reads with offline cache ─────────────────────────────────────────────────

export async function fetchByCompany(
  table: string,
  company_id: string,
  order_by?: string,
  ascending = true
): Promise<any[]> {
  const cacheKey = buildCacheKey(table, company_id, order_by ? { order_by, ascending: String(ascending) } : undefined);

  if (!navigator.onLine) {
    const cached = await getCachedData(cacheKey);
    return cached?.data ?? [];
  }

  try {
    const json = await edgeFetch({ action: 'select', table, company_id, filters: order_by ? { order_by, ascending } : undefined });
    const data = json.data || [];
    setCachedData(cacheKey, data);
    return data;
  } catch {
    const cached = await getCachedData(cacheKey);
    return cached?.data ?? [];
  }
}

export async function fetchByVessel(
  table: string,
  vessel_id: string,
  options?: {
    date_field?: string; date_from?: string; date_to?: string;
    extra_filters?: Record<string, any>;
    order_by?: string; ascending?: boolean;
    limit?: number; select_cols?: string;
  }
): Promise<any[]> {
  const cacheKey = buildCacheKey(table, vessel_id, { scope: 'vessel', ...(options || {}) });

  if (!navigator.onLine) {
    const cached = await getCachedData(cacheKey);
    return cached?.data ?? [];
  }

  try {
    const json = await edgeFetch({
      action: 'select_by_vessel', table, vessel_id,
      ...(options || {}),
    });
    const data = json.data || [];
    setCachedData(cacheKey, data);
    return data;
  } catch {
    const cached = await getCachedData(cacheKey);
    return cached?.data ?? [];
  }
}

export async function fetchSingle(
  table: string,
  id: string
): Promise<any | null> {
  const cacheKey = buildCacheKey(table, id, { scope: 'single' });

  if (!navigator.onLine) {
    const cached = await getCachedData(cacheKey);
    return cached?.data ?? null;
  }

  try {
    const json = await edgeFetch({ action: 'select_single', table, id });
    const data = json.data ?? null;
    setCachedData(cacheKey, data);
    return data;
  } catch {
    const cached = await getCachedData(cacheKey);
    return cached?.data ?? null;
  }
}

interface AdvancedFilter {
  field: string;
  op: 'eq' | 'neq' | 'in' | 'gte' | 'lte' | 'not_null' | 'is_null';
  value?: any;
}

export async function fetchFiltered(
  table: string,
  company_id: string,
  advanced_filters?: AdvancedFilter[],
  options?: { order_by?: string; ascending?: boolean; limit?: number; select_cols?: string }
): Promise<any[]> {
  const cacheKey = buildCacheKey(table, company_id, {
    scope: 'filtered',
    filters: JSON.stringify(advanced_filters || []),
    ...(options || {}),
  });

  if (!navigator.onLine) {
    const cached = await getCachedData(cacheKey);
    return cached?.data ?? [];
  }

  try {
    const json = await edgeFetch({
      action: 'select_filtered', table, company_id,
      advanced_filters,
      ...(options || {}),
    });
    const data = json.data || [];
    setCachedData(cacheKey, data);
    return data;
  } catch {
    const cached = await getCachedData(cacheKey);
    return cached?.data ?? [];
  }
}

// ── Writes with offline queue ────────────────────────────────────────────────

export async function dbInsert(table: string, data: Record<string, any>): Promise<any> {
  if (!navigator.onLine) {
    const offlineRecord = { ...data, id: `offline-${Date.now()}`, _offline: true };
    await addToSyncQueue({ action: 'insert', table, payload: { data } });
    await insertCachedRecord(table, offlineRecord);
    return offlineRecord;
  }

  try {
    const json = await edgeFetch({ action: 'insert', table, data });
    if (json.error) throw new Error(json.error);
    return json.data;
  } catch (err) {
    if (!navigator.onLine) {
      const offlineRecord = { ...data, id: `offline-${Date.now()}`, _offline: true };
      await addToSyncQueue({ action: 'insert', table, payload: { data } });
      await insertCachedRecord(table, offlineRecord);
      return offlineRecord;
    }
    throw err;
  }
}

export async function dbUpdate(table: string, id: string, data: Record<string, any>): Promise<any> {
  if (!navigator.onLine) {
    await addToSyncQueue({ action: 'update', table, payload: { id, data } });
    await updateCachedRecord(table, id, data);
    return { ...data, id, _offline: true };
  }

  try {
    const json = await edgeFetch({ action: 'update', table, id, data });
    if (json.error) throw new Error(json.error);
    return json.data;
  } catch (err) {
    if (!navigator.onLine) {
      await addToSyncQueue({ action: 'update', table, payload: { id, data } });
      await updateCachedRecord(table, id, data);
      return { ...data, id, _offline: true };
    }
    throw err;
  }
}

export async function dbDelete(table: string, id: string): Promise<void> {
  if (!navigator.onLine) {
    await addToSyncQueue({ action: 'delete', table, payload: { id } });
    await deleteCachedRecord(table, id);
    return;
  }

  try {
    const json = await edgeFetch({ action: 'delete', table, id });
    if (json.error) throw new Error(json.error);
  } catch (err) {
    if (!navigator.onLine) {
      await addToSyncQueue({ action: 'delete', table, payload: { id } });
      await deleteCachedRecord(table, id);
      return;
    }
    throw err;
  }
}

export async function dbDeleteWhere(table: string, field: string, value: string): Promise<void> {
  if (!navigator.onLine) {
    await addToSyncQueue({ action: 'delete_where', table, payload: { field, value } });
    return;
  }

  try {
    const json = await edgeFetch({ action: 'delete_where', table, field, value });
    if (json.error) throw new Error(json.error);
  } catch (err) {
    if (!navigator.onLine) {
      await addToSyncQueue({ action: 'delete_where', table, payload: { field, value } });
      return;
    }
    throw err;
  }
}
