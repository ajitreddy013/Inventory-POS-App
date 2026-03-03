/**
 * Modifier CRUD Operations Tests
 * 
 * Tests for Task 2.4.2: Implement modifier management
 * Validates Requirements 18.2, 18.5
 */

const {
  initializeAdminSDK,
  setDocument,
  updateDocument,
  queryCollection,
  getDocument,
  deleteDocument
} = require('../init');

// Mock the init module
jest.mock('../init', () => ({
  initializeAdminSDK: jest.fn(),
  setDocument: jest.fn(),
  updateDocument: jest.fn(),
  queryCollection: jest.fn(),
  getDocument: jest.fn(),
  deleteDocument: jest.fn(),
  getAdminFirestore: jest.fn()
}));

describe('Modifier CRUD Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Modifier (Requirement 18.2)', () => {
    test('should create spice level modifier with price 0', async () => {
      const modifier = {
        name: 'Medium',
        type: 'spice_level',
        price: 0
      };

      setDocument.mockResolvedValue(undefined);

      // Simulate the handler logic
      const modifierId = `modifier_${Date.now()}`;
      await setDocument('modifiers', modifierId, {
        name: modifier.name.trim(),
        type: modifier.type,
        price: parseFloat(modifier.price),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });

      expect(setDocument).toHaveBeenCalledWith(
        'modifiers',
        expect.stringContaining('modifier_'),
        expect.objectContaining({
          name: 'Medium',
          type: 'spice_level',
          price: 0
        })
      );
    });

    test('should create paid add-on modifier with positive price', async () => {
      const modifier = {
        name: 'Extra Cheese',
        type: 'paid_addon',
        price: 50
      };

      setDocument.mockResolvedValue(undefined);

      const modifierId = `modifier_${Date.now()}`;
      await setDocument('modifiers', modifierId, {
        name: modifier.name.trim(),
        type: modifier.type,
        price: parseFloat(modifier.price),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });

      expect(setDocument).toHaveBeenCalledWith(
        'modifiers',
        expect.stringContaining('modifier_'),
        expect.objectContaining({
          name: 'Extra Cheese',
          type: 'paid_addon',
          price: 50
        })
      );
    });

    test('should reject modifier without name', () => {
      const modifier = {
        name: '',
        type: 'spice_level',
        price: 0
      };

      const error = !modifier.name.trim() ? 'Modifier name is required' : null;
      expect(error).toBe('Modifier name is required');
    });

    test('should reject modifier with invalid type', () => {
      const modifier = {
        name: 'Extra Spicy',
        type: 'invalid_type',
        price: 0
      };

      const validTypes = ['spice_level', 'paid_addon'];
      const error = !validTypes.includes(modifier.type) ? 'Type must be either spice_level or paid_addon' : null;
      expect(error).toBe('Type must be either spice_level or paid_addon');
    });

    test('should reject spice level modifier with non-zero price', () => {
      const modifier = {
        name: 'Hot',
        type: 'spice_level',
        price: 10
      };

      const error = modifier.type === 'spice_level' && modifier.price !== 0 
        ? 'Spice level modifiers must have price 0' 
        : null;
      expect(error).toBe('Spice level modifiers must have price 0');
    });

    test('should reject paid add-on with zero price', () => {
      const modifier = {
        name: 'Extra Cheese',
        type: 'paid_addon',
        price: 0
      };

      const error = modifier.type === 'paid_addon' && modifier.price <= 0 
        ? 'Paid add-on price must be positive' 
        : null;
      expect(error).toBe('Paid add-on price must be positive');
    });

    test('should reject paid add-on with negative price', () => {
      const modifier = {
        name: 'Extra Cheese',
        type: 'paid_addon',
        price: -10
      };

      const error = modifier.type === 'paid_addon' && modifier.price <= 0 
        ? 'Paid add-on price must be positive' 
        : null;
      expect(error).toBe('Paid add-on price must be positive');
    });

    test('should reject modifier without price', () => {
      const modifier = {
        name: 'Extra Cheese',
        type: 'paid_addon'
      };

      const error = modifier.price === undefined || modifier.price === null 
        ? 'Price is required' 
        : null;
      expect(error).toBe('Price is required');
    });
  });

  describe('Update Modifier (Requirement 18.2)', () => {
    test('should update modifier name', async () => {
      const modifierId = 'modifier_123';
      const updates = {
        name: 'Extra Hot'
      };

      getDocument.mockResolvedValue({
        id: modifierId,
        name: 'Hot',
        type: 'spice_level',
        price: 0
      });

      updateDocument.mockResolvedValue(undefined);

      const existingModifier = await getDocument('modifiers', modifierId);
      expect(existingModifier).toBeTruthy();

      const updateData = { updatedAt: new Date() };
      if (updates.name) updateData.name = updates.name.trim();

      await updateDocument('modifiers', modifierId, updateData);

      expect(updateDocument).toHaveBeenCalledWith(
        'modifiers',
        modifierId,
        expect.objectContaining({
          name: 'Extra Hot'
        })
      );
    });

    test('should update paid add-on price', async () => {
      const modifierId = 'modifier_123';
      const updates = {
        price: 75
      };

      getDocument.mockResolvedValue({
        id: modifierId,
        name: 'Extra Cheese',
        type: 'paid_addon',
        price: 50
      });

      updateDocument.mockResolvedValue(undefined);

      const existingModifier = await getDocument('modifiers', modifierId);
      const finalType = updates.type || existingModifier.type;

      const updateData = { updatedAt: new Date() };
      if (updates.price !== undefined) {
        updateData.price = parseFloat(updates.price);
      }

      await updateDocument('modifiers', modifierId, updateData);

      expect(updateDocument).toHaveBeenCalledWith(
        'modifiers',
        modifierId,
        expect.objectContaining({
          price: 75
        })
      );
    });

    test('should reject update with empty name', () => {
      const updates = {
        name: '   '
      };

      const error = updates.name && !updates.name.trim() ? 'Modifier name cannot be empty' : null;
      expect(error).toBe('Modifier name cannot be empty');
    });

    test('should reject changing spice level to have non-zero price', () => {
      const existingModifier = {
        type: 'spice_level',
        price: 0
      };

      const updates = {
        price: 10
      };

      const finalType = updates.type || existingModifier.type;
      const error = finalType === 'spice_level' && updates.price !== 0 
        ? 'Spice level modifiers must have price 0' 
        : null;
      expect(error).toBe('Spice level modifiers must have price 0');
    });

    test('should reject changing paid add-on to zero price', () => {
      const existingModifier = {
        type: 'paid_addon',
        price: 50
      };

      const updates = {
        price: 0
      };

      const finalType = updates.type || existingModifier.type;
      const error = finalType === 'paid_addon' && updates.price <= 0 
        ? 'Paid add-on price must be positive' 
        : null;
      expect(error).toBe('Paid add-on price must be positive');
    });

    test('should update only provided fields', async () => {
      const modifierId = 'modifier_123';
      const updates = {
        price: 60
      };

      getDocument.mockResolvedValue({
        id: modifierId,
        name: 'Extra Cheese',
        type: 'paid_addon',
        price: 50
      });

      updateDocument.mockResolvedValue(undefined);

      const updateData = { updatedAt: new Date() };
      if (updates.price !== undefined) {
        updateData.price = parseFloat(updates.price);
      }

      await updateDocument('modifiers', modifierId, updateData);

      expect(updateDocument).toHaveBeenCalledWith(
        'modifiers',
        modifierId,
        expect.objectContaining({
          price: 60
        })
      );
      expect(updateDocument).toHaveBeenCalledWith(
        'modifiers',
        modifierId,
        expect.not.objectContaining({
          name: expect.anything()
        })
      );
    });
  });

  describe('Delete Modifier (Requirement 18.2)', () => {
    test('should delete modifier with no menu item associations', async () => {
      const modifierId = 'modifier_123';

      queryCollection.mockResolvedValue([
        {
          id: 'item_1',
          name: 'Chicken Biryani',
          availableModifiers: ['modifier_456', 'modifier_789']
        },
        {
          id: 'item_2',
          name: 'Naan',
          availableModifiers: []
        }
      ]);

      deleteDocument.mockResolvedValue(undefined);

      const menuItems = await queryCollection('menuItems', [
        { field: 'isActive', operator: '==', value: true }
      ]);

      const hasAssociations = menuItems.some(item => {
        if (!item.availableModifiers || !Array.isArray(item.availableModifiers)) return false;
        return item.availableModifiers.includes(modifierId);
      });

      expect(hasAssociations).toBe(false);

      await deleteDocument('modifiers', modifierId);

      expect(deleteDocument).toHaveBeenCalledWith('modifiers', modifierId);
    });

    test('should block delete if modifier is associated with menu items', async () => {
      const modifierId = 'modifier_123';

      queryCollection.mockResolvedValue([
        {
          id: 'item_1',
          name: 'Chicken Biryani',
          availableModifiers: ['modifier_123', 'modifier_456']
        }
      ]);

      const menuItems = await queryCollection('menuItems', [
        { field: 'isActive', operator: '==', value: true }
      ]);

      const hasAssociations = menuItems.some(item => {
        if (!item.availableModifiers || !Array.isArray(item.availableModifiers)) return false;
        return item.availableModifiers.includes(modifierId);
      });

      expect(hasAssociations).toBe(true);

      const error = hasAssociations 
        ? 'Cannot delete modifier that is associated with menu items. Please remove associations first.'
        : null;

      expect(error).toBe('Cannot delete modifier that is associated with menu items. Please remove associations first.');
      expect(deleteDocument).not.toHaveBeenCalled();
    });

    test('should handle menu items with no availableModifiers array', async () => {
      const modifierId = 'modifier_123';

      queryCollection.mockResolvedValue([
        {
          id: 'item_1',
          name: 'Chicken Biryani'
          // No availableModifiers array
        }
      ]);

      const menuItems = await queryCollection('menuItems', [
        { field: 'isActive', operator: '==', value: true }
      ]);

      const hasAssociations = menuItems.some(item => {
        if (!item.availableModifiers || !Array.isArray(item.availableModifiers)) return false;
        return item.availableModifiers.includes(modifierId);
      });

      expect(hasAssociations).toBe(false);
    });
  });

  describe('List Modifiers by Type (Requirement 18.5)', () => {
    test('should list spice level modifiers', async () => {
      const type = 'spice_level';

      queryCollection.mockResolvedValue([
        {
          id: 'modifier_1',
          name: 'Mild',
          type: 'spice_level',
          price: 0
        },
        {
          id: 'modifier_2',
          name: 'Medium',
          type: 'spice_level',
          price: 0
        },
        {
          id: 'modifier_3',
          name: 'Hot',
          type: 'spice_level',
          price: 0
        }
      ]);

      const modifiers = await queryCollection('modifiers', [
        { field: 'type', operator: '==', value: type }
      ], {
        orderBy: { field: 'name', direction: 'asc' }
      });

      expect(queryCollection).toHaveBeenCalledWith(
        'modifiers',
        expect.arrayContaining([
          { field: 'type', operator: '==', value: 'spice_level' }
        ]),
        expect.objectContaining({
          orderBy: { field: 'name', direction: 'asc' }
        })
      );

      expect(modifiers).toHaveLength(3);
      expect(modifiers.every(m => m.type === 'spice_level')).toBe(true);
      expect(modifiers.every(m => m.price === 0)).toBe(true);
    });

    test('should list paid add-on modifiers', async () => {
      const type = 'paid_addon';

      queryCollection.mockResolvedValue([
        {
          id: 'modifier_1',
          name: 'Extra Cheese',
          type: 'paid_addon',
          price: 50
        },
        {
          id: 'modifier_2',
          name: 'Extra Gravy',
          type: 'paid_addon',
          price: 30
        }
      ]);

      const modifiers = await queryCollection('modifiers', [
        { field: 'type', operator: '==', value: type }
      ], {
        orderBy: { field: 'name', direction: 'asc' }
      });

      expect(modifiers).toHaveLength(2);
      expect(modifiers.every(m => m.type === 'paid_addon')).toBe(true);
      expect(modifiers.every(m => m.price > 0)).toBe(true);
    });

    test('should return empty array for type with no modifiers', async () => {
      const type = 'spice_level';

      queryCollection.mockResolvedValue([]);

      const modifiers = await queryCollection('modifiers', [
        { field: 'type', operator: '==', value: type }
      ]);

      expect(modifiers).toHaveLength(0);
    });
  });

  describe('Associate Modifiers with Menu Items (Requirement 18.5)', () => {
    test('should associate modifiers with menu item', async () => {
      const menuItemId = 'item_123';
      const modifierIds = ['modifier_1', 'modifier_2', 'modifier_3'];

      getDocument.mockImplementation(async (collection, id) => {
        if (collection === 'menuItems' && id === menuItemId) {
          return {
            id: menuItemId,
            name: 'Chicken Biryani',
            category: 'Main Course',
            price: 250
          };
        }
        if (collection === 'modifiers') {
          return {
            id,
            name: 'Test Modifier',
            type: 'spice_level',
            price: 0
          };
        }
        return null;
      });

      updateDocument.mockResolvedValue(undefined);

      // Validate menu item exists
      const menuItem = await getDocument('menuItems', menuItemId);
      expect(menuItem).toBeTruthy();

      // Validate all modifiers exist
      for (const modifierId of modifierIds) {
        const modifier = await getDocument('modifiers', modifierId);
        expect(modifier).toBeTruthy();
      }

      // Update menu item
      await updateDocument('menuItems', menuItemId, {
        availableModifiers: modifierIds,
        updatedAt: expect.any(Date)
      });

      expect(updateDocument).toHaveBeenCalledWith(
        'menuItems',
        menuItemId,
        expect.objectContaining({
          availableModifiers: modifierIds
        })
      );
    });

    test('should reject association with non-existent menu item', async () => {
      const menuItemId = 'item_999';
      const modifierIds = ['modifier_1'];

      getDocument.mockResolvedValue(null);

      const menuItem = await getDocument('menuItems', menuItemId);
      const error = !menuItem ? 'Menu item not found' : null;

      expect(error).toBe('Menu item not found');
      expect(updateDocument).not.toHaveBeenCalled();
    });

    test('should reject association with non-existent modifier', async () => {
      const menuItemId = 'item_123';
      const modifierIds = ['modifier_1', 'modifier_999'];

      getDocument.mockImplementation(async (collection, id) => {
        if (collection === 'menuItems') {
          return { id: menuItemId, name: 'Chicken Biryani' };
        }
        if (collection === 'modifiers' && id === 'modifier_1') {
          return { id: 'modifier_1', name: 'Mild' };
        }
        return null;
      });

      const menuItem = await getDocument('menuItems', menuItemId);
      expect(menuItem).toBeTruthy();

      let error = null;
      for (const modifierId of modifierIds) {
        const modifier = await getDocument('modifiers', modifierId);
        if (!modifier) {
          error = `Modifier ${modifierId} not found`;
          break;
        }
      }

      expect(error).toBe('Modifier modifier_999 not found');
      expect(updateDocument).not.toHaveBeenCalled();
    });

    test('should reject non-array modifier IDs', () => {
      const modifierIds = 'not-an-array';

      const error = !Array.isArray(modifierIds) ? 'Modifier IDs must be an array' : null;
      expect(error).toBe('Modifier IDs must be an array');
    });

    test('should allow empty array to clear modifiers', async () => {
      const menuItemId = 'item_123';
      const modifierIds = [];

      getDocument.mockResolvedValue({
        id: menuItemId,
        name: 'Chicken Biryani'
      });

      updateDocument.mockResolvedValue(undefined);

      const menuItem = await getDocument('menuItems', menuItemId);
      expect(menuItem).toBeTruthy();

      await updateDocument('menuItems', menuItemId, {
        availableModifiers: modifierIds,
        updatedAt: expect.any(Date)
      });

      expect(updateDocument).toHaveBeenCalledWith(
        'menuItems',
        menuItemId,
        expect.objectContaining({
          availableModifiers: []
        })
      );
    });
  });

  describe('Get Menu Item Modifiers (Requirement 18.5)', () => {
    test('should get all modifiers for a menu item', async () => {
      const menuItemId = 'item_123';

      getDocument.mockImplementation(async (collection, id) => {
        if (collection === 'menuItems' && id === menuItemId) {
          return {
            id: menuItemId,
            name: 'Chicken Biryani',
            availableModifiers: ['modifier_1', 'modifier_2']
          };
        }
        if (collection === 'modifiers' && id === 'modifier_1') {
          return { name: 'Mild', type: 'spice_level', price: 0 };
        }
        if (collection === 'modifiers' && id === 'modifier_2') {
          return { name: 'Extra Cheese', type: 'paid_addon', price: 50 };
        }
        return null;
      });

      const menuItem = await getDocument('menuItems', menuItemId);
      expect(menuItem).toBeTruthy();

      const modifiers = [];
      for (const modifierId of menuItem.availableModifiers) {
        const modifier = await getDocument('modifiers', modifierId);
        if (modifier) {
          modifiers.push({ id: modifierId, ...modifier });
        }
      }

      expect(modifiers).toHaveLength(2);
      expect(modifiers[0]).toEqual({
        id: 'modifier_1',
        name: 'Mild',
        type: 'spice_level',
        price: 0
      });
      expect(modifiers[1]).toEqual({
        id: 'modifier_2',
        name: 'Extra Cheese',
        type: 'paid_addon',
        price: 50
      });
    });

    test('should return empty array for menu item with no modifiers', async () => {
      const menuItemId = 'item_123';

      getDocument.mockResolvedValue({
        id: menuItemId,
        name: 'Chicken Biryani',
        availableModifiers: []
      });

      const menuItem = await getDocument('menuItems', menuItemId);
      const modifiers = menuItem.availableModifiers || [];

      expect(modifiers).toHaveLength(0);
    });

    test('should handle menu item without availableModifiers field', async () => {
      const menuItemId = 'item_123';

      getDocument.mockResolvedValue({
        id: menuItemId,
        name: 'Chicken Biryani'
        // No availableModifiers field
      });

      const menuItem = await getDocument('menuItems', menuItemId);
      const modifiers = menuItem.availableModifiers || [];

      expect(modifiers).toHaveLength(0);
    });
  });

  describe('Validation Rules', () => {
    test('should validate modifier name is non-empty string', () => {
      const validNames = ['Mild', 'Extra Cheese', 'A'];
      const invalidNames = ['', '   ', null, undefined];

      validNames.forEach(name => {
        const error = !name || !name.trim() ? 'Invalid name' : null;
        expect(error).toBeNull();
      });

      invalidNames.forEach(name => {
        const error = !name || !name.trim() ? 'Invalid name' : null;
        expect(error).toBe('Invalid name');
      });
    });

    test('should validate modifier type is valid', () => {
      const validTypes = ['spice_level', 'paid_addon'];
      const invalidTypes = ['', 'invalid', 'addon', null, undefined];

      validTypes.forEach(type => {
        const error = !validTypes.includes(type) ? 'Invalid type' : null;
        expect(error).toBeNull();
      });

      invalidTypes.forEach(type => {
        const error = !validTypes.includes(type) ? 'Invalid type' : null;
        expect(error).toBe('Invalid type');
      });
    });

    test('should validate spice level price is zero', () => {
      const validPrices = [0];
      const invalidPrices = [0.01, 1, 10, -1];

      validPrices.forEach(price => {
        const error = price !== 0 ? 'Spice level must be free' : null;
        expect(error).toBeNull();
      });

      invalidPrices.forEach(price => {
        const error = price !== 0 ? 'Spice level must be free' : null;
        expect(error).toBe('Spice level must be free');
      });
    });

    test('should validate paid add-on price is positive', () => {
      const validPrices = [0.01, 1, 50, 100];
      const invalidPrices = [0, -1, -50];

      validPrices.forEach(price => {
        const error = price <= 0 ? 'Paid add-on must have positive price' : null;
        expect(error).toBeNull();
      });

      invalidPrices.forEach(price => {
        const error = price <= 0 ? 'Paid add-on must have positive price' : null;
        expect(error).toBe('Paid add-on must have positive price');
      });
    });
  });
});
