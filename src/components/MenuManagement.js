import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit, Search, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import './MenuManagement.css';

const MenuManagement = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState('disconnected'); // 'connected', 'syncing', 'disconnected'

  useEffect(() => {
    loadMenuItems();
    loadCategories();
    
    // Subscribe to real-time menu item changes
    subscribeToMenuItems();
    
    // Cleanup on unmount
    return () => {
      unsubscribeFromAll();
    };
  }, []);

  const subscribeToMenuItems = async () => {
    try {
      // Subscribe to menu items
      const result = await window.electronAPI.invoke('firebase:subscribe-menu-items');
      if (result.success) {
        console.log('Subscribed to menu items changes');
        setSyncStatus('connected');
      }
      
      // Listen for menu item changes
      window.electronAPI.on('firebase:menu-items-changed', handleMenuItemsChanged);
      
      // Listen for errors
      window.electronAPI.on('firebase:menu-items-error', (error) => {
        console.error('Menu items sync error:', error);
        setSyncStatus('disconnected');
      });
    } catch (error) {
      console.error('Failed to subscribe to menu items:', error);
      setSyncStatus('disconnected');
    }
  };

  const handleMenuItemsChanged = (changes) => {
    console.log('Menu items changed:', changes);
    setSyncStatus('syncing');
    
    // Update local state based on changes
    setMenuItems(prevItems => {
      let updatedItems = [...prevItems];
      
      changes.forEach(change => {
        const { type, data } = change;
        
        if (type === 'added') {
          // Add new item if not already present
          if (!updatedItems.find(item => item.id === data.id)) {
            updatedItems.push(data);
          }
        } else if (type === 'modified') {
          // Update existing item
          const index = updatedItems.findIndex(item => item.id === data.id);
          if (index !== -1) {
            updatedItems[index] = data;
          }
        } else if (type === 'removed') {
          // Remove item
          updatedItems = updatedItems.filter(item => item.id !== data.id);
        }
      });
      
      return updatedItems;
    });
    
    // Update categories
    loadCategories();
    
    // Reset sync status after a short delay
    setTimeout(() => setSyncStatus('connected'), 500);
  };

  const unsubscribeFromAll = async () => {
    try {
      // Remove event listeners
      window.electronAPI.removeListener('firebase:menu-items-changed', handleMenuItemsChanged);
      window.electronAPI.removeListener('firebase:menu-items-error', () => {});
      
      // Unsubscribe from Firebase listeners
      await window.electronAPI.invoke('firebase:unsubscribe-all');
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
    }
  };

  const loadMenuItems = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.invoke('firebase:get-menu-items', {
        includeInactive: false
      });
      if (result.success) {
        setMenuItems(result.items);
      }
    } catch (error) {
      console.error('Failed to load menu items:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const result = await window.electronAPI.invoke('firebase:get-menu-categories');
      if (result.success) {
        setCategories(result.categories);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddItem = () => {
    setEditingItem(null);
    setShowTypeSelector(true);
  };

  const handleSelectProductType = (isBarItem) => {
    setShowTypeSelector(false);
    setEditingItem({ isBarItem });
    setShowModal(true);
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingItem(null);
  };

  const handleSaveItem = async (itemData) => {
    try {
      if (editingItem) {
        // Update existing item
        const result = await window.electronAPI.invoke(
          'firebase:update-menu-item',
          editingItem.id,
          itemData
        );
        if (result.success) {
          await loadMenuItems();
          await loadCategories();
          handleCloseModal();
        } else {
          alert(result.error || 'Failed to update menu item');
        }
      } else {
        // Create new item
        const result = await window.electronAPI.invoke('firebase:create-menu-item', itemData);
        if (result.success) {
          await loadMenuItems();
          await loadCategories();
          handleCloseModal();
        } else {
          alert(result.error || 'Failed to create menu item');
        }
      }
    } catch (error) {
      console.error('Failed to save menu item:', error);
      alert('Failed to save menu item');
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.name}"?`)) {
      return;
    }

    try {
      const result = await window.electronAPI.invoke('firebase:delete-menu-item', item.id);
      if (result.success) {
        await loadMenuItems();
        await loadCategories();
      } else {
        alert(result.error || 'Failed to delete menu item');
      }
    } catch (error) {
      console.error('Failed to delete menu item:', error);
      alert('Failed to delete menu item');
    }
  };

  const handleToggleOutOfStock = async (item) => {
    try {
      const result = await window.electronAPI.invoke(
        'firebase:mark-out-of-stock',
        item.id,
        !item.isOutOfStock
      );
      if (result.success) {
        await loadMenuItems();
      }
    } catch (error) {
      console.error('Failed to update stock status:', error);
    }
  };

  return (
    <div className="menu-management">
      <div className="page-header">
        <div className="header-left">
          <Package size={32} />
          <div>
            <h1>Menu Management</h1>
            <p>Manage menu items, categories, and prices</p>
          </div>
        </div>
        <div className="header-right">
          <div className={`sync-indicator ${syncStatus}`}>
            {syncStatus === 'connected' && <CheckCircle size={16} />}
            {syncStatus === 'syncing' && <div className="spinner" />}
            {syncStatus === 'disconnected' && <AlertCircle size={16} />}
            <span>
              {syncStatus === 'connected' && 'Synced'}
              {syncStatus === 'syncing' && 'Syncing...'}
              {syncStatus === 'disconnected' && 'Offline'}
            </span>
          </div>
          <button className="btn-primary" onClick={handleAddItem}>
            <Plus size={20} />
            Add Product
          </button>
        </div>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search menu items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-buttons">
          <button
            className={filterCategory === 'all' ? 'active' : ''}
            onClick={() => setFilterCategory('all')}
          >
            All Categories
          </button>
          {categories.map(category => (
            <button
              key={category}
              className={filterCategory === category ? 'active' : ''}
              onClick={() => setFilterCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading menu items...</div>
      ) : (
        <div className="menu-items-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="6" className="no-data">
                    No menu items found
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td className="item-name">{item.name}</td>
                    <td>
                      <span className="category-badge">{item.category}</span>
                    </td>
                    <td className="price-cell">₹{item.price.toFixed(2)}</td>
                    <td className="description-cell">
                      {item.description || '-'}
                    </td>
                    <td>
                      <span className={`status-badge ${item.isOutOfStock ? 'out-of-stock' : 'in-stock'}`}>
                        {item.isOutOfStock ? (
                          <>
                            <AlertCircle size={16} />
                            Out of Stock
                          </>
                        ) : (
                          <>
                            <CheckCircle size={16} />
                            In Stock
                          </>
                        )}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon"
                          onClick={() => handleEditItem(item)}
                          title="Edit item"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          className={`btn-icon ${item.isOutOfStock ? 'btn-success' : 'btn-warning'}`}
                          onClick={() => handleToggleOutOfStock(item)}
                          title={item.isOutOfStock ? 'Mark in stock' : 'Mark out of stock'}
                        >
                          {item.isOutOfStock ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                        </button>
                        <button
                          className="btn-icon btn-danger"
                          onClick={() => handleDeleteItem(item)}
                          title="Delete item"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showTypeSelector && (
        <div className="modal-overlay">
          <div className="modal type-selector-modal">
            <div className="modal-header">
              <h3>
                <Package size={24} />
                Select Product Type
              </h3>
              <button className="close-btn" onClick={() => setShowTypeSelector(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="type-selector-buttons">
                <button 
                  className="type-btn restaurant-btn"
                  onClick={() => handleSelectProductType(false)}
                >
                  <Package size={48} />
                  <h4>Restaurant</h4>
                  <p>Food items, starters, main course, desserts</p>
                </button>
                <button 
                  className="type-btn bar-btn"
                  onClick={() => handleSelectProductType(true)}
                >
                  <Package size={48} />
                  <h4>Bar</h4>
                  <p>Alcoholic beverages, cocktails, spirits</p>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <MenuItemModal
          item={editingItem}
          existingCategories={categories}
          onClose={handleCloseModal}
          onSave={handleSaveItem}
        />
      )}
    </div>
  );
};

const MenuItemModal = ({ item, existingCategories, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: item?.name || '',
    category: item?.category || '',
    price: item?.price || '',
    description: item?.description || ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Item name is required';
    }
    
    if (!formData.category.trim()) {
      newErrors.category = 'Category is required';
    }
    
    if (!formData.price || formData.price <= 0) {
      newErrors.price = 'Price must be greater than 0';
    }
    
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
      await onSave({
        name: formData.name.trim(),
        category: formData.category.trim(),
        price: parseFloat(formData.price),
        description: formData.description.trim()
      });
    } catch (error) {
      console.error('Failed to save menu item:', error);
      setErrors({ submit: 'Failed to save menu item. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
            {item ? 'Edit Menu Item' : 'Add New Menu Item'}
          </h3>
          <button onClick={onClose} className="close-btn" type="button">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errors.submit && (
              <div className="error-message">{errors.submit}</div>
            )}

            <div className="form-group">
              <label htmlFor="name">
                Item Name <span className="required">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={errors.name ? 'error' : ''}
                placeholder="Enter item name"
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="category">
                Category <span className="required">*</span>
              </label>
              <input
                id="category"
                type="text"
                list="categories"
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className={errors.category ? 'error' : ''}
                placeholder="Enter or select category"
              />
              <datalist id="categories">
                {existingCategories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
              {errors.category && <span className="error-text">{errors.category}</span>}
              <small className="help-text">Type a new category or select from existing ones</small>
            </div>

            <div className="form-group">
              <label htmlFor="price">
                Price (₹) <span className="required">*</span>
              </label>
              <input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => handleInputChange('price', e.target.value)}
                className={errors.price ? 'error' : ''}
                placeholder="Enter price"
              />
              {errors.price && <span className="error-text">{errors.price}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter item description (optional)"
                rows="3"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : item ? 'Update Item' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MenuManagement;
