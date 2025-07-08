import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Package,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { 
  getLocalDateString,
  formatDateForDisplay,
  getStartOfDay,
  getEndOfDay,
  formatDateTimeToString
} from "../utils/dateUtils";

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    totalProducts: 0,
    lowStockItems: 0,
    todaySales: 0,
    totalRevenue: 0,
    todaySpendings: 0,
    netIncome: 0,
    openingBalance: 0,
    totalBalance: 0,
    recentSales: [],
  });
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    loadDashboardData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);

    // Listen for sale completion events
    const handleSaleCompleted = () => {
      console.log("Sale completed event received, refreshing dashboard...");
      loadDashboardData();
    };

    window.addEventListener("saleCompleted", handleSaleCompleted);

    return () => {
      clearInterval(interval);
      window.removeEventListener("saleCompleted", handleSaleCompleted);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Get inventory data
      const inventory = await window.electronAPI.getInventory();
      const lowStockItems = inventory.filter(
        (item) => item.godown_stock + item.counter_stock <= item.min_stock_level
      );

      // Get today's sales using system local date
      const todayDate = getLocalDateString(); // YYYY-MM-DD format in local time

      console.log("Dashboard loading for date:", todayDate); // Debug log

      const todaySales = await window.electronAPI.getSales({
        start: getStartOfDay(todayDate),
        end: getEndOfDay(todayDate),
      });

      console.log("Today sales found:", todaySales.length); // Debug log

      const todayRevenue = todaySales.reduce(
        (sum, sale) => sum + sale.total_amount,
        0
      );

      // Get today's spendings
      const todaySpendings = await window.electronAPI.getDailySpendingTotal(
        todayDate
      );
      const netIncome = todayRevenue - todaySpendings;

      // Get today's opening balance
      const todayCounterBalance = await window.electronAPI.getCounterBalance(
        todayDate
      );
      const openingBalance = todayCounterBalance
        ? todayCounterBalance.opening_balance
        : 0;

      // Calculate total balance (net income + opening balance)
      const totalBalance = netIncome + openingBalance;

      // Get recent sales (last 7 days)
      const now = new Date();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentSales = await window.electronAPI.getSales({
        start: formatDateTimeToString(weekAgo),
        end: formatDateTimeToString(now),
      });

      setDashboardData({
        totalProducts: inventory.length,
        lowStockItems: lowStockItems.length,
        todaySales: todaySales.length,
        totalRevenue: todayRevenue,
        todaySpendings: todaySpendings,
        netIncome: netIncome,
        openingBalance: openingBalance,
        totalBalance: totalBalance,
        recentSales: recentSales.slice(0, 10),
      });

      setLastUpdated(formatDateTimeToString(new Date()));
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return formatDateForDisplay(dateString);
  };


  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>
          <BarChart3 size={24} /> Dashboard
        </h1>
        <button
          onClick={loadDashboardData}
          disabled={loading}
          className="btn btn-secondary"
          style={{ marginLeft: "auto" }}
        >
          <RefreshCw size={16} style={{ marginRight: "8px" }} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
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
          <h3>Today&apos;s Sales</h3>
          <div className="value">{dashboardData.todaySales}</div>
        </div>
        <div className="summary-card">
          <h3>Today&apos;s Revenue</h3>
          <div className="value">₹{dashboardData.totalRevenue.toFixed(2)}</div>
        </div>
        <div className="summary-card">
          <h3>Today&apos;s Spendings</h3>
          <div className="value">
            ₹{dashboardData.todaySpendings.toFixed(2)}
          </div>
        </div>
        <div className="summary-card">
          <h3>Net Income</h3>
          <div className="value">
            ₹{dashboardData.netIncome.toFixed(2)}
          </div>
        </div>
        <div className="summary-card">
          <h3>Opening Balance</h3>
          <div className="value">
            ₹{dashboardData.openingBalance.toFixed(2)}
          </div>
        </div>
        <div className="summary-card">
          <h3>Total Balance</h3>
          <div className="value positive">₹{dashboardData.totalBalance.toFixed(2)}</div>
        </div>
      </div>

      {/* Last Updated Info */}
      {lastUpdated && (
        <div
          style={{
            textAlign: "center",
            margin: "20px 0",
            color: "#7f8c8d",
            fontSize: "0.9rem",
          }}
        >
          Last updated: {lastUpdated}
        </div>
      )}

      {/* Alerts */}
      {dashboardData.lowStockItems > 0 && (
        <div className="alert alert-warning">
          <AlertTriangle size={20} />
          <span>
            {dashboardData.lowStockItems} item(s) are running low on stock!
            <a
              href="/inventory"
              style={{
                marginLeft: "10px",
                color: "#856404",
                textDecoration: "underline",
              }}
            >
              View Inventory
            </a>
          </span>
        </div>
      )}

      {/* Recent Sales */}
      <div className="table-container">
        <h2
          style={{
            padding: "20px",
            margin: 0,
            borderBottom: "1px solid #e9ecef",
          }}
        >
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
                <td
                  colSpan="6"
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "#7f8c8d",
                  }}
                >
                  No sales recorded yet
                </td>
              </tr>
            ) : (
              dashboardData.recentSales.map((sale) => (
                <tr key={sale.id}>
                  <td>{sale.sale_number}</td>
                  <td>{sale.customer_name || "Walk-in Customer"}</td>
                  <td>{sale.item_count} items</td>
                  <td>₹{sale.total_amount.toFixed(2)}</td>
                  <td>
                    <span
                      style={{
                        textTransform: "capitalize",
                        background: "#e9ecef",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                      }}
                    >
                      {sale.payment_method}
                    </span>
                  </td>
                  <td>{formatDate(sale.sale_date)}</td>
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
