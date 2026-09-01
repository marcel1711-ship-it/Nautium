import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw, CloudOff, Check } from 'lucide-react';
import { getSyncQueueCount } from '../lib/offlineStore';
import { onSyncChange, processQueue } from '../lib/offlineSync';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);
  const [justSynced, setJustSynced] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    getSyncQueueCount().then(setPendingSync);
    return onSyncChange((count) => {
      setPendingSync(count);
      if (count === 0) {
        setIsSyncing(false);
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 3000);
      }
    });
  }, []);

  const handleSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    await processQueue();
  }, [isSyncing]);

  if (isOnline && pendingSync === 0 && !justSynced) return null;

  if (justSynced) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-green-600 text-white text-center text-sm py-1.5 px-4 flex items-center justify-center gap-2 lg:ml-64 shadow-md">
        <Check className="w-4 h-4" />
        <span>All changes synced</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-600 text-white text-center text-sm py-1.5 px-4 flex items-center justify-center gap-2 lg:ml-64 shadow-md">
        <WifiOff className="w-4 h-4" />
        <span>
          You are offline — viewing cached data
          {pendingSync > 0 && ` · ${pendingSync} pending change${pendingSync > 1 ? 's' : ''}`}
        </span>
      </div>
    );
  }

  if (pendingSync > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-blue-600 text-white text-center text-sm py-1.5 px-4 flex items-center justify-center gap-2 lg:ml-64 shadow-md">
        <CloudOff className="w-4 h-4" />
        <span>{pendingSync} pending change{pendingSync > 1 ? 's' : ''}</span>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="ml-2 px-2.5 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs font-medium inline-flex items-center gap-1 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync now'}
        </button>
      </div>
    );
  }

  return null;
};
