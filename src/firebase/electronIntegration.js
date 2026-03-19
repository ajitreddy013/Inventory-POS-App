/**
 * Firebase Admin SDK Integration for Electron Main Process
 *
 * This file provides example IPC handlers and integration patterns for using
 * Firebase Admin SDK in the Electron desktop application.
 *
 * Usage: Import these handlers in your main Electron process file (public/electron.js)
 */

const { ipcMain } = require('electron');
const bcrypt = require('bcrypt');
const {
  initializeAdminSDK,
  createCustomToken,
  getDocument,
  setDocument,
  updateDocument,
  deleteDocument,
  queryCollection,
  runTransaction,
  getAdminFirestore,
} = require('./init');

/**
 * Initialize Firebase Admin SDK when Electron app starts
 *
 * Add this to your app.whenReady() handler in public/electron.js:
 *
 * app.whenReady().then(async () => {
 *   try {
 *     await initializeFirebaseAdmin();
 *     createWindow();
 *   } catch (error) {
 *     console.error('Failed to initialize Firebase Admin:', error);
 *     app.quit();
 *   }
 * });
 */
async function initializeFirebaseAdmin() {
  try {
    console.log('Initializing Firebase Admin SDK for desktop app...');
    await initializeAdminSDK();
    console.log('Firebase Admin SDK initialized successfully');

    // Register IPC handlers
    registerWaiterHandlers();
    registerManagerHandlers();
    registerMenuHandlers();
    registerModifierHandlers();
    registerOrderHandlers();
    registerInventoryHandlers();
    registerSectionHandlers();
    registerBillingHandlers();
    registerWaiterReportingHandlers();
    registerKOTRouterStub();
    registerRealtimeListeners();
    registerTableOrderHandlers();
    registerPendingBillHandlers();

    console.log('Firebase IPC handlers registered');
  } catch (error) {
    console.error('Firebase Admin SDK initialization failed:', error);
    throw error;
  }
}

/**
 * WAITER AUTHENTICATION HANDLERS
 *
 * These handlers manage waiter authentication using custom tokens.
 * The desktop app validates PINs and generates tokens for mobile apps.
 */
function registerWaiterHandlers() {
  const normalizeWaiterPin = (value) => String(value ?? '').trim();

  const normalizeWaiterName = (value) =>
    String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();

  const waiterNameKey = (value) => normalizeWaiterName(value).toLowerCase();

  const toMillis = (value) => {
    if (!value) return 0;
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value._seconds === 'number') return value._seconds * 1000;
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) ? ts : 0;
  };

  const dedupeWaiters = (list) => {
    const byIdentity = new Map();

    for (const waiter of list || []) {
      const pin = normalizeWaiterPin(waiter.pin);
      const name = normalizeWaiterName(waiter.name);
      const identity = `${waiterNameKey(name)}::${pin}`;
      const key = pin ? identity : waiter.id;

      if (!byIdentity.has(key)) {
        byIdentity.set(key, {
          ...waiter,
          name,
          pin,
        });
        continue;
      }

      const current = byIdentity.get(key);
      const currentTs = Math.max(
        toMillis(current.updatedAt),
        toMillis(current.createdAt)
      );
      const nextTs = Math.max(
        toMillis(waiter.updatedAt),
        toMillis(waiter.createdAt)
      );
      const preferNext =
        (!!waiter.isActive && !current.isActive) ||
        (!!waiter.isActive === !!current.isActive && nextTs > currentTs);

      if (preferNext) {
        byIdentity.set(key, {
          ...waiter,
          name,
          pin,
        });
      }
    }

    return Array.from(byIdentity.values()).sort((a, b) =>
      normalizeWaiterName(a.name).localeCompare(
        normalizeWaiterName(b.name),
        undefined,
        {
          sensitivity: 'base',
        }
      )
    );
  };

  // Authenticate waiter with PIN
  ipcMain.handle('firebase:authenticate-waiter', async (event, pin) => {
    try {
      const normalizedPin = normalizeWaiterPin(pin);

      // Validate PIN format
      if (!normalizedPin || !/^\d{4,6}$/.test(normalizedPin)) {
        return { success: false, error: 'Invalid PIN format' };
      }

      // Read and normalize to avoid legacy type mismatches (string vs number PINs).
      const allWaiters = await queryCollection('waiters', []);
      const waiters = (allWaiters || []).filter(
        (w) => !!w.isActive && normalizeWaiterPin(w.pin) === normalizedPin
      );

      if (waiters.length === 0) {
        return { success: false, error: 'Invalid PIN or inactive account' };
      }

      const waiter = waiters[0];

      // Create custom token for mobile app authentication
      const customToken = await createCustomToken(waiter.id, {
        name: waiter.name,
        role: 'waiter',
      });

      return {
        success: true,
        token: customToken,
        waiter: {
          id: waiter.id,
          name: waiter.name,
          pin: normalizeWaiterPin(waiter.pin),
        },
      };
    } catch (error) {
      console.error('Error authenticating waiter:', error);
      return { success: false, error: 'Authentication failed' };
    }
  });

  // Create new waiter
  ipcMain.handle('firebase:create-waiter', async (event, waiterData) => {
    try {
      const { name, pin } = waiterData;
      const normalizedName = normalizeWaiterName(name);
      const normalizedPin = normalizeWaiterPin(pin);

      // Validate input
      if (
        !normalizedName ||
        !normalizedPin ||
        !/^\d{4,6}$/.test(normalizedPin)
      ) {
        return { success: false, error: 'Invalid waiter data' };
      }

      // Enforce uniqueness using normalized values across all waiter docs.
      const existingWaiters = await queryCollection('waiters', []);
      const nameInUse = (existingWaiters || []).some(
        (w) => waiterNameKey(w.name) === waiterNameKey(normalizedName)
      );
      if (nameInUse) {
        return { success: false, error: 'Waiter name already exists' };
      }

      const hasSameIdentity = (existingWaiters || []).some(
        (w) =>
          waiterNameKey(w.name) === waiterNameKey(normalizedName) &&
          normalizeWaiterPin(w.pin) === normalizedPin
      );
      if (hasSameIdentity) {
        return {
          success: false,
          error: 'Waiter with same name and PIN already exists',
        };
      }

      const pinInUse = (existingWaiters || []).some(
        (w) => normalizeWaiterPin(w.pin) === normalizedPin
      );

      if (pinInUse) {
        return { success: false, error: 'PIN already in use' };
      }

      // Create waiter document
      const waiterId = `waiter_${Date.now()}`;
      await setDocument('waiters', waiterId, {
        name: normalizedName,
        pin: normalizedPin,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        success: true,
        waiter: { id: waiterId, name: normalizedName, pin: normalizedPin },
      };
    } catch (error) {
      console.error('Error creating waiter:', error);
      return { success: false, error: 'Failed to create waiter' };
    }
  });

  // Update waiter PIN
  ipcMain.handle(
    'firebase:update-waiter-pin',
    async (event, waiterId, newPin) => {
      try {
        const normalizedPin = normalizeWaiterPin(newPin);

        // Validate PIN format
        if (!normalizedPin || !/^\d{4,6}$/.test(normalizedPin)) {
          return { success: false, error: 'Invalid PIN format' };
        }

        // Check PIN uniqueness with normalized comparison across all docs.
        const existingWaiters = await queryCollection('waiters', []);
        const duplicate = (existingWaiters || []).find(
          (w) =>
            normalizeWaiterPin(w.pin) === normalizedPin && w.id !== waiterId
        );

        if (duplicate) {
          return { success: false, error: 'PIN already in use' };
        }

        // Update waiter PIN
        await updateDocument('waiters', waiterId, {
          pin: normalizedPin,
          updatedAt: new Date(),
        });

        return { success: true };
      } catch (error) {
        console.error('Error updating waiter PIN:', error);
        return { success: false, error: 'Failed to update PIN' };
      }
    }
  );

  // Get all waiters
  ipcMain.handle('firebase:get-waiters', async () => {
    try {
      const waiters = await queryCollection('waiters', [], {
        orderBy: { field: 'name', direction: 'asc' },
      });
      return { success: true, waiters: dedupeWaiters(waiters) };
    } catch (error) {
      console.error('Error getting waiters:', error);
      return { success: false, error: 'Failed to get waiters' };
    }
  });

  // Deactivate waiter
  ipcMain.handle(
    'firebase:deactivate-waiter',
    async (event, waiterId, isActive = false) => {
      try {
        await updateDocument('waiters', waiterId, {
          isActive,
          updatedAt: new Date(),
        });
        return { success: true };
      } catch (error) {
        console.error('Error updating waiter status:', error);
        return { success: false, error: 'Failed to update waiter status' };
      }
    }
  );

  // Delete waiter
  ipcMain.handle('firebase:delete-waiter', async (event, waiterId) => {
    try {
      if (!waiterId) {
        return { success: false, error: 'Waiter ID is required' };
      }

      await deleteDocument('waiters', waiterId);
      return { success: true };
    } catch (error) {
      console.error('Error deleting waiter:', error);
      return { success: false, error: 'Failed to delete waiter' };
    }
  });
}

/**
 * MANAGER AUTHENTICATION HANDLERS
 *
 * These handlers manage manager accounts with bcrypt-hashed PINs.
 * Managers have elevated privileges for sensitive operations.
 */
function registerManagerHandlers() {
  const SALT_ROUNDS = 10;

  const normalizeManagerName = (value) =>
    String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();

  const managerNameKey = (value) => normalizeManagerName(value).toLowerCase();

  const toMillis = (value) => {
    if (!value) return 0;
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value._seconds === 'number') return value._seconds * 1000;
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) ? ts : 0;
  };

  const dedupeManagers = (list) => {
    const byName = new Map();

    for (const manager of list || []) {
      const name = normalizeManagerName(manager.name);
      const key = managerNameKey(name) || manager.id;

      if (!byName.has(key)) {
        byName.set(key, { ...manager, name });
        continue;
      }

      const current = byName.get(key);
      const currentTs = Math.max(
        toMillis(current.updatedAt),
        toMillis(current.createdAt)
      );
      const nextTs = Math.max(
        toMillis(manager.updatedAt),
        toMillis(manager.createdAt)
      );
      const preferNext =
        (!!manager.isActive && !current.isActive) ||
        (!!manager.isActive === !!current.isActive && nextTs > currentTs);

      if (preferNext) {
        byName.set(key, { ...manager, name });
      }
    }

    return Array.from(byName.values()).sort((a, b) =>
      normalizeManagerName(a.name).localeCompare(
        normalizeManagerName(b.name),
        undefined,
        { sensitivity: 'base' }
      )
    );
  };

  // Create new manager
  ipcMain.handle('firebase:create-manager', async (event, managerData) => {
    try {
      const { name, pin, role } = managerData;
      const normalizedName = normalizeManagerName(name);

      // Validate input
      if (!normalizedName || !pin || !role) {
        return { success: false, error: 'All fields are required' };
      }

      // Validate PIN format (4-6 digits)
      if (!/^\d{4,6}$/.test(pin)) {
        return { success: false, error: 'PIN must be 4-6 digits' };
      }

      // Validate role
      const validRoles = ['owner', 'manager', 'supervisor'];
      if (!validRoles.includes(role)) {
        return { success: false, error: 'Invalid role' };
      }

      // Enforce unique manager names (case-insensitive, trimmed)
      const existingManagers = await queryCollection('managers', []);
      const nameInUse = (existingManagers || []).some(
        (m) => managerNameKey(m.name) === managerNameKey(normalizedName)
      );
      if (nameInUse) {
        return { success: false, error: 'Manager name already exists' };
      }

      // Hash PIN with bcrypt
      const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);

      // Create manager document
      const managerId = `manager_${Date.now()}`;
      await setDocument('managers', managerId, {
        name: normalizedName,
        pinHash,
        role,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        success: true,
        manager: { id: managerId, name: normalizedName, role },
      };
    } catch (error) {
      console.error('Error creating manager:', error);
      return { success: false, error: 'Failed to create manager' };
    }
  });

  // Update manager details
  ipcMain.handle(
    'firebase:update-manager',
    async (event, managerId, updates) => {
      try {
        const { name, role } = updates;
        const normalizedName =
          name !== undefined ? normalizeManagerName(name) : undefined;

        // Validate role if provided
        if (role) {
          const validRoles = ['owner', 'manager', 'supervisor'];
          if (!validRoles.includes(role)) {
            return { success: false, error: 'Invalid role' };
          }
        }

        if (normalizedName !== undefined && !normalizedName) {
          return { success: false, error: 'Manager name is required' };
        }

        if (normalizedName !== undefined) {
          const existingManagers = await queryCollection('managers', []);
          const duplicate = (existingManagers || []).some(
            (m) =>
              m.id !== managerId &&
              managerNameKey(m.name) === managerNameKey(normalizedName)
          );
          if (duplicate) {
            return { success: false, error: 'Manager name already exists' };
          }
        }

        // Update manager document
        const updateData = {
          updatedAt: new Date(),
        };

        if (normalizedName !== undefined) updateData.name = normalizedName;
        if (role) updateData.role = role;

        await updateDocument('managers', managerId, updateData);

        return { success: true };
      } catch (error) {
        console.error('Error updating manager:', error);
        return { success: false, error: 'Failed to update manager' };
      }
    }
  );

  // Change manager's own PIN
  ipcMain.handle(
    'firebase:change-manager-pin',
    async (event, managerId, oldPin, newPin) => {
      try {
        // Validate new PIN format
        if (!newPin || !/^\d{4,6}$/.test(newPin)) {
          return { success: false, error: 'New PIN must be 4-6 digits' };
        }

        // Get manager document
        const manager = await getDocument('managers', managerId);

        if (!manager) {
          return { success: false, error: 'Manager not found' };
        }

        // Verify old PIN
        const isOldPinValid = await bcrypt.compare(oldPin, manager.pinHash);

        if (!isOldPinValid) {
          return { success: false, error: 'Current PIN is incorrect' };
        }

        // Hash and update new PIN
        const newPinHash = await bcrypt.hash(newPin, SALT_ROUNDS);
        await updateDocument('managers', managerId, {
          pinHash: newPinHash,
          updatedAt: new Date(),
        });

        return { success: true, message: 'PIN updated successfully' };
      } catch (error) {
        console.error('Error changing manager PIN:', error);
        return { success: false, error: 'Failed to change PIN' };
      }
    }
  );

  // Get all managers
  ipcMain.handle('firebase:get-managers', async () => {
    try {
      const managers = await queryCollection('managers', [], {
        orderBy: { field: 'name', direction: 'asc' },
      });

      const dedupedManagers = dedupeManagers(managers);

      // Remove pinHash from response for security
      const sanitizedManagers = dedupedManagers.map(
        ({ pinHash, ...manager }) => manager
      );

      return { success: true, managers: sanitizedManagers };
    } catch (error) {
      console.error('Error getting managers:', error);
      return { success: false, error: 'Failed to get managers' };
    }
  });

  // Deactivate/reactivate manager
  ipcMain.handle(
    'firebase:deactivate-manager',
    async (event, managerId, isActive = false) => {
      try {
        await updateDocument('managers', managerId, {
          isActive,
          updatedAt: new Date(),
        });
        return { success: true };
      } catch (error) {
        console.error('Error updating manager status:', error);
        return { success: false, error: 'Failed to update manager status' };
      }
    }
  );

  // Delete manager
  ipcMain.handle('firebase:delete-manager', async (event, managerId) => {
    try {
      if (!managerId) {
        return { success: false, error: 'Manager ID is required' };
      }

      await deleteDocument('managers', managerId);
      return { success: true };
    } catch (error) {
      console.error('Error deleting manager:', error);
      return { success: false, error: 'Failed to delete manager' };
    }
  });

  // Authenticate manager with PIN (for protected operations)
  ipcMain.handle('firebase:authenticate-manager', async (event, pin) => {
    try {
      // Validate PIN format
      if (!pin || !/^\d{4,6}$/.test(pin)) {
        return { success: false, error: 'Invalid PIN format' };
      }

      // Get all active managers
      const managers = await queryCollection('managers', [
        { field: 'isActive', operator: '==', value: true },
      ]);

      // Check PIN against all managers
      for (const manager of managers) {
        const isMatch = await bcrypt.compare(pin, manager.pinHash);
        if (isMatch) {
          return {
            success: true,
            manager: {
              id: manager.id,
              name: manager.name,
              role: manager.role,
            },
          };
        }
      }

      return { success: false, error: 'Invalid PIN' };
    } catch (error) {
      console.error('Error authenticating manager:', error);
      return { success: false, error: 'Authentication failed' };
    }
  });
}

