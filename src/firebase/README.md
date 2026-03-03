# Firebase Integration for WaiterFlow Desktop App

## Overview

This directory contains Firebase integration modules for the WaiterFlow desktop application (Electron). The integration includes both the regular Firebase SDK (for renderer process) and Firebase Admin SDK (for main process with elevated privileges).

## File Structure

```
src/firebase/
├── README.md                    # This file
├── config.js                    # Regular Firebase SDK initialization (renderer process)
├── init.js                      # Firebase Admin SDK initialization (main process)
├── electronIntegration.js       # IPC handlers and integration examples
├── authService.js               # Authentication service
├── setupSchema.js               # Database schema initialization
├── testAuth.js                  # Authentication tests
├── testAdminInit.js             # Admin SDK initialization tests
├── testConnection.js            # Connection tests
├── ADMIN_SDK_SETUP.md           # Admin SDK setup guide
├── AUTHENTICATION.md            # Authentication documentation
└── INDEXES.md                   # Firestore indexes documentation
```

## Architecture

### Two Firebase Instances

The desktop app uses two Firebase instances:

1. **Regular Firebase SDK** (`config.js`)
   - Used in renderer process (React UI)
   - Client-side operations
   - Subject to Firestore security rules
   - Offline persistence enabled

2. **Firebase Admin SDK** (`init.js`)
   - Used in main process (Node.js/Electron)
   - Server-side operations with elevated privileges
   - Bypasses security rules
   - Requires service account authentication

### Process Separation

```
┌─────────────────────────────────────────────────────────┐
│                    Electron App                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────┐      ┌────────────────────┐   │
│  │  Renderer Process   │      │   Main Process     │   │
│  │  (React UI)         │      │   (Node.js)        │   │
│  │                     │      │                    │   │
│  │  Firebase SDK       │◄────►│  Firebase Admin    │   │
│  │  (config.js)        │ IPC  │  SDK (init.js)     │   │
│  │                     │      │                    │   │
│  │  - UI operations    │      │  - Custom tokens   │   │
│  │  - Real-time sync   │      │  - Admin DB ops    │   │
│  │  - Security rules   │      │  - Transactions    │   │
│  └─────────────────────┘      └────────────────────┘   │
│           │                            │                 │
└───────────┼────────────────────────────┼─────────────────┘
            │                            │
            └────────────┬───────────────┘
                         │
                    ┌────▼────┐
                    │ Firebase │
                    │ Cloud    │
                    └──────────┘
```

## Quick Start

### 1. Setup Firebase Admin SDK

Follow the detailed guide in `ADMIN_SDK_SETUP.md`:

```bash
# 1. Download service account key from Firebase Console
# 2. Save as firebase-service-account.json in project root
# 3. Verify .gitignore includes the file
```

### 2. Test Admin SDK Initialization

```bash
node src/firebase/testAdminInit.js
```

Expected output:
```
✓ Admin SDK initialized successfully
✓ Firestore accessible
✓ Auth accessible
```

### 3. Integrate into Electron Main Process

In `public/electron.js`:

```javascript
const { initializeFirebaseAdmin } = require('./src/firebase/electronIntegration');

app.whenReady().then(async () => {
  try {
    // Initialize Firebase Admin SDK
    await initializeFirebaseAdmin();
    
    // Continue with app initialization
    createWindow();
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    app.quit();
  }
});
```

## Usage Examples

### Waiter Authentication (Custom Tokens)

```javascript
// In main process (IPC handler)
const { createCustomToken } = require('./src/firebase/init');

ipcMain.handle('authenticate-waiter', async (event, pin) => {
  // Validate PIN against Firestore
  const waiter = await validateWaiterPin(pin);
  
  if (!waiter) {
    return { success: false, error: 'Invalid PIN' };
  }
  
  // Create custom token for mobile app
  const token = await createCustomToken(waiter.id, {
    name: waiter.name,
    role: 'waiter'
  });
  
  return { success: true, token, waiter };
});
```

### Menu Management

```javascript
// In main process
const { setDocument, updateDocument } = require('./src/firebase/init');

// Create menu item
await setDocument('menuItems', 'item123', {
  name: 'Chicken Biryani',
  price: 250,
  category: 'food',
  isOutOfStock: false,
  createdAt: new Date()
});

// Mark out of stock
await updateDocument('menuItems', 'item123', {
  isOutOfStock: true,
  updatedAt: new Date()
});
```

### Inventory Deduction (Atomic Transaction)

