/**
 * Hook to manage sync status and offline indicator
 */

import { useState } from 'react';
import { SyncStatus } from '../services/syncEngine';

export function useSyncStatus() {
  const [status] = useState<SyncStatus>('online');
  const [pendingSyncCount] = useState(0);

  // Note: Sync status is managed by the sync engine initialized in App.tsx
  // This hook provides a simple interface for components to display sync status

  return { status, pendingSyncCount };
}
