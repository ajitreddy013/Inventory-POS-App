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
  Coffee,
  Pizza,
  Salad,
  Wine,
  UtensilsCrossed,
  ChefHat,
  ChevronRight,
  Info
} from "lucide-react";
import "./DesktopOrderEntry.css";

/**
 * Desktop Order Entry Component
 * 
 * Re-designed with a professional three-column layout for high-efficiency POS operations.
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

  const handleTableSelect = async (table) => {
    setSelectedTable(table);
    setSearchTerm("");
    
    // Load existing order for this table if it exists
    if (table.currentOrderId) {
      try {
        const result = await window.electronAPI.invoke(
          "firebase:get-table-orders",
          table.id
        );
        
        if (result.success && result.orders && result.orders.length > 0) {
          const existingOrder = result.orders[0];
          
          // Load order items and mark submitted items as sent to kitchen
          const loadedItems = (existingOrder.items || []).map((item) => ({
            ...item,
            sentToKitchen: existingOrder.status === "submitted" || existingOrder.status === "preparing",
          }));
          
          setOrderItems(loadedItems);
        } else {
          setOrderItems([]);
        }
      } catch (error) {
        console.error("Error loading existing order:", error);
        setOrderItems([]);
      }
    } else {
      setOrderItems([]);
    }
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

      // Route to KOT Router
      const kotResult = await window.electronAPI.invoke(
        "firebase:route-to-kot",
        {
          orderId,
          items: orderItems,
          tableId: selectedTable.id,
          tableName: selectedTable.name,
          systemUser: "Manager",
        }
      );

      if (!kotResult.success) {
        console.warn("KOT routing failed:", kotResult.error);
      }
      
      alert("Order sent to kitchen successfully!");

      setOrderItems([]);
      setSelectedTable(null);
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

  // Helper function to get category icons
  const getCategoryIcon = (categoryName) => {
    const name = categoryName.toLowerCase();
    if (name.includes("pizza")) return <Pizza size={20} />;
    if (name.includes("coffee") || name.includes("drink") || name.includes("beverage")) return <Coffee size={20} />;
    if (name.includes("salad") || name.includes("veg")) return <Salad size={20} />;
    if (name.includes("wine") || name.includes("alcohol")) return <Wine size={20} />;
    if (name.includes("main")) return <UtensilsCrossed size={20} />;
    return <ChefHat size={20} />;
  };

  // Render table selection view
  if (!selectedTable) {
    return (
      <div className="desktop-order-entry">
        <header className="order-header">
          <div className="header-left">
            <button className="btn-back" onClick={onBack} title="Go Back">
              <ArrowLeft size={20} />
            </button>
            <h1>
              <ShoppingCart size={24} className="text-primary" />
              Desktop POS System
            </h1>
          </div>
        </header>

        <main className="table-selection">
          <h2>Floor Management</h2>
          {tablesBySection.map((section) => section.tables.length > 0 && (
            <div key={section.id} className="section-group">
              <h3>{section.name}</h3>
              <div className="tables-grid">
                {section.tables.map((table) => (
                  <div
                    key={table.id}
                    className="table-card"
                    onClick={() => handleTableSelect(table)}
                  >
                    <div className="table-name">{table.name}</div>
                    <span className={`status-badge ${table.status}`}>
                      {table.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </main>
      </div>
    );
  }

  // Render order entry view
  return (
    <div className="desktop-order-entry">
      <header className="order-header">
        <div className="header-left">
          <button className="btn-back" onClick={handleBackToTables} title="Back to Floor">
            <ArrowLeft size={20} />
          </button>
          <h1>
            Order: <span className="text-primary">{selectedTable.name}</span>
          </h1>
        </div>
        <span className={`status-badge ${selectedTable.status}`}>
          {selectedTable.status.replace('_', ' ')}
        </span>
      </header>

      <div className="order-layout">
        {/* Column 1: Categories Sidebar */}
        <aside className="categories-sidebar">
          <button
            className={`category-item ${selectedCategory === "all" ? "active" : ""}`}
            onClick={() => setSelectedCategory("all")}
          >
            <div className="category-icon"><ChefHat size={20} /></div>
            All Items
          </button>
          {categories.map((category) => (
            <button
              key={category}
              className={`category-item ${selectedCategory === category ? "active" : ""}`}
              onClick={() => setSelectedCategory(category)}
            >
              <div className="category-icon">{getCategoryIcon(category)}</div>
              {category}
            </button>
          ))}
        </aside>

        {/* Column 2: Items Gallery */}
        <main className="items-panel">
          <div className="search-container">
            <Search className="search-icon" size={20} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search dishes, drinks or codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="items-grid">
            {filteredMenuItems.map((item) => (
              <div
                key={item.id}
                className="item-card"
                onClick={() => handleAddMenuItem(item)}
              >
                <div>
                  <div className="item-footer" style={{ marginBottom: '0.5rem' }}>
                    <span className="item-tag">{item.category}</span>
                    <Info size={16} className="text-muted" />
                  </div>
                  <h4>{item.name}</h4>
                  {item.description && (
                    <p className="item-desc">{item.description}</p>
                  )}
                </div>
                <div className="item-footer">
                  <span className="item-price">₹{item.price.toFixed(2)}</span>
                  <Plus size={20} className="text-primary" />
                </div>
              </div>
            ))}
            {filteredMenuItems.length === 0 && (
              <div className="empty-state" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem' }}>
                <Search size={48} className="text-muted" style={{ marginBottom: '1rem' }} />
                <p className="text-muted">No items found matching your search.</p>
              </div>
            )}
          </div>
        </main>

        {/* Column 3: Billing Area */}
        <aside className="billing-panel">
          <div className="billing-header">
            <h2><ShoppingCart size={22} className="text-primary" /> Current Order</h2>
          </div>

          <div className="billing-items">
            {orderItems.length === 0 ? (
              <div className="empty-state" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <ShoppingCart size={32} className="text-muted" style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <p className="text-muted">Selection is empty.</p>
                <p className="text-muted" style={{ fontSize: '0.8rem' }}>Select items from the list to start billing.</p>
              </div>
            ) : (
              orderItems.map((item) => (
                <div key={item.id} className={`order-item-row ${item.sentToKitchen ? 'sent-to-kitchen' : ''}`}>
                  <div className="row-main">
                    <div>
                      <span className="row-title">{item.menuItemName}</span>
                      {item.sentToKitchen && (
                        <span className="sent-badge" style={{ marginLeft: '0.5rem', background: '#f59e0b', color: 'white', fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>SENT</span>
                      )}
                      {item.modifiers.length > 0 && (
                        <div className="item-modifiers" style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                          {item.modifiers.map((mod, idx) => (
                            <span key={idx} style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              • {mod.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="row-title">₹{item.totalPrice.toFixed(2)}</span>
                  </div>
                  
                  <div className="row-controls">
                    <div className="qty-pill">
                      <button
                        className="btn-qty"
                        onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, item.quantity - 1); }}
                        disabled={item.sentToKitchen}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="qty-val">{item.quantity}</span>
                      <button
                        className="btn-qty"
                        onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, item.quantity + 1); }}
                        disabled={item.sentToKitchen}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    
                    <button
                      className="btn-remove"
                      onClick={(e) => { e.stopPropagation(); removeFromOrder(item.id); }}
                      disabled={item.sentToKitchen}
                      title="Remove Item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="billing-summary">
            <div className="summary-row">
              <span>Subtotal</span>
              <span>₹{calculateTotal().toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Taxes</span>
              <span>₹0.00</span>
            </div>
            <div className="summary-total">
              <span>Total</span>
              <span>₹{calculateTotal().toFixed(2)}</span>
            </div>
          </div>

          <div className="action-area">
            <button
              className="btn-large btn-send"
              onClick={sendToKitchen}
              disabled={orderItems.length === 0 || loading}
            >
              {loading ? "Sending..." : (
                <>
                  <Send size={20} />
                  Send to Kitchen
                </>
              )}
            </button>
          </div>
        </aside>
      </div>

      {/* Modifier Selection Modal */}
      {showModifierModal && selectedMenuItem && (
        <div className="modal-overlay" onClick={closeModifierModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Customize: {selectedMenuItem.name}</h2>
              <button className="btn-back" style={{ width: '32px', height: '32px' }} onClick={closeModifierModal}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              <div className="modifiers-list" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
                      style={{ 
                        padding: '0.75rem', 
                        borderRadius: '8px', 
                        cursor: 'pointer', 
                        transition: 'var(--transition)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{modifier.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{modifier.price > 0 ? `+₹${modifier.price}` : 'Free'}</div>
                      </div>
                      {selectedModifiers.find((m) => m.id === modifier.id) && <ChevronRight size={16} className="text-primary" />}
                    </div>
                  ))}
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                className="btn-large" 
                style={{ background: '#e2e8f0', color: '#0f172a', fontSize: '0.9rem', padding: '0.6rem 1.2rem', width: 'auto' }} 
                onClick={closeModifierModal}
              >
                Cancel
              </button>
              <button 
                className="btn-large btn-send" 
                style={{ fontSize: '0.9rem', padding: '0.6rem 1.2rem', width: 'auto' }} 
                onClick={confirmAddWithModifiers}
              >
                Add Option
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesktopOrderEntry;
