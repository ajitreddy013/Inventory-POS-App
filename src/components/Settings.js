import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Printer, Store, Save, Edit, Mail, Send, TestTube, RotateCcw, AlertTriangle, Archive, Info, HelpCircle, Plus, Trash2, Layers, RefreshCw } from 'lucide-react';

const Settings = () => {
  const [printerStatus, setPrinterStatus] = useState({ connected: false, device: 'Not connected' });
  const [printerConfig, setPrinterConfig] = useState({
    type: 'usb',
    networkHost: '192.168.1.100',
    networkPort: 9100,
    serialPath: '/dev/ttyUSB0',
    serialBaudRate: 9600
  });
  const [barSettings, setBarSettings] = useState({
    bar_name: '',
    contact_number: '',
    gst_number: '',
    address: '',
    thank_you_message: ''
  });
  const [emailSettings, setEmailSettings] = useState({
    host: '',
    port: 587,
    secure: false,
    auth: { user: '', pass: '' },
    from: '',
    to: '',
    enabled: false
  });
  
  // Section Management State
  const [sections, setSections] = useState([]);
  const [tables, setTables] = useState([]);
  const [newSectionName, setNewSectionName] = useState('');
  const [sectionTableNames, setSectionTableNames] = useState({}); // Key: sectionId, Value: tableName
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [sectionLoading, setSectionLoading] = useState(false);
  
  const [isEditingBarInfo, setIsEditingBarInfo] = useState(false);
  const [isEditingEmailInfo, setIsEditingEmailInfo] = useState(false);
  const [isEditingPrinterConfig, setIsEditingPrinterConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [printerLoading, setPrinterLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [closeSellLoading, setCloseSellLoading] = useState(false);

  useEffect(() => {
    checkPrinterStatus();
    loadBarSettings();
    loadEmailSettings();
    loadSections();
    loadTables();
  }, []);

  // Section Management Functions
  const loadSections = async () => {
    try {
      const sectionsData = await window.electronAPI.getSections();
      setSections(sectionsData);
    } catch (error) {
      console.error('Error loading sections:', error);
    }
  };

  const loadTables = async () => {
    try {
      const tablesData = await window.electronAPI.getTables();
      setTables(tablesData);
    } catch (error) {
      console.error('Error loading tables:', error);
    }
  };

  const handleAddSection = async () => {
    if (!newSectionName.trim()) {
      alert('Please enter a section name');
      return;
    }
    try {
      setSectionLoading(true);
      await window.electronAPI.addSection({ name: newSectionName.trim() });
      setNewSectionName('');
      await loadSections();
      await syncToFirebase();
      alert('Section added and synced to mobile app!');
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        alert('Section with this name already exists');
      } else {
        alert('Failed to add section');
      }
    } finally {
      setSectionLoading(false);
    }
  };

  const handleDeleteSection = async (sectionId) => {
    if (!confirm('Are you sure you want to delete this section? Tables in this section will become unassigned.')) {
      return;
    }
    try {
      await window.electronAPI.deleteSection(sectionId);
      await loadSections();
      await loadTables();
      if (selectedSectionId === sectionId) {
        setSelectedSectionId(null);
      }
      await syncToFirebase();
      alert('Section deleted and synced to mobile app!');
    } catch (error) {
      alert('Failed to delete section');
    }
  };

  const handleAddTable = async () => {
    const tableName = sectionTableNames[selectedSectionId] || '';
    if (!tableName.trim()) {
      alert('Please enter a table name');
      return;
    }
    try {
      setSectionLoading(true);
      console.log('Adding table:', tableName.trim(), 'to section:', selectedSectionId);
      
      await window.electronAPI.addTable({
        name: tableName.trim(),
        capacity: 4,
        section_id: selectedSectionId,
        area: '',
        status: 'available'
      });
      
      // Clear ONLY THIS section's input
      setSectionTableNames(prev => ({ ...prev, [selectedSectionId]: '' }));
      await loadTables();
      
      // Try to sync but don't fail if it doesn't work
      try {
        await syncToFirebase();
      } catch (syncErr) {
        console.warn('Sync failed but table was added:', syncErr);
      }
      
      alert('Table added successfully!');
    } catch (error) {
      console.error('Error adding table:', error);
      if (error.message && error.message.includes('UNIQUE constraint')) {
        alert('Table with this name already exists');
      } else {
        alert('Failed to add table: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setSectionLoading(false);
    }
  };

  const handleDeleteTable = async (tableId) => {
    if (!confirm('Are you sure you want to delete this table?')) {
      return;
    }
    try {
      await window.electronAPI.deleteTable(tableId);
      await loadTables();
      await syncToFirebase();
      alert('Table deleted and synced to mobile app!');
    } catch (error) {
      alert('Failed to delete table');
    }
  };

  const getTablesForSection = (sectionId) => {
    return tables.filter(t => t.section_id === sectionId);
  };

  // Sync sections and tables to Firebase
  const syncToFirebase = async () => {
    try {
      // Get all sections and tables from local database
      const allSections = await window.electronAPI.getSections();
      const allTables = await window.electronAPI.getTables();
      
      // Call Firebase sync handler
      const result = await window.electronAPI.syncSectionsTables({
        sections: allSections,
        tables: allTables
      });
      
      if (result.success) {
        console.log('Synced to Firebase:', result.message);
      } else {
        console.error('Firebase sync failed:', result.error);
      }
    } catch (error) {
      console.error('Error syncing to Firebase:', error);
    }
  };

  const checkPrinterStatus = async () => {
    try {
      const status = await window.electronAPI.getPrinterStatus();
      setPrinterStatus(status);
    } catch (error) {
      // Failed to get printer status
    }
  };

  const configurePrinter = async () => {
    try {
      setPrinterLoading(true);
      const result = await window.electronAPI.configurePrinter(printerConfig);
      if (result.success) {
        setIsEditingPrinterConfig(false);
        alert('Printer configuration saved successfully!');
        await checkPrinterStatus();
      } else {
        alert(`Failed to configure printer: ${result.error}`);
      }
    } catch (error) {
      // Failed to configure printer
      alert('Failed to configure printer');
    } finally {
      setPrinterLoading(false);
    }
  };

  const testPrinterConnection = async () => {
    try {
      setPrinterLoading(true);
      const result = await window.electronAPI.testPrinterConnection();
      if (result.success) {
        alert('Printer connection test successful!');
        await checkPrinterStatus();
      } else {
        alert(`Printer connection test failed: ${result.error}`);
      }
    } catch (error) {
      alert('Printer connection test failed');
    } finally {
      setPrinterLoading(false);
    }
  };

  const reconnectPrinter = async () => {
    try {
      setPrinterLoading(true);
      const result = await window.electronAPI.reconnectPrinter();
      if (result.success) {
        alert('Printer reconnected successfully!');
        await checkPrinterStatus();
      } else {
        alert(`Failed to reconnect printer: ${result.error}`);
      }
    } catch (error) {
      alert('Failed to reconnect printer');
    } finally {
      setPrinterLoading(false);
    }
  };

  const loadBarSettings = async () => {
    try {
      const settings = await window.electronAPI.getBarSettings();
      setBarSettings(settings);
    } catch (error) {
      // Failed to load bar settings
    }
  };

  const loadEmailSettings = async () => {
    try {
      const settings = await window.electronAPI.getEmailSettings();
      setEmailSettings(settings);
    } catch (error) {
      // Failed to load email settings
    }
  };

  const saveBarSettings = async () => {
    try {
      setLoading(true);
      await window.electronAPI.saveBarSettings(barSettings);
      setIsEditingBarInfo(false);
      alert('Bar information saved successfully!');
    } catch (error) {
      // Failed to save bar settings
      alert('Failed to save bar information');
    } finally {
      setLoading(false);
    }
  };

  const saveEmailSettings = async () => {
    try {
      setEmailLoading(true);
      const success = await window.electronAPI.saveEmailSettings(emailSettings);
      if (success) {
        setIsEditingEmailInfo(false);
        alert('Email settings saved successfully!');
      } else {
        alert('Failed to save email settings');
      }
    } catch (error) {
      // Failed to save email settings
      alert('Failed to save email settings');
    } finally {
      setEmailLoading(false);
    }
  };

  const testEmailConnection = async () => {
    try {
      setEmailLoading(true);
      const result = await window.electronAPI.testEmailConnection();
      if (result.success) {
        alert('Email connection test successful!');
      } else {
        alert(`Email connection test failed: ${result.error}`);
      }
    } catch (error) {
      alert('Email connection test failed');
    } finally {
      setEmailLoading(false);
    }
  };

  const sendTestEmail = async () => {
    try {
      setEmailLoading(true);
      const result = await window.electronAPI.sendTestEmail();
      if (result.success) {
        alert('Test email sent successfully!');
      } else {
        alert(`Failed to send test email: ${result.error}`);
      }
    } catch (error) {
      alert('Failed to send test email');
    } finally {
      setEmailLoading(false);
    }
  };

  const sendDailyEmailNow = async () => {
    try {
      setEmailLoading(true);
      const result = await window.electronAPI.sendDailyEmailNow();
      if (result.success) {
        alert('Daily report email sent successfully!');
      } else {
        alert(`Failed to send daily report: ${result.error}`);
      }
    } catch (error) {
      alert('Failed to send daily report');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleBarSettingsChange = (field, value) => {
    setBarSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEmailSettingsChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setEmailSettings(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setEmailSettings(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handlePrinterConfigChange = (field, value) => {
    setPrinterConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleResetApplication = async () => {
    if (!showResetConfirm) {
      setShowResetConfirm(true);
      return;
    }

    // Check if user typed "reset app" correctly
    if (resetConfirmText.trim().toLowerCase() !== 'reset app') {
      alert('Please type "reset app" exactly to confirm the reset.');
      return;
    }

    try {
      setResetLoading(true);
      const result = await window.electronAPI.resetApplication();
      
      if (result.success) {
        // Reset email settings in UI to default values
        setEmailSettings({
          host: '',
          port: 587,
          secure: false,
          auth: { user: '', pass: '' },
          from: '',
          to: '',
          enabled: false
        });
        
        // Force reload email settings from file (which should now be deleted)
        try {
          const freshEmailSettings = await window.electronAPI.getEmailSettings();
          setEmailSettings(freshEmailSettings);
        } catch (error) {
          console.log('Email settings file successfully deleted - using defaults');
        }
        
        // Reset bar settings to default values
        setBarSettings({
          bar_name: '',
          contact_number: '',
          gst_number: '',
          address: '',
          thank_you_message: ''
        });
        
        alert('Application reset completed successfully!\n\nAll data has been cleared and sample data has been restored.\n\nPlease restart the application for best results.');
        setShowResetConfirm(false);
        setResetConfirmText('');
        
        // Reload the page to reflect changes
        window.location.reload();
      } else {
        alert(`Failed to reset application: ${result.error}`);
      }
    } catch (error) {
      // Failed to reset application
      alert('Failed to reset application. Please try again.');
    } finally {
      setResetLoading(false);
      setShowResetConfirm(false);
      setResetConfirmText('');
    }
  };

  const cancelReset = () => {
    setShowResetConfirm(false);
    setResetConfirmText('');
  };

  const handleCloseSell = async () => {
    try {
      setCloseSellLoading(true);
      const result = await window.electronAPI.closeSellAndGenerateReports();
      
      if (result.success) {
        const message = `Close Sell completed successfully!\n\n📁 Reports ZIP: ${result.zipPath}\n\n💾 Database Backup: ${result.databaseBackupPath || 'Failed to create'}\n\n📊 Reports Backup: ${result.reportsBackupPath || 'Failed to create'}\n\n📧 Email sent to owner: ${result.emailSent ? 'Yes' : 'No'}\n\n✅ All data has been safely backed up to your local machine!`;
        alert(message);
      } else {
        alert(`Failed to complete Close Sell: ${result.error}`);
      }
    } catch (error) {
      // Error in Close Sell
      alert('Failed to complete Close Sell. Please try again.');
    } finally {
      setCloseSellLoading(false);
    }
  };

  // Menu items for the grid
  const menuItems = [
    { name: 'Waiters', path: '/waiters', icon: '👤', color: '#3498db' },
    { name: 'Managers', path: '/managers', icon: '👔', color: '#9b59b6' },
    { name: 'Menu', path: '/menu', icon: '📋', color: '#e67e22' },
    { name: 'Failed KOT', path: '/failed-kots', icon: '⚠️', color: '#e74c3c' },
    { name: 'Printer', path: '/settings', icon: '🖨️', color: '#2c3e50' },
    { name: 'Email', path: '/settings', icon: '📧', color: '#27ae60' },
  ];

  const handleMenuClick = (path) => {
    window.location.hash = path;
  };

  return (
    <div className="settings">
      <div className="page-header">
        <h1><SettingsIcon size={24} /> Settings</h1>
      </div>

      <div style={{ padding: '20px 30px' }}>
        
        {/* Quick Access Grid */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
            gap: '15px' 
          }}>
            {menuItems.map((item) => (
              <div
                key={item.name}
                onClick={() => handleMenuClick(item.path)}
                style={{
                  background: item.color,
                  color: '#fff',
                  borderRadius: '12px',
                  padding: '20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                }}
              >
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>{item.icon}</div>
                <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{item.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bar Information Section */}
        <div className="table-container" style={{ marginBottom: '30px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '20px',
            borderBottom: '1px solid #e9ecef'
          }}>
            <h2 style={{ margin: 0 }}>
              <Store size={20} style={{ marginRight: '10px' }} />
              Bar Information
            </h2>
            <button 
              onClick={() => setIsEditingBarInfo(!isEditingBarInfo)}
              className="btn btn-secondary"
            >
              <Edit size={16} />
              {isEditingBarInfo ? 'Cancel' : 'Edit'}
            </button>
          </div>
          
          <div style={{ padding: '20px' }}>
            {isEditingBarInfo ? (
              <div className="bar-settings-form">
                <div className="form-row">
                  <label>
                    Bar Name:
                    <input
                      type="text"
                      value={barSettings.bar_name}
                      onChange={(e) => handleBarSettingsChange('bar_name', e.target.value)}
                      className="form-input"
                      placeholder="Enter bar name"
                    />
                  </label>
                  <label>
                    Contact Number:
                    <input
                      type="text"
                      value={barSettings.contact_number}
                      onChange={(e) => handleBarSettingsChange('contact_number', e.target.value)}
                      className="form-input"
                      placeholder="Enter contact number"
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    GST Number:
                    <input
                      type="text"
                      value={barSettings.gst_number}
                      onChange={(e) => handleBarSettingsChange('gst_number', e.target.value)}
                      className="form-input"
                      placeholder="Enter GST number"
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label style={{ gridColumn: '1 / -1' }}>
                    Address:
                    <textarea
                      value={barSettings.address}
                      onChange={(e) => handleBarSettingsChange('address', e.target.value)}
                      className="form-input"
                      placeholder="Enter complete address"
                      rows="3"
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label style={{ gridColumn: '1 / -1' }}>
                    Thank You Message:
                    <input
                      type="text"
                      value={barSettings.thank_you_message}
                      onChange={(e) => handleBarSettingsChange('thank_you_message', e.target.value)}
                      className="form-input"
                      placeholder="Enter thank you message for bills"
                    />
                  </label>
                </div>
                <div className="form-actions">
                  <button 
                    onClick={saveBarSettings}
                    disabled={loading}
                    className="btn btn-primary"
                  >
                    <Save size={16} />
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bar-settings-display">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <h4>Bar Name</h4>
                    <p>{barSettings.bar_name || 'Not set'}</p>
                    <h4>Contact Number</h4>
                    <p>{barSettings.contact_number || 'Not set'}</p>
                    <h4>GST Number</h4>
                    <p>{barSettings.gst_number || 'Not set'}</p>
                  </div>
                  <div>
                    <h4>Address</h4>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{barSettings.address || 'Not set'}</p>
                    <h4>Thank You Message</h4>
                    <p>{barSettings.thank_you_message || 'Thank you for visiting!'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section & Table Management */}
        <div className="table-container" style={{ marginBottom: '30px', border: '2px solid #3498db' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '20px',
            borderBottom: '1px solid #e9ecef',
            background: '#ebf5fb'
          }}>
            <div>
              <h2 style={{ margin: 0, color: '#2c3e50', display: 'flex', alignItems: 'center' }}>
                <Layers size={20} style={{ marginRight: '10px' }} />
                Section & Table Management
              </h2>
              <span style={{ color: '#7f8c8d', fontSize: '0.9rem', display: 'block', marginTop: '5px' }}>
                Create sections (AC, Garden) and add tables to sync with mobile app
              </span>
            </div>
            <button 
              className="action-btn"
              onClick={syncToFirebase}
              style={{
                background: '#2ecc71',
                padding: '8px 15px',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <RefreshCw size={16} />
              Sync Tables to Mobile
            </button>
            <button 
              className="action-btn"
              onClick={async () => {
                try {
                  const result = await window.electronAPI.syncMenu();
                  if (result.success) {
                    alert('Menu synced to mobile app: ' + result.message);
                  } else {
                    alert('Failed to sync menu: ' + result.error);
                  }
                } catch (error) {
                  alert('Error syncing menu: ' + error.message);
                }
              }}
              style={{
                background: '#3498db',
                padding: '8px 15px',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginLeft: '10px'
              }}
            >
              <RefreshCw size={16} />
              Sync Menu to Mobile
            </button>
          </div>

          <div style={{ padding: '20px' }}>
            {/* Add New Section */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '10px', color: '#2c3e50' }}>Create New Section</h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Section name (e.g., AC, Garden, Terrace)"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddSection()}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    fontSize: '1rem'
                  }}
                />
                <button
                  onClick={handleAddSection}
                  disabled={sectionLoading}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Plus size={16} />
                  {sectionLoading ? 'Adding...' : 'Add Section'}
                </button>
              </div>
            </div>

            {/* Existing Sections */}
            <div>
              <h3 style={{ marginBottom: '15px', color: '#2c3e50' }}>Your Sections</h3>
              {sections.length === 0 ? (
                <div style={{ 
                  padding: '30px', 
                  textAlign: 'center', 
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  color: '#7f8c8d'
                }}>
                  <Layers size={40} style={{ marginBottom: '10px', opacity: 0.5 }} />
                  <p>No sections yet. Create your first section above!</p>
                  <p style={{ fontSize: '0.9rem' }}>Examples: AC Hall, Garden, Terrace, Bar Area</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {sections.map(section => (
                    <div 
                      key={section.id} 
                      style={{ 
                        border: selectedSectionId === section.id ? '2px solid #3498db' : '1px solid #e0e0e0',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: selectedSectionId === section.id ? '#f0f8ff' : '#fff'
                      }}
                    >
                      {/* Section Header - Compact */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: '#f8f9fa',
                        borderBottom: selectedSectionId === section.id ? '1px solid #e0e0e0' : 'none'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => setSelectedSectionId(selectedSectionId === section.id ? null : section.id)}
                            className="btn btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                          >
                            {selectedSectionId === section.id ? '▼' : '▶'}
                          </button>
                          <h4 style={{ margin: 0, color: '#2c3e50', fontSize: '0.95rem' }}>{section.name}</h4>
                          <span style={{ 
                            background: '#e0e0e0', 
                            padding: '1px 6px', 
                            borderRadius: '8px',
                            fontSize: '0.7rem',
                            color: '#666'
                          }}>
                            {getTablesForSection(section.id).length}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteSection(section.id)}
                          className="btn btn-danger"
                          style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Tables for this section */}
                      {selectedSectionId === section.id && (
                        <div style={{ padding: '15px' }}>
                          {/* Add Table Form */}
                          <div style={{ 
                            display: 'flex', 
                            gap: '8px', 
                            marginBottom: '8px',
                            padding: '8px',
                            background: '#f8f9fa',
                            borderRadius: '6px'
                          }}>
                            <input
                              type="text"
                              placeholder="Table name"
                              value={sectionTableNames[section.id] || ''}
                              onChange={(e) => setSectionTableNames(prev => ({ ...prev, [section.id]: e.target.value }))}
                              onKeyPress={(e) => e.key === 'Enter' && handleAddTable()}
                              style={{
                                flex: 1,
                                padding: '6px',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                fontSize: '0.85rem'
                              }}
                            />
                            <button
                              onClick={handleAddTable}
                              disabled={sectionLoading}
                              className="btn btn-primary"
                              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                            >
                              <Plus size={12} /> Add
                            </button>
                          </div>

                          {/* Table List */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {getTablesForSection(section.id).map(table => (
                              <div
                                key={table.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 8px',
                                  background: '#fff',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px'
                                }}
                              >
                                <span style={{ fontWeight: '600', color: '#2c3e50', fontSize: '0.85rem' }}>
                                  {table.name}
                                </span>
                                <button
                                  onClick={() => handleDeleteTable(table.id)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#e74c3c',
                                    cursor: 'pointer',
                                    padding: '0'
                                  }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                            {getTablesForSection(section.id).length === 0 && (
                              <p style={{ color: '#7f8c8d', fontStyle: 'italic' }}>
                                No tables in this section. Add one above!
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Email Settings Section */}
        <div className="table-container" style={{ marginBottom: '30px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '20px',
            borderBottom: '1px solid #e9ecef'
          }}>
            <h2 style={{ margin: 0 }}>
              <Mail size={20} style={{ marginRight: '10px' }} />
              Email Settings
            </h2>
            <button 
              onClick={() => setIsEditingEmailInfo(!isEditingEmailInfo)}
              className="btn btn-secondary"
            >
              <Edit size={16} />
              {isEditingEmailInfo ? 'Cancel' : 'Edit'}
            </button>
          </div>
          
          <div style={{ padding: '20px' }}>
            {isEditingEmailInfo ? (
              <div className="email-settings-form">
                <div className="form-row">
                  <label>
                    Enable Daily Email Reports:
                    <input
                      type="checkbox"
                      checked={emailSettings.enabled}
                      onChange={(e) => handleEmailSettingsChange('enabled', e.target.checked)}
                      style={{ marginLeft: '10px' }}
                    />
                  </label>
                </div>
                
                {emailSettings.enabled && (
                  <>
                    <div className="form-row">
                      <label>
                        SMTP Host:
                        <input
                          type="text"
                          value={emailSettings.host}
                          onChange={(e) => handleEmailSettingsChange('host', e.target.value)}
                          className="form-input"
                          placeholder="smtp.gmail.com"
                        />
                      </label>
                      <label>
                        Port:
                        <input
                          type="number"
                          value={emailSettings.port}
                          onChange={(e) => handleEmailSettingsChange('port', parseInt(e.target.value))}
                          className="form-input"
                          placeholder="587"
                        />
                      </label>
                    </div>
                    <div className="form-row">
                      <label>
                        Email Address:
                        <input
                          type="email"
                          value={emailSettings.auth.user}
                          onChange={(e) => handleEmailSettingsChange('auth.user', e.target.value)}
                          className="form-input"
                          placeholder="your.email@gmail.com"
                        />
                      </label>
                      <label>
                        App Password:
                        <input
                          type="password"
                          value={emailSettings.auth.pass}
                          onChange={(e) => handleEmailSettingsChange('auth.pass', e.target.value)}
                          className="form-input"
                          placeholder="App-specific password"
                        />
                      </label>
                    </div>
                    <div className="form-row">
                      <label>
                        From Address:
                        <input
                          type="email"
                          value={emailSettings.from}
                          onChange={(e) => handleEmailSettingsChange('from', e.target.value)}
                          className="form-input"
                          placeholder="sender@example.com"
                        />
                      </label>
                      <label>
                        To Address (Owner):
                        <input
                          type="email"
                          value={emailSettings.to}
                          onChange={(e) => handleEmailSettingsChange('to', e.target.value)}
                          className="form-input"
                          placeholder="owner@example.com"
                        />
                      </label>
                    </div>
                    <div className="form-row">
                      <label>
                        Use SSL/TLS:
                        <input
                          type="checkbox"
                          checked={emailSettings.secure}
                          onChange={(e) => handleEmailSettingsChange('secure', e.target.checked)}
                          style={{ marginLeft: '10px' }}
                        />
                      </label>
                    </div>
                  </>
                )}
                
                <div className="form-actions">
                  <button 
                    onClick={saveEmailSettings}
                    disabled={emailLoading}
                    className="btn btn-primary"
                  >
                    <Save size={16} />
                    {emailLoading ? 'Saving...' : 'Save Settings'}
                  </button>
                  
                  {emailSettings.enabled && (
                    <>
                      <button 
                        onClick={testEmailConnection}
                        disabled={emailLoading}
                        className="btn btn-secondary"
                        style={{ marginLeft: '10px' }}
                      >
                        <TestTube size={16} />
                        Test Connection
                      </button>
                      
                      <button 
                        onClick={sendTestEmail}
                        disabled={emailLoading}
                        className="btn btn-secondary"
                        style={{ marginLeft: '10px' }}
                      >
                        <Send size={16} />
                        Send Test Email
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="email-settings-display">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <h4>Email Reports</h4>
                    <p>{emailSettings.enabled ? '✓ Enabled' : '✗ Disabled'}</p>
                    {emailSettings.enabled && (
                      <>
                        <h4>SMTP Host</h4>
                        <p>{emailSettings.host || 'Not set'}</p>
                        <h4>From Address</h4>
                        <p>{emailSettings.from || 'Not set'}</p>
                      </>
                    )}
                  </div>
                  <div>
                    {emailSettings.enabled && (
                      <>
                        <h4>To Address (Owner)</h4>
                        <p>{emailSettings.to || 'Not set'}</p>
                        <h4>Port</h4>
                        <p>{emailSettings.port || 587}</p>
                        <h4>Security</h4>
                        <p>{emailSettings.secure ? 'SSL/TLS' : 'STARTTLS'}</p>
                        
                        <div style={{ marginTop: '20px' }}>
                          <button 
                            onClick={sendDailyEmailNow}
                            disabled={emailLoading}
                            className="btn btn-primary"
                          >
                            <Send size={16} />
                            Send Daily Report Now
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                {emailSettings.enabled && (
                  <div style={{ 
                    background: '#e8f5e8', 
                    border: '1px solid #4caf50', 
                    borderRadius: '6px', 
                    padding: '15px', 
                    marginTop: '20px' 
                  }}>
                    <strong>Daily Reports Schedule:</strong> Reports are automatically sent every day at 11:59 PM.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Close Sell Section */}
        <div className="table-container" style={{ marginBottom: '30px', border: '2px solid #27ae60' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '20px',
            borderBottom: '1px solid #27ae60',
            backgroundColor: '#f0f8f0'
          }}>
            <h2 style={{ margin: 0, color: '#27ae60' }}>
              <Archive size={20} style={{ marginRight: '10px' }} />
              Close Sell
            </h2>
          </div>
          
          <div style={{ padding: '20px' }}>
            <div style={{ 
              background: '#e8f5e8', 
              border: '1px solid #27ae60', 
              borderRadius: '6px', 
              padding: '15px', 
              marginBottom: '20px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <Archive size={16} style={{ marginRight: '8px', color: '#27ae60' }} />
                <strong style={{ color: '#27ae60' }}>Close Sell Operation</strong>
              </div>
              <p style={{ margin: '0', color: '#27ae60', fontSize: '0.9rem' }}>
                This operation will generate all PDF reports, create database backups, and compress them into a ZIP file for easy access.
              </p>
              <ul style={{ margin: '10px 0 0 0', paddingLeft: '20px', color: '#27ae60', fontSize: '0.9rem' }}>
                <li>🗄️ Create complete database backup</li>
                <li>📊 Generate daily comprehensive report</li>
                <li>💰 Generate sales report</li>
                <li>📈 Generate financial report</li>
                <li>📦 Generate inventory report</li>
                <li>📋 Generate pending bills report</li>
                <li>🗜️ Compress all PDFs into a ZIP file</li>
                <li>💾 Save backups to local backup directories</li>
                <li>📧 Automatically send ZIP file to owner via email</li>
                <li>🗃️ Preserve all historical data permanently</li>
              </ul>
            </div>
            
            <button 
              onClick={handleCloseSell}
              disabled={closeSellLoading}
              className="btn"
              style={{
                backgroundColor: '#27ae60',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '6px',
                cursor: closeSellLoading ? 'not-allowed' : 'pointer',
                opacity: closeSellLoading ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              <Archive size={16} />
              {closeSellLoading ? 'Processing Close Sell...' : 'Close Sell'}
            </button>
          </div>
        </div>

        {/* Reset Application Section */}
        <div className="table-container" style={{ marginBottom: '30px', border: '2px solid #e74c3c' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '20px',
            borderBottom: '1px solid #e74c3c',
            backgroundColor: '#fdf2f2'
          }}>
            <h2 style={{ margin: 0, color: '#e74c3c' }}>
              <AlertTriangle size={20} style={{ marginRight: '10px' }} />
              Reset Application
            </h2>
          </div>
          
          <div style={{ padding: '20px' }}>
            <div style={{ 
              background: '#fff3cd', 
              border: '1px solid #ffeaa7', 
              borderRadius: '6px', 
              padding: '15px', 
              marginBottom: '20px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <AlertTriangle size={16} style={{ marginRight: '8px', color: '#856404' }} />
                <strong style={{ color: '#856404' }}>Warning: This action cannot be undone!</strong>
              </div>
              <p style={{ margin: '0', color: '#856404', fontSize: '0.9rem' }}>
                Resetting the application will permanently delete all data including:
              </p>
              <ul style={{ margin: '10px 0 0 0', paddingLeft: '20px', color: '#856404', fontSize: '0.9rem' }}>
                <li>All products and inventory</li>
                <li>All sales records and transactions</li>
                <li>All pending bills and table orders</li>
                <li>All spendings and counter balance records</li>
                <li>All settings and configurations</li>
              </ul>
              <p style={{ margin: '10px 0 0 0', color: '#856404', fontSize: '0.9rem' }}>
                Sample data will be restored after reset.
              </p>
            </div>
            
            {!showResetConfirm ? (
              <button 
                onClick={handleResetApplication}
                disabled={resetLoading}
                className="btn"
                style={{
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: '6px',
                  cursor: resetLoading ? 'not-allowed' : 'pointer',
                  opacity: resetLoading ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <RotateCcw size={16} />
                {resetLoading ? 'Resetting...' : 'Reset Application'}
              </button>
            ) : (
              <div style={{ 
                background: '#f8d7da', 
                border: '1px solid #f5c6cb', 
                borderRadius: '6px', 
                padding: '15px'
              }}>
                <p style={{ margin: '0 0 15px 0', color: '#721c24', fontWeight: 'bold' }}>
                  Are you absolutely sure you want to reset the application?
                </p>
                <p style={{ margin: '0 0 15px 0', color: '#721c24', fontSize: '0.9rem' }}>
                  This will permanently delete all your data and cannot be undone.
                </p>
                <div style={{ marginBottom: '15px' }}>
                  <p style={{ margin: '0 0 10px 0', color: '#721c24', fontSize: '0.9rem', fontWeight: 'bold' }}>
                    To confirm, please type &quot;reset app&quot; below:
                  </p>
                  <input
                    type="text"
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="Type 'reset app' to confirm"
                    disabled={resetLoading}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #dc3545',
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      backgroundColor: resetLoading ? '#f8f9fa' : 'white',
                      color: '#721c24'
                    }}
                    autoComplete="off"
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={handleResetApplication}
                    disabled={resetLoading || resetConfirmText.trim().toLowerCase() !== 'reset app'}
                    className="btn"
                    style={{
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      padding: '10px 16px',
                      borderRadius: '4px',
                      cursor: (resetLoading || resetConfirmText.trim().toLowerCase() !== 'reset app') ? 'not-allowed' : 'pointer',
                      opacity: (resetLoading || resetConfirmText.trim().toLowerCase() !== 'reset app') ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <RotateCcw size={14} />
                    {resetLoading ? 'Resetting...' : 'Yes, Reset Everything'}
                  </button>
                  <button 
                    onClick={cancelReset}
                    disabled={resetLoading}
                    className="btn"
                    style={{
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      padding: '10px 16px',
                      borderRadius: '4px',
                      cursor: resetLoading ? 'not-allowed' : 'pointer',
                      opacity: resetLoading ? 0.6 : 1
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="summary-cards">
          <div className="summary-card">
            <h3><Printer size={20} style={{ marginRight: '10px' }} />Printer Status</h3>
            <div className="value" style={{ 
              fontSize: '1rem', 
              color: printerStatus.connected ? '#27ae60' : '#e74c3c',
              textAlign: 'center',
              margin: '10px 0'
            }}>
              {printerStatus.connected ? 'Connected' : 'Disconnected'}
            </div>
            <p style={{ margin: '10px 0 0 0', fontSize: '0.9rem', color: '#7f8c8d', textAlign: 'center' }}>
              Device: {printerStatus.device}
            </p>
            <button 
              onClick={checkPrinterStatus}
              className="btn btn-primary"
              style={{ marginTop: '15px', alignSelf: 'center' }}
            >
              Check Status
            </button>
          </div>

          <div className="summary-card printer-config-card">
            <h3 className="printer-config-title"><Printer size={20} />Printer Configuration</h3>
            <div className="printer-config-content">
              <div className="config-status">
                <span className="status-label">Status:</span>
                <span className={`status-value ${printerStatus.connected ? 'connected' : 'disconnected'}`}>
                  {printerStatus.connected ? 'Connected' : 'Disconnected'}
                </span>
                <span className="device-name">({printerStatus.device})</span>
              </div>
              <div className="config-type">
                <span className="type-label">Type:</span>
                <span className="type-value">{printerConfig.type.toUpperCase()}</span>
              </div>
              {isEditingPrinterConfig ? (
                <>
                  <label>
                    Printer Type:
                    <select value={printerConfig.type} onChange={(e) => handlePrinterConfigChange('type', e.target.value)}>
                      <option value="usb">USB</option>
                      <option value="network">Network</option>
                      <option value="serial">Serial</option>
                    </select>
                  </label>
                  {printerConfig.type === 'network' && (
                  <>
                    <label>
                      Network Host:
                      <input
                        type="text"
                        value={printerConfig.networkHost}
                        onChange={(e) => handlePrinterConfigChange('networkHost', e.target.value)}
                      />
                    </label>
                    <label>
                      Network Port:
                      <input
                        type="number"
                        value={printerConfig.networkPort}
                        onChange={(e) => handlePrinterConfigChange('networkPort', e.target.value)}
                      />
                    </label>
                  </>
                  )}
                  {printerConfig.type === 'serial' && (
                  <>
                    <label>
                      Serial Path:
                      <input
                        type="text"
                        value={printerConfig.serialPath}
                        onChange={(e) => handlePrinterConfigChange('serialPath', e.target.value)}
                      />
                    </label>
                    <label>
                      Serial Baud Rate:
                      <input
                        type="number"
                        value={printerConfig.serialBaudRate}
                        onChange={(e) => handlePrinterConfigChange('serialBaudRate', e.target.value)}
                      />
                    </label>
                  </>
                  )}
                  <div className="printer-actions">
                    <button className="btn btn-success config-save-btn" onClick={configurePrinter}>
                      Save Configuration
                    </button>
                    <button className="btn btn-secondary config-cancel-btn" onClick={() => setIsEditingPrinterConfig(false)}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <button className="btn btn-primary config-edit-btn" onClick={() => setIsEditingPrinterConfig(true)}>
                  Edit Configuration
                </button>
              )}
              <div className="printer-actions">
                <button className="btn btn-info test-connection-btn" onClick={testPrinterConnection} disabled={printerLoading}>
                  {printerLoading ? 'Testing...' : 'Test Connection'}
                </button>
                <button className="btn btn-warning reconnect-btn" onClick={reconnectPrinter} disabled={printerLoading}>
                  {printerLoading ? 'Reconnecting...' : 'Reconnect'}
                </button>
              </div>
            </div>
          </div>

          <div className="summary-card">
            <h3><Info size={20} style={{ marginRight: '10px' }} />Application Info</h3>
            <div style={{ textAlign: 'left', fontSize: '0.9rem', width: '100%' }}>
              <p style={{ margin: '8px 0', display: 'flex', justifyContent: 'space-between' }}>
                <strong>Version:</strong> 
                <span>1.0.0</span>
              </p>
              <p style={{ margin: '8px 0', display: 'flex', justifyContent: 'space-between' }}>
                <strong>Database:</strong> 
                <span>SQLite</span>
              </p>
              <p style={{ margin: '8px 0', display: 'flex', justifyContent: 'space-between' }}>
                <strong>Platform:</strong> 
                <span>Electron</span>
              </p>
            </div>
          </div>

          <div className="summary-card">
            <h3><HelpCircle size={20} style={{ marginRight: '10px' }} />Support</h3>
            <div style={{ textAlign: 'left', fontSize: '0.9rem', width: '100%' }}>
              <p style={{ margin: '8px 0', fontWeight: '600', color: '#2c3e50' }}>For technical support:</p>
              <p style={{ margin: '8px 0', display: 'flex', justifyContent: 'space-between' }}>
                <strong>Email:</strong> 
                <span>ajitreddy013@gmail.com</span>
              </p>
              <p style={{ margin: '8px 0', display: 'flex', justifyContent: 'space-between' }}>
                <strong>Phone:</strong> 
                <span>+91 7517323121</span>
              </p>
            </div>
          </div>
        </div>

        <div className="table-container" style={{ marginTop: '30px' }}>
          <h2 style={{ padding: '20px', margin: 0, borderBottom: '1px solid #e9ecef' }}>
            System Requirements
          </h2>
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Requirement</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Operating System</td>
                <td>Windows 10 or later</td>
                <td><span style={{ color: '#27ae60' }}>✓ Compatible</span></td>
              </tr>
              <tr>
                <td>Thermal Printer</td>
                <td>Epson TM-T82II or compatible</td>
                <td>
                  <span style={{ color: printerStatus.connected ? '#27ae60' : '#e74c3c' }}>
                    {printerStatus.connected ? '✓ Connected' : '✗ Not Connected'}
                  </span>
                </td>
              </tr>
              <tr>
                <td>Database</td>
                <td>SQLite (included)</td>
                <td><span style={{ color: '#27ae60' }}>✓ Active</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="table-container" style={{ marginTop: '30px' }}>
          <h2 style={{ padding: '20px', margin: 0, borderBottom: '1px solid #e9ecef' }}>
            Printer Setup Guide
          </h2>
          <div style={{ padding: '20px' }}>
            <h3>For USB Connection:</h3>
            <ol style={{ marginLeft: '20px', lineHeight: '1.6' }}>
              <li>Connect the Epson TM-T82II printer to your computer via USB cable</li>
              <li>Install the printer drivers from Epson&apos;s official website</li>
              <li>Set the printer to ESC/POS mode</li>
              <li>Restart the application to detect the printer</li>
            </ol>
            
            <h3 style={{ marginTop: '20px' }}>For Network Connection:</h3>
            <ol style={{ marginLeft: '20px', lineHeight: '1.6' }}>
              <li>Connect the printer to your network</li>
              <li>Note down the printer&apos;s IP address</li>
              <li>Configure the network settings in the printer service</li>
              <li>Test the connection using the &quot;Check Status&quot; button above</li>
            </ol>

            <div style={{ 
              background: '#fff3cd', 
              border: '1px solid #ffeaa7', 
              borderRadius: '6px', 
              padding: '15px', 
              marginTop: '20px' 
            }}>
              <strong>Note:</strong> The application will automatically search for compatible printers on common ports. 
              If your printer is not detected, ensure it&apos;s properly connected and powered on.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
