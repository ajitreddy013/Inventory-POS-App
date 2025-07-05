import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Printer, Wifi } from 'lucide-react';

const Settings = () => {
  const [printerStatus, setPrinterStatus] = useState({ connected: false, device: 'Not connected' });

  useEffect(() => {
    checkPrinterStatus();
  }, []);

  const checkPrinterStatus = async () => {
    try {
      const status = await window.electronAPI.getPrinterStatus();
      setPrinterStatus(status);
    } catch (error) {
      console.error('Failed to get printer status:', error);
    }
  };

  return (
    <div className="settings">
      <div className="page-header">
        <h1><SettingsIcon size={24} /> Settings</h1>
      </div>

      <div style={{ padding: '20px 30px' }}>
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
