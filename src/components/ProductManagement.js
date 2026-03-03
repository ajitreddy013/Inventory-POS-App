import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Package, Plus, Edit, Trash2, Search, Filter } from 'lucide-react';

const ProductManagement = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.invoke('firebase:get-menu-items', {
        includeInactive: false
      });
      
      if (result.success) {
        setProducts(result.items || []);
      } else {
        showNotification(result.error || 'Failed to load menu items', 'error');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load products:', error);
      showNotification('Failed to load menu items', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const result = await window.electronAPI.invoke('firebase:get-menu-categories');
      
      if (result.success) {
        setCategories(result.categories || []);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load categories:', error);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.category && product.category.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const ProductModal = ({ product, onClose, onSave }) => {
    const [formData, setFormData] = useState({
      name: product?.name || '',
      category: product?.category || '',
      price: product?.price || '',
      description: product?.description || ''
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const validateForm = () => {
      const newErrors = {};
      if (!formData.name.trim()) newErrors.name = 'Menu item name is required';
      if (!formData.category.trim()) newErrors.category = 'Category is required';
      if (!formData.price || formData.price <= 0) newErrors.price = 'Valid price is required';
      return newErrors;
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      const validationErrors = validateForm();
      
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
      
      setIsSubmitting(true);
      setErrors({});
      
      try {
        await onSave(formData);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to save menu item:', error);
        setErrors({ submit: 'Failed to save menu item. Please try again.' });
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleInputChange = (field, value) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      // Clear error when user starts typing
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: '' }));
      }
    };

    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-header">
            <h3>
              <Package size={24} />
              {product ? 'Edit Menu Item' : 'Add New Menu Item'}
            </h3>
            <button onClick={onClose} className="close-btn" type="button">
              ×
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-content">
              {errors.submit && (
                <div className="form-error" style={{ marginBottom: '20px', padding: '12px', background: '#fee', borderRadius: '8px' }}>
                  {errors.submit}
                </div>
              )}
              
              <div className="form-section">
                <div className="form-section-title">
                  Menu Item Information
                </div>
                
                <div className="form-group">
                  <label className="required">Item Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className={`form-input ${errors.name ? 'error' : ''}`}
                    placeholder="e.g., Chicken Biryani, Masala Dosa"
                    required
                  />
                  {errors.name && <div className="form-error">{errors.name}</div>}
                </div>
                
                <div className="form-grid two-columns">
                  <div className="form-group">
                    <label className="required">Category</label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className={`form-input ${errors.category ? 'error' : ''}`}
                      placeholder="e.g., Main Course, Appetizer, Dessert"
                      list="category-suggestions"
                      required
                    />
                    <datalist id="category-suggestions">
                      {categories.map(cat => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                    {errors.category && <div className="form-error">{errors.category}</div>}
                  </div>
                  
                  <div className="form-group">
                    <label className="required">Price (₹)</label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || '')}
                      className={`form-input ${errors.price ? 'error' : ''}`}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      required
                    />
                    {errors.price && <div className="form-error">{errors.price}</div>}
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Description (Optional)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="form-input"
                    rows="3"
                    placeholder="Brief description of the menu item"
                  />
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button 
                type="submit" 
                className={`btn btn-primary ${isSubmitting ? 'loading' : ''}`}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : (product ? 'Update Item' : 'Add Item')}
              </button>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  ProductModal.propTypes = {
    product: PropTypes.object,
    onClose: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
  };

  const handleSaveProduct = async (productData) => {
    try {
      setLoading(true);
      
      let result;
      if (editingProduct) {
        result = await window.electronAPI.invoke('firebase:update-menu-item', editingProduct.id, productData);
      } else {
        result = await window.electronAPI.invoke('firebase:create-menu-item', productData);
      }
      
      if (result.success) {
        await loadProducts();
        await loadCategories();
        setShowModal(false);
        setEditingProduct(null);
        showNotification(
          editingProduct ? 'Menu item updated successfully' : 'Menu item created successfully',
          'success'
        );
      } else {
        showNotification(result.error || 'Failed to save menu item', 'error');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save menu item:', error);
      showNotification('Failed to save menu item', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (productId, productName) => {
    if (window.confirm(`Are you sure you want to delete "${productName}"? This action cannot be undone if there are no active orders.`)) {
      try {
        setLoading(true);
        const result = await window.electronAPI.invoke('firebase:delete-menu-item', productId);
        
        if (result.success) {
          await loadProducts();
          showNotification('Menu item deleted successfully', 'success');
        } else {
          showNotification(result.error || 'Failed to delete menu item', 'error');
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to delete menu item:', error);
        showNotification('Failed to delete menu item', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleToggleOutOfStock = async (productId, currentStatus) => {
    try {
      setLoading(true);
      const result = await window.electronAPI.invoke('firebase:mark-out-of-stock', productId, !currentStatus);
      
      if (result.success) {
        await loadProducts();
        showNotification(
          !currentStatus ? 'Item marked as out of stock' : 'Item marked as in stock',
          'success'
        );
      } else {
        showNotification(result.error || 'Failed to update stock status', 'error');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to update stock status:', error);
      showNotification('Failed to update stock status', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="product-management">
      {/* Notification */}
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}
      
      <div className="page-header">
        <h1><Package size={24} /> Menu Management</h1>
        <button 
          onClick={() => setShowModal(true)}
          className="btn btn-primary"
          disabled={loading}
        >
          <Plus size={16} /> Add Menu Item
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <h3>Total Menu Items</h3>
          <div className="value">{products.length}</div>
        </div>
        <div className="summary-card">
          <h3>Categories</h3>
          <div className="value">{categories.length}</div>
        </div>
        <div className="summary-card">
          <h3>Out of Stock</h3>
          <div className="value">
            {products.filter(p => p.isOutOfStock).length}
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="search-section">
        <div className="search-input-container">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search menu items by name, category, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-container">
          <Filter size={20} />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="filter-select"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#7f8c8d' }}>
          Loading...
        </div>
      )}

      {/* Menu Items Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>
                  {searchTerm || selectedCategory ? 'No menu items found matching your filters' : 'No menu items added yet'}
                </td>
              </tr>
            ) : (
              filteredProducts.map(product => (
                <tr key={product.id}>
                  <td>
                    <div>
                      <strong>{product.name}</strong>
                      {product.description && (
                        <>
                          <br />
                          <small style={{ color: '#7f8c8d' }}>
                            {product.description.length > 60 
                              ? product.description.substring(0, 60) + '...' 
                              : product.description}
                          </small>
                        </>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="category-badge">{product.category}</span>
                  </td>
                  <td>₹{product.price.toFixed(2)}</td>
                  <td>
                    <button
                      onClick={() => handleToggleOutOfStock(product.id, product.isOutOfStock)}
                      className={`status-badge ${product.isOutOfStock ? 'out-of-stock' : 'in-stock'}`}
                      disabled={loading}
                      title="Click to toggle stock status"
                    >
                      {product.isOutOfStock ? 'Out of Stock' : 'In Stock'}
                    </button>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => {
                          setEditingProduct(product);
                          setShowModal(true);
                        }}
                        className="btn btn-sm btn-secondary"
                        title="Edit Menu Item"
                        disabled={loading}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id, product.name)}
                        className="btn btn-sm btn-danger"
                        title="Delete Menu Item"
                        disabled={loading}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Product Modal */}
      {showModal && (
        <ProductModal
          product={editingProduct}
          onClose={() => {
            setShowModal(false);
            setEditingProduct(null);
          }}
          onSave={handleSaveProduct}
        />
      )}

      <style jsx>{`
        .notification {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 10000;
          animation: slideIn 0.3s ease-out;
        }
        
        .notification-success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }
        
        .notification-error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .filter-container {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
        }
        
        .filter-select {
          border: none;
          outline: none;
          font-size: 14px;
          cursor: pointer;
        }
        
        .category-badge {
          display: inline-block;
          padding: 4px 12px;
          background: #e3f2fd;
          color: #1976d2;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 500;
        }
        
        .status-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 500;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .status-badge:hover:not(:disabled) {
          opacity: 0.8;
        }
        
        .status-badge:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
        
        .status-badge.in-stock {
          background: #d4edda;
          color: #155724;
        }
        
        .status-badge.out-of-stock {
          background: #f8d7da;
          color: #721c24;
        }
      `}</style>
    </div>
  );
};

export default ProductManagement;
