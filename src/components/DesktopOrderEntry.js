import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  ArrowLeft,
  Send,
  X,
} from "lucide-react";
import "./DesktopOrderEntry.css";

/**
 * Desktop Order Entry Component
 * 
 * Allows managers to create orders directly from the desktop application.
 * Supports table selection, menu browsing, order item management, and sending to kitchen.
 * 
 * Requirements: 27.1-27.10
 */
const DesktopOrderEntry = ({ onBack }) => {
  // State management
  const [tables, setTables] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modifiers, setModifiers] = useState([]);
  const [showModifierModal, setShowModifierModal] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [selectedModifiers, setSelectedModifiers] = useState([]);
  const searchInputRef = useRef(null);

  // Load initial data
  useEffect(() => {
    loadSections();
    loadTables();
    loadMenuItems();
    loadModifiers();
  }, []);

  // Focus search input when table is selected
  useEffect(() => {
    if (selectedTable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [selectedTable]);

  const loadSections = async () => {
    try {
      const result = await window.electronAPI.invoke("firebase:get-sections");
      if (result.success) {
        setSections(result.sections || []);
      }
    } catch (error) {
      console.error("Error loading sections:", error);
    }
  };

  const loadTables = async () => {
    try {
      const result = await window.electronAPI.invoke("firebase:get-tables");
      if (result.success) {
        setTables(result.tables || []);
      }
    } catch (error) {
      console.error("Error loading tables:", error);
    }
  };

  const loadMenuItems = async () => {
    try {
      const result = await window.electronAPI.invoke("firebase:get-menu-items", {
        includeInactive: false,
      });
      if (result.success) {
        const items = result.items || [];
        setMenuItems(items);
        
        // Extract unique categories
        const uniqueCategories = [...new Set(items.map((item) => item.category))];
        setCategories(uniqueCategories);
      }
    } catch (error) {
      console.error("Error loading menu items:", error);
    }
  };

  const loadModifiers = async () => {
    try {
      const result = await window.electronAPI.invoke("firebase:get-modifiers");
      if (result.success) {
        setModifiers(result.modifiers || []);
      }
    } catch (error) {
      console.error("Error loading modifiers:", error);
    }
  };

  const handleTableSelect = (table) => {
    setSelectedTable(table);
    setOrderItems([]);
    setSearchTerm("");
  };

  const handleBackToTables = () => {
    setSelectedTable(null);
    setOrderItems([]);
    setSearchTerm("");
  };

  const openModifierModal = (menuItem) => {
    setSelectedMenuItem(menuItem);
    setSelectedModifiers([]);
    setShowModifierModal(true);
  };

  const closeModifierModal = () => {
    setShowModifierModal(false);
    setSelectedMenuItem(null);
    setSelectedModifiers([]);
  };

  const toggleModifier = (modifier) => {
    setSelectedModifiers((prev) => {
      const exists = prev.find((m) => m.id === modifier.id);
      if (exists) {
        return prev.filter((m) => m.id !== modifier.id);
      } else {
        return [...prev, modifier];
      }
    });
  };

  const addToOrder = (menuItem, modifiersToApply = []) => {
    const newItem = {
      id: `${menuItem.id}_${Date.now()}`,
      menuItemId: menuItem.id,
      menuItemName: menuItem.name,
      quantity: 1,
      basePrice: menuItem.price,
      modifiers: modifiersToApply.map((m) => ({
        modifierId: m.id,
        name: m.name,
        price: m.price,
      })),
      totalPrice: menuItem.price + modifiersToApply.reduce((sum, m) => sum + m.price, 0),
      sentToKitchen: false,
    };

    setOrderItems([...orderItems, newItem]);
    setSearchTerm("");
    
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleAddMenuItem = (menuItem) => {
    // Check if menu item has available modifiers
    if (menuItem.availableModifiers && menuItem.availableModifiers.length > 0) {
      openModifierModal(menuItem);
    } else {
      addToOrder(menuItem, []);
    }
  };

  const confirmAddWithModifiers = () => {
    if (selectedMenuItem) {
      addToOrder(selectedMenuItem, selectedModifiers);
      closeModifierModal();
    }
  };

  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromOrder(itemId);
      return;
    }

    setOrderItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: newQuantity,
              totalPrice:
                (item.basePrice + item.modifiers.reduce((sum, m) => sum + m.price, 0)) *
                newQuantity,
            }
          : item
      )
    );
  };

  const removeFromOrder = (itemId) => {
    setOrderItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const sendToKitchen = async () => {
    if (orderItems.length === 0) {
      alert("Order is empty!");
      return;
    }

    if (!selectedTable) {
      alert("No table selected!");
      return;
    }

    setLoading(true);
    try {
      // Create order in Firestore
      const orderData = {
        tableId: selectedTable.id,
        tableName: selectedTable.name,
        items: orderItems,
        status: "draft",
        createdBy: "desktop",
        systemUser: "Manager",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const createResult = await window.electronAPI.invoke(
        "firebase:create-order",
        orderData
      );

      if (!createResult.success) {
        throw new Error(createResult.error || "Failed to create order");
      }

      const orderId = createResult.orderId;

      // Submit order (send to kitchen)
      const submitResult = await window.electronAPI.invoke(
        "firebase:submit-order",
        orderId
      );

      if (!submitResult.success) {
        throw new Error(submitResult.error || "Failed to submit order");
      }

      // TODO: Route to KOT Router (Task 4.1 - not yet implemented)
      // For now, we'll just mark items as sent to kitchen
      
      alert("Order sent to kitchen successfully!");

      // Clear order and go back to table selection
      setOrderItems([]);
      setSelectedTable(null);
      
      // Reload tables to update status
      await loadTables();
    } catch (error) {
      console.error("Error sending order to kitchen:", error);
      alert(`Failed to send order: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter menu items
  const filteredMenuItems = menuItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory =
      selectedCategory === "all" || item.category === selectedCategory;
    
    const notOutOfStock = !item.isOutOfStock;

    return matchesSearch && matchesCategory && notOutOfStock;
  });

  // Group tables by section
  const tablesBySection = sections.map((section) => ({
    ...section,
    tables: tables.filter((table) => table.sectionId === section.id),
  }));

  // Render table selection view
  if (!selectedTable) {
    return (
      <div className="desktop-order-entry">
        <div className="order-header">
          <button className="btn btn-secondary" onClick={onBack}>
            <ArrowLeft size={20} />
            Back
          </button>
          <h1>
            <ShoppingCart size={24} />
            Desktop Order Entry
          </h1>
        </div>

        <div className="table-selection">
          <h2>Select a Table</h2>
          {tablesBySection.map((section) => (
            <div key={section.id} className="section-group">
              <h3>{section.name}</h3>
              <div className="tables-grid">
                {section.tables.map((table) => (
                  <div
                    key={table.id}
                    className={`table-card ${table.status}`}
                    onClick={() => handleTableSelect(table)}
                  >
                    <div className="table-name">{table.name}</div>
                    <div className={`table-status ${table.status}`}>
                      {table.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Render order entry view
  return (
    <div className="desktop-order-entry">
      <div className="order-header">
        <div className="header-left">
          <button className="btn btn-secondary" onClick={handleBackToTables}>
            <ArrowLeft size={20} />
            Back to Tables
          </button>
          <h1>
            <ShoppingCart size={24} />
            {selectedTable.name}
          </h1>
        </div>
        <div className="header-right">
          <div className="table-status">
            Status:{" "}
            <span className={`status-badge ${selectedTable.status}`}>
              {selectedTable.status}
            </span>
          </div>
        </div>
      </div>

      <div className="order-layout">
        {/* Left Panel - Menu Browser */}
        <div className="menu-panel">
          <div className="search-section">
            <div className="search-input-container">
              <Search size={20} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search menu items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          <div className="category-tabs">
            <button
              className={`category-tab ${selectedCategory === "all" ? "active" : ""}`}
              onClick={() => setSelectedCategory("all")}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                className={`category-tab ${selectedCategory === category ? "active" : ""}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="menu-items-grid">
            {filteredMenuItems.map((item) => (
              <div
                key={item.id}
                className="menu-item-card"
                onClick={() => handleAddMenuItem(item)}
              >
                <div className="menu-item-info">
                  <h3>{item.name}</h3>
                  {item.description && (
                    <p className="menu-item-description">{item.description}</p>
                  )}
                  <p className="menu-item-price">₹{item.price.toFixed(2)}</p>
                  <p className="menu-item-category">{item.category}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Order Items */}
        <div className="order-panel">
          <div className="order-section">
            <h3>
              <ShoppingCart size={20} /> Order Items ({orderItems.length})
            </h3>

            <div className="order-items-list">
              {orderItems.length === 0 ? (
                <p className="empty-order">No items in order</p>
              ) : (
                orderItems.map((item) => (
                  <div key={item.id} className="order-item">
                    <div className="item-info">
                      <h4>{item.menuItemName}</h4>
                      <p>₹{item.basePrice.toFixed(2)} base</p>
                      {item.modifiers.length > 0 && (
                        <div className="item-modifiers">
                          {item.modifiers.map((mod, idx) => (
                            <span key={idx} className="modifier-tag">
                              {mod.name}
                              {mod.price > 0 && ` (+₹${mod.price.toFixed(2)})`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="quantity-controls">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="qty-btn"
                        disabled={item.sentToKitchen}
                      >
                        <Minus size={16} />
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(item.id, parseInt(e.target.value) || 0)
                        }
                        className="qty-input"
                        min="1"
                        disabled={item.sentToKitchen}
                      />
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="qty-btn"
                        disabled={item.sentToKitchen}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="item-total">
                      ₹{item.totalPrice.toFixed(2)}
                    </div>
                    <button
                      onClick={() => removeFromOrder(item.id)}
                      className="remove-btn"
                      disabled={item.sentToKitchen}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="order-summary">
            <div className="summary-line total">
              <span>Total:</span>
              <span>₹{calculateTotal().toFixed(2)}</span>
            </div>
          </div>

          <div className="action-buttons">
            <button
              onClick={sendToKitchen}
              disabled={orderItems.length === 0 || loading}
              className="btn btn-primary send-to-kitchen-btn"
            >
              {loading ? (
                "Sending..."
              ) : (
                <>
                  <Send size={20} />
                  Send to Kitchen
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modifier Selection Modal */}
      {showModifierModal && selectedMenuItem && (
        <div className="modal-overlay" onClick={closeModifierModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Select Modifiers for {selectedMenuItem.name}</h2>
              <button className="close-btn" onClick={closeModifierModal}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div className="modifiers-list">
                {modifiers
                  .filter((m) =>
                    selectedMenuItem.availableModifiers?.includes(m.id)
                  )
                  .map((modifier) => (
                    <div
                      key={modifier.id}
                      className={`modifier-option ${
                        selectedModifiers.find((m) => m.id === modifier.id)
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => toggleModifier(modifier)}
                    >
                      <div className="modifier-info">
                        <span className="modifier-name">{modifier.name}</span>
                        <span className="modifier-type">
                          {modifier.type === "spice_level"
                            ? "Spice Level"
                            : "Add-on"}
                        </span>
                      </div>
                      <div className="modifier-price">
                        {modifier.price > 0
                          ? `+₹${modifier.price.toFixed(2)}`
                          : "Free"}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModifierModal}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmAddWithModifiers}
              >
                Add to Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesktopOrderEntry;
