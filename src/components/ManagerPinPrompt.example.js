import React, { useState } from 'react';
import ManagerPinPrompt from './ManagerPinPrompt';

/**
 * Example usage of ManagerPinPrompt component
 * 
 * This component provides manager PIN authentication with:
 * - 4-6 digit PIN input
 * - 3-attempt lockout mechanism
 * - 5-minute lockout timeout
 * - Attempts remaining display
 * - Countdown timer during lockout
 */

// Example 1: Basic usage for inventory movement
function InventoryMovementExample() {
  const [showPinPrompt, setShowPinPrompt] = useState(false);

  const handleMoveStock = () => {
    setShowPinPrompt(true);
  };

  const handlePinSuccess = (manager) => {
    console.log('Authenticated as:', manager.name, manager.role);
    setShowPinPrompt(false);
    
    // Proceed with inventory movement
    moveStockToCounter(manager.id);
  };

  const moveStockToCounter = (managerId) => {
    // Your inventory movement logic here
    console.log('Moving stock, authorized by:', managerId);
  };

  return (
    <div>
      <button onClick={handleMoveStock}>
        Move Stock to Counter
      </button>
      
      <ManagerPinPrompt
        isOpen={showPinPrompt}
        onClose={() => setShowPinPrompt(false)}
        onSuccess={handlePinSuccess}
        title="Manager Authentication Required"
      />
    </div>
  );
}

// Example 2: Custom title for different operations
function DiscountApprovalExample() {
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);

  const handleApplyDiscount = (amount) => {
    setDiscountAmount(amount);
    setShowPinPrompt(true);
  };

  const handlePinSuccess = (manager) => {
    console.log('Discount approved by:', manager.name);
    setShowPinPrompt(false);
    
    // Apply the discount
    applyDiscount(discountAmount, manager.id);
  };

  const applyDiscount = (amount, managerId) => {
    console.log(`Applying ${amount}% discount, approved by:`, managerId);
  };

  return (
    <div>
      <button onClick={() => handleApplyDiscount(20)}>
        Apply 20% Discount
      </button>
      
      <ManagerPinPrompt
        isOpen={showPinPrompt}
        onClose={() => setShowPinPrompt(false)}
        onSuccess={handlePinSuccess}
        title="Approve Discount"
      />
    </div>
  );
}

// Example 3: Handling authentication in a form
function ProtectedOperationForm() {
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [formData, setFormData] = useState({ item: '', quantity: 0 });
  const [authenticatedManager, setAuthenticatedManager] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setShowPinPrompt(true);
  };

  const handlePinSuccess = (manager) => {
    setAuthenticatedManager(manager);
    setShowPinPrompt(false);
    
    // Submit the form with manager authentication
    submitProtectedOperation(formData, manager.id);
  };

  const submitProtectedOperation = (data, managerId) => {
    console.log('Submitting:', data, 'Authorized by:', managerId);
    // Your submission logic here
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={formData.item}
          onChange={(e) => setFormData({ ...formData, item: e.target.value })}
          placeholder="Item name"
        />
        <input
          type="number"
          value={formData.quantity}
          onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
          placeholder="Quantity"
        />
        <button type="submit">Submit (Requires Manager PIN)</button>
      </form>
      
      {authenticatedManager && (
        <p>Last authorized by: {authenticatedManager.name}</p>
      )}
      
      <ManagerPinPrompt
        isOpen={showPinPrompt}
        onClose={() => setShowPinPrompt(false)}
        onSuccess={handlePinSuccess}
        title="Manager Authorization Required"
      />
    </div>
  );
}

export { InventoryMovementExample, DiscountApprovalExample, ProtectedOperationForm };
