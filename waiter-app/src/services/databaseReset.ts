/**
 * Database Reset Utility
 * 
 * Provides functions to clear local database and force fresh sync from Firebase
 */

import * as SQLite from 'expo-sqlite';
import { initializeDatabase } from './database';

const DB_NAME = 'waiterflow.db';

/**
 * Clear all data from local database and reinitialize
 */
export async function resetDatabase(): Promise<void> {
  try {
    console.log('🗑️ Resetting local database...');
    
    // Close existing connection
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    
    // Disable foreign keys temporarily
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    
    // Drop all tables
    await db.execAsync(`
      DROP TABLE IF EXISTS order_items;
      DROP TABLE IF EXISTS orders;
      DROP TABLE IF EXISTS tables;
      DROP TABLE IF EXISTS modifiers;
      DROP TABLE IF EXISTS menu_items;
      DROP TABLE IF EXISTS menu_categories;
      DROP TABLE IF EXISTS sections;
      DROP TABLE IF EXISTS waiters;
      DROP TABLE IF EXISTS sync_queue;
      DROP TABLE IF EXISTS device_info;
    `);
    
    console.log('✓ All tables dropped');
    
    // Re-enable foreign keys
    await db.execAsync('PRAGMA foreign_keys = ON;');
    
    // Reinitialize database with fresh schema
    await initializeDatabase();
    
    // Clear the global sync engine singleton to force re-subscription
    const SYNC_ENGINE_KEY = '__WAITERFLOW_SYNC_ENGINE__';
    if ((global as any)[SYNC_ENGINE_KEY]) {
      const syncEngineGlobal = (global as any)[SYNC_ENGINE_KEY];
      if (syncEngineGlobal.instance) {
        // Clear subscription markers to allow re-subscription
        const instance = syncEngineGlobal.instance;
        Object.keys(instance).forEach((key: string) => {
          if (key.startsWith('_subscription_')) {
            delete (instance as any)[key];
          }
        });
      }
    }
    
    console.log('✅ Database reset complete - please reload the app for fresh sync');
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    throw error;
  }
}
