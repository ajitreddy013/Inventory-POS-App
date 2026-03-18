import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit, Search, Trash2, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './MenuManagement.css';

const MenuManagement = () => {
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [counterMap, setCounterMap] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSection, setFilterSection] = useState('bar');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState('disconnected');

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
        includeInactive: false,
        includeOutOfStock: true
      });
      if (result.success) {
        setMenuItems(result.items);
      }
      // load godown stock map
      const stockRes = await window.electronAPI.getMenuItemsWithStock();
      if (stockRes.success) {
        const map = {};
        for (const item of stockRes.items) map[item.id] = item.godownStock || 0;
        setStockMap(map);
      }
      // load counter stock map
      const counterRes = await window.electronAPI.getCounterStock();
      if (counterRes.success) {
        const cmap = {};
        for (const item of counterRes.items) cmap[item.id] = item.counterStock || 0;
        setCounterMap(cmap);
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

  const filteredItems = menuItems
    .filter(item => filterSection === 'bar' ? item.isBarItem : !item.isBarItem)
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.category.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });

  const handleAddItem = () => {
    console.log('Add Product button clicked');
    setEditingItem(null);
    setShowModal(true);
    console.log('showModal set to true');
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
          <button onClick={() => navigate('/settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: 8, display: 'flex', alignItems: 'center', color: '#4f46e5' }}>
            <ArrowLeft size={22} />
          </button>
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
          {[{ key: 'bar', label: 'Bar' }, { key: 'restaurant', label: 'Restaurant' }].map(({ key, label }) => (
            <button
              key={key}
              className={filterSection === key ? 'active' : ''}
              onClick={() => setFilterSection(key)}
              style={{
                background: filterSection === key ? '#4f46e5' : '',
                color: filterSection === key ? '#fff' : '',
                borderColor: filterSection === key ? '#4f46e5' : '',
                fontWeight: filterSection === key ? 700 : 400,
              }}
            >
              {label}
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
                <th>Short Code</th>
                <th>Category</th>
                <th>Sub-Category</th>
                <th>Price</th>
                {filterSection === 'restaurant' && <th>Food Type</th>}
                <th>Description</th>
                {filterSection === 'bar' && <th>Godown</th>}
                {filterSection === 'bar' && <th>Counter</th>}
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={filterSection === 'restaurant' ? 9 : 11} className="no-data">
                    No menu items found
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td className="item-name">{item.name}</td>
                    <td><span className="category-badge">{item.shortCode || '-'}</span></td>
                    <td><span className="category-badge">{item.category}</span></td>
                    <td>{item.subCategory || '-'}</td>
                    <td className="price-cell">₹{item.price.toFixed(2)}</td>
                    {filterSection === 'restaurant' && (
                      <td>
                        {item.foodType === 'veg'
                          ? <span style={{ color: '#27ae60', fontWeight: 700 }}>● Veg</span>
                          : item.foodType === 'non-veg'
                          ? <span style={{ color: '#e74c3c', fontWeight: 700 }}>● Non-Veg</span>
                          : '-'}
                      </td>
                    )}
                    <td className="description-cell">{item.description || '-'}</td>
                    {filterSection === 'bar' && (
                      <td>
                        <span style={{ fontWeight: 700, color: (stockMap[item.id] || 0) > 0 ? '#27ae60' : '#e74c3c' }}>
                          {stockMap[item.id] || 0}
                        </span>
                      </td>
                    )}
                    {filterSection === 'bar' && (
                      <td>
                        <span style={{ fontWeight: 700, color: (counterMap[item.id] || 0) > 0 ? '#27ae60' : '#e74c3c' }}>
                          {counterMap[item.id] || 0}
                        </span>
                      </td>
                    )}
                    <td>
                      {filterSection === 'bar' ? (
                        (stockMap[item.id] || 0) > 0
                          ? <span className="status-badge in-stock"><CheckCircle size={16} /> In Stock</span>
                          : <span className="status-badge out-of-stock"><AlertCircle size={16} /> Out of Stock</span>
                      ) : (
                        <span className={`status-badge ${item.isOutOfStock ? 'out-of-stock' : 'in-stock'}`}>
                          {item.isOutOfStock ? <><AlertCircle size={16} /> Out of Stock</> : <><CheckCircle size={16} /> In Stock</>}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-icon" onClick={() => handleEditItem(item)} title="Edit item">
                          <Edit size={18} />
                        </button>
                        {filterSection === 'restaurant' && (
                          <button
                            className={`btn-icon ${item.isOutOfStock ? 'btn-success' : 'btn-warning'}`}
                            onClick={() => handleToggleOutOfStock(item)}
                            title={item.isOutOfStock ? 'Mark in stock' : 'Mark out of stock'}
                          >
                            {item.isOutOfStock ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                          </button>
                        )}
                        <button className="btn-icon btn-danger" onClick={() => handleDeleteItem(item)} title="Delete item">
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

const MenuItemModal = ({ item, existingCategories = [], onClose, onSave }) => {
  console.log('MenuItemModal rendering', { item, existingCategories });
  const isEditing = item && item.id;
  
  const [productType, setProductType] = useState(item?.isBarItem ? 'bar' : 'restaurant');
  const [formData, setFormData] = useState({
    name: item?.name || '',
    shortCode: item?.shortCode || '',
    category: item?.category || '',
    subCategory: item?.subCategory || '',
    price: item?.price || '',
    foodType: item?.foodType || 'veg',
    description: item?.description || ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBarItem = productType === 'bar';

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Item name is required';
    }
    
    if (!formData.shortCode.trim()) {
      newErrors.shortCode = 'Short code is required';
    }
    
    if (!formData.category.trim()) {
      newErrors.category = 'Category is required';
    }
    
    if (!formData.subCategory.trim()) {
      newErrors.subCategory = 'Sub-category is required';
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
        ...item,
        name: formData.name.trim(),
        shortCode: formData.shortCode.trim().toUpperCase(),
        category: formData.category.trim(),
        subCategory: formData.subCategory.trim(),
        price: parseFloat(formData.price),
        foodType: isBarItem ? 'none' : formData.foodType,
        isBarItem: isBarItem,
        itemCategory: isBarItem ? 'drink' : 'food',
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

  const handleProductTypeChange = (type) => {
    console.log('Product type changed to:', type);
    setProductType(type);
  };

  return (
    <div className="modal-overlay">
      <div className="modal large-modal">
        <div className="modal-header">
          <h3>
            <Package size={24} />
            {item ? 'Edit Menu Item' : 'Add New Menu Item'}
          </h3>
          <button onClick={onClose} className="close-btn" type="button">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errors.submit && (
              <div className="error-message">{errors.submit}</div>
            )}

            {!isEditing && (
              <div className="form-group">
                <label>Product Type <span className="required">*</span></label>
                <div className="type-selector-buttons">
                  <button
                    type="button"
                    className={`type-btn restaurant-btn ${productType === 'restaurant' ? 'active' : ''}`}
                    onClick={() => handleProductTypeChange('restaurant')}
                    style={{
                      borderColor: productType === 'restaurant' ? '#10b981' : '#e5e7eb',
                      background: productType === 'restaurant' ? '#ecfdf5' : '#f9fafb'
                    }}
                  >
                    <h4>Restaurant</h4>
                    <p>Food items with veg/non-veg options</p>
                  </button>
                  <button
                    type="button"
                    className={`type-btn bar-btn ${productType === 'bar' ? 'active' : ''}`}
                    onClick={() => handleProductTypeChange('bar')}
                    style={{
                      borderColor: productType === 'bar' ? '#f59e0b' : '#e5e7eb',
                      background: productType === 'bar' ? '#fffbeb' : '#f9fafb'
                    }}
                  >
                    <h4>Bar</h4>
                    <p>Alcoholic and non-alcoholic beverages</p>
                  </button>
                </div>
              </div>
            )}

            <div className="form-row">
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
                <label htmlFor="shortCode">
                  Short Code <span className="required">*</span>
                </label>
                <input
                  id="shortCode"
                  type="text"
                  value={formData.shortCode}
                  onChange={(e) => handleInputChange('shortCode', e.target.value.toUpperCase())}
                  className={errors.shortCode ? 'error' : ''}
                  placeholder="e.g., PT, CB"
                  maxLength="10"
                />
                {errors.shortCode && <span className="error-text">{errors.shortCode}</span>}
              </div>
            </div>

            <div className="form-row">
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
              </div>

              <div className="form-group">
                <label htmlFor="subCategory">
                  Sub-Category <span className="required">*</span>
                </label>
                <input
                  id="subCategory"
                  type="text"
                  value={formData.subCategory}
                  onChange={(e) => handleInputChange('subCategory', e.target.value)}
                  className={errors.subCategory ? 'error' : ''}
                  placeholder="e.g., North Indian, Beer"
                />
                {errors.subCategory && <span className="error-text">{errors.subCategory}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="price">
                  Price (Rs) <span className="required">*</span>
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

              {!isBarItem && (
                <div className="form-group">
                  <label htmlFor="foodType">
                    Food Type <span className="required">*</span>
                  </label>
                  <select
                    id="foodType"
                    value={formData.foodType}
                    onChange={(e) => handleInputChange('foodType', e.target.value)}
                    className={errors.foodType ? 'error' : ''}
                  >
                    <option value="veg">Vegetarian</option>
                    <option value="non-veg">Non-Vegetarian</option>
                  </select>
                  {errors.foodType && <span className="error-text">{errors.foodType}</span>}
                </div>
              )}
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
