# Code Documentation - Inventory POS Application

## Overview
This is a comprehensive Point of Sale (POS) and Inventory Management system built with Electron, React, and SQLite. The application is designed for restaurants/bars with both table service and takeaway orders.

## Architecture

### Technology Stack
- **Frontend**: React 18 with functional components and hooks
- **Backend**: Electron main process with Node.js
- **Database**: SQLite3 for local data storage
- **Routing**: React Router (Hash-based for Electron compatibility)
- **UI Icons**: Lucide React
- **PDF Generation**: jsPDF with autoTable
- **Printing**: ESC/POS thermal printer support
- **Email**: Nodemailer for automated reports
- **Scheduling**: node-cron for automated tasks

### Application Structure
```
inventory-pos-app/
├── src/
│   ├── components/          # React components
│   ├── services/           # Business logic services
│   ├── utils/              # Utility functions
│   ├── main.js             # Electron main process
│   ├── preload.js          # Secure IPC bridge
│   ├── database.js         # SQLite database service
│   └── App.js              # Main React component
├── public/                 # Static assets
├── build/                  # Production build
├── reports/                # Generated reports
├── temp/                   # Temporary files
└── documentation/          # Documentation files
```

## Core Components

### 1. Main Process (main.js)
**Purpose**: Electron main process that manages the application lifecycle, database, and background services.

**Key Responsibilities**:
- Application window creation and management
- Database initialization and operations
- Service initialization (printer, PDF, email, etc.)
- IPC handlers for frontend-backend communication
- Scheduled tasks (daily email reports)
- File system operations

**Important Functions**:
- `createWindow()`: Creates the main application window
- `sendDailyEmailReport()`: Automated daily business reports
- `getTopSellingItems()`: Analytics for sales data
- Various IPC handlers for database operations

### 2. Database Service (database.js)
**Purpose**: SQLite database management with complete CRUD operations.

**Key Features**:
- **Products Table**: Product catalog with variants
- **Inventory Table**: Dual stock tracking (godown/counter)
- **Sales Table**: Transaction records
- **Sale Items Table**: Individual items in each sale
- **Stock Movements Table**: Complete audit trail
- **Tables Table**: Restaurant table management
- **Spendings Table**: Business expense tracking
- **Counter Balance Table**: Daily cash management

**Database Schema**:
```sql
-- Core business tables
products (id, name, variant, sku, price, cost, category, ...)
inventory (id, product_id, godown_stock, counter_stock, ...)
sales (id, sale_number, total_amount, sale_date, ...)
sale_items (id, sale_id, product_id, quantity, unit_price, ...)
stock_movements (id, product_id, movement_type, quantity, ...)

-- Restaurant management
tables (id, name, capacity, area, status, ...)
table_orders (id, table_id, items, total, ...)

-- Financial management
spendings (id, description, amount, category, ...)
counter_balance (id, balance_date, opening_balance, ...)
pending_bills (id, bill_number, items, total_amount, ...)
```

### 3. Preload Script (preload.js)
**Purpose**: Secure bridge between Electron main process and React renderer.

**Security Features**:
- Uses `contextBridge` for secure API exposure
- No direct Node.js access from renderer
- Validated IPC communication
- Controlled data flow

**API Categories**:
- Product Operations
- Inventory Operations
- Sales Operations
- Printing & PDF Operations
- Table Management
- Email Operations
- Financial Operations
- System Operations

### 4. React Components

#### Main Application (App.js)
**Purpose**: Root React component with routing and navigation.

**Features**:
- Hash-based routing for Electron compatibility
- Collapsible sidebar navigation
- State management for table selection
- Clean UI with icon-based menu

#### Dashboard (components/Dashboard.js)
**Purpose**: Main business overview with key metrics.

**Features**:
- Total products and low stock alerts
- Today's sales summary
- Recent transactions
- Quick action buttons

#### Product Management (components/ProductManagement.js)
**Purpose**: Product catalog management with CRUD operations.

**Features**:
- Add/edit/delete products
- Variant support (different sizes, types)
- Cost and pricing management
- Category organization

#### Inventory Management (components/InventoryManagement.js)
**Purpose**: Stock level monitoring and management.

**Features**:
- Dual stock tracking (godown/counter)
- Stock level updates
- Low stock alerts
- Stock transfer operations

#### POS System (components/POSSystem.js)
**Purpose**: Point of sale transaction processing.

**Features**:
- Product selection and cart management
- Table/parcel order types
- Payment processing
- Bill generation and printing

#### Reports (components/SalesReports.js)
**Purpose**: Business reporting and analytics.

**Features**:
- Daily sales reports
- Financial summaries
- PDF export capabilities
- Email report automation

## Services

### 1. PDF Service (pdf-service.js)
**Purpose**: PDF generation for bills and reports.

**Features**:
- Dynamic bill generation
- Professional formatting
- Multiple report types
- Automatic file saving

### 2. Printer Service (printer-service.js)
**Purpose**: Thermal printer integration.

**Features**:
- ESC/POS protocol support
- USB, Network, and Serial connections
- Dynamic bill formatting
- Printer status monitoring

### 3. Email Service (email-service.js)
**Purpose**: Automated email reporting.

