# Ajit Wines - Inventory POS Application

A comprehensive Point of Sale (POS) and Inventory Management system built for Ajit Wines using Electron, React, and SQLite.

## Features

### 🏪 Manager Role Features
- Add new products with variants (e.g., 180ml, 500ml bottles)
- Manage separate stock levels for godown and counter
- Daily transfer from godown to counter stock
- Generate and print bills with proper formatting
- View comprehensive sales and stock reports
- Support for both Table and Parcel orders

### 📦 Core Modules

#### 1. Inventory Management
- **Product Management**: Add products with name, variant, SKU, price, cost, category, and unit
- **Dual Stock Tracking**: 
  - **Godown Stock**: Master stock from suppliers
  - **Counter Stock**: Daily operational stock for sales
- **Stock Transfer**: Easy transfer from godown to counter
- **Automatic Updates**: Stock levels automatically update on sales and transfers
- **Low Stock Alerts**: Visual warnings for items running low

#### 2. Point of Sale (POS)
- **Sale Types**: Support for Table and Parcel orders
- **Table Management**: Optional table number for dine-in orders
- **Product Selection**: Quick search and selection from counter stock
- **Cart Management**: Add, remove, and modify quantities
- **Billing**: Calculate totals with tax and discount options
- **Payment Methods**: Cash, Card, UPI, Cheque
- **Bill Generation**: Export as PDF or print directly

#### 3. Sales Tracking
- **Complete Sales History**: Track all sales with detailed information
- **Sale Details**: Table/Parcel info, items, quantities, prices, date/time
- **Customer Information**: Optional customer name and phone
- **Payment Tracking**: Record payment method used

#### 4. Reports Module
- **Daily Sales Report**: Complete list of sales with totals
- **Stock Summary**: Current stock levels in godown and counter
- **Low Stock Report**: Items requiring restocking
- **Sales by Type**: Separate tracking for table vs parcel orders

#### 5. Daily Transfer System
- **Visual Interface**: Easy-to-use transfer interface
- **Bulk Transfer**: Select multiple items for transfer
- **Quantity Control**: Specify exact quantities to transfer
- **Stock Validation**: Prevents over-transfer from godown
- **Real-time Updates**: Immediate stock level updates

## Bill Format

The system generates professional bills with the following format:

```
Ajit Wines
Date/Time
Table/Parcel No.
-------------------------------
Item Name     Qty     Rate     Amount
-------------------------------
Total Amount: ₹XXX
Thank you!
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
