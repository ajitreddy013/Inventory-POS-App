/**
 * EMAIL SERVICE - Automated Email Reporting System
 * 
 * This service handles automated email reporting for the Inventory POS application.
 * It provides:
 * - Daily business reports via email
 * - PDF report attachments
 * - Secure password encryption
 * - SMTP configuration management
 * - Email template generation
 * - Connection testing and validation
 * 
 * Features:
 * - Automated daily reports at scheduled times
 * - Professional HTML email templates
 * - PDF attachment support
 * - Secure password storage with encryption
 * - SMTP server configuration
 * - Email validation and error handling
 * 
 * Security:
 * - Passwords are encrypted using AES-256-CBC
 * - Configuration stored in local JSON file
 * - Input validation and sanitization
 * - Secure connection support (TLS/SSL)
 * 
 * @author Ajit Reddy
 * @version 1.0.0
 * @since 2024
 */

const nodemailer = require('nodemailer');  // Email sending library
const fs = require('fs');                  // File system operations
const path = require('path');              // Path manipulation
const crypto = require('crypto');          // Cryptographic functions

// ENCRYPTION CONFIGURATION
// Secure encryption for stored passwords to prevent plain text storage
// Generate a unique key based on machine-specific information
const os = require('os');
const machineId = crypto.createHash('sha256')
  .update(os.hostname() + os.type() + os.arch() + os.platform())
  .digest('hex');
const ENCRYPTION_KEY = crypto.scryptSync(machineId, 'inventory-pos-secure-salt-2024', 32);
const IV_LENGTH = 16;  // Initialization vector length for AES encryption

/**
 * ENCRYPT PASSWORD
 * 
 * Encrypts a password using AES-256-CBC encryption for secure storage.
 * The encrypted result includes the initialization vector (IV) for proper decryption.
 * 
 * @param {string} text - Plain text password to encrypt
 * @returns {string} Encrypted password in format "iv:encryptedText"
 */
function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);  // Generate random IV
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;  // Return IV:encrypted format
}

/**
 * DECRYPT PASSWORD
 * 
 * Decrypts a password that was encrypted using the encrypt() function.
 * Expects the input to be in "iv:encryptedText" format.
 * 
 * @param {string} text - Encrypted password in "iv:encryptedText" format
 * @returns {string} Decrypted plain text password
 */
