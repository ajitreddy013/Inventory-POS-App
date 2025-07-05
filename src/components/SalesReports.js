import React, { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';

const SalesReports = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().substr(0, 10),
    end: new Date().toISOString().substr(0, 10)
  });

  useEffect(() => {
    loadSales();
  }, [dateRange]);

  const loadSales = async () => {
    try {
      setLoading(true);
      const salesData = await window.electronAPI.getSales({
        start: `${dateRange.start}T00:00:00`,
        end: `${dateRange.end}T23:59:59`
      });
      setSales(salesData);
    } catch (error) {
      console.error('Failed to load sales reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <div className="sales-reports">
      <div className="page-header">
        <h1><BarChart3 size={24} /> Sales Reports</h1>
      </div>

      {/* Date Range */}
      <div className="form-row" style={{ padding: '20px 30px' }}>
        <div className="form-group">
          <label>Start Date:
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="form-input"
            />
          </label>
        </div>
        <div className="form-group">
          <label>End Date:
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="form-input"
            />
          </label>
        </div>
      </div>

      {/* Sales Reports Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Sale Number</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total Amount</th>
              <th>Date</th>
            </tr>
          </thead>
          {loading ? (
            <tbody>
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>
                  Loading...
                </td>
              </tr>
            </tbody>
          ) : sales.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>
                  No sales found for the selected date range
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {sales.map(sale => (
                <tr key={sale.id}>
                  <td>{sale.sale_number}</td>
                  <td>{sale.customer_name || 'Walk-in Customer'}</td>
                  <td>{sale.item_count}</td>
                  <td>₹{sale.total_amount.toFixed(2)}</td>
                  <td>{formatDate(sale.sale_date)}</td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
};

export default SalesReports;

