const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Simple encryption for stored passwords
const ENCRYPTION_KEY = crypto.scryptSync('inventory-pos-secret', 'salt', 32);
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  if (!text || !text.includes(':')) return text;
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = textParts.join(':');
  const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

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

    this.transporter = nodemailer.createTransporter({
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

  async sendDailyReport(reportData, attachmentPath = null) {
    if (!this.settings.enabled || !this.transporter) {
      return { success: false, error: 'Email service not configured or disabled' };
    }

    const today = new Date().toLocaleDateString();
    const subject = `Daily Sales Report - ${today}`;
    
    let html = `
      <h2>Daily Sales Report - ${today}</h2>
      <div style="font-family: Arial, sans-serif;">
        <h3>Summary</h3>
        <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
          <tr style="background-color: #f2f2f2;">
            <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Total Sales</td>
            <td style="border: 1px solid #ddd; padding: 8px;">₹${reportData.totalAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Total Transactions</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${reportData.totalTransactions}</td>
          </tr>
          <tr style="background-color: #f2f2f2;">
            <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Table Sales</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${reportData.tableSales}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Parcel Sales</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${reportData.parcelSales}</td>
          </tr>
        </table>
    `;

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
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${item.revenue.toFixed(2)}</td>
          </tr>
        `;
      });
      
      html += `</table>`;
    }

    html += `
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This is an automated report generated by your POS system.
        </p>
      </div>
    `;

    const mailOptions = {
      from: this.settings.from,
      to: this.settings.to,
      subject: subject,
      html: html,
      attachments: attachmentPath ? [{ path: attachmentPath }] : []
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
}

module.exports = EmailService;
