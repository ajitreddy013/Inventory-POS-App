# Ajit Wines - Inventory POS Application

🏆 **A Complete Point of Sale (POS) and Inventory Management System**

A comprehensive, production-ready business management solution built specifically for restaurants, bars, and retail establishments. Features dual stock management, thermal printer integration, automated reporting, and complete financial tracking.

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-Proprietary-red)

## 📸 Screenshots

### Dashboard
![Dashboard](screenshots/dashboard.png)
*Main dashboard showing business overview, key metrics, and quick access to all modules*

### POS System
![POS System](screenshots/pos-system.png)
*Point of sale interface with product selection, cart management, and billing*

### Inventory Management
![Inventory Management](screenshots/inventory-management.png)
*Stock management with godown and counter stock tracking*

### Product Management
![Product Management](screenshots/product-management.png)
*Product catalog management with variants and pricing*

### Daily Transfer
![Daily Transfer](screenshots/daily-transfer.png)
*Stock transfer interface from godown to counter*

### Sales Reports
![Sales Reports](screenshots/sales-reports.png)
*Comprehensive sales analytics and reporting*

### Table Management
![Table Management](screenshots/table-management.png)
*Restaurant table layout and order management*

### Settings
![Settings](screenshots/settings.png)
*Application configuration and system settings*

## ✨ Key Highlights

- 🖥️ **Cross-Platform Desktop Application** - Windows, macOS, Linux support
- 🔐 **Secure Architecture** - Electron with secure IPC communication
- 📊 **Real-time Business Analytics** - Live dashboards and automated reports
- 🖨️ **Professional Hardware Integration** - ESC/POS thermal printer support
- 📧 **Automated Email Reports** - Daily business summaries with PDF attachments
- 💾 **Local Database** - SQLite for reliable, offline-first operation
- 🎯 **Production Ready** - Comprehensive error handling and logging

## 🚀 Core Features

### 📦 Business Management Modules

#### 1. 🏪 Advanced Inventory Management
- **Product Catalog**: Complete product management with variants (sizes, types)
- **Dual Stock System**: 
  - **Godown Stock**: Master inventory from suppliers
  - **Counter Stock**: Ready-to-sell operational stock
- **Smart Stock Transfers**: Bulk transfer with validation and audit trail
- **Automatic Updates**: Real-time stock updates on sales and transfers
- **Low Stock Alerts**: Visual warnings and automated notifications
- **Stock Movement Audit**: Complete history of all stock changes
- **Barcode Support**: SKU and barcode management
- **Category Management**: Organize products by categories

#### 2. 💰 Point of Sale (POS) System
- **Dual Sale Types**: Table service and takeaway/parcel orders
- **Smart Product Selection**: Quick search with counter stock validation
- **Advanced Cart Management**: Add, remove, modify quantities with live totals
- **Flexible Billing**: Tax, discount, and multiple payment method support
- **Payment Methods**: Cash, Card, UPI, Cheque, Credit
- **Professional Bill Generation**: PDF export and thermal printer support
- **Customer Management**: Optional customer details and phone tracking
- **Sale Validation**: Prevents overselling with stock checks

#### 3. 🍽️ Restaurant Table Management
- **Table Layout**: Visual table management for restaurant/bar areas
- **Table Status Tracking**: Available, occupied, reserved states
- **Order Management**: Save and resume table orders
- **Table-Specific POS**: Dedicated interface for table orders
- **Bill Management**: Track current bill amounts per table
- **Capacity Management**: Set table capacity and area designation

#### 4. 📊 Advanced Sales Analytics
- **Real-time Sales Tracking**: Live sales monitoring with detailed records
- **Comprehensive Sale History**: Complete transaction records with search/filter
- **Customer Analytics**: Track customer preferences and order history
- **Payment Analysis**: Breakdown by payment methods
- **Time-based Reports**: Daily, weekly, monthly sales analysis
- **Top-selling Items**: Analytics on best-performing products