/**
 * MENU MANAGEMENT HANDLERS
 *
 * These handlers manage menu items, categories, and modifiers.
 */
function registerMenuHandlers() {
  // Create menu item
  ipcMain.handle('firebase:create-menu-item', async (event, itemData) => {
    try {
      // Validate required fields
      const {
        name,
        category,
        price,
        shortCode,
        subCategory,
        isBarItem,
        itemCategory,
        foodType,
      } = itemData;

      if (!name || !name.trim()) {
        return { success: false, error: 'Menu item name is required' };
      }

      if (!shortCode || !shortCode.trim()) {
        return { success: false, error: 'Short code is required' };
      }

      if (!category || !category.trim()) {
        return { success: false, error: 'Category is required' };
      }

      if (!subCategory || !subCategory.trim()) {
        return { success: false, error: 'Sub-category is required' };
      }

      if (price === undefined || price === null || price <= 0) {
        return { success: false, error: 'Price must be a positive number' };
      }

      // Create menu item with all fields
      const itemId = `item_${Date.now()}`;
      await setDocument('menuItems', itemId, {
        name: name.trim(),
        shortCode: shortCode.trim().toUpperCase(),
        category: category.trim(),
        categoryId: itemData.categoryId || null,
        subCategory: subCategory.trim(),
        price: parseFloat(price),
        foodType: foodType || 'none',
        isBarItem: isBarItem || false,
        itemCategory: itemCategory || (isBarItem ? 'drink' : 'food'),
        description: itemData.description?.trim() || '',
        isOutOfStock: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return { success: true, itemId };
    } catch (error) {
      console.error('Error creating menu item:', error);
      return { success: false, error: 'Failed to create menu item' };
    }
  });

  // Update menu item
  ipcMain.handle(
    'firebase:update-menu-item',
    async (event, itemId, updates) => {
      try {
        // Validate item exists
        const existingItem = await getDocument('menuItems', itemId);

        if (!existingItem) {
          return { success: false, error: 'Menu item not found' };
        }

        // Validate updates
        const updateData = { updatedAt: new Date() };

        if (updates.name !== undefined) {
          if (!updates.name.trim()) {
            return { success: false, error: 'Menu item name cannot be empty' };
          }
          updateData.name = updates.name.trim();
        }

        if (updates.shortCode !== undefined) {
          if (!updates.shortCode.trim()) {
            return { success: false, error: 'Short code cannot be empty' };
          }
          updateData.shortCode = updates.shortCode.trim().toUpperCase();
        }

        if (updates.category !== undefined) {
          if (!updates.category.trim()) {
            return { success: false, error: 'Category cannot be empty' };
          }
          updateData.category = updates.category.trim();
        }

        if (updates.subCategory !== undefined) {
          if (!updates.subCategory.trim()) {
            return { success: false, error: 'Sub-category cannot be empty' };
          }
          updateData.subCategory = updates.subCategory.trim();
        }

        if (updates.price !== undefined) {
          if (updates.price <= 0) {
            return { success: false, error: 'Price must be a positive number' };
          }
          updateData.price = parseFloat(updates.price);
        }

        if (updates.foodType !== undefined) {
          updateData.foodType = updates.foodType;
        }

        if (updates.isBarItem !== undefined) {
          updateData.isBarItem = updates.isBarItem;
        }

        if (updates.itemCategory !== undefined) {
          updateData.itemCategory = updates.itemCategory;
        }

        if (updates.categoryId !== undefined) {
          updateData.categoryId = updates.categoryId;
        }

        if (updates.description !== undefined) {
          updateData.description = updates.description.trim();
        }

        if (updates.isOutOfStock !== undefined) {
          updateData.isOutOfStock = updates.isOutOfStock;
        }

        if (updates.isActive !== undefined) {
          updateData.isActive = updates.isActive;
        }

        // Update only provided fields
        await updateDocument('menuItems', itemId, updateData);

        return { success: true };
      } catch (error) {
        console.error('Error updating menu item:', error);
        return { success: false, error: 'Failed to update menu item' };
      }
    }
  );

  // Delete menu item
  ipcMain.handle('firebase:delete-menu-item', async (event, itemId) => {
    try {
      // Check for active orders with this menu item
      const activeOrders = await queryCollection('orders', [
        {
          field: 'status',
          operator: 'in',
          value: ['draft', 'submitted', 'preparing'],
        },
      ]);

      // Check if any active order contains this menu item
      const hasActiveOrders = activeOrders.some((order) => {
        if (!order.items || !Array.isArray(order.items)) return false;
        return order.items.some((item) => item.menuItemId === itemId);
      });

      if (hasActiveOrders) {
        return {
          success: false,
          error:
            'Cannot delete menu item with active orders. Please wait until all orders are completed.',
        };
      }

      // Mark item as inactive instead of deleting (soft delete)
      await updateDocument('menuItems', itemId, {
        isActive: false,
        updatedAt: new Date(),
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting menu item:', error);
      return { success: false, error: 'Failed to delete menu item' };
    }
  });

  // Mark item out of stock
  ipcMain.handle(
    'firebase:mark-out-of-stock',
    async (event, itemId, isOutOfStock) => {
      try {
        await updateDocument('menuItems', itemId, {
          isOutOfStock,
          updatedAt: new Date(),
        });
        return { success: true };
      } catch (error) {
        console.error('Error marking item out of stock:', error);
        return { success: false, error: 'Failed to update stock status' };
      }
    }
  );

  // Get all menu items (with optional filters)
  ipcMain.handle('firebase:get-menu-items', async (event, filters = {}) => {
    try {
      const queryFilters = [];

      // Filter by category if provided
      if (filters.category) {
        queryFilters.push({
          field: 'category',
          operator: '==',
          value: filters.category,
        });
      }

      // Filter by active status (default to active only)
      if (filters.includeInactive !== true) {
        queryFilters.push({
          field: 'isActive',
          operator: '==',
          value: true,
        });
      }

      // Always exclude out-of-stock items unless explicitly requested
      if (filters.includeOutOfStock !== true) {
        queryFilters.push({
          field: 'isOutOfStock',
          operator: '==',
          value: false,
        });
      }

      let items = await queryCollection('menuItems', queryFilters, {
        orderBy: { field: 'name', direction: 'asc' },
      });

      // For bar items: only include those with counter stock > 0
      if (filters.includeOutOfStock !== true) {
        const firestore = getAdminFirestore();

        // Read counterStock from inventory docs
        const invSnap = await firestore.collection('inventory').get();
        const counterMap = {};
        for (const doc of invSnap.docs) {
          const d = doc.data();
          const id = d.menuItemId || doc.id;
          if (id && d.counterStock != null) counterMap[id] = d.counterStock;
        }

        // Fall back to movements sum for items missing counterStock field
        const barItemIds = items
          .filter((i) => i.isBarItem && counterMap[i.id] == null)
          .map((i) => i.id);
        if (barItemIds.length > 0) {
          const movSnap = await firestore
            .collection('inventoryMovements')
            .where('movementType', '==', 'godown_to_counter')
            .get();
          for (const doc of movSnap.docs) {
            const d = doc.data();
            const id = d.menuItemId;
            if (id && counterMap[id] == null) {
              counterMap[id] = (counterMap[id] || 0) + (d.quantity || 0);
            }
          }
        }

        items = items.filter((item) => {
          if (item.isBarItem) return (counterMap[item.id] || 0) > 0;
          return true;
        });
      }

      return { success: true, items };
    } catch (error) {
      console.error('Error getting menu items:', error);
      return { success: false, error: 'Failed to get menu items' };
    }
  });

  // Get menu items by category (dedicated handler)
  ipcMain.handle(
    'firebase:get-menu-items-by-category',
    async (event, category) => {
      try {
        if (!category) {
          return { success: false, error: 'Category is required' };
        }

        const items = await queryCollection(
          'menuItems',
          [
            { field: 'category', operator: '==', value: category },
            { field: 'isActive', operator: '==', value: true },
          ],
          {
            orderBy: { field: 'name', direction: 'asc' },
          }
        );

        return { success: true, items };
      } catch (error) {
        console.error('Error getting menu items by category:', error);
        return {
          success: false,
          error: 'Failed to get menu items by category',
        };
      }
    }
  );

  // Get menu categories
  ipcMain.handle('firebase:get-menu-categories', async () => {
    try {
      const items = await queryCollection('menuItems', [
        { field: 'isActive', operator: '==', value: true },
      ]);

      // Extract unique categories
      const categories = [
        ...new Set(items.map((item) => item.category)),
      ].sort();

      return { success: true, categories };
    } catch (error) {
      console.error('Error getting menu categories:', error);
      return { success: false, error: 'Failed to get categories' };
    }
  });

  // Get menu categories with IDs (from menuCategories collection)
  ipcMain.handle('firebase:get-menu-categories-with-ids', async () => {
    try {
      const categories = await queryCollection('menuCategories', [], {
        orderBy: { field: 'displayOrder', direction: 'asc' },
      });
      return { success: true, categories };
    } catch (error) {
      console.error('Error getting menu categories with IDs:', error);
      return { success: false, error: 'Failed to get categories' };
    }
  });
}

/**
 * MODIFIER MANAGEMENT HANDLERS
 *
 * These handlers manage modifiers (spice levels and paid add-ons).
 */
function registerModifierHandlers() {
  // Create modifier
  ipcMain.handle('firebase:create-modifier', async (event, modifierData) => {
    try {
      // Validate required fields
      const { name, type, price } = modifierData;

      if (!name || !name.trim()) {
        return { success: false, error: 'Modifier name is required' };
      }

      // Validate type
      const validTypes = ['spice_level', 'paid_addon'];
      if (!type || !validTypes.includes(type)) {
        return {
          success: false,
          error: 'Type must be either spice_level or paid_addon',
        };
      }

      // Validate price
      if (price === undefined || price === null) {
        return { success: false, error: 'Price is required' };
      }

      // For spice_level, price must be 0
      if (type === 'spice_level' && price !== 0) {
        return {
          success: false,
          error: 'Spice level modifiers must have price 0',
        };
      }

      // For paid_addon, price must be positive
      if (type === 'paid_addon' && price <= 0) {
        return { success: false, error: 'Paid add-on price must be positive' };
      }

      // Create modifier
      const modifierId = `modifier_${Date.now()}`;
      await setDocument('modifiers', modifierId, {
        name: name.trim(),
        type,
        price: parseFloat(price),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return { success: true, modifierId };
    } catch (error) {
      console.error('Error creating modifier:', error);
      return { success: false, error: 'Failed to create modifier' };
    }
  });

  // Update modifier
  ipcMain.handle(
    'firebase:update-modifier',
    async (event, modifierId, updates) => {
      try {
        // Validate modifier exists
        const existingModifier = await getDocument('modifiers', modifierId);

        if (!existingModifier) {
          return { success: false, error: 'Modifier not found' };
        }

        // Validate updates
        const updateData = { updatedAt: new Date() };

        if (updates.name !== undefined) {
          if (!updates.name.trim()) {
            return { success: false, error: 'Modifier name cannot be empty' };
          }
          updateData.name = updates.name.trim();
        }

        if (updates.type !== undefined) {
          const validTypes = ['spice_level', 'paid_addon'];
          if (!validTypes.includes(updates.type)) {
            return {
              success: false,
              error: 'Type must be either spice_level or paid_addon',
            };
          }
          updateData.type = updates.type;
        }

        if (updates.price !== undefined) {
          const finalType = updates.type || existingModifier.type;

          // For spice_level, price must be 0
          if (finalType === 'spice_level' && updates.price !== 0) {
            return {
              success: false,
              error: 'Spice level modifiers must have price 0',
            };
          }

          // For paid_addon, price must be positive
          if (finalType === 'paid_addon' && updates.price <= 0) {
            return {
              success: false,
              error: 'Paid add-on price must be positive',
            };
          }

          updateData.price = parseFloat(updates.price);
        }

        // Update only provided fields
        await updateDocument('modifiers', modifierId, updateData);

        return { success: true };
      } catch (error) {
        console.error('Error updating modifier:', error);
        return { success: false, error: 'Failed to update modifier' };
      }
    }
  );

  // Delete modifier
  ipcMain.handle('firebase:delete-modifier', async (event, modifierId) => {
    try {
      // Check if modifier is associated with any menu items
      const menuItems = await queryCollection('menuItems', [
        { field: 'isActive', operator: '==', value: true },
      ]);

      // Check if any menu item has this modifier
      const hasAssociations = menuItems.some((item) => {
        if (!item.availableModifiers || !Array.isArray(item.availableModifiers))
          return false;
        return item.availableModifiers.includes(modifierId);
      });

      if (hasAssociations) {
        return {
          success: false,
          error:
            'Cannot delete modifier that is associated with menu items. Please remove associations first.',
        };
      }

      // Delete modifier
      await deleteDocument('modifiers', modifierId);

      return { success: true };
    } catch (error) {
      console.error('Error deleting modifier:', error);
      return { success: false, error: 'Failed to delete modifier' };
    }
  });

  // Get all modifiers (with optional type filter)
  ipcMain.handle('firebase:get-modifiers', async (event, filters = {}) => {
    try {
      const queryFilters = [];

      // Filter by type if provided
      if (filters.type) {
        queryFilters.push({
          field: 'type',
          operator: '==',
          value: filters.type,
        });
      }

      const modifiers = await queryCollection('modifiers', queryFilters, {
        orderBy: [
          { field: 'type', direction: 'asc' },
          { field: 'name', direction: 'asc' },
        ],
      });

      return { success: true, modifiers };
    } catch (error) {
      console.error('Error getting modifiers:', error);
      return { success: false, error: 'Failed to get modifiers' };
    }
  });

  // Get modifiers by type
  ipcMain.handle('firebase:get-modifiers-by-type', async (event, type) => {
    try {
      const validTypes = ['spice_level', 'paid_addon'];
      if (!type || !validTypes.includes(type)) {
        return { success: false, error: 'Invalid modifier type' };
      }

      const modifiers = await queryCollection(
        'modifiers',
        [{ field: 'type', operator: '==', value: type }],
        {
          orderBy: { field: 'name', direction: 'asc' },
        }
      );

      return { success: true, modifiers };
    } catch (error) {
      console.error('Error getting modifiers by type:', error);
      return { success: false, error: 'Failed to get modifiers by type' };
    }
  });

  // Associate modifiers with menu item
  ipcMain.handle(
    'firebase:set-menu-item-modifiers',
    async (event, menuItemId, modifierIds) => {
      try {
        // Validate menu item exists
        const menuItem = await getDocument('menuItems', menuItemId);

        if (!menuItem) {
          return { success: false, error: 'Menu item not found' };
        }

        // Validate all modifier IDs exist
        if (!Array.isArray(modifierIds)) {
          return { success: false, error: 'Modifier IDs must be an array' };
        }

        for (const modifierId of modifierIds) {
          const modifier = await getDocument('modifiers', modifierId);
          if (!modifier) {
            return {
              success: false,
              error: `Modifier ${modifierId} not found`,
            };
          }
        }

        // Update menu item with modifier associations
        await updateDocument('menuItems', menuItemId, {
          availableModifiers: modifierIds,
          updatedAt: new Date(),
        });

        return { success: true };
      } catch (error) {
        console.error('Error setting menu item modifiers:', error);
        return { success: false, error: 'Failed to set menu item modifiers' };
      }
    }
  );

  // Get modifiers for a menu item
  ipcMain.handle(
    'firebase:get-menu-item-modifiers',
    async (event, menuItemId) => {
      try {
        const menuItem = await getDocument('menuItems', menuItemId);

        if (!menuItem) {
          return { success: false, error: 'Menu item not found' };
        }

        if (
          !menuItem.availableModifiers ||
          menuItem.availableModifiers.length === 0
        ) {
          return { success: true, modifiers: [] };
        }

        // Fetch all modifiers for this menu item
        const modifiers = [];
        for (const modifierId of menuItem.availableModifiers) {
          const modifier = await getDocument('modifiers', modifierId);
          if (modifier) {
            modifiers.push({ id: modifierId, ...modifier });
          }
        }

        return { success: true, modifiers };
      } catch (error) {
        console.error('Error getting menu item modifiers:', error);
        return { success: false, error: 'Failed to get menu item modifiers' };
      }
    }
  );
}

/**
 * ORDER MANAGEMENT HANDLERS
 *
 * These handlers manage orders from the desktop app.
 */
function registerOrderHandlers() {
  // Create order from desktop
  ipcMain.handle('firebase:create-order', async (event, orderData) => {
    try {
      const orderId = `order_${Date.now()}`;
      await setDocument('orders', orderId, {
        ...orderData,
        createdBy: 'desktop',
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Keep table linked to the active order immediately so reopening the table restores cart items.
      if (orderData?.tableId) {
        await updateDocument('tables', orderData.tableId, {
          status: 'occupied',
          currentOrderId: orderId,
          current_order_id: orderId,
          updatedAt: new Date(),
        });
      }

      return { success: true, orderId };
    } catch (error) {
      console.error('Error creating order:', error);
      return { success: false, error: 'Failed to create order' };
    }
  });

  // Submit order (send to kitchen)
  ipcMain.handle('firebase:submit-order', async (event, orderId) => {
    try {
      await updateDocument('orders', orderId, {
        status: 'submitted',
        submittedAt: new Date(),
        updatedAt: new Date(),
      });
      return { success: true };
    } catch (error) {
      console.error('Error submitting order:', error);
      return { success: false, error: 'Failed to submit order' };
    }
  });

  // Get orders for a table
  ipcMain.handle('firebase:get-table-orders', async (event, tableId) => {
    try {
      const orders = await queryCollection('orders', [
        { field: 'tableId', operator: '==', value: tableId },
        { field: 'status', operator: 'in', value: ['draft', 'submitted'] },
      ]);
      return { success: true, orders };
    } catch (error) {
      console.error('Error getting table orders:', error);
      return { success: false, error: 'Failed to get orders' };
    }
  });
}

/**
 * INVENTORY MANAGEMENT HANDLERS
 *
 * These handlers manage inventory with atomic transactions.
 * Requirements: 10.1-10.5, 11.1-11.4, 26.1, 26.4, 26.9
 */
function registerInventoryHandlers() {
  // Create inventory record for bar item
  ipcMain.handle('firebase:create-inventory', async (event, inventoryData) => {
    try {
      const { menuItemId, quantity } = inventoryData;

      // Validate input
      if (!menuItemId) {
        return { success: false, error: 'Menu item ID is required' };
      }

      if (quantity === undefined || quantity === null || quantity < 0) {
        return {
          success: false,
          error: 'Quantity must be a non-negative number',
        };
      }

      // Verify menu item exists and is a bar item
      const menuItem = await getDocument('menuItems', menuItemId);
      if (!menuItem) {
        return { success: false, error: 'Menu item not found' };
      }

      // Create inventory record (use menuItemId as document ID)
      await setDocument('inventory', menuItemId, {
        menuItemId,
        quantity: parseFloat(quantity),
        autoOutOfStock: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Update menu item out of stock status
      await updateDocument('menuItems', menuItemId, {
        isOutOfStock: quantity === 0,
        updatedAt: new Date(),
      });

      return { success: true };
    } catch (error) {
      console.error('Error creating inventory:', error);
      return { success: false, error: 'Failed to create inventory record' };
    }
  });

  // Get inventory record
  ipcMain.handle('firebase:get-inventory', async (event, menuItemId) => {
    try {
      const inventory = await getDocument('inventory', menuItemId);

      if (!inventory) {
        return { success: false, error: 'Inventory record not found' };
      }

      return { success: true, inventory: { id: menuItemId, ...inventory } };
    } catch (error) {
      console.error('Error getting inventory:', error);
      return { success: false, error: 'Failed to get inventory' };
    }
  });

  // Get all inventory records
  ipcMain.handle('firebase:get-all-inventory', async () => {
    try {
      const inventoryRecords = await queryCollection('inventory', [], {
        orderBy: { field: 'updatedAt', direction: 'desc' },
      });

      return { success: true, inventory: inventoryRecords };
    } catch (error) {
      console.error('Error getting all inventory:', error);
      return { success: false, error: 'Failed to get inventory' };
    }
  });

  // Update inventory quantity
  ipcMain.handle(
    'firebase:update-inventory',
    async (event, menuItemId, quantity) => {
      try {
        // Validate input
        if (quantity === undefined || quantity === null || quantity < 0) {
          return {
            success: false,
            error: 'Quantity must be a non-negative number',
          };
        }

        const firestore = getAdminFirestore();

        await runTransaction(async (transaction) => {
          const inventoryRef = firestore
            .collection('inventory')
            .doc(menuItemId);
          const menuItemRef = firestore.collection('menuItems').doc(menuItemId);

          // Update inventory
          transaction.set(
            inventoryRef,
            {
              menuItemId,
              quantity: parseFloat(quantity),
              autoOutOfStock: true,
              updatedAt: new Date(),
            },
            { merge: true }
          );

          // Update out of stock status
          transaction.update(menuItemRef, {
            isOutOfStock: quantity === 0,
            updatedAt: new Date(),
          });
        });

        return { success: true };
      } catch (error) {
        console.error('Error updating inventory:', error);
        return { success: false, error: 'Failed to update inventory' };
      }
    }
  );

  // Deduct inventory (atomic transaction) - for order finalization
  ipcMain.handle(
    'firebase:deduct-inventory',
    async (event, menuItemId, quantity) => {
      try {
        const firestore = getAdminFirestore();

        const result = await runTransaction(async (transaction) => {
          const inventoryRef = firestore
            .collection('inventory')
            .doc(menuItemId);
          const inventoryDoc = await transaction.get(inventoryRef);

          if (!inventoryDoc.exists) {
            throw new Error('Inventory record not found');
          }

          const currentQuantity = inventoryDoc.data().quantity || 0;

          if (currentQuantity < quantity) {
            throw new Error('Insufficient inventory');
          }

          const newQuantity = currentQuantity - quantity;

          transaction.update(inventoryRef, {
            quantity: newQuantity,
            updatedAt: new Date(),
          });

          // Auto mark out of stock if quantity reaches zero
          if (newQuantity === 0) {
            const menuItemRef = firestore
              .collection('menuItems')
              .doc(menuItemId);
            transaction.update(menuItemRef, {
              isOutOfStock: true,
              updatedAt: new Date(),
            });
          }

          return { newQuantity };
        });

        return { success: true, ...result };
      } catch (error) {
        console.error('Error deducting inventory:', error);
        return { success: false, error: error.message };
      }
    }
  );

  // Finalize order and deduct inventory for bar items (Requirements 11.1, 11.2)
  ipcMain.handle('firebase:finalize-order', async (event, orderId) => {
    try {
      // Get order details
      const order = await getDocument('orders', orderId);
      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      // Get order items
      const orderItems = order.items || [];

      // Deduct inventory for bar items only
      const deductionResults = [];
      const errors = [];

      for (const item of orderItems) {
        // Get menu item to check if it's a bar item
        const menuItem = await getDocument('menuItems', item.menuItemId);

        if (!menuItem) {
          errors.push(`Menu item ${item.menuItemId} not found`);
          continue;
        }

        // Skip kitchen items - only deduct bar items
        if (menuItem.itemCategory !== 'drink' && !menuItem.isBarItem) {
          continue;
        }

        // Deduct inventory
        try {
          const deductResult = await ipcMain.emit(
            'firebase:deduct-inventory',
            event,
            item.menuItemId,
            item.quantity
          );
          deductionResults.push({
            menuItemId: item.menuItemId,
            menuItemName: menuItem.name,
            quantity: item.quantity,
            success: true,
          });
        } catch (deductError) {
          errors.push(
            `Failed to deduct ${menuItem.name}: ${deductError.message}`
          );
          deductionResults.push({
            menuItemId: item.menuItemId,
            menuItemName: menuItem.name,
            quantity: item.quantity,
            success: false,
            error: deductError.message,
          });
        }
      }

      // Update order status to completed
      await updateDocument('orders', orderId, {
        status: 'completed',
        finalizedAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        success: errors.length === 0,
        deductions: deductionResults,
        errors: errors.length > 0 ? errors : undefined,
        message:
          errors.length === 0
            ? 'Order finalized and inventory deducted successfully'
            : 'Order finalized with some inventory deduction errors',
      };
    } catch (error) {
      console.error('Error finalizing order:', error);
      return { success: false, error: 'Failed to finalize order' };
    }
  });

  // Manual out-of-stock marking (Requirements 10.1, 10.2, 10.5)
  ipcMain.handle(
    'firebase:mark-manual-out-of-stock',
    async (event, menuItemId, isOutOfStock, reason) => {
      try {
        // Update menu item out of stock status
        await updateDocument('menuItems', menuItemId, {
          isOutOfStock,
          manualOutOfStock: isOutOfStock,
          outOfStockReason: reason || '',
          updatedAt: new Date(),
        });

        return { success: true };
      } catch (error) {
        console.error('Error marking manual out of stock:', error);
        return {
          success: false,
          error: 'Failed to update out of stock status',
        };
      }
    }
  );

  // Get out-of-stock items dashboard (Requirements 10.5)
  ipcMain.handle('firebase:get-out-of-stock-items', async () => {
    try {
      const outOfStockItems = await queryCollection(
        'menuItems',
        [
          { field: 'isOutOfStock', operator: '==', value: true },
          { field: 'isActive', operator: '==', value: true },
        ],
        {
          orderBy: { field: 'name', direction: 'asc' },
        }
      );

      return { success: true, items: outOfStockItems };
    } catch (error) {
      console.error('Error getting out of stock items:', error);
      return { success: false, error: 'Failed to get out of stock items' };
    }
  });

  // Manager-authenticated inventory movement (Requirements 26.1, 26.4, 26.9)
  ipcMain.handle(
    'firebase:move-stock-to-counter',
    async (event, movementData) => {
      try {
        const { menuItemId, quantity, managerPin, reason } = movementData;

        // Validate input
        if (!menuItemId || !quantity || !managerPin) {
          return {
            success: false,
            error: 'Menu item ID, quantity, and manager PIN are required',
          };
        }

        if (quantity <= 0) {
          return { success: false, error: 'Quantity must be positive' };
        }

        // Authenticate manager
        const authResult = await authenticateManagerForInventory(managerPin);
        if (!authResult.success) {
          return authResult;
        }

        const manager = authResult.manager;

        // Get menu item details
        const menuItem = await getDocument('menuItems', menuItemId);
        if (!menuItem) {
          return { success: false, error: 'Menu item not found' };
        }

        const firestore = getAdminFirestore();

        // Use transaction to update inventory and log movement
        await runTransaction(async (transaction) => {
          const inventoryRef = firestore
            .collection('inventory')
            .doc(menuItemId);
          const menuItemRef = firestore.collection('menuItems').doc(menuItemId);

          // Get current inventory
          const inventoryDoc = await transaction.get(inventoryRef);
          const currentQuantity = inventoryDoc.exists
            ? inventoryDoc.data().quantity || 0
            : 0;
          const newQuantity = currentQuantity + quantity;

          // Update inventory
          transaction.set(
            inventoryRef,
            {
              menuItemId,
              quantity: newQuantity,
              autoOutOfStock: true,
              updatedAt: new Date(),
            },
            { merge: true }
          );

          // Mark as in-stock if quantity > 0
          if (newQuantity > 0) {
            transaction.update(menuItemRef, {
              isOutOfStock: false,
              manualOutOfStock: false,
              updatedAt: new Date(),
            });
          }

          // Log inventory movement
          const movementId = `movement_${Date.now()}`;
          const movementRef = firestore
            .collection('inventoryMovements')
            .doc(movementId);
          transaction.set(movementRef, {
            menuItemId,
            menuItemName: menuItem.name,
            movementType: 'godown_to_counter',
            quantity,
            fromLocation: 'godown',
            toLocation: 'counter',
            authorizedBy: manager.id,
            managerName: manager.name,
            reason: reason || '',
            timestamp: new Date(),
          });
        });

        return {
          success: true,
          message: `Successfully moved ${quantity} units of ${menuItem.name} to counter`,
        };
      } catch (error) {
        console.error('Error moving stock to counter:', error);
        return { success: false, error: 'Failed to move stock' };
      }
    }
  );

  // Get inventory movement history (Requirements 26.9)
  ipcMain.handle(
    'firebase:get-inventory-movements',
    async (event, filters = {}) => {
      try {
        const queryFilters = [];

        // Filter by menu item
        if (filters.menuItemId) {
          queryFilters.push({
            field: 'menuItemId',
            operator: '==',
            value: filters.menuItemId,
          });
        }

        // Filter by manager
        if (filters.managerId) {
          queryFilters.push({
            field: 'authorizedBy',
            operator: '==',
            value: filters.managerId,
          });
        }

        // Filter by date range (if provided)
        if (filters.startDate) {
          queryFilters.push({
            field: 'timestamp',
            operator: '>=',
            value: new Date(filters.startDate),
          });
        }

        if (filters.endDate) {
          queryFilters.push({
            field: 'timestamp',
            operator: '<=',
            value: new Date(filters.endDate),
          });
        }

        const movements = await queryCollection(
          'inventoryMovements',
          queryFilters,
          {
            orderBy: { field: 'timestamp', direction: 'desc' },
          }
        );

        return { success: true, movements };
      } catch (error) {
        console.error('Error getting inventory movements:', error);
        return { success: false, error: 'Failed to get inventory movements' };
      }
    }
  );

  // Export inventory movements to CSV
  ipcMain.handle(
    'firebase:export-inventory-movements',
    async (event, filters = {}) => {
      try {
        // Get movements with filters
        const result = await ipcMain.handleOnce(
          'firebase:get-inventory-movements',
          filters
        );

        if (!result.success) {
          return result;
        }

        const movements = result.movements;

        // Convert to CSV format
        const headers = [
          'Date/Time',
          'Item',
          'Quantity',
          'From',
          'To',
          'Manager',
          'Reason',
        ];
        const rows = movements.map((m) => [
          new Date(m.timestamp).toLocaleString(),
          m.menuItemName,
          m.quantity,
          m.fromLocation,
          m.toLocation,
          m.managerName,
          m.reason || '',
        ]);

        const csvContent = [
          headers.join(','),
          ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
        ].join('\n');

        return { success: true, csv: csvContent };
      } catch (error) {
        console.error('Error exporting inventory movements:', error);
        return { success: false, error: 'Failed to export movements' };
      }
    }
  );

  // Get all menu items joined with their godown stock
  ipcMain.handle('firebase:get-menu-items-with-stock', async () => {
    try {
      const items = await queryCollection(
        'menuItems',
        [{ field: 'isActive', operator: '==', value: true }],
        { orderBy: { field: 'name', direction: 'asc' } }
      );

      const inventoryRecords = await queryCollection('inventory', []);
      const stockMap = {};
      for (const rec of inventoryRecords) {
        stockMap[rec.menuItemId || rec.id] = rec.quantity || 0;
      }

      const result = items.map((item) => ({
        ...item,
        godownStock: stockMap[item.id] || 0,
      }));

      return { success: true, items: result };
    } catch (error) {
      console.error('Error getting menu items with stock:', error);
      return { success: false, error: 'Failed to get items with stock' };
    }
  });

  // Add godown stock for a menu item and record purchase history
  ipcMain.handle('firebase:add-godown-stock', async (event, data) => {
    try {
      const {
        menuItemId,
        menuItemName,
        quantityAdded,
        supplier,
        notes,
        costPerUnit,
      } = data;

      if (!menuItemId || !quantityAdded || quantityAdded <= 0) {
        return {
          success: false,
          error: 'Valid menuItemId and quantityAdded are required',
        };
      }

      const firestore = getAdminFirestore();

      await runTransaction(async (transaction) => {
        const inventoryRef = firestore.collection('inventory').doc(menuItemId);
        const inventoryDoc = await transaction.get(inventoryRef);
        const currentQty = inventoryDoc.exists
          ? inventoryDoc.data().quantity || 0
          : 0;

        transaction.set(
          inventoryRef,
          {
            menuItemId,
            quantity: currentQty + quantityAdded,
            autoOutOfStock: true,
            updatedAt: new Date(),
          },
          { merge: true }
        );

        // Update menuItem isOutOfStock if it was 0
        if (currentQty === 0) {
          const menuItemRef = firestore.collection('menuItems').doc(menuItemId);
          transaction.update(menuItemRef, {
            isOutOfStock: false,
            updatedAt: new Date(),
          });
        }

        // Record purchase history
        const historyId = `purchase_${Date.now()}`;
        const historyRef = firestore
          .collection('purchaseHistory')
          .doc(historyId);
        transaction.set(historyRef, {
          menuItemId,
          menuItemName: menuItemName || '',
          quantityAdded,
          supplier: supplier || '',
          notes: notes || '',
          costPerUnit: costPerUnit || 0,
          addedAt: new Date(),
        });
      });

      return { success: true };
    } catch (error) {
      console.error('Error adding godown stock:', error);
      return { success: false, error: 'Failed to add stock' };
    }
  });

  // Get purchase history
  ipcMain.handle('firebase:get-purchase-history', async () => {
    try {
      const records = await queryCollection('purchaseHistory', [], {
        orderBy: { field: 'addedAt', direction: 'desc' },
      });
      return { success: true, records };
    } catch (error) {
      console.error('Error getting purchase history:', error);
      // fallback: sort in memory if index missing
      try {
        const firestore = getAdminFirestore();
        const snap = await firestore.collection('purchaseHistory').get();
        const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        records.sort((a, b) => {
          const ta = a.addedAt?.toDate
            ? a.addedAt.toDate()
            : new Date(a.addedAt);
          const tb = b.addedAt?.toDate
            ? b.addedAt.toDate()
            : new Date(b.addedAt);
          return tb - ta;
        });
        return { success: true, records };
      } catch (e2) {
        return { success: false, error: 'Failed to get purchase history' };
      }
    }
  });

  // Transfer items from godown to counter (no manager PIN required for daily transfer)
  ipcMain.handle('firebase:transfer-to-counter', async (event, items) => {
    // items: [{ menuItemId, menuItemName, quantity }]
    try {
      const firestore = getAdminFirestore();
      const results = [];

      for (const item of items) {
        const { menuItemId, menuItemName, quantity } = item;
        if (!menuItemId || !quantity || quantity <= 0) continue;

        await runTransaction(async (transaction) => {
          const inventoryRef = firestore
            .collection('inventory')
            .doc(menuItemId);
          const inventoryDoc = await transaction.get(inventoryRef);
          const data = inventoryDoc.exists ? inventoryDoc.data() : {};
          const currentGodown = data.quantity || 0;
          const currentCounter = data.counterStock || 0;
          const newGodown = Math.max(0, currentGodown - quantity);
          const newCounter = currentCounter + quantity;

          transaction.set(
            inventoryRef,
            {
              menuItemId,
              quantity: newGodown,
              counterStock: newCounter,
              autoOutOfStock: true,
              updatedAt: new Date(),
            },
            { merge: true }
          );

          if (newGodown === 0) {
            const menuItemRef = firestore
              .collection('menuItems')
              .doc(menuItemId);
            transaction.update(menuItemRef, {
              isOutOfStock: true,
              updatedAt: new Date(),
            });
          }

          // Log movement
          const movementId = `movement_${Date.now()}_${menuItemId}`;
          const movementRef = firestore
            .collection('inventoryMovements')
            .doc(movementId);
          transaction.set(movementRef, {
            menuItemId,
            menuItemName: menuItemName || '',
            movementType: 'godown_to_counter',
            quantity,
            fromLocation: 'godown',
            toLocation: 'counter',
            timestamp: new Date(),
          });
        });

        results.push({ menuItemId, success: true });
      }

      return { success: true, results };
    } catch (error) {
      console.error('Error transferring to counter:', error);
      return { success: false, error: 'Transfer failed' };
    }
  });

  // Get godown-to-counter transfer history
  ipcMain.handle('firebase:get-transfer-history', async () => {
    try {
      const firestore = getAdminFirestore();
      const snap = await firestore
        .collection('inventoryMovements')
        .where('movementType', '==', 'godown_to_counter')
        .get();
      const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      records.sort((a, b) => {
        const ta =
          a.timestamp?._seconds ||
          (a.timestamp?.toDate ? a.timestamp.toDate().getTime() / 1000 : 0);
        const tb =
          b.timestamp?._seconds ||
          (b.timestamp?.toDate ? b.timestamp.toDate().getTime() / 1000 : 0);
        return tb - ta;
      });
      return { success: true, records };
    } catch (error) {
      console.error('Error getting transfer history:', error);
      return { success: false, error: 'Failed to get transfer history' };
    }
  });

  // Get counter stock — sums inventoryMovements godown_to_counter per item
  ipcMain.handle('firebase:get-counter-stock', async () => {
    try {
      const items = await queryCollection(
        'menuItems',
        [{ field: 'isActive', operator: '==', value: true }],
        { orderBy: { field: 'name', direction: 'asc' } }
      );

      const firestore = getAdminFirestore();

      // Read counterStock from inventory collection
      const invSnap = await firestore.collection('inventory').get();
      const counterMap = {};
      for (const doc of invSnap.docs) {
        const d = doc.data();
        const id = d.menuItemId || doc.id;
        if (id && d.counterStock != null) counterMap[id] = d.counterStock;
      }

      // For any item missing counterStock in inventory, fall back to summing movements
      const itemsMissingCounter = items.filter((i) => counterMap[i.id] == null);
      if (itemsMissingCounter.length > 0) {
        const movSnap = await firestore
          .collection('inventoryMovements')
          .where('movementType', '==', 'godown_to_counter')
          .get();
        for (const doc of movSnap.docs) {
          const d = doc.data();
          const id = d.menuItemId;
          if (id && counterMap[id] == null) {
            counterMap[id] = (counterMap[id] || 0) + (d.quantity || 0);
          }
        }
      }

      const result = items.map((item) => ({
        ...item,
        counterStock: counterMap[item.id] || 0,
      }));

      return { success: true, items: result };
    } catch (error) {
      console.error('Error getting counter stock:', error);
      return { success: false, error: 'Failed to get counter stock' };
    }
  });
}

/**
 * Helper function to authenticate manager for inventory operations
 * Includes lockout protection (3 attempts = 5 minute lockout)
 */
async function authenticateManagerForInventory(pin) {
  try {
    // Validate PIN format
    if (!pin || !/^\d{4,6}$/.test(pin)) {
      return { success: false, error: 'Invalid PIN format' };
    }

    // Check failed attempts (stored in memory for simplicity)
    // In production, this should be stored in a database or secure storage
    const lockoutKey = 'manager_lockout';
    const attemptsKey = 'manager_failed_attempts';

    // Get lockout status from global state (simplified)
    if (global.managerLockoutUntil && Date.now() < global.managerLockoutUntil) {
      const remainingMinutes = Math.ceil(
        (global.managerLockoutUntil - Date.now()) / 60000
      );
      return {
        success: false,
        error: `Account locked. Try again in ${remainingMinutes} minutes`,
        attemptsRemaining: 0,
      };
    }

    // Reset lockout if expired
    if (
      global.managerLockoutUntil &&
      Date.now() >= global.managerLockoutUntil
    ) {
      global.managerLockoutUntil = null;
      global.managerFailedAttempts = 0;
    }

    // Get all active managers
    const managers = await queryCollection('managers', [
      { field: 'isActive', operator: '==', value: true },
    ]);

    // Check PIN against all managers
    for (const manager of managers) {
      const isMatch = await bcrypt.compare(pin, manager.pinHash);
      if (isMatch) {
        // Reset failed attempts on success
        global.managerFailedAttempts = 0;
        global.managerLockoutUntil = null;

        return {
          success: true,
          manager: {
            id: manager.id,
            name: manager.name,
            role: manager.role,
          },
        };
      }
    }

    // Invalid PIN - increment failed attempts
    global.managerFailedAttempts = (global.managerFailedAttempts || 0) + 1;
    const remaining = 3 - global.managerFailedAttempts;

    // Lock account after 3 failed attempts
    if (global.managerFailedAttempts >= 3) {
      global.managerLockoutUntil = Date.now() + 5 * 60 * 1000; // 5 minutes
      return {
        success: false,
        error: 'Account locked for 5 minutes due to too many failed attempts',
        attemptsRemaining: 0,
      };
    }

    return {
      success: false,
      error: 'Invalid manager PIN',
      attemptsRemaining: Math.max(0, remaining),
    };
  } catch (error) {
    console.error('Error authenticating manager:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * SECTION MANAGEMENT HANDLERS
 *
 * These handlers manage sections (logical groupings of tables).
 * Requirements: 16.1, 16.4
 */
function registerSectionHandlers() {
  // Create section
  ipcMain.handle('firebase:create-section', async (event, sectionData) => {
    try {
      // Validate input
      if (!sectionData) {
        return { success: false, error: 'Section data is required' };
      }

      const { name } = sectionData;

      // Validate section name
      if (!name || !name.trim()) {
        return { success: false, error: 'Section name is required' };
      }

      // Check for duplicate section name (optional but recommended)
      const existingSections = await queryCollection('sections', [
        { field: 'name', operator: '==', value: name.trim() },
      ]);

      if (existingSections && existingSections.length > 0) {
        return { success: false, error: 'Section name already exists' };
      }

      // Create section document
      const sectionId = `section_${Date.now()}`;
      await setDocument('sections', sectionId, {
        name: name.trim(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        success: true,
        section: { id: sectionId, name: name.trim() },
      };
    } catch (error) {
      console.error('Error creating section:', error);
      return { success: false, error: 'Failed to create section' };
    }
  });

  // Update section
  ipcMain.handle(
    'firebase:update-section',
    async (event, sectionId, updates) => {
      try {
        const { name } = updates;

        // Validate section exists
        const existingSection = await getDocument('sections', sectionId);

        if (!existingSection) {
          return { success: false, error: 'Section not found' };
        }

        // Validate section name
        if (!name || !name.trim()) {
          return { success: false, error: 'Section name cannot be empty' };
        }

        // Check for duplicate section name (optional but recommended)
        const duplicateSections = await queryCollection('sections', [
          { field: 'name', operator: '==', value: name.trim() },
        ]);

        if (
          duplicateSections.length > 0 &&
          duplicateSections[0].id !== sectionId
        ) {
          return { success: false, error: 'Section name already exists' };
        }

        // Update section
        await updateDocument('sections', sectionId, {
          name: name.trim(),
          updatedAt: new Date(),
        });

        return { success: true };
      } catch (error) {
        console.error('Error updating section:', error);
        return { success: false, error: 'Failed to update section' };
      }
    }
  );

  // Delete section
  ipcMain.handle('firebase:delete-section', async (event, sectionId) => {
    try {
      // Check if section has any tables
      const tables = await queryCollection('tables', [
        { field: 'sectionId', operator: '==', value: sectionId },
      ]);

      if (tables && tables.length > 0) {
        return {
          success: false,
          error:
            'Cannot delete section with tables. Please reassign or delete tables first.',
        };
      }

      // Delete section
      await deleteDocument('sections', sectionId);

      return { success: true };
    } catch (error) {
      console.error('Error deleting section:', error);
      return { success: false, error: 'Failed to delete section' };
    }
  });

  // Get all sections
  ipcMain.handle('firebase:get-sections', async () => {
    try {
      const sections = await queryCollection('sections', [], {
        orderBy: { field: 'name', direction: 'asc' },
      });

      return { success: true, sections };
    } catch (error) {
      console.error('Error getting sections:', error);
      return { success: false, error: 'Failed to get sections' };
    }
  });

  // Sync sections and tables from local SQLite to Firestore
  ipcMain.handle(
    'firebase:sync-sections-tables',
    async (event, { sections, tables }) => {
      try {
        const results = { sectionsCreated: 0, tablesCreated: 0, errors: [] };

        // Create a map of local section IDs to Firestore section IDs
        const sectionIdMap = new Map();

        // Sync sections
        if (sections && sections.length > 0) {
          for (const section of sections) {
            try {
              // Check if section with this name exists
              const existingSections = await queryCollection('sections', [
                { field: 'name', operator: '==', value: section.name },
              ]);

              if (existingSections && existingSections.length > 0) {
                // Use existing section
                sectionIdMap.set(section.id, existingSections[0].id);
              } else {
                // Create new section
                const sectionId = `section_${section.id}_${Date.now()}`;
                await setDocument('sections', sectionId, {
                  name: section.name,
                  localId: section.id,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
                sectionIdMap.set(section.id, sectionId);
                results.sectionsCreated++;
              }
            } catch (err) {
              results.errors.push(`Section ${section.name}: ${err.message}`);
            }
          }
        }

        // Sync tables
        if (tables && tables.length > 0) {
          for (const table of tables) {
            try {
              // Get the Firestore section ID for this table's local section ID
              const firestoreSectionId = table.section_id
                ? sectionIdMap.get(table.section_id)
                : null;

              // Check if table with this name exists in the section
              const tableQuery = firestoreSectionId
                ? await queryCollection('tables', [
                    { field: 'name', operator: '==', value: table.name },
                    {
                      field: 'sectionId',
                      operator: '==',
                      value: firestoreSectionId,
                    },
                  ])
                : await queryCollection('tables', [
                    { field: 'name', operator: '==', value: table.name },
                  ]);

              if (tableQuery && tableQuery.length > 0) {
                // Update existing table
                await updateDocument('tables', tableQuery[0].id, {
                  name: table.name,
                  capacity: table.capacity,
                  sectionId: firestoreSectionId || null,
                  status: table.status || 'available',
                  localId: table.id,
                  updatedAt: new Date(),
                });
              } else {
                // Create new table
                const tableId = `table_${table.id}_${Date.now()}`;
                await setDocument('tables', tableId, {
                  name: table.name,
                  capacity: table.capacity,
                  sectionId: firestoreSectionId || null,
                  status: table.status || 'available',
                  localId: table.id,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
                results.tablesCreated++;
              }
            } catch (err) {
              results.errors.push(`Table ${table.name}: ${err.message}`);
            }
          }
        }

        return {
          success: true,
          ...results,
          message: `Synced ${results.sectionsCreated} sections and ${results.tablesCreated} tables`,
        };
      } catch (error) {
        console.error('Error syncing sections and tables:', error);
        return { success: false, error: 'Failed to sync sections and tables' };
      }
    }
  );

  // ============================================================================
  // TABLE CRUD OPERATIONS
  // ============================================================================

  // Create table
  ipcMain.handle('firebase:create-table', async (event, tableData) => {
    try {
      // Validate input
      if (!tableData) {
        return { success: false, error: 'Table data is required' };
      }

      const { name, sectionId } = tableData;

      // Validate table name
      if (!name || !name.trim()) {
        return { success: false, error: 'Table name is required' };
      }

      // Validate section ID
      if (!sectionId || !sectionId.trim()) {
        return { success: false, error: 'Section ID is required' };
      }

      // Verify section exists
      const section = await getDocument('sections', sectionId);
      if (!section) {
        return { success: false, error: 'Section not found' };
      }

      // Check for duplicate table name in the same section
      const existingTables = await queryCollection('tables', [
        { field: 'sectionId', operator: '==', value: sectionId },
        { field: 'name', operator: '==', value: name.trim() },
      ]);

      if (existingTables && existingTables.length > 0) {
        return {
          success: false,
          error: 'Table name already exists in this section',
        };
      }

      // Create table document
      const tableId = `table_${Date.now()}`;
      await setDocument('tables', tableId, {
        name: name.trim(),
        sectionId: sectionId.trim(),
        status: 'available',
        currentOrderId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        success: true,
        table: {
          id: tableId,
          name: name.trim(),
          sectionId: sectionId.trim(),
          status: 'available',
        },
      };
    } catch (error) {
      console.error('Error creating table:', error);
      return { success: false, error: 'Failed to create table' };
    }
  });

  // Update table
  ipcMain.handle('firebase:update-table', async (event, tableId, updates) => {
    try {
      // Validate table exists
      const existingTable = await getDocument('tables', tableId);

      if (!existingTable) {
        return { success: false, error: 'Table not found' };
      }

      const updateData = { updatedAt: new Date() };

      // Validate and update name if provided
      if (updates.name !== undefined) {
        if (!updates.name || !updates.name.trim()) {
          return { success: false, error: 'Table name cannot be empty' };
        }

        // Check for duplicate name in the same section
        const sectionId = updates.sectionId || existingTable.sectionId;
        const duplicateTables = await queryCollection('tables', [
          { field: 'sectionId', operator: '==', value: sectionId },
          { field: 'name', operator: '==', value: updates.name.trim() },
        ]);

        if (duplicateTables.length > 0 && duplicateTables[0].id !== tableId) {
          return {
            success: false,
            error: 'Table name already exists in this section',
          };
        }

        updateData.name = updates.name.trim();
      }

      // Validate and update section if provided
      if (updates.sectionId !== undefined) {
        if (!updates.sectionId || !updates.sectionId.trim()) {
          return { success: false, error: 'Section ID cannot be empty' };
        }

        // Verify new section exists
        const newSection = await getDocument('sections', updates.sectionId);
        if (!newSection) {
          return { success: false, error: 'Section not found' };
        }

        updateData.sectionId = updates.sectionId.trim();
      }

      // Update table
      await updateDocument('tables', tableId, updateData);

      return { success: true };
    } catch (error) {
      console.error('Error updating table:', error);
      return { success: false, error: 'Failed to update table' };
    }
  });

  // Clear table status (available again)
  ipcMain.handle('firebase:clear-table', async (event, tableId) => {
    try {
      if (!tableId) {
        return { success: false, error: 'Table ID is required' };
      }

      await updateDocument('tables', tableId, {
        status: 'available',
        currentOrderId: null,
        current_order_id: null,
        currentBillAmount: 0,
        current_bill_amount: 0,
        occupiedSince: null,
        occupied_since: null,
        updatedAt: new Date(),
      });

      return { success: true };
    } catch (error) {
      console.error('Error clearing table:', error);
      return { success: false, error: 'Failed to clear table' };
    }
  });

  // Delete table
  ipcMain.handle('firebase:delete-table', async (event, tableId) => {
    try {
      const table = await getDocument('tables', tableId);
      if (!table) return { success: true };

      if (table.currentOrderId) {
        return {
          success: false,
          error: 'Cannot delete table with active order.',
        };
      }

      if (table.status === 'occupied' || table.status === 'pending_bill') {
        return {
          success: false,
          error: 'Cannot delete table that is occupied or has pending bill.',
        };
      }

      await deleteDocument('tables', tableId);
      return { success: true };
    } catch (error) {
      console.error('Error deleting table:', error);
      return { success: false, error: 'Failed to delete table' };
    }
  });

  // Get all tables
  ipcMain.handle('firebase:get-tables', async () => {
    try {
      const tables = await queryCollection('tables', [], {
        orderBy: { field: 'name', direction: 'asc' },
      });

      return { success: true, tables };
    } catch (error) {
      console.error('Error getting tables:', error);
      return { success: false, error: 'Failed to get tables' };
    }
  });

  // Get tables by section
  ipcMain.handle('firebase:get-tables-by-section', async (event, sectionId) => {
    try {
      if (!sectionId) {
        return { success: false, error: 'Section ID is required' };
      }

      const tables = await queryCollection(
        'tables',
        [{ field: 'sectionId', operator: '==', value: sectionId }],
        {
          orderBy: { field: 'name', direction: 'asc' },
        }
      );

      return { success: true, tables };
    } catch (error) {
      console.error('Error getting tables by section:', error);
      return { success: false, error: 'Failed to get tables' };
    }
  });

  // ============================================================================
  // TABLE OPERATIONS (Merge, Split, Transfer)
  // ============================================================================

  // Merge tables
  ipcMain.handle('firebase:merge-tables', async (event, tableIds) => {
    try {
      // Validate input
      if (!tableIds || !Array.isArray(tableIds) || tableIds.length < 2) {
        return {
          success: false,
          error: 'At least 2 table IDs are required for merging',
        };
      }

      // Get all tables
      const tables = [];
      for (const tableId of tableIds) {
        const table = await getDocument('tables', tableId);
        if (!table) {
          return { success: false, error: `Table ${tableId} not found` };
        }
        tables.push({ id: tableId, ...table });
      }

      // Get orders for all tables
      const orders = [];
      for (const table of tables) {
        if (table.currentOrderId) {
          const order = await getDocument('orders', table.currentOrderId);
          if (order) {
            orders.push({ id: table.currentOrderId, ...order });
          }
        }
      }

      // Use the first table as the primary table
      const primaryTableId = tableIds[0];
      const primaryTable = tables[0];

      // Create or update merged order
      let mergedOrderId = primaryTable.currentOrderId;

      if (!mergedOrderId) {
        // Create new order for primary table
        mergedOrderId = `order_${Date.now()}`;
        await setDocument('orders', mergedOrderId, {
          tableId: primaryTableId,
          items: [],
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Merge all order items into the primary order
      const allItems = [];
      for (const order of orders) {
        if (order.items && Array.isArray(order.items)) {
          allItems.push(...order.items);
        }
      }

      // Update merged order with all items
      if (allItems.length > 0) {
        await updateDocument('orders', mergedOrderId, {
          items: allItems,
          updatedAt: new Date(),
        });
      }

      // Update all tables to point to merged order
      for (const tableId of tableIds) {
        await updateDocument('tables', tableId, {
          currentOrderId: mergedOrderId,
          status: 'occupied',
          updatedAt: new Date(),
        });
      }

      // Delete old orders (except the merged one)
      for (const order of orders) {
        if (order.id !== mergedOrderId) {
          await deleteDocument('orders', order.id);
        }
      }

      return {
        success: true,
        mergedOrderId,
        message: `Successfully merged ${tableIds.length} tables`,
      };
    } catch (error) {
      console.error('Error merging tables:', error);
      return { success: false, error: 'Failed to merge tables' };
    }
  });

  // Split table
  ipcMain.handle(
    'firebase:split-table',
    async (event, tableId, splitConfig) => {
      try {
        // Validate input
        if (!tableId) {
          return { success: false, error: 'Table ID is required' };
        }

        if (
          !splitConfig ||
          !splitConfig.splits ||
          !Array.isArray(splitConfig.splits)
        ) {
          return { success: false, error: 'Split configuration is required' };
        }

        // Get table
        const table = await getDocument('tables', tableId);
        if (!table) {
          return { success: false, error: 'Table not found' };
        }

        // Get current order
        if (!table.currentOrderId) {
          return {
            success: false,
            error: 'Table has no active order to split',
          };
        }

        const order = await getDocument('orders', table.currentOrderId);
        if (!order) {
          return { success: false, error: 'Order not found' };
        }

        // Create new orders for each split
        const newOrderIds = [];
        for (let i = 0; i < splitConfig.splits.length; i++) {
          const split = splitConfig.splits[i];
          const newOrderId = `order_${Date.now()}_split_${i}`;

          // Get items for this split
          const splitItems = (order.items || []).filter((item) =>
            split.items.includes(item.id)
          );

          await setDocument('orders', newOrderId, {
            tableId: tableId,
            items: splitItems,
            status: 'draft',
            splitFrom: table.currentOrderId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          newOrderIds.push(newOrderId);
        }

        // Update original table to point to first split
        await updateDocument('tables', tableId, {
          currentOrderId: newOrderIds[0] || null,
          updatedAt: new Date(),
        });

        // Delete original order
        await deleteDocument('orders', table.currentOrderId);

        return {
          success: true,
          newOrderIds,
          message: `Successfully split order into ${newOrderIds.length} orders`,
        };
      } catch (error) {
        console.error('Error splitting table:', error);
        return { success: false, error: 'Failed to split table' };
      }
    }
  );

  // Transfer table
  ipcMain.handle(
    'firebase:transfer-table',
    async (event, fromTableId, toTableId) => {
      try {
        // Validate input
        if (!fromTableId || !toTableId) {
          return {
            success: false,
            error: 'Both source and destination table IDs are required',
          };
        }

        if (fromTableId === toTableId) {
          return { success: false, error: 'Cannot transfer table to itself' };
        }

        // Get both tables
        const fromTable = await getDocument('tables', fromTableId);
        if (!fromTable) {
          return { success: false, error: 'Source table not found' };
        }

        const toTable = await getDocument('tables', toTableId);
        if (!toTable) {
          return { success: false, error: 'Destination table not found' };
        }

        // Check if source table has an order
        if (!fromTable.currentOrderId) {
          return {
            success: false,
            error: 'Source table has no order to transfer',
          };
        }

        // Check if destination table is available
        if (toTable.currentOrderId) {
          return {
            success: false,
            error: 'Destination table already has an order',
          };
        }

        // Update order to point to new table
        await updateDocument('orders', fromTable.currentOrderId, {
          tableId: toTableId,
          updatedAt: new Date(),
        });

        // Update destination table
        await updateDocument('tables', toTableId, {
          currentOrderId: fromTable.currentOrderId,
          status: 'occupied',
          updatedAt: new Date(),
        });

        // Clear source table
        await updateDocument('tables', fromTableId, {
          currentOrderId: null,
          status: 'available',
          updatedAt: new Date(),
        });

        return {
          success: true,
          message: `Successfully transferred order from ${fromTableId} to ${toTableId}`,
        };
      } catch (error) {
        console.error('Error transferring table:', error);
        return { success: false, error: 'Failed to transfer table' };
      }
    }
  );
}

/**
 * REAL-TIME SYNC LISTENERS
 *
 * These handlers set up real-time listeners for menu items and modifiers.
 * Changes made on any device will be pushed to all connected clients.
 */
function registerRealtimeListeners() {
  const { getAdminFirestore } = require('./init');

  // Subscribe to menu items changes
  ipcMain.handle('firebase:subscribe-menu-items', async (event) => {
    try {
      const firestore = getAdminFirestore();
      const menuItemsRef = firestore.collection('menuItems');

      // Set up real-time listener
      const unsubscribe = menuItemsRef.where('isActive', '==', true).onSnapshot(
        (snapshot) => {
          const changes = [];

          snapshot.docChanges().forEach((change) => {
            const data = { id: change.doc.id, ...change.doc.data() };
            changes.push({
              type: change.type, // 'added', 'modified', 'removed'
              data: data,
            });
          });

          // Send changes to renderer process
          if (changes.length > 0) {
            event.sender.send('firebase:menu-items-changed', changes);
          }
        },
        (error) => {
          console.error('Error in menu items listener:', error);
          event.sender.send('firebase:menu-items-error', error.message);
        }
      );

      // Store unsubscribe function for cleanup
      event.sender.once('destroyed', () => {
        unsubscribe();
      });

      return { success: true, message: 'Subscribed to menu items changes' };
    } catch (error) {
      console.error('Error subscribing to menu items:', error);
      return { success: false, error: 'Failed to subscribe to menu items' };
    }
  });

  // Subscribe to modifiers changes
  ipcMain.handle('firebase:subscribe-modifiers', async (event) => {
    try {
      const firestore = getAdminFirestore();
      const modifiersRef = firestore.collection('modifiers');

      // Set up real-time listener
      const unsubscribe = modifiersRef.onSnapshot(
        (snapshot) => {
          const changes = [];

          snapshot.docChanges().forEach((change) => {
            const data = { id: change.doc.id, ...change.doc.data() };
            changes.push({
              type: change.type, // 'added', 'modified', 'removed'
              data: data,
            });
          });

          // Send changes to renderer process
          if (changes.length > 0) {
            event.sender.send('firebase:modifiers-changed', changes);
          }
        },
        (error) => {
          console.error('Error in modifiers listener:', error);
          event.sender.send('firebase:modifiers-error', error.message);
        }
      );

      // Store unsubscribe function for cleanup
      event.sender.once('destroyed', () => {
        unsubscribe();
      });

      return { success: true, message: 'Subscribed to modifiers changes' };
    } catch (error) {
      console.error('Error subscribing to modifiers:', error);
      return { success: false, error: 'Failed to subscribe to modifiers' };
    }
  });

  // Subscribe to table status changes
  ipcMain.handle('firebase:subscribe-tables', async (event) => {
    try {
      const firestore = getAdminFirestore();
      const tablesRef = firestore.collection('tables');

      // Set up real-time listener
      const unsubscribe = tablesRef.onSnapshot(
        (snapshot) => {
          const changes = [];

          snapshot.docChanges().forEach((change) => {
            const data = { id: change.doc.id, ...change.doc.data() };
            changes.push({
              type: change.type, // 'added', 'modified', 'removed'
              data: data,
            });
          });

          // Send changes to renderer process
          if (changes.length > 0) {
            event.sender.send('firebase:tables-changed', changes);
          }
        },
        (error) => {
          console.error('Error in tables listener:', error);
          event.sender.send('firebase:tables-error', error.message);
        }
      );

      // Store unsubscribe function for cleanup
      event.sender.once('destroyed', () => {
        unsubscribe();
      });

      return { success: true, message: 'Subscribed to table status changes' };
    } catch (error) {
      console.error('Error subscribing to tables:', error);
      return { success: false, error: 'Failed to subscribe to tables' };
    }
  });

  // Subscribe to section changes
  ipcMain.handle('firebase:subscribe-sections', async (event) => {
    try {
      const firestore = getAdminFirestore();
      const sectionsRef = firestore.collection('sections');

      // Set up real-time listener
      const unsubscribe = sectionsRef.onSnapshot(
        (snapshot) => {
          const changes = [];

          snapshot.docChanges().forEach((change) => {
            const data = { id: change.doc.id, ...change.doc.data() };
            changes.push({
              type: change.type, // 'added', 'modified', 'removed'
              data: data,
            });
          });

          // Send changes to renderer process
          if (changes.length > 0) {
            event.sender.send('firebase:sections-changed', changes);
          }
        },
        (error) => {
          console.error('Error in sections listener:', error);
          event.sender.send('firebase:sections-error', error.message);
        }
      );

      // Store unsubscribe function for cleanup
      event.sender.once('destroyed', () => {
        unsubscribe();
      });

      return { success: true, message: 'Subscribed to section changes' };
    } catch (error) {
      console.error('Error subscribing to sections:', error);
      return { success: false, error: 'Failed to subscribe to sections' };
    }
  });

  // Unsubscribe from all listeners (cleanup)
  ipcMain.handle('firebase:unsubscribe-all', async (event) => {
    try {
      // Cleanup is handled automatically when renderer is destroyed
      return { success: true, message: 'Unsubscribed from all listeners' };
    } catch (error) {
      console.error('Error unsubscribing:', error);
      return { success: false, error: 'Failed to unsubscribe' };
    }
  });
}

/**
 * BILLING SYSTEM HANDLERS
 *
 * These handlers manage bill generation, discounts, split payments, and pending bills.
 * Requirements: 12.1-12.5, 13.1-13.5, 14.1-14.5
 */
function registerBillingHandlers() {
  // Generate bill from completed order (Requirements 12.1, 12.2)
  ipcMain.handle('firebase:generate-bill', async (event, billData) => {
    try {
      const {
        orderId,
        payments,
        discountType,
        discountValue,
        customerPhone,
        customerName,
        isPending,
      } = billData;

      // Validate input
      if (!orderId) {
        return { success: false, error: 'Order ID is required' };
      }

      if (!payments || !Array.isArray(payments) || payments.length === 0) {
        return {
          success: false,
          error: 'At least one payment method is required',
        };
      }

      // Validate payment methods (Requirements 12.2)
      const validPaymentTypes = ['cash', 'card', 'upi'];
      for (const payment of payments) {
        if (!validPaymentTypes.includes(payment.type)) {
          return {
            success: false,
            error: `Invalid payment type: ${payment.type}`,
          };
        }
        if (!payment.amount || payment.amount <= 0) {
          return { success: false, error: 'Payment amount must be positive' };
        }
      }

      // Validate split payment limit (Requirements 12.3)
      if (payments.length > 2) {
        return { success: false, error: 'Maximum 2 payment methods allowed' };
      }

      // Get order details
      const order = await getDocument('orders', orderId);
      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      // Calculate subtotal from order items
      let subtotal = 0;
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          subtotal += item.totalPrice || item.basePrice * item.quantity;
        }
      }

      // Apply discount (Requirements 13.1, 13.2, 13.3, 13.5)
      let discountAmount = 0;
      if (discountType && discountValue) {
        if (discountType === 'percentage') {
          // Percentage discount: discount_amount = subtotal * (discount_value / 100)
          discountAmount = subtotal * (discountValue / 100);
        } else if (discountType === 'fixed') {
          // Fixed amount discount
          discountAmount = discountValue;
        } else {
          return {
            success: false,
            error: 'Invalid discount type. Must be percentage or fixed',
          };
        }

        // Ensure discount doesn't exceed subtotal
        if (discountAmount > subtotal) {
          discountAmount = subtotal;
        }
      }

      // Calculate final total
      const total = subtotal - discountAmount;

      // Validate payment sum equals total (Requirements 12.5)
      const paymentSum = payments.reduce((sum, p) => sum + p.amount, 0);
      const tolerance = 0.01; // Allow small floating point differences

      if (Math.abs(paymentSum - total) > tolerance) {
        return {
          success: false,
          error: `Payment sum (${paymentSum}) does not equal bill total (${total})`,
        };
      }

      // Validate pending bill requirements (Requirements 14.1)
      if (isPending && (!customerPhone || !customerPhone.trim())) {
        return {
          success: false,
          error: 'Customer phone is required for pending bills',
        };
      }

      // Check for existing customer (Requirements 14.2, 14.3)
      let customerId = null;
      let previousOrders = [];

      if (customerPhone && customerPhone.trim()) {
        const existingCustomers = await queryCollection('customers', [
          { field: 'phone', operator: '==', value: customerPhone.trim() },
        ]);

        if (existingCustomers.length > 0) {
          // Returning customer
          customerId = existingCustomers[0].id;

          // Get previous order history
          const customerBills = await queryCollection(
            'bills',
            [{ field: 'customerId', operator: '==', value: customerId }],
            {
              orderBy: { field: 'createdAt', direction: 'desc' },
            }
          );

          previousOrders = customerBills;
        } else {
          // New customer - create customer record
          customerId = `customer_${Date.now()}`;
          await setDocument('customers', customerId, {
            phone: customerPhone.trim(),
            name: customerName?.trim() || '',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      // Create bill document
      const billId = `bill_${Date.now()}`;
      const billNumber = `BILL-${Date.now()}`;

      await setDocument('bills', billId, {
        billNumber,
        orderId,
        subtotal,
        discountType: discountType || null,
        discountValue: discountValue || 0,
        discountAmount,
        total,
        isPending: isPending || false,
        customerId,
        customerPhone: customerPhone?.trim() || null,
        customerName: customerName?.trim() || null,
        payments,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Update order status to completed
      await updateDocument('orders', orderId, {
        status: 'completed',
        billId,
        completedAt: new Date(),
        updatedAt: new Date(),
      });

      // Clear table status so mobile sees it as available
      if (order.tableId) {
        await updateDocument('tables', order.tableId, {
          status: 'available',
          currentOrderId: null,
          current_order_id: null,
          currentBillAmount: 0,
          current_bill_amount: 0,
          occupiedSince: null,
          occupied_since: null,
          updatedAt: new Date(),
        });
      }

      return {
        success: true,
        bill: {
          id: billId,
          billNumber,
          subtotal,
          discountAmount,
          total,
          payments,
          isPending: isPending || false,
          customerId,
          previousOrders: previousOrders.length,
        },
        message:
          previousOrders.length > 0
            ? `Bill generated. Customer has ${previousOrders.length} previous orders.`
            : 'Bill generated successfully',
      };
    } catch (error) {
      console.error('Error generating bill:', error);
      return { success: false, error: 'Failed to generate bill' };
    }
  });

  // Get bill by ID
  ipcMain.handle('firebase:get-bill', async (event, billId) => {
    try {
      const bill = await getDocument('bills', billId);

      if (!bill) {
        return { success: false, error: 'Bill not found' };
      }

      return { success: true, bill: { id: billId, ...bill } };
    } catch (error) {
      console.error('Error getting bill:', error);
      return { success: false, error: 'Failed to get bill' };
    }
  });

  // Get all bills (with optional filters)
  ipcMain.handle('firebase:get-bills', async (event, filters = {}) => {
    try {
      const queryFilters = [];

      // Filter by pending status
      if (filters.isPending !== undefined) {
        queryFilters.push({
          field: 'isPending',
          operator: '==',
          value: filters.isPending,
        });
      }

      // Filter by customer phone
      if (filters.customerPhone) {
        queryFilters.push({
          field: 'customerPhone',
          operator: '==',
          value: filters.customerPhone,
        });
      }

      // Filter by customer ID
      if (filters.customerId) {
        queryFilters.push({
          field: 'customerId',
          operator: '==',
          value: filters.customerId,
        });
      }

      // Filter by date range
      if (filters.startDate) {
        queryFilters.push({
          field: 'createdAt',
          operator: '>=',
          value: new Date(filters.startDate),
        });
      }

      if (filters.endDate) {
        queryFilters.push({
          field: 'createdAt',
          operator: '<=',
          value: new Date(filters.endDate),
        });
      }

      const bills = await queryCollection('bills', queryFilters, {
        orderBy: { field: 'createdAt', direction: 'desc' },
      });

      return { success: true, bills };
    } catch (error) {
      console.error('Error getting bills:', error);
      return { success: false, error: 'Failed to get bills' };
    }
  });

  // Search pending bills by phone or name (Requirements 14.4)
  ipcMain.handle('firebase:search-pending-bills', async (event, searchTerm) => {
    try {
      if (!searchTerm || !searchTerm.trim()) {
        return { success: false, error: 'Search term is required' };
      }

      const term = searchTerm.trim();

      // Search by phone
      const billsByPhone = await queryCollection(
        'bills',
        [
          { field: 'isPending', operator: '==', value: true },
          { field: 'customerPhone', operator: '==', value: term },
        ],
        {
          orderBy: { field: 'createdAt', direction: 'desc' },
        }
      );

      // Search by name (case-insensitive search requires client-side filtering)
      const allPendingBills = await queryCollection(
        'bills',
        [{ field: 'isPending', operator: '==', value: true }],
        {
          orderBy: { field: 'createdAt', direction: 'desc' },
        }
      );

      const billsByName = allPendingBills.filter(
        (bill) =>
          bill.customerName &&
          bill.customerName.toLowerCase().includes(term.toLowerCase())
      );

      // Combine results (remove duplicates)
      const billMap = new Map();
      [...billsByPhone, ...billsByName].forEach((bill) => {
        billMap.set(bill.id, bill);
      });

      const results = Array.from(billMap.values());

      return { success: true, bills: results };
    } catch (error) {
      console.error('Error searching pending bills:', error);
      return { success: false, error: 'Failed to search pending bills' };
    }
  });

  // Get customer by phone (Requirements 14.2)
  ipcMain.handle('firebase:get-customer-by-phone', async (event, phone) => {
    try {
      if (!phone || !phone.trim()) {
        return { success: false, error: 'Phone number is required' };
      }

      const customers = await queryCollection('customers', [
        { field: 'phone', operator: '==', value: phone.trim() },
      ]);

      if (customers.length === 0) {
        return { success: false, error: 'Customer not found' };
      }

      const customer = customers[0];

      // Get customer's order history (Requirements 14.3, 14.5)
      const bills = await queryCollection(
        'bills',
        [{ field: 'customerId', operator: '==', value: customer.id }],
        {
          orderBy: { field: 'createdAt', direction: 'desc' },
        }
      );

      // Separate pending and completed bills
      const pendingBills = bills.filter((b) => b.isPending);
      const completedBills = bills.filter((b) => !b.isPending);

      return {
        success: true,
        customer: { id: customer.id, ...customer },
        orderHistory: {
          total: bills.length,
          pending: pendingBills,
          completed: completedBills,
        },
      };
    } catch (error) {
      console.error('Error getting customer by phone:', error);
      return { success: false, error: 'Failed to get customer' };
    }
  });

  // Update bill (e.g., mark pending bill as paid)
  ipcMain.handle('firebase:update-bill', async (event, billId, updates) => {
    try {
      const bill = await getDocument('bills', billId);

      if (!bill) {
        return { success: false, error: 'Bill not found' };
      }

      const updateData = { updatedAt: new Date() };

      // Allow updating pending status
      if (updates.isPending !== undefined) {
        updateData.isPending = updates.isPending;
      }

      // Allow updating payments (e.g., when clearing pending bill)
      if (updates.payments) {
        updateData.payments = updates.payments;
      }

      await updateDocument('bills', billId, updateData);

      return { success: true };
    } catch (error) {
      console.error('Error updating bill:', error);
      return { success: false, error: 'Failed to update bill' };
    }
  });

  // Delete bill (soft delete - mark as cancelled)
  ipcMain.handle('firebase:delete-bill', async (event, billId) => {
    try {
      await updateDocument('bills', billId, {
        status: 'cancelled',
        updatedAt: new Date(),
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting bill:', error);
      return { success: false, error: 'Failed to delete bill' };
    }
  });
}

// Register waiter reporting handlers (Requirements 17.1-17.5)
function registerWaiterReportingHandlers() {
  // Get waiter sales report for a specific period (Requirements 17.1, 17.2, 17.3, 17.4)
  ipcMain.handle(
    'firebase:get-waiter-report',
    async (event, { waiterId, period, startDate, endDate }) => {
      try {
        if (!waiterId) {
          return { success: false, error: 'Waiter ID is required' };
        }

        // Calculate date range based on period
        let start, end;

        if (startDate && endDate) {
          // Custom date range provided
          start = new Date(startDate);
          end = new Date(endDate);
        } else if (period) {
          // Calculate date range based on period
          end = new Date();
          end.setHours(23, 59, 59, 999); // End of today

          start = new Date();

          if (period === 'daily') {
            start.setHours(0, 0, 0, 0); // Start of today
          } else if (period === 'weekly') {
            start.setDate(start.getDate() - 7);
            start.setHours(0, 0, 0, 0);
          } else if (period === 'monthly') {
            start.setDate(start.getDate() - 30);
            start.setHours(0, 0, 0, 0);
          } else {
            return {
              success: false,
              error: 'Invalid period. Must be daily, weekly, or monthly',
            };
          }
        } else {
          return {
            success: false,
            error: 'Either period or startDate/endDate must be provided',
          };
        }

        // Get waiter details
        const waiter = await getDocument('waiters', waiterId);
        if (!waiter) {
          return { success: false, error: 'Waiter not found' };
        }

        // Query orders by waiter and date range (Requirements 17.1)
        const orders = await queryCollection('orders', [
          { field: 'waiterId', operator: '==', value: waiterId },
          { field: 'status', operator: '==', value: 'completed' },
          { field: 'completedAt', operator: '>=', value: start },
          { field: 'completedAt', operator: '<=', value: end },
        ]);

        // Count orders per waiter (Requirements 17.2)
        const orderCount = orders.length;

        // Get unique table assignments (Requirements 17.3)
        const tableIds = new Set();
        orders.forEach((order) => {
          if (order.tableId) {
            tableIds.add(order.tableId);
          }
        });

        // Get table names for the assignments
        const tableAssignments = [];
        for (const tableId of tableIds) {
          const table = await getDocument('tables', tableId);
          if (table) {
            tableAssignments.push(table.name || tableId);
          }
        }

        // Calculate total sales per waiter (Requirements 17.4)
        let totalSales = 0;

        for (const order of orders) {
          // Get bill for this order
          if (order.billId) {
            const bill = await getDocument('bills', order.billId);
            if (bill && bill.total) {
              totalSales += bill.total;
            }
          }
        }

        return {
          success: true,
          report: {
            waiterId,
            waiterName: waiter.name,
            period: period || 'custom',
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            orderCount,
            totalSales: parseFloat(totalSales.toFixed(2)),
            tableAssignments: tableAssignments.sort(),
          },
        };
      } catch (error) {
        console.error('Error generating waiter report:', error);
        return { success: false, error: 'Failed to generate waiter report' };
      }
    }
  );

  // Get sales reports for all waiters (Requirements 17.1)
  ipcMain.handle(
    'firebase:get-all-waiters-report',
    async (event, { period, startDate, endDate }) => {
      try {
        // Calculate date range based on period
        let start, end;

        if (startDate && endDate) {
          start = new Date(startDate);
          end = new Date(endDate);
        } else if (period) {
          end = new Date();
          end.setHours(23, 59, 59, 999);

          start = new Date();

          if (period === 'daily') {
            start.setHours(0, 0, 0, 0);
          } else if (period === 'weekly') {
            start.setDate(start.getDate() - 7);
            start.setHours(0, 0, 0, 0);
          } else if (period === 'monthly') {
            start.setDate(start.getDate() - 30);
            start.setHours(0, 0, 0, 0);
          } else {
            return {
              success: false,
              error: 'Invalid period. Must be daily, weekly, or monthly',
            };
          }
        } else {
          return {
            success: false,
            error: 'Either period or startDate/endDate must be provided',
          };
        }

        // Get all active waiters
        const waiters = await queryCollection('waiters', [
          { field: 'isActive', operator: '==', value: true },
        ]);

        // Generate report for each waiter
        const reports = [];

        for (const waiter of waiters) {
          // Query orders by waiter and date range
          const orders = await queryCollection('orders', [
            { field: 'waiterId', operator: '==', value: waiter.id },
            { field: 'status', operator: '==', value: 'completed' },
            { field: 'completedAt', operator: '>=', value: start },
            { field: 'completedAt', operator: '<=', value: end },
          ]);

          // Count orders
          const orderCount = orders.length;

          // Get unique table assignments
          const tableIds = new Set();
          orders.forEach((order) => {
            if (order.tableId) {
              tableIds.add(order.tableId);
            }
          });

          // Get table names
          const tableAssignments = [];
          for (const tableId of tableIds) {
            const table = await getDocument('tables', tableId);
            if (table) {
              tableAssignments.push(table.name || tableId);
            }
          }

          // Calculate total sales
          let totalSales = 0;

          for (const order of orders) {
            if (order.billId) {
              const bill = await getDocument('bills', order.billId);
              if (bill && bill.total) {
                totalSales += bill.total;
              }
            }
          }

          reports.push({
            waiterId: waiter.id,
            waiterName: waiter.name,
            period: period || 'custom',
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            orderCount,
            totalSales: parseFloat(totalSales.toFixed(2)),
            tableAssignments: tableAssignments.sort(),
          });
        }

        // Calculate total restaurant sales for the period (for Property 42 validation)
        const totalRestaurantSales = reports.reduce(
          (sum, report) => sum + report.totalSales,
          0
        );

        return {
          success: true,
          reports,
          summary: {
            period: period || 'custom',
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            totalWaiters: reports.length,
            totalOrders: reports.reduce((sum, r) => sum + r.orderCount, 0),
            totalRestaurantSales: parseFloat(totalRestaurantSales.toFixed(2)),
          },
        };
      } catch (error) {
        console.error('Error generating all waiters report:', error);
        return {
          success: false,
          error: 'Failed to generate all waiters report',
        };
      }
    }
  );
}

/**
 * KOT ROUTER STUB HANDLERS
 *
 * Placeholder handlers for KOT routing functionality.
 * Task 4.1 (KOT Router Implementation) is not yet complete.
 * These stubs allow desktop order entry to function without full KOT printing.
 *
 * Requirements: 27.5, 27.6, 27.7
 */
function registerKOTRouterStub() {
  // Route order to KOT Router (stub implementation)
  ipcMain.handle('firebase:route-to-kot', async (event, orderData) => {
    try {
      console.log(
        '[KOT Router Stub] Received order for KOT generation:',
        orderData
      );

      // TODO: Implement full KOT routing in Task 4.1
      // For now, just log the order and return success

      const { orderId, items, tableId, tableName, systemUser } = orderData;

      if (!orderId || !items || items.length === 0) {
        return {
          success: false,
          error: 'Invalid order data for KOT generation',
        };
      }

      // Separate items by category (food vs drink)
      const foodItems = items.filter((item) => {
        // TODO: Get actual category from menu item
        // For now, assume all items are food
        return true;
      });

      const drinkItems = items.filter((item) => {
        // TODO: Get actual category from menu item
        return false;
      });

      // Generate KOT metadata
      const kotMetadata = {
        orderNumber: orderId,
        tableNumber: tableName || tableId,
        waiterName: systemUser || 'Manager',
        timestamp: new Date().toISOString(),
      };

      // Stub KOT generation
      const kots = [];

      if (foodItems.length > 0) {
        kots.push({
          id: `kot_kitchen_${Date.now()}`,
          type: 'kitchen',
          items: foodItems,
          metadata: kotMetadata,
          status: 'pending_print',
        });
      }

      if (drinkItems.length > 0) {
        kots.push({
          id: `kot_bar_${Date.now()}`,
          type: 'bar',
          items: drinkItems,
          metadata: kotMetadata,
          status: 'pending_print',
        });
      }

      console.log('[KOT Router Stub] Generated KOTs:', kots);

      // TODO: In Task 4.1, implement actual printer routing
      // - Route food items to kitchen printer
      // - Route drink items to bar printer
      // - Handle mixed orders with split routing
      // - Store KOT records in Firestore
      // - Handle print failures and retries

      return {
        success: true,
        kots,
        message: 'KOT routing stubbed (Task 4.1 not yet implemented)',
      };
    } catch (error) {
      console.error('[KOT Router Stub] Error routing to KOT:', error);
      return { success: false, error: 'Failed to route order to KOT' };
    }
  });

  // Get KOT status (stub implementation)
  ipcMain.handle('firebase:get-kot-status', async (event, kotId) => {
    try {
      console.log('[KOT Router Stub] Get KOT status:', kotId);

      // TODO: Implement in Task 4.1
      return {
        success: true,
        status: 'pending_print',
        message: 'KOT status check stubbed (Task 4.1 not yet implemented)',
      };
    } catch (error) {
      console.error('[KOT Router Stub] Error getting KOT status:', error);
      return { success: false, error: 'Failed to get KOT status' };
    }
  });

  // Get failed KOTs
  // Requirements: 23.4
  ipcMain.handle('kot:get-failed-kots', async () => {
    try {
      const KOTRouterService = require('../services/kotRouterService');
      const kotRouter = new KOTRouterService();
      await kotRouter.initialize();

      const failedKOTs = await kotRouter.getFailedKOTs();

      return {
        success: true,
        failedKOTs,
      };
    } catch (error) {
      console.error('Error getting failed KOTs:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Retry failed KOT
  // Requirements: 22.4, 23.4
  ipcMain.handle('kot:retry-failed-kot', async (event, failedKOTId) => {
    try {
      const KOTRouterService = require('../services/kotRouterService');
      const kotRouter = new KOTRouterService();
      await kotRouter.initialize();

      const result = await kotRouter.retryFailedKOT(failedKOTId);

      return result;
    } catch (error) {
      console.error('Error retrying failed KOT:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });
}

/**
 * TABLE ORDER ENTRY HANDLERS
 * Supports the desktop Table Order Entry screen.
 */
function registerPendingBillHandlers() {
  [
    'firebase:save-pending-bill',
    'firebase:get-pending-bills',
    'firebase:settle-pending-bill',
    'firebase:delete-pending-bill',
    'firebase:get-customer-suggestions',
  ].forEach((ch) => {
    try {
      ipcMain.removeHandler(ch);
    } catch (_) {}
  });

  // Save a pending bill to Firestore and clear the table
  ipcMain.handle(
    'firebase:save-pending-bill',
    async (
      event,
      {
        orderId,
        tableId,
        tableName,
        customerName,
        customerPhone,
        items,
        subtotal,
        discountAmount,
        totalAmount,
      }
    ) => {
      try {
        const firestore = getAdminFirestore();
        const billId = `pending_${Date.now()}`;
        const now = new Date();

        // 1. Save pending bill document
        await firestore
          .collection('pendingBills')
          .doc(billId)
          .set({
            billId,
            orderId: orderId || null,
            tableId,
            tableName,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            items,
            subtotal,
            discountAmount: discountAmount || 0,
            totalAmount,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
          });

        // 2. Upsert customer record for autofill
        const custSnap = await firestore
          .collection('customers')
          .where('phone', '==', customerPhone.trim())
          .limit(1)
          .get();
        if (custSnap.empty) {
          await firestore.collection('customers').add({
            name: customerName.trim(),
            phone: customerPhone.trim(),
            createdAt: now,
            updatedAt: now,
          });
        } else {
          await custSnap.docs[0].ref.update({
            name: customerName.trim(),
            updatedAt: now,
          });
        }

        // 3. Clear table in Firestore
        await firestore.collection('tables').doc(tableId).update({
          status: 'available',
          currentOrderId: null,
          current_order_id: null,
          currentBillAmount: 0,
          current_bill_amount: 0,
          updatedAt: now,
        });

        // 4. Mark order as pending_bill
        if (orderId) {
          await firestore.collection('orders').doc(orderId).update({
            status: 'pending_bill',
            pendingBillId: billId,
            updatedAt: now,
          });
        }

        // 5. Deduction already happened via upsertOrderItem — no extra deduction needed

        return { success: true, billId };
      } catch (error) {
        console.error('Error saving pending bill:', error);
        return { success: false, error: error.message };
      }
    }
  );

  // Get all pending bills from Firestore
  ipcMain.handle('firebase:get-pending-bills', async () => {
    try {
      const firestore = getAdminFirestore();
      // No orderBy to avoid requiring a composite index — sort in memory
      const snap = await firestore
        .collection('pendingBills')
        .where('status', '==', 'pending')
        .get();
      const bills = snap.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return { success: true, bills };
    } catch (error) {
      console.error('Error getting pending bills:', error);
      return { success: false, error: error.message };
    }
  });

  // Settle (mark as paid) a pending bill
  ipcMain.handle(
    'firebase:settle-pending-bill',
    async (event, { billId, payments }) => {
      try {
        const firestore = getAdminFirestore();
        await firestore
          .collection('pendingBills')
          .doc(billId)
          .update({
            status: 'settled',
            payments: payments || [],
            settledAt: new Date(),
            updatedAt: new Date(),
          });
        return { success: true };
      } catch (error) {
        console.error('Error settling pending bill:', error);
        return { success: false, error: error.message };
      }
    }
  );

  // Delete a pending bill
  ipcMain.handle('firebase:delete-pending-bill', async (event, billId) => {
    try {
      const firestore = getAdminFirestore();
      await firestore.collection('pendingBills').doc(billId).update({
        status: 'deleted',
        updatedAt: new Date(),
      });
      return { success: true };
    } catch (error) {
      console.error('Error deleting pending bill:', error);
      return { success: false, error: error.message };
    }
  });

  // Get customer suggestions by partial phone or name (for autofill)
  ipcMain.handle('firebase:get-customer-suggestions', async (event, query) => {
    try {
      // Support both old string (phone) and new object { phone?, name? }
      const phone = typeof query === 'string' ? query : query?.phone;
      const name = typeof query === 'object' ? query?.name : null;

      const firestore = getAdminFirestore();

      if (phone && phone.trim().length >= 3) {
        const term = phone.trim();
        const snap = await firestore
          .collection('customers')
          .where('phone', '>=', term)
          .where('phone', '<', term + '\uf8ff')
          .limit(5)
          .get();
        return {
          success: true,
          customers: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        };
      }

      if (name && name.trim().length >= 2) {
        const term = name.trim().toLowerCase();
        // Firestore doesn't support case-insensitive prefix search natively,
        // so fetch all and filter in memory (customers collection is small)
        const snap = await firestore.collection('customers').limit(200).get();
        const customers = snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((c) => (c.name || '').toLowerCase().startsWith(term))
          .slice(0, 5);
        return { success: true, customers };
      }

      return { success: true, customers: [] };
    } catch (error) {
      console.error('Error getting customer suggestions:', error);
      return { success: false, customers: [] };
    }
  });
}

function registerTableOrderHandlers() {
  // Update order status
  ipcMain.handle(
    'firebase:update-order-status',
    async (event, { orderId, status }) => {
      try {
        if (!orderId || !status) {
          return { success: false, error: 'Order ID and status are required' };
        }

        await updateDocument('orders', orderId, {
          status,
          updatedAt: new Date(),
          ...(status === 'completed' ? { completedAt: new Date() } : {}),
        });

        return { success: true };
      } catch (error) {
        console.error('Error updating order status:', error);
        return { success: false, error: 'Failed to update order status' };
      }
    }
  );

  // Remove any stale handlers from previous registrations to avoid duplicate-handler errors
  [
    'firebase:get-order-items',
    'firebase:get-kot-history',
    'firebase:upsert-order-item',
    'firebase:delete-order-item',
    'firebase:send-kot',
    'firebase:subscribe-order-items',
    'firebase:unsubscribe-order-items',
  ].forEach((ch) => {
    try {
      ipcMain.removeHandler(ch);
    } catch (_) {}
  });

  // Subscribe to real-time order items updates — pushes normalized items to renderer
  const orderItemsListeners = new Map(); // orderId -> unsubscribe fn
  const normalizeOrderItems = (docs) => {
    const byMenuItemId = new Map();

    for (const docSnap of docs) {
      const d = docSnap.data() || {};
      const menuItemId = d.menuItemId || d.menu_item_id || docSnap.id;
      if (!menuItemId) continue;

      const currentQty = Number(d.currentQty ?? d.quantity ?? 0);
      const sentQty = Number(
        d.sentQty ?? (d.sent_to_kitchen ? (d.currentQty ?? d.quantity ?? 0) : 0)
      );
      const unitPrice = Number(d.unitPrice ?? d.base_price ?? 0);
      const createdAt =
        d.created_at || d.updatedAt?.toMillis?.() || d.updated_at || Date.now();
      const sentAt =
        d.sent_at ||
        d.sentAt?.toMillis?.() ||
        (sentQty > 0 ? d.updatedAt?.toMillis?.() || Date.now() : 0);

      const existing = byMenuItemId.get(menuItemId);
      if (!existing) {
        byMenuItemId.set(menuItemId, {
          id: menuItemId,
          menuItemId,
          menuItemName: d.menuItemName || d.menu_item_name || '',
          unitPrice,
          currentQty,
          sentQty,
          category: d.category || '',
          isBarItem: !!(d.isBarItem || d.is_bar_item),
          created_at: createdAt,
          sent_at: sentAt,
        });
      } else {
        existing.currentQty += currentQty;
        existing.sentQty += sentQty;
        existing.unitPrice = existing.unitPrice || unitPrice;
        existing.created_at = Math.min(
          existing.created_at || createdAt,
          createdAt
        );
        existing.sent_at = Math.max(existing.sent_at || 0, sentAt || 0);
        if (!existing.menuItemName)
          existing.menuItemName = d.menuItemName || d.menu_item_name || '';
      }
    }

    return Array.from(byMenuItemId.values());
  };

  ipcMain.handle(
    'firebase:subscribe-order-items',
    async (event, { orderId }) => {
      try {
        if (orderItemsListeners.has(orderId)) return { success: true }; // already subscribed
        const firestore = getAdminFirestore();
        const unsubscribe = firestore
          .collection('orders')
          .doc(orderId)
          .collection('items')
          .onSnapshot((snapshot) => {
            const items = normalizeOrderItems(snapshot.docs);
            event.sender.send(`order-items-update:${orderId}`, items);
          });
        orderItemsListeners.set(orderId, unsubscribe);
        return { success: true };
      } catch (error) {
        console.error('Error subscribing to order items:', error);
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.handle(
    'firebase:unsubscribe-order-items',
    async (event, { orderId }) => {
      const unsub = orderItemsListeners.get(orderId);
      if (unsub) {
        unsub();
        orderItemsListeners.delete(orderId);
      }
      return { success: true };
    }
  );

  ipcMain.handle('firebase:get-order-items', async (event, { orderId }) => {
    try {
      const firestore = getAdminFirestore();
      const snapshot = await firestore
        .collection('orders')
        .doc(orderId)
        .collection('items')
        .get();
      const items = normalizeOrderItems(snapshot.docs);
      return { success: true, items };
    } catch (error) {
      console.error('Error getting order items:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('firebase:get-kot-history', async (event, { orderId }) => {
    try {
      const firestore = getAdminFirestore();
      const snapshot = await firestore
        .collection('orders')
        .doc(orderId)
        .collection('kotHistory')
        .orderBy('kotNumber', 'asc')
        .get();

      const kots = snapshot.docs.map((doc) => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          kotNumber: Number(data.kotNumber || 0),
          sentAt:
            data.sent_at ||
            data.sentAt?.toMillis?.() ||
            data.createdAt?.toMillis?.() ||
            0,
          subtotal: Number(data.subtotal || 0),
          tableId: data.tableId || '',
          tableName: data.tableName || '',
          items: Array.isArray(data.items) ? data.items : [],
        };
      });

      return { success: true, kots };
    } catch (error) {
      console.error('Error getting KOT history:', error);
      return { success: false, error: error.message };
    }
  });

  // Add or update a single item in orders/{orderId}/items/{menuItemId}
  ipcMain.handle(
    'firebase:upsert-order-item',
    async (event, { orderId, item }) => {
      try {
        const firestore = getAdminFirestore();
        const itemRef = firestore
          .collection('orders')
          .doc(orderId)
          .collection('items')
          .doc(item.menuItemId);
        const now = new Date();

        await itemRef.set(
          {
            menuItemId: item.menuItemId,
            menuItemName: item.menuItemName,
            unitPrice: item.unitPrice,
            currentQty: item.currentQty,
            sentQty: item.sentQty ?? 0,
            category: item.category || '',
            isBarItem: item.isBarItem || false,
            updatedAt: now,
          },
          { merge: true }
        );
        // Set created_at only on first write (don't overwrite)
        const snap = await itemRef.get();
        if (snap.exists && !snap.data().created_at) {
          await itemRef.update({ created_at: Date.now() });
        }

        return { success: true, itemId: item.menuItemId };
      } catch (error) {
        console.error('Error upserting order item:', error);
        return { success: false, error: error.message };
      }
    }
  );

  // Delete an item from orders/{orderId}/items
  ipcMain.handle(
    'firebase:delete-order-item',
    async (event, { orderId, menuItemId }) => {
      try {
        const firestore = getAdminFirestore();
        const itemRef = firestore
          .collection('orders')
          .doc(orderId)
          .collection('items')
          .doc(menuItemId);

        await itemRef.delete();

        // Recalculate remaining order value and automatically free table if no items remain.
        const orderRef = firestore.collection('orders').doc(orderId);
        const orderSnap = await orderRef.get();
        const orderData = orderSnap.exists ? orderSnap.data() || {} : {};
        const tableId = orderData.tableId || orderData.table_id;

        const remainingItemsSnap = await firestore
          .collection('orders')
          .doc(orderId)
          .collection('items')
          .get();

        const committedSubtotal = remainingItemsSnap.docs.reduce((sum, d) => {
          const row = d.data() || {};
          const qtyVal = row.sentQty ?? 0;
          const priceVal = row.unitPrice ?? row.base_price ?? 0;
          return sum + Number(qtyVal) * Number(priceVal);
        }, 0);

        if (tableId) {
          if (remainingItemsSnap.empty) {
            await firestore.collection('tables').doc(tableId).update({
              status: 'available',
              currentOrderId: null,
              current_order_id: null,
              currentBillAmount: 0,
              current_bill_amount: 0,
              occupiedSince: null,
              occupied_since: null,
              updatedAt: new Date(),
            });

            if (orderSnap.exists && orderData.status !== 'completed') {
              await orderRef.update({
                status: 'cancelled',
                updatedAt: new Date(),
              });
            }
          } else {
            await firestore.collection('tables').doc(tableId).update({
              status: 'occupied',
              currentOrderId: orderId,
              current_order_id: orderId,
              currentBillAmount: committedSubtotal,
              current_bill_amount: committedSubtotal,
              updatedAt: new Date(),
            });
          }
        }

        return { success: true };
      } catch (error) {
        console.error('Error deleting order item:', error);
        return { success: false, error: error.message };
      }
    }
  );

  // Send KOT: mark dispatched items as sent, update order + table status
  ipcMain.handle(
    'firebase:send-kot',
    async (event, { orderId, tableId, tableName, kotItems }) => {
      try {
        if (!kotItems || kotItems.length === 0) {
          return { success: false, error: 'No items to send' };
        }
        const firestore = getAdminFirestore();
        const now = new Date();
        const nowMs = now.getTime();
        let assignedKotNumber = 0;
        await firestore.runTransaction(async (tx) => {
          const orderItemsRef = firestore
            .collection('orders')
            .doc(orderId)
            .collection('items');
          const counterRef = firestore.collection('counters').doc('kot');
          const counterSnap = await tx.get(counterRef);
          const lastKotNumber = Number(
            counterSnap.exists ? counterSnap.data().lastKotNumber || 0 : 0
          );
          assignedKotNumber = lastKotNumber + 1;

          const itemsToSend = [];
          const barReadMap = new Map();

          // Read phase: collect all required docs before any writes.
          for (const kotItem of kotItems) {
            const itemRef = orderItemsRef.doc(kotItem.menuItemId);
            const itemSnap = await tx.get(itemRef);
            if (!itemSnap.exists) continue;

            const itemData = itemSnap.data() || {};
            const currentQty = Number(itemData.currentQty || 0);
            const sentQty = Number(itemData.sentQty || 0);
            const qtyToSend = Math.max(0, currentQty - sentQty);

            if (qtyToSend <= 0) continue;

            itemsToSend.push({
              menuItemId: kotItem.menuItemId,
              itemRef,
              currentQty,
              qtyToSend,
              isBarItem: !!itemData.isBarItem,
              menuItemName:
                itemData.menuItemName || itemData.menu_item_name || '',
              unitPrice: Number(itemData.unitPrice ?? itemData.base_price ?? 0),
              category: itemData.category || '',
            });

            if (itemData.isBarItem && !barReadMap.has(kotItem.menuItemId)) {
              const invRef = firestore
                .collection('inventory')
                .doc(kotItem.menuItemId);
              const invSnap = await tx.get(invRef);
              const currentStock = Number(
                invSnap.exists ? invSnap.data().counterStock || 0 : 0
              );
              barReadMap.set(kotItem.menuItemId, { invRef, currentStock });
            }
          }

          const allItemsSnap = await tx.get(orderItemsRef);

          if (itemsToSend.length === 0) {
            throw new Error('No items to send');
          }

          // Validate and prepare stock adjustments for bar items.
          const barQtyMap = new Map();
          for (const item of itemsToSend) {
            if (!item.isBarItem) continue;
            barQtyMap.set(
              item.menuItemId,
              (barQtyMap.get(item.menuItemId) || 0) + item.qtyToSend
            );
          }

          for (const [menuItemId, qty] of barQtyMap.entries()) {
            const barState = barReadMap.get(menuItemId);
            const currentStock = Number(barState?.currentStock || 0);
            if (currentStock < qty) {
              throw new Error('Stock not available.');
            }
          }

          // Write phase: all tx updates/sets happen after reads and validation.
          for (const item of itemsToSend) {
            tx.update(item.itemRef, {
              sentQty: item.currentQty,
              kotNumber: assignedKotNumber,
              sent_at: nowMs,
              sentAt: now,
              updatedAt: now,
            });
          }

          const sentQtyByItemId = new Map();
          for (const docSnap of allItemsSnap.docs) {
            const data = docSnap.data() || {};
            const menuItemId =
              data.menuItemId || data.menu_item_id || docSnap.id;
            const currentQty = Number(data.currentQty ?? data.quantity ?? 0);
            const sentQty = Number(data.sentQty ?? 0);
            const qtyToSend = Math.max(0, currentQty - sentQty);
            const finalSentQty = itemsToSend.some(
              (i) => i.menuItemId === menuItemId
            )
              ? currentQty
              : sentQty;
            sentQtyByItemId.set(menuItemId, {
              qty: finalSentQty,
              unitPrice: Number(data.unitPrice ?? data.base_price ?? 0),
            });
          }

          let committedTotal = 0;
          for (const { qty, unitPrice } of sentQtyByItemId.values()) {
            committedTotal += qty * unitPrice;
          }

          const kotSubtotal = itemsToSend.reduce(
            (sum, i) =>
              sum + Number(i.qtyToSend || 0) * Number(i.unitPrice || 0),
            0
          );

          tx.set(
            firestore
              .collection('orders')
              .doc(orderId)
              .collection('kotHistory')
              .doc(String(assignedKotNumber)),
            {
              kotNumber: assignedKotNumber,
              orderId,
              tableId,
              tableName: tableName || '',
              sentAt: now,
              sent_at: nowMs,
              subtotal: kotSubtotal,
              totalItems: itemsToSend.reduce(
                (sum, i) => sum + Number(i.qtyToSend || 0),
                0
              ),
              items: itemsToSend.map((i) => ({
                menuItemId: i.menuItemId,
                menuItemName: i.menuItemName,
                qty: i.qtyToSend,
                unitPrice: i.unitPrice,
                category: i.category,
                lineTotal: Number(i.qtyToSend || 0) * Number(i.unitPrice || 0),
              })),
              createdAt: now,
              updatedAt: now,
            },
            { merge: true }
          );

          tx.set(
            counterRef,
            {
              lastKotNumber: assignedKotNumber,
              updatedAt: now,
            },
            { merge: true }
          );

          for (const [menuItemId, qty] of barQtyMap.entries()) {
            const { invRef, currentStock } = barReadMap.get(menuItemId);
            const newCounterStock = currentStock - qty;

            tx.set(
              invRef,
              {
                menuItemId,
                counterStock: newCounterStock,
                updatedAt: now,
              },
              { merge: true }
            );

            tx.set(
              firestore.collection('menuItems').doc(menuItemId),
              {
                isOutOfStock: newCounterStock === 0,
                updatedAt: now,
              },
              { merge: true }
            );
          }

          const orderRef = firestore.collection('orders').doc(orderId);
          tx.update(orderRef, { status: 'submitted', updatedAt: now });

          const tableRef = firestore.collection('tables').doc(tableId);
          tx.update(tableRef, {
            status: 'occupied',
            currentOrderId: orderId,
            current_order_id: orderId,
            currentBillAmount: committedTotal,
            current_bill_amount: committedTotal,
            occupiedSince: now,
            occupied_since: now,
            updatedAt: now,
          });
        });

        return { success: true, kotNumber: assignedKotNumber };
      } catch (error) {
        console.error('Error sending KOT:', error);
        return { success: false, error: error.message };
      }
    }
  );
}

// Deduct counterStock from inventory for bar items
async function deductCounterStockForItems(firestore, items) {
  for (const item of items) {
    try {
      // Only deduct bar items
      const menuItemDoc = await firestore
        .collection('menuItems')
        .doc(item.menuItemId)
        .get();
      if (!menuItemDoc.exists) continue;
      const menuItem = menuItemDoc.data();
      if (!menuItem.isBarItem) continue;

      const qty = item.quantity || item.currentQty || 0;
      if (qty <= 0) continue;

      const invRef = firestore.collection('inventory').doc(item.menuItemId);
      await firestore.runTransaction(async (tx) => {
        const invDoc = await tx.get(invRef);
        const current = invDoc.exists ? invDoc.data().counterStock || 0 : 0;
        const newCounter = Math.max(0, current - qty);
        tx.set(
          invRef,
          {
            menuItemId: item.menuItemId,
            counterStock: newCounter,
            updatedAt: new Date(),
          },
          { merge: true }
        );

        // Mark out of stock if counter hits 0
        if (newCounter === 0) {
          tx.update(firestore.collection('menuItems').doc(item.menuItemId), {
            isOutOfStock: true,
            updatedAt: new Date(),
          });
        }
      });
    } catch (e) {
      console.error(
        'Failed to deduct counter stock for',
        item.menuItemId,
        e.message
      );
    }
  }
}

// Export initialization function
module.exports = {
  initializeFirebaseAdmin,
};
