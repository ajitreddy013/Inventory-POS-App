/* eslint-disable no-console */
/* eslint-disable react/prop-types */
import React, { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  Edit,
  Search,
  UserCheck,
  UserX,
  Key,
  ArrowLeft,
  Trash2,
  Lock,
  X,
  User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './ManagerManagement.css';

const ManagerManagement = () => {
  const navigate = useNavigate();
  const [managers, setManagers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [editingManager, setEditingManager] = useState(null);
  const [currentManager, setCurrentManager] = useState(null);

  useEffect(() => {
    loadManagers();
  }, []);

  const loadManagers = async () => {
    try {
      const result = await window.electronAPI.invoke('firebase:get-managers');
      if (result.success) {
        setManagers(result.managers);
      }
    } catch (error) {
      console.error('Failed to load managers:', error);
    }
  };

  const filteredManagers = managers.filter((manager) => {
    const matchesSearch = manager.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || manager.role === filterRole;
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && manager.isActive) ||
      (filterStatus === 'inactive' && !manager.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleAddManager = () => {
    setEditingManager(null);
    setShowModal(true);
  };

  const handleEditManager = (manager) => {
    setEditingManager(manager);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingManager(null);
  };

  const handleSaveManager = async (managerData) => {
    try {
      if (editingManager) {
        const result = await window.electronAPI.invoke(
          'firebase:update-manager',
          editingManager.id,
          managerData
        );
        if (result.success) {
          await loadManagers();
          handleCloseModal();
        } else {
          alert(result.error || 'Failed to update manager');
        }
      } else {
        const result = await window.electronAPI.invoke(
          'firebase:create-manager',
          managerData
        );
        if (result.success) {
          await loadManagers();
          handleCloseModal();
        } else {
          alert(result.error || 'Failed to create manager');
        }
      }
    } catch (error) {
      console.error('Failed to save manager:', error);
      alert('Failed to save manager');
    }
  };

  const handleToggleStatus = async (manager) => {
    try {
      const result = await window.electronAPI.invoke(
        'firebase:deactivate-manager',
        manager.id,
        !manager.isActive
      );
      if (result.success) {
        await loadManagers();
      }
    } catch (error) {
      console.error('Failed to toggle manager status:', error);
    }
  };

  const handleChangeMyPin = (manager) => {
    setCurrentManager(manager);
    setShowChangePinModal(true);
  };

  const handleDeleteManager = async (manager) => {
    const confirmed = window.confirm(
      `Delete manager "${manager.name}" permanently?`
    );
    if (!confirmed) return;

    try {
      const result = await window.electronAPI.invoke(
        'firebase:delete-manager',
        manager.id
      );
      if (result.success) {
        await loadManagers();
      } else {
        alert(result.error || 'Failed to delete manager');
      }
    } catch (error) {
      console.error('Failed to delete manager:', error);
      alert('Failed to delete manager');
    }
  };

  const handleCloseChangePinModal = () => {
    setShowChangePinModal(false);
    setCurrentManager(null);
  };

  const getInitials = (name) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'M';
  };

  return (
    <div className="manager-management">
      <div className="page-header">
        <div className="header-left">
          <button className="back-button" onClick={() => navigate('/settings')}>
            <ArrowLeft size={20} />
          </button>
          <div className="header-icon">
            <Shield size={28} />
          </div>
          <div>
            <h1>Manager Accounts</h1>
            <p>Secure administrative access with PIN authentication</p>
          </div>
        </div>
        <button className="btn-primary" onClick={handleAddManager}>
          <Plus size={20} />
          Add New Manager
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

        <div className="filters-wrapper">
          <div className="filter-group">
            <label>Status</label>
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
        </div>
      </div>

      <div className="managers-table-container">
        <table className="managers-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th className="actions-cell">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredManagers.length === 0 ? (
              <tr>
                <td colSpan="4" className="no-data">
                  No manager accounts found
                </td>
              </tr>
            ) : (
              filteredManagers.map((manager) => (
                <tr key={manager.id}>
                  <td>
                    <div className="manager-name-cell">
                      <div className="manager-avatar">{getInitials(manager.name)}</div>
                      {manager.name}
                    </div>
                  </td>
                  <td>
                    <span className={`role-badge role-${manager.role}`}>
                      {manager.role}
                    </span>
                  </td>
                  <td>
                    <span className={`status-pill ${manager.isActive ? 'active' : 'inactive'}`}>
                      {manager.isActive ? <UserCheck size={14} /> : <UserX size={14} />}
                      {manager.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <div className="actions-group">
                      <button
                        className="icon-button"
                        onClick={() => handleEditManager(manager)}
                        title="Edit Details"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="icon-button pin"
                        onClick={() => handleChangeMyPin(manager)}
                        title="Change PIN"
                      >
                        <Key size={16} />
                      </button>
                      <button
                        className={`icon-button ${manager.isActive ? 'toggle-off' : 'toggle-on'}`}
                        onClick={() => handleToggleStatus(manager)}
                        title={manager.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {manager.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                      <button
                        className="icon-button delete"
                        onClick={() => handleDeleteManager(manager)}
                        title="Delete Permanently"
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
        <ManagerModal
          manager={editingManager}
          onClose={handleCloseModal}
          onSave={handleSaveManager}
        />
      )}

      {showChangePinModal && currentManager && (
        <ChangePinModal
          manager={currentManager}
          onClose={handleCloseChangePinModal}
          onSuccess={loadManagers}
        />
      )}
    </div>
  );
};

const ManagerModal = ({ manager, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: manager?.name || '',
    pin: '',
    role: manager?.role || 'manager',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Manager name is required';
    }
    if (!manager && !formData.pin.trim()) {
      newErrors.pin = 'PIN is required';
    } else if (!manager && !/^\d{4,6}$/.test(formData.pin)) {
      newErrors.pin = 'PIN must be 4-6 digits';
    }
    if (!formData.role) {
      newErrors.role = 'Role is required';
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
      console.error('Failed to save manager:', error);
      setErrors({ submit: 'Failed to save manager. Please try again.' });
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
            <Shield size={20} />
            {manager ? 'Edit Manager' : 'New Manager'}
          </h3>
          <button onClick={onClose} className="btn-close" type="button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errors.submit && (
              <div className="error-message">{errors.submit}</div>
            )}

            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Manager's full name"
                autoFocus
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            {!manager && (
              <div className="form-group">
                <label htmlFor="pin">Initial PIN (4-6 digits)</label>
                <input
                  id="pin"
                  type="password"
                  value={formData.pin}
                  onChange={(e) => handleInputChange('pin', e.target.value)}
                  placeholder="Enter secure PIN"
                  maxLength="6"
                />
                {errors.pin && <span className="error-text">{errors.pin}</span>}
                <small className="help-text">
                  This PIN will be hashed and used for secure access.
                </small>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="role">Account Role</label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => handleInputChange('role', e.target.value)}
              >
                <option value="owner">Owner (Full Access)</option>
                <option value="manager">Manager (Operations)</option>
                <option value="supervisor">Supervisor (Limited)</option>
              </select>
              {errors.role && <span className="error-text">{errors.role}</span>}
            </div>

            {manager && (
              <div className="info-box">
                <Lock size={18} style={{ flexShrink: 0 }} />
                <p>
                  To change the secure PIN, please use the <strong>Change PIN</strong> button in the manager list actions.
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
              {isSubmitting ? 'Saving...' : (manager ? 'Update Account' : 'Create Account')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ChangePinModal = ({ manager, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    oldPin: '',
    newPin: '',
    confirmPin: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.oldPin.trim()) {
      newErrors.oldPin = 'Current PIN is required';
    }
    if (!formData.newPin.trim()) {
      newErrors.newPin = 'New PIN is required';
    } else if (!/^\d{4,6}$/.test(formData.newPin)) {
      newErrors.newPin = 'PIN must be 4-6 digits';
    }
    if (formData.newPin !== formData.confirmPin) {
      newErrors.confirmPin = 'PINs do not match';
    }
    if (formData.oldPin === formData.newPin) {
      newErrors.newPin = 'New PIN must be different';
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
      const result = await window.electronAPI.invoke(
        'firebase:change-manager-pin',
        manager.id,
        formData.oldPin,
        formData.newPin
      );

      if (result.success) {
        alert('PIN changed successfully!');
        onSuccess();
        onClose();
      } else {
        setErrors({ submit: result.error || 'Current PIN is incorrect' });
      }
    } catch (error) {
      console.error('Failed to change PIN:', error);
      setErrors({ submit: 'Service unavailable. Try again later.' });
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
            <Key size={20} />
            Update PIN
          </h3>
          <button onClick={onClose} className="btn-close" type="button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="manager-info" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="manager-avatar">{manager.name[0]}</div>
              <span style={{ fontWeight: 700 }}>{manager.name}</span>
            </div>

            {errors.submit && (
              <div className="error-message" style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                {errors.submit}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="oldPin">Current PIN</label>
              <input
                id="oldPin"
                type="password"
                value={formData.oldPin}
                onChange={(e) => handleInputChange('oldPin', e.target.value)}
                placeholder="••••"
                maxLength="6"
              />
              {errors.oldPin && <span className="error-text">{errors.oldPin}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="newPin">New Secure PIN</label>
              <input
                id="newPin"
                type="password"
                value={formData.newPin}
                onChange={(e) => handleInputChange('newPin', e.target.value)}
                placeholder="••••"
                maxLength="6"
              />
              {errors.newPin && <span className="error-text">{errors.newPin}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPin">Confirm New PIN</label>
              <input
                id="confirmPin"
                type="password"
                value={formData.confirmPin}
                onChange={(e) => handleInputChange('confirmPin', e.target.value)}
                placeholder="••••"
                maxLength="6"
              />
              {errors.confirmPin && <span className="error-text">{errors.confirmPin}</span>}
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
              {isSubmitting ? 'Updating...' : 'Update PIN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManagerManagement;