#### 5. 📈 Professional Reporting Suite
- **Daily Sales Reports**: Comprehensive daily business summaries
- **Financial Reports**: Revenue, expenses, profit/loss analysis
- **Inventory Reports**: Stock levels, low stock, and movement reports
- **Transfer Reports**: Daily transfer history and summaries
- **Custom Date Ranges**: Flexible reporting periods
- **PDF Export**: Professional report generation
- **Email Automation**: Scheduled daily reports with attachments

#### 6. 🔄 Smart Daily Transfer System
- **Visual Transfer Interface**: Intuitive drag-and-drop style transfers
- **Bulk Operations**: Transfer multiple items simultaneously
- **Quantity Validation**: Prevents over-transfer with real-time checking
- **Transfer History**: Complete audit trail of all transfers
- **Automated Scheduling**: Set up recurring transfer patterns
- **Stock Optimization**: Suggestions for optimal transfer quantities

#### 7. 💳 Financial Management
- **Daily Counter Balance**: Opening and closing balance tracking
- **Expense Management**: Categorized business expense tracking
- **Spending Analytics**: Expense analysis by category and date
- **Profit/Loss Calculation**: Automated financial calculations
- **Cash Flow Tracking**: Daily cash movement monitoring
- **Financial Reports**: Comprehensive financial summaries

#### 8. 📋 Pending Bills Management
- **Save Bills for Later**: Hold orders for future completion
- **Bill Modification**: Edit saved bills before completion
- **Customer Association**: Link bills to customer information
- **Bulk Operations**: Mass operations on pending bills
- **Bill Templates**: Save common orders as templates
- **Expiration Tracking**: Monitor old pending bills

## 🖨️ Hardware Integration

### Thermal Printer Support
- **ESC/POS Protocol**: Full compatibility with standard thermal printers
- **Multiple Connection Types**: USB, Network (IP), and Serial port connections
- **Popular Models**: Epson TM-T82II, TM-T88V, TM-T20, and other ESC/POS printers
- **Dynamic Bill Sizing**: Automatic height adjustment based on bill content
- **Professional Formatting**: Clean, readable receipts on 80mm thermal paper
- **Printer Management**: Status monitoring, configuration, and reconnection
- **Fallback Support**: Graceful degradation when printer unavailable

### Configuration Options
- **USB Printers**: Auto-detection of connected USB thermal printers
- **Network Printers**: IP-based printers (default: 192.168.1.100:9100)
- **Serial Printers**: Serial port printers (default: /dev/ttyUSB0 at 9600 baud)
- **Paper Settings**: 80mm width, 32 characters per line
- **Print Features**: Auto-cut, optional beep, status indicators

## 📧 Automated Email System

### Daily Business Reports
- **Scheduled Reports**: Automatic daily emails at 11:59 PM
- **Professional Templates**: HTML email templates with business branding
- **PDF Attachments**: Multiple report types as PDF attachments
- **Comprehensive Data**: Sales, inventory, financial, and operational metrics
- **Secure Configuration**: Encrypted password storage for email accounts

### Email Features
- **SMTP Support**: Compatible with Gmail, Outlook, and other providers
- **Multiple Recipients**: Send reports to multiple stakeholders
- **Attachment Management**: Automatic PDF generation and cleanup
- **Connection Testing**: Verify email settings before deployment
- **Error Handling**: Robust error handling with retry mechanisms

## 📄 Professional Bill Format

The system generates professional bills with dynamic formatting:

```
================================
          AJIT WINES
      [Address & Contact]
      GST: [GST Number]
================================
Date: DD/MM/YYYY    Time: HH:MM
Bill No: INV-2024-0001
Table: T1 / Parcel: P001

Customer: [Name]
Phone: [Number]
================================
Item             Qty  Rate Amount
--------------------------------
Kingfisher 330ml  2   120   240
Chicken Tikka     1   180   180
Naan             2    45    90
--------------------------------
Subtotal:                  510
Tax (5%):                   26
Discount:                  -10
--------------------------------
TOTAL:               ₹ 526
================================
Payment: Cash
Thank you for visiting!
================================
```

## Technology Stack

