/**
 * Order Data Serialization
 * 
 * Handles serialization and deserialization of Order objects
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5
 */

class SerializationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'SerializationError';
    this.field = field;
  }
}

/**
 * Serialize Order object to JSON
 * @param {object} order - Order object
 * @returns {string} JSON string
 * @throws {SerializationError} If serialization fails
 */
function serializeOrder(order) {
  try {
    // Validate order object exists
    if (!order || typeof order !== 'object') {
      throw new SerializationError('Order must be an object', null);
    }

    // Create serializable object with all required fields
    const serializable = {
      id: order.id,
      orderNumber: order.orderNumber,
      tableId: order.tableId,
      tableNumber: order.tableNumber,
      waiterId: order.waiterId,
      waiterName: order.waiterName,
      items: order.items || [],
      status: order.status,
      total: order.total || 0,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      sentToKitchenAt: order.sentToKitchenAt || null
    };

    // Serialize to JSON
    return JSON.stringify(serializable);
  } catch (error) {
    if (error instanceof SerializationError) {
      throw error;
    }
    throw new SerializationError(`Serialization failed: ${error.message}`, null);
  }
}

/**
 * Deserialize JSON to Order object
 * @param {string} json - JSON string
 * @returns {object} Order object
 * @throws {SerializationError} If deserialization fails
 */
function deserializeOrder(json) {
  try {
    // Parse JSON
    let data;
    if (typeof json === 'string') {
      try {
        data = JSON.parse(json);
      } catch (error) {
        throw new SerializationError('Invalid JSON format', null);
      }
    } else if (typeof json === 'object' && json !== null) {
      data = json;
    } else {
      throw new SerializationError('Input must be a JSON string or object', null);
    }

    // Validate required fields
    validateOrderStructure(data);

    // Construct order object
    const order = {
      id: data.id,
      orderNumber: data.orderNumber,
      tableId: data.tableId,
      tableNumber: data.tableNumber,
      waiterId: data.waiterId,
      waiterName: data.waiterName,
      items: data.items || [],
      status: data.status,
      total: data.total || 0,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      sentToKitchenAt: data.sentToKitchenAt || null
    };

    return order;
  } catch (error) {
    if (error instanceof SerializationError) {
      throw error;
    }
    throw new SerializationError(`Deserialization failed: ${error.message}`, null);
  }
}

/**
 * Validate order structure during deserialization
 * @param {object} data - Order data
 * @throws {SerializationError} If validation fails
 */
function validateOrderStructure(data) {
  // Required string fields
  const requiredStrings = ['id', 'orderNumber', 'tableId', 'tableNumber', 'waiterId', 'waiterName', 'status'];
  for (const field of requiredStrings) {
    if (!data[field] || typeof data[field] !== 'string') {
      throw new SerializationError(`Missing or invalid "${field}" field`, field);
    }
  }

  // Required array field
  if (!Array.isArray(data.items)) {
    throw new SerializationError('Missing or invalid "items" field (must be array)', 'items');
  }

  // Validate each item
  for (let i = 0; i < data.items.length; i++) {
    validateOrderItem(data.items[i], i);
  }

  // Required number field
  if (typeof data.total !== 'number' || data.total < 0) {
    throw new SerializationError('Missing or invalid "total" field (must be non-negative number)', 'total');
  }

  // Required timestamp fields
  if (!data.createdAt) {
    throw new SerializationError('Missing "createdAt" field', 'createdAt');
  }

  if (!data.updatedAt) {
    throw new SerializationError('Missing "updatedAt" field', 'updatedAt');
  }
}

/**
 * Validate order item structure
 * @param {object} item - Order item
 * @param {number} index - Item index
 * @throws {SerializationError} If validation fails
 */
function validateOrderItem(item, index) {
  if (!item || typeof item !== 'object') {
    throw new SerializationError(`Item at index ${index} must be an object`, `items[${index}]`);
  }

  // Required fields
  if (!item.id || typeof item.id !== 'string') {
    throw new SerializationError(`Item at index ${index} missing or invalid "id"`, `items[${index}].id`);
  }

  if (!item.menuItemId || typeof item.menuItemId !== 'string') {
    throw new SerializationError(`Item at index ${index} missing or invalid "menuItemId"`, `items[${index}].menuItemId`);
  }

  if (!item.name || typeof item.name !== 'string') {
    throw new SerializationError(`Item at index ${index} missing or invalid "name"`, `items[${index}].name`);
  }

  if (typeof item.quantity !== 'number' || item.quantity <= 0) {
    throw new SerializationError(`Item at index ${index} invalid "quantity" (must be positive number)`, `items[${index}].quantity`);
  }

  if (typeof item.price !== 'number' || item.price < 0) {
    throw new SerializationError(`Item at index ${index} invalid "price" (must be non-negative number)`, `items[${index}].price`);
  }

  // Optional modifiers field
  if (item.modifiers !== undefined && !Array.isArray(item.modifiers)) {
    throw new SerializationError(`Item at index ${index} invalid "modifiers" (must be array)`, `items[${index}].modifiers`);
  }
}

module.exports = {
  serializeOrder,
  deserializeOrder,
  SerializationError
};
