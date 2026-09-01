import { getSyncQueue, removeSyncEntry, updateSyncEntry, type SyncEntry } from './offlineStore';
import { queryClient } from './queryClient';

const SUPABASE_URL = 'https://fsxjbgopxxbtidlkkafc.supabase.co';
const EDGE_URL = `${SUPABASE_URL}/functions/v1/get-company-data`;
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzeGpiZ29weHhidGlkbGtrYWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTQ4NDQsImV4cCI6MjA5MzU3MDg0NH0.6EHgsE9jvSyfC9aNDuq4bTOCj3r4qWS-OHlM5fS7-U4';
const MAX_RETRIES = 3;

type SyncListener = (pending: number) => void;
const listeners = new Set<SyncListener>();

export function onSyncChange(fn: SyncListener) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notify(count: number) {
  listeners.forEach(fn => fn(count));
}

let syncing = false;

function getToken(): string | null {
  try {
    const stored = localStorage.getItem('sb-fsxjbgopxxbtidlkkafc-auth-token');
    if (stored) return JSON.parse(stored).access_token;
  } catch { /* ignore */ }
  return null;
}

async function replayEntry(entry: SyncEntry): Promise<boolean> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token ?? SUPABASE_ANON_KEY}`,
    'apikey': SUPABASE_ANON_KEY,
  };

  const body: Record<string, any> = {
    action: entry.action,
    table: entry.table,
    ...entry.payload,
  };

  try {
    const res = await fetch(EDGE_URL, { method: 'POST', headers, body: JSON.stringify(body) });
    const json = await res.json();
    return !json.error;
  } catch {
    return false;
  }
}

export async function processQueue(): Promise<void> {
  if (syncing || !navigator.onLine) return;
  syncing = true;

  try {
    const queue = await getSyncQueue();
    if (queue.length === 0) { notify(0); return; }

    let remaining = queue.length;
    notify(remaining);

    for (const entry of queue) {
      if (!navigator.onLine) break;

      const ok = await replayEntry(entry);
      if (ok) {
        await removeSyncEntry(entry.id!);
        remaining--;
        notify(remaining);
      } else if (entry.retries >= MAX_RETRIES) {
        await removeSyncEntry(entry.id!);
        remaining--;
        notify(remaining);
      } else {
        await updateSyncEntry(entry.id!, { retries: entry.retries + 1 });
      }
    }

    if (remaining === 0) {
      queryClient.invalidateQueries();
    }
  } finally {
    syncing = false;
  }
}

export function initOfflineSync() {
  window.addEventListener('online', () => {
    processQueue();
  });

  if (navigator.onLine) {
    processQueue();
  }
}
