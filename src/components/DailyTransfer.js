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
  Trash2,
} from 'lucide-react';
import './DailyTransfer.css';

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

function groupByDate(records) {
  const map = {};
  for (const rec of records) {
    const key = toDateKey(rec.timestamp);
    if (!map[key]) map[key] = { key, label: formatDateLabel(rec.timestamp), items: [] };
    map[key].items.push(rec);
  }
  for (const g of Object.values(map)) {
    g.items.sort((a, b) => (parseTimestamp(a.timestamp) || 0) - (parseTimestamp(b.timestamp) || 0));
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
      if (res.success) setProducts(res.items.filter((i) => i.godownStock > 0));
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

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { if (activeTab === 'history') loadHistory(); }, [activeTab, loadHistory]);

  const filteredProducts = products
    .filter((p) => (godownSection === 'bar' ? p.isBarItem : !p.isBarItem))
    .filter((p) =>
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
      prev.map((t) => t.id === id ? { ...t, quantity: Math.max(0, Math.min(qty, max)) } : t)
    );
  };

  const removeFromTransfers = (id) =>
    setTransfers((prev) => prev.filter((t) => t.id !== id));

  const totalQty = transfers.reduce((s, t) => s + t.quantity, 0);

  const executeTransfer = async () => {
    if (transfers.length === 0) { alert('No items selected'); return; }
    if (transfers.some((t) => t.quantity <= 0)) { alert('Some items have 0 quantity'); return; }
    setLoading(true);
    try {
      const items = transfers.map((t) => ({ menuItemId: t.id, menuItemName: t.name, quantity: t.quantity }));
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

  return (
    <div className="daily-transfer">
      <div className="dt-page-header">
        <h1>Daily Transfer</h1>
        <div className="dt-tab-nav">
          {[{ key: 'transfer', label: 'Transfer' }, { key: 'history', label: 'History' }].map(({ key, label }) => (
            <button
              key={key}
              className={`dt-tab-btn ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'transfer' && (
        <div className="dt-layout">
          {/* Left — product grid */}
          <div className="dt-product-panel">
            {/* Search bar */}
            <div className="dt-search-bar">
              <Search size={16} className="dt-search-icon" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="dt-search-input"
              />
            </div>

            {/* Bar / Restaurant filter */}
            <div className="dt-filters">
              {[{ key: 'bar', label: 'Bar' }, { key: 'restaurant', label: 'Restaurant' }].map(({ key, label }) => (
                <button
                  key={key}
                  className={`dt-filter-chip ${godownSection === key ? 'active' : ''}`}
                  onClick={() => setGodownSection(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Product cards grid */}
            {filteredProducts.length === 0 ? (
              <div className="dt-empty">
                <Package size={40} />
                <p>No items with godown stock</p>
              </div>
            ) : (
              <div className="dt-items-grid">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="dt-item-card"
                    onClick={() => addToTransfers(product)}
                  >
                    <div>
                      <div className="dt-item-header">
                        <span className="dt-item-tag">
                          {product.subCategory || product.category || 'Other'}
                        </span>
                      </div>
                      <h4 className="dt-item-name">{product.name}</h4>
                    </div>
                    <div className="dt-item-footer">
                      <span className="dt-stock-label">
                        Stock: {product.godownStock}
                      </span>
                      <div className="dt-add-btn">
                        <Plus size={18} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right — transfer list */}
          <aside className="dt-transfer-panel">
            <div className="dt-transfer-header">
              <h2>
                <ArrowRight size={20} /> Transfer List
              </h2>
              {totalQty > 0 && (
                <span className="dt-qty-badge">{totalQty} items</span>
              )}
            </div>

            <div className="dt-transfer-items">
              {transfers.length === 0 ? (
                <div className="dt-empty" style={{ padding: '3rem 1rem' }}>
                  <Package size={36} style={{ opacity: 0.4 }} />
                  <p>No items selected</p>
                  <small>Tap products on the left to add</small>
                </div>
              ) : (
                transfers.map((transfer) => (
                  <div key={transfer.id} className="dt-transfer-row">
                    <div className="dt-transfer-info">
                      <span className="dt-transfer-name">{transfer.name}</span>
                      <span className="dt-transfer-avail">Avail: {transfer.godownStock}</span>
                    </div>
                    <div className="dt-qty-controls">
                      <button className="dt-qty-btn" onClick={() => updateQty(transfer.id, transfer.quantity - 1)}>
                        <Minus size={14} />
                      </button>
                      <span className="dt-qty-val">{transfer.quantity}</span>
                      <button className="dt-qty-btn" onClick={() => updateQty(transfer.id, transfer.quantity + 1)}>
                        <Plus size={14} />
                      </button>
                    </div>
                    <button className="dt-remove-btn" onClick={() => removeFromTransfers(transfer.id)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {transfers.length > 0 && (
              <div className="dt-transfer-actions">
                <p className="dt-transfer-summary">Transferring {totalQty} item(s) to counter</p>
                <button className="dt-execute-btn" onClick={executeTransfer} disabled={loading}>
                  {loading ? 'Transferring...' : <><CheckCircle size={18} /> Execute Transfer</>}
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="dt-history">
          <div className="dt-history-filter">
            <label>Filter by date:</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="dt-date-input"
            />
            {filterDate && (
              <button className="dt-clear-btn" onClick={() => setFilterDate('')}>Clear</button>
            )}
          </div>

          {historyLoading ? (
            <div className="dt-empty">Loading...</div>
          ) : groupedHistory.length === 0 ? (
            <div className="dt-empty">
              <History size={40} />
              <p>No transfer history found</p>
            </div>
          ) : (
            groupedHistory.map((group) => (
              <div key={group.key} style={{ marginBottom: '2.5rem' }}>
                <div className="dt-date-header">{group.label}</div>
                <div style={{ overflowX: 'auto' }}>
                <table className="dt-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Item Name</th>
                      <th>Qty</th>
                      <th>From</th>
                      <th>To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((rec, i) => (
                      <tr key={rec.id || i}>
                        <td>{formatTime(rec.timestamp)}</td>
                        <td><strong>{rec.menuItemName}</strong></td>
                        <td style={{ fontWeight: 800 }}>{rec.quantity}</td>
                        <td>Godown</td>
                        <td>Counter</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default DailyTransfer;
