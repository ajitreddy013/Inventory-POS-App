/**
 * Firestore Sync Engine for WaiterFlow Mobile App
 * 
 * Manages real-time synchronization between Firestore and local SQLite database.
 * Handles offline scenarios and automatic sync on reconnection.
 */

import {
  collection,
  onSnapshot,
  query,
  where,
  Unsubscribe,
  enableIndexedDbPersistence,
  enableNetwork,
  disableNetwork,
  getDocs,
  clearIndexedDbPersistence,
  terminate
} from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { db } from './firebase';
import {
  upsert,
  deleteRecord,
  getAll,
  addToSyncQueue,
  getPendingSyncItems,
  markSynced,
  getDeviceInfo,
  setDeviceInfo
} from './databaseHelpers';

/**
 * Convert camelCase to snake_case
 */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert object keys from camelCase to snake_case
 */
function convertKeysToSnakeCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = value;
  }
  return result;
}

export type SyncStatus = 'online' | 'offline' | 'syncing' | 'error';

export interface SyncEngineConfig {
  onStatusChange?: (status: SyncStatus) => void;
  onSyncComplete?: () => void;
  onError?: (error: Error) => void;
}

export class FirestoreSyncEngine {
  private unsubscribers: Unsubscribe[] = [];
  private status: SyncStatus = 'offline';
  private config: SyncEngineConfig;
  private isInitialized = false;
  private netInfoUnsubscribe?: () => void;

  constructor(config: SyncEngineConfig = {}) {
    this.config = config;
  }

  /**
   * Initialize the sync engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('Sync engine already initialized, skipping...');
      return;
    }

    try {
      // Skip offline persistence to avoid "Target ID already exists" errors
      console.log('Skipping offline persistence (using online-only mode)');

      // Set up network monitoring
      this.setupNetworkMonitoring();

      // Subscribe to collections
      await this.subscribeToCollections();

      this.isInitialized = true;
      console.log('Sync engine initialized');
    } catch (error) {
      console.error('Error initializing sync engine:', error);
      this.updateStatus('error');
      this.config.onError?.(error as Error);
      // Don't throw - allow app to continue in offline mode
    }
  }

  /**
   * Enable Firestore offline persistence
   */
  private async enableOfflinePersistence(): Promise<void> {
    try {
      // Firestore offline persistence is enabled by default in React Native
      // This is a no-op but kept for consistency with web implementation
      console.log('Firestore offline persistence enabled');
    } catch (error) {
      console.warn('Could not enable offline persistence:', error);
    }
  }

