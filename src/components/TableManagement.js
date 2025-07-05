import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  Coffee,
  ShoppingCart,
  Check,
  X,
  Clock,
  DollarSign
} from 'lucide-react';

const TableManagement = ({ onSelectTable }) => {
  const [tables, setTables] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [newTable, setNewTable] = useState({
    name: '',
    capacity: 4,
    area: 'restaurant', // 'restaurant' or 'bar'
    status: 'available' // 'available', 'occupied', 'reserved'
  });

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      const tableList = await window.electronAPI.getTables();
      setTables(tableList);
    } catch (error) {
      console.error('Failed to load tables:', error);
    }
  };

  const handleAddTable = async () => {
    try {
      await window.electronAPI.addTable(newTable);
      setNewTable({ name: '', capacity: 4, area: 'restaurant', status: 'available' });
      setShowAddForm(false);
      loadTables();
    } catch (error) {
      console.error('Failed to add table:', error);
      alert('Failed to add table. Please try again.');
    }
  };

  const handleUpdateTable = async (tableId, updates) => {
    try {
      await window.electronAPI.updateTable(tableId, updates);
      setEditingTable(null);
      loadTables();
    } catch (error) {
      console.error('Failed to update table:', error);
      alert('Failed to update table. Please try again.');
    }
  };

  const handleDeleteTable = async (tableId) => {
    if (window.confirm('Are you sure you want to delete this table?')) {
      try {
        await window.electronAPI.deleteTable(tableId);
        loadTables();
      } catch (error) {
        console.error('Failed to delete table:', error);
        alert('Failed to delete table. Please try again.');
      }
    }
  };

  const getTableStatusColor = (status) => {
    switch (status) {
      case 'available':
        return 'status-available';
      case 'occupied':
        return 'status-occupied';
      case 'reserved':
        return 'status-reserved';
      default:
        return 'status-available';
    }
  };

  const getTableStatusIcon = (status) => {
    switch (status) {
      case 'available':
        return <Check size={16} />;
      case 'occupied':
        return <Users size={16} />;
      case 'reserved':
        return <Clock size={16} />;
      default:
        return <Check size={16} />;
    }
  };

  const restaurantTables = tables.filter(table => table.area === 'restaurant');
  const barTables = tables.filter(table => table.area === 'bar');

  return (
    <div className="table-management">
      <div className="table-header">
        <h1>Table Management</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddForm(true)}
        >
          <Plus size={20} />
          Add Table
        </button>
      </div>

      {showAddForm && (
        <div className="add-table-form">
          <h3>Add New Table</h3>
          <div className="form-row">
            <input
              type="text"
              placeholder="Table Name (e.g., T1, Bar-A)"
              value={newTable.name}
              onChange={(e) => setNewTable({...newTable, name: e.target.value})}
              className="form-input"
            />
            <input
              type="number"
              placeholder="Capacity"
              value={newTable.capacity}
              onChange={(e) => setNewTable({...newTable, capacity: parseInt(e.target.value)})}
              className="form-input"
              min="1"
              max="20"
            />
            <select
              value={newTable.area}
              onChange={(e) => setNewTable({...newTable, area: e.target.value})}
              className="form-input"
            >
              <option value="restaurant">Restaurant</option>
              <option value="bar">Bar</option>
            </select>
          </div>
          <div className="form-actions">
            <button 
              className="btn btn-primary"
              onClick={handleAddTable}
              disabled={!newTable.name}
            >
              Add Table
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="tables-sections">
        {/* Restaurant Tables */}
        <div className="table-section">
          <h2>
            <Coffee size={24} />
            Restaurant Tables ({restaurantTables.length})
          </h2>
          <div className="tables-grid">
            {restaurantTables.map(table => (
              <div 
                key={table.id} 
                className={`table-card ${getTableStatusColor(table.status)}`}
                onClick={() => onSelectTable(table)}
              >
                <div className="table-header">
                  <h3>{table.name}</h3>
                  <div className="table-actions">
                    <button 
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTable(table);
                      }}
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      className="action-btn delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTable(table.id);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="table-info">
                  <div className="table-capacity">
                    <Users size={16} />
                    <span>{table.capacity} seats</span>
                  </div>
                  <div className={`table-status ${getTableStatusColor(table.status)}`}>
                    {getTableStatusIcon(table.status)}
                    <span>{table.status}</span>
                  </div>
                </div>
                {table.current_bill_amount > 0 && (
                  <div className="table-bill">
                    <DollarSign size={16} />
                    <span>₹{table.current_bill_amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="table-action">
                  <ShoppingCart size={16} />
                  <span>Open POS</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bar Tables */}
        <div className="table-section">
          <h2>
            <Coffee size={24} />
            Bar Tables ({barTables.length})
          </h2>
          <div className="tables-grid">
            {barTables.map(table => (
              <div 
                key={table.id} 
                className={`table-card ${getTableStatusColor(table.status)}`}
                onClick={() => onSelectTable(table)}
              >
                <div className="table-header">
                  <h3>{table.name}</h3>
                  <div className="table-actions">
                    <button 
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTable(table);
                      }}
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      className="action-btn delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTable(table.id);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="table-info">
                  <div className="table-capacity">
                    <Users size={16} />
                    <span>{table.capacity} seats</span>
                  </div>
                  <div className={`table-status ${getTableStatusColor(table.status)}`}>
                    {getTableStatusIcon(table.status)}
                    <span>{table.status}</span>
                  </div>
                </div>
                {table.current_bill_amount > 0 && (
                  <div className="table-bill">
                    <DollarSign size={16} />
                    <span>₹{table.current_bill_amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="table-action">
                  <ShoppingCart size={16} />
                  <span>Open POS</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Table Modal */}
      {editingTable && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Edit Table</h3>
            <div className="form-row">
              <input
                type="text"
                placeholder="Table Name"
                value={editingTable.name}
                onChange={(e) => setEditingTable({...editingTable, name: e.target.value})}
                className="form-input"
              />
              <input
                type="number"
                placeholder="Capacity"
                value={editingTable.capacity}
                onChange={(e) => setEditingTable({...editingTable, capacity: parseInt(e.target.value)})}
                className="form-input"
                min="1"
                max="20"
              />
            </div>
            <div className="form-row">
              <select
                value={editingTable.area}
                onChange={(e) => setEditingTable({...editingTable, area: e.target.value})}
                className="form-input"
              >
                <option value="restaurant">Restaurant</option>
                <option value="bar">Bar</option>
              </select>
              <select
                value={editingTable.status}
                onChange={(e) => setEditingTable({...editingTable, status: e.target.value})}
                className="form-input"
              >
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="reserved">Reserved</option>
              </select>
            </div>
            <div className="form-actions">
              <button 
                className="btn btn-primary"
                onClick={() => handleUpdateTable(editingTable.id, editingTable)}
              >
                Save Changes
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setEditingTable(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableManagement;
