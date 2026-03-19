/* eslint-disable no-console */
import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingBag, Search, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CounterStock = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('bar');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.getCounterStock();
      if (res.success) setItems(res.items);
    } catch (e) {
      console.error('Failed to load counter stock:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const visibleItems = items
    .filter((i) => (activeSection === 'bar' ? i.isBarItem : !i.isBarItem))
    .filter(
      (i) =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.category || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

  const tabStyle = (key) => ({
    background: activeSection === key ? '#4f46e5' : '#f0f0f0',
    color: activeSection === key ? '#fff' : '#333',
    border: 'none',
    fontWeight: activeSection === key ? 700 : 400,
    padding: '5px 16px',
    borderRadius: 6,
    cursor: 'pointer',
  });

  const foodTypeIcon = (type) => {
    if (type === 'veg')
      return <span style={{ color: '#27ae60', fontWeight: 700 }}>●</span>;
    if (type === 'non-veg')
      return <span style={{ color: '#e74c3c', fontWeight: 700 }}>●</span>;
    return null;
  };

  return (
    <div className="inventory-management">
      <div className="page-header">
        <h1>
          <button
            onClick={() => navigate('/settings')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              marginRight: 8,
              display: 'inline-flex',
              alignItems: 'center',
              color: '#4f46e5',
              verticalAlign: 'middle',
            }}
          >
            <ArrowLeft size={22} />
          </button>
          <ShoppingBag size={24} /> Counter Stock
        </h1>
        <div className="tab-navigation">
          {[
            { key: 'bar', label: 'Bar' },
            { key: 'restaurant', label: 'Restaurant' },
          ].map(({ key, label }) => (
            <button
              key={key}
              className="btn tab-btn"
              style={tabStyle(key)}
              onClick={() => {
                setActiveSection(key);
                setSearchTerm('');
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

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
                <th>Counter Stock</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      {foodTypeIcon(item.foodType)}
                      <strong>{item.name}</strong>
                    </div>
                    {item.subCategory && (
                      <small style={{ color: '#888' }}>
                        {item.subCategory}
                      </small>
                    )}
                  </td>
                  <td>{item.category || '-'}</td>
                  <td>₹{item.price}</td>
                  <td>
                    <span
                      style={{
                        fontWeight: 700,
                        color: item.counterStock === 0 ? '#e74c3c' : '#27ae60',
                      }}
                    >
                      {item.counterStock}
                    </span>
                  </td>
                </tr>
              ))}
              {visibleItems.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{ textAlign: 'center', padding: 24, color: '#888' }}
                  >
                    No items found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CounterStock;
