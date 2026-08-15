import { createClient } from '@supabase/supabase-js';

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
    await new Promise(r => setTimeout(r, 500));
    cachedToken = null;
    headers = await getEdgeHeaders();
    res = await fetch(EDGE_URL, { method: 'POST', headers, body: JSON.stringify(body) });
  }

  return res.json();
}

export async function fetchByCompany(
  table: string,
  company_id: string,
  order_by?: string,
  ascending = true
): Promise<any[]> {
  const json = await edgeFetch({ action: 'select', table, company_id, filters: order_by ? { order_by, ascending } : undefined });
  return json.data || [];
}

export async function dbInsert(table: string, data: Record<string, any>): Promise<any> {
  const json = await edgeFetch({ action: 'insert', table, data });
  if (json.error) throw new Error(json.error);
  return json.data;
}

export async function dbUpdate(table: string, id: string, data: Record<string, any>): Promise<any> {
  const json = await edgeFetch({ action: 'update', table, id, data });
  if (json.error) throw new Error(json.error);
  return json.data;
}

export async function dbDelete(table: string, id: string): Promise<void> {
  const json = await edgeFetch({ action: 'delete', table, id });
  if (json.error) throw new Error(json.error);
}

export async function dbDeleteWhere(table: string, field: string, value: string): Promise<void> {
  const json = await edgeFetch({ action: 'delete_where', table, field, value });
  if (json.error) throw new Error(json.error);
}
