# CounterFlow POS | Restaurant Point of Sale & Waiter Ordering System

CounterFlow POS is a full-stack restaurant management system combining an Electron desktop POS app with a React Native mobile waiter app (WaiterFlow), backed by Firebase/Firestore for real-time cloud sync.

## Demo Video

[![CounterFlow POS Demo](https://img.youtube.com/vi/axBFug2R3Dg/maxresdefault.jpg)](https://youtu.be/axBFug2R3Dg)

[Watch on YouTube](https://youtu.be/axBFug2R3Dg)

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-Proprietary-red)

## System Architecture

```
Desktop App (Electron + React)
  ├── Table Management (Firestore real-time)
  ├── TableOrderEntry — two-panel order entry
  │     ├── Menu Browser (left panel)
  │     └── Billing Area + KOT History (right panel)
  ├── Menu Management
  ├── Billing & Payments (Cash / UPI / Split)
  ├── KOT printing (ESC/POS thermal printers)
  └── Reports & Analytics

Mobile App — WaiterFlow (React Native / Expo)
  ├── Waiter PIN login
  ├── Table selection (real-time status)
  ├── Order entry with modifiers
  ├── KOT History screen
  └── Offline support with Firestore sync

Firebase / Firestore (Cloud)
  ├── orders / {orderId} / items  ← shared order state
  ├── tables
  ├── menuItems / menuCategories
  ├── waiters
  └── sections
```

## Key Features

### Desktop App
- Two-panel Table Order Entry screen (Menu Browser + Billing Area)
- Real-time Firestore `onSnapshot` sync — items added from mobile appear instantly on desktop and vice versa
- KOT delta model: only unsent quantities are dispatched per KOT
- KOT History panel (beside Send KOT button) — grouped by 30-second clusters, synced with mobile
- Sent items locked with lock icon; pending items have +/− controls
- Discount panel (fixed or %) with payable total calculation
- Payment: Cash, UPI, or Split (Cash + UPI with sum validation)
- Light theme matching the desktop design system (`#F8F9FA` / `#212529` / `#DC3545`)
- ESC/POS thermal printer integration (USB, Network, Serial)
- Manager PIN authentication for inventory operations
- Waiter performance reports, inventory management, daily transfers

### Mobile App (WaiterFlow)
- PIN-based waiter authentication
- Real-time table status grid (available / occupied / pending_bill)
- Order entry with spice level and paid add-on modifiers
- Real-time Firestore `onSnapshot` for order items — desktop additions appear instantly
- KOT History screen accessible from order entry header
- Offline order capture with automatic sync on reconnect
- Table merge / split / transfer operations

## Technology Stack

| Layer | Technology |
|---|---|
| Desktop frontend | React 18 |
| Desktop backend | Electron 28 + Node.js |
| Mobile | React Native (Expo) + TypeScript |
| Cloud database | Firebase Firestore |
| Local database | Better-SQLite3 (desktop), expo-sqlite (mobile) |
| Auth | Firebase Authentication (PIN-based) |
| Printing | ESC/POS (thermalPrinterDriver) |
| PDF | jsPDF + AutoTable |
| Email | Nodemailer |

## Project Structure

```
/
├── src/                          # Desktop Electron + React app
│   ├── components/
│   │   ├── TableOrderEntry.js    # Two-panel order entry screen
│   │   ├── TableManagement.js    # Table grid
│   │   └── ...
│   ├── firebase/
│   │   └── electronIntegration.js  # All Firebase IPC handlers
│   ├── services/
│   │   ├── kotRouterService.js
│   │   └── thermalPrinterDriver.js
│   ├── App.js
│   ├── main.js
│   └── preload.js
├── waiter-app/                   # React Native mobile app
│   └── src/
│       ├── screens/
│       │   ├── OrderEntryScreen.tsx
│       │   ├── KOTHistoryScreen.tsx
│       │   └── TableSelectionScreen.tsx
│       └── services/
│           └── syncEngine.ts
├── tests/                        # Jest test suites
├── .kiro/specs/                  # Feature specs
│   ├── desktop-table-order-entry/
│   └── waiter-flow/
└── firestore.rules
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm
- Expo CLI (for mobile)

### Desktop App

```bash
# Install dependencies
npm install

# Build React app (required after any src/ change)
npm run build

# Start Electron
npm start
```

### Mobile App

```bash
cd waiter-app
npm install
npx expo start
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your Firebase credentials:

```
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=counterflow-81d88
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
```

### Windows Build

```bash
npm run build
npm run dist-win          # NSIS installer
npm run dist-win-portable # Portable exe
```

## Firebase IPC Handlers (Desktop)

| Handler | Description |
|---|---|
| `firebase:get-menu-items` | Fetch all active menu items |
| `firebase:get-menu-categories-with-ids` | Fetch menu categories |
| `firebase:create-order` | Create new order document |
| `firebase:get-order-items` | Fetch order items subcollection |
| `firebase:upsert-order-item` | Create/update an order item |
| `firebase:subscribe-order-items` | Real-time onSnapshot subscription |
| `firebase:unsubscribe-order-items` | Unsubscribe from snapshot |
| `firebase:send-kot` | Dispatch KOT, lock sent items |
| `firebase:generate-bill` | Generate bill and clear table |

## Firestore Data Model

```
orders/{orderId}
  status: 'draft' | 'submitted' | 'completed'
  tableId, tableName, createdBy, createdAt, updatedAt

orders/{orderId}/items/{menuItemId}
  menuItemId, menuItemName, unitPrice
  currentQty   ← total desired quantity
  sentQty      ← quantity already sent to kitchen
  category, created_at, updated_at

tables/{tableId}
  name, status: 'available' | 'occupied'
  currentOrderId, currentBillAmount

menuItems/{id}
  name, price, subCategory, foodType
  isActive, isOutOfStock

waiters/{id}
  name, pin (hashed), isActive
```

## KOT Delta Model

Each order item tracks `currentQty` and `sentQty`. Only the delta (`currentQty - sentQty`) is sent per KOT, preventing duplicate kitchen instructions. Items with `sentQty > 0` are locked on both desktop and mobile.

## Recent Updates (March 2026)

- Full `TableOrderEntry` desktop screen with real-time Firestore sync
- KOT History panel on desktop (beside Send KOT), synced with mobile
- Mobile `OrderEntryScreen` switched to Firestore `onSnapshot` (real-time)
- Mobile `KOTHistoryScreen` wired into order entry header
- Field normalization between mobile (snake_case) and desktop (camelCase) Firestore docs
- `removeHandler` guards prevent stale IPC handler errors on Electron restart
- Light theme applied to desktop order entry matching `TableManagement` palette
- Committed: `b992668` on `master`

## Support

- Email: ajitreddy013@gmail.com
- Phone: +91 7517323121

## License

Proprietary — All Rights Reserved. See [LICENSE](LICENSE).
