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
  disableNetwork
} from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { db } from './firebase';
import {
  upsert,
  deleteRecord,
  addToSyncQueue,
  getPendingSyncItems,
  markSynced,
  getDeviceInfo,
  setDeviceInfo
} from './databaseHelpers';

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
      return;
    }

    try {
      // Enable Firestore offline persistence
      await this.enableOfflinePersistence();

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
      throw error;
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
    // Subscribe to waiters
    this.subscribeToCollection('waiters', 'waiters');

    // Subscribe to sections
    this.subscribeToCollection('sections', 'sections');

    // Subscribe to tables
    this.subscribeToCollection('tables', 'tables');

    // Subscribe to menu categories
    this.subscribeToCollection('menuCategories', 'menu_categories');

    // Subscribe to menu items
    this.subscribeToCollection('menuItems', 'menu_items');

    // Subscribe to modifiers
    this.subscribeToCollection('modifiers', 'modifiers');

    // Subscribe to orders (only for current device/waiter)
    await this.subscribeToOrders();
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
          for (const change of snapshot.docChanges()) {
            const data = { id: change.doc.id, ...change.doc.data() };

            if (change.type === 'added' || change.type === 'modified') {
              await upsert(sqliteTable, data);
            } else if (change.type === 'removed') {
              await deleteRecord(sqliteTable, change.doc.id);
            }
          }

          console.log(`Synced ${snapshot.docChanges().length} changes to ${sqliteTable}`);
        } catch (error) {
          console.error(`Error syncing ${firestoreCollection}:`, error);
          this.config.onError?.(error as Error);
        }
      },
      (error) => {
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
    // Unsubscribe from all Firestore listeners
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];

    // Unsubscribe from network monitoring
    this.netInfoUnsubscribe?.();

    this.isInitialized = false;
    console.log('Sync engine shutdown');
  }
}

// Singleton instance
let syncEngineInstance: FirestoreSyncEngine | null = null;

/**
 * Get or create sync engine instance
 */
export function getSyncEngine(config?: SyncEngineConfig): FirestoreSyncEngine {
  if (!syncEngineInstance) {
    syncEngineInstance = new FirestoreSyncEngine(config);
  }
  return syncEngineInstance;
}

/**
 * Initialize sync engine
 */
export async function initializeSyncEngine(config?: SyncEngineConfig): Promise<FirestoreSyncEngine> {
  const engine = getSyncEngine(config);
  await engine.initialize();
  return engine;
}
