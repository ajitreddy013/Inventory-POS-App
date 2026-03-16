# Code Documentation — CounterFlow POS

**Last Updated:** March 17, 2026

## Architecture

```
Desktop App (Electron + React)
  Renderer Process (React)
    App.js → TableManagement → TableOrderEntry
                             → (other screens)
  Main Process (Node.js)
    main.js → electronIntegration.js (Firebase IPC handlers)
            → kotRouterService.js
            → thermalPrinterDriver.js
            → database.js (SQLite — non-critical local cache)
  Preload
    preload.js → contextBridge exposes firebase:* and other IPC channels

Mobile App (React Native / Expo)
  screens/
    LoginScreen → TableSelectionScreen → OrderEntryScreen
                                       → KOTHistoryScreen
  services/
    syncEngine.ts (Firestore onSnapshot + offline queue)
    firebase.ts

Firebase / Firestore (Source of Truth)
  orders/{orderId}/items/{menuItemId}
  tables/{tableId}
  menuItems, menuCategories, waiters, sections
```

## Key Files

### Desktop

| File | Purpose |
|---|---|
| `src/App.js` | React router; `/tables` route renders TableOrderEntry or TableManagement |
| `src/main.js` | Electron main process, window creation, service init |
| `src/preload.js` | contextBridge — exposes all IPC channels to renderer |
| `src/firebase/electronIntegration.js` | All Firebase IPC handlers (menu, orders, KOT, billing, etc.) |
| `src/components/TableOrderEntry.js` | Two-panel order entry screen |
| `src/components/TableManagement.js` | Table grid with real-time status |
| `src/services/kotRouterService.js` | KOT routing (food→kitchen, drinks→bar) |
| `src/services/thermalPrinterDriver.js` | ESC/POS printer driver |
| `src/database.js` | SQLite (local cache, non-critical) |

### Mobile

| File | Purpose |
|---|---|
| `waiter-app/src/screens/OrderEntryScreen.tsx` | Order entry with real-time Firestore listener |
| `waiter-app/src/screens/KOTHistoryScreen.tsx` | KOT history (real-time, grouped by 30s clusters) |
| `waiter-app/src/screens/TableSelectionScreen.tsx` | Table grid with real-time status |
| `waiter-app/src/services/syncEngine.ts` | Firestore sync + offline queue |

## IPC Handler Pattern

All Firebase IPC handlers live in `electronIntegration.js`. Each handler uses a `removeHandler` guard:

```js
ipcMain.removeHandler('firebase:your-handler');
ipcMain.handle('firebase:your-handler', async (event, args) => {
  try {
    // ... Firestore operation
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
```

The `removeHandler` call prevents "handler already registered" errors when Electron hot-restarts.

## Real-Time Sync Pattern

Desktop subscribes to order items via `onSnapshot`:

```js
// electronIntegration.js
ipcMain.handle('firebase:subscribe-order-items', (event, { orderId }) => {
  const unsubscribe = db.collection('orders').doc(orderId)
    .collection('items').onSnapshot(snapshot => {
      const items = snapshot.docs.map(doc => normalize(doc.data()));
      event.sender.send('order-items-update', { orderId, items });
    });
  activeSubscriptions.set(orderId, unsubscribe);
});
```

Mobile uses the same pattern directly via Firebase SDK `onSnapshot`.

## KOT Delta Model

```
currentQty  = total quantity customer wants
sentQty     = quantity already sent to kitchen
pendingQty  = currentQty - sentQty  (goes in next KOT)

On Send KOT:
  kotItems = orderItems.filter(i => i.currentQty > i.sentQty)
  each kotItem.kotQty = currentQty - sentQty
  after success: sentQty = currentQty for all dispatched items
```

## Field Normalization

Mobile writes snake_case, desktop writes camelCase. The snapshot handler in `electronIntegration.js` normalizes both:

```js
function normalize(data) {
  return {
    menuItemId: data.menuItemId || data.menu_item_id,
    currentQty: data.currentQty ?? data.current_qty ?? 0,
    sentQty:    data.sentQty    ?? data.sent_qty    ?? 0,
    // ...
  };
}
```

## Firestore Collections

```
orders/{orderId}
  status: 'draft' | 'submitted' | 'completed'
  tableId, tableName, createdBy, createdAt, updatedAt

orders/{orderId}/items/{menuItemId}
  menuItemId, menuItemName, unitPrice
  currentQty, sentQty
  category, created_at, updated_at

tables/{tableId}
  name, status, currentOrderId, currentBillAmount

menuItems/{id}
  name, price, subCategory
  foodType: 'veg' | 'non-veg' | 'none'
  isActive, isOutOfStock

waiters/{id}
  name, pin (hashed), isActive

sections/{id}
  name
```

## Testing

```bash
# Run all tests (single pass)
npm test -- --run

# Individual suites
npx jest tests/kot-router.test.js
npx jest tests/thermalPrinterDriver.test.js
npx jest tests/data-validation.test.js
```

Test counts:
- KOT Router: 11 property tests
- Thermal Printer Driver: 32 tests
- Failed KOT Management: 12 tests
- Config Parser: 21 tests
- Order Serialization: 20 tests
- Data Validation: 34 tests