function decrypt(text) {
  if (!text || !text.includes(':')) return text;  // Return if not encrypted
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');  // Extract IV
  const encryptedText = textParts.join(':');         // Get encrypted part
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * EMAIL SERVICE CLASS
 * 
 * Main class that handles all email operations for the application.
 * Manages SMTP configuration, email templates, and automated reporting.
 * 
 * Features:
 * - Secure password storage with encryption
 * - Professional HTML email templates
 * - PDF attachment support
 * - SMTP connection management
 * - Email validation and error handling
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.settings = {
      host: '',
      port: 587,
      secure: false,
      auth: {
        user: '',
        pass: ''
      },
      from: '',
      to: '',
      enabled: false
    };
    this.loadSettings();
  }

  loadSettings() {
    const settingsPath = path.join(__dirname, '../email-settings.json');
    try {
      if (fs.existsSync(settingsPath)) {
        const data = fs.readFileSync(settingsPath, 'utf8');
        const loadedSettings = JSON.parse(data);
        
        // Decrypt password if it exists
        if (loadedSettings.auth && loadedSettings.auth.pass) {
          try {
            loadedSettings.auth.pass = decrypt(loadedSettings.auth.pass);
          } catch (error) {
            console.error('Error decrypting email password:', error);
            loadedSettings.auth.pass = '';
          }
        }
        
        this.settings = { ...this.settings, ...loadedSettings };
      }
    } catch (error) {
      console.error('Error loading email settings:', error);
    }
  }

  validateEmailSettings(settings) {
    if (settings.host && typeof settings.host !== 'string') {
      throw new Error('Email host must be a string');
    }
    if (settings.port && (!Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535)) {
      throw new Error('Email port must be a valid port number (1-65535)');
    }
    if (settings.auth) {
      if (settings.auth.user && typeof settings.auth.user !== 'string') {
        throw new Error('Email username must be a string');
      }
      if (settings.auth.pass && typeof settings.auth.pass !== 'string') {
        throw new Error('Email password must be a string');
      }
    }
    if (settings.from && typeof settings.from !== 'string') {
      throw new Error('From email address must be a string');
    }
    if (settings.to && typeof settings.to !== 'string') {
      throw new Error('To email address must be a string');
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (settings.from && !emailRegex.test(settings.from)) {
      throw new Error('From email address is not valid');
    }
    if (settings.to && !emailRegex.test(settings.to)) {
      throw new Error('To email address is not valid');
    }
  }

  saveSettings(settings) {
    const settingsPath = path.join(__dirname, '../email-settings.json');
    
    try {
      this.validateEmailSettings(settings);
      
      const sanitizedSettings = { ...this.settings, ...settings };
      
      // Encrypt password before saving
      if (sanitizedSettings.auth && sanitizedSettings.auth.pass) {
        const settingsToSave = JSON.parse(JSON.stringify(sanitizedSettings));
        settingsToSave.auth.pass = encrypt(sanitizedSettings.auth.pass);
        fs.writeFileSync(settingsPath, JSON.stringify(settingsToSave, null, 2));
      } else {
        fs.writeFileSync(settingsPath, JSON.stringify(sanitizedSettings, null, 2));
      }
      
      this.settings = sanitizedSettings;
      this.initializeTransporter();
      return true;
    } catch (error) {
      console.error('Error saving email settings:', error);
      return false;
    }
  }

  initializeTransporter() {
    if (!this.settings.host || !this.settings.auth.user || !this.settings.auth.pass) {
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: this.settings.host,
      port: this.settings.port,
      secure: this.settings.secure,
      auth: {
        user: this.settings.auth.user,
        pass: this.settings.auth.pass
      }
    });
  }

  async testConnection() {
    if (!this.transporter) {
      this.initializeTransporter();
    }
    
    if (!this.transporter) {
      throw new Error('Email configuration not set up');
    }

    try {
      await this.transporter.verify();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sendDailyReport(reportData, attachmentPaths = []) {
    if (!this.settings.enabled || !this.transporter) {
      return { success: false, error: 'Email service not configured or disabled' };
    }

    const today = new Date().toLocaleDateString();
    const subject = `Daily Sales & Financial Report - ${today}`;
    
    let html = `
      <h2>Daily Sales & Financial Report - ${today}</h2>
      <div style="font-family: Arial, sans-serif;">
        <h3>Dashboard Summary</h3>
        <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
          <tr style="background-color: #f2f2f2;">
            <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Total Products</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${reportData.totalProducts || 0}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Low Stock Items</td>
            <td style="border: 1px solid #ddd; padding: 8px; color: ${(reportData.lowStockItems || 0) > 0 ? '#d32f2f' : '#2e7d32'};">${reportData.lowStockItems || 0}</td>
          </tr>
          <tr style="background-color: #f2f2f2;">
            <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Today's Sales Count</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${reportData.todaySales || 0}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Total Transactions</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${reportData.totalTransactions || 0}</td>
          </tr>
          <tr style="background-color: #f2f2f2;">
            <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Table Sales</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${reportData.tableSales || 0}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Parcel Sales</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${reportData.parcelSales || 0}</td>
          </tr>
        </table>
    `;

    // Add financial summary if available
    if (reportData.totalSpendings !== undefined || reportData.netIncome !== undefined) {
      html += `
        <h3>Financial Summary</h3>
        <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
          <tr style="background-color: #f2f2f2;">
            <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Total Revenue</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${reportData.totalRevenue ? reportData.totalRevenue.toFixed(2) : '0.00'}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Total Spendings</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${reportData.totalSpendings ? reportData.totalSpendings.toFixed(2) : '0.00'}</td>
          </tr>
          <tr style="background-color: #f2f2f2;">
            <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Net Income</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${reportData.netIncome ? reportData.netIncome.toFixed(2) : '0.00'}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Total Balance</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${reportData.totalBalance ? reportData.totalBalance.toFixed(2) : '0.00'}</td>
          </tr>
        </table>
      `;
    }

    if (reportData.topItems && reportData.topItems.length > 0) {
      html += `
        <h3>Top Selling Items</h3>
        <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Item</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Quantity Sold</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Revenue</th>
          </tr>
      `;
      
      reportData.topItems.forEach((item, index) => {
        html += `
          <tr ${index % 2 === 0 ? 'style="background-color: #f9f9f9;"' : ''}>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.name}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.quantity}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.revenue.toFixed(2)}</td>
          </tr>
        `;
      });
      
      html += `</table>`;
    }

    html += `
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This is an automated report generated by your POS system.
        </p>
        <p style="color: #666; font-size: 12px;">
          <strong>Attached PDF Reports:</strong>
        </p>
        <ul style="color: #666; font-size: 12px;">
          <li><strong>DailyReport.pdf</strong> - Complete dashboard overview, financial summary, and performance metrics</li>
          <li><strong>SalesReport.pdf</strong> - Detailed sales transactions and customer analytics</li>
          <li><strong>FinancialReport.pdf</strong> - Comprehensive financial analysis and profit/loss statements</li>
        </ul>
        <p style="color: #666; font-size: 12px;">
          <em>Note: All reports are provided as individual PDF files for easy viewing and sharing. No zip archives are included.</em>
        </p>
      </div>
    `;

    // Prepare attachments
    const attachments = [];
    if (attachmentPaths && Array.isArray(attachmentPaths)) {
      attachmentPaths.forEach(attachmentPath => {
        if (attachmentPath && attachmentPath.path) {
          attachments.push({
            path: attachmentPath.path,
            filename: attachmentPath.filename || path.basename(attachmentPath.path)
          });
        } else if (typeof attachmentPath === 'string') {
          attachments.push({
            path: attachmentPath,
            filename: path.basename(attachmentPath)
          });
        }
      });
    }

    const mailOptions = {
      from: this.settings.from,
      to: this.settings.to,
      subject: subject,
      html: html,
      attachments: attachments
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getSettings() {
    return { ...this.settings, auth: { ...this.settings.auth, pass: '***' } };
  }

  // Method to reload settings from disk (useful after reset)
  reloadSettings() {
    // Reset to defaults first
    this.settings = {
      host: '',
      port: 587,
      secure: false,
      auth: {
        user: '',
        pass: ''
      },
      from: '',
      to: '',
      enabled: false
    };
    
    // Load from file if it exists
    this.loadSettings();
    
    // Clear transporter to force recreation with new settings
    this.transporter = null;
    
    return this.getSettings();
  }
}

module.exports = EmailService;
