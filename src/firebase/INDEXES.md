# Firestore Composite Indexes

This document lists all composite indexes required for the WaiterFlow system. These indexes optimize query performance for common operations.

## Why Indexes Are Needed

Firestore requires composite indexes for queries that:
- Filter on multiple fields
- Combine filtering and sorting
- Use inequality operators on multiple fields

## How to Create Indexes

### Method 1: Automatic (Recommended)
When you run a query that needs an index, Firestore will provide an error message with a direct link to create the index. Click the link and Firebase Console will auto-generate the index.

### Method 2: Manual Creation
1. Go to Firebase Console → Firestore Database → Indexes
2. Click "Create Index"
3. Enter the collection name and fields as specified below
4. Click "Create"

## Required Indexes

### 1. tables Collection

**Index 1: Query tables by section and status**
- Collection: `tables`
- Fields:
  - `sectionId` (Ascending)
  - `status` (Ascending)
- Query Collection: No

**Use Case:** Filter tables by section and status (e.g., "Show all available tables in AC section")

---

### 2. menuItems Collection

**Index 1: Query menu items by category and stock status**
- Collection: `menuItems`
- Fields:
  - `categoryId` (Ascending)
  - `isOutOfStock` (Ascending)
- Query Collection: No

**Use Case:** Get all in-stock items for a category

**Index 2: Query menu items by item category and stock status**
- Collection: `menuItems`
- Fields:
  - `itemCategory` (Ascending)
  - `isOutOfStock` (Ascending)
- Query Collection: No

**Use Case:** Get all in-stock food or drink items

---

### 3. orders Collection

**Index 1: Query orders by table and status**
- Collection: `orders`
- Fields:
  - `tableId` (Ascending)
  - `status` (Ascending)
- Query Collection: No

**Use Case:** Get active orders for a specific table

**Index 2: Query orders by waiter and status**
- Collection: `orders`
- Fields:
  - `waiterId` (Ascending)
  - `status` (Ascending)
- Query Collection: No

**Use Case:** Get all active orders for a waiter

**Index 3: Query orders by status and creation time**
- Collection: `orders`
- Fields:
  - `status` (Ascending)
  - `createdAt` (Descending)
- Query Collection: No

**Use Case:** Get recent submitted orders

**Index 4: Query orders by order number (single field)**
- Collection: `orders`
- Field: `orderNumber` (Ascending)
- Query Collection: No

**Use Case:** Quick lookup by order number

---

### 4. bills Collection

**Index 1: Query bills by pending status and creation time**
- Collection: `bills`
- Fields:
  - `isPending` (Ascending)
  - `createdAt` (Descending)
- Query Collection: No

**Use Case:** Get all pending bills sorted by date

**Index 2: Query bills by customer phone**
- Collection: `bills`
- Field: `customerPhone` (Ascending)
- Query Collection: No

**Use Case:** Find all bills for a customer

**Index 3: Query bills by bill number (single field)**
- Collection: `bills`
- Field: `billNumber` (Ascending)
- Query Collection: No

**Use Case:** Quick lookup by bill number

---

### 5. kots Collection

**Index 1: Query KOTs by order**
- Collection: `kots`
- Field: `orderId` (Ascending)
- Query Collection: No

**Use Case:** Get all KOTs for an order

---

### 6. inventoryMovements Collection

**Index 1: Query movements by menu item and timestamp**
- Collection: `inventoryMovements`
- Fields:
  - `menuItemId` (Ascending)
  - `timestamp` (Descending)
- Query Collection: No

**Use Case:** Get movement history for an item

**Index 2: Query movements by manager and timestamp**
- Collection: `inventoryMovements`
- Fields:
  - `authorizedBy` (Ascending)
  - `timestamp` (Descending)
- Query Collection: No

**Use Case:** Get all movements authorized by a manager

**Index 3: Query movements by timestamp only**
- Collection: `inventoryMovements`
- Field: `timestamp` (Descending)
- Query Collection: No

**Use Case:** Get recent movements across all items

---

### 7. customers Collection

**Index 1: Query customers by phone (single field)**
- Collection: `customers`
- Field: `phone` (Ascending)
- Query Collection: No

**Use Case:** Quick customer lookup by phone number

---

### 8. managers Collection

**Index 1: Query managers by PIN (single field)**
- Collection: `managers`
- Field: `pin` (Ascending)
- Query Collection: No

**Use Case:** Manager authentication (Note: PIN is hashed, so this is for document lookup)

---

## Index Creation Priority

### High Priority (Create First)
These indexes are critical for core functionality:
1. `orders` - tableId + status
2. `orders` - waiterId + status
3. `tables` - sectionId + status
4. `menuItems` - categoryId + isOutOfStock

### Medium Priority
These improve performance for common operations:
5. `bills` - isPending + createdAt
6. `inventoryMovements` - menuItemId + timestamp
7. `kots` - orderId

### Low Priority
These can be created as needed:
8. `bills` - customerPhone
9. `inventoryMovements` - authorizedBy + timestamp
10. `customers` - phone

## Testing Indexes

After creating indexes, test with these queries:

```javascript
// Test 1: Get available tables in AC section
const q1 = query(
  collection(db, 'tables'),
  where('sectionId', '==', 'section_id_here'),
  where('status', '==', 'available')
);

// Test 2: Get active orders for a table
const q2 = query(
  collection(db, 'orders'),
  where('tableId', '==', 'table_id_here'),
  where('status', '==', 'submitted')
);

// Test 3: Get in-stock items for a category
const q3 = query(
  collection(db, 'menuItems'),
  where('categoryId', '==', 'category_id_here'),
  where('isOutOfStock', '==', false)
);
```

## Index Build Time

- Simple indexes: 1-2 minutes
- Complex indexes: 5-10 minutes
- Large collections: Up to 30 minutes

Check index status in Firebase Console → Firestore Database → Indexes

## Notes

- Indexes are automatically maintained by Firestore
- No manual updates needed when data changes
- Indexes consume storage (minimal impact)
- Free tier: Unlimited indexes
- Each index adds ~1-2% to write latency

## Troubleshooting

**Error: "The query requires an index"**
- Click the link in the error message
- Firebase will auto-create the index
- Wait for index to build (check status in console)

**Slow queries despite indexes**
- Check if index is still building
- Verify correct fields are indexed
- Consider adding more specific indexes

**Index creation fails**
- Check Firebase project permissions
- Verify collection and field names
- Try creating via Firebase Console instead of CLI
