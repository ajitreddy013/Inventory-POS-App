# Developer Guide - Inventory POS Application

## Getting Started

### Prerequisites
- Node.js 14 or higher
- npm or yarn package manager
- Basic knowledge of JavaScript, React, and Electron
- SQLite3 understanding (optional but helpful)

### Development Environment Setup

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd inventory-pos-app
   npm install
   ```

2. **Development Mode**
   ```bash
   npm run dev        # Runs both React and Electron
   npm run start      # Electron only
   npm start-react    # React only
   ```

3. **Production Build**
   ```bash
   npm run build      # Build React app
   npm run dist       # Create installer
   ```

## Code Structure and Organization

### File Organization
```
src/
├── main.js              # Electron main process
├── preload.js           # Secure IPC bridge
├── database.js          # SQLite database service
├── App.js               # Main React component
├── components/          # React components
│   ├── Dashboard.js     # Business overview
│   ├── POSSystem.js     # Point of sale
│   ├── ProductManagement.js
│   ├── InventoryManagement.js
│   └── ...
├── services/            # Business logic services
│   ├── reportService.js
│   ├── dailyReportService.js
│   └── ...
├── utils/               # Utility functions
│   └── dateUtils.js
├── email-service.js     # Email automation
├── pdf-service.js       # PDF generation
└── printer-service.js   # Thermal printer integration
```

### Key Design Patterns

1. **Service Pattern**: Business logic separated into service classes
2. **Component Pattern**: React functional components with hooks
3. **IPC Pattern**: Secure communication between processes
4. **Database Pattern**: Repository pattern for data access

## Making Changes to the Application

### 1. Adding New Database Tables

**Step 1: Update Database Schema**
```javascript
// In src/database.js, add to createTables() method
const queries = [
  // ... existing tables ...
  
  // New table
  `CREATE TABLE IF NOT EXISTS your_new_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`
];
```

**Step 2: Add CRUD Operations**
```javascript
// In src/database.js, add methods for your table
async addYourRecord(data) {
  return new Promise((resolve, reject) => {
    const query = `INSERT INTO your_new_table (name, description) VALUES (?, ?)`;
    this.db.run(query, [data.name, data.description], function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, ...data });
    });
  });
}

