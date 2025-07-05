import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Printer, Wifi, Store, Save, Edit, Mail, Send, TestTube } from 'lucide-react';

const Settings = () => {
  const [printerStatus, setPrinterStatus] = useState({ connected: false, device: 'Not connected' });
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
  const [isEditingBarInfo, setIsEditingBarInfo] = useState(false);
  const [isEditingEmailInfo, setIsEditingEmailInfo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    checkPrinterStatus();
    loadBarSettings();
    loadEmailSettings();
  }, []);

  const checkPrinterStatus = async () => {
    try {
      const status = await window.electronAPI.getPrinterStatus();
      setPrinterStatus(status);
    } catch (error) {
      console.error('Failed to get printer status:', error);
    }
  };

  const loadBarSettings = async () => {
    try {
      const settings = await window.electronAPI.getBarSettings();
      setBarSettings(settings);
    } catch (error) {
      console.error('Failed to load bar settings:', error);
    }
  };

  const loadEmailSettings = async () => {
    try {
      const settings = await window.electronAPI.getEmailSettings();
      setEmailSettings(settings);
    } catch (error) {
      console.error('Failed to load email settings:', error);
    }
  };

  const saveBarSettings = async () => {
    try {
      setLoading(true);
      await window.electronAPI.saveBarSettings(barSettings);
      setIsEditingBarInfo(false);
      alert('Bar information saved successfully!');
    } catch (error) {
      console.error('Failed to save bar settings:', error);
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
      console.error('Failed to save email settings:', error);
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

  return (
    <div className="settings">
      <div className="page-header">
        <h1><SettingsIcon size={24} /> Settings</h1>
      </div>

      <div style={{ padding: '20px 30px' }}>
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

        <div className="summary-cards">
          <div className="summary-card">
            <h3><Printer size={20} style={{ marginRight: '10px' }} />Printer Status</h3>
            <div className="value" style={{ 
              fontSize: '1rem', 
              color: printerStatus.connected ? '#27ae60' : '#e74c3c' 
            }}>
              {printerStatus.connected ? 'Connected' : 'Disconnected'}
            </div>
            <p style={{ margin: '10px 0 0 0', fontSize: '0.9rem', color: '#7f8c8d' }}>
              Device: {printerStatus.device}
            </p>
            <button 
              onClick={checkPrinterStatus}
              className="btn btn-primary"
              style={{ marginTop: '15px' }}
            >
              Check Status
            </button>
          </div>

          <div className="summary-card">
            <h3>Application Info</h3>
            <div style={{ textAlign: 'left', fontSize: '0.9rem' }}>
              <p><strong>Version:</strong> 1.0.0</p>
              <p><strong>Database:</strong> SQLite</p>
              <p><strong>Platform:</strong> Electron</p>
            </div>
          </div>

          <div className="summary-card">
            <h3>Support</h3>
            <div style={{ textAlign: 'left', fontSize: '0.9rem' }}>
              <p>For technical support:</p>
              <p>Email: support@inventorypos.com</p>
              <p>Phone: +1-XXX-XXX-XXXX</p>
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
              <li>Install the printer drivers from Epson's official website</li>
              <li>Set the printer to ESC/POS mode</li>
              <li>Restart the application to detect the printer</li>
            </ol>
            
            <h3 style={{ marginTop: '20px' }}>For Network Connection:</h3>
            <ol style={{ marginLeft: '20px', lineHeight: '1.6' }}>
              <li>Connect the printer to your network</li>
              <li>Note down the printer's IP address</li>
              <li>Configure the network settings in the printer service</li>
              <li>Test the connection using the "Check Status" button above</li>
            </ol>

            <div style={{ 
              background: '#fff3cd', 
              border: '1px solid #ffeaa7', 
              borderRadius: '6px', 
              padding: '15px', 
              marginTop: '20px' 
            }}>
              <strong>Note:</strong> The application will automatically search for compatible printers on common ports. 
              If your printer is not detected, ensure it's properly connected and powered on.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
