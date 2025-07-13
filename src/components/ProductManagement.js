import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Package, Plus, Edit, Trash2, Search } from 'lucide-react';

const ProductManagement = () => {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const productList = await window.electronAPI.getProducts();
      setProducts(productList);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load products:', error);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.category && product.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const ProductModal = ({ product, onClose, onSave }) => {
    const [formData, setFormData] = useState({
      name: product?.name || '',
      variant: product?.variant || '',
      sku: product?.sku || '',
      barcode: product?.barcode || '',
      price: product?.price || '',
      cost: product?.cost || '',
      category: product?.category || '',
      description: product?.description || '',
      unit: product?.unit || 'pcs'
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const validateForm = () => {
      const newErrors = {};
      if (!formData.name.trim()) newErrors.name = 'Product name is required';
      if (!formData.sku.trim()) newErrors.sku = 'SKU is required';
      if (!formData.price || formData.price <= 0) newErrors.price = 'Valid selling price is required';
      if (!formData.cost || formData.cost <= 0) newErrors.cost = 'Valid cost price is required';
      if (formData.price && formData.cost && parseFloat(formData.price) < parseFloat(formData.cost)) {
        newErrors.price = 'Selling price should be greater than cost price';
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
        await onSave(formData);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to save product:', error);
        setErrors({ submit: 'Failed to save product. Please try again.' });
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
              {product ? 'Edit Product' : 'Add New Product'}
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
                  Basic Information
                </div>
                <div className="form-grid two-columns">
                  <div className="form-group">
                    <label className="required">Product Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className={`form-input ${errors.name ? 'error' : ''}`}
                      placeholder="Enter product name"
                      required
                    />
                    {errors.name && <div className="form-error">{errors.name}</div>}
                  </div>
                  <div className="form-group">
                    <label>Variant</label>
                    <input
                      type="text"
                      value={formData.variant}
                      onChange={(e) => handleInputChange('variant', e.target.value)}
                      className="form-input"
                      placeholder="e.g., 180ml, Large, Regular"
                    />
                  </div>
                </div>
                
                <div className="form-grid two-columns">
                  <div className="form-group">
                    <label className="required">SKU</label>
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => handleInputChange('sku', e.target.value)}
                      className={`form-input ${errors.sku ? 'error' : ''}`}
                      placeholder="Stock Keeping Unit"
                      required
                    />
                    {errors.sku && <div className="form-error">{errors.sku}</div>}
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className="form-input"
                      placeholder="Product category"
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Barcode</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => handleInputChange('barcode', e.target.value)}
                    className="form-input"
                    placeholder="Barcode number (optional)"
                  />
                </div>
              </div>
              
              <div className="form-section">
                <div className="form-section-title">
                  Pricing & Unit
                </div>
                <div className="form-grid two-columns">
                  <div className="form-group">
                    <label className="required">Cost Price (₹)</label>
                    <input
                      type="number"
                      value={formData.cost}
                      onChange={(e) => handleInputChange('cost', parseFloat(e.target.value) || '')}
                      className={`form-input ${errors.cost ? 'error' : ''}`}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      required
                    />
                    {errors.cost && <div className="form-error">{errors.cost}</div>}
                  </div>
                  <div className="form-group">
                    <label className="required">Selling Price (₹)</label>
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
                    {formData.price && formData.cost && parseFloat(formData.price) > parseFloat(formData.cost) && (
                      <div className="form-success">
                        Profit: ₹{(parseFloat(formData.price) - parseFloat(formData.cost)).toFixed(2)} 
                        ({(((parseFloat(formData.price) - parseFloat(formData.cost)) / parseFloat(formData.cost)) * 100).toFixed(1)}%)
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => handleInputChange('unit', e.target.value)}
                    className="form-input"
                  >
                    <option value="pcs">Pieces</option>
                    <option value="bottle">Bottle</option>
                    <option value="ml">Milliliter</option>
                    <option value="l">Liter</option>
                    <option value="kg">Kilogram</option>
                    <option value="g">Gram</option>
                    <option value="box">Box</option>
                    <option value="pack">Pack</option>
                    <option value="plate">Plate</option>
                    <option value="glass">Glass</option>
                  </select>
                </div>
              </div>
              
              <div className="form-section">
                <div className="form-section-title">
                  Additional Details
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="form-input"
                    rows="3"
                    placeholder="Optional product description"
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
                {isSubmitting ? 'Saving...' : (product ? 'Update Product' : 'Add Product')}
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
      if (editingProduct) {
        await window.electronAPI.updateProduct(editingProduct.id, productData);
      } else {
        await window.electronAPI.addProduct(productData);
      }
      await loadProducts();
      setShowModal(false);
      setEditingProduct(null);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save product:', error);
      alert('Failed to save product');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await window.electronAPI.deleteProduct(productId);
        await loadProducts();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to delete product:', error);
        alert('Failed to delete product');
      }
    }
  };

  return (
    <div className="product-management">
      <div className="page-header">
        <h1><Package size={24} /> Product Management</h1>
        <button 
          onClick={() => setShowModal(true)}
          className="btn btn-primary"
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* Summary Cards - moved to top for quick look */}
      <div className="summary-cards">
        <div className="summary-card">
          <h3>Total Products</h3>
          <div className="value">{products.length}</div>
        </div>
        <div className="summary-card">
          <h3>Total Inventory Value</h3>
          <div className="value">
            ₹{products.reduce((sum, product) => {
              const stock = (product.godown_stock || 0) + (product.counter_stock || 0);
              return sum + (stock * (product.cost || 0));
            }, 0).toFixed(2)}
          </div>
          <small style={{ color: '#7f8c8d', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
            (At Cost Price - Investment Value)
          </small>
        </div>
        <div className="summary-card">
          <h3>Categories</h3>
          <div className="value">
            {new Set(products.filter(p => p.category).map(p => p.category)).size}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="search-section">
        <div className="search-input-container">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search products by name, SKU, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Variant</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Cost Price</th>
              <th>Selling Price</th>
              <th>Unit</th>
              <th>Stock</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>
                  {searchTerm ? 'No products found matching your search' : 'No products added yet'}
                </td>
              </tr>
            ) : (
              filteredProducts.map(product => {
                const cost = product.cost || 0;
                const price = product.price || 0;
                
                return (
                  <tr key={product.id}>
                    <td>
                      <div>
                        <strong>{product.name}</strong>
                        {product.description && (
                          <>
                            <br />
                            <small style={{ color: '#7f8c8d' }}>
                              {product.description.length > 50 
                                ? product.description.substring(0, 50) + '...' 
                                : product.description}
                            </small>
                          </>
                        )}
                      </div>
                    </td>
                    <td>{product.variant || '-'}</td>
                    <td>{product.sku}</td>
                    <td>{product.category || '-'}</td>
                    <td>₹{cost.toFixed(2)}</td>
                    <td>₹{price.toFixed(2)}</td>
                    <td>{product.unit}</td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>
                        <div>G: {product.godown_stock || 0}</div>
                        <div>C: {product.counter_stock || 0}</div>
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => {
                            setEditingProduct(product);
                            setShowModal(true);
                          }}
                          className="btn btn-sm btn-secondary"
                          title="Edit Product"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="btn btn-sm btn-danger"
                          title="Delete Product"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
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

    </div>
  );
};

export default ProductManagement;
