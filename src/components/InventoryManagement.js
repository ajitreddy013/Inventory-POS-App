import React, { useState, useEffect, useCallback } from 'react';
import { Package, Search, Plus, History, X } from 'lucide-react';

// Handles Firestore Admin SDK timestamps: { _seconds, _nanoseconds }, { seconds, nanoseconds }, .toDate(), or ISO string
function parseTimestamp(val) {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val._seconds != null) return new Date(val._seconds * 1000);
  if (val.seconds != null) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d) ? null : d;
}

function formatTime(val) {
  const d = parseTimestamp(val);
  if (!d) return '-';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateLabel(val) {
  const d = parseTimestamp(val);
  if (!d) return 'Unknown Date';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function toDateKey(val) {
  const d = parseTimestamp(val);
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

// Group records by date, sorted newest date first, each group sorted by time asc
function groupByDate(records) {
  const map = {};
  for (const rec of records) {
    const key = toDateKey(rec.addedAt);
    if (!map[key]) map[key] = { key, label: formatDateLabel(rec.addedAt), items: [] };
    map[key].items.push(rec);
  }
  // sort each group by time asc
  for (const g of Object.values(map)) {
    g.items.sort((a, b) => {
      const da = parseTimestamp(a.addedAt);
      const db = parseTimestamp(b.addedAt);
      return (da || 0) - (db || 0);
    });
  }
  // sort groups newest first
  return Object.values(map).sort((a, b) => b.key.localeCompare(a.key));
}

const InventoryManagement = () => {
  const [activeTab, setActiveTab] = useState('bar');
  const [items, setItems] = useState([]);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [addStockModal, setAddStockModal] = useState({ open: false, item: null });

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await window.electronAPI.getPurchaseHistory();
      if (res.success) {
        const suppliers = [...new Set(res.records.map(r => r.supplier).filter(Boolean))];
        setAllSuppliers(suppliers);
      }
    } catch (e) { /* silent */ }
  }, []);

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
      if (res.success) {
        setPurchaseHistory(res.records);
        const suppliers = [...new Set(res.records.map(r => r.supplier).filter(Boolean))];
        setAllSuppliers(suppliers);
      }
    } catch (e) {
      console.error('Failed to load purchase history:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // load suppliers on mount so autofill works immediately
  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
    else loadItems();
  }, [activeTab, loadItems, loadHistory]);

  const restaurantItems = items.filter(item => !item.isBarItem);
  const barItems = items.filter(item => item.isBarItem);

  const visibleItems = (activeTab === 'bar' ? barItems : restaurantItems).filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredHistory = filterDate
    ? purchaseHistory.filter(r => toDateKey(r.addedAt) === filterDate)
    : purchaseHistory;

  const groupedHistory = groupByDate(filteredHistory);

  const foodTypeIcon = (type) => {
    if (type === 'veg') return <span style={{ color: '#27ae60', fontWeight: 700 }}>●</span>;
    if (type === 'non-veg') return <span style={{ color: '#e74c3c', fontWeight: 700 }}>●</span>;
    return null;
  };

  return (
    <div className="inventory-management">
      <div className="page-header">
        <h1><Package size={24} /> Inventory Management</h1>
        <div className="tab-navigation">
          <button
            className={`btn tab-btn ${activeTab === 'bar' ? 'active' : ''}`}
            onClick={() => { setActiveTab('bar'); setSearchTerm(''); }}
          >
            Bar
          </button>
          <button
            className={`btn tab-btn ${activeTab === 'restaurant' ? 'active' : ''}`}
            onClick={() => { setActiveTab('restaurant'); setSearchTerm(''); }}
          >
            Restaurant
          </button>
          <button
            className={`btn tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => { setActiveTab('history'); setSearchTerm(''); }}
          >
            <History size={16} /> Purchase History
          </button>
        </div>
      </div>

      {(activeTab === 'restaurant' || activeTab === 'bar') && (
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
                  {visibleItems.map(item => (
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
                  {visibleItems.length === 0 && (
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
          <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #eee' }}>
            <label style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Filter by date:</label>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14 }}
            />
            {filterDate && (
              <button className="btn btn-secondary btn-sm" onClick={() => setFilterDate('')}>
                Clear
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: 32, textAlign: 'center' }}>Loading...</div>
          ) : groupedHistory.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#888' }}>
              No purchase history {filterDate ? `for ${filterDate}` : 'yet'}
            </div>
          ) : (
            <div style={{ padding: '0 24px 24px' }}>
              {groupedHistory.map(group => (
                <div key={group.key} style={{ marginTop: 24 }}>
                  {/* Date header */}
                  <div style={{
                    background: '#f0f4ff',
                    border: '1px solid #d0d9f0',
                    borderRadius: 8,
                    padding: '8px 16px',
                    fontWeight: 700,
                    fontSize: 15,
                    color: '#3a4a8a',
                    marginBottom: 8
                  }}>
                    {group.label}
                  </div>

                  <table className="inventory-table" style={{ marginBottom: 0 }}>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Item</th>
                        <th>Qty Added</th>
                        <th>Supplier</th>
                        <th>Cost/Unit</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((rec, i) => (
                        <tr key={rec.id || i}>
                          <td style={{ whiteSpace: 'nowrap' }}>{formatTime(rec.addedAt)}</td>
                          <td><strong>{rec.menuItemName}</strong></td>
                          <td>{rec.quantityAdded}</td>
                          <td>{rec.supplier || '-'}</td>
                          <td>{rec.costPerUnit ? `₹${rec.costPerUnit}` : '-'}</td>
                          <td>{rec.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {addStockModal.open && (
        <AddStockModal
          item={addStockModal.item}
          suppliers={allSuppliers}
          onClose={() => setAddStockModal({ open: false, item: null })}
          onSaved={() => {
            setAddStockModal({ open: false, item: null });
            loadItems();
            loadSuppliers();
          }}
        />
      )}
    </div>
  );
};

const AddStockModal = ({ item, suppliers, onClose, onSaved }) => {
  const [qty, setQty] = useState('');
  const [supplier, setSupplier] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [costPerUnit, setCostPerUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const suggestions = supplier.trim()
    ? suppliers.filter(s => s.toLowerCase().startsWith(supplier.toLowerCase()))
    : [];

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

          <div style={{ marginBottom: 12, position: 'relative' }}>
            <label>Supplier</label>
            <input
              type="text"
              className="form-input"
              value={supplier}
              onChange={e => { setSupplier(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Supplier name"
              style={{ width: '100%', marginTop: 4 }}
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                background: '#fff', border: '1px solid #ddd', borderRadius: 6,
                listStyle: 'none', margin: 0, padding: 0, zIndex: 200,
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)', maxHeight: 160, overflowY: 'auto'
              }}>
                {suggestions.map(s => (
                  <li
                    key={s}
                    onMouseDown={() => { setSupplier(s); setShowSuggestions(false); }}
                    style={{
                      padding: '8px 12px', cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0', fontSize: 14
                    }}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
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
