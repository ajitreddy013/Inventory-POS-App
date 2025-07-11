import React, { useEffect, useState } from 'react';
import { 
  History, 
  ArrowRight, 
  Download, 
  Calendar, 
  Package, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpDown,
  Filter
} from 'lucide-react';

const StockHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [limit, setLimit] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchHistory();
  }, [limit]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.getStockMovements(limit);
      setHistory(result);
    } catch (error) {
      console.error('Failed to fetch stock movements:', error);
      alert('Failed to load stock history');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    try {
      const filteredHistory = getFilteredHistory();
      const exportData = {
        transfer_date: new Date().toLocaleDateString(),
        total_items: filteredHistory.length,
        total_quantity: filteredHistory.reduce((acc, item) => acc + item.quantity, 0),
        items_transferred: filteredHistory.map((item) => ({
          name: item.product_name,
          variant: item.variant || '-',
          quantity: item.quantity,
          transfer_time: item.created_at
        }))
      };
      const result = await window.electronAPI.exportTransferReport(exportData);
      if (result.success) {
        alert(`PDF exported successfully to ${result.filePath}`);
      } else {
        alert('Failed to export PDF: ' + result.error);
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Export failed');
    }
  };

  const getFilteredHistory = () => {
    let filtered = history;
    
    // Filter by movement type
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.movement_type === filterType);
    }
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.movement_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.from_location && item.from_location.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.to_location && item.to_location.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    return filtered;
  };

  const getMovementIcon = (type) => {
    switch (type) {
      case 'transfer':
        return <ArrowUpDown size={16} className="text-blue-500" />;
      case 'in':
        return <TrendingUp size={16} className="text-green-500" />;
      case 'out':
        return <TrendingDown size={16} className="text-red-500" />;
      default:
        return <Package size={16} className="text-gray-500" />;
    }
  };

  const getMovementTypeLabel = (type) => {
    switch (type) {
      case 'transfer':
        return 'Transfer';
      case 'in':
        return 'Stock In';
      case 'out':
        return 'Stock Out';
      case 'adjustment':
        return 'Adjustment';
      default:
        return type;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const filteredHistory = getFilteredHistory();

  if (loading) {
    return (
      <div className="stock-history loading">
        <div className="page-header">
          <h1><History size={24} /> Stock Movement History</h1>
        </div>
        <div className="loading-message">Loading stock movement history...</div>
      </div>
    );
  }

  return (
    <div className="stock-history">
      <div className="page-header">
        <h1><History size={24} /> Stock Movement History</h1>
        <div className="header-actions">
          <button 
            onClick={exportToPDF} 
            className="btn btn-primary"
            disabled={filteredHistory.length === 0}
          >
            <Download size={16} />
            Export PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <h3>Total Movements</h3>
          <div className="value">{filteredHistory.length}</div>
        </div>
        <div className="summary-card">
          <h3>Transfers</h3>
          <div className="value">
            {filteredHistory.filter(item => item.movement_type === 'transfer').length}
          </div>
        </div>
        <div className="summary-card">
          <h3>Stock In</h3>
          <div className="value">
            {filteredHistory.filter(item => item.movement_type === 'in').length}
          </div>
        </div>
        <div className="summary-card">
          <h3>Stock Out</h3>
          <div className="value">
            {filteredHistory.filter(item => item.movement_type === 'out').length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label>
            <Filter size={16} />
            Search:
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by product name or location..."
              className="form-input"
            />
          </label>
        </div>
        <div className="filter-group">
          <label>
            Movement Type:
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="form-input"
            >
              <option value="all">All Types</option>
              <option value="transfer">Transfers</option>
              <option value="in">Stock In</option>
              <option value="out">Stock Out</option>
              <option value="adjustment">Adjustments</option>
            </select>
          </label>
        </div>
        <div className="filter-group">
          <label>
            Show Last:
            <select 
              value={limit} 
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="form-input"
            >
              <option value={30}>30 entries</option>
              <option value={50}>50 entries</option>
              <option value={100}>100 entries</option>
              <option value={200}>200 entries</option>
            </select>
          </label>
        </div>
      </div>

      {/* History Table */}
      <div className="table-container">
        {filteredHistory.length === 0 ? (
          <div className="no-data">
            <Package size={48} className="text-gray-400" />
            <p>No stock movements found matching your criteria.</p>
          </div>
        ) : (
          <table className="inventory-table">
            <thead>
              <tr>
                <th><Calendar size={16} /> Date & Time</th>
                <th><Package size={16} /> Product</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>From</th>
                <th></th>
                <th>To</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map(item => (
                <tr key={item.id} className={`movement-${item.movement_type}`}>
                  <td className="date-cell">{formatDate(item.created_at)}</td>
                  <td className="product-cell">
                    <strong>{item.product_name}</strong>
                  </td>
                  <td className="type-cell">
                    <div className="movement-type">
                      {getMovementIcon(item.movement_type)}
                      <span>{getMovementTypeLabel(item.movement_type)}</span>
                    </div>
                  </td>
                  <td className="quantity-cell">
                    <span className="quantity-badge">{item.quantity}</span>
                  </td>
                  <td className="location-cell">
                    {item.from_location ? (
                      <span className="location-badge">{item.from_location}</span>
                    ) : (
                      <span className="location-badge empty">-</span>
                    )}
                  </td>
                  <td className="arrow-cell">
                    {item.movement_type === 'transfer' && (
                      <ArrowRight size={16} className="text-gray-400" />
                    )}
                  </td>
                  <td className="location-cell">
                    {item.to_location ? (
                      <span className="location-badge">{item.to_location}</span>
                    ) : (
                      <span className="location-badge empty">-</span>
                    )}
                  </td>
                  <td className="notes-cell">
                    {item.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Refresh Button */}
      <div className="actions-section">
        <button 
          onClick={fetchHistory} 
          className="btn btn-secondary"
          disabled={loading}
        >
          <History size={16} />
          Refresh History
        </button>
      </div>
    </div>
  );
};

export default StockHistory;

