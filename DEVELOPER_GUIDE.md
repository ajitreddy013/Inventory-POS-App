# Developer Guide — CounterFlow POS

**Last Updated:** March 17, 2026

## Prerequisites

- Node.js 18+
- npm
- Expo CLI (`npm install -g expo-cli`) for mobile

## Running the Desktop App

```bash
# 1. Install dependencies (first time only)
npm install

# 2. Build React app (REQUIRED after any src/ change)
npm run build

# 3. Start Electron
npm start
```

> The desktop app loads from the production build in `build/`. There is no hot-reload — you must rebuild and restart after every change.

## Running the Mobile App

```bash
cd waiter-app
npm install
npx expo start
```

Scan the QR code with Expo Go on Android/iOS.

## Environment Variables

Copy `.env.example` → `.env` and fill in Firebase credentials:

```
REACT_APP_FIREBASE_API_KEY=
REACT_APP_FIREBASE_AUTH_DOMAIN=
REACT_APP_FIREBASE_PROJECT_ID=counterflow-81d88
REACT_APP_FIREBASE_STORAGE_BUCKET=
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=
REACT_APP_FIREBASE_APP_ID=
```

The `firebase-admin-key.json` and `firebase-service-account.json` files are required for the Electron main process (not committed to git).

## Project Structure

```
/
├── src/                            # Desktop app (Electron + React)
│   ├── components/
│   │   ├── TableOrderEntry.js      # Two-panel order entry (NEW)
│   │   ├── TableManagement.js      # Table grid
│   │   └── ...
│   ├── firebase/
│   │   └── electronIntegration.js  # All Firebase IPC handlers
│   ├── services/
│   │   ├── kotRouterService.js
│   │   └── thermalPrinterDriver.js
│   ├── App.js                      # Routes
│   ├── main.js                     # Electron main process
│   └── preload.js                  # IPC bridge
├── waiter-app/                     # React Native mobile app
│   └── src/
│       ├── screens/
│       │   ├── OrderEntryScreen.tsx
│       │   ├── KOTHistoryScreen.tsx
│       │   └── TableSelectionScreen.tsx
│       └── services/
│           └── syncEngine.ts
├── tests/                          # Jest test suites
└── .kiro/specs/                    # Feature specs
```

## Adding a New IPC Handler

1. Add the handler in `src/firebase/electronIntegration.js` inside the relevant `register*Handlers()` function.
2. Add a `removeHandler` guard at the top to prevent duplicate registration on Electron restart:
   ```js
   ipcMain.removeHandler('firebase:your-handler');
   ipcMain.handle('firebase:your-handler', async (event, args) => { ... });
   ```
3. Expose it in `src/preload.js`:
   ```js
   yourHandler: (args) => ipcRenderer.invoke('firebase:your-handler', args),
   ```
4. Run `npm run build` then `npm start`.

## Firestore Data Model

```
orders/{orderId}
  tableId, tableName, status, createdBy, createdAt, updatedAt

orders/{orderId}/items/{menuItemId}
  menuItemId, menuItemName, unitPrice
  currentQty    ← total desired quantity
  sentQty       ← quantity already sent to kitchen (locked)
  category, created_at, updated_at

tables/{tableId}
  name, status ('available' | 'occupied')
  currentOrderId, currentBillAmount

menuItems/{id}
  name, price, subCategory, foodType ('veg'|'non-veg'|'none')
  isActive, isOutOfStock

waiters/{id}
  name, pin (hashed), isActive

sections/{id}
  name
```

## KOT Delta Model

- `currentQty` = total quantity the customer wants
- `sentQty` = quantity already dispatched to kitchen
- `pendingQty = currentQty - sentQty` = what goes in the next KOT
- After Send KOT: `sentQty` is set to `currentQty` for all dispatched items
- Items where `sentQty > 0` are "locked" — cannot be reduced below sent qty

## Field Naming Convention

Mobile app writes Firestore docs in **snake_case** (`menu_item_id`, `current_qty`).
Desktop app writes in **camelCase** (`menuItemId`, `currentQty`).

The `electronIntegration.js` snapshot handler normalizes both formats so either side can read documents written by the other.

## Running Tests

```bash
# All tests (single run)
npm test -- --run

# Specific suite
npx jest tests/kot-router.test.js
```

## Windows Build

```bash
npm run build
npm run dist-win          # NSIS installer → dist/
npm run dist-win-portable # Portable exe → dist/
```

## Common Issues

| Issue | Fix |
|---|---|
| "No handler registered for 'firebase:...'" | `removeHandler` guard missing; add it before `ipcMain.handle` |
| Mobile items not appearing on desktop | Check Firestore subscription is active; verify field normalization |
| Desktop items not appearing on mobile | Confirm `onSnapshot` listener is set up in `OrderEntryScreen` |
| Electron shows old UI after code change | Run `npm run build` then restart Electron |
| SQLite errors on startup | Non-fatal; Firestore is source of truth — ignore or check schema migration |
