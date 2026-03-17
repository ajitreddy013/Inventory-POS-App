import React, { useEffect, useState, useCallback } from 'react';
import {
  Clock, Trash2, Eye, X, FileText, AlertCircle, Search, CheckCircle, Loader, User, Phone, ChevronDown
} from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Newest First' },
  { value: 'date_asc', label: 'Oldest First' },
  { value: 'customer_asc', label: 'Customer A→Z' },
  { value: 'customer_desc', label: 'Customer Z→A' },
  { value: 'amount_desc', label: 'Amount High→Low' },
];

const PendingBills = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [selectedBill, setSelectedBill] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [settleMode, setSettleMode] = useState(false);
  const [settlePayment, setSettlePayment] = useState('cash');

  const fetchBills = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await window.electronAPI.getFirebasePendingBills();
      if (!res?.success) throw new Error(res?.error || 'Failed to load');
      setBills(res.bills || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const filtered = bills.filter(b => {
    if (!searchTerm.trim()) return true;
    const t = searchTerm.toLowerCase();
    return (
      (b.customerName || '').toLowerCase().includes(t) ||
      (b.customerPhone || '').includes(t) ||
      (b.tableName || '').toLowerCase().includes(t)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'date_asc': return new Date(a.createdAt) - new Date(b.createdAt);
      case 'customer_asc': return (a.customerName || '').localeCompare(b.customerName || '');
      case 'customer_desc': return (b.customerName || '').localeCompare(a.customerName || '');
      case 'amount_desc': return (b.totalAmount || 0) - (a.totalAmount || 0);
      default: return new Date(b.createdAt) - new Date(a.createdAt);
    }
  });

  const handleSettle = async (bill) => {
    setProcessing(true);
    try {
      const res = await window.electronAPI.settlePendingBill(bill.id, [{ type: settlePayment, amount: bill.totalAmount }]);
      if (!res?.success) throw new Error(res?.error || 'Failed to settle');
      setBills(prev => prev.filter(b => b.id !== bill.id));
      setSelectedBill(null); setSettleMode(false);
    } catch (e) { setError(e.message); }
    finally { setProcessing(false); }
  };

  const handleDelete = async (billId) => {
    if (!window.confirm('Delete this pending bill?')) return;
    setProcessing(true);
    try {
      const res = await window.electronAPI.deleteFirebasePendingBill(billId);
      if (!res?.success) throw new Error(res?.error || 'Failed to delete');
      setBills(prev => prev.filter(b => b.id !== billId));
      if (selectedBill?.id === billId) setSelectedBill(null);
    } catch (e) { setError(e.message); }
    finally { setProcessing(false); }
  };

  const fmt = (d) => d ? new Date(d).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12:true }) : '—';

  return (
    <div style={{ padding: '1.5rem', fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem', fontWeight: 700, color: '#212529' }}>
          <Clock size={24} color="#DC3545" /> Pending Bills
          <span style={{ background: '#DC3545', color: '#fff', borderRadius: '999px', fontSize: '0.8rem', padding: '0.1rem 0.6rem', marginLeft: '0.25rem' }}>{bills.length}</span>
        </h1>
        <button onClick={fetchBills} style={{ padding: '0.5rem 1rem', border: '1px solid #DEE2E6', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}>
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'inherit' }}>&times;</button>
        </div>
      )}

      {/* Search + Sort bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#6c757d' }} />
          <input
            type="text"
            placeholder="Search by customer name, phone or table..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.25rem', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{ padding: '0.6rem 2rem 0.6rem 0.75rem', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '0.875rem', appearance: 'none', background: '#fff', cursor: 'pointer' }}
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6c757d' }} />
        </div>
      </div>

      {/* Summary */}
      {!loading && sorted.length > 0 && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ background: '#F8F9FA', border: '1px solid #DEE2E6', borderRadius: '8px', padding: '0.75rem 1.25rem', flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: '#6c757d', marginBottom: '0.25rem' }}>Showing</div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem', color: '#212529' }}>{sorted.length} bills</div>
          </div>
          <div style={{ background: '#F8F9FA', border: '1px solid #DEE2E6', borderRadius: '8px', padding: '0.75rem 1.25rem', flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: '#6c757d', marginBottom: '0.25rem' }}>Total Pending</div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem', color: '#DC3545' }}>₹{sorted.reduce((s, b) => s + (b.totalAmount || 0), 0).toFixed(2)}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: '#6c757d' }}>
          <Loader size={32} className="spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#6c757d' }}>
          <Clock size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <p style={{ fontSize: '1.1rem' }}>{searchTerm ? 'No bills match your search' : 'No pending bills'}</p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #DEE2E6', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#F8F9FA', borderBottom: '2px solid #DEE2E6' }}>
                {['Customer', 'Phone', 'Table', 'Items', 'Amount', 'Date', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#495057', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((bill, i) => (
                <tr key={bill.id} style={{ borderBottom: '1px solid #F1F3F5', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#212529' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <User size={14} color="#6c757d" /> {bill.customerName || '—'}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#495057' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Phone size={14} color="#6c757d" /> {bill.customerPhone || '—'}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#495057' }}>{bill.tableName || '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#495057' }}>{(bill.items || []).length} item{(bill.items || []).length !== 1 ? 's' : ''}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#DC3545' }}>₹{(bill.totalAmount || 0).toFixed(2)}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#6c757d', whiteSpace: 'nowrap' }}>{fmt(bill.createdAt)}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={() => { setSelectedBill(bill); setSettleMode(false); }} title="View" style={btnStyle('#6c757d')}>
                        <Eye size={15} />
                      </button>
                      <button onClick={() => { setSelectedBill(bill); setSettleMode(true); }} title="Settle" style={btnStyle('#198754')} disabled={processing}>
                        <CheckCircle size={15} />
                      </button>
                      <button onClick={() => handleDelete(bill.id)} title="Delete" style={btnStyle('#DC3545')} disabled={processing}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail / Settle Modal */}
      {selectedBill && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '480px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #DEE2E6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={20} color="#DC3545" /> {settleMode ? 'Settle Bill' : 'Bill Details'}
              </h2>
              <button onClick={() => { setSelectedBill(null); setSettleMode(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {[
                  ['Customer', selectedBill.customerName],
                  ['Phone', selectedBill.customerPhone],
                  ['Table', selectedBill.tableName],
                  ['Date', fmt(selectedBill.createdAt)],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: '#F8F9FA', borderRadius: '6px', padding: '0.6rem 0.75rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#6c757d', marginBottom: '0.2rem' }}>{k}</div>
                    <div style={{ fontWeight: 600, color: '#212529', fontSize: '0.875rem' }}>{v || '—'}</div>
                  </div>
                ))}
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '1rem' }}>
                <thead>
                  <tr style={{ background: '#F8F9FA' }}>
                    {['Item', 'Qty', 'Rate', 'Total'].map(h => (
                      <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: h === 'Item' ? 'left' : 'right', fontWeight: 600, color: '#495057' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(selectedBill.items || []).map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F3F5' }}>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{item.name}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{item.quantity}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>₹{Number(item.unitPrice).toFixed(2)}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>₹{Number(item.totalPrice).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ borderTop: '2px solid #DEE2E6', paddingTop: '0.75rem' }}>
                {selectedBill.discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6c757d', marginBottom: '0.25rem' }}>
                    <span>Discount</span><span>-₹{selectedBill.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem', color: '#DC3545' }}>
                  <span>Total</span><span>₹{(selectedBill.totalAmount || 0).toFixed(2)}</span>
                </div>
              </div>

              {settleMode && (
                <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#F8F9FA', borderRadius: '8px' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#212529' }}>Select payment method:</p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    {['cash', 'upi', 'card'].map(m => (
                      <button key={m} onClick={() => setSettlePayment(m)}
                        style={{ flex: 1, padding: '0.6rem', border: `2px solid ${settlePayment === m ? '#198754' : '#DEE2E6'}`, borderRadius: '6px', background: settlePayment === m ? '#d1fae5' : '#fff', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', fontSize: '0.875rem' }}>
                        {m.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => handleSettle(selectedBill)}
                    disabled={processing}
                    style={{ width: '100%', padding: '0.75rem', background: '#198754', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    {processing ? <Loader size={16} className="spin" /> : <CheckCircle size={16} />}
                    {processing ? 'Settling...' : `Settle ₹${(selectedBill.totalAmount || 0).toFixed(2)} via ${settlePayment.toUpperCase()}`}
                  </button>
                </div>
              )}
            </div>

            {!settleMode && (
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #DEE2E6', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setSettleMode(true)} style={{ padding: '0.6rem 1.25rem', background: '#198754', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle size={15} /> Settle
                </button>
                <button onClick={() => handleDelete(selectedBill.id)} disabled={processing} style={{ padding: '0.6rem 1.25rem', background: '#DC3545', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Trash2 size={15} /> Delete
                </button>
                <button onClick={() => setSelectedBill(null)} style={{ padding: '0.6rem 1.25rem', background: '#F8F9FA', color: '#495057', border: '1px solid #DEE2E6', borderRadius: '6px', cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const btnStyle = (color) => ({
  padding: '0.35rem 0.5rem',
  background: `${color}15`,
  color,
  border: `1px solid ${color}40`,
  borderRadius: '5px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
});

export default PendingBills;
