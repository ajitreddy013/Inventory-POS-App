# 🍽️ Restaurant POS App — UI/UX Design Specification

---

## 1. App Overview

| | |
|---|---|
| **App Type** | Mobile POS — used by waiters on handheld Android devices |
| **Platform** | Android, portrait mode |
| **Brand Color** | Red `#C0392B` — all primary actions, highlights, active states |
| **Font** | Roboto / system sans-serif |
| **Navigation** | Back arrow (←) at top-left on all child screens |

---

## 2. Design System

### Colors
- 🔴 **#C0392B** — Active tabs, CTA buttons, FAB, non-veg dot, section labels
- 🌑 **#2C3E50** — Screen titles, headings, banners
- 🟡 **#F9E79F** — Yellow table card = occupied, moderate time (10–60 min)
- 🟢 **#A9DFBF** — Green table card = occupied long time (60+ min), urgent
- ⬜ **#F5F6FA** — Gray table card = empty/available
- ⬜ **#FFFFFF** — All card and screen backgrounds

### Spacing
- Screen padding: **12dp** all sides
- Card gap: **8dp**
- Category header left accent: **4dp red bar**
- Bottom sheet corners: **16dp radius** (top only)
- Card corners: **8dp radius**
- Min touch target: **48dp × 48dp**

---

## 3. Screen 1 — All Tables (Home Dashboard)

### Section Tab Bar
- Horizontally scrollable tabs below the App Bar
- Each tab = one physical zone (AC Hall, Board Room, Garden, Parcel, etc.)
- **Active tab:** Brand Red text + red underline
- **Inactive tab:** gray text, no underline
- Tapping a tab filters the table grid to that section

### Table Card Grid
Each card shows:
- **Time elapsed** (top) — "61 min", "Just started", "10 min" — only when occupied
- **Table name** (center, bold) — BR1, P1, etc.
- **Running bill total** (bottom) — only when occupied
- **Red folded corner** (top-right) — means unsubmitted KOT items are pending

**Card color states:**
| Color | Meaning |
|---|---|
| 🟡 Yellow | Occupied, moderate time. Check in soon. |
| 🟢 Green | Occupied 60+ min. Urgent. |
| ⬜ Gray | Empty/available. No order. |

> Color is automatic and time-based — no manual input needed.

### Long Press → Bottom Sheet
Slides up from the bottom with:
- Header: **"Table No: BR1"** — bold, centered
- Two equal-width buttons side by side:
  - **View KOT(s)** — opens KOT list for the table
  - **Move Table** — transfer order to another table
- Rounded top corners (16dp), dim overlay behind it
- Tap outside or swipe down to dismiss

### Single Tap
- Empty table → Order Screen (fresh)
- Occupied table → Order Screen (add more items)

---

## 4. Screen 2 — Order Screen (Add Items)

### App Bar
- Title: **"Order for table : BR1"** (dynamic)
- Right icons: Search 🔍, Profile 👤

### Menu Item Grid (2 columns)

**Category headers** (full-width, spans both columns):
- Bold text, Brand Red
- 4dp thick red bar on the left side
- Examples: Best Selling, Nonveg Soup, Nonveg Tandoor Starter, Indian Main Course, Mutton, Biriyani, Sea Food Starter, Rice And Noodles

**Each item card:**
- Price — top-left, small gray text (e.g. "130")
- Veg/non-veg dot — top-right (🟥 red = non-veg, 🟩 green = veg)
- Item name — centered in card
- White background, 8dp corners, subtle shadow
- Tap = add 1 unit; +/− counter appears when qty > 0

**"Open Food Item" special card:**
- First card under "Best Selling"
- Lets waiter type a custom item name + price
- For off-menu / special requests

### FAB (Floating Action Button)
- Bottom-center, fixed, always visible while scrolling
- Circular, 56dp, Brand Red, white cutlery icon
- Opens the **Menu Category Drawer**

### Menu Category Drawer (Modal)
- Centered white card modal over dimmed background
- Header: cutlery icon + **"Menu"**
- Scrollable list of all categories, one per row, thin dividers
- Tap a category → grid scrolls there + modal closes
- Red ✕ button at bottom to dismiss without selecting

---

## 5. Screen 3 — KOT List for Table

**App Bar:** ← &nbsp; "KOT of table : BR1"

### KOT Groups (stacked, scrollable)
Each KOT group has:
- **Header row:** "KOT: 75 &nbsp; 28 Feb 2026 &nbsp; 21:04:27" — KOT number bold on left, date/time on right, ✏️ edit icon far right
- Red 4dp left accent border on header row
- **Item rows below:** full-width pill card — item name on left, quantity on right

> Multiple KOTs exist per table because customers order in batches. Each submission = new KOT number.

### Merge KOTs Button
- Full-width, Brand Red, pinned at screen bottom
- Label: **"Merge KOTs"** + combine icon
- Merges all KOTs into one — used before generating the final bill

---

## 6. Printed Outputs

### KOT Slip (Kitchen)
Thermal printout sent to the kitchen when order is submitted:
- "Running Table" + restaurant name
- Date/time, KOT number, order type (Dine In/Parcel), table no., captain name
- Item list: No. | Item name | Special note | Qty

### Final Bill (Customer)
Larger thermal receipt when customer pays:
- Header: restaurant name, address, date, bill no., cashier, table
- **Food Menu section** — items + subtotal
- **Bar Menu section** — bar items + subtotal
- **Grand Total** — bold and prominent (e.g. ₹350.00)
- Footer: thank you message + QR code for feedback

---

## 7. Navigation Flow

| Action | → | Result |
|---|---|---|
| Login | → | All Tables home screen |
| Tap section tab | → | Grid filters to that section |
| Tap empty table | → | Order Screen (fresh) |
| Tap occupied table | → | Order Screen (add items) |
| Long-press occupied table | → | Bottom sheet with 2 options |
| View KOT(s) | → | KOT List screen |
| Move Table | → | Table selection screen |
| Order Screen → FAB | → | Menu Category Drawer |
| Tap category in drawer | → | Scrolls grid, closes drawer |
| Tap item card | → | Item added, counter appears |
| Submit order | → | KOT printed, table turns yellow/green |
| Merge KOTs | → | All KOTs consolidated |
| Generate Bill | → | Final bill printed |

---

## 8. Key Design Notes

| | |
|---|---|
| **Touch Targets** | Min 48dp × 48dp for all interactive elements |
| **Touch Only** | No hover states — pure touch interface |
| **Speed** | All transitions under 300ms — waiters are in a hurry |
| **Contrast** | High contrast always — staff work in dim lighting |
| **Veg/Non-veg** | FSSAI standard: 🟩 green = veg, 🟥 red = non-veg |
| **Red Corner Fold** | = items added but NOT yet submitted to kitchen |
| **Real-Time** | Table colors/timers update live across all devices |
| **Offline** | Show clear loading/error/retry states for poor WiFi |
| **Parcel Section** | Same as other sections; P1, P2... = takeaway orders |

