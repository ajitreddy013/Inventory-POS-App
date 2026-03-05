/**
 * Data Validation
 * 
 * Validates orders and bills for correctness
 * Requirements: 12.3, 12.5, 14.1, 24.1, 24.2, 24.3, 24.4, 24.5
 */

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Validate order data
 * @param {object} order - Order object
 * @throws {ValidationError} If validation fails
 */
function validateOrder(order) {
  if (!order || typeof order !== 'object') {
    throw new ValidationError('Order must be an object', null);
  }

  // Requirement 24.1: At least one item must exist
  if (!Array.isArray(order.items) || order.items.length === 0) {
    throw new ValidationError('Order must have at least one item', 'items');
  }

  // Validate each item
  for (let i = 0; i < order.items.length; i++) {
    validateOrderItem(order.items[i], i);
  }

  // Requirement 24.5: Total must be non-negative
  if (typeof order.total !== 'number' || order.total < 0) {
    throw new ValidationError('Order total must be a non-negative number', 'total');
  }

  // Verify total calculation matches items
  const calculatedTotal = calculateOrderTotal(order.items);
  if (Math.abs(order.total - calculatedTotal) > 0.01) {
    throw new ValidationError(
      `Order total (${order.total}) does not match calculated total (${calculatedTotal})`,
      'total'
    );
  }
}

/**
 * Validate order item
 * @param {object} item - Order item
 * @param {number} index - Item index
 * @throws {ValidationError} If validation fails
 */
function validateOrderItem(item, index) {
  if (!item || typeof item !== 'object') {
    throw new ValidationError(`Item at index ${index} must be an object`, `items[${index}]`);
  }

  // Requirement 24.2: Quantity must be positive
  if (typeof item.quantity !== 'number' || item.quantity <= 0) {
    throw new ValidationError(
      `Item at index ${index} must have positive quantity`,
      `items[${index}].quantity`
    );
  }

  // Price must be non-negative
  if (typeof item.price !== 'number' || item.price < 0) {
    throw new ValidationError(
      `Item at index ${index} must have non-negative price`,
      `items[${index}].price`
    );
  }

  // Requirement 24.3: Validate modifiers if present
  if (item.modifiers !== undefined) {
    if (!Array.isArray(item.modifiers)) {
      throw new ValidationError(
        `Item at index ${index} modifiers must be an array`,
        `items[${index}].modifiers`
      );
    }

    // Validate each modifier
    for (let j = 0; j < item.modifiers.length; j++) {
      validateModifier(item.modifiers[j], index, j);
    }
  }
}

/**
 * Validate modifier
 * @param {object} modifier - Modifier object
 * @param {number} itemIndex - Item index
 * @param {number} modIndex - Modifier index
 * @throws {ValidationError} If validation fails
 */
function validateModifier(modifier, itemIndex, modIndex) {
  if (!modifier || typeof modifier !== 'object') {
    throw new ValidationError(
      `Modifier at items[${itemIndex}].modifiers[${modIndex}] must be an object`,
      `items[${itemIndex}].modifiers[${modIndex}]`
    );
  }

  if (!modifier.id || typeof modifier.id !== 'string') {
    throw new ValidationError(
      `Modifier at items[${itemIndex}].modifiers[${modIndex}] must have valid id`,
      `items[${itemIndex}].modifiers[${modIndex}].id`
    );
  }

  if (!modifier.name || typeof modifier.name !== 'string') {
    throw new ValidationError(
      `Modifier at items[${itemIndex}].modifiers[${modIndex}] must have valid name`,
      `items[${itemIndex}].modifiers[${modIndex}].name`
    );
  }

  if (typeof modifier.price !== 'number' || modifier.price < 0) {
    throw new ValidationError(
      `Modifier at items[${itemIndex}].modifiers[${modIndex}] must have non-negative price`,
      `items[${itemIndex}].modifiers[${modIndex}].price`
    );
  }
}

/**
 * Calculate order total from items
 * @param {Array} items - Order items
 * @returns {number} Calculated total
 */
function calculateOrderTotal(items) {
  let total = 0;

  for (const item of items) {
    // Base price * quantity
    let itemTotal = item.price * item.quantity;

    // Add modifier prices
    if (item.modifiers && Array.isArray(item.modifiers)) {
      for (const modifier of item.modifiers) {
        itemTotal += modifier.price * item.quantity;
      }
    }

    total += itemTotal;
  }

  return Math.round(total * 100) / 100; // Round to 2 decimal places
}

/**
 * Validate bill data
 * @param {object} bill - Bill object
 * @throws {ValidationError} If validation fails
 */
function validateBill(bill) {
  if (!bill || typeof bill !== 'object') {
    throw new ValidationError('Bill must be an object', null);
  }

  // Validate total
  if (typeof bill.total !== 'number' || bill.total < 0) {
    throw new ValidationError('Bill total must be a non-negative number', 'total');
  }

  // Validate payments
  if (!Array.isArray(bill.payments) || bill.payments.length === 0) {
    throw new ValidationError('Bill must have at least one payment', 'payments');
  }

  // Requirement 12.3: Maximum 2 payment methods
  if (bill.payments.length > 2) {
    throw new ValidationError('Bill cannot have more than 2 payment methods', 'payments');
  }

  // Validate each payment
  let paymentSum = 0;
  for (let i = 0; i < bill.payments.length; i++) {
    const payment = bill.payments[i];

    if (!payment || typeof payment !== 'object') {
      throw new ValidationError(`Payment at index ${i} must be an object`, `payments[${i}]`);
    }

    if (!payment.method || typeof payment.method !== 'string') {
      throw new ValidationError(
        `Payment at index ${i} must have valid method`,
        `payments[${i}].method`
      );
    }

    if (typeof payment.amount !== 'number' || payment.amount <= 0) {
      throw new ValidationError(
        `Payment at index ${i} must have positive amount`,
        `payments[${i}].amount`
      );
    }

    paymentSum += payment.amount;
  }

  // Requirement 12.5: Payment sum must equal total
  if (Math.abs(paymentSum - bill.total) > 0.01) {
    throw new ValidationError(
      `Payment sum (${paymentSum}) must equal bill total (${bill.total})`,
      'payments'
    );
  }

  // Requirement 14.1: Pending bills must have customer phone
  if (bill.status === 'pending' && (!bill.customerPhone || typeof bill.customerPhone !== 'string')) {
    throw new ValidationError(
      'Pending bills must have customer phone number',
      'customerPhone'
    );
  }
}

module.exports = {
  validateOrder,
  validateBill,
  calculateOrderTotal,
  ValidationError
};
