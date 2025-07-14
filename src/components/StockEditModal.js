import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import { Save, X } from 'lucide-react';

const StockEditModal = ({ product, onSave, onCancel, isOpen }) => {
  const [godownStock, setGodownStock] = useState(product?.godown_stock || 0);
  const [counterStock, setCounterStock] = useState(product?.counter_stock || 0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (product) {
      setGodownStock(product.godown_stock);
      setCounterStock(product.counter_stock);
    }
  }, [product]);

  useEffect(() => {
    if (isOpen) {
      // Small delay to trigger animation
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (product) {
      onSave(product.id, parseInt(godownStock), parseInt(counterStock));
    }
  };

  const handleCancel = useCallback(() => {
    setIsVisible(false);
    // Wait for animation to complete before closing
    setTimeout(() => {
      onCancel();
    }, 200);
  }, [onCancel]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  }, [handleCancel]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !product) return null;

  const modalContent = (
    <div 
      className={`stock-edit-modal-overlay ${isVisible ? 'visible' : ''}`}
      onClick={handleOverlayClick}
    >
      <div className={`stock-edit-modal ${isVisible ? 'visible' : ''}`}>
        <div className="stock-edit-modal-header">
          <h3>Edit Stock for {product.name}</h3>
          <button 
            onClick={handleCancel} 
            className="close-btn"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="stock-edit-modal-content">
          <div className="product-info">
            <div className="product-details">
              <div className="detail-item">
                <span className="label">Product:</span>
                <span className="value">{product.name}</span>
              </div>
              <div className="detail-item">
                <span className="label">SKU:</span>
                <span className="value">{product.sku}</span>
              </div>
              <div className="detail-item">
                <span className="label">Category:</span>
                <span className="value">{product.category || '-'}</span>
              </div>
            </div>
          </div>

          <div className="stock-form-grid">
            <div className="form-group">
              <label htmlFor="godownStock">
                <span className="label-text">Godown Stock</span>
                <div className="input-with-current">
                  <input
                    id="godownStock"
                    type="number"
                    value={godownStock}
                    onChange={(e) => setGodownStock(e.target.value)}
                    min="0"
                    className="stock-input"
                  />
                  <span className="current-value">
                    Current: {product.godown_stock}
                  </span>
                </div>
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="counterStock">
                <span className="label-text">Counter Stock</span>
                <div className="input-with-current">
                  <input
                    id="counterStock"
                    type="number"
                    value={counterStock}
                    onChange={(e) => setCounterStock(e.target.value)}
                    min="0"
                    className="stock-input"
                  />
                  <span className="current-value">
                    Current: {product.counter_stock}
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="stock-summary">
            <div className="summary-item">
              <span className="label">Total Current Stock:</span>
              <span className="value">{product.godown_stock + product.counter_stock}</span>
            </div>
            <div className="summary-item">
              <span className="label">Total New Stock:</span>
              <span className="value">{parseInt(godownStock || 0) + parseInt(counterStock || 0)}</span>
            </div>
          </div>
        </div>

        <div className="stock-edit-modal-actions">
          <button 
            onClick={handleSave} 
            className="btn btn-primary"
            disabled={!godownStock && !counterStock}
          >
            <Save size={16} />
            Save Changes
          </button>
          <button 
            onClick={handleCancel} 
            className="btn btn-secondary"
          >
            <X size={16} />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

StockEditModal.propTypes = {
  product: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    sku: PropTypes.string.isRequired,
    category: PropTypes.string,
    godown_stock: PropTypes.number.isRequired,
    counter_stock: PropTypes.number.isRequired,
  }),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired
};

export default StockEditModal;
