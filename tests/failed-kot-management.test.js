/**
 * Unit Tests for Failed KOT Management
 * 
 * Tests storage, retrieval, retry logic, and automatic retry functionality
 * Requirements: 22.4, 23.4
 */

const KOTRouterService = require('../src/services/kotRouterService');

// Mock Firestore
const mockFirestore = {
  collection: jest.fn(),
};

// Mock printer service
const mockPrinterService = {
  printKOT: jest.fn(),
  checkStatus: jest.fn(),
};

// Mock getAdminFirestore
jest.mock('../src/firebase/init', () => ({
  getAdminFirestore: jest.fn(() => mockFirestore),
}));

describe('Failed KOT Management Tests', () => {
  let kotRouter;

  beforeEach(() => {
    jest.clearAllMocks();
    kotRouter = new KOTRouterService(mockPrinterService);
  });

  afterEach(() => {
    if (kotRouter) {
      kotRouter.cleanup();
    }
  });

  describe('Test 1: Store Failed KOT', () => {
    test('should store failed KOT in Firestore with correct data', async () => {
      // Mock Firestore collection
      const mockAdd = jest.fn().mockResolvedValue({ id: 'failed_kot_123' });
      mockFirestore.collection.mockReturnValue({
        add: mockAdd,
      });

      await kotRouter.initialize();

      const kot = {
        id: 'kot_123',
        kotNumber: 'KOT-001',
        orderNumber: 'ORD-001',
        tableNumber: 'T1',
        waiterName: 'John',
        items: [{ name: 'Biryani', quantity: 2 }],
        timestamp: '14:30',
        printerType: 'kitchen',
      };

      await kotRouter.storeFailedKOT(kot, 'kitchen', 'Printer offline');

      expect(mockFirestore.collection).toHaveBeenCalledWith('failedKOTs');
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          kotId: 'kot_123',
          kotNumber: 'KOT-001',
          kotData: kot,
          printerType: 'kitchen',
          errorMessage: 'Printer offline',
          retryCount: 0,
        })
      );

      console.log('✓ Test 1 passed: Failed KOT stored correctly');
    });

    test('should handle Firestore errors gracefully', async () => {
      // Mock Firestore error
      mockFirestore.collection.mockReturnValue({
        add: jest.fn().mockRejectedValue(new Error('Firestore error')),
      });

      await kotRouter.initialize();

      const kot = {
        id: 'kot_123',
        kotNumber: 'KOT-001',
      };

      // Should not throw, just log error
      await expect(
        kotRouter.storeFailedKOT(kot, 'kitchen', 'Printer offline')
      ).resolves.not.toThrow();

      console.log('✓ Test 1b passed: Firestore errors handled gracefully');
    });
  });

  describe('Test 2: Retrieve Failed KOTs', () => {
    test('should retrieve all failed KOTs with retry count < 3', async () => {
      const mockDocs = [
        {
          id: 'failed_1',
          data: () => ({
            kotNumber: 'KOT-001',
            retryCount: 0,
            printerType: 'kitchen',
          }),
        },
        {
          id: 'failed_2',
          data: () => ({
            kotNumber: 'KOT-002',
            retryCount: 2,
            printerType: 'bar',
          }),
        },
      ];

      const mockSnapshot = {
        forEach: (callback) => mockDocs.forEach(callback),
      };

      const mockGet = jest.fn().mockResolvedValue(mockSnapshot);
      const mockOrderBy = jest.fn().mockReturnValue({ get: mockGet });
      const mockWhere = jest.fn().mockReturnValue({ orderBy: mockOrderBy });

      mockFirestore.collection.mockReturnValue({
        where: mockWhere,
      });

      await kotRouter.initialize();

      const failedKOTs = await kotRouter.getFailedKOTs();

      expect(mockFirestore.collection).toHaveBeenCalledWith('failedKOTs');
      expect(mockWhere).toHaveBeenCalledWith('retryCount', '<', 3);
      expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(failedKOTs).toHaveLength(2);
      expect(failedKOTs[0].kotNumber).toBe('KOT-001');
      expect(failedKOTs[1].kotNumber).toBe('KOT-002');

      console.log('✓ Test 2 passed: Failed KOTs retrieved correctly');
    });

    test('should return empty array when no failed KOTs exist', async () => {
      const mockSnapshot = {
        forEach: () => {},
      };

      const mockGet = jest.fn().mockResolvedValue(mockSnapshot);
      const mockOrderBy = jest.fn().mockReturnValue({ get: mockGet });
      const mockWhere = jest.fn().mockReturnValue({ orderBy: mockOrderBy });

      mockFirestore.collection.mockReturnValue({
        where: mockWhere,
      });

      await kotRouter.initialize();

      const failedKOTs = await kotRouter.getFailedKOTs();

      expect(failedKOTs).toEqual([]);

      console.log('✓ Test 2b passed: Empty array returned when no failed KOTs');
    });
  });

  describe('Test 3: Retry Failed KOT', () => {
    test('should successfully retry and delete failed KOT on success', async () => {
      const mockKOTData = {
        kotNumber: 'KOT-001',
        orderNumber: 'ORD-001',
        items: [{ name: 'Biryani', quantity: 2 }],
      };

      const mockDoc = {
        exists: true,
        data: () => ({
          kotData: mockKOTData,
          printerType: 'kitchen',
          retryCount: 1,
        }),
      };

      const mockDelete = jest.fn().mockResolvedValue();
      const mockGet = jest.fn().mockResolvedValue(mockDoc);
      const mockDocRef = jest.fn().mockReturnValue({
        get: mockGet,
        delete: mockDelete,
      });

      mockFirestore.collection.mockReturnValue({
        doc: mockDocRef,
      });

      // Mock successful print
      mockPrinterService.printKOT.mockResolvedValue({ success: true });

      await kotRouter.initialize();

      const result = await kotRouter.retryFailedKOT('failed_kot_123');

      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
      expect(result.message).toContain('printed successfully');

      console.log('✓ Test 3 passed: Failed KOT retried and deleted on success');
    });

    test('should increment retry count on failure', async () => {
      const mockKOTData = {
        kotNumber: 'KOT-001',
      };

      const mockDoc = {
        exists: true,
        data: () => ({
          kotData: mockKOTData,
          printerType: 'kitchen',
          retryCount: 1,
        }),
      };

      const mockUpdate = jest.fn().mockResolvedValue();
      const mockGet = jest.fn().mockResolvedValue(mockDoc);
      const mockDocRef = jest.fn().mockReturnValue({
        get: mockGet,
        update: mockUpdate,
      });

      mockFirestore.collection.mockReturnValue({
        doc: mockDocRef,
      });

      // Mock failed print
      mockPrinterService.printKOT.mockRejectedValue(new Error('Printer offline'));

      await kotRouter.initialize();

      const result = await kotRouter.retryFailedKOT('failed_kot_123');

      expect(result.success).toBe(false);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          retryCount: 2,
          lastError: 'Printer offline',
        })
      );
      expect(result.retriesRemaining).toBe(1);

      console.log('✓ Test 3b passed: Retry count incremented on failure');
    });

    test('should reject retry when max attempts reached', async () => {
      const mockDoc = {
        exists: true,
        data: () => ({
          kotData: { kotNumber: 'KOT-001' },
          printerType: 'kitchen',
          retryCount: 3,
        }),
      };

      const mockGet = jest.fn().mockResolvedValue(mockDoc);
      const mockDocRef = jest.fn().mockReturnValue({
        get: mockGet,
      });

      mockFirestore.collection.mockReturnValue({
        doc: mockDocRef,
      });

      await kotRouter.initialize();

      const result = await kotRouter.retryFailedKOT('failed_kot_123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum retry attempts');

      console.log('✓ Test 3c passed: Retry rejected when max attempts reached');
    });

    test('should handle non-existent failed KOT', async () => {
      const mockDoc = {
        exists: false,
      };

      const mockGet = jest.fn().mockResolvedValue(mockDoc);
      const mockDocRef = jest.fn().mockReturnValue({
        get: mockGet,
      });

      mockFirestore.collection.mockReturnValue({
        doc: mockDocRef,
      });

      await kotRouter.initialize();

      const result = await kotRouter.retryFailedKOT('non_existent_id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');

      console.log('✓ Test 3d passed: Non-existent failed KOT handled correctly');
    });
  });

  describe('Test 4: Automatic Retry on Printer Reconnection', () => {
    test('should auto-retry failed KOTs when kitchen printer reconnects', async () => {
      await kotRouter.initialize();

      // Set initial status to offline
      kotRouter.lastPrinterStatus = { kitchen: false, bar: false };

      // Mock failed KOTs in Firestore
      const mockDocs = [
        {
          id: 'failed_1',
          data: () => ({
            kotNumber: 'KOT-001',
            retryCount: 1,
          }),
        },
      ];

      const mockSnapshot = {
        empty: false,
        size: 1,
        forEach: (callback) => mockDocs.forEach(callback),
      };

      const mockGet = jest.fn().mockResolvedValue(mockSnapshot);
      const mockWhere = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({ get: mockGet }),
      });

      mockFirestore.collection.mockReturnValue({
        where: mockWhere,
      });

      // Simulate kitchen printer coming online
      mockPrinterService.checkStatus
        .mockResolvedValueOnce({ online: true, status: 'online' })   // kitchen online
        .mockResolvedValueOnce({ online: false, status: 'offline' }); // bar offline

      // Trigger status check
      await kotRouter.checkPrinterStatusAndRetry();

      // Verify auto-retry was attempted for kitchen
      expect(mockWhere).toHaveBeenCalledWith('printerType', '==', 'kitchen');

      console.log('✓ Test 4 passed: Auto-retry triggered on printer reconnection');
    });

    test('should not auto-retry when printer stays online', async () => {
      await kotRouter.initialize();

      // Set initial status to online
      kotRouter.lastPrinterStatus = { kitchen: true, bar: true };

      // Mock Firestore to track calls
      const mockWhere = jest.fn();
      mockFirestore.collection.mockReturnValue({
        where: mockWhere,
      });

      // Simulate printers staying online
      mockPrinterService.checkStatus
        .mockResolvedValueOnce({ online: true, status: 'online' })
        .mockResolvedValueOnce({ online: true, status: 'online' });

      // Check - printer still online
      await kotRouter.checkPrinterStatusAndRetry();

      // Should not query for failed KOTs since printer didn't reconnect
      expect(mockWhere).not.toHaveBeenCalled();

      console.log('✓ Test 4b passed: No auto-retry when printer stays online');
    });

    test('should handle both kitchen and bar printer reconnections', async () => {
      // Setup: both printers offline
      mockPrinterService.checkStatus.mockImplementation((printerName) => {
        return Promise.resolve({ online: false, status: 'offline' });
      });

      await kotRouter.initialize();
      await kotRouter.checkPrinterStatusAndRetry();

      // Mock Firestore
      const mockSnapshot = { empty: true, size: 0, forEach: () => {} };
      const mockGet = jest.fn().mockResolvedValue(mockSnapshot);
      const mockWhere = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({ get: mockGet }),
      });

      mockFirestore.collection.mockReturnValue({
        where: mockWhere,
      });

      // Both printers come online
      mockPrinterService.checkStatus.mockImplementation((printerName) => {
        return Promise.resolve({ online: true, status: 'online' });
      });

      await kotRouter.checkPrinterStatusAndRetry();

      // Should check for failed KOTs for both printers
      expect(mockWhere).toHaveBeenCalledWith('printerType', '==', 'kitchen');
      expect(mockWhere).toHaveBeenCalledWith('printerType', '==', 'bar');

      console.log('✓ Test 4c passed: Both printers handled correctly');
    });
  });

  describe('Test 5: Cleanup', () => {
    test('should stop monitoring when cleanup is called', async () => {
      await kotRouter.initialize();

      // Verify monitoring started
      expect(kotRouter.printerStatusMonitor).toBeDefined();

      // Cleanup
      kotRouter.cleanup();

      // Verify monitoring stopped
      expect(kotRouter.printerStatusMonitor).toBeNull();

      console.log('✓ Test 5 passed: Cleanup stops monitoring correctly');
    });
  });
});

// Run tests
async function runTests() {
  console.log('\n=== Failed KOT Management Unit Tests ===\n');

  try {
    // Note: These tests use Jest, so they should be run with:
    // npm test -- tests/test-failed-kot-management.js
    console.log('Run these tests with: npm test -- tests/test-failed-kot-management.js');
    console.log('\nTests cover:');
    console.log('1. Store failed KOT in Firestore');
    console.log('2. Retrieve failed KOTs');
    console.log('3. Retry failed KOT (success and failure cases)');
    console.log('4. Automatic retry on printer reconnection');
    console.log('5. Cleanup and resource management');
    console.log('\nRequirements validated: 22.4, 23.4');
  } catch (error) {
    console.error('Test execution error:', error);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = {
  runTests,
};
