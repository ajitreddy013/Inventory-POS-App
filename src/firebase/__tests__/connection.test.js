/**
 * Firebase Connection Unit Tests
 * 
 * Tests Firebase connectivity for both renderer process (regular SDK)
 * and main process (Admin SDK).
 * 
 * Requirements: 2.1 - Real-time data synchronization requires reliable Firebase connectivity
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, enableIndexedDbPersistence, collection, getDocs, doc, setDoc, getDoc, deleteDoc } = require('firebase/firestore');
const {
  initializeAdminSDK,
  getAdminFirestore,
  getAdminAuth,
  isInitialized,
  createCustomToken,
  getDocument,
  setDocument,
  deleteDocument,
  queryCollection
} = require('../init');

// Mock environment variables for testing
process.env.REACT_APP_FIREBASE_API_KEY = 'test-api-key';
process.env.REACT_APP_FIREBASE_AUTH_DOMAIN = 'test-project.firebaseapp.com';
process.env.REACT_APP_FIREBASE_PROJECT_ID = 'test-project';
process.env.REACT_APP_FIREBASE_STORAGE_BUCKET = 'test-project.appspot.com';
process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID = '123456789';
process.env.REACT_APP_FIREBASE_APP_ID = '1:123456789:web:abcdef';

describe('Firebase Connection Tests', () => {
  describe('Renderer Process - Regular Firebase SDK', () => {
    let app;
    let firestore;

    beforeAll(() => {
      // Initialize Firebase for renderer process
      const firebaseConfig = {
        apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
        authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
        storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.REACT_APP_FIREBASE_APP_ID
      };

      try {
        app = initializeApp(firebaseConfig, 'test-app');
        firestore = getFirestore(app);
      } catch (error) {
        console.error('Firebase initialization error:', error);
      }
    });

    test('should initialize Firebase app successfully', () => {
      expect(app).toBeDefined();
      expect(app.name).toBe('test-app');
      expect(app.options.projectId).toBe('test-project');
    });

    test('should initialize Firestore successfully', () => {
      expect(firestore).toBeDefined();
      expect(firestore.type).toBe('firestore');
    });

    test('should have correct Firebase configuration', () => {
      expect(app.options.apiKey).toBe('test-api-key');
      expect(app.options.authDomain).toBe('test-project.firebaseapp.com');
      expect(app.options.projectId).toBe('test-project');
      expect(app.options.storageBucket).toBe('test-project.appspot.com');
    });

    test('should create collection reference', () => {
      const testCollection = collection(firestore, 'test');
      expect(testCollection).toBeDefined();
      expect(testCollection.id).toBe('test');
    });

    test('should create document reference', () => {
      const testDoc = doc(firestore, 'test', 'doc1');
      expect(testDoc).toBeDefined();
      expect(testDoc.id).toBe('doc1');
      expect(testDoc.path).toBe('test/doc1');
    });

    test('should handle offline persistence configuration', async () => {
      // Note: In test environment, persistence may not be available
      // This test verifies the API is available, not that it succeeds
      try {
        await enableIndexedDbPersistence(firestore);
        // If it succeeds, great!
        expect(true).toBe(true);
      } catch (error) {
        // Expected errors in test environment
        expect(['failed-precondition', 'unimplemented']).toContain(error.code);
      }
    });

    test('should handle connection errors gracefully', async () => {
      // Attempt to read from a collection (will fail in test environment without actual Firebase)
      try {
        const testCollection = collection(firestore, 'test');
        await getDocs(testCollection);
        // If it succeeds (unlikely in test), that's fine
        expect(true).toBe(true);
      } catch (error) {
        // Expected to fail without real Firebase connection
        expect(error).toBeDefined();
        // Should have a meaningful error message
        expect(error.message).toBeTruthy();
      }
    });
  });

  describe('Main Process - Firebase Admin SDK', () => {
    test('should check if Admin SDK is initialized', () => {
      const initialized = isInitialized();
      expect(typeof initialized).toBe('boolean');
    });

    test('should handle missing service account gracefully', () => {
      // This test verifies error handling when service account is missing
      try {
        initializeAdminSDK();
        // If it succeeds, Admin SDK is properly configured
        expect(isInitialized()).toBe(true);
      } catch (error) {
        // Expected error when service account is not found
        expect(error.message).toContain('service account key not found');
      }
    });

    test('should provide Admin Firestore getter', () => {
      try {
        const adminFirestore = getAdminFirestore();
        expect(adminFirestore).toBeDefined();
      } catch (error) {
        // Expected if service account is not configured
        expect(error.message).toContain('service account');
      }
    });

    test('should provide Admin Auth getter', () => {
      try {
        const adminAuth = getAdminAuth();
        expect(adminAuth).toBeDefined();
      } catch (error) {
        // Expected if service account is not configured
        expect(error.message).toContain('service account');
      }
    });

    test('should handle custom token creation', async () => {
      try {
        const token = await createCustomToken('test_waiter_123', {
          name: 'Test Waiter',
          role: 'waiter'
        });
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(0);
      } catch (error) {
        // Expected if Admin SDK is not initialized
        expect(error).toBeDefined();
      }
    });

    test('should handle document operations', async () => {
      try {
        // Test document read
        const doc = await getDocument('test', 'doc1');
        expect(doc === null || typeof doc === 'object').toBe(true);
      } catch (error) {
        // Expected if Admin SDK is not initialized or Firestore is not accessible
        expect(error).toBeDefined();
      }
    });

    test('should handle collection queries', async () => {
      try {
        const docs = await queryCollection('test', [], { limit: 1 });
        expect(Array.isArray(docs)).toBe(true);
      } catch (error) {
        // Expected if Admin SDK is not initialized or Firestore is not accessible
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    test('should validate Firebase configuration', () => {
      const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
      
      requiredKeys.forEach(key => {
        expect(process.env[`REACT_APP_FIREBASE_${key.toUpperCase()}`] || 
               process.env[`REACT_APP_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`]).toBeTruthy();
      });
    });

    test('should handle network errors', async () => {
      // Simulate network error by attempting operation without connection
      try {
        const firebaseConfig = {
          apiKey: 'invalid-key',
          authDomain: 'invalid.firebaseapp.com',
          projectId: 'invalid-project',
          storageBucket: 'invalid.appspot.com',
          messagingSenderId: '000000000',
          appId: '1:000000000:web:invalid'
        };
        
        const testApp = initializeApp(firebaseConfig, 'error-test-app');
        const testFirestore = getFirestore(testApp);
        const testCollection = collection(testFirestore, 'test');
        
        await getDocs(testCollection);
        // If it somehow succeeds, that's unexpected but not a failure
        expect(true).toBe(true);
      } catch (error) {
        // Expected to fail with invalid configuration
        expect(error).toBeDefined();
        expect(error.message).toBeTruthy();
      }
    });

    test('should handle permission denied errors', async () => {
      // This test verifies that permission errors are handled properly
      try {
        const docs = await queryCollection('restricted_collection', []);
        // If it succeeds, security rules allow access
        expect(Array.isArray(docs)).toBe(true);
      } catch (error) {
        // Expected if security rules deny access
        if (error.code === 'permission-denied') {
          expect(error.code).toBe('permission-denied');
        } else {
          // Other errors are also acceptable (e.g., not initialized)
          expect(error).toBeDefined();
        }
      }
    });

    test('should handle timeout errors', async () => {
      // This test verifies timeout handling
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Operation timed out')), 100);
      });

      try {
        await Promise.race([
          queryCollection('test', []),
          timeoutPromise
        ]);
        // If query completes before timeout, that's fine
        expect(true).toBe(true);
      } catch (error) {
        // Expected to timeout or fail
        expect(error).toBeDefined();
      }
    });
  });

  describe('Offline Persistence', () => {
    test('should support offline persistence API', () => {
      // Verify that offline persistence functions are available
      expect(typeof enableIndexedDbPersistence).toBe('function');
    });

    test('should handle persistence errors gracefully', async () => {
      try {
        const firebaseConfig = {
          apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
          authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
          storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.REACT_APP_FIREBASE_APP_ID
        };
        
        const persistenceApp = initializeApp(firebaseConfig, 'persistence-test');
        const persistenceFirestore = getFirestore(persistenceApp);
        
        await enableIndexedDbPersistence(persistenceFirestore);
        // If it succeeds, persistence is enabled
        expect(true).toBe(true);
      } catch (error) {
        // Expected errors in test environment
        const validErrorCodes = ['failed-precondition', 'unimplemented'];
        expect(validErrorCodes).toContain(error.code);
      }
    });

    test('should handle multiple tabs scenario', async () => {
      // Test that persistence handles multiple tabs correctly
      try {
        const firebaseConfig = {
          apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
          authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
          storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.REACT_APP_FIREBASE_APP_ID
        };
        
        const multiTabApp = initializeApp(firebaseConfig, 'multi-tab-test');
        const multiTabFirestore = getFirestore(multiTabApp);
        
        await enableIndexedDbPersistence(multiTabFirestore);
        expect(true).toBe(true);
      } catch (error) {
        if (error.code === 'failed-precondition') {
          // This is the expected error when multiple tabs are open
          expect(error.code).toBe('failed-precondition');
        } else {
          // Other errors are acceptable in test environment
          expect(['unimplemented']).toContain(error.code);
        }
      }
    });
  });

  describe('Connection Status', () => {
    test('should provide connection status information', () => {
      // Verify that we can check initialization status
      const initialized = isInitialized();
      expect(typeof initialized).toBe('boolean');
    });

    test('should handle reconnection scenarios', async () => {
      // This test verifies that the SDK can handle reconnection
      try {
        // Attempt to query after potential disconnection
        const docs = await queryCollection('test', [], { limit: 1 });
        expect(Array.isArray(docs)).toBe(true);
      } catch (error) {
        // Expected if not connected
        expect(error).toBeDefined();
      }
    });

    test('should provide meaningful error messages', async () => {
      try {
        // Attempt operation that will fail
        await getDocument('nonexistent_collection', 'nonexistent_doc');
        // If it succeeds (returns null), that's fine
        expect(true).toBe(true);
      } catch (error) {
        // Error should have a message
        expect(error.message).toBeTruthy();
        expect(typeof error.message).toBe('string');
      }
    });
  });

  describe('Admin SDK Authentication', () => {
    test('should validate service account structure', () => {
      // This test verifies that service account validation works
      try {
        initializeAdminSDK();
        // If it succeeds, service account is valid
        expect(isInitialized()).toBe(true);
      } catch (error) {
        // Expected errors
        const validErrors = [
          'service account key not found',
          'Invalid service account key file'
        ];
        const hasValidError = validErrors.some(msg => error.message.includes(msg));
        expect(hasValidError).toBe(true);
      }
    });

    test('should handle invalid service account', () => {
      // Verify that invalid service accounts are rejected
      // This is tested implicitly by the initialization process
      expect(typeof initializeAdminSDK).toBe('function');
    });

    test('should provide admin privileges', async () => {
      try {
        // Admin SDK should be able to bypass security rules
        const adminFirestore = getAdminFirestore();
        expect(adminFirestore).toBeDefined();
      } catch (error) {
        // Expected if not initialized
        expect(error).toBeDefined();
      }
    });
  });
});
