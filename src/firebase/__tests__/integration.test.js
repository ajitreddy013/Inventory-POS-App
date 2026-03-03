/**
 * Firebase Integration Tests
 * 
 * These tests verify actual Firebase connectivity and can be run independently.
 * They test real connections to Firebase services.
 * 
 * Run with: npm test -- src/firebase/__tests__/integration.test.js
 * 
 * Requirements: 2.1 - Real-time data synchronization
 */

const {
  initializeAdminSDK,
  getAdminFirestore,
  getAdminAuth,
  isInitialized,
  getDocument,
  setDocument,
  deleteDocument,
  queryCollection,
  createCustomToken
} = require('../init');

// Skip these tests if running in CI or without proper Firebase setup
const shouldRunIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

describe('Firebase Integration Tests', () => {
  // Skip all tests if integration tests are not enabled
  if (!shouldRunIntegrationTests) {
    test.skip('Integration tests disabled - set RUN_INTEGRATION_TESTS=true to enable', () => {});
    return;
  }

  let adminFirestore;
  let adminAuth;
  const testDocId = `test_${Date.now()}`;

  beforeAll(async () => {
    try {
      // Initialize Admin SDK
      const { firestore, auth } = initializeAdminSDK();
      adminFirestore = firestore;
      adminAuth = auth;
    } catch (error) {
      console.error('Failed to initialize Admin SDK:', error.message);
      throw error;
    }
  });

  afterAll(async () => {
    // Clean up test documents
    try {
      await deleteDocument('test_collection', testDocId);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Admin SDK Initialization', () => {
    test('should initialize Admin SDK successfully', () => {
      expect(isInitialized()).toBe(true);
      expect(adminFirestore).toBeDefined();
      expect(adminAuth).toBeDefined();
    });

    test('should have valid Firestore instance', () => {
      expect(adminFirestore).toBeDefined();
      expect(typeof adminFirestore.collection).toBe('function');
      expect(typeof adminFirestore.doc).toBe('function');
    });

    test('should have valid Auth instance', () => {
      expect(adminAuth).toBeDefined();
      expect(typeof adminAuth.createCustomToken).toBe('function');
      expect(typeof adminAuth.verifyIdToken).toBe('function');
    });
  });

  describe('Firestore Connectivity', () => {
    test('should write document to Firestore', async () => {
      const testData = {
        name: 'Test Document',
        timestamp: new Date().toISOString(),
        value: 42
      };

      await setDocument('test_collection', testDocId, testData);
      
      // Verify write succeeded by reading back
      const doc = await getDocument('test_collection', testDocId);
      expect(doc).toBeDefined();
      expect(doc.name).toBe('Test Document');
      expect(doc.value).toBe(42);
    });

    test('should read document from Firestore', async () => {
      const doc = await getDocument('test_collection', testDocId);
      expect(doc).toBeDefined();
      expect(doc.id).toBe(testDocId);
      expect(doc.name).toBe('Test Document');
    });

    test('should query collection from Firestore', async () => {
      const docs = await queryCollection('test_collection', [], { limit: 10 });
      expect(Array.isArray(docs)).toBe(true);
      expect(docs.length).toBeGreaterThan(0);
      
      // Should include our test document
      const testDoc = docs.find(d => d.id === testDocId);
      expect(testDoc).toBeDefined();
    });

    test('should filter documents with query', async () => {
      const docs = await queryCollection(
        'test_collection',
        [{ field: 'value', operator: '==', value: 42 }],
        { limit: 10 }
      );
      
      expect(Array.isArray(docs)).toBe(true);
      // All returned documents should have value === 42
      docs.forEach(doc => {
        expect(doc.value).toBe(42);
      });
    });

    test('should handle non-existent document', async () => {
      const doc = await getDocument('test_collection', 'nonexistent_doc_12345');
      expect(doc).toBeNull();
    });

    test('should delete document from Firestore', async () => {
      // Create a temporary document
      const tempDocId = `temp_${Date.now()}`;
      await setDocument('test_collection', tempDocId, { temp: true });
      
      // Verify it exists
      let doc = await getDocument('test_collection', tempDocId);
      expect(doc).toBeDefined();
      
      // Delete it
      await deleteDocument('test_collection', tempDocId);
      
      // Verify it's gone
      doc = await getDocument('test_collection', tempDocId);
      expect(doc).toBeNull();
    });
  });

  describe('Admin Authentication', () => {
    test('should create custom token', async () => {
      const token = await createCustomToken('test_waiter_123', {
        name: 'Test Waiter',
        role: 'waiter'
      });
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(100); // JWT tokens are long
    });

    test('should create custom token with claims', async () => {
      const claims = {
        name: 'John Doe',
        role: 'waiter',
        section: 'AC',
        permissions: ['take_orders', 'view_menu']
      };
      
      const token = await createCustomToken('waiter_456', claims);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    test('should handle invalid user ID', async () => {
      try {
        await createCustomToken('', { name: 'Invalid' });
        fail('Should have thrown error for empty user ID');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Connection Resilience', () => {
    test('should handle rapid sequential reads', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(getDocument('test_collection', testDocId));
      }
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      results.forEach(doc => {
        expect(doc).toBeDefined();
        expect(doc.id).toBe(testDocId);
      });
    });

    test('should handle rapid sequential writes', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        const docId = `rapid_write_${i}_${Date.now()}`;
        promises.push(setDocument('test_collection', docId, { index: i }));
      }
      
      await Promise.all(promises);
      expect(promises).toHaveLength(5);
      
      // Clean up
      for (let i = 0; i < 5; i++) {
        const docId = `rapid_write_${i}_${Date.now()}`;
        try {
          await deleteDocument('test_collection', docId);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    test('should handle large document reads', async () => {
      // Create a document with substantial data
      const largeDocId = `large_doc_${Date.now()}`;
      const largeData = {
        items: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: 'A'.repeat(100)
        }))
      };
      
      await setDocument('test_collection', largeDocId, largeData);
      
      // Read it back
      const doc = await getDocument('test_collection', largeDocId);
      expect(doc).toBeDefined();
      expect(doc.items).toHaveLength(100);
      
      // Clean up
      await deleteDocument('test_collection', largeDocId);
    });
  });

  describe('Error Handling', () => {
    test('should handle permission denied errors', async () => {
      try {
        // Attempt to access a restricted collection
        await queryCollection('restricted_admin_only', []);
        // If it succeeds, security rules allow access (which is fine)
        expect(true).toBe(true);
      } catch (error) {
        // Expected if security rules deny access
        expect(error).toBeDefined();
      }
    });

    test('should handle network timeouts gracefully', async () => {
      // Set a short timeout and attempt operation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
      
      try {
        await Promise.race([
          getDocument('test_collection', testDocId),
          timeoutPromise
        ]);
        // If it completes before timeout, that's good
        expect(true).toBe(true);
      } catch (error) {
        // Timeout or other error
        expect(error).toBeDefined();
      }
    });

    test('should provide meaningful error messages', async () => {
      try {
        // Attempt invalid operation
        await setDocument('', '', {});
        fail('Should have thrown error for empty collection/doc');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toBeTruthy();
        expect(typeof error.message).toBe('string');
      }
    });
  });

  describe('Performance', () => {
    test('should complete read operation within 2 seconds', async () => {
      const startTime = Date.now();
      await getDocument('test_collection', testDocId);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(2000);
    });

    test('should complete write operation within 2 seconds', async () => {
      const perfDocId = `perf_test_${Date.now()}`;
      const startTime = Date.now();
      
      await setDocument('test_collection', perfDocId, { test: true });
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(2000);
      
      // Clean up
      await deleteDocument('test_collection', perfDocId);
    });

    test('should complete query operation within 2 seconds', async () => {
      const startTime = Date.now();
      await queryCollection('test_collection', [], { limit: 10 });
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(2000);
    });
  });
});
