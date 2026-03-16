# CounterFlow POS — Features

**Last Updated:** March 17, 2026

## Desktop App

### Table Order Entry
- Two-panel layout: Menu Browser (left) + Billing Area (right)
- Real-time Firestore sync — items added from mobile appear instantly
- KOT delta model: only unsent quantities dispatched per KOT
- Sent items locked with lock icon; pending items have +/− controls
- New items appear at bottom with auto-scroll; sent items sorted to top
- KOT History panel beside Send KOT (30-second grouping clusters, synced with mobile)
- Discount panel: fixed amount or percentage, capped at subtotal
- Payment: Cash, UPI, or Split (Cash + UPI with live sum validation)
- Keep Pending: saves order and returns to table grid
- Light theme matching TableManagement design system

### Table Management
- Visual table grid grouped by section (AC, Garden, Cabin, etc.)
- Real-time status colors: available / occupied
- Click table → opens TableOrderEntry
- Table merge, split, and transfer

### Menu Management
- CRUD for menu items and categories
- Modifier management (spice levels + paid add-ons)
- Manual and auto out-of-stock marking
- Real-time sync to mobile

### Inventory Management
- Dual stock: godown + counter
- Daily transfer with manager PIN authentication
- Movement history (manager ID, timestamp, reason)
- Auto out-of-stock when bar item inventory hits zero

### Billing & Payments
- Cash, Card, UPI payment methods
- Fixed or percentage discounts
- Split payment (max 2 methods, sum validation)
- Pending bills with customer phone tracking
- PDF bills + ESC/POS thermal printer

### KOT Printing
- Category routing: food → kitchen printer, drinks → bar printer
- Incremental KOTs (only delta quantities)
- Failed KOT storage with manual and auto-retry
- ESC/POS driver: USB, Network, Serial

### Reporting
- Waiter performance reports (daily / weekly / monthly)
- Sales analytics, inventory reports, transfer history
- PDF export, automated daily email reports

### Manager Authentication
- bcrypt PIN hashing, 3-attempt lockout (5-minute timeout)
- Multiple manager accounts

---

## Mobile App (WaiterFlow)

### Authentication
- 4–6 digit PIN login with session persistence

### Table Selection
- Real-time status grid with section filter

### Order Entry
- Add items with spice level (free) and paid add-on modifiers
- Real-time Firestore onSnapshot — desktop additions appear instantly
- KOT History button in header

### KOT History
- 30-second cluster grouping, real-time, synced with desktop

### Offline Support
- Full order creation offline (local SQLite)
- Auto-sync to Firestore on reconnect
- Sync status indicator

### Table Operations
- Merge, split, transfer tables

---

## Infrastructure
- Firebase project: `counterflow-81d88` (asia-south1)
- Real-time bidirectional sync (desktop ↔ mobile)
- Idempotent order submission
- Field normalization: mobile snake_case ↔ desktop camelCase
