# CounterFlow POS — Project Status

**Last Updated:** March 17, 2026
**Latest Commit:** `b992668` on `master`

---

## System Overview

CounterFlow POS is a two-part system:
1. **Desktop App** — Electron + React, Firebase Admin SDK, SQLite (non-critical local cache)
2. **Mobile App (WaiterFlow)** — React Native / Expo, Firebase SDK, offline SQLite mirror

Firestore is the source of truth for all order, table, menu, and waiter data.

---

## Completed Features

### Phase 1: Firebase Infrastructure ✅
- Firebase project `counterflow-81d88` (asia-south1)
- Firestore schema: orders, tables, menuItems, menuCategories, waiters, sections, kots
- PIN-based waiter authentication (Firebase Auth + custom tokens)
- Manager bcrypt PIN authentication with lockout

### Phase 2: Desktop Core Integration ✅
- Firebase SDK + Admin SDK in Electron
- Waiter management UI (CRUD, PIN validation)
- Manager authentication with 3-attempt lockout
- Menu management (CRUD, modifiers, real-time sync)
- Section and table management (CRUD, real-time listeners)
- Inventory management with manager PIN auth and movement history
- Billing: Cash, UPI, Split, discounts, pending bills
- Waiter performance reports
- KOT Router (food → kitchen printer, drinks → bar printer)
- Thermal printer driver (ESC/POS, USB/Network/Serial)
- Failed KOT management with auto-retry
- Configuration parser for printer settings
- Order data serialization and validation
- Idempotent order submission

### Phase 3: Mobile App (WaiterFlow) ✅
- Expo + TypeScript project setup
- PIN login screen with session persistence
- Table selection grid with real-time status colors
- Menu browser with category filter and search
- Order entry with modifiers (spice levels + paid add-ons)
- Real-time Firestore `onSnapshot` for order items
- KOT History screen (accessible from order entry header)
- Offline order capture with automatic sync on reconnect
- Table merge / split / transfer operations

### Phase 4: KOT Printing ✅
- KOT Router: category-based routing, incremental KOT logic
- Thermal printer driver: ESC/POS commands, connection pooling, retry
- Failed KOT storage and manual/auto retry UI
- 32 printer driver tests + 12 failed KOT tests passing

### Phase 5: Data Validation & Serialization ✅
- Order serializer / deserializer (JSON round-trip)
- Data validator (order, bill, split payment)
- Idempotency via deterministic order IDs
- 34 validation tests + 20 serialization tests passing

### Task 10: Desktop Table Order Entry ✅ (March 2026)
- `TableOrderEntry.js` — two-panel screen (Menu Browser + Billing Area)
- Light theme matching `TableManagement` (`#F8F9FA` / `#212529` / `#DC3545`)
- Real-time Firestore `onSnapshot` via `firebase:subscribe-order-items` IPC
- Field normalization: mobile snake_case ↔ desktop camelCase
- KOT delta model: only `currentQty - sentQty` dispatched per KOT
- Sent items locked (lock icon, no controls); pending items have +/− buttons
- New items appear at bottom with auto-scroll; sent items sorted to top
- KOT History panel on desktop beside Send KOT button
- Discount panel (fixed / %) with payable total
- Payment: Cash, UPI, Split with sum validation
- `removeHandler` guards prevent duplicate IPC handler errors
- `created_at` written on first desktop upsert for correct KOT grouping
- Mobile `OrderEntryScreen` switched to real-time Firestore listener
- Mobile `KOTHistoryScreen` wired into `OrderEntryScreen` header

---

## Key Files

| File | Purpose |
|---|---|
| `src/components/TableOrderEntry.js` | Desktop two-panel order entry |
| `src/firebase/electronIntegration.js` | All Firebase IPC handlers |
| `src/preload.js` | IPC bridge (exposes firebase:* to renderer) |
| `src/App.js` | Routes — TableOrderEntry replaces TablePOS |
| `waiter-app/src/screens/OrderEntryScreen.tsx` | Mobile order entry (real-time) |
| `waiter-app/src/screens/KOTHistoryScreen.tsx` | Mobile KOT history |
| `src/services/kotRouterService.js` | KOT routing logic |
| `src/services/thermalPrinterDriver.js` | ESC/POS printer driver |

---

## Development Notes

- Desktop loads from production build — run `npm run build` then `npm start` after any `src/` change
- SQLite inserts are non-fatal; Firestore is source of truth
- Menu item `foodType` values: `"veg"`, `"non-veg"`, `"none"`
- Firebase project: `counterflow-81d88` (asia-south1 / Mumbai)

---

## Pending / Future

- Property-based tests for TableOrderEntry (marked optional in spec, skipped for MVP)
- KOT print from desktop order entry
- Multi-printer configuration UI
- Cloud backup / export
