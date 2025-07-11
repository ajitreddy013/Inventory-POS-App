import React, { useEffect, useState } from "react";
import {
  getPendingBills,
  clearPendingBill,
  deletePendingBill,
  generateBill,
} from "../services/billService";
import {
  Clock,
  CheckCircle,
  Trash2,
  Eye,
  X,
  User,
  Phone,
  Calendar,
  DollarSign,
  FileText,
  AlertCircle,
  Search,
  Printer,
  FileDown,
} from "lucide-react";

const PendingBills = () => {
  const [pendingBills, setPendingBills] = useState([]);
  const [filteredBills, setFilteredBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [generatingBillId, setGeneratingBillId] = useState(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);

  useEffect(() => {
    fetchPendingBills();
  }, []);

  // Filter bills based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredBills(pendingBills);
    } else {
      const filtered = pendingBills.filter(bill => 
        bill.bill_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bill.customer_name && bill.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (bill.customer_phone && bill.customer_phone.includes(searchTerm)) ||
        (bill.table_number && bill.table_number.toString().includes(searchTerm))
      );
      setFilteredBills(filtered);
    }
  }, [searchTerm, pendingBills]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  const fetchPendingBills = async () => {
    try {
      const bills = await getPendingBills();
      setPendingBills(bills);
      setFilteredBills(bills);
    } catch (error) {
      console.error("Failed to fetch pending bills", error);
      alert("Failed to load pending bills");
    } finally {
      setLoading(false);
    }
  };

  const handleClearBill = async (id) => {
    if (!window.confirm("Are you sure you want to clear this pending bill?")) {
      return;
    }

    setProcessing(true);
    try {
      const result = await clearPendingBill(id);
      if (result.success) {
        const updatedBills = pendingBills.filter((bill) => bill.id !== id);
        setPendingBills(updatedBills);
        setFilteredBills(updatedBills.filter(bill => 
          bill.bill_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (bill.customer_name && bill.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (bill.customer_phone && bill.customer_phone.includes(searchTerm)) ||
          (bill.table_number && bill.table_number.toString().includes(searchTerm))
        ));
        alert(`Bill cleared successfully! Sale number: ${result.saleNumber}`);
        // Close modal if it's open and showing this bill
        if (selectedBill && selectedBill.id === id) {
          closeDetails();
        }
      }
    } catch (error) {
      console.error("Failed to clear pending bill", error);
      alert("Failed to clear pending bill");
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteBill = async (id) => {
    if (!window.confirm("Are you sure you want to delete this pending bill?")) {
      return;
    }

    setProcessing(true);
    try {
      await deletePendingBill(id);
      const updatedBills = pendingBills.filter((bill) => bill.id !== id);
      setPendingBills(updatedBills);
      setFilteredBills(updatedBills.filter(bill => 
        bill.bill_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bill.customer_name && bill.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (bill.customer_phone && bill.customer_phone.includes(searchTerm)) ||
        (bill.table_number && bill.table_number.toString().includes(searchTerm))
      ));
      alert("Pending bill deleted successfully!");
      // Close modal if it's open and showing this bill
      if (selectedBill && selectedBill.id === id) {
        closeDetails();
      }
    } catch (error) {
      console.error("Failed to delete pending bill", error);
      alert("Failed to delete pending bill");
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateBill = async (bill) => {
    setProcessing(true);
    setGeneratingBillId(bill.id);
    try {
      // Get bar settings for the PDF
      const barSettings = await window.electronAPI.getBarSettings();
      
      // Format the bill data for PDF generation
      const billData = {
        saleNumber: bill.bill_number,
        saleType: bill.sale_type || 'parcel',
        tableNumber: bill.table_number || null,
        customerName: bill.customer_name || 'Walk-in Customer',
        customerPhone: bill.customer_phone || '',
        items: bill.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
        subtotal: bill.subtotal,
        taxAmount: bill.tax_amount || 0,
        discountAmount: bill.discount_amount || 0,
        totalAmount: bill.total_amount,
        paymentMethod: bill.payment_method || 'Cash',
        saleDate: bill.created_at,
        barSettings: barSettings,
      };
      
      const response = await generateBill(billData);
      if (response.success) {
        alert(`Bill generated successfully! Saved to: ${response.filePath}`);
      } else {
        alert(`Failed to generate bill: ${response.error}`);
      }
    } catch (error) {
      console.error("Failed to generate bill", error);
      alert("Bill generation failed");
    } finally {
      setProcessing(false);
      setGeneratingBillId(null);
    }
  };

  const handleGenerateAllBills = async () => {
    if (filteredBills.length === 0) {
      alert("No bills to generate report for!");
      return;
    }

    if (!window.confirm(`Are you sure you want to generate a report for ${filteredBills.length} pending bill(s)?`)) {
      return;
    }

    setProcessing(true);
    setBulkGenerating(true);

    try {
      const response = await window.electronAPI.exportPendingBillsReport(filteredBills);
      if (response.success) {
        alert(`Pending bills report generated successfully! Saved to: ${response.filePath}`);
      } else {
        alert(`Failed to generate report: ${response.error}`);
      }
    } catch (error) {
      console.error("Failed to generate pending bills report", error);
      alert("Failed to generate pending bills report");
    } finally {
      setProcessing(false);
      setBulkGenerating(false);
      setGeneratingBillId(null);
    }
  };

  const handleViewDetails = (bill) => {
    setSelectedBill(bill);
    setShowDetails(true);
  };

  const closeDetails = () => {
    setSelectedBill(null);
    setShowDetails(false);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="pending-bills">
      <div className="page-header">
        <h1>
          <Clock size={24} /> Pending Bills
        </h1>
        <div className="header-actions">
          <button 
            onClick={handleGenerateAllBills}
            disabled={processing || filteredBills.length === 0}
            className="btn btn-info"
            title="Generate pending bills report"
          >
            {processing ? 'Generating Report...' : <><FileDown size={16} /> Generate Bills Report</>}
          </button>
          <button onClick={fetchPendingBills} className="btn btn-secondary">
            Refresh
          </button>
        </div>
      </div>

      {/* Search Section */}
      <div className="search-section">
        <h3>Search Bills</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div className="search-input-container">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search by bill number, customer name, phone, or table number..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
            />
          </div>
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="btn btn-secondary"
              style={{ minWidth: '80px' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '400px',
          fontSize: '1.1rem',
          color: '#6c757d' 
        }}>
          <p>Loading pending bills...</p>
        </div>
      ) : filteredBills.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          textAlign: 'center',
          color: '#6c757d',
          margin: '20px 30px'
        }}>
          <AlertCircle size={48} style={{ marginBottom: '20px', opacity: 0.5 }} />
          <h3 style={{ marginBottom: '10px', fontSize: '1.5rem' }}>
            {searchTerm ? 'No Bills Found' : 'No Pending Bills'}
          </h3>
          <p style={{ fontSize: '1rem', opacity: 0.8 }}>
            {searchTerm 
              ? `No bills match your search term "${searchTerm}"` 
              : 'All bills have been processed or no bills are pending.'
            }
          </p>
        </div>
      ) : (
<div className="pending-bills-content">
          <div className="summary-cards">
            <div className="summary-card">
              <h3>{searchTerm ? 'Found Bills' : 'Total Pending'}</h3>
              <div className="value">
                {searchTerm ? `${filteredBills.length} / ${pendingBills.length}` : pendingBills.length}
              </div>
            </div>
            <div className="summary-card">
              <h3>{searchTerm ? 'Found Amount' : 'Total Amount'}</h3>
              <div className="value">
                ₹{filteredBills.reduce((sum, bill) => sum + bill.total_amount, 0).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Bill Number</th>
                  <th>Customer</th>
                  <th>Table/Type</th>
                  <th>Items</th>
                  <th>Total Amount</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((bill) => (
                  <tr key={bill.id}>
                    <td className="bill-number">{bill.bill_number}</td>
                    <td className="customer-info">
                      <div>{bill.customer_name || "Walk-in Customer"}</div>
                      {bill.customer_phone && (
                        <div className="phone">{bill.customer_phone}</div>
                      )}
                    </td>
                    <td className="table-info">
                      <div>{bill.sale_type}</div>
                      {bill.table_number && (
                        <div className="table-number">Table {bill.table_number}</div>
                      )}
                    </td>
                    <td className="items-count">
                      {bill.items.length} item{bill.items.length > 1 ? 's' : ''}
                    </td>
                    <td className="total-amount">
                      ₹{bill.total_amount.toFixed(2)}
                    </td>
                    <td className="created-date">
                      {formatDate(bill.created_at)}
                    </td>
                    <td className="actions">
                      <div className="action-buttons">
                        <button
                          onClick={() => handleViewDetails(bill)}
                          className="btn btn-sm btn-secondary"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleGenerateBill(bill)}
                          disabled={processing}
                          className="btn btn-sm btn-info"
                          title="Generate Bill PDF"
                        >
                          {generatingBillId === bill.id ? '...' : <FileDown size={16} />}
                        </button>
                        <button
                          onClick={() => handleClearBill(bill.id)}
                          disabled={processing}
                          className="btn btn-sm btn-success"
                          title="Process Bill"
                        >
                          <CheckCircle size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteBill(bill.id)}
                          disabled={processing}
                          className="btn btn-sm btn-danger"
                          title="Delete Bill"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bill Details Modal */}
      {showDetails && selectedBill && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>
                <FileText size={24} /> Bill Details
              </h2>
              <button onClick={closeDetails} className="close-btn">
                <X size={20} />
              </button>
            </div>
            <div className="modal-content">
              <div className="bill-details">
                <div className="bill-info-grid">
                  <div className="info-item">
                    <strong>Bill Number:</strong>
                    <span>{selectedBill.bill_number}</span>
                  </div>
                  <div className="info-item">
                    <strong>Sale Type:</strong>
                    <span>{selectedBill.sale_type}</span>
                  </div>
                  {selectedBill.table_number && (
                    <div className="info-item">
                      <strong>Table Number:</strong>
                      <span>{selectedBill.table_number}</span>
                    </div>
                  )}
                  <div className="info-item">
                    <strong>Customer:</strong>
                    <span>{selectedBill.customer_name || "Walk-in Customer"}</span>
                  </div>
                  {selectedBill.customer_phone && (
                    <div className="info-item">
                      <strong>Phone:</strong>
                      <span>{selectedBill.customer_phone}</span>
                    </div>
                  )}
                  <div className="info-item">
                    <strong>Payment Method:</strong>
                    <span>{selectedBill.payment_method}</span>
                  </div>
                  <div className="info-item">
                    <strong>Created:</strong>
                    <span>{formatDate(selectedBill.created_at)}</span>
                  </div>
                </div>

                <div className="items-section">
                  <h3>Items</h3>
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBill.items.map((item, index) => (
                        <tr key={index}>
                          <td>{item.name}</td>
                          <td>{item.quantity}</td>
                          <td>₹{item.unitPrice.toFixed(2)}</td>
                          <td>₹{item.totalPrice.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bill-summary">
                  <div className="summary-row">
                    <span>Subtotal:</span>
                    <span>₹{selectedBill.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedBill.discount_amount > 0 && (
                    <div className="summary-row">
                      <span>Discount:</span>
                      <span>-₹{selectedBill.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedBill.tax_amount > 0 && (
                    <div className="summary-row">
                      <span>Tax:</span>
                      <span>₹{selectedBill.tax_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="summary-row total">
                    <span>Total:</span>
                    <span>₹{selectedBill.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button
                onClick={() => handleGenerateBill(selectedBill)}
                disabled={processing}
                className="btn btn-info"
              >
                {processing ? 'Generating...' : <><FileDown size={16} /> Generate Bill</>}
              </button>
              <button
                onClick={() => handleClearBill(selectedBill.id)}
                disabled={processing}
                className="btn btn-success"
              >
                <CheckCircle size={16} /> Process Bill
              </button>
              <button
                onClick={() => handleDeleteBill(selectedBill.id)}
                disabled={processing}
                className="btn btn-danger"
              >
                <Trash2 size={16} /> Delete Bill
              </button>
              <button onClick={closeDetails} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingBills;

