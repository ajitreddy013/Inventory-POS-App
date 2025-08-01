import React, { useState, useEffect } from "react";
import { DollarSign, Plus, Edit, Sun } from "lucide-react";

// Helper to get local date in YYYY-MM-DD
function getLocalDateString() {
  const today = new Date();
  return (
    today.getFullYear() +
    "-" +
    String(today.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(today.getDate()).padStart(2, "0")
  );
}

const CounterBalance = () => {
  const [counterBalances, setCounterBalances] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingBalance, setEditingBalance] = useState(null);

  const [formData, setFormData] = useState({
    balanceDate: getLocalDateString(),
    openingBalance: "",
    notes: "",
  });

  useEffect(() => {
    loadCounterBalances();
  }, []);

  const loadCounterBalances = async () => {
    try {
      const data = await window.electronAPI.getCounterBalances({
        start: getLocalDateString(),
        end: getLocalDateString(),
      });
      setCounterBalances(data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load counter balances:", error);
    }
  };

  const handleEdit = (balance) => {
    setEditingBalance(balance);
    setFormData({
      balanceDate: balance.balance_date,
      openingBalance: balance.opening_balance.toString(),
      notes: balance.notes || "",
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      balanceDate: getLocalDateString(),
      openingBalance: "",
      notes: "",
    });
    setEditingBalance(null);
    setShowForm(false);
  };

  const getTodayBalance = () => {
    const today = getLocalDateString();
    const todayBalance = counterBalances.find(
      (balance) => balance.balance_date === today
    );
    return todayBalance || null;
  };

  const todayBalance = getTodayBalance();

  const formatDate = (dateString) => {
    // Parse YYYY-MM-DD as local time
    if (!dateString) return "-";
    const [year, month, day] = dateString.split("-").map(Number);
    return `${String(day).padStart(2, "0")}/${String(month).padStart(
      2,
      "0"
    )}/${year}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingBalance) {
        // Update existing balance
        await window.electronAPI.updateCounterBalance(formData.balanceDate, {
          balanceDate: formData.balanceDate,
          openingBalance: formData.openingBalance,
          closingBalance: editingBalance.closing_balance.toString(),
          notes: formData.notes,
        });
      } else {
        // Create new balance entry
        await window.electronAPI.addCounterBalance({
          balanceDate: formData.balanceDate,
          openingBalance: formData.openingBalance,
          closingBalance: "0",
          notes: formData.notes,
        });
      }

      resetForm();
      loadCounterBalances();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to save opening balance:", error);
    }
  };

  return (
    <div className="counter-balance">
      <div className="page-header">
        <h1>
          <DollarSign size={24} /> Daily Opening Balance
        </h1>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          <Plus size={16} style={{ marginRight: "8px" }} />
          Add Opening Balance
        </button>
      </div>

      {/* Today's Balance Summary */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon">
            <Sun size={24} />
          </div>
          <div className="card-content">
            <h3>Today&apos;s Opening Balance</h3>
            <p className="amount">
              {todayBalance
                ? `₹${todayBalance.opening_balance.toFixed(2)}`
                : "Not Set"}
            </p>
            {todayBalance && (
              <button
                onClick={() => handleEdit(todayBalance)}
                className="btn btn-small btn-secondary"
                style={{ marginTop: "10px" }}
              >
                <Edit size={14} style={{ marginRight: "4px" }} />
                Modify
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Opening Balance Form */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>
                <Sun size={24} />
                {editingBalance
                  ? "Modify Opening Balance"
                  : "Add Opening Balance"}
              </h2>
              <button onClick={resetForm} className="btn-close">
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="form">
              <div className="modal-content">
                <div className="form-section">
                  <div className="form-section-title">
                    Balance Information
                  </div>
                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label className="required">Date</label>
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
                      <label className="required">Opening Balance (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        placeholder="0.00"
                        value={formData.openingBalance}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            openingBalance: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Notes</label>
                    <textarea
                      className="form-input"
                      placeholder="Any additional notes about the opening balance..."
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      rows="3"
                    />
                  </div>
                </div>
              </div>
              
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingBalance ? "Update" : "Save"} Opening Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recent Entries Table */}
      <div className="table-container">
        <h2>Recent Opening Balance Entries</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Opening Balance</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {counterBalances.length === 0 ? (
              <tr>
                <td
                  colSpan="4"
                  style={{ textAlign: "center", padding: "40px" }}
                >
                  No opening balance entries found
                </td>
              </tr>
            ) : (
              counterBalances.map((balance) => (
                <tr key={balance.id}>
                  <td>{formatDate(balance.balance_date)}</td>
                  <td>₹{balance.opening_balance.toFixed(2)}</td>
                  <td>{balance.notes || "-"}</td>
                  <td>
                    <button
                      onClick={() => handleEdit(balance)}
                      className="btn btn-small btn-secondary"
                    >
                      <Edit size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CounterBalance;
