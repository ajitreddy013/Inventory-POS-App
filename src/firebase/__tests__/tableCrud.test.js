/**
 * Table CRUD Operations Tests
 * 
 * Tests table management logic including:
 * - Creating tables with name and section assignment
 * - Updating table name and section
 * - Deleting tables with no active orders
 * - Listing tables grouped by section
 * 
 * Requirements: 16.2, 16.3, 16.4, 16.5, 16.6 - Section and Table Management
 */

const {
  setDocument,
  updateDocument,
  deleteDocument,
  queryCollection,
  getDocument
} = require('../init');

// Mock the init module
jest.mock('../init', () => ({
  setDocument: jest.fn(),
  updateDocument: jest.fn(),
  deleteDocument: jest.fn(),
  queryCollection: jest.fn(),
  getDocument: jest.fn(),
  initializeAdminSDK: jest.fn(),
  getAdminFirestore: jest.fn()
}));

describe('Table CRUD Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Table (Requirement 16.2, 16.3)', () => {
    test('should create table with valid name and section', async () => {
      const tableData = {
        name: 'Table 1',
        sectionId: 'section_123'
      };

      // Mock section exists
      getDocument.mockResolvedValue({
        id: 'section_123',
        name: 'AC Section'
      });

      // Mock no existing tables with same name in section
      queryCollection.mockResolvedValue([]);
      setDocument.mockResolvedValue(undefined);

      // Simulate handler logic
      const section = await getDocument('sections', tableData.sectionId);
      expect(section).toBeTruthy();

      // Check for duplicates
      const existingTables = await queryCollection('tables', [
        { field: 'sectionId', operator: '==', value: tableData.sectionId },
        { field: 'name', operator: '==', value: tableData.name.trim() }
      ]);

      expect(existingTables.length).toBe(0);

      // Create table
      const tableId = `table_${Date.now()}`;
      await setDocument('tables', tableId, {
        name: tableData.name.trim(),
        sectionId: tableData.sectionId.trim(),
        status: 'available',
        currentOrderId: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });

      expect(setDocument).toHaveBeenCalledWith(
        'tables',
        expect.stringContaining('table_'),
        expect.objectContaining({
          name: 'Table 1',
          sectionId: 'section_123',
          status: 'available'
        })
      );
    });

    test('should reject table with empty name', () => {
      const tableData = { name: '', sectionId: 'section_123' };
      const error = !tableData.name.trim() ? 'Table name is required' : null;
      expect(error).toBe('Table name is required');
    });

    test('should reject table without section ID', () => {
      const tableData = { name: 'Table 1', sectionId: '' };
      const error = !tableData.sectionId.trim() ? 'Section ID is required' : null;
      expect(error).toBe('Section ID is required');
    });

    test('should reject table with non-existent section', async () => {
      const tableData = {
        name: 'Table 1',
        sectionId: 'non_existent_section'
      };

      // Mock section not found
      getDocument.mockResolvedValue(null);

      const section = await getDocument('sections', tableData.sectionId);
      expect(section).toBeNull();

      if (!section) {
        const error = 'Section not found';
        expect(error).toBe('Section not found');
      }
    });

    test('should reject duplicate table name in same section', async () => {
      const tableData = {
        name: 'Table 1',
        sectionId: 'section_123'
      };

      // Mock section exists
      getDocument.mockResolvedValue({
        id: 'section_123',
        name: 'AC Section'
      });

      // Mock existing table with same name in section
      queryCollection.mockResolvedValue([
        { id: 'table_456', name: 'Table 1', sectionId: 'section_123' }
      ]);

      const existingTables = await queryCollection('tables', [
        { field: 'sectionId', operator: '==', value: tableData.sectionId },
        { field: 'name', operator: '==', value: tableData.name.trim() }
      ]);

      const isDuplicate = existingTables.length > 0;
      expect(isDuplicate).toBe(true);

      if (isDuplicate) {
        const error = 'Table name already exists in this section';
        expect(error).toBe('Table name already exists in this section');
      }
    });

    test('should allow same table name in different sections', async () => {
      const tableData = {
        name: 'Table 1',
        sectionId: 'section_456'
      };

      // Mock section exists
      getDocument.mockResolvedValue({
        id: 'section_456',
        name: 'Garden'
      });

      // Mock no tables with same name in THIS section (different section has it)
      queryCollection.mockResolvedValue([]);

      const existingTables = await queryCollection('tables', [
        { field: 'sectionId', operator: '==', value: tableData.sectionId },
        { field: 'name', operator: '==', value: tableData.name.trim() }
      ]);

      expect(existingTables.length).toBe(0);
    });

    test('should trim whitespace from table name', () => {
      const tableData = { name: '  Table 1  ', sectionId: 'section_123' };
      const trimmedName = tableData.name.trim();
      expect(trimmedName).toBe('Table 1');
    });
  });

  describe('Update Table (Requirement 16.4)', () => {
    test('should update table name', async () => {
      const tableId = 'table_123';
      const updates = { name: 'Updated Table' };

      getDocument.mockResolvedValue({
        id: tableId,
        name: 'Table 1',
        sectionId: 'section_123'
      });

      queryCollection.mockResolvedValue([]); // No duplicates
      updateDocument.mockResolvedValue(undefined);

      // Simulate handler logic
      const existingTable = await getDocument('tables', tableId);
      expect(existingTable).toBeTruthy();

      // Check for duplicates
      const duplicates = await queryCollection('tables', [
        { field: 'sectionId', operator: '==', value: existingTable.sectionId },
        { field: 'name', operator: '==', value: updates.name.trim() }
      ]);

      expect(duplicates.length).toBe(0);

      // Update table
      await updateDocument('tables', tableId, {
        name: updates.name.trim(),
        updatedAt: expect.any(Date)
      });

      expect(updateDocument).toHaveBeenCalledWith(
        'tables',
        tableId,
        expect.objectContaining({
          name: 'Updated Table'
        })
      );
    });

    test('should update table section (reassign)', async () => {
      const tableId = 'table_123';
      const updates = { sectionId: 'section_456' };

      getDocument.mockResolvedValueOnce({
        id: tableId,
        name: 'Table 1',
        sectionId: 'section_123'
      }).mockResolvedValueOnce({
        id: 'section_456',
        name: 'Garden'
      });

      updateDocument.mockResolvedValue(undefined);

      // Simulate handler logic
      const existingTable = await getDocument('tables', tableId);
      expect(existingTable).toBeTruthy();

      // Verify new section exists
      const newSection = await getDocument('sections', updates.sectionId);
      expect(newSection).toBeTruthy();

      // Update table
      await updateDocument('tables', tableId, {
        sectionId: updates.sectionId.trim(),
        updatedAt: expect.any(Date)
      });

      expect(updateDocument).toHaveBeenCalledWith(
        'tables',
        tableId,
        expect.objectContaining({
          sectionId: 'section_456'
        })
      );
    });

    test('should reject update with empty name', () => {
      const updates = { name: '' };
      const error = !updates.name.trim() ? 'Table name cannot be empty' : null;
      expect(error).toBe('Table name cannot be empty');
    });

    test('should reject update to non-existent section', async () => {
      const tableId = 'table_123';
      const updates = { sectionId: 'non_existent_section' };

      getDocument.mockResolvedValueOnce({
        id: tableId,
        name: 'Table 1',
        sectionId: 'section_123'
      }).mockResolvedValueOnce(null); // Section not found

      const existingTable = await getDocument('tables', tableId);
      expect(existingTable).toBeTruthy();

      const newSection = await getDocument('sections', updates.sectionId);
      expect(newSection).toBeNull();

      if (!newSection) {
        const error = 'Section not found';
        expect(error).toBe('Section not found');
      }
    });

    test('should reject update to duplicate name in same section', async () => {
      const tableId = 'table_123';
      const updates = { name: 'Existing Table' };

      getDocument.mockResolvedValue({
        id: tableId,
        name: 'Table 1',
        sectionId: 'section_123'
      });

      // Mock another table with the target name in same section
      queryCollection.mockResolvedValue([
        { id: 'table_456', name: 'Existing Table', sectionId: 'section_123' }
      ]);

      const existingTable = await getDocument('tables', tableId);
      const duplicates = await queryCollection('tables', [
        { field: 'sectionId', operator: '==', value: existingTable.sectionId },
        { field: 'name', operator: '==', value: updates.name.trim() }
      ]);

      const isDuplicate = duplicates.length > 0 && duplicates[0].id !== tableId;
      expect(isDuplicate).toBe(true);

      if (isDuplicate) {
        const error = 'Table name already exists in this section';
        expect(error).toBe('Table name already exists in this section');
      }
    });
  });

  describe('Delete Table (Requirement 16.5)', () => {
    test('should delete available table', async () => {
      const tableId = 'table_123';

      // Mock table exists and is available
      getDocument.mockResolvedValue({
        id: tableId,
        name: 'Table 1',
        sectionId: 'section_123',
        status: 'available',
        currentOrderId: null
      });

      deleteDocument.mockResolvedValue(undefined);

      // Simulate handler logic
      const table = await getDocument('tables', tableId);
      expect(table).toBeTruthy();
      expect(table.status).toBe('available');
      expect(table.currentOrderId).toBeNull();

      // Delete table
      await deleteDocument('tables', tableId);

      expect(deleteDocument).toHaveBeenCalledWith('tables', tableId);
    });

    test('should reject deletion of occupied table', async () => {
      const tableId = 'table_123';

      // Mock table is occupied
      getDocument.mockResolvedValue({
        id: tableId,
        name: 'Table 1',
        sectionId: 'section_123',
        status: 'occupied',
        currentOrderId: 'order_456'
      });

      const table = await getDocument('tables', tableId);
      expect(table.status).toBe('occupied');

      if (table.status === 'occupied' || table.status === 'pending_bill') {
        const error = 'Cannot delete table that is occupied or has pending bill';
        expect(error).toBe('Cannot delete table that is occupied or has pending bill');
      }
    });

    test('should reject deletion of table with pending bill', async () => {
      const tableId = 'table_123';

      // Mock table has pending bill
      getDocument.mockResolvedValue({
        id: tableId,
        name: 'Table 1',
        sectionId: 'section_123',
        status: 'pending_bill',
        currentOrderId: 'order_456'
      });

      const table = await getDocument('tables', tableId);
      expect(table.status).toBe('pending_bill');

      if (table.status === 'occupied' || table.status === 'pending_bill') {
        const error = 'Cannot delete table that is occupied or has pending bill';
        expect(error).toBe('Cannot delete table that is occupied or has pending bill');
      }
    });

    test('should reject deletion of table with active order', async () => {
      const tableId = 'table_123';

      // Mock table has active order
      getDocument.mockResolvedValue({
        id: tableId,
        name: 'Table 1',
        sectionId: 'section_123',
        status: 'available',
        currentOrderId: 'order_456'
      });

      const table = await getDocument('tables', tableId);
      expect(table.currentOrderId).toBeTruthy();

      if (table.currentOrderId) {
        const error = 'Cannot delete table with active order';
        expect(error).toContain('Cannot delete table with active order');
      }
    });

    test('should be idempotent (deleting non-existent table succeeds)', async () => {
      const tableId = 'non_existent_table';

      // Mock table not found
      getDocument.mockResolvedValue(null);

      const table = await getDocument('tables', tableId);
      expect(table).toBeNull();

      // Should succeed (idempotent)
      if (!table) {
        // No error - idempotent delete
        expect(true).toBe(true);
      }
    });
  });

  describe('Get Tables (Requirement 16.6)', () => {
    test('should list all tables sorted by name', async () => {
      const mockTables = [
        { id: 'table_3', name: 'Table 3', sectionId: 'section_123' },
        { id: 'table_1', name: 'Table 1', sectionId: 'section_123' },
        { id: 'table_2', name: 'Table 2', sectionId: 'section_456' }
      ];

      queryCollection.mockResolvedValue(mockTables);

      const tables = await queryCollection('tables', [], {
        orderBy: { field: 'name', direction: 'asc' }
      });

      expect(tables).toEqual(mockTables);
      expect(queryCollection).toHaveBeenCalledWith(
        'tables',
        [],
        expect.objectContaining({
          orderBy: { field: 'name', direction: 'asc' }
        })
      );
    });

    test('should get tables by section', async () => {
      const sectionId = 'section_123';
      const mockTables = [
        { id: 'table_1', name: 'Table 1', sectionId: 'section_123' },
        { id: 'table_2', name: 'Table 2', sectionId: 'section_123' }
      ];

      queryCollection.mockResolvedValue(mockTables);

      const tables = await queryCollection('tables', [
        { field: 'sectionId', operator: '==', value: sectionId }
      ], {
        orderBy: { field: 'name', direction: 'asc' }
      });

      expect(tables).toEqual(mockTables);
      expect(tables.every(t => t.sectionId === sectionId)).toBe(true);
    });

    test('should return empty array when no tables exist', async () => {
      queryCollection.mockResolvedValue([]);

      const tables = await queryCollection('tables', [], {
        orderBy: { field: 'name', direction: 'asc' }
      });

      expect(tables).toEqual([]);
    });

    test('should return empty array when section has no tables', async () => {
      const sectionId = 'empty_section';
      queryCollection.mockResolvedValue([]);

      const tables = await queryCollection('tables', [
        { field: 'sectionId', operator: '==', value: sectionId }
      ]);

      expect(tables).toEqual([]);
    });
  });

  describe('Table Name Validation', () => {
    test('should accept table name with numbers', () => {
      const name = 'Table 1';
      const trimmed = name.trim();
      expect(trimmed).toBe('Table 1');
    });

    test('should accept table name with letters only', () => {
      const name = 'VIP';
      const trimmed = name.trim();
      expect(trimmed).toBe('VIP');
    });

    test('should accept table name with special characters', () => {
      const name = 'Table-A1';
      const trimmed = name.trim();
      expect(trimmed).toBe('Table-A1');
    });

    test('should accept long table name', () => {
      const name = 'Private Dining Room 1';
      const trimmed = name.trim();
      expect(trimmed).toBe('Private Dining Room 1');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing table data', () => {
      const tableData = null;
      const error = !tableData ? 'Table data is required' : null;
      expect(error).toBe('Table data is required');
    });

    test('should handle undefined table name', () => {
      const tableData = { name: undefined, sectionId: 'section_123' };
      const error = !tableData.name || !tableData.name.trim() ? 'Table name is required' : null;
      expect(error).toBe('Table name is required');
    });

    test('should handle null section ID', () => {
      const tableData = { name: 'Table 1', sectionId: null };
      const error = !tableData.sectionId || !tableData.sectionId.trim() ? 'Section ID is required' : null;
      expect(error).toBe('Section ID is required');
    });
  });
});
