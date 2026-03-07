import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
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
  DollarSign,
  RefreshCw
} from 'lucide-react';

const TableManagement = ({ onSelectTable }) => {
  const [tables, setTables] = useState([]);
  const [sections, setSections] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [newTable, setNewTable] = useState({
    name: '',
    capacity: 4,
    section_id: '',
    area: '', // 'restaurant' or 'bar'
    status: 'available' // 'available', 'occupied', 'reserved'
  });

  const loadTables = useCallback(async () => {
    try {
      const result = await window.electronAPI.invoke('firebase:get-tables');
      if (result.success) {
        setTables(result.tables || []);
      }
    } catch (error) {
      console.error('Error loading tables:', error);
    }
  }, []);

  const initializeDefaultTables = useCallback(async () => {
    try {
      const tableList = await window.electronAPI.getTables();
      
      // Check if we have tables T1-T12
      const existingTableNames = tableList.map(table => table.name);
      const requiredTables = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
      
      for (const tableName of requiredTables) {
        if (!existingTableNames.includes(tableName)) {
          await window.electronAPI.addTable({
            name: tableName,
            capacity: 4,
            area: 'restaurant',
            status: 'available'
          });
        }
      }
      
      // Reload tables after initialization
      loadTables();
    } catch (error) {
      // Failed to initialize default tables
    }
  }, [loadTables]);

  const loadSections = useCallback(async () => {
    try {
      const result = await window.electronAPI.invoke('firebase:get-sections');
      if (result.success) {
        setSections(result.sections || []);
      }
    } catch (error) {
      console.error('Error loading sections:', error);
    }
  }, []);

  useEffect(() => {
    loadTables();
    loadSections();
  }, [loadTables, loadSections]);



  const handleResetTables = async () => {
    const userInput = prompt('To reset tables, type "reset app" exactly:');
    
    if (userInput !== 'reset app') {
      alert('Reset cancelled. You must type "reset app" exactly to proceed.');
      return;
    }
    
    try {
      const tableList = await window.electronAPI.getTables();
      
      // Find tables after T12 and delete them
      const tablesToDelete = tableList.filter(table => {
        const tableNumberMatch = table.name.match(/^T(\d+)$/);
        return tableNumberMatch && parseInt(tableNumberMatch[1]) > 12;
      });
      
      for (const table of tablesToDelete) {
        await window.electronAPI.deleteTable(table.id);
      }
      
      loadTables();
      alert('Tables reset successfully!');
    } catch (error) {
      // Failed to reset tables
      alert('Failed to reset tables. Please try again.');
    }
  };

  const getNextTableNumber = (existingTables) => {
    // Get all table numbers from existing tables that follow the T{number} pattern
    const tableNumbers = existingTables
      .map(table => table.name.match(/^T(\d+)$/)) // Match T followed by digits
      .filter(match => match !== null) // Remove non-matches
      .map(match => parseInt(match[1])) // Extract the number
      .sort((a, b) => a - b); // Sort numerically
    
    // Find the first gap or return the next number after the highest
    let nextNumber = 1;
    for (const num of tableNumbers) {
      if (num === nextNumber) {
        nextNumber++;
      } else {
        break;
      }
    }
    
    return `T${nextNumber}`;
  };

  const handleAddTable = async () => {
    try {
      const tableName = newTable.name || getNextTableNumber(tables);
      
      const tableToAdd = {
        name: tableName,
        capacity: newTable.capacity || 4,
        section_id: newTable.section_id || null,
        area: '',
        status: 'available'
      };
      
      await window.electronAPI.addTable(tableToAdd);
      setShowAddForm(false);
      setNewTable({
        name: '',
        capacity: 4,
        section_id: '',
        area: '',
        status: 'available'
      });
      loadTables();
    } catch (error) {
      // Failed to add table
      alert('Failed to add table. Please try again.');
    }
  };

  const handleUpdateTable = async (tableId, updates) => {
    try {
      await window.electronAPI.updateTable(tableId, updates);
      setEditingTable(null);
      loadTables();
    } catch (error) {
      // Failed to update table
      alert('Failed to update table. Please try again.');
    }
  };

  const handleDeleteTable = async (tableId) => {
    if (window.confirm('Are you sure you want to delete this table?')) {
      try {
        await window.electronAPI.deleteTable(tableId);
        loadTables();
      } catch (error) {
        // Failed to delete table
        alert('Failed to delete table. Please try again.');
      }
    }
  };

  const getTableStatusColor = (status, hasOrder) => {
    if (hasOrder) {
      return 'table-occupied'; // Green for ongoing orders
    }
    switch (status) {
      case 'available':
        return 'table-available'; // Red for empty tables
      case 'occupied':
        return 'table-occupied'; // Green for occupied tables
      case 'reserved':
        return 'table-reserved'; // Yellow for reserved tables
      default:
        return 'table-available';
    }
  };

  const getTableStatusIcon = (status, hasOrder) => {
    if (hasOrder) {
      return <ShoppingCart size={16} />;
    }
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

  // Group tables by section
  const tablesBySection = {};
  
  // First, add sections as keys with empty arrays
  sections.forEach(section => {
    tablesBySection[section.id] = [];
  });
  
  // Then, group tables by their section_id
  tables.forEach(table => {
    const sectionId = table.section_id || 'unassigned';
    if (!tablesBySection[sectionId]) {
      tablesBySection[sectionId] = [];
    }
    tablesBySection[sectionId].push(table);
  });
  
  // Sort tables within each section by name
  Object.keys(tablesBySection).forEach(sectionId => {
    tablesBySection[sectionId].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  });
  
  // Legacy tables (no section) - for backward compatibility
  const numberedTables = tables
    .filter(table => /^T\d+$/.test(table.name) && !table.section_id)
    .sort((a, b) => {
      const numA = parseInt(a.name.substring(1));
      const numB = parseInt(b.name.substring(1));
      return numA - numB;
    });

  // Calculate how many rows we need (4 columns per row)
  const totalNumberedTables = numberedTables.length;
  const rowsNeeded = Math.ceil(totalNumberedTables / 4);
  const gridSize = rowsNeeded * 4;

  // Create the grid with numbered tables, filling empty slots with null
  const gridTables = [];
  for (let i = 0; i < gridSize; i++) {
    gridTables.push(numberedTables[i] || null);
  }

  // Other tables (non-numbered like Bar-A, Counter-1, etc.) without section
  const otherTables = tables.filter(table => !/^T\d+$/.test(table.name) && !table.section_id);

  return (
    <div className="table-management">
      <div className="table-header">
        <h1>Table Management</h1>
        <div className="header-actions">
          <button 
            className="btn btn-secondary"
            onClick={loadTables}
          >
            <RefreshCw size={20} />
            Refresh
          </button>
          <button 
            className="btn btn-warning"
            onClick={handleResetTables}
            title="Reset tables (removes tables after T12)"
          >
            <RefreshCw size={20} />
            Reset Tables
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={20} />
            Add Table
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="add-table-form">
          <h3>Add New Table</h3>
          <div className="next-table-info">
            <p>Next table number will be: <strong>{getNextTableNumber(tables)}</strong></p>
            <p><em>Leave name empty to auto-generate, or enter custom name</em></p>
          </div>
          <div className="form-row">
            <input
              type="text"
              placeholder={`Table Name (auto: ${getNextTableNumber(tables)} or custom name)`}
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
          </div>
          <div className="form-row">
            <select
              value={newTable.section_id}
              onChange={(e) => setNewTable({...newTable, section_id: e.target.value})}
              className="form-input"
            >
              <option value="">Select Section (optional)</option>
              {sections.map(section => (
                <option key={section.id} value={section.id}>{section.name}</option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button 
              className="btn btn-primary"
              onClick={handleAddTable}
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
        {/* Sections with Tables - Same as mobile app */}
        {sections.map(section => {
          const sectionTables = tablesBySection[section.id] || [];
          if (sectionTables.length === 0) return null;
          
          return (
            <div key={section.id} className="table-section">
              <h2>
                <Coffee size={24} />
                {section.name} ({sectionTables.length})
              </h2>
              <div className="tables-grid">
                {sectionTables.map(table => {
                  const hasOrder = table.current_bill_amount > 0;
                  return (
                    <div 
                      key={table.id} 
                      className={`table-card ${getTableStatusColor(table.status, hasOrder)}`}
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
                            className="action-btn delete"
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
                      <div className={`table-status ${getTableStatusColor(table.status, hasOrder)}`}>
                        {getTableStatusIcon(table.status, hasOrder)}
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
                );
              })}
            </div>
          </div>
          );
        })}

        {/* Legacy Numbered Tables (T1-T12 without section) */}
        {numberedTables.length > 0 && (
          <div className="table-section">
            <h2>
              <Coffee size={24} />
              Restaurant Tables
            </h2>
            <div className="tables-main-grid">
              {gridTables.map((table, index) => {
                const hasOrder = table && table.current_bill_amount > 0;
                const expectedTableNumber = index + 1;
                const expectedTableName = `T${expectedTableNumber}`;
                
                return (
                  <div 
                    key={table ? table.id : `empty-${index}`} 
                    className={`table-square ${table ? getTableStatusColor(table.status, hasOrder) : 'table-empty'}`}
                    onClick={table ? () => onSelectTable(table) : undefined}
                  >
                    <div className="table-number">
                      {table ? table.name : expectedTableName}
                    </div>
                    {table ? (
                      <>
                        <div className="table-status-icon">
                          {getTableStatusIcon(table.status, hasOrder)}
                        </div>
                        {table.current_bill_amount > 0 && (
                          <div className="table-amount">
                            ₹{table.current_bill_amount.toFixed(0)}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="table-status-icon">
                        <X size={16} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Other Tables (without section) */}
        {otherTables.length > 0 && (
          <div className="table-section">
            <h2>
              <Coffee size={24} />
              Other Tables ({otherTables.length})
            </h2>
            <div className="tables-grid">
              {otherTables.map(table => {
                const hasOrder = table.current_bill_amount > 0;
                return (
                  <div 
                    key={table.id} 
                    className={`table-card ${getTableStatusColor(table.status, hasOrder)}`}
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
                          className="action-btn delete"
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
                      <span className="table-capacity">
                        <Users size={14} /> {table.capacity} seats
                      </span>
                      <span className={`table-status status-${table.status}`}>
                        {table.status}
                      </span>
                    </div>
                    {table.current_bill_amount > 0 && (
                      <div className="table-bill">
                        <span>Current Bill:</span>
                        <span>₹{table.current_bill_amount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="table-action">
                      <ShoppingCart size={16} />
                      <span>Open POS</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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

TableManagement.propTypes = {
  onSelectTable: PropTypes.func.isRequired
};

export default TableManagement;
