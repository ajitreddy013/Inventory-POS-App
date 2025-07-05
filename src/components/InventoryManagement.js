import React, { useState, useEffect } from 'react';
import { 
  Package, 
  AlertTriangle, 
  ArrowUpDown, 
  Search,
  Edit,
  Save,
  X
} from 'lucide-react';

const InventoryManagement = () => {
  const [inventory, setInventory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStock, setEditingStock] = useState(null);
  const [transferModal, setTransferModal] = useState({ open: false, product: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      const inventoryData = await window.electronAPI.getInventory();
      setInventory(inventoryData);
    } catch (error) {
      console.error('Failed to load inventory:', error);
    }
  };

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const updateStock = async (productId, godownStock, counterStock) => {
    try {
      setLoading(true);
      await window.electronAPI.updateStock(productId, godownStock, counterStock);
      await loadInventory();
      setEditingStock(null);
    } catch (error) {
      console.error('Failed to update stock:', error);
      alert('Failed to update stock');
    } finally {
      setLoading(false);
    }
  };

  const transferStock = async (productId, quantity, fromLocation, toLocation) => {
    try {
      setLoading(true);
      await window.electronAPI.transferStock(productId, quantity, fromLocation, toLocation);
      await loadInventory();
      setTransferModal({ open: false, product: null });
    } catch (error) {
      console.error('Failed to transfer stock:', error);
      alert('Failed to transfer stock');
    } finally {
      setLoading(false);
    }
  };

  const StockEditForm = ({ product, onSave, onCancel }) => {
    const [godownStock, setGodownStock] = useState(product.godown_stock);
    const [counterStock, setCounterStock] = useState(product.counter_stock);

    const handleSave = () => {
      onSave(product.id, parseInt(godownStock), parseInt(counterStock));
    };

    return (
      <tr className="stock-edit-row">
        <td colSpan="8">
          <div className="stock-edit-form">
            <h4>Edit Stock for {product.name}</h4>
            <div className="form-row">
              <label>
                Godown Stock:
                <input
                  type="number"
                  value={godownStock}
                  onChange={(e) => setGodownStock(e.target.value)}
                  min="0"
                />
              </label>
              <label>
                Counter Stock:
                <input
                  type="number"
                  value={counterStock}
                  onChange={(e) => setCounterStock(e.target.value)}
                  min="0"
                />
              </label>
            </div>
            <div className="form-actions">
              <button onClick={handleSave} className="btn btn-primary">
                <Save size={16} /> Save
              </button>
              <button onClick={onCancel} className="btn btn-secondary">
                <X size={16} /> Cancel
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  const TransferModal = ({ product, onClose, onTransfer }) => {
    const [quantity, setQuantity] = useState('');
    const [fromLocation, setFromLocation] = useState('godown');
    const [toLocation, setToLocation] = useState('counter');

    const handleTransfer = () => {
      if (!quantity || quantity <= 0) {
        alert('Please enter a valid quantity');
        return;
      }

      const maxQuantity = fromLocation === 'godown' ? product.godown_stock : product.counter_stock;
      if (parseInt(quantity) > maxQuantity) {
        alert(`Insufficient stock in ${fromLocation}. Available: ${maxQuantity}`);
        return;
      }

      onTransfer(product.id, parseInt(quantity), fromLocation, toLocation);
    };

    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-header">
            <h3>Transfer Stock - {product.name}</h3>
            <button onClick={onClose} className="close-btn">
              <X size={20} />
            </button>
          </div>
          <div className="modal-content">
            <div className="current-stock">
              <p>Godown Stock: {product.godown_stock}</p>
              <p>Counter Stock: {product.counter_stock}</p>
            </div>
            <div className="transfer-form">
              <label>
                From Location:
                <select 
                  value={fromLocation} 
                  onChange={(e) => setFromLocation(e.target.value)}
                >
                  <option value="godown">Godown</option>
                  <option value="counter">Counter</option>
                </select>
              </label>
              <label>
                To Location:
                <select 
                  value={toLocation} 
                  onChange={(e) => setToLocation(e.target.value)}
                >
                  <option value={fromLocation === 'godown' ? 'counter' : 'godown'}>
                    {fromLocation === 'godown' ? 'Counter' : 'Godown'}
                  </option>
                </select>
              </label>
              <label>
                Quantity:
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="1"
                  max={fromLocation === 'godown' ? product.godown_stock : product.counter_stock}
                />
              </label>
            </div>
          </div>
          <div className="modal-actions">
            <button onClick={handleTransfer} className="btn btn-primary">
              Transfer Stock
            </button>
            <button onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  const getLowStockItems = () => {
    return inventory.filter(item => 
      (item.godown_stock + item.counter_stock) <= item.min_stock_level
    );
  };

  return (
    <div className="inventory-management">
      <div className="page-header">
        <h1><Package size={24} /> Inventory Management</h1>
      </div>

      {/* Low Stock Alert */}
      {getLowStockItems().length > 0 && (
        <div className="alert alert-warning">
          <AlertTriangle size={20} />
          <span>
            {getLowStockItems().length} item(s) are running low on stock!
          </span>
        </div>
      )}

      {/* Search */}
      <div className="search-section">
        <div className="search-input-container">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Inventory Table */}
      <div className="table-container">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Godown Stock</th>
              <th>Counter Stock</th>
              <th>Total Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map(item => (
              <React.Fragment key={item.id}>
                <tr className={item.total_stock <= item.min_stock_level ? 'low-stock' : ''}>
                  <td>
                    <div className="product-info">
                      <strong>{item.name}</strong>
                      <small>Price: ₹{item.price.toFixed(2)}</small>
                    </div>
                  </td>
                  <td>{item.sku}</td>
                  <td>{item.category || '-'}</td>
                  <td className="stock-cell">{item.godown_stock}</td>
                  <td className="stock-cell">{item.counter_stock}</td>
                  <td className="stock-cell total">{item.total_stock}</td>
                  <td>
                    {item.total_stock <= item.min_stock_level ? (
                      <span className="status low-stock">Low Stock</span>
                    ) : item.total_stock >= item.max_stock_level ? (
                      <span className="status overstock">Overstock</span>
                    ) : (
                      <span className="status normal">Normal</span>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => setEditingStock(item.id)}
                        className="btn btn-sm btn-secondary"
                        title="Edit Stock"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => setTransferModal({ open: true, product: item })}
                        className="btn btn-sm btn-primary"
                        title="Transfer Stock"
                      >
                        <ArrowUpDown size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
                {editingStock === item.id && (
                  <StockEditForm
                    product={item}
                    onSave={updateStock}
                    onCancel={() => setEditingStock(null)}
                  />
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Transfer Modal */}
      {transferModal.open && (
        <TransferModal
          product={transferModal.product}
          onClose={() => setTransferModal({ open: false, product: null })}
          onTransfer={transferStock}
        />
      )}

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <h3>Total Products</h3>
          <div className="value">{inventory.length}</div>
        </div>
        <div className="summary-card warning">
          <h3>Low Stock Items</h3>
          <div className="value">{getLowStockItems().length}</div>
        </div>
        <div className="summary-card">
          <h3>Total Inventory Value</h3>
          <div className="value">
            ₹{inventory.reduce((sum, item) => sum + (item.total_stock * item.price), 0).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryManagement;
