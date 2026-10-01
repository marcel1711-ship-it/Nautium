import { getSyncQueue, removeSyncEntry, updateSyncEntry, updateCachedRecord, getFileQueue, removeFileEntry, remapFileQueueRecordId, type SyncEntry } from './offlineStore';
import { queryClient } from './queryClient';
import { supabase } from './supabase';

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

async function replayEntry(entry: SyncEntry): Promise<{ ok: boolean; data?: any }> {
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
    return { ok: !json.error, data: json.data };
  } catch {
    return { ok: false };
  }
}

async function remapOfflineId(
  queue: SyncEntry[],
  currentIndex: number,
  table: string,
  offlineId: string,
  realId: string,
): Promise<void> {
  for (let i = currentIndex + 1; i < queue.length; i++) {
    const later = queue[i];
    if (later.table !== table) continue;
    if (later.payload.id === offlineId) {
      later.payload.id = realId;
      await updateSyncEntry(later.id!, { payload: later.payload });
    }
  }
  await updateCachedRecord(table, offlineId, { id: realId, _offline: false });
  await remapFileQueueRecordId(table, offlineId, realId);
}

async function processFileQueue(): Promise<void> {
  const files = await getFileQueue();
  if (files.length === 0) return;

  const token = getToken();

  for (const entry of files) {
    if (!navigator.onLine) break;

    try {
      const { error: uploadError } = await supabase.storage
        .from(entry.bucket)
        .upload(entry.storagePath, entry.blob, { upsert: true });

      if (uploadError) continue;

      const { data: urlData } = supabase.storage
        .from(entry.bucket)
        .getPublicUrl(entry.storagePath);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token ?? SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      };

      if (entry.recordField === 'photos') {
        const getRes = await fetch(EDGE_URL, {
          method: 'POST', headers,
          body: JSON.stringify({ action: 'select_single', table: entry.recordTable, id: entry.recordId }),
        });
        const getJson = await getRes.json();
        const currentPhotos: string[] = getJson.data?.photos || [];
        await fetch(EDGE_URL, {
          method: 'POST', headers,
          body: JSON.stringify({ action: 'update', table: entry.recordTable, id: entry.recordId, data: { photos: [...currentPhotos, urlData.publicUrl] } }),
        });
      } else {
        await fetch(EDGE_URL, {
          method: 'POST', headers,
          body: JSON.stringify({ action: 'update', table: entry.recordTable, id: entry.recordId, data: { [entry.recordField]: urlData.publicUrl } }),
        });
      }

      await removeFileEntry(entry.id!);
    } catch {
      // retry next sync cycle
    }
  }
}

export async function processQueue(): Promise<void> {
  if (syncing || !navigator.onLine) return;
  syncing = true;

  try {
    const queue = await getSyncQueue();
    if (queue.length === 0) {
      notify(0);
      await processFileQueue();
      return;
    }

    let remaining = queue.length;
    notify(remaining);

    for (let i = 0; i < queue.length; i++) {
      if (!navigator.onLine) break;
      const entry = queue[i];

      const { ok, data } = await replayEntry(entry);
      if (ok) {
        if (entry.action === 'insert' && data?.id) {
          const offlineId = entry.payload.data?.id;
          if (offlineId && typeof offlineId === 'string' && offlineId.startsWith('offline-')) {
            await remapOfflineId(queue, i, entry.table, offlineId, data.id);
          }
        }
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

    await processFileQueue();

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
