# Firebase Admin SDK Setup Guide

## Overview

The Firebase Admin SDK provides privileged access to Firebase services from the desktop application. It's used for:

- **Custom Token Generation**: Create authentication tokens for waiter login
- **Admin Database Access**: Perform database operations with elevated privileges
- **Bypassing Security Rules**: Execute trusted operations without client-side restrictions
- **Server-Side Operations**: Handle sensitive operations that shouldn't be exposed to clients

## Prerequisites

1. Firebase project created and configured (Phase 1 complete)
2. Node.js environment (Electron main process)
3. Firebase Admin SDK installed (`firebase-admin` package)

## Setup Instructions

### Step 1: Download Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (WaiterFlow)
3. Click the gear icon ⚙️ next to "Project Overview"
4. Select "Project settings"
5. Navigate to the "Service accounts" tab
6. Click "Generate new private key"
7. Confirm by clicking "Generate key"
8. A JSON file will be downloaded

### Step 2: Install Service Account Key

1. Rename the downloaded file to `firebase-service-account.json`
2. Move it to the **project root directory** (same level as package.json)
3. Verify the file structure:

```
waiterflow-project/
├── firebase-service-account.json  ← Service account key here
├── package.json
├── src/
│   └── firebase/
│       ├── init.js
│       └── config.js
└── ...
```

### Step 3: Verify Service Account Key Format

The JSON file should contain these fields:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

### Step 4: Secure the Service Account Key

**CRITICAL SECURITY STEP:**

The service account key provides full admin access to your Firebase project. **Never commit it to version control!**

1. Verify `.gitignore` includes:
```
firebase-service-account.json
```

2. Check git status to ensure it's not tracked:
```bash
git status
```

3. If accidentally committed, remove from git history:
```bash
git rm --cached firebase-service-account.json
git commit -m "Remove service account key from version control"
```

### Step 5: Test Admin SDK Initialization

Run the test script to verify setup:

```bash
node src/firebase/testAdminInit.js
```

Expected output:
```
Initializing Firebase Admin SDK...
Firebase Admin SDK initialized successfully
Project ID: your-project-id
Service Account: firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
✓ Admin SDK initialized successfully
✓ Firestore accessible
✓ Auth accessible
```

## Usage in Desktop App

### Initialize in Electron Main Process

```javascript
// In public/electron.js or src/main.js
const { initializeAdminSDK, getAdminFirestore, getAdminAuth } = require('./src/firebase/init');

// Initialize when app starts
app.whenReady().then(async () => {
  try {
    // Initialize Firebase Admin SDK
    await initializeAdminSDK();
    console.log('Firebase Admin SDK ready');
    
    // Create window and continue app initialization
    createWindow();
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    app.quit();
  }
});
```

### Create Custom Tokens for Waiter Authentication

```javascript
const { createCustomToken } = require('./src/firebase/init');

// IPC handler for waiter login
ipcMain.handle('authenticate-waiter', async (event, pin) => {
  try {
    // Validate PIN against Firestore
    const waiter = await validateWaiterPin(pin);
    
    if (!waiter) {
      return { success: false, error: 'Invalid PIN' };
    }
    
    // Create custom token for mobile app
    const customToken = await createCustomToken(waiter.id, {
      name: waiter.name,
      role: 'waiter'
    });
    
    return {
      success: true,
      token: customToken,
      waiter: {
        id: waiter.id,
        name: waiter.name
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

### Admin Database Operations

```javascript
const { getDocument, setDocument, queryCollection } = require('./src/firebase/init');

// Get waiter by ID
const waiter = await getDocument('waiters', 'waiter123');

// Create new menu item
await setDocument('menuItems', 'item456', {
  name: 'Chicken Biryani',
  price: 250,
  category: 'food',
  isOutOfStock: false,
  createdAt: new Date()
});

// Query all active waiters
const activeWaiters = await queryCollection('waiters', [
  { field: 'isActive', operator: '==', value: true }
]);
```

### Transaction Example (Inventory Deduction)

```javascript
const { runTransaction, getAdminFirestore } = require('./src/firebase/init');

async function deductInventory(itemId, quantity) {
  const firestore = getAdminFirestore();
  
  return await runTransaction(async (transaction) => {
    const itemRef = firestore.collection('inventory').doc(itemId);
    const itemDoc = await transaction.get(itemRef);
    
    if (!itemDoc.exists) {
      throw new Error('Item not found');
    }
    
    const currentQuantity = itemDoc.data().quantity;
    
    if (currentQuantity < quantity) {
      throw new Error('Insufficient inventory');
    }
    
    transaction.update(itemRef, {
      quantity: currentQuantity - quantity,
      updatedAt: new Date()
    });
    
    return { success: true, newQuantity: currentQuantity - quantity };
  });
}
```

## Security Best Practices

### 1. Service Account Key Protection

- ✅ Store in project root (not in src/ or public/)
- ✅ Add to .gitignore
- ✅ Never commit to version control
- ✅ Never share publicly or in screenshots
- ✅ Rotate keys periodically (every 90 days)

### 2. Access Control

- Only use Admin SDK in main process (Node.js environment)
- Never expose Admin SDK to renderer process
- Use IPC handlers to mediate access from UI
- Validate all inputs before Admin SDK operations

### 3. Audit Logging

Log all Admin SDK operations for security auditing:

```javascript
async function logAdminOperation(operation, userId, details) {
  await setDocument('adminLogs', `log_${Date.now()}`, {
    operation,
    userId,
    details,
    timestamp: new Date()
  });
}
```

### 4. Error Handling

Never expose internal errors to clients:

```javascript
ipcMain.handle('admin-operation', async (event, data) => {
  try {
    // Admin operation
    return { success: true, data: result };
  } catch (error) {
    console.error('Admin operation failed:', error);
    // Return generic error to client
    return { success: false, error: 'Operation failed' };
  }
});
```

## Troubleshooting

### Error: "Service account key not found"

**Solution:** Ensure `firebase-service-account.json` is in the project root directory.

```bash
# Check if file exists
ls -la firebase-service-account.json

# If missing, download from Firebase Console
```

### Error: "Invalid service account key file"

**Solution:** Verify the JSON file contains all required fields (project_id, private_key, client_email).

```bash
# Check file contents
cat firebase-service-account.json | jq .project_id
```

### Error: "Permission denied"

**Solution:** Verify the service account has the correct IAM roles:

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Manage service account permissions"
3. Ensure the service account has "Firebase Admin SDK Administrator Service Agent" role

### Error: "EACCES: permission denied"

**Solution:** Check file permissions:

```bash
# Fix permissions
chmod 600 firebase-service-account.json
```

## Environment-Specific Setup

### Development

Use a separate Firebase project for development:

1. Create `firebase-service-account-dev.json`
2. Update init.js to load based on NODE_ENV:

```javascript
const serviceAccountPath = process.env.NODE_ENV === 'production'
  ? path.join(__dirname, '../../firebase-service-account.json')
  : path.join(__dirname, '../../firebase-service-account-dev.json');
```

### Production

For production deployment:

1. Store service account key securely (not in app bundle)
2. Load from secure location at runtime
3. Consider using environment variables for sensitive data
4. Implement key rotation strategy

## Additional Resources

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [Service Account Best Practices](https://cloud.google.com/iam/docs/best-practices-service-accounts)
- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Electron Security Guidelines](https://www.electronjs.org/docs/latest/tutorial/security)

## Support

For issues or questions:
1. Check Firebase Console for service account status
2. Review Electron main process logs
3. Verify network connectivity to Firebase
4. Consult Firebase Admin SDK documentation