- **Frontend**: React 18 with Lucide React icons
- **Backend**: Electron with Node.js
- **Database**: SQLite3 for local data storage
- **PDF Generation**: jsPDF for bill exports
- **Styling**: Custom CSS with responsive design
- **Build System**: React Scripts with Electron Builder

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd inventory-pos-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```
   This will start both the React development server and Electron app.

4. **For production build**
   ```bash
   npm run build
   npm run dist
   ```

### Sample Data

The application automatically initializes with sample data on first run, including:
- Various beer variants (Kingfisher 330ml, 650ml)
- Food items (Chicken Tikka, Paneer Butter Masala, Naan)
- Beverages (Whiskey variants)
- Rice dishes

The sample data includes realistic pricing and stock levels to help you test all features immediately.

## Usage Guide

### Getting Started

1. **Dashboard**: Overview of key metrics and quick access to all modules
2. **Products**: Add and manage your product catalog
3. **Inventory**: View and manage stock levels
4. **Daily Transfer**: Transfer stock from godown to counter
5. **POS**: Process sales and generate bills
6. **Reports**: View sales and inventory reports

### Daily Workflow

1. **Morning Setup**:
   - Check inventory levels
   - Transfer required stock from godown to counter
   - Review low stock alerts

2. **During Operations**:
   - Use POS system for all sales
   - Select Table or Parcel as appropriate
   - Generate bills and receipts

3. **End of Day**:
   - Review daily sales report
   - Check remaining stock levels
   - Plan next day's transfers

### Key Features in Detail

#### Product Management
- Add products with variants (e.g., different bottle sizes)
- Set cost and selling prices
- Organize by categories
- Track in different units (bottles, plates, glasses, etc.)

#### Stock Management
- **Godown Stock**: Bulk storage from suppliers
- **Counter Stock**: Ready-to-sell inventory
- **Transfer System**: Move stock as needed
- **Automatic Deduction**: Stock reduces on each sale

#### Sales Processing
- **Quick Search**: Find products by name, SKU, or barcode
- **Cart Management**: Add multiple items, adjust quantities
- **Customer Details**: Optional customer information
- **Multiple Payment Types**: Support various payment methods
- **Bill Generation**: Professional PDF bills

#### Reporting
- **Real-time Data**: Always up-to-date information
- **Date Range Filtering**: View reports for specific periods
- **Export Options**: Save reports as needed
- **Stock Alerts**: Visual warnings for low inventory

## Database Schema

The application uses SQLite with the following main tables:
- **products**: Product catalog with variants
- **inventory**: Stock levels tracking
- **sales**: Sales transactions
- **sale_items**: Individual items in each sale
- **stock_movements**: Complete audit trail

## File Structure

```
src/
├── components/           # React components
│   ├── Dashboard.js     # Main dashboard
│   ├── ProductManagement.js
│   ├── InventoryManagement.js
│   ├── DailyTransfer.js
│   ├── POSSystem.js
│   ├── SalesReports.js
│   └── ...
├── database.js          # SQLite database operations
├── main.js             # Electron main process
├── preload.js          # Electron preload script
├── pdf-service.js      # PDF generation
├── printer-service.js  # Printing functionality
├── init-sample-data.js # Sample data initialization
└── App.css            # Styling
```

## Future Enhancements

- **Dealer/Supplier Management**: Track suppliers and purchase orders
- **Mobile Interface**: Remote access for reports and monitoring
- **Multi-device Sync**: Real-time synchronization across devices
- **Email/SMS Receipts**: Digital receipt delivery
- **Advanced Analytics**: Detailed business intelligence
- **Barcode Scanning**: Hardware barcode scanner integration
- **KOT Printing**: Kitchen Order Ticket printing
- **User Management**: Multiple user roles and permissions

## Support

For technical support or feature requests, please contact the development team.

**Contact Information:**
- Email: ajitreddy013@gmail.com
- Phone: +91 7517323121

## License

This software is proprietary and developed specifically for Ajit Wines.

---

**Built with ❤️ for Ajit Wines**
