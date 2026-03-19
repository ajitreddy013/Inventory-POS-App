/* eslint-disable react/prop-types, no-console */
import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Edit,
  Search,
  UserCheck,
  UserX,
  ArrowLeft,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './WaiterManagement.css';

const WaiterManagement = () => {
  const navigate = useNavigate();
  const [waiters, setWaiters] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingWaiter, setEditingWaiter] = useState(null);

  useEffect(() => {
    loadWaiters();
  }, []);

  const loadWaiters = async () => {
    try {
      const result = await window.electronAPI.invoke('firebase:get-waiters');
      if (result.success) {
        setWaiters(result.waiters);
      }
    } catch (_) {
      // Ignore waiter loading errors here; UI remains on last known state.
    }
  };

  const filteredWaiters = waiters.filter((waiter) => {
    const matchesSearch =
      waiter.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      waiter.pin.includes(searchTerm);
    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'active' && waiter.isActive) ||
      (filterStatus === 'inactive' && !waiter.isActive);
    return matchesSearch && matchesFilter;
  });

  const handleAddWaiter = () => {
    setEditingWaiter(null);
    setShowModal(true);
  };

  const handleEditWaiter = (waiter) => {
    setEditingWaiter(waiter);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingWaiter(null);
  };

  const handleSaveWaiter = async (waiterData) => {
    try {
      if (editingWaiter) {
        // Update existing waiter PIN
        const result = await window.electronAPI.invoke(
          'firebase:update-waiter-pin',
          editingWaiter.id,
          waiterData.pin
        );
        if (result.success) {
          await loadWaiters();
          handleCloseModal();
        } else {
          alert(result.error || 'Failed to update waiter');
        }
      } else {
        // Create new waiter
        const result = await window.electronAPI.invoke(
          'firebase:create-waiter',
          waiterData
        );
        if (result.success) {
          await loadWaiters();
          handleCloseModal();
        } else {
          alert(result.error || 'Failed to create waiter');
        }
      }
    } catch (_) {
      alert('Failed to save waiter');
    }
  };

  const handleToggleStatus = async (waiter) => {
    try {
      const result = await window.electronAPI.invoke(
        'firebase:deactivate-waiter',
        waiter.id,
        !waiter.isActive
      );
      if (result.success) {
        await loadWaiters();
      } else {
        alert(result.error || 'Failed to update waiter status');
      }
    } catch (_) {
      alert('Failed to update waiter status');
    }
  };

  const handleDeleteWaiter = async (waiter) => {
    const confirmed = window.confirm(
      `Delete waiter "${waiter.name}" permanently?`
    );
    if (!confirmed) return;

    try {
      const result = await window.electronAPI.invoke(
        'firebase:delete-waiter',
        waiter.id
      );
      if (result.success) {
        await loadWaiters();
      } else {
        alert(result.error || 'Failed to delete waiter');
      }
    } catch (_) {
      alert('Failed to delete waiter');
    }
  };

  return (
    <div className="waiter-management">
      <div className="page-header">
        <div className="header-left">
          <button
            onClick={() => navigate('/settings')}
            className="back-button"
            title="Back to Settings"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="header-icon">
            <Users size={24} />
          </div>
          <div>
            <h1>Waiter Management</h1>
            <p>Manage waiter accounts, PINs, and access status</p>
          </div>
        </div>
        <button className="btn-primary" onClick={handleAddWaiter}>
          <Plus size={20} />
          Add Waiter
        </button>
      </div>

      <div className="controls-section">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by name or PIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-segmented-control">
          <button
            className={filterStatus === 'all' ? 'active' : ''}
            onClick={() => setFilterStatus('all')}
          >
            All
          </button>
          <button
            className={filterStatus === 'active' ? 'active' : ''}
            onClick={() => setFilterStatus('active')}
          >
            Active
          </button>
          <button
            className={filterStatus === 'inactive' ? 'active' : ''}
            onClick={() => setFilterStatus('inactive')}
          >
            Inactive
          </button>
        </div>
      </div>

      <div className="waiters-table-container">
        <table className="waiters-table">
          <thead>
            <tr>
              <th>Waiter Name</th>
              <th>Access PIN</th>
              <th>Current Status</th>
              <th className="actions-cell">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredWaiters.length === 0 ? (
              <tr>
                <td colSpan="4" className="no-data">
                  No waiters found matching your search
                </td>
              </tr>
            ) : (
              filteredWaiters.map((waiter) => (
                <tr key={waiter.id}>
                  <td>
                    <div className="waiter-name-cell">
                      <div className="waiter-avatar">
                        {waiter.name.substring(0, 2).toUpperCase()}
                      </div>
                      {waiter.name}
                    </div>
                  </td>
                  <td>
                    <span className="pin-badge">{waiter.pin}</span>
                  </td>
                  <td>
                    <span
                      className={`status-pill ${waiter.isActive ? 'active' : 'inactive'}`}
                    >
                      {waiter.isActive ? (
                        <>
                          <UserCheck size={14} />
                          Active
                        </>
                      ) : (
                        <>
                          <UserX size={14} />
                          Inactive
                        </>
                      )}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <div className="actions-group">
                      <button
                        className="icon-button"
                        onClick={() => handleEditWaiter(waiter)}
                        title="Edit PIN"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className={`icon-button ${waiter.isActive ? 'toggle-off' : 'toggle-on'}`}
                        onClick={() => handleToggleStatus(waiter)}
                        title={waiter.isActive ? 'Deactivate Waiter' : 'Activate Waiter'}
                      >
                        {waiter.isActive ? (
                          <UserX size={16} />
                        ) : (
                          <UserCheck size={16} />
                        )}
                      </button>
                      <button
                        className="icon-button delete"
                        onClick={() => handleDeleteWaiter(waiter)}
                        title="Delete Waiter"
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

      {showModal && (
        <WaiterModal
          waiter={editingWaiter}
          onClose={handleCloseModal}
          onSave={handleSaveWaiter}
        />
      )}
    </div>
  );
};

const WaiterModal = ({ waiter, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: waiter?.name || '',
    pin: waiter?.pin || '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Waiter name is required';
    }
    if (!formData.pin.trim()) {
      newErrors.pin = 'PIN is required';
    } else if (!/^\d{4,6}$/.test(formData.pin)) {
      newErrors.pin = 'PIN must be 4-6 digits';
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
    } catch (_) {
      setErrors({ submit: 'Failed to save waiter. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>
            <Users size={22} />
            {waiter ? 'Edit Waiter PIN' : 'Add New Waiter'}
          </h3>
          <button onClick={onClose} className="btn-close" type="button">
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
                Waiter Name <span className="required">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={errors.name ? 'error' : ''}
                disabled={!!waiter}
                placeholder="Enter waiter name"
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="pin">
                PIN <span className="required">*</span>
              </label>
              <input
                id="pin"
                type="text"
                value={formData.pin}
                onChange={(e) => handleInputChange('pin', e.target.value)}
                className={errors.pin ? 'error' : ''}
                placeholder="Enter 4-6 digit PIN"
                maxLength="6"
              />
              {errors.pin && <span className="error-text">{errors.pin}</span>}
              <small className="help-text">
                PIN must be 4-6 digits and unique
              </small>
            </div>

            {waiter && (
              <div className="info-box">
                <p>
                  Updating the PIN will immediately change the waiter&apos;s
                  login credentials.
                </p>
              </div>
            )}
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
              {isSubmitting
                ? 'Saving...'
                : waiter
                  ? 'Update PIN'
                  : 'Create Waiter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WaiterManagement;