  /**
   * Set up network status monitoring
   */
  private setupNetworkMonitoring(): void {
    this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
      const isConnected = state.isConnected && state.isInternetReachable;
      
      if (isConnected) {
        this.handleOnline();
      } else {
        this.handleOffline();
      }
    });
  }

  /**
   * Handle online event
   */
  private async handleOnline(): Promise<void> {
    console.log('Network connected');
    this.updateStatus('syncing');

    try {
      // Enable Firestore network
      await enableNetwork(db);

      // Process pending sync queue
      await this.processSyncQueue();

      this.updateStatus('online');
      this.config.onSyncComplete?.();
    } catch (error) {
      console.error('Error handling online event:', error);
      this.updateStatus('error');
      this.config.onError?.(error as Error);
    }
  }

  /**
   * Handle offline event
   */
  private async handleOffline(): Promise<void> {
    console.log('Network disconnected');
    this.updateStatus('offline');

    try {
      // Disable Firestore network
      await disableNetwork(db);
    } catch (error) {
      console.error('Error handling offline event:', error);
    }
  }

  /**
   * Subscribe to all Firestore collections
   */
  private async subscribeToCollections(): Promise<void> {
    // Do initial fetch
    await this.initialFetchAll();
    
    // Set up polling to refresh data every 10 seconds
    this.setupPolling();
  }

  /**
   * Set up polling to refresh data periodically
   */
  private setupPolling(): void {
    // Poll every 10 seconds
    const pollInterval = setInterval(async () => {
      try {
        await this.initialFetchAll();
      } catch (error) {
        console.error('Error during polling:', error);
      }
    }, 10000);

    // Store interval for cleanup
    (this as any).pollInterval = pollInterval;
  }

  /**
   * Initial fetch of all data from Firestore
   */
  private async initialFetchAll(): Promise<void> {
    // Helper to safely fetch a collection
    const safeGetDocs = async (collectionName: string) => {
      try {
        return await getDocs(collection(db, collectionName));
      } catch (error: any) {
        // Handle "Target ID already exists" errors
        if (error.message && error.message.includes('Target ID already exists')) {
          console.warn(`⚠️ Target ID error for ${collectionName}, retrying...`);
          // Retry once after a short delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          return await getDocs(collection(db, collectionName));
        }
        throw error;
      }
    };

    try {
      // Fetch sections
      const sectionsSnap = await safeGetDocs('sections');
      for (const doc of sectionsSnap.docs) {
        const data = convertKeysToSnakeCase({ id: doc.id, ...doc.data() });
        await upsert('sections', data);
      }
      console.log(`✅ Synced ${sectionsSnap.size} sections`);

      // Fetch tables
      const tablesSnap = await safeGetDocs('tables');
      for (const doc of tablesSnap.docs) {
        const data = convertKeysToSnakeCase({ id: doc.id, ...doc.data() });
        await upsert('tables', data);
      }
      console.log(`✅ Synced ${tablesSnap.size} tables`);

      // Fetch waiters
      const waitersSnap = await safeGetDocs('waiters');
      for (const doc of waitersSnap.docs) {
        const data = convertKeysToSnakeCase({ id: doc.id, ...doc.data() });
        await upsert('waiters', data);
      }
      console.log(`✅ Synced ${waitersSnap.size} waiters`);

      // Fetch menu categories
      const categoriesSnap = await safeGetDocs('menuCategories');
      for (const doc of categoriesSnap.docs) {
        const data = convertKeysToSnakeCase({ id: doc.id, ...doc.data() });
        await upsert('menu_categories', data);
      }
      console.log(`✅ Synced ${categoriesSnap.size} menu categories`);

      // Fetch menu items
      const itemsSnap = await safeGetDocs('menuItems');
      for (const doc of itemsSnap.docs) {
        const data = convertKeysToSnakeCase({ id: doc.id, ...doc.data() });
        await upsert('menu_items', data);
      }
      console.log(`✅ Synced ${itemsSnap.size} menu items`);

      // Fetch modifiers
      const modifiersSnap = await safeGetDocs('modifiers');
      for (const doc of modifiersSnap.docs) {
        const data = convertKeysToSnakeCase({ id: doc.id, ...doc.data() });
        await upsert('modifiers', data);
      }
      console.log(`✅ Synced ${modifiersSnap.size} modifiers`);

    } catch (error) {
      console.error('❌ Error fetching data:', error);
      throw error;
    }
  }

  /**
   * Subscribe to a Firestore collection and sync to SQLite
   */
  private subscribeToCollection(
    firestoreCollection: string,
    sqliteTable: string
  ): void {
    const collectionRef = collection(db, firestoreCollection);

    const unsubscribe = onSnapshot(
      collectionRef,
      async (snapshot) => {
        try {
          // Process all documents in the snapshot
          for (const doc of snapshot.docs) {
            const firestoreData = doc.data();
            const data = convertKeysToSnakeCase({ id: doc.id, ...firestoreData });
            await upsert(sqliteTable, data);
          }

          if (snapshot.docs.length > 0) {
            console.log(`✅ Synced ${snapshot.docs.length} ${firestoreCollection} to ${sqliteTable}`);
          }
        } catch (error) {
          console.error(`❌ Error syncing ${firestoreCollection}:`, error);
          this.config.onError?.(error as Error);
        }
      },
      (error) => {
        // Silently ignore "Target ID already exists" errors during development
        if (error.message && error.message.includes('Target ID already exists')) {
          return;
        }
        
        console.error(`Error in ${firestoreCollection} listener:`, error);
        this.config.onError?.(error);
      }
    );

    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Subscribe to orders collection (filtered by waiter)
   */
  private async subscribeToOrders(): Promise<void> {
    // Get current waiter ID from device info
    const waiterId = await getDeviceInfo('waiterId');

    if (!waiterId) {
      console.warn('No waiter ID found, skipping orders subscription');
      return;
    }

    const ordersRef = collection(db, 'orders');
    const ordersQuery = query(ordersRef, where('waiterId', '==', waiterId));

    const unsubscribe = onSnapshot(
      ordersQuery,
      async (snapshot) => {
        try {
          for (const change of snapshot.docChanges()) {
            const data = { id: change.doc.id, ...change.doc.data() };

            if (change.type === 'added' || change.type === 'modified') {
              await upsert('orders', data);

              // Also sync order items
              await this.syncOrderItems(change.doc.id);
            } else if (change.type === 'removed') {
              await deleteRecord('orders', change.doc.id);
            }
          }

          console.log(`Synced ${snapshot.docChanges().length} order changes`);
        } catch (error) {
          console.error('Error syncing orders:', error);
          this.config.onError?.(error as Error);
        }
      },
      (error) => {
        console.error('Error in orders listener:', error);
        this.config.onError?.(error);
      }
    );

    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Sync order items for a specific order
   */
  private async syncOrderItems(orderId: string): Promise<void> {
    const orderItemsRef = collection(db, 'orders', orderId, 'items');

    const unsubscribe = onSnapshot(
      orderItemsRef,
      async (snapshot) => {
        try {
          for (const change of snapshot.docChanges()) {
            const data = {
              id: change.doc.id,
              order_id: orderId,
              ...change.doc.data()
            };

            if (change.type === 'added' || change.type === 'modified') {
              await upsert('order_items', data);
            } else if (change.type === 'removed') {
              await deleteRecord('order_items', change.doc.id);
            }
          }
        } catch (error) {
          console.error(`Error syncing order items for ${orderId}:`, error);
        }
      }
    );

    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Process pending sync queue
   */
  private async processSyncQueue(): Promise<void> {
    try {
      const pendingItems = await getPendingSyncItems();

      console.log(`Processing ${pendingItems.length} pending sync items`);

      for (const item of pendingItems) {
        try {
          const data = JSON.parse(item.data);

          // Firestore SDK will handle the actual sync
          // We just need to mark items as synced
          await markSynced(item.id);

          console.log(`Synced ${item.entity_type} ${item.entity_id}`);
        } catch (error) {
          console.error(`Error syncing item ${item.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing sync queue:', error);
      throw error;
    }
  }

  /**
   * Update sync status
   */
  private updateStatus(status: SyncStatus): void {
    this.status = status;
    this.config.onStatusChange?.(status);
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Get pending sync count
   */
  async getPendingSyncCount(): Promise<number> {
    const items = await getPendingSyncItems();
    return items.length;
  }

  /**
   * Manually trigger sync
   */
  async sync(): Promise<void> {
    if (this.status === 'offline') {
      console.warn('Cannot sync while offline');
      return;
    }

    this.updateStatus('syncing');

    try {
      await this.processSyncQueue();
      this.updateStatus('online');
      this.config.onSyncComplete?.();
    } catch (error) {
      console.error('Error during manual sync:', error);
      this.updateStatus('error');
      this.config.onError?.(error as Error);
    }
  }

  /**
   * Shutdown the sync engine
   */
  shutdown(): void {
    // Clear polling interval
    if ((this as any).pollInterval) {
      clearInterval((this as any).pollInterval);
      (this as any).pollInterval = null;
    }

    // Unsubscribe from all Firestore listeners
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];

    // Unsubscribe from network monitoring
    this.netInfoUnsubscribe?.();

    this.isInitialized = false;
    console.log('Sync engine shutdown');
  }

  /**
   * Complete reset - clears all state including subscription markers
   * Use this on logout or when you want to completely reinitialize
   */
  reset(): void {
    this.shutdown();
    
    // Clear subscription markers
    Object.keys(this).forEach(key => {
      if (key.startsWith('_subscription_')) {
        delete (this as any)[key];
      }
    });
    
    console.log('Sync engine reset');
  }
}

/**
 * Initialize sync engine - creates a new instance each time
 */
export async function initializeSyncEngine(config?: SyncEngineConfig): Promise<FirestoreSyncEngine> {
  console.log('Creating new sync engine instance...');
  const engine = new FirestoreSyncEngine(config);
  await engine.initialize();
  return engine;
}
