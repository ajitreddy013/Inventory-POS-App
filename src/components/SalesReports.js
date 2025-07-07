import React, { useState, useEffect } from "react";
import { BarChart3, Mail, Send, DollarSign } from "lucide-react";

const SalesReports = () => {
  const [sales, setSales] = useState([]);
  const [spendings, setSpendings] = useState([]);
  const [counterBalances, setCounterBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailLoading, setEmailLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: getLocalDateString(),
    end: getLocalDateString(),
  });

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load sales data
      const salesData = await window.electronAPI.getSales({
        start: `${dateRange.start}T00:00:00`,
        end: `${dateRange.end}T23:59:59`,
      });
      setSales(salesData);

      // Load spendings data
      const spendingsData = await window.electronAPI.getSpendings({
        start: dateRange.start,
        end: dateRange.end,
      });
      setSpendings(spendingsData);

      // Load counter balance data
      const counterBalanceData = await window.electronAPI.getCounterBalances({
        start: dateRange.start,
        end: dateRange.end,
      });
      setCounterBalances(counterBalanceData);
    } catch (error) {
      console.error("Failed to load reports data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const sendEmailReport = async () => {
    try {
      setEmailLoading(true);
      const result = await window.electronAPI.sendDailyEmailNow();
      if (result.success) {
        alert("Email report sent successfully!");
      } else {
        alert(`Failed to send email report: ${result.error}`);
      }
    } catch (error) {
      alert("Failed to send email report");
    } finally {
      setEmailLoading(false);
    }
  };

  // Calculate totals
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
  const totalSpendings = spendings.reduce(
    (sum, spending) => sum + spending.amount,
    0
  );
  const netIncome = totalRevenue - totalSpendings;
  const totalTransactions = sales.length;
  const totalSpendingEntries = spendings.length;

  // Calculate opening balance totals
  const totalOpeningBalance = counterBalances.reduce(
    (sum, balance) => sum + balance.opening_balance,
    0
  );

  // Get leftover money from previous day
  const getLeftoverMoney = () => {
    if (counterBalances.length > 0) {
      const sortedBalances = [...counterBalances].sort(
        (a, b) => new Date(a.balance_date) - new Date(b.balance_date)
      );
      return sortedBalances[0].opening_balance;
    }
    return 0;
  };

  const leftoverMoney = getLeftoverMoney();
  const totalBalance = netIncome + leftoverMoney;

  // Helper to get local date in YYYY-MM-DD
  const getLocalDateString = () => {
    const today = new Date();
    return (
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0")
    );
  };

  return (
    <div className="sales-reports">
      <div className="page-header">
        <h1>
          <BarChart3 size={24} /> Sales & Financial Reports
        </h1>
        <button
          onClick={sendEmailReport}
          disabled={emailLoading}
          className="btn btn-primary"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <Mail size={16} />
          {emailLoading ? "Sending..." : "Email Report to Owner"}
        </button>
      </div>

      {/* Date Range */}
      <div className="form-row" style={{ padding: "20px 30px" }}>
        <div className="form-group">
          <label>
            Start Date:
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange({ ...dateRange, start: e.target.value })
              }
              className="form-input"
            />
          </label>
        </div>
        <div className="form-group">
          <label>
            End Date:
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange({ ...dateRange, end: e.target.value })
              }
              className="form-input"
            />
          </label>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="summary-cards" style={{ margin: "0 30px 20px 30px" }}>
        <div className="summary-card">
          <div className="card-icon">
            <BarChart3 size={24} />
          </div>
          <div className="card-content">
            <h3>Total Revenue</h3>
            <p className="amount">₹{totalRevenue.toFixed(2)}</p>
            <small>{totalTransactions} transactions</small>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon">
            <DollarSign size={24} />
          </div>
          <div className="card-content">
            <h3>Total Spendings</h3>
            <p className="amount">₹{totalSpendings.toFixed(2)}</p>
            <small>{totalSpendingEntries} entries</small>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon">
            <BarChart3 size={24} />
          </div>
          <div className="card-content">
            <h3>Net Income</h3>
            <p className={`amount ${netIncome >= 0 ? "positive" : "negative"}`}>
              ₹{netIncome.toFixed(2)}
            </p>
            <small>{netIncome >= 0 ? "Profit" : "Loss"}</small>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon">
            <DollarSign size={24} />
          </div>
          <div className="card-content">
            <h3>Opening Balance</h3>
            <p className="amount">₹{totalOpeningBalance.toFixed(2)}</p>
            <small>Total opening balances</small>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon">
            <DollarSign size={24} />
          </div>
          <div className="card-content">
            <h3>Leftover Money</h3>
            <p className="amount">₹{leftoverMoney.toFixed(2)}</p>
            <small>From previous day</small>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon">
            <BarChart3 size={24} />
          </div>
          <div className="card-content">
            <h3>Total Balance</h3>
            <p
              className={`amount ${
                totalBalance >= 0 ? "positive" : "negative"
              }`}
            >
              ₹{totalBalance.toFixed(2)}
            </p>
            <small>Net Income + Leftover</small>
          </div>
        </div>
      </div>

      {/* Sales Reports Table */}
      <div className="table-container">
        <h3 style={{ margin: "0 30px 20px 30px" }}>Sales Details</h3>
        <table>
          <thead>
            <tr>
              <th>Sale Number</th>
              <th>Type</th>
              <th>Table/Parcel</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total Amount</th>
              <th>Date</th>
            </tr>
          </thead>
          {loading ? (
            <tbody>
              <tr>
                <td
                  colSpan="7"
                  style={{ textAlign: "center", padding: "40px" }}
                >
                  Loading...
                </td>
              </tr>
            </tbody>
          ) : sales.length === 0 ? (
            <tbody>
              <tr>
                <td
                  colSpan="7"
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "#7f8c8d",
                  }}
                >
                  No sales found for the selected date range
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td>{sale.sale_number}</td>
                  <td className={`sale-type ${sale.sale_type}`}>
                    {sale.sale_type === "table" ? "Table" : "Parcel"}
                  </td>
                  <td>
                    {sale.sale_type === "table"
                      ? sale.table_number || "-"
                      : "Parcel"}
                  </td>
                  <td>{sale.customer_name || "Walk-in Customer"}</td>
                  <td>{sale.item_count}</td>
                  <td>₹{sale.total_amount.toFixed(2)}</td>
                  <td>{formatDate(sale.sale_date)}</td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      {/* Spendings Table */}
      {spendings.length > 0 && (
        <div className="table-container" style={{ marginTop: "30px" }}>
          <h3 style={{ margin: "0 30px 20px 30px" }}>Spendings Details</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Payment Method</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {spendings.map((spending) => (
                <tr key={spending.id}>
                  <td>{formatDate(spending.spending_date)}</td>
                  <td>{spending.description}</td>
                  <td>
                    <span className="category-tag">{spending.category}</span>
                  </td>
                  <td>₹{spending.amount.toFixed(2)}</td>
                  <td>
                    <span
                      className={`payment-method ${spending.payment_method}`}
                    >
                      {spending.payment_method.replace("_", " ").toUpperCase()}
                    </span>
                  </td>
                  <td>{spending.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Opening Balance Table */}
      {counterBalances.length > 0 && (
        <div className="table-container" style={{ marginTop: "30px" }}>
          <h3 style={{ margin: "0 30px 20px 30px" }}>
            Opening Balance Details
          </h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Opening Balance</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {counterBalances.map((balance) => (
                <tr key={balance.id}>
                  <td>{formatDate(balance.balance_date)}</td>
                  <td>₹{balance.opening_balance.toFixed(2)}</td>
                  <td>{balance.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SalesReports;
