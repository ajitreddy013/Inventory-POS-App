import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, Search } from 'lucide-react';

const ProductManagement = () => {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const productList = await window.electronAPI.getProducts();
      setProducts(productList);
    } catch (error) {
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

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!formData.name || !formData.sku || !formData.price || !formData.cost) {
        alert('Please fill in all required fields');
        return;
      }
      onSave(formData);
    };

    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-header">
            <h3>{product ? 'Edit Product' : 'Add New Product'}</h3>
            <button onClick={onClose} className="close-btn">
              ×
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-content">
              <div className="form-row">
                <label>
                  Product Name *
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-input"
                    required
                  />
                </label>
                <label>
                  Variant (e.g., 180ml, 500ml)
                  <input
                    type="text"
                    value={formData.variant}
                    onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
                    className="form-input"
                    placeholder="180ml, Large, Regular"
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  SKU *
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="form-input"
                    required
                  />
                </label>
                <label>
                  Category
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="form-input"
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Barcode
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="form-input"
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Cost Price *
                  <input
                    type="number"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
                    className="form-input"
                    min="0"
                    step="0.01"
                    required
                  />
                </label>
                <label>
                  Selling Price *
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    className="form-input"
                    min="0"
                    step="0.01"
                    required
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Unit
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
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
                </label>
              </div>
              <label>
                Description
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="form-input"
                  rows="3"
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="submit" className="btn btn-primary">
                {product ? 'Update Product' : 'Add Product'}
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

  const handleSaveProduct = async (productData) => {
    try {
      setLoading(true);
      if (editingProduct) {
        await window.electronAPI.updateProduct(editingProduct.id, productData);
      } else {
        await window.electronAPI.addProduct(productData);
      }
      await loadProducts();
      setShowModal(false);
      setEditingProduct(null);
    } catch (error) {
      console.error('Failed to save product:', error);
      alert('Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await window.electronAPI.deleteProduct(productId);
        await loadProducts();
      } catch (error) {
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
              filteredProducts.map(product => (
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
                  <td>₹{product.cost ? product.cost.toFixed(2) : '0.00'}</td>
                  <td>₹{product.price ? product.price.toFixed(2) : '0.00'}</td>
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

      {/* Summary */}
      <div className="summary-cards">
        <div className="summary-card">
          <h3>Total Products</h3>
          <div className="value">{products.length}</div>
        </div>
        <div className="summary-card">
          <h3>Total Value</h3>
          <div className="value">
            ₹{products.reduce((sum, product) => {
              const stock = (product.godown_stock || 0) + (product.counter_stock || 0);
              return sum + (stock * (product.cost || 0));
            }, 0).toFixed(2)}
          </div>
        </div>
        <div className="summary-card">
          <h3>Categories</h3>
          <div className="value">
            {new Set(products.filter(p => p.category).map(p => p.category)).size}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductManagement;
