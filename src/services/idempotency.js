/**
 * Idempotency Implementation
 * 
 * Ensures order submissions are idempotent
 * Requirements: 25.1, 25.2, 25.3, 25.4
 */

/**
 * Generate unique order ID based on device and timestamp
 * @param {string} deviceId - Device identifier
 * @param {number} timestamp - Timestamp in milliseconds
 * @returns {string} Unique order ID
 */
function generateOrderId(deviceId, timestamp = Date.now()) {
  if (!deviceId || typeof deviceId !== 'string') {
    throw new Error('Device ID must be a non-empty string');
  }

  if (typeof timestamp !== 'number' || timestamp <= 0) {
    throw new Error('Timestamp must be a positive number');
  }

  // Format: device_timestamp_random
  // This ensures uniqueness even if multiple orders are created in the same millisecond
  const random = Math.random().toString(36).substring(2, 8);
  return `${deviceId}_${timestamp}_${random}`;
}

/**
 * Create idempotent order submission
 * @param {object} firestore - Firestore instance
 * @param {string} orderId - Order ID
 * @param {object} orderData - Order data
 * @returns {Promise<object>} Submission result
 */
async function submitOrderIdempotent(firestore, orderId, orderData) {
  if (!firestore) {
    throw new Error('Firestore instance is required');
  }

  if (!orderId || typeof orderId !== 'string') {
    throw new Error('Order ID must be a non-empty string');
  }

  if (!orderData || typeof orderData !== 'object') {
    throw new Error('Order data must be an object');
  }

  try {
    // Use setDoc with the generated ID to ensure idempotency
    // If the document already exists, it won't be created again
    const orderRef = firestore.collection('orders').doc(orderId);
    
    // Check if order already exists
    const existingOrder = await orderRef.get();
    
    if (existingOrder.exists) {
      // Order already submitted - idempotent behavior
      return {
        success: true,
        orderId,
        created: false,
        message: 'Order already exists (idempotent)'
      };
    }

    // Create new order
    await orderRef.set({
      ...orderData,
      id: orderId,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return {
      success: true,
      orderId,
      created: true,
      message: 'Order created successfully'
    };
  } catch (error) {
    throw new Error(`Failed to submit order: ${error.message}`);
  }
}

/**
 * Retry order submission with same ID
 * @param {object} firestore - Firestore instance
 * @param {string} orderId - Order ID (same as original)
 * @param {object} orderData - Order data
 * @returns {Promise<object>} Retry result
 */
async function retryOrderSubmission(firestore, orderId, orderData) {
  // Retry uses the same ID to ensure idempotency
  return submitOrderIdempotent(firestore, orderId, orderData);
}

/**
 * Parse order ID to extract components
 * @param {string} orderId - Order ID
 * @returns {object} Parsed components
 */
function parseOrderId(orderId) {
  if (!orderId || typeof orderId !== 'string') {
    throw new Error('Order ID must be a non-empty string');
  }

  const parts = orderId.split('_');
  
  if (parts.length < 3) {
    throw new Error('Invalid order ID format');
  }

  // Device ID is everything except last 2 parts (timestamp and random)
  const deviceId = parts.slice(0, -2).join('_');
  const timestamp = parseInt(parts[parts.length - 2], 10);
  const random = parts[parts.length - 1];

  return {
    deviceId,
    timestamp,
    random
  };
}

module.exports = {
  generateOrderId,
  submitOrderIdempotent,
  retryOrderSubmission,
  parseOrderId
};
