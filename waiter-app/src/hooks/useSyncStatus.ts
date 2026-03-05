/**
 * Hook to manage sync status and offline indicator
 */

import { useState, useEffect } from 'react';
import { getSyncEngine, SyncStatus } from '../services/syncEngine';

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>('offline');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    const syncEngine = getSyncEngine({
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
      onSyncComplete: () => {
        console.log('Sync completed');
      },
      onError: (error) => {
        console.error('Sync error:', error);
      }
    });

    // Update pending sync count periodically
    const updatePendingCount = async () => {
      const count = await syncEngine.getPendingSyncCount();
      setPendingSyncCount(count);
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return { status, pendingSyncCount };
}
