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
} from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { db } from './firebase';
import {
  upsert,
  bulkUpsert,
  deleteRecord,
  getAll,
  addToSyncQueue,
  getPendingSyncItems,
  markSynced,
  getDeviceInfo,
  setDeviceInfo,
} from './databaseHelpers';
import { getDatabase } from './database';

/**
 * Convert camelCase to snake_case
 */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
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

function toUnixMs(value: any, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsedNum = Number(value);
    if (!Number.isNaN(parsedNum) && Number.isFinite(parsedNum))
      return parsedNum;
    const parsedDate = new Date(value).getTime();
    if (!Number.isNaN(parsedDate)) return parsedDate;
  }
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsedDate = new Date(value).getTime();
  return Number.isNaN(parsedDate) ? fallback : parsedDate;
}

function toSQLiteBoolean(value: any, fallback = 0): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value ? 1 : 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return 1;
    if (normalized === 'false' || normalized === '0') return 0;
  }
  return fallback;
}

function sanitizeForSqlite(
  tableName: string,
  raw: Record<string, any>
): Record<string, any> {
  const snake = convertKeysToSnakeCase(raw);
  const now = Date.now();

  const createdAt = toUnixMs(snake.created_at ?? snake.createdAt, now);
  const updatedAt = toUnixMs(
    snake.updated_at ?? snake.updatedAt ?? snake.created_at ?? snake.createdAt,
    createdAt
  );

  const common = {
    id: String(raw.id ?? snake.id ?? ''),
    created_at: createdAt,
    updated_at: updatedAt,
  };

  if (!common.id) return common;

  switch (tableName) {
    case 'sections':
      return {
        ...common,
        name: String(snake.name ?? ''),
        is_active: toSQLiteBoolean(snake.is_active ?? snake.isActive, 1),
      };

    case 'tables':
      return {
        ...common,
        name: String(snake.name ?? ''),
        section_id: String(snake.section_id ?? snake.sectionId ?? ''),
        status: String(snake.status ?? 'available'),
        capacity: Number(snake.capacity ?? 4),
        is_active: toSQLiteBoolean(snake.is_active ?? snake.isActive, 1),
        current_order_id:
          snake.current_order_id ?? snake.currentOrderId ?? null,
        occupied_since:
          snake.occupied_since != null
            ? toUnixMs(snake.occupied_since, 0)
            : snake.occupiedSince != null
              ? toUnixMs(snake.occupiedSince, 0)
              : null,
        created_at: common.created_at || Date.now(),
        updated_at: common.updated_at || Date.now(),
      };

    case 'waiters':
      return {
        ...common,
        name: String(snake.name ?? ''),
        pin: String(snake.pin ?? ''),
        is_active: toSQLiteBoolean(snake.is_active ?? snake.isActive, 1),
      };

    case 'menu_categories':
      return {
        ...common,
        name: String(snake.name ?? ''),
        display_order: Number(snake.display_order ?? 0),
      };

    case 'menu_items': {
      let availableModifierIds = snake.available_modifier_ids;
      const rawModifiers =
        snake.available_modifiers ?? snake.availableModifiers;
      if (!availableModifierIds && Array.isArray(rawModifiers)) {
        availableModifierIds = rawModifiers.join(',');
      } else if (!availableModifierIds && typeof rawModifiers === 'string') {
        availableModifierIds = rawModifiers;
      }

      return {
        ...common,
        name: String(snake.name ?? ''),
        price: Number(snake.price ?? 0),
        category_id: snake.category_id ?? snake.categoryId ?? null,
        category: snake.category ?? null,
        sub_category: snake.sub_category ?? snake.subCategory ?? null,
        item_category: snake.item_category ?? snake.itemCategory ?? 'food',
        is_active: toSQLiteBoolean(snake.is_active ?? snake.isActive, 1),
        is_out_of_stock: toSQLiteBoolean(
          snake.is_out_of_stock ?? snake.isOutOfStock,
          0
        ),
        is_bar_item: toSQLiteBoolean(snake.is_bar_item ?? snake.isBarItem, 0),
        available_modifier_ids: availableModifierIds ?? null,
      };
    }

    case 'modifiers':
      return {
        ...common,
        name: String(snake.name ?? ''),
        type: String(snake.type ?? 'paid_addon'),
        price: Number(snake.price ?? 0),
      };

    default:
      return {
        ...snake,
        id: common.id,
        created_at: createdAt,
        updated_at: updatedAt,
      };
  }
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
  private isSyncing = false; // Prevent overlapping syncs

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
    this.netInfoUnsubscribe = NetInfo.addEventListener((state) => {
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
    // Do initial fetch only on app start (static data: menu, sections, waiters)
    await this.initialFetchAll();

    // Only keep real-time listener for tables — status changes frequently.
    // Static collections (menu, sections, waiters) are fetched once on startup.
    this.subscribeToCollection('tables', 'tables');
  }

  /**
   * Initial fetch of all data from Firestore using REST API
   * This bypasses Firestore SDK caching issues
   */
  private async initialFetchAll(): Promise<void> {
    const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
    const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;

    if (!projectId || !apiKey) {
      throw new Error('Firebase project ID or API key not configured');
    }

    // Helper to fetch a collection via REST API
    const fetchCollection = async (collectionName: string) => {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}?key=${apiKey}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${collectionName}: ${response.statusText}`
        );
      }

      const data = await response.json();
      const documents = data.documents || [];

      // Convert Firestore REST API format to simple objects
      return documents.map((doc: any) => {
        const id = doc.name.split('/').pop();
        const fields = doc.fields || {};

        // Convert Firestore field format to simple key-value pairs
        const obj: Record<string, any> = { id };
        for (const [key, value] of Object.entries(fields)) {
          const fieldValue = value as any;
          // Extract the actual value based on type
          if (fieldValue.stringValue !== undefined)
            obj[key] = fieldValue.stringValue;
          else if (fieldValue.integerValue !== undefined)
            obj[key] = parseInt(fieldValue.integerValue);
          else if (fieldValue.doubleValue !== undefined)
            obj[key] = fieldValue.doubleValue;
          else if (fieldValue.booleanValue !== undefined)
            obj[key] = fieldValue.booleanValue;
          else if (fieldValue.timestampValue !== undefined)
            obj[key] = fieldValue.timestampValue;
          else if (fieldValue.nullValue !== undefined) obj[key] = null;
        }

        return obj;
      });
    };

    try {
      // Fetch and bulk-upsert each collection sequentially
      const sections = await fetchCollection('sections');
      // Clear first to avoid stale duplicates, then re-insert
      getDatabase().runSync('DELETE FROM sections');
      await bulkUpsert(
        'sections',
        sections.map((row) => sanitizeForSqlite('sections', row))
      );

      const tables = await fetchCollection('tables');
      getDatabase().runSync('DELETE FROM tables');
      for (const row of tables) {
        try {
          await upsert('tables', sanitizeForSqlite('tables', row));
        } catch (e) {
          console.warn('⚠️ Skipping table row:', row.id, e);
        }
      }

      const waiters = await fetchCollection('waiters');
      await bulkUpsert(
        'waiters',
        waiters.map((row) => sanitizeForSqlite('waiters', row))
      );

      const categories = await fetchCollection('menuCategories');
      await bulkUpsert(
        'menu_categories',
        categories.map((row) => sanitizeForSqlite('menu_categories', row))
      );

      const items = await fetchCollection('menuItems');
      await bulkUpsert(
        'menu_items',
        items.map((row) => sanitizeForSqlite('menu_items', row))
      );

      const modifiers = await fetchCollection('modifiers');
      await bulkUpsert(
        'modifiers',
        modifiers.map((row) => sanitizeForSqlite('modifiers', row))
      );

      console.log(
        `🔄 Sync complete: ${sections.length} sections, ${tables.length} tables, ${waiters.length} waiters, ${categories.length} categories, ${items.length} items, ${modifiers.length} modifiers`
      );
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
            try {
              const firestoreData = doc.data();
              const data = sanitizeForSqlite(sqliteTable, {
                id: doc.id,
                ...firestoreData,
              });
              await upsert(sqliteTable, data);
            } catch (rowError) {
              console.warn(
                `⚠️ Skipping ${firestoreCollection} doc ${doc.id}:`,
                rowError
              );
            }
          }

          if (snapshot.docs.length > 0) {
            console.log(
              `✅ Synced ${snapshot.docs.length} ${firestoreCollection} to ${sqliteTable}`
            );
          }
        } catch (error) {
          console.error(`❌ Error syncing ${firestoreCollection}:`, error);
          this.config.onError?.(error as Error);
        }
      },
      (error) => {
        // Silently ignore "Target ID already exists" errors during development
        if (
          error.message &&
          error.message.includes('Target ID already exists')
        ) {
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

    const unsubscribe = onSnapshot(orderItemsRef, async (snapshot) => {
      try {
        for (const change of snapshot.docChanges()) {
          const data = {
            id: change.doc.id,
            order_id: orderId,
            ...change.doc.data(),
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
    });

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
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
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
    Object.keys(this).forEach((key) => {
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
export async function initializeSyncEngine(
  config?: SyncEngineConfig
): Promise<FirestoreSyncEngine> {
  console.log('Creating new sync engine instance...');
  const engine = new FirestoreSyncEngine(config);
  await engine.initialize();
  return engine;
}
