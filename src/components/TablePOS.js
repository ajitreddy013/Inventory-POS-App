import React, { useState, useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  User,
  Calculator,
  ArrowLeft,
  Clock,
  Save,
} from "lucide-react";
import { getLocalDateTimeString } from "../utils/dateUtils";
import { addPendingBill } from "../services/billService";

const TablePOS = ({ table, onBack, onTableUpdate }) => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [loading, setLoading] = useState(false);
  const [barSettings, setBarSettings] = useState(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const searchInputRef = useRef(null);

  const loadTableOrder = useCallback(async () => {
    try {
      const tableOrder = await window.electronAPI.getTableOrder(table.id);
      if (tableOrder) {
        setCart(tableOrder.items || []);
        setCustomerName(tableOrder.customer_name || "");
        setCustomerPhone(tableOrder.customer_phone || "");
        setDiscount(tableOrder.discount || 0);
        setTax(tableOrder.tax || 0);
      }
    } catch (error) {
      // Failed to load table order
      setCart([]);
    }
  }, [table.id]);

  useEffect(() => {
    loadProducts();
    loadTableOrder();
    loadBarSettings();
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [loadTableOrder]);

  const loadBarSettings = async () => {
    try {
      const settings = await window.electronAPI.getBarSettings();
      setBarSettings(settings);
    } catch (error) {
      // Failed to load bar settings
      setBarSettings(null);
    }
  };

  const loadProducts = async () => {
    try {
      const productList = await window.electronAPI.getProducts();
      setProducts(productList.filter((p) => p.counter_stock > 0));
    } catch (error) {
      // Failed to load products
      setProducts([]);
    }
  };


  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode && product.barcode.includes(searchTerm))
  );

  const addToCart = async (product) => {
    const existingItem = cart.find((item) => item.id === product.id);
    let newCart;

    if (existingItem) {
      if (existingItem.quantity < product.counter_stock) {
        newCart = cart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
        setCart(newCart);
      } else {
        alert("Insufficient stock!");
        return;
      }
    } else {
      newCart = [
        ...cart,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          maxStock: product.counter_stock,
        },
      ];
      setCart(newCart);
    }

    // Auto-save the order after adding product
    await autoSaveOrder(newCart);

    setSearchTerm("");
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const autoSaveOrder = async (currentCart) => {
    setAutoSaving(true);
    try {
      const subtotal = currentCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const taxAmount = (subtotal * tax) / 100;
      const discountAmount = (subtotal * discount) / 100;
      const total = subtotal + taxAmount - discountAmount;

      const orderData = {
        table_id: table.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        items: currentCart,
        discount,
        tax,
        notes: "",
        subtotal,
        total,
        kot_printed: false,
      };

      await window.electronAPI.saveTableOrder(orderData);

      // Update table status
      const tableUpdate = {
        status: currentCart.length > 0 ? "occupied" : "available",
        current_bill_amount: total,
      };

      await window.electronAPI.updateTable(table.id, tableUpdate);
      onTableUpdate({ ...table, ...tableUpdate });
    } catch (error) {
      // Failed to auto-save order
    } finally {
      setAutoSaving(false);
    }
  };

  const updateQuantity = async (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = cart.find((item) => item.id === productId);
    if (newQuantity > product.maxStock) {
      alert("Insufficient stock!");
      return;
    }

    const newCart = cart.map((item) =>
      item.id === productId ? { ...item, quantity: newQuantity } : item
    );
    setCart(newCart);

    // Auto-save the order after updating quantity
    await autoSaveOrder(newCart);
  };

  const removeFromCart = async (productId) => {
    const newCart = cart.filter((item) => item.id !== productId);
    setCart(newCart);

    // Auto-save the order after removing item
    await autoSaveOrder(newCart);
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const calculateTaxAmount = () => {
    return (calculateSubtotal() * tax) / 100;
  };

  const calculateDiscountAmount = () => {
    return (calculateSubtotal() * discount) / 100;
  };

  const calculateTotal = () => {
    return (
      calculateSubtotal() + calculateTaxAmount() - calculateDiscountAmount()
    );
  };

  const generateSaleNumber = async () => {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, "0");
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const year = now.getFullYear().toString().slice(-2);

    // Generate a random 3-digit number
    const randomNum = Math.floor(Math.random() * 900) + 100; // 100-999

    return `${day}${month}${year}${randomNum}`;
  };

  const savePendingBill = async () => {
    if (cart.length === 0) {
      alert("Cart is empty!");
      return;
    }

    // Validate required fields for pending bills
    const errors = [];
    
    if (!customerName || customerName.trim() === "") {
      errors.push("Customer name");
    }

    if (!customerPhone || customerPhone.trim() === "") {
      errors.push("Customer phone number");
    } else if (customerPhone.trim().length !== 10 || !/^\d{10}$/.test(customerPhone.trim())) {
      alert("Phone number must be exactly 10 digits!");
      return;
    }

    if (errors.length > 0) {
      alert(`${errors.join(" and ")} ${errors.length > 1 ? 'are' : 'is'} mandatory for pending bills!`);
      return;
    }

    setLoading(true);
    try {
      const billData = {
        billNumber: await generateSaleNumber(),
        saleType: "table",
        tableNumber: table.name,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        items: cart.map((item) => ({
          productId: item.id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.price * item.quantity,
        })),
        subtotal: calculateSubtotal(),
        taxAmount: calculateTaxAmount(),
        discountAmount: calculateDiscountAmount(),
        totalAmount: calculateTotal(),
        paymentMethod,
        notes: "",
      };

      await addPendingBill(billData);
      alert("Bill saved as pending!");

      // Clear cart and customer info
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setDiscount(0);
      setTax(0);
      
      // Clear table order
      await window.electronAPI.clearTableOrder(table.id);
      
      // Update table status
      await window.electronAPI.updateTable(table.id, {
        status: "available",
        current_bill_amount: 0,
      });
      
      onTableUpdate({ ...table, status: "available", current_bill_amount: 0 });
    } catch (error) {
      // Failed to save pending bill
      alert("Failed to save pending bill. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const saveTableOrder = async () => {
    try {
      const orderData = {
        table_id: table.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        items: cart,
        discount,
        tax,
        notes: "",
        subtotal: calculateSubtotal(),
        total: calculateTotal(),
        kot_printed: false,
      };

      await window.electronAPI.saveTableOrder(orderData);

      // Update table status
      const tableUpdate = {
        status: cart.length > 0 ? "occupied" : "available",
        current_bill_amount: calculateTotal(),
      };

      await window.electronAPI.updateTable(table.id, tableUpdate);
      onTableUpdate({ ...table, ...tableUpdate });

      alert("Order saved successfully!");
    } catch (error) {
      // Failed to save table order
      alert("Failed to save order. Please try again.");
    }
  };


  const processSale = async () => {
    if (cart.length === 0) {
      alert("Cart is empty!");
      return;
    }

    setLoading(true);
    try {
      const saleData = {
        saleNumber: await generateSaleNumber(),
        tableId: table.id,
        tableName: table.name,
        customerName: customerName || "Table Customer",
        customerPhone,
        items: cart.map((item) => ({
          productId: item.id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.price * item.quantity,
        })),
        subtotal: calculateSubtotal(),
        taxAmount: calculateTaxAmount(),
        discountAmount: calculateDiscountAmount(),
        totalAmount: calculateTotal(),
        paymentMethod,
        notes: "",
        saleDate: getLocalDateTimeString(),
        barSettings,
      };

      await window.electronAPI.createSale(saleData);

      // Clear table order
      await window.electronAPI.clearTableOrder(table.id);

      // Update table status
      await window.electronAPI.updateTable(table.id, {
        status: "available",
        current_bill_amount: 0,
      });

      // Directly print the bill without asking for PDF option
      await printBill(saleData);

      // Clear cart and customer info
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setDiscount(0);
      setTax(0);

      await loadProducts();
      onTableUpdate({ ...table, status: "available", current_bill_amount: 0 });

      // Trigger dashboard refresh by dispatching a custom event
      window.dispatchEvent(new CustomEvent("saleCompleted"));
    } catch (error) {
      // Failed to process sale
      alert("Failed to process sale. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const printBill = async (billData) => {
    try {
      const result = await window.electronAPI.printBill(billData);
      if (result.success) {
        alert("Bill printed successfully!");
      } else {
        alert(`Print failed: ${result.error}`);
      }
    } catch (error) {
      // Print error
      alert("Failed to print bill");
    }
  };

  const exportPDF = async (billData) => {
    try {
      const result = await window.electronAPI.exportPDF(billData);
      if (result.success) {
        alert(`PDF saved to: ${result.filePath}`);
      } else {
        alert(`PDF export failed: ${result.error}`);
      }
    } catch (error) {
      // PDF export error
      alert("Failed to export PDF");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && filteredProducts.length > 0) {
      addToCart(filteredProducts[0]);
    }
  };

  return (
    <div className="table-pos">
      <div className="pos-header">
        <div className="header-left">
          <button className="btn btn-secondary" onClick={onBack}>
            <ArrowLeft size={20} />
            Back to Tables
          </button>
          <h1>
            <ShoppingCart size={24} />
            {table.name} - {table.area === "restaurant" ? "Restaurant" : "Bar"}
          </h1>
        </div>
        <div className="header-right">
          <div className="table-status">
            Status:{" "}
            <span className={`status-badge ${table.status}`}>
              {table.status}
            </span>
          </div>
          {autoSaving && (
            <div className="auto-save-indicator">
              <Save size={16} className="spinning" />
              <span>Auto-saving...</span>
            </div>
          )}
        </div>
      </div>

      <div className="pos-layout">
        {/* Left Panel - Product Search and Selection */}
        <div className="product-panel">
          <div className="search-section">
            <div className="search-input-container">
              <Search size={20} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search products by name, SKU, or barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                className="search-input"
              />
            </div>
          </div>

          <div className="products-grid">
            {filteredProducts.slice(0, 12).map((product) => (
              <div
                key={product.id}
                className="product-card"
                onClick={() => addToCart(product)}
              >
                <div className="product-info">
                  <h3>{product.name}</h3>
                  <p className="product-sku">{product.sku}</p>
                  <p className="product-price">₹{product.price.toFixed(2)}</p>
                  <p className="product-stock">
                    Stock: {product.counter_stock}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Cart and Billing */}
        <div className="cart-panel">
          <div className="customer-section">
            <h3>
              <User size={20} /> Customer Information
            </h3>
            <div className="form-row">
              <input
                type="text"
                placeholder="Customer Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="form-input"
              />
              <input
                type="tel"
                placeholder="Phone Number (10 digits)"
                value={customerPhone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
                  if (value.length <= 10) {
                    setCustomerPhone(value);
                  }
                }}
                className="form-input"
                maxLength="10"
              />
            </div>
          </div>

          <div className="cart-section">
            <h3>
              <ShoppingCart size={20} /> Order ({cart.length} items)
            </h3>

            <div className="cart-items">
              {cart.length === 0 ? (
                <p className="empty-cart">Cart is empty</p>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="cart-item">
                    <div className="item-info">
                      <h4>{item.name}</h4>
                      <p>₹{item.price.toFixed(2)} each</p>
                    </div>
                    <div className="quantity-controls">
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                        className="qty-btn"
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
                        max={item.maxStock}
                      />
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                        className="qty-btn"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="item-total">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="remove-btn"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

          </div>

          <div className="billing-section">
            <div className="billing-controls">
              <div className="form-row">
                <label>
                  Discount (%)
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) =>
                      setDiscount(parseFloat(e.target.value) || 0)
                    }
                    min="0"
                    max="100"
                    className="form-input small"
                  />
                </label>
                <label>
                  Tax (%)
                  <input
                    type="number"
                    value={tax}
                    onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                    min="0"
                    max="100"
                    className="form-input small"
                  />
                </label>
              </div>

              <label>
                Payment Method
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="form-input"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                </select>
              </label>
            </div>

            <div className="bill-summary">
              <div className="summary-line">
                <span>Subtotal:</span>
                <span>₹{calculateSubtotal().toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="summary-line discount">
                  <span>Discount ({discount}%):</span>
                  <span>-₹{calculateDiscountAmount().toFixed(2)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="summary-line tax">
                  <span>Tax ({tax}%):</span>
                  <span>₹{calculateTaxAmount().toFixed(2)}</span>
                </div>
              )}
              <div className="summary-line total">
                <span>Total:</span>
                <span>₹{calculateTotal().toFixed(2)}</span>
              </div>
            </div>

            <div className="action-buttons">
              <button
                onClick={saveTableOrder}
                disabled={cart.length === 0}
                className="btn btn-secondary"
              >
                <Save size={20} />
                Save Order
              </button>

              <button
                onClick={savePendingBill}
                disabled={cart.length === 0 || loading}
                className="btn btn-secondary save-pending-btn"
              >
                {loading ? (
                  "Saving..."
                ) : (
                  <>
                    <Clock size={20} />
                    Save as Pending
                  </>
                )}
              </button>

              <button
                onClick={processSale}
                disabled={cart.length === 0 || loading}
                className="btn btn-primary process-sale-btn"
              >
                {loading ? (
                  "Processing..."
                ) : (
                  <>
                    <Calculator size={20} />
                    Process Sale
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


TablePOS.propTypes = {
  table: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    area: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
  }).isRequired,
  onBack: PropTypes.func.isRequired,
  onTableUpdate: PropTypes.func.isRequired,
};

export default TablePOS;
