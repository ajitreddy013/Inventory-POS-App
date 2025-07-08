import React, { useState, useEffect } from "react";
import {
  ArrowRight,
  Package,
  Search,
  Plus,
  Minus,
  CheckCircle,
  AlertCircle,
  FileText,
  Calendar,
  Clock,
} from "lucide-react";
import {
  getLocalDateString,
  getLocalDateTimeString,
  formatDateForDisplay,
  formatTimeString,
} from "../utils/dateUtils";

const DailyTransfer = () => {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [transferHistory, setTransferHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadProducts();
    loadTransferHistory();
  }, []);

  const loadTransferHistory = async () => {
    try {
      // Load transfers from last 30 days
      const now = new Date();
      const endDate = getLocalDateString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const startDate = getLocalDateString();

      const history = await window.electronAPI.getDailyTransfers({
        start: getLocalDateString(thirtyDaysAgo),
        end: endDate,
      });
      
      // Sort by created_at timestamp to ensure recent transfers appear first
      const sortedHistory = history.sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return dateB.getTime() - dateA.getTime();
      });
      
      setTransferHistory(sortedHistory);
    } catch (error) {
      console.error("Failed to load transfer history:", error);
    }
  };

  const exportTransferReport = async (transferData) => {
    try {
      const result = await window.electronAPI.exportTransferReport(
        transferData
      );
      if (result.success) {
        alert(`Transfer report exported successfully to ${result.filePath}`);
      } else {
        alert("Failed to export transfer report: " + result.error);
      }
    } catch (error) {
      console.error("Export error:", error);
      alert("Failed to export transfer report");
    }
  };

  const loadProducts = async () => {
    try {
      const inventoryData = await window.electronAPI.getInventory();
      // Only show products with godown stock
      setProducts(inventoryData.filter((item) => item.godown_stock > 0));
    } catch (error) {
      console.error("Failed to load products:", error);
    }
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToTransfers = (product) => {
    const existing = transfers.find((t) => t.id === product.id);
    if (existing) {
      setTransfers(
        transfers.map((t) =>
          t.id === product.id
            ? { ...t, quantity: Math.min(t.quantity + 1, product.godown_stock) }
            : t
        )
      );
    } else {
      setTransfers([
        ...transfers,
        {
          ...product,
          quantity: 1,
        },
      ]);
    }
  };

  const updateTransferQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      setTransfers(transfers.filter((t) => t.id !== productId));
      return;
    }

    const product = products.find((p) => p.id === productId);
    const maxQuantity = product.godown_stock;

    setTransfers(
      transfers.map((t) =>
        t.id === productId
          ? { ...t, quantity: Math.min(quantity, maxQuantity) }
          : t
      )
    );
  };

  const removeFromTransfers = (productId) => {
    setTransfers(transfers.filter((t) => t.id !== productId));
  };

  const executeTransfer = async () => {
    if (transfers.length === 0) {
      alert("No items selected for transfer");
      return;
    }

    setLoading(true);
    try {
      const transferTime = new Date();

      // Process each transfer
      for (const transfer of transfers) {
        await window.electronAPI.transferStock(
          transfer.id,
          transfer.quantity,
          "godown",
          "counter"
        );
      }

      // Save daily transfer record
      const transferRecord = {
        transfer_date: getLocalDateString(),
        total_items: transfers.length,
        total_quantity: getTotalItems(),
        items_transferred: transfers.map((t) => ({
          id: t.id,
          name: t.name,
          variant: t.variant,
          quantity: t.quantity,
          transfer_time: getLocalDateTimeString(),
        })),
      };

      await window.electronAPI.saveDailyTransfer(transferRecord);

      alert(
        `Successfully transferred ${transfers.length} items from godown to counter!`
      );

      // Clear transfers and reload products
      setTransfers([]);
      await loadProducts();
      // Reload transfer history after successful transfer
      await loadTransferHistory();
    } catch (error) {
      console.error("Failed to transfer stock:", error);
      alert("Failed to transfer stock. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getTotalItems = () => {
    return transfers.reduce((sum, transfer) => sum + transfer.quantity, 0);
  };

  return (
    <div className="daily-transfer">
      <div className="page-header">
        <h1>
          <ArrowRight size={24} /> Daily Transfer (Godown → Counter)
        </h1>
      </div>

      <div className="transfer-layout">
        {/* Left Panel - Product Selection */}
        <div className="product-panel">
          <div className="search-section">
            <div className="search-input-container">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          <div className="products-list">
            <h3>Available in Godown</h3>
            {filteredProducts.length === 0 ? (
              <p className="no-products">No products with godown stock found</p>
            ) : (
              filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="product-item"
                  onClick={() => addToTransfers(product)}
                >
                  <div className="product-info">
                    <h4>{product.name}</h4>
                    {product.variant && (
                      <span className="variant">{product.variant}</span>
                    )}
                    <p className="sku">{product.sku}</p>
                  </div>
                  <div className="stock-info">
                    <span className="godown-stock">
                      Godown: {product.godown_stock}
                    </span>
                    <span className="counter-stock">
                      Counter: {product.counter_stock}
                    </span>
                  </div>
                  <button className="add-btn">
                    <Plus size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Transfer List */}
        <div className="transfer-panel">
          <div className="transfer-header">
            <h3>Transfer List ({getTotalItems()} items)</h3>
          </div>

          <div className="transfer-items">
            {transfers.length === 0 ? (
              <div className="empty-transfer">
                <Package size={48} />
                <p>No items selected for transfer</p>
                <small>Click on products from the left to add them</small>
              </div>
            ) : (
              transfers.map((transfer) => (
                <div key={transfer.id} className="transfer-item">
                  <div className="item-info">
                    <h4>{transfer.name}</h4>
                    {transfer.variant && (
                      <span className="variant">{transfer.variant}</span>
                    )}
                    <p>Available: {transfer.godown_stock}</p>
                  </div>

                  <div className="quantity-controls">
                    <button
                      onClick={() =>
                        updateTransferQuantity(
                          transfer.id,
                          transfer.quantity - 1
                        )
                      }
                      className="qty-btn"
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      type="number"
                      value={transfer.quantity}
                      onChange={(e) =>
                        updateTransferQuantity(
                          transfer.id,
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="qty-input"
                      min="1"
                      max={transfer.godown_stock}
                    />
                    <button
                      onClick={() =>
                        updateTransferQuantity(
                          transfer.id,
                          transfer.quantity + 1
                        )
                      }
                      className="qty-btn"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromTransfers(transfer.id)}
                    className="remove-btn"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          {transfers.length > 0 && (
            <div className="transfer-actions">
              <div className="transfer-summary">
                <p>Transferring {getTotalItems()} items to counter</p>
                <small>Transfer will be saved to daily records</small>
              </div>
              <button
                onClick={executeTransfer}
                disabled={loading}
                className="btn btn-primary execute-transfer-btn"
              >
                {loading ? (
                  "Transferring..."
                ) : (
                  <>
                    <CheckCircle size={20} />
                    Execute Transfer
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions & History Section */}
      <div className="actions-and-history-section">
        <div className="quick-transfer-section">
          <h3>Quick Actions</h3>
          <div className="quick-actions">
            <button
              className="btn btn-secondary"
              onClick={() => setSearchTerm("")}
            >
              Show All Products
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setTransfers([])}
              disabled={transfers.length === 0}
            >
              Clear Transfer List
            </button>
            <button
              className="btn btn-info"
              onClick={() => setShowHistory(!showHistory)}
            >
              <Calendar size={16} />
              {showHistory ? "Hide" : "Show"} History
            </button>
          </div>
        </div>

        {/* Transfer History */}
        {showHistory && (
          <div className="transfer-history">
            <div className="history-header-section">
              <h3>Recent Transfer History</h3>
              <button
                className="btn btn-sm btn-secondary"
                onClick={loadTransferHistory}
              >
                <Clock size={14} />
                Refresh
              </button>
            </div>
            {transferHistory.length === 0 ? (
              <p className="no-history">No transfer history found</p>
            ) : (
              <div className="history-list">
                {transferHistory.map((transfer, index) => (
                  <div key={transfer.id} className={`history-item ${index === 0 ? 'latest-transfer' : ''}`}>
                    <div className="history-header">
                      <div className="transfer-date-info">
                        <h4>{formatDateForDisplay(transfer.transfer_date)}</h4>
                        {index === 0 && <span className="latest-badge">Latest</span>}
                      </div>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => exportTransferReport(transfer)}
                      >
                        <FileText size={14} />
                        Export PDF
                      </button>
                    </div>
                    <div className="history-details">
                      <span>Items: {transfer.total_items}</span>
                      <span>Quantity: {transfer.total_quantity}</span>
                      <span>
                        Time:{" "}
                        {transfer.created_at
                          ? formatTimeString(new Date(transfer.created_at))
                          : "N/A"}
                      </span>
                    </div>
                    <div className="history-items">
                      {transfer.items_transferred
                        .slice(0, 3)
                        .map((item, index) => (
                          <small key={index}>
                            {item.name}
                            {item.variant && ` (${item.variant})`} × {item.quantity}
                          </small>
                        ))}
                      {transfer.items_transferred.length > 3 && (
                        <small>
                          ...and {transfer.items_transferred.length - 3} more
                        </small>
                      )}
                    </div>
                    {transfer.items_transferred.length > 0 && (
                      <div className="transfer-timing">
                        <small>
                          <Clock size={12} />
                          Transfer completed at:{" "}
                          {transfer.items_transferred[0].transfer_time
                            ? formatTimeString(new Date(transfer.items_transferred[0].transfer_time))
                            : "N/A"}
                        </small>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


export default DailyTransfer;