```javascript
// In main process
const { runTransaction, getAdminFirestore } = require('./src/firebase/init');

async function deductInventory(itemId, quantity) {
  const firestore = getAdminFirestore();
  
  return await runTransaction(async (transaction) => {
    const itemRef = firestore.collection('inventory').doc(itemId);
    const itemDoc = await transaction.get(itemRef);
    
    if (!itemDoc.exists) {
      throw new Error('Item not found');
    }
    
    const currentQty = itemDoc.data().quantity;
    
    if (currentQty < quantity) {
      throw new Error('Insufficient inventory');
    }
    
    transaction.update(itemRef, {
      quantity: currentQty - quantity,
      updatedAt: new Date()
    });
    
    return { success: true, newQuantity: currentQty - quantity };
  });
}
```

### Real-time Listeners (Renderer Process)

```javascript
// In renderer process (React component)
import { firestore } from './firebase/config';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

useEffect(() => {
  // Listen to menu items changes
  const q = query(
    collection(firestore, 'menuItems'),
    where('isOutOfStock', '==', false)
  );
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setMenuItems(items);
  });
  
  return () => unsubscribe();
}, []);
```

## Key Features

### 1. Offline Persistence

The regular Firebase SDK (renderer process) has offline persistence enabled:

```javascript
// In config.js
enableIndexedDbPersistence(firestore)
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence enabled in first tab only');
    } else if (err.code === 'unimplemented') {
      console.warn('Browser does not support offline persistence');
    }
  });
```

### 2. Custom Token Authentication

The Admin SDK creates custom tokens for waiter authentication:

```javascript
const token = await createCustomToken(waiterId, {
  name: waiterName,
  role: 'waiter'
});
```

Mobile apps use this token to sign in:

```javascript
// In mobile app
import { signInWithCustomToken } from 'firebase/auth';
await signInWithCustomToken(auth, token);
```

### 3. Atomic Transactions

Ensure data consistency with transactions:

```javascript
await runTransaction(async (transaction) => {
  // Read
  const doc = await transaction.get(docRef);
  
  // Compute
  const newValue = doc.data().value + 1;
  
  // Write
  transaction.update(docRef, { value: newValue });
});
```

### 4. Batch Operations

Perform multiple writes atomically:

```javascript
await runBatch(async (batch) => {
  batch.set(ref1, data1);
  batch.update(ref2, data2);
  batch.delete(ref3);
});
```

## Security Considerations

### Service Account Key Protection

**CRITICAL:** The service account key provides full admin access to Firebase.

✅ **DO:**
- Store in project root (not in src/ or public/)
- Add to .gitignore
- Rotate keys every 90 days
- Use environment-specific keys (dev/prod)

❌ **DON'T:**
- Commit to version control
- Share publicly
- Expose in screenshots
- Bundle in app distribution

### IPC Security

Always validate inputs in IPC handlers:

```javascript
ipcMain.handle('admin-operation', async (event, data) => {
  // Validate input
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Invalid input' };
  }
  
  try {
    // Perform operation
    const result = await adminOperation(data);
    return { success: true, result };
  } catch (error) {
    console.error('Operation failed:', error);
    // Don't expose internal errors to client
    return { success: false, error: 'Operation failed' };
  }
});
```

### Audit Logging

Log all admin operations:

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

## Testing

### Test Admin SDK Initialization

```bash
node src/firebase/testAdminInit.js
```

### Test Authentication

```bash
node src/firebase/testAuth.js
```

### Test Connection

```bash
node src/firebase/testConnection.js
```

## Troubleshooting

### Error: "Service account key not found"

**Solution:** Download service account key from Firebase Console and save as `firebase-service-account.json` in project root.

### Error: "Permission denied"

**Solution:** 
1. Check Firestore security rules
2. Verify service account has correct IAM roles
3. Ensure Admin SDK is initialized

### Error: "Multiple tabs open"

**Solution:** This is a warning, not an error. Offline persistence is enabled in the first tab only.

### Error: "Network request failed"

**Solution:**
1. Check internet connectivity
2. Verify Firebase project is active
3. Check firewall settings

## Additional Resources

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Firebase Authentication](https://firebase.google.com/docs/auth)

## Support

For issues or questions:
1. Check Firebase Console for service account status
2. Review Electron main process logs
3. Verify network connectivity
4. Consult Firebase documentation
5. Review `ADMIN_SDK_SETUP.md` for setup instructions
