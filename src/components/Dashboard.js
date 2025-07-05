import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Package, AlertTriangle } from 'lucide-react';

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    totalProducts: 0,
    lowStockItems: 0,
    todaySales: 0,
    totalRevenue: 0,
    recentSales: []
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Get inventory data
      const inventory = await window.electronAPI.getInventory();
      const lowStockItems = inventory.filter(item => 
        (item.godown_stock + item.counter_stock) <= item.min_stock_level
      );

      // Get today's sales
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();
      
      const todaySales = await window.electronAPI.getSales({
        start: startOfDay,
        end: endOfDay
      });

      const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.total_amount, 0);

      // Get recent sales (last 10)
      const recentSales = await window.electronAPI.getSales();

      setDashboardData({
        totalProducts: inventory.length,
        lowStockItems: lowStockItems.length,
        todaySales: todaySales.length,
        totalRevenue: todayRevenue,
        recentSales: recentSales.slice(0, 10)
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1><BarChart3 size={24} /> Dashboard</h1>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <h3>Total Products</h3>
          <div className="value">{dashboardData.totalProducts}</div>
        </div>
        <div className="summary-card warning">
          <h3>Low Stock Items</h3>
          <div className="value">{dashboardData.lowStockItems}</div>
        </div>
        <div className="summary-card">
          <h3>Today's Sales</h3>
          <div className="value">{dashboardData.todaySales}</div>
        </div>
        <div className="summary-card">
          <h3>Today's Revenue</h3>
          <div className="value">₹{dashboardData.totalRevenue.toFixed(2)}</div>
        </div>
      </div>

      {/* Alerts */}
      {dashboardData.lowStockItems > 0 && (
        <div className="alert alert-warning">
          <AlertTriangle size={20} />
          <span>
            {dashboardData.lowStockItems} item(s) are running low on stock! 
            <a href="/inventory" style={{ marginLeft: '10px', color: '#856404', textDecoration: 'underline' }}>
              View Inventory
            </a>
          </span>
        </div>
      )}

      {/* Recent Sales */}
      <div className="table-container">
        <h2 style={{ padding: '20px', margin: 0, borderBottom: '1px solid #e9ecef' }}>
          Recent Sales
        </h2>
        <table>
          <thead>
            <tr>
              <th>Sale Number</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {dashboardData.recentSales.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>
                  No sales recorded yet
                </td>
              </tr>
            ) : (
              dashboardData.recentSales.map(sale => (
                <tr key={sale.id}>
                  <td>{sale.sale_number}</td>
                  <td>{sale.customer_name || 'Walk-in Customer'}</td>
                  <td>{sale.item_count} items</td>
                  <td>₹{sale.total_amount.toFixed(2)}</td>
                  <td>
                    <span style={{ 
                      textTransform: 'capitalize',
                      background: '#e9ecef',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem'
                    }}>
                      {sale.payment_method}
                    </span>
                  </td>
                  <td>{new Date(sale.sale_date).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;