async getYourRecords() {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM your_new_table ORDER BY created_at DESC`;
    this.db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
```

**Step 3: Add IPC Handlers**
```javascript
// In src/main.js, add IPC handlers
ipcMain.handle("add-your-record", async (event, data) => {
  try {
    return await database.addYourRecord(data);
  } catch (error) {
    console.error('Error adding record:', error);
    throw error;
  }
});

ipcMain.handle("get-your-records", async () => {
  try {
    return await database.getYourRecords();
  } catch (error) {
    console.error('Error getting records:', error);
    throw error;
  }
});
```

**Step 4: Add Preload APIs**
```javascript
// In src/preload.js, add to electronAPI object
contextBridge.exposeInMainWorld("electronAPI", {
  // ... existing APIs ...
  
  // Your new APIs
  addYourRecord: (data) => ipcRenderer.invoke("add-your-record", data),
  getYourRecords: () => ipcRenderer.invoke("get-your-records"),
});
```

### 2. Creating New React Components

**Step 1: Create Component File**
```javascript
// src/components/YourNewComponent.js
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';

/**
 * YOUR NEW COMPONENT
 * 
 * Description of what this component does
 * Features:
 * - Feature 1
 * - Feature 2
 * - Feature 3
 */
function YourNewComponent() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      const data = await window.electronAPI.getYourRecords();
      setRecords(data);
    } catch (error) {
      console.error('Error loading records:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecord = async (recordData) => {
    try {
      await window.electronAPI.addYourRecord(recordData);
      await loadRecords(); // Refresh the list
    } catch (error) {
      console.error('Error adding record:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="your-component">
      <div className="header">
        <h2>Your New Feature</h2>
        <button onClick={() => handleAddRecord({})} className="btn-primary">
          <Plus size={20} />
          Add New
        </button>
      </div>
      
      <div className="content">
        {records.map(record => (
          <div key={record.id} className="record-item">
            <span>{record.name}</span>
            <div className="actions">
              <button className="btn-secondary">
                <Edit size={16} />
              </button>
              <button className="btn-danger">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default YourNewComponent;
```

**Step 2: Add to Navigation**
```javascript
// In src/App.js, add to imports
import YourNewComponent from './components/YourNewComponent';

// Add to menuItems array
const menuItems = [
  // ... existing items ...
  { path: "/your-feature", name: "Your Feature", icon: YourIcon },
];

// Add to Routes
<Routes>
  {/* ... existing routes ... */}
  <Route path="/your-feature" element={<YourNewComponent />} />
</Routes>
```

### 3. Adding New Services

**Step 1: Create Service File**
```javascript
// src/services/yourService.js
/**
 * YOUR SERVICE
 * 
 * Description of what this service does
 * 
 * @author Your Name
 * @version 1.0.0
 */
class YourService {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the service
   */
  async initialize() {
    // Initialize your service
    this.initialized = true;
  }

  /**
   * Your service method
   * @param {Object} data - Input data
   * @returns {Object} Result
   */
  async yourMethod(data) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Your service logic here
      return { success: true, data: processedData };
    } catch (error) {
      console.error('Error in yourMethod:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = YourService;
```

**Step 2: Integrate Service**
```javascript
// In src/main.js, add to imports
const YourService = require('./services/yourService');

// Initialize in app.whenReady()
let yourService;
app.whenReady().then(async () => {
  // ... existing initialization ...
  yourService = new YourService();
  await yourService.initialize();
});

// Add IPC handlers
ipcMain.handle("your-service-method", async (event, data) => {
  try {
    return await yourService.yourMethod(data);
  } catch (error) {
    console.error('Error in your-service-method:', error);
    throw error;
  }
});
```

### 4. Modifying Reports

**Step 1: Update Report Service**
```javascript
// In src/services/reportService.js or create new service
async generateYourReport(data, outputPath) {
  try {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text('Your Custom Report', 20, 20);
    
    // Add content
    doc.setFontSize(12);
    doc.text('Report content here...', 20, 40);
    
    // Add table if needed
    doc.autoTable({
      head: [['Column 1', 'Column 2', 'Column 3']],
      body: data.map(item => [item.col1, item.col2, item.col3]),
      startY: 50
    });
    
    // Save the PDF
    doc.save(outputPath);
    
    return { success: true, filePath: outputPath };
  } catch (error) {
    console.error('Error generating report:', error);
    return { success: false, error: error.message };
  }
}
```

**Step 2: Add to Email Service**
```javascript
// In src/email-service.js, update sendDailyReport method
async sendDailyReport(reportData, attachmentPaths = []) {
  // ... existing code ...
  
  // Add your report to attachments
  const yourReportPath = await this.generateYourReport(reportData);
  if (yourReportPath.success) {
    attachmentPaths.push({
      path: yourReportPath.filePath,
      filename: 'your-report.pdf'
    });
  }
  
  // ... rest of email sending code ...
}
```

### 5. Adding New Settings

**Step 1: Update Settings Component**
```javascript
// In src/components/Settings.js
const [yourSettings, setYourSettings] = useState({
  option1: '',
  option2: false,
  option3: 0
});

// Add to the settings form
<div className="settings-section">
  <h3>Your Settings</h3>
  <div className="setting-item">
    <label>Option 1:</label>
    <input 
      type="text" 
      value={yourSettings.option1}
      onChange={(e) => setYourSettings({...yourSettings, option1: e.target.value})}
    />
  </div>
  <div className="setting-item">
    <label>Option 2:</label>
    <input 
      type="checkbox" 
      checked={yourSettings.option2}
      onChange={(e) => setYourSettings({...yourSettings, option2: e.target.checked})}
    />
  </div>
</div>
```

**Step 2: Add Database Storage**
```javascript
// In src/database.js, add to bar_settings table or create new table
async saveYourSettings(settings) {
  return new Promise((resolve, reject) => {
    const query = `INSERT OR REPLACE INTO your_settings (id, option1, option2, option3) VALUES (1, ?, ?, ?)`;
    this.db.run(query, [settings.option1, settings.option2, settings.option3], function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, ...settings });
    });
  });
}
```

## Testing Guidelines

### 1. Testing Database Operations
```javascript
// Create test file: test-your-feature.js
const Database = require('./src/database');

async function testYourFeature() {
  const db = new Database();
  await db.initialize();
  
  try {
    // Test adding record
    const result = await db.addYourRecord({
      name: 'Test Record',
      description: 'Test Description'
    });
    console.log('Add result:', result);
    
    // Test getting records
    const records = await db.getYourRecords();
    console.log('Records:', records);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testYourFeature();
```

### 2. Testing Services
```javascript
// Test your service
const YourService = require('./src/services/yourService');

async function testYourService() {
  const service = new YourService();
  await service.initialize();
  
  const result = await service.yourMethod({ test: 'data' });
  console.log('Service result:', result);
}

testYourService();
```

## Best Practices

### 1. Code Organization
- Keep components focused on single responsibilities
- Use descriptive names for functions and variables
- Add comprehensive comments to complex logic
- Separate business logic from UI components

### 2. Error Handling
```javascript
// Always wrap async operations in try-catch
try {
  const result = await window.electronAPI.yourMethod(data);
  // Handle success
} catch (error) {
  console.error('Error:', error);
  // Show user-friendly error message
  alert('An error occurred. Please try again.');
}
```

### 3. Database Operations
```javascript
// Always use parameterized queries
const query = `SELECT * FROM products WHERE category = ?`;
this.db.all(query, [category], callback);

// Use transactions for multiple operations
this.db.serialize(() => {
  this.db.run("BEGIN TRANSACTION");
  this.db.run("INSERT INTO ...", callback1);
  this.db.run("UPDATE ...", callback2);
  this.db.run("COMMIT");
});
```

### 4. React Components
```javascript
// Use functional components with hooks
function YourComponent() {
  const [state, setState] = useState(initialValue);
  
  useEffect(() => {
    // Cleanup function
    return () => {
      // Cleanup code
    };
  }, [dependency]);
  
  return (
    <div>
      {/* Your JSX */}
    </div>
  );
}
```

## Common Pitfalls and Solutions

### 1. Database Connection Issues
**Problem**: Database locked errors
**Solution**: Always close database connections properly

### 2. IPC Communication Issues
**Problem**: Renderer can't access main process functions
**Solution**: Ensure functions are exposed in preload.js

### 3. React State Issues
**Problem**: State not updating properly
**Solution**: Always create new objects/arrays when updating state

### 4. PDF Generation Issues
**Problem**: PDF not generating or corrupted
**Solution**: Ensure jsPDF is properly initialized and data is formatted correctly

## Debugging Tips

### 1. Enable Developer Tools
```javascript
// In main.js, ensure dev tools are enabled
if (isDev) {
  mainWindow.webContents.openDevTools();
}
```

### 2. Add Console Logging
```javascript
// Add strategic console.log statements
console.log('Function called with:', data);
console.log('Result:', result);
```

### 3. Check IPC Communication
```javascript
// In preload.js, add logging
contextBridge.exposeInMainWorld("electronAPI", {
  yourMethod: (data) => {
    console.log('IPC call:', 'yourMethod', data);
    return ipcRenderer.invoke("your-method", data);
  }
});
```

## Performance Optimization

### 1. Database Optimization
- Use indexes on frequently queried columns
- Limit result sets with pagination
- Use prepared statements for repeated queries

### 2. React Optimization
- Use React.memo for components that don't need frequent re-renders
- Implement proper key props for lists
- Use useCallback and useMemo for expensive operations

### 3. File Operations
- Use streaming for large files
- Clean up temporary files
- Implement proper error handling

## Deployment and Distribution

### 1. Building for Production
```bash
# Build React app
npm run build

# Create installer
npm run dist
```

### 2. Testing Production Build
```bash
# Start production version
npm start
```

### 3. Creating Installers
The application uses electron-builder for creating installers:
- Windows: Creates NSIS installer
- macOS: Creates DMG file
- Linux: Creates AppImage

## Security Considerations

### 1. Input Validation
Always validate user inputs before processing:
```javascript
function validateInput(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid input data');
  }
  // Add specific validation rules
}
```

### 2. SQL Injection Prevention
Always use parameterized queries:
```javascript
// Good
const query = `SELECT * FROM products WHERE id = ?`;
db.get(query, [productId], callback);

// Bad
const query = `SELECT * FROM products WHERE id = ${productId}`;
```

### 3. File System Security
Validate file paths and permissions:
```javascript
const path = require('path');
const safePath = path.resolve(basePath, userInput);
if (!safePath.startsWith(basePath)) {
  throw new Error('Invalid file path');
}
```

## Conclusion

This guide provides a comprehensive overview of how to modify and extend the Inventory POS application. Remember to:

1. Always test your changes thoroughly
2. Follow the existing code patterns and conventions
3. Add proper error handling and logging
4. Update documentation when adding new features
5. Consider security implications of your changes

For additional help, refer to the inline code comments and the main CODE_DOCUMENTATION.md file.
