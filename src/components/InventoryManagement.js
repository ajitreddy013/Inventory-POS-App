import React, { useState, useEffect, useCallback } from 'react';
import { Package, Search, Plus, History, X } from 'lucide-react';

const InventoryManagement = () => {
  const [activeTab, setActiveTab] = useState('inventory');
  const [items, setItems] = useState([]);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [addStockModal, setAddStockModal] = useState({ open: false, item: null });

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.getMenuItemsWithStock();
      if (res.success) setItems(res.items);
    } catch (e) {
      console.error('Failed to load inventory:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.getPurchaseHistory();
      if (res.success) setPurchaseHistory(res.records);
    } catch (e) {
      console.error('Failed to load purchase history:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'inventory') loadItems();
    else loadHistory();
  }, [activeTab, loadItems, loadHistory]);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const foodTypeIcon = (type) => {
    if (type === 'veg') return <span style={{ color: '#27ae60', fontWeight: 700 }}>●</span>;
    if (type === 'non-veg') return <span style={{ color: '#e74c3c', fontWeight: 700 }}>●</span>;
    return null;
  };

  const formatDate = (val) => {
    if (!val) return '-';
    const d = val.toDate ? val.toDate() : new Date(val);
    return d.toLocaleString();
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
            <Package size={16} /> Stock
          </button>
          <button
            className={`btn tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={16} /> Purchase History
          </button>
        </div>
      </div>

      {activeTab === 'inventory' && (
        <>
          <div className="search-section">
            <div className="search-input-container">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search by name or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 32, textAlign: 'center' }}>Loading...</div>
          ) : (
            <div className="table-container">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Godown Stock</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {foodTypeIcon(item.foodType)}
                          <strong>{item.name}</strong>
                        </div>
                        {item.subCategory && (
                          <small style={{ color: '#888' }}>{item.subCategory}</small>
                        )}
                      </td>
                      <td>{item.category || '-'}</td>
                      <td>₹{item.price}</td>
                      <td>
                        <span style={{
                          fontWeight: 700,
                          color: item.godownStock === 0 ? '#e74c3c' : '#27ae60'
                        }}>
                          {item.godownStock}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => setAddStockModal({ open: true, item })}
                        >
                          <Plus size={14} /> Add Stock
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                        No items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center' }}>Loading...</div>
          ) : (
            <div className="table-container">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Item</th>
                    <th>Qty Added</th>
                    <th>Supplier</th>
                    <th>Cost/Unit</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseHistory.map((rec, i) => (
                    <tr key={rec.id || i}>
                      <td>{formatDate(rec.addedAt)}</td>
                      <td><strong>{rec.menuItemName}</strong></td>
                      <td>{rec.quantityAdded}</td>
                      <td>{rec.supplier || '-'}</td>
                      <td>{rec.costPerUnit ? `₹${rec.costPerUnit}` : '-'}</td>
                      <td>{rec.notes || '-'}</td>
                    </tr>
                  ))}
                  {purchaseHistory.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                        No purchase history yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {addStockModal.open && (
        <AddStockModal
          item={addStockModal.item}
          onClose={() => setAddStockModal({ open: false, item: null })}
          onSaved={() => {
            setAddStockModal({ open: false, item: null });
            loadItems();
          }}
        />
      )}
    </div>
  );
};

const AddStockModal = ({ item, onClose, onSaved }) => {
  const [qty, setQty] = useState('');
  const [supplier, setSupplier] = useState('');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const quantity = parseFloat(qty);
    if (!quantity || quantity <= 0) {
      alert('Enter a valid quantity');
      return;
    }
    setSaving(true);
    try {
      const res = await window.electronAPI.addGodownStock({
        menuItemId: item.id,
        menuItemName: item.name,
        quantityAdded: quantity,
        supplier: supplier.trim(),
        notes: notes.trim(),
        costPerUnit: costPerUnit ? parseFloat(costPerUnit) : 0
      });
      if (res.success) {
        onSaved();
      } else {
        alert('Failed: ' + res.error);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Add Godown Stock — {item.name}</h3>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        <div className="modal-content">
          <div style={{ marginBottom: 12 }}>
            <label>Quantity *</label>
            <input
              type="number"
              className="form-input"
              value={qty}
              onChange={e => setQty(e.target.value)}
              min="1"
              placeholder="e.g. 10"
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Supplier</label>
            <input
              type="text"
              className="form-input"
              value={supplier}
              onChange={e => setSupplier(e.target.value)}
              placeholder="Supplier name"
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Cost per Unit (₹)</label>
            <input
              type="number"
              className="form-input"
              value={costPerUnit}
              onChange={e => setCostPerUnit(e.target.value)}
              placeholder="0"
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Notes</label>
            <input
              type="text"
              className="form-input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes"
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Add Stock'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default InventoryManagement;
