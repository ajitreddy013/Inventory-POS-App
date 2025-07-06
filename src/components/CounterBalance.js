import React, { useState, useEffect } from "react";
import { DollarSign, Plus, Edit, Calendar, RefreshCw } from "lucide-react";

const CounterBalance = () => {
  const [counterBalances, setCounterBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingBalance, setEditingBalance] = useState(null);
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  const [formData, setFormData] = useState({
    balanceDate: new Date().toISOString().split("T")[0],
    openingBalance: "",
    closingBalance: "",
    notes: "",
  });

  useEffect(() => {
    loadCounterBalances();
  }, [dateRange]);

  const loadCounterBalances = async () => {
    try {
      setLoading(true);
      const data = await window.electronAPI.getCounterBalances(dateRange);
      setCounterBalances(data);
    } catch (error) {
      console.error("Failed to load counter balances:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBalance) {
        await window.electronAPI.updateCounterBalance(
          formData.balanceDate,
          formData
        );
      } else {
        await window.electronAPI.addCounterBalance(formData);
      }

      resetForm();
      loadCounterBalances();
    } catch (error) {
      console.error("Failed to save counter balance:", error);
    }
  };

  const handleEdit = (balance) => {
    setEditingBalance(balance);
    setFormData({
      balanceDate: balance.balance_date,
      openingBalance: balance.opening_balance.toString(),
      closingBalance: balance.closing_balance.toString(),
      notes: balance.notes || "",
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      balanceDate: new Date().toISOString().split("T")[0],
      openingBalance: "",
      closingBalance: "",
      notes: "",
    });
    setEditingBalance(null);
    setShowForm(false);
  };

  const getTodayBalance = () => {
    const today = new Date().toISOString().split("T")[0];
    const todayBalance = counterBalances.find(
      (balance) => balance.balance_date === today
    );
    return todayBalance || null;
  };

  const todayBalance = getTodayBalance();
  const totalEntries = counterBalances.length;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="counter-balance">
      <div className="page-header">
        <h1>
          <DollarSign size={24} /> Counter Balance Management
        </h1>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          <Plus size={16} style={{ marginRight: "8px" }} />
          Add Balance Entry
        </button>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-controls">
          <div className="form-row">
            <div className="form-group">
              <label>Start Date:</label>
              <input
                type="date"
                className="form-input"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, start: e.target.value }))
                }
              />
            </div>
            <div className="form-group">
              <label>End Date:</label>
              <input
                type="date"
                className="form-input"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end: e.target.value }))
                }
              />
            </div>
            <div className="form-group">
              <button
                onClick={loadCounterBalances}
                disabled={loading}
                className="btn btn-secondary"
                style={{ marginTop: "24px" }}
              >
                <RefreshCw size={16} style={{ marginRight: "8px" }} />
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon">
            <DollarSign size={24} />
          </div>
          <div className="card-content">
            <h3>Today's Opening Balance</h3>
            <p className="amount">
              {todayBalance
                ? `₹${todayBalance.opening_balance.toFixed(2)}`
                : "Not Set"}
            </p>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon">
            <DollarSign size={24} />
          </div>
          <div className="card-content">
            <h3>Today's Closing Balance</h3>
            <p className="amount">
              {todayBalance
                ? `₹${todayBalance.closing_balance.toFixed(2)}`
                : "Not Set"}
            </p>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon">
            <Calendar size={24} />
          </div>
          <div className="card-content">
            <h3>Total Entries</h3>
            <p className="amount">{totalEntries}</p>
          </div>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>
                {editingBalance
                  ? "Edit Counter Balance"
                  : "Add Counter Balance Entry"}
              </h2>
              <button onClick={resetForm} className="btn-close">
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="form">
              <div className="form-row">
                <div className="form-group">
                  <label>Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.balanceDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        balanceDate: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Opening Balance *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={formData.openingBalance}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        openingBalance: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Closing Balance *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={formData.closingBalance}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        closingBalance: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    className="form-input"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    rows="3"
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingBalance ? "Update" : "Add"} Balance Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Counter Balance List */}
      <div className="content-section">
        {loading ? (
          <div className="loading">Loading counter balances...</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Opening Balance</th>
                  <th>Closing Balance</th>
                  <th>Difference</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {counterBalances.map((balance) => {
                  const difference =
                    balance.closing_balance - balance.opening_balance;
                  return (
                    <tr key={balance.id}>
                      <td>{formatDate(balance.balance_date)}</td>
                      <td className="amount">
                        ₹{balance.opening_balance.toFixed(2)}
                      </td>
                      <td className="amount">
                        ₹{balance.closing_balance.toFixed(2)}
                      </td>
                      <td
                        className={`amount ${
                          difference >= 0 ? "positive" : "negative"
                        }`}
                      >
                        ₹{difference.toFixed(2)}
                      </td>
                      <td>{balance.notes || "-"}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => handleEdit(balance)}
                            className="btn-icon"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {counterBalances.length === 0 && (
              <div className="empty-state">
                <DollarSign size={48} />
                <h3>No counter balance entries found</h3>
                <p>Add your first counter balance entry to get started.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CounterBalance;
