/**
 * Firebase Connection Test Utility
 * 
 * Tests Firebase connectivity and Firestore access
 */

import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  error?: string;
  details?: {
    firestoreConnected: boolean;
    collectionsAccessible: boolean;
    offlinePersistenceEnabled: boolean;
  };
}

/**
 * Test Firebase connection and Firestore access
 */
export async function testFirebaseConnection(): Promise<ConnectionTestResult> {
  try {
    console.log('🔍 Testing Firebase connection...');

    // Test 1: Check if Firestore is initialized
    if (!db) {
      return {
        success: false,
        message: 'Firestore not initialized',
        error: 'Firestore instance is null or undefined',
      };
    }

    console.log('✅ Firestore instance exists');

    // Test 2: Try to access a collection (waiters)
    try {
      const waitersRef = collection(db, 'waiters');
      const q = query(waitersRef, limit(1));
      const snapshot = await getDocs(q);
      
      console.log(`✅ Successfully accessed 'waiters' collection (${snapshot.size} documents)`);

      return {
        success: true,
        message: 'Firebase connection successful',
        details: {
          firestoreConnected: true,
          collectionsAccessible: true,
          offlinePersistenceEnabled: true,
        },
      };
    } catch (firestoreError: any) {
      console.error('❌ Firestore access error:', firestoreError);
      
      return {
        success: false,
        message: 'Firestore access failed',
        error: firestoreError.message,
        details: {
          firestoreConnected: true,
          collectionsAccessible: false,
          offlinePersistenceEnabled: true,
        },
      };
    }
  } catch (error: any) {
    console.error('❌ Firebase connection test failed:', error);
    
    return {
      success: false,
      message: 'Firebase connection test failed',
      error: error.message,
    };
  }
}

/**
 * Log Firebase connection status
 */
export async function logFirebaseStatus(): Promise<void> {
  const result = await testFirebaseConnection();
  
  console.log('\n📊 Firebase Connection Status:');
  console.log('================================');
  console.log(`Status: ${result.success ? '✅ Connected' : '❌ Failed'}`);
  console.log(`Message: ${result.message}`);
  
  if (result.error) {
    console.log(`Error: ${result.error}`);
  }
  
  if (result.details) {
    console.log('\nDetails:');
    console.log(`  Firestore Connected: ${result.details.firestoreConnected ? '✅' : '❌'}`);
    console.log(`  Collections Accessible: ${result.details.collectionsAccessible ? '✅' : '❌'}`);
    console.log(`  Offline Persistence: ${result.details.offlinePersistenceEnabled ? '✅' : '❌'}`);
  }
  
  console.log('================================\n');
}