**Features**:
- Daily business reports
- PDF attachments
- SMTP configuration
- Template-based emails

### 4. Report Service (services/reportService.js)
**Purpose**: Business report generation.

**Features**:
- Sales analytics
- Financial summaries
- Inventory reports
- Custom date ranges

## Database Design

### Core Business Logic

#### Product Management
```javascript
// Product with variants
{
  id: 1,
  name: "Kingfisher Beer",
  variant: "330ml",
  sku: "KB-330",
  price: 120.00,
  cost: 80.00,
  category: "Beer"
}
```

#### Inventory Tracking
```javascript
// Dual stock system
{
  product_id: 1,
  godown_stock: 100,      // Main storage
  counter_stock: 20,      // Ready for sale
  min_stock_level: 5
}
```

#### Sales Processing
```javascript
// Complete sale record
{
  sale_number: "S-2024-001",
  sale_type: "table",
  table_number: "T1",
  total_amount: 240.00,
  items: [
    {
      product_id: 1,
      quantity: 2,
      price: 120.00
    }
  ]
}
```

### Stock Movement Audit
Every stock change is recorded:
```javascript
{
  product_id: 1,
  movement_type: "transfer",
  quantity: 10,
  from_location: "godown",
  to_location: "counter",
  reference_id: null,
  notes: "Daily transfer"
}
```

## Key Features

### 1. Dual Stock System
- **Godown Stock**: Main inventory from suppliers
- **Counter Stock**: Ready-to-sell items
- **Daily Transfer**: Move stock from godown to counter

### 2. Table Management
- Restaurant table tracking
- Order-to-table assignment
- Table status management (available, occupied, reserved)

### 3. Bill Generation
- Professional bill formatting
- Multiple payment methods
- Thermal printer support
- PDF export capability

### 4. Automated Reporting
- Daily email reports at 11:59 PM
- PDF attachments with detailed analytics
- Business metrics and insights

### 5. Financial Management
- Daily spending tracking
- Counter balance management
- Opening/closing balance calculations
- Profit/loss analysis

## Configuration Files

### 1. email-settings.json
Email configuration for automated reports:
```json
{
  "host": "smtp.gmail.com",
  "port": 587,
  "secure": false,
  "auth": {
    "user": "your-email@gmail.com",
    "pass": "your-app-password"
  },
  "from": "your-email@gmail.com",
  "to": "recipient@gmail.com",
  "enabled": true
}
```

### 2. printer-config.json
Thermal printer configuration:
```json
{
  "type": "usb",
  "networkHost": "192.168.1.100",
  "networkPort": 9100,
  "serialPath": "/dev/ttyUSB0",
  "serialBaudRate": 9600
}
```

## Development Guidelines

### 1. Code Structure
- Follow React functional component patterns
- Use hooks for state management
- Maintain separation of concerns
- Add comprehensive error handling

### 2. Database Operations
- Always use transactions for data integrity
- Include proper error handling
- Log all database operations
- Maintain audit trails

### 3. Security Practices
- Never expose Node.js APIs directly to renderer
- Use contextBridge for secure IPC
- Validate all inputs
- Sanitize user data

### 4. Testing
- Test all database operations
- Verify printer connectivity
- Test email functionality
- Validate PDF generation

## Common Tasks

### Adding New Features
1. Add database schema changes in `database.js`
2. Create IPC handlers in `main.js`
3. Add API methods in `preload.js`
4. Create React components
5. Update navigation in `App.js`

### Modifying Reports
1. Update report service in `services/reportService.js`
2. Modify PDF generation in `pdf-service.js`
3. Update email templates in `email-service.js`
4. Add new IPC handlers if needed

### Database Schema Changes
1. Add new table creation in `createTables()` method
2. Add corresponding CRUD operations
3. Update IPC handlers
4. Add API methods to preload script

## Troubleshooting

### Common Issues
1. **Database locked**: Check for unclosed database connections
2. **Printer not found**: Verify printer configuration and drivers
3. **Email not sending**: Check SMTP settings and network connectivity
4. **PDF generation fails**: Verify file permissions and disk space

### Debug Mode
- Enable developer tools in development mode
- Check console for error messages
- Monitor IPC communication
- Review database logs

## Future Enhancements

### Potential Improvements
1. **Multi-user Support**: Add user authentication and roles
2. **Cloud Sync**: Implement cloud database synchronization
3. **Mobile App**: Create mobile interface for remote monitoring
4. **Advanced Analytics**: Add more detailed business intelligence
5. **Supplier Management**: Add supplier and purchase order tracking
6. **Loyalty Program**: Implement customer loyalty features

### Code Quality
1. Add comprehensive unit tests
2. Implement code linting and formatting
3. Add API documentation
4. Create automated build processes
5. Add performance monitoring

## Conclusion

This application provides a complete POS and inventory management solution with:
- Secure architecture with Electron and React
- Comprehensive database design
- Professional reporting capabilities
- Hardware integration (thermal printers)
- Automated business processes

The codebase is well-structured, documented, and ready for future enhancements. All major business processes are covered, from product management to financial reporting.

For any questions or modifications, refer to the inline code comments and this documentation.
