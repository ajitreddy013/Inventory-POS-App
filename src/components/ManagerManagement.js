import React, { useState, useEffect } from 'react';
import { Shield, Plus, Edit, Search, UserCheck, UserX, Key, ArrowLeft } from 'lucide-react';
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
    // In a real app, you'd get the current manager from auth context
    // For now, we'll set it to null and let user select
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

  const filteredManagers = managers.filter(manager => {
    const matchesSearch = manager.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || manager.role === filterRole;
    const matchesStatus = filterStatus === 'all' || 
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
        // Update existing manager
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
        // Create new manager
        const result = await window.electronAPI.invoke('firebase:create-manager', managerData);
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

  const handleCloseChangePinModal = () => {
    setShowChangePinModal(false);
    setCurrentManager(null);
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'owner':
        return 'role-owner';
      case 'manager':
        return 'role-manager';
      case 'supervisor':
        return 'role-supervisor';
      default:
        return '';
    }
  };

  return (
    <div className="manager-management">
      <div className="page-header">
        <div className="header-left">
          <button onClick={() => navigate('/settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: 8, display: 'flex', alignItems: 'center', color: '#4f46e5' }}>
            <ArrowLeft size={22} />
          </button>
          <Shield size={32} />
          <div>
            <h1>Manager Accounts</h1>
            <p>Manage manager accounts with secure PIN authentication</p>
          </div>
        </div>
        <button className="btn-primary" onClick={handleAddManager}>
          <Plus size={20} />
          Add Manager
        </button>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-buttons">
          <div className="filter-group">
            <label>Role:</label>
            <button
              className={filterRole === 'all' ? 'active' : ''}
              onClick={() => setFilterRole('all')}
            >
              All
            </button>
            <button
              className={filterRole === 'owner' ? 'active' : ''}
              onClick={() => setFilterRole('owner')}
            >
              Owner
            </button>
            <button
              className={filterRole === 'manager' ? 'active' : ''}
              onClick={() => setFilterRole('manager')}
            >
              Manager
            </button>
            <button
              className={filterRole === 'supervisor' ? 'active' : ''}
              onClick={() => setFilterRole('supervisor')}
            >
              Supervisor
            </button>
          </div>
          <div className="filter-group">
            <label>Status:</label>
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

      <div className="managers-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredManagers.length === 0 ? (
              <tr>
                <td colSpan="4" className="no-data">
                  No managers found
                </td>
              </tr>
            ) : (
              filteredManagers.map((manager) => (
                <tr key={manager.id}>
                  <td>{manager.name}</td>
                  <td>
                    <span className={`role-badge ${getRoleBadgeClass(manager.role)}`}>
                      {manager.role.charAt(0).toUpperCase() + manager.role.slice(1)}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${manager.isActive ? 'active' : 'inactive'}`}>
                      {manager.isActive ? (
                        <>
                          <UserCheck size={16} />
                          Active
                        </>
                      ) : (
                        <>
                          <UserX size={16} />
                          Inactive
                        </>
                      )}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon"
                        onClick={() => handleEditManager(manager)}
                        title="Edit Manager"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        className="btn-icon btn-warning"
                        onClick={() => handleChangeMyPin(manager)}
                        title="Change PIN"
                      >
                        <Key size={18} />
                      </button>
                      <button
                        className={`btn-icon ${manager.isActive ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => handleToggleStatus(manager)}
                        title={manager.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {manager.isActive ? <UserX size={18} /> : <UserCheck size={18} />}
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
    role: manager?.role || 'manager'
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
            <Shield size={24} />
            {manager ? 'Edit Manager' : 'Add New Manager'}
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
                Manager Name <span className="required">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={errors.name ? 'error' : ''}
                placeholder="Enter manager name"
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            {!manager && (
              <div className="form-group">
                <label htmlFor="pin">
                  PIN <span className="required">*</span>
                </label>
                <input
                  id="pin"
                  type="password"
                  value={formData.pin}
                  onChange={(e) => handleInputChange('pin', e.target.value)}
                  className={errors.pin ? 'error' : ''}
                  placeholder="Enter 4-6 digit PIN"
                  maxLength="6"
                />
                {errors.pin && <span className="error-text">{errors.pin}</span>}
                <small className="help-text">PIN will be securely hashed with bcrypt</small>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="role">
                Role <span className="required">*</span>
              </label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => handleInputChange('role', e.target.value)}
                className={errors.role ? 'error' : ''}
              >
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
                <option value="supervisor">Supervisor</option>
              </select>
              {errors.role && <span className="error-text">{errors.role}</span>}
              <small className="help-text">
                Owner: Full access | Manager: Inventory & reports | Supervisor: Limited operations
              </small>
            </div>

            {manager && (
              <div className="info-box">
                <p>To change the PIN, use the &quot;Change PIN&quot; button in the actions menu.</p>
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
              {isSubmitting ? 'Saving...' : manager ? 'Update Manager' : 'Create Manager'}
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
    confirmPin: ''
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
      newErrors.newPin = 'New PIN must be different from current PIN';
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
        setErrors({ submit: result.error || 'Failed to change PIN' });
      }
    } catch (error) {
      console.error('Failed to change PIN:', error);
      setErrors({ submit: 'Failed to change PIN. Please try again.' });
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
            <Key size={24} />
            Change PIN - {manager.name}
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
              <label htmlFor="oldPin">
                Current PIN <span className="required">*</span>
              </label>
              <input
                id="oldPin"
                type="password"
                value={formData.oldPin}
                onChange={(e) => handleInputChange('oldPin', e.target.value)}
                className={errors.oldPin ? 'error' : ''}
                placeholder="Enter current PIN"
                maxLength="6"
              />
              {errors.oldPin && <span className="error-text">{errors.oldPin}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="newPin">
                New PIN <span className="required">*</span>
              </label>
              <input
                id="newPin"
                type="password"
                value={formData.newPin}
                onChange={(e) => handleInputChange('newPin', e.target.value)}
                className={errors.newPin ? 'error' : ''}
                placeholder="Enter new 4-6 digit PIN"
                maxLength="6"
              />
              {errors.newPin && <span className="error-text">{errors.newPin}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPin">
                Confirm New PIN <span className="required">*</span>
              </label>
              <input
                id="confirmPin"
                type="password"
                value={formData.confirmPin}
                onChange={(e) => handleInputChange('confirmPin', e.target.value)}
                className={errors.confirmPin ? 'error' : ''}
                placeholder="Re-enter new PIN"
                maxLength="6"
              />
              {errors.confirmPin && <span className="error-text">{errors.confirmPin}</span>}
            </div>

            <div className="info-box">
              <p>Your PIN will be securely hashed and stored. Make sure to remember your new PIN.</p>
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
              {isSubmitting ? 'Changing PIN...' : 'Change PIN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManagerManagement;
