import React, { useState, useEffect } from "react";
import {
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Search,
  Filter,
} from "lucide-react";

const Spendings = () => {
  const [spendings, setSpendings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSpending, setEditingSpending] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [dateRange, setDateRange] = useState({
    start: getLocalDateString(),
    end: getLocalDateString(),
  });

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category: "",
    spendingDate: getLocalDateTimeString(new Date()),
    paymentMethod: "cash",
    notes: "",
  });

  useEffect(() => {
    loadSpendings();
    loadCategories();
  }, [dateRange]);

  const loadSpendings = async () => {
    try {
      setLoading(true);
      const data = await window.electronAPI.getSpendings(dateRange);
      setSpendings(data);
    } catch (error) {
      console.error("Failed to load spendings:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await window.electronAPI.getSpendingCategories();
      setCategories(data);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSpending) {
        await window.electronAPI.updateSpending(editingSpending.id, formData);
      } else {
        await window.electronAPI.addSpending(formData);
      }

      resetForm();
      loadSpendings();
    } catch (error) {
      console.error("Failed to save spending:", error);
    }
  };

  const handleEdit = (spending) => {
    setEditingSpending(spending);
    setFormData({
      description: spending.description,
      amount: spending.amount.toString(),
      category: spending.category,
      spendingDate: spending.spending_date,
      paymentMethod: spending.payment_method,
      notes: spending.notes || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this spending?")) {
      try {
        await window.electronAPI.deleteSpending(id);
        loadSpendings();
      } catch (error) {
        console.error("Failed to delete spending:", error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      description: "",
      amount: "",
      category: "",
      spendingDate: getLocalDateTimeString(new Date()),
      paymentMethod: "cash",
      notes: "",
    });
    setEditingSpending(null);
    setShowForm(false);
  };

  const filteredSpendings = spendings.filter((spending) => {
    const matchesSearch =
      spending.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      spending.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      !selectedCategory || spending.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalSpending = filteredSpendings.reduce(
    (sum, spending) => sum + spending.amount,
    0
  );

  const formatDate = (dateString) => {
    // Parse YYYY-MM-DD HH:mm:ss as local time
    if (!dateString) return "-";
    const [datePart, timePart] = dateString.split(" ");
    const [year, month, day] = datePart.split("-").map(Number);
    let date;
    if (timePart) {
      const [hour, min, sec] = timePart.split(":").map(Number);
      date = new Date(year, month - 1, day, hour, min, sec);
    } else {
      date = new Date(year, month - 1, day);
    }
    return `${String(day).padStart(2, "0")}/${String(month).padStart(
      2,
      "0"
    )}/${year}`;
  };

  return (
    <div className="spendings">
      <div className="page-header">
        <h1>
          <DollarSign size={24} /> Spendings Management
        </h1>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          <Plus size={16} style={{ marginRight: "8px" }} />
          Add Spending
        </button>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-section">
          <div className="search-input-container">
            <Search size={20} />
            <input
              type="text"
              className="search-input"
              placeholder="Search spendings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

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
              <label>Category:</label>
              <select
                className="form-input"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
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
            <h3>Total Spending</h3>
            <p className="amount">₹{totalSpending.toFixed(2)}</p>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon">
            <Calendar size={24} />
          </div>
          <div className="card-content">
            <h3>Total Entries</h3>
            <p className="amount">{filteredSpendings.length}</p>
          </div>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>
                <DollarSign size={24} />
                {editingSpending ? "Edit Spending" : "Add New Spending"}
              </h2>
              <button onClick={resetForm} className="btn-close">
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="form">
              <div className="modal-content">
                <div className="form-section">
                  <div className="form-section-title">
                    Spending Details
                  </div>
                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label className="required">Description</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="What was this expense for?"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="required">Amount (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        value={formData.amount}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            amount: e.target.value,
                          }))
                        }
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label className="required">Category</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.category}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            category: e.target.value,
                          }))
                        }
                        list="categories"
                        placeholder="Select or enter category"
                        required
                      />
                      <datalist id="categories">
                        {categories.map((category) => (
                          <option key={category} value={category} />
                        ))}
                      </datalist>
                    </div>
                    <div className="form-group">
                      <label className="required">Date</label>
                      <input
                        type="date"
                        className="form-input"
                        value={formData.spendingDate}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            spendingDate: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="form-section-title">
                    Payment Information
                  </div>
                  <div className="form-group">
                    <label>Payment Method</label>
                    <select
                      className="form-input"
                      value={formData.paymentMethod}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          paymentMethod: e.target.value,
                        }))
                      }
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
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
                      placeholder="Additional notes (optional)"
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
                  {editingSpending ? "Update" : "Add"} Spending
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Spendings List */}
      <div className="content-section">
        {loading ? (
          <div className="loading">Loading spendings...</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Payment Method</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSpendings.map((spending) => (
                  <tr key={spending.id}>
                    <td>{formatDate(spending.spending_date)}</td>
                    <td>{spending.description}</td>
                    <td>
                      <span className="category-tag">{spending.category}</span>
                    </td>
                    <td className="amount">₹{spending.amount.toFixed(2)}</td>
                    <td>
                      <span
                        className={`payment-method ${spending.payment_method}`}
                      >
                        {spending.payment_method
                          .replace("_", " ")
                          .toUpperCase()}
                      </span>
                    </td>
                    <td>{spending.notes || "-"}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => handleEdit(spending)}
                          className="btn-icon"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(spending.id)}
                          className="btn-icon btn-danger"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredSpendings.length === 0 && (
              <div className="empty-state">
                <DollarSign size={48} />
                <h3>No spendings found</h3>
                <p>Add your first spending entry to get started.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Spendings;

// Helper to get local date and time in YYYY-MM-DD HH:mm:ss
function getLocalDateTimeString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

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
