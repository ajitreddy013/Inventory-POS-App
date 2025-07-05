import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  FileText,
  ShoppingCart,
  User,
  Phone,
  Calculator,
  ArrowLeft,
  Clock,
  Save,
  CheckCircle,
} from "lucide-react";

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
  const [orderNotes, setOrderNotes] = useState("");
  const [kotPrinted, setKotPrinted] = useState(false);
  const [barSettings, setBarSettings] = useState(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    loadProducts();
    loadTableOrder();
    loadBarSettings();
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  const loadBarSettings = async () => {
    try {
      const settings = await window.electronAPI.getBarSettings();
      setBarSettings(settings);
    } catch (error) {
      console.error("Failed to load bar settings:", error);
    }
  };

  const loadProducts = async () => {
    try {
      const productList = await window.electronAPI.getProducts();
      setProducts(productList.filter((p) => p.counter_stock > 0));
    } catch (error) {
      console.error("Failed to load products:", error);
    }
  };

  const loadTableOrder = async () => {
    try {
      const tableOrder = await window.electronAPI.getTableOrder(table.id);
      if (tableOrder) {
        setCart(tableOrder.items || []);
        setCustomerName(tableOrder.customer_name || "");
        setCustomerPhone(tableOrder.customer_phone || "");
        setDiscount(tableOrder.discount || 0);
        setTax(tableOrder.tax || 0);
        setOrderNotes(tableOrder.notes || "");
        setKotPrinted(tableOrder.kot_printed || false);
      }
    } catch (error) {
      console.error("Failed to load table order:", error);
    }
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode && product.barcode.includes(searchTerm))
  );

  const addToCart = (product) => {
    const existingItem = cart.find((item) => item.id === product.id);

    if (existingItem) {
      if (existingItem.quantity < product.counter_stock) {
        setCart(
          cart.map((item) =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        );
      } else {
        alert("Insufficient stock!");
      }
    } else {
      setCart([
        ...cart,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          maxStock: product.counter_stock,
        },
      ]);
    }

    setSearchTerm("");
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = cart.find((item) => item.id === productId);
    if (newQuantity > product.maxStock) {
      alert("Insufficient stock!");
      return;
    }

    setCart(
      cart.map((item) =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.id !== productId));
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

    // Get today's sales count from database with retry mechanism
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Add a small delay to prevent race conditions
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const sales = await window.electronAPI.getSales({
        start: today.toISOString(),
        end: tomorrow.toISOString(),
      });

      const todaySalesCount = sales.length;
      const sequenceNumber = (todaySalesCount + 1).toString().padStart(3, "0");

      return `${day}${month}${year}${sequenceNumber}`;
    } catch (error) {
      console.error("Error getting sales count:", error);
      // Fallback to timestamp if database query fails
      const timestamp = now.getTime().toString().slice(-6);
      return `${table.name}-${timestamp}`;
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
        notes: orderNotes,
        subtotal: calculateSubtotal(),
        total: calculateTotal(),
        kot_printed: kotPrinted,
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
      console.error("Failed to save table order:", error);
      alert("Failed to save order. Please try again.");
    }
  };

  const printKOT = async () => {
    if (cart.length === 0) {
      alert("Cart is empty!");
      return;
    }

    try {
      const kotData = {
        table: table.name,
        items: cart,
        notes: orderNotes,
        timestamp: new Date().toISOString(),
      };

      const result = await window.electronAPI.printKOT(kotData);
      if (result.success) {
        setKotPrinted(true);
        alert("KOT printed successfully!");
      } else {
        alert(`KOT print failed: ${result.error}`);
      }
    } catch (error) {
      console.error("KOT print error:", error);
      alert("Failed to print KOT");
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
        notes: orderNotes,
        saleDate: new Date().toISOString(),
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

      const action = window.confirm(
        "Sale completed! Click OK to print bill, Cancel to export PDF"
      );

      if (action) {
        await printBill(saleData);
      } else {
        await exportPDF(saleData);
      }

      // Clear cart and customer info
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setDiscount(0);
      setTax(0);
      setOrderNotes("");
      setKotPrinted(false);

      await loadProducts();
      onTableUpdate({ ...table, status: "available", current_bill_amount: 0 });
    } catch (error) {
      console.error("Failed to process sale:", error);
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
      console.error("Print error:", error);
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
      console.error("PDF export error:", error);
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
                placeholder="Phone Number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="form-input"
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

            <div className="order-notes">
              <textarea
                placeholder="Order notes (special instructions)..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="notes-textarea"
                rows="3"
              />
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
                onClick={printKOT}
                disabled={cart.length === 0}
                className="btn btn-info"
              >
                <Printer size={20} />
                Print KOT
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
                    Complete Order
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

export default TablePOS;
