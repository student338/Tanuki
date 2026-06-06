'use client';

import { useEffect, useState } from 'react';
import { isTauri, getSyncStatus, forceSync, type SyncStatus } from '@/lib/tauri';

export default function NetworkStatus() {
  const [online, setOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Browser online/offline detection
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setOnline(navigator.onLine);

    // Tauri sync status polling
    let interval: ReturnType<typeof setInterval>;
    if (isTauri()) {
      const pollStatus = async () => {
        const status = await getSyncStatus();
        if (status) {
          setSyncStatus(status);
          setOnline(status.is_online);
        }
      };
      pollStatus();
      interval = setInterval(pollStatus, 30000); // Poll every 30s
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (interval) clearInterval(interval);
    };
  }, []);

  const handleForceSync = async () => {
    setSyncing(true);
    try {
      await forceSync();
      const status = await getSyncStatus();
      if (status) setSyncStatus(status);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm shadow-lg ${
          online
            ? 'bg-green-100 text-green-800 border border-green-200'
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}
        />
        <span>{online ? 'Online' : 'Offline'}</span>

        {syncStatus && syncStatus.pending_mutations > 0 && (
          <span className="ml-1 bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full text-xs">
            {syncStatus.pending_mutations} pending
          </span>
        )}

        {isTauri() && syncStatus && syncStatus.pending_mutations > 0 && online && (
          <button
            onClick={handleForceSync}
            disabled={syncing}
            className="ml-1 text-xs underline hover:no-underline disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync now'}
          </button>
        )}
      </div>
    </div>
  );
}
