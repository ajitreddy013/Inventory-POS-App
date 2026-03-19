/* eslint-disable no-console */
import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowRight,
  Package,
  Search,
  Plus,
  Minus,
  CheckCircle,
  History,
} from 'lucide-react';

// Firestore timestamp parser (handles _seconds, seconds, .toDate(), ISO string)
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
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateLabel(val) {
  const d = parseTimestamp(val);
  if (!d) return 'Unknown Date';
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function toDateKey(val) {
  const d = parseTimestamp(val);
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

function groupByDate(records) {
  const map = {};
  for (const rec of records) {
    const key = toDateKey(rec.timestamp);
    if (!map[key])
      map[key] = { key, label: formatDateLabel(rec.timestamp), items: [] };
    map[key].items.push(rec);
  }
  for (const g of Object.values(map)) {
    g.items.sort((a, b) => {
      const da = parseTimestamp(a.timestamp);
      const db = parseTimestamp(b.timestamp);
      return (da || 0) - (db || 0);
    });
  }
  return Object.values(map).sort((a, b) => b.key.localeCompare(a.key));
}

const DailyTransfer = () => {
  const [activeTab, setActiveTab] = useState('transfer');
  const [godownSection, setGodownSection] = useState('bar');
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [transferHistory, setTransferHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filterDate, setFilterDate] = useState('');

  const loadProducts = useCallback(async () => {
    try {
      const res = await window.electronAPI.getMenuItemsWithStock();
      if (res.success) {
        // only show items that have godown stock > 0
        setProducts(res.items.filter((i) => i.godownStock > 0));
      }
    } catch (e) {
      console.error('Failed to load products:', e);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await window.electronAPI.getTransferHistory();
      if (res.success) setTransferHistory(res.records);
    } catch (e) {
      console.error('Failed to load transfer history:', e);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);
  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab, loadHistory]);

  const filteredProducts = products
    .filter((p) => (godownSection === 'bar' ? p.isBarItem : !p.isBarItem))
    .filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.category || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

  const addToTransfers = (product) => {
    setTransfers((prev) => {
      const existing = prev.find((t) => t.id === product.id);
      if (existing) {
        return prev.map((t) =>
          t.id === product.id
            ? { ...t, quantity: Math.min(t.quantity + 1, product.godownStock) }
            : t
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    const product = products.find((p) => p.id === id);
    const max = product?.godownStock || 0;
    setTransfers((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, quantity: Math.max(0, Math.min(qty, max)) } : t
      )
    );
  };

  const removeFromTransfers = (id) =>
    setTransfers((prev) => prev.filter((t) => t.id !== id));

  const totalQty = transfers.reduce((s, t) => s + t.quantity, 0);

  const executeTransfer = async () => {
    if (transfers.length === 0) {
      alert('No items selected');
      return;
    }
    if (transfers.some((t) => t.quantity <= 0)) {
      alert('Some items have 0 quantity');
      return;
    }

    setLoading(true);
    try {
      const items = transfers.map((t) => ({
        menuItemId: t.id,
        menuItemName: t.name,
        quantity: t.quantity,
      }));
      const res = await window.electronAPI.transferToCounter(items);
      if (!res.success) throw new Error(res.error);
      alert(`Transferred ${transfers.length} item(s) to counter`);
      setTransfers([]);
      await loadProducts();
    } catch (e) {
      alert('Transfer failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = filterDate
    ? transferHistory.filter((r) => toDateKey(r.timestamp) === filterDate)
    : transferHistory;

  const groupedHistory = groupByDate(filteredHistory);

  const tabStyle = (key) => ({
    background: activeTab === key ? '#4f46e5' : '',
    color: activeTab === key ? '#fff' : '',
    borderColor: activeTab === key ? '#4f46e5' : '',
    fontWeight: activeTab === key ? 700 : 400,
  });

  return (
    <div className="daily-transfer">
      <div className="page-header">
        <h1>
          <ArrowRight size={24} /> Daily Transfer (Godown → Counter)
        </h1>
        <div className="tab-navigation">
          {[
            { key: 'transfer', label: 'Transfer' },
            { key: 'history', label: 'History' },
          ].map(({ key, label }) => (
            <button
              key={key}
              className="btn tab-btn"
              style={tabStyle(key)}
              onClick={() => setActiveTab(key)}
            >
              {key === 'history' && (
                <History size={15} style={{ marginRight: 4 }} />
              )}
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'transfer' && (
        <div className="transfer-layout">
          {/* Left — product list */}
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <h3 style={{ margin: 0 }}>Available in Godown</h3>
                {[
                  { key: 'bar', label: 'Bar' },
                  { key: 'restaurant', label: 'Restaurant' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    className="btn btn-sm"
                    onClick={() => setGodownSection(key)}
                    style={{
                      background: godownSection === key ? '#4f46e5' : '#f0f0f0',
                      color: godownSection === key ? '#fff' : '#333',
                      border: 'none',
                      fontWeight: godownSection === key ? 700 : 400,
                      padding: '4px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {filteredProducts.length === 0 ? (
                <p className="no-products">No items with godown stock</p>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: '1rem',
                    marginTop: 8,
                  }}
                >
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => addToTransfers(product)}
                      style={{
                        background: '#fff',
                        borderRadius: 12,
                        padding: '1.25rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'transform 0.15s, box-shadow 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        e.currentTarget.style.boxShadow =
                          '0 6px 16px rgba(0,0,0,0.12)';
                        e.currentTarget.style.borderColor = '#4f46e5';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = '';
                        e.currentTarget.style.boxShadow =
                          '0 1px 4px rgba(0,0,0,0.06)';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 15,
                          color: '#1e293b',
                          lineHeight: 1.3,
                        }}
                      >
                        {product.name}
                      </div>
                      {product.subCategory && (
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {product.subCategory}
                        </div>
                      )}
                      <div
                        style={{
                          marginTop: 6,
                          background: '#f0f4ff',
                          color: '#4f46e5',
                          fontWeight: 800,
                          fontSize: 22,
                          borderRadius: 8,
                          padding: '4px 16px',
                          minWidth: 48,
                        }}
                      >
                        {product.godownStock}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right — transfer list */}
          <div className="transfer-panel">
            <div className="transfer-header">
              <h3>Transfer List ({totalQty} items)</h3>
            </div>
            <div className="transfer-items">
              {transfers.length === 0 ? (
                <div className="empty-transfer">
                  <Package size={48} />
                  <p>No items selected</p>
                  <small>Click products on the left to add</small>
                </div>
              ) : (
                transfers.map((transfer) => (
                  <div key={transfer.id} className="transfer-item">
                    <div className="item-info">
                      <h4>{transfer.name}</h4>
                      <p>Available: {transfer.godownStock}</p>
                    </div>
                    <div className="quantity-controls">
                      <button
                        className="qty-btn"
                        onClick={() =>
                          updateQty(transfer.id, transfer.quantity - 1)
                        }
                      >
                        <Minus size={16} />
                      </button>
                      <input
                        type="number"
                        className="qty-input"
                        value={transfer.quantity || ''}
                        min="0"
                        max={transfer.godownStock}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          updateQty(transfer.id, isNaN(v) ? 0 : v);
                        }}
                      />
                      <button
                        className="qty-btn"
                        onClick={() =>
                          updateQty(transfer.id, transfer.quantity + 1)
                        }
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <button
                      className="remove-btn"
                      onClick={() => removeFromTransfers(transfer.id)}
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
                  <p>Transferring {totalQty} items to counter</p>
                </div>
                <button
                  className="btn btn-primary execute-transfer-btn"
                  onClick={executeTransfer}
                  disabled={loading}
                >
                  {loading ? (
                    'Transferring...'
                  ) : (
                    <>
                      <CheckCircle size={20} /> Execute Transfer
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ padding: '0 24px 24px' }}>
          <div
            style={{
              padding: '12px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderBottom: '1px solid #eee',
              marginBottom: 8,
            }}
          >
            <label style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
              Filter by date:
            </label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid #ddd',
                fontSize: 14,
              }}
            />
            {filterDate && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setFilterDate('')}
              >
                Clear
              </button>
            )}
          </div>

          {historyLoading ? (
            <div style={{ padding: 32, textAlign: 'center' }}>Loading...</div>
          ) : groupedHistory.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#888' }}>
              No transfer history {filterDate ? `for ${filterDate}` : 'yet'}
            </div>
          ) : (
            groupedHistory.map((group) => (
              <div key={group.key} style={{ marginTop: 24 }}>
                <div
                  style={{
                    background: '#f0f4ff',
                    border: '1px solid #d0d9f0',
                    borderRadius: 8,
                    padding: '8px 16px',
                    fontWeight: 700,
                    fontSize: 15,
                    color: '#3a4a8a',
                    marginBottom: 8,
                  }}
                >
                  {group.label}
                </div>
                <table className="inventory-table" style={{ marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Item</th>
                      <th>Qty Transferred</th>
                      <th>From</th>
                      <th>To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((rec, i) => (
                      <tr key={rec.id || i}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {formatTime(rec.timestamp)}
                        </td>
                        <td>
                          <strong>{rec.menuItemName}</strong>
                        </td>
                        <td>{rec.quantity}</td>
                        <td>Godown</td>
                        <td>Counter</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default DailyTransfer;
