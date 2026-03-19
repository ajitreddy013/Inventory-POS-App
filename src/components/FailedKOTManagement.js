/* eslint-disable no-console */
import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  RefreshCw,
  CheckCircle,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './FailedKOTManagement.css';

/**
 * Failed KOT Management Component
 *
 * Displays list of failed KOTs and allows manual retry
 * Requirements: 22.4, 23.4
 */
const FailedKOTManagement = () => {
  const navigate = useNavigate();
  const [failedKOTs, setFailedKOTs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState({});
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => {
    loadFailedKOTs();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadFailedKOTs, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadFailedKOTs = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.invoke('kot:get-failed-kots');
      if (result.success) {
        setFailedKOTs(result.failedKOTs || []);
        setLastRefresh(new Date());
      } else {
        console.error('Failed to load failed KOTs:', result.error);
      }
    } catch (error) {
      console.error('Error loading failed KOTs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (failedKOTId) => {
    setRetrying((prev) => ({ ...prev, [failedKOTId]: true }));
    try {
      const result = await window.electronAPI.invoke(
        'kot:retry-failed-kot',
        failedKOTId
      );

      if (result.success) {
        // Remove from list on success
        setFailedKOTs((prev) => prev.filter((kot) => kot.id !== failedKOTId));
        alert(`KOT printed successfully!`);
      } else {
        alert(
          `Retry failed: ${result.error}\nRetries remaining: ${result.retriesRemaining || 0}`
        );
        // Reload to get updated retry count
        await loadFailedKOTs();
      }
    } catch (error) {
      console.error('Error retrying KOT:', error);
      alert('Failed to retry KOT');
    } finally {
      setRetrying((prev) => ({ ...prev, [failedKOTId]: false }));
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  const getRetryStatusColor = (retryCount) => {
    if (retryCount === 0) return 'status-new';
    if (retryCount === 1) return 'status-warning';
    if (retryCount >= 2) return 'status-critical';
    return '';
  };

  return (
    <div className="failed-kot-management">
      <div className="header">
        <div className="title-section">
          <button
            onClick={() => navigate('/settings')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              marginRight: 8,
              display: 'flex',
              alignItems: 'center',
              color: '#4f46e5',
            }}
          >
            <ArrowLeft size={22} />
          </button>
          <AlertCircle className="icon" size={24} />
          <h2>Failed KOT Management</h2>
        </div>
        <div className="actions">
          {lastRefresh && (
            <span className="last-refresh">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            className="btn-refresh"
            onClick={loadFailedKOTs}
            disabled={loading}
          >
            <RefreshCw className={loading ? 'spinning' : ''} size={18} />
            Refresh
          </button>
        </div>
      </div>

      {loading && failedKOTs.length === 0 ? (
        <div className="loading-state">
          <RefreshCw className="spinning" size={32} />
          <p>Loading failed KOTs...</p>
        </div>
      ) : failedKOTs.length === 0 ? (
        <div className="empty-state">
          <CheckCircle size={48} className="success-icon" />
          <h3>No Failed KOTs</h3>
          <p>All KOTs have been printed successfully!</p>
        </div>
      ) : (
        <div className="failed-kots-list">
          <div className="list-header">
            <span className="col-kot">KOT Number</span>
            <span className="col-order">Order</span>
            <span className="col-table">Table</span>
            <span className="col-printer">Printer</span>
            <span className="col-error">Error</span>
            <span className="col-retry">Retries</span>
            <span className="col-time">Failed At</span>
            <span className="col-actions">Actions</span>
          </div>

          {failedKOTs.map((kot) => (
            <div key={kot.id} className="failed-kot-item">
              <span className="col-kot">
                <strong>{kot.kotNumber}</strong>
              </span>
              <span className="col-order">
                {kot.kotData?.orderNumber || 'N/A'}
              </span>
              <span className="col-table">
                {kot.kotData?.tableNumber || 'N/A'}
              </span>
              <span className="col-printer">
                <span className={`printer-badge ${kot.printerType}`}>
                  {kot.printerType}
                </span>
              </span>
              <span className="col-error" title={kot.errorMessage}>
                {kot.errorMessage?.substring(0, 50)}
                {kot.errorMessage?.length > 50 ? '...' : ''}
              </span>
              <span className="col-retry">
                <span
                  className={`retry-badge ${getRetryStatusColor(kot.retryCount)}`}
                >
                  {kot.retryCount}/3
                </span>
              </span>
              <span className="col-time">{formatTimestamp(kot.createdAt)}</span>
              <span className="col-actions">
                <button
                  className="btn-retry"
                  onClick={() => handleRetry(kot.id)}
                  disabled={retrying[kot.id] || kot.retryCount >= 3}
                  title={
                    kot.retryCount >= 3
                      ? 'Maximum retries reached'
                      : 'Retry printing'
                  }
                >
                  {retrying[kot.id] ? (
                    <>
                      <RefreshCw className="spinning" size={16} />
                      Retrying...
                    </>
                  ) : kot.retryCount >= 3 ? (
                    <>
                      <XCircle size={16} />
                      Max Retries
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} />
                      Retry
                    </>
                  )}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {failedKOTs.length > 0 && (
        <div className="footer-info">
          <AlertCircle size={16} />
          <span>
            {failedKOTs.length} failed KOT{failedKOTs.length !== 1 ? 's' : ''}{' '}
            pending retry
          </span>
        </div>
      )}
    </div>
  );
};

export default FailedKOTManagement;
