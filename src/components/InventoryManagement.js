import React, { useState, useEffect } from 'react';
import { 
  Package, 
  AlertTriangle, 
  ArrowUpDown, 
  Search,
  Edit,
  Save,
  X,
  FileText,
  Download,
  History
} from 'lucide-react';
import StockEditModal from './StockEditModal';
import StockHistory from './StockHistory';

const InventoryManagement = () => {
  const [inventory, setInventory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStock, setEditingStock] = useState({ isOpen: false, product: null });
  const [transferModal, setTransferModal] = useState({ open: false, product: null });
  const [loading, setLoading] = useState(false);
  const [barSettings, setBarSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' or 'history'

  useEffect(() => {
    loadInventory();
    loadBarSettings();
  }, []);

  const loadBarSettings = async () => {
    try {
      const settings = await window.electronAPI.getBarSettings();
      setBarSettings(settings);
    } catch (error) {
      console.error('Failed to load bar settings:', error);
    }
  };

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
      setEditingStock({ isOpen: false, product: null });
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

  const exportStockReport = async (reportType) => {
    try {
      setLoading(true);
      const reportData = {
        inventory: inventory.map(item => ({
          ...item,
          total_stock: item.godown_stock + item.counter_stock
        })),
        barSettings
      };
      
      const result = await window.electronAPI.exportStockReport(reportData, reportType);
      if (result.success) {
        alert(`${reportType} stock report exported successfully to ${result.filePath}`);
      } else {
        alert('Failed to export report: ' + result.error);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export stock report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inventory-management">
      <div className="page-header">
        <h1><Package size={24} /> Inventory Management</h1>
        <div className="tab-navigation">
          <button 
            className={`btn tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            <Package size={16} />
            Current Inventory
          </button>
          <button 
            className={`btn tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={16} />
            Movement History
          </button>
        </div>
      </div>

      {/* Render content based on active tab */}
      {activeTab === 'inventory' ? (
        <>
          {/* Summary Cards - Moved to top for quick access */}
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
          <h3>Inventory Investment Value</h3>
          <div className="value">
            ₹{inventory.reduce((sum, item) => sum + (item.total_stock * (item.cost || 0)), 0).toFixed(2)}
          </div>
          <small style={{ color: '#7f8c8d', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
            (At Cost Price - Money Invested)
          </small>
        </div>
        <div className="summary-card">
          <h3>Potential Revenue Value</h3>
          <div className="value">
            ₹{inventory.reduce((sum, item) => sum + (item.total_stock * (item.price || 0)), 0).toFixed(2)}
          </div>
          <small style={{ color: '#7f8c8d', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
            (At Selling Price - If All Sold)
          </small>
        </div>
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

      {/* Search Section */}
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
      
      {/* Export Section */}
      <div className="export-section" style={{ padding: '15px 30px', background: 'white', borderBottom: '1px solid #e9ecef' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
            <FileText size={16} /> Export Stock Reports
          </h4>
          <div className="export-buttons" style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => exportStockReport('godown')} 
              className="btn btn-secondary btn-sm"
              disabled={loading}
            >
              <Download size={14} />
              Godown
            </button>
            <button 
              onClick={() => exportStockReport('counter')} 
              className="btn btn-secondary btn-sm"
              disabled={loading}
            >
              <Download size={14} />
              Counter
            </button>
            <button 
              onClick={() => exportStockReport('total')} 
              className="btn btn-primary btn-sm"
              disabled={loading}
            >
              <Download size={14} />
              Total
            </button>
          </div>
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
              <th>Pricing & Profit</th>
              <th>Godown Stock</th>
              <th>Counter Stock</th>
              <th>Total Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map(item => {
              const cost = item.cost || 0;
              const price = item.price || 0;
              const profit = price - cost;
              const profitPercentage = cost > 0 ? ((profit / cost) * 100) : 0;
              
              return (
                <React.Fragment key={item.id}>
                  <tr className={item.total_stock <= item.min_stock_level ? 'low-stock' : ''}>
                    <td>
                      <div className="product-info">
                        <strong>{item.name}</strong>
                        {item.variant && (
                          <small style={{ display: 'block', color: '#667eea' }}>
                            {item.variant}
                          </small>
                        )}
                      </div>
                    </td>
                    <td>{item.sku}</td>
                    <td>{item.category || '-'}</td>
                    <td>
                      <div className="pricing-info">
                        <div style={{ fontSize: '0.85rem', marginBottom: '4px' }}>
                          <strong>Cost:</strong> ₹{cost.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.85rem', marginBottom: '4px' }}>
                          <strong>Price:</strong> ₹{price.toFixed(2)}
                        </div>
                        <div className={`profit-mini ${profit >= 0 ? 'positive' : 'negative'}`}>
                          <strong>Profit:</strong> ₹{profit.toFixed(2)}
                        </div>
                      </div>
                    </td>
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
                          onClick={() => setEditingStock({ isOpen: true, product: item })}
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
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Stock Edit Modal */}
      <StockEditModal
        product={editingStock.product}
        onSave={updateStock}
        onCancel={() => setEditingStock({ isOpen: false, product: null })}
        isOpen={editingStock.isOpen}
      />

      {/* Transfer Modal */}
      {transferModal.open && (
        <TransferModal
          product={transferModal.product}
          onClose={() => setTransferModal({ open: false, product: null })}
          onTransfer={transferStock}
        />
      )}
        </>
      ) : (
        <StockHistory />
      )}

    </div>
  );
};

export default InventoryManagement;
