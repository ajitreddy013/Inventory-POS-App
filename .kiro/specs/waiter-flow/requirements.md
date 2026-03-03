# Requirements Document: WaiterFlow

## Introduction

WaiterFlow is a mobile ordering system for restaurant waiters that integrates with an existing Electron desktop POS system. The system enables waiters to take orders on Android devices that sync in real-time with the desktop application and automatically print Kitchen Order Tickets (KOTs) to kitchen and bar printers. The system supports 20-30 concurrent mobile devices with offline capability and cloud-based synchronization.

## Glossary

- **Mobile_App**: The Android application used by waiters to take orders
- **Desktop_App**: The existing Electron-based POS system used by managers
- **Cloud_Database**: Supabase PostgreSQL database for real-time synchronization
- **Local_Database**: SQLite database on mobile devices for offline storage
- **KOT**: Kitchen Order Ticket - printed order slip sent to kitchen or bar
- **KOT_Router**: Component that routes orders to appropriate printers based on item category
- **Kitchen_Printer**: Thermal printer for food items
- **Bar_Printer**: Thermal printer for drink items
- **Waiter**: Restaurant staff member using the Mobile_App to take orders
- **Manager**: Restaurant staff member using the Desktop_App for advanced operations
- **Order**: Collection of items for a specific table
- **Order_Item**: Individual menu item within an order with modifiers
- **Modifier**: Customization option for an item (spice level or paid add-on)
- **Section**: Logical grouping of tables (e.g., AC, Garden, Outdoor)
- **Sync_Engine**: Component that synchronizes data between mobile and cloud
- **Menu_Item**: Product available for ordering with price and category
- **Table**: Physical restaurant table with unique identifier
- **Pending_Bill**: Unpaid order associated with customer phone number
- **Out_Of_Stock_Indicator**: Visual marker showing item unavailability

## Requirements

### Requirement 1: Waiter Authentication

**User Story:** As a waiter, I want to log in with my unique PIN, so that my orders are tracked under my name.

#### Acceptance Criteria

1. THE Mobile_App SHALL accept a PIN between 4 and 6 digits in length
2. WHEN a valid PIN is entered, THE Mobile_App SHALL authenticate the waiter and display the table selection screen
3. WHEN an invalid PIN is entered, THE Mobile_App SHALL display an error message and remain on the login screen
4. WHILE a waiter is authenticated, THE Mobile_App SHALL maintain the logged-in session until manual logout
5. THE Mobile_App SHALL associate all orders with the authenticated waiter identifier

### Requirement 2: Real-Time Data Synchronization

**User Story:** As a system administrator, I want orders to sync in real-time between mobile and desktop, so that all devices show current order status.

#### Acceptance Criteria

1. WHEN an order is created on the Mobile_App, THE Sync_Engine SHALL transmit the order to the Cloud_Database within 2 seconds
2. WHEN an order is updated in the Cloud_Database, THE Desktop_App SHALL receive the update within 2 seconds
3. WHEN the Mobile_App detects network connectivity, THE Sync_Engine SHALL synchronize all pending local changes to the Cloud_Database
4. THE Sync_Engine SHALL support 20 to 30 concurrent mobile devices without data loss
5. WHEN a synchronization conflict occurs, THE Sync_Engine SHALL apply last-write-wins resolution strategy
6. THE Mobile_App SHALL display a sync status indicator showing connected, syncing, or offline state

### Requirement 3: Offline Order Capture

**User Story:** As a waiter, I want to take orders when WiFi is down, so that service continues during network outages.

#### Acceptance Criteria

1. WHEN the Mobile_App detects no network connectivity, THE Mobile_App SHALL store new orders in the Local_Database
2. WHILE offline, THE Mobile_App SHALL allow full order creation functionality
3. WHEN network connectivity is restored, THE Sync_Engine SHALL automatically upload all offline orders to the Cloud_Database
4. THE Local_Database SHALL persist orders until successful synchronization is confirmed
5. FOR ALL orders stored offline then synced, the order data SHALL match the original captured data (round-trip property)

### Requirement 4: Table Selection and Management

**User Story:** As a waiter, I want to see all restaurant tables, so that I can select the table I'm serving.

#### Acceptance Criteria

1. WHEN a waiter is authenticated, THE Mobile_App SHALL display a list of all tables
2. THE Mobile_App SHALL show each table's current status (available, occupied, or pending bill)
3. WHEN a waiter selects a table, THE Mobile_App SHALL display the order entry screen for that table
4. THE Mobile_App SHALL allow any authenticated waiter to select any table
5. WHEN a table has an existing order, THE Mobile_App SHALL display the current order items when the table is selected

### Requirement 5: Menu Display and Updates

**User Story:** As a waiter, I want to see the current menu with live updates, so that I can show customers available items.

#### Acceptance Criteria

1. THE Mobile_App SHALL display all Menu_Items organized by category
2. WHEN a Menu_Item is updated in the Desktop_App, THE Mobile_App SHALL reflect the change within 2 seconds
3. WHEN a Menu_Item is marked out of stock, THE Mobile_App SHALL display a red indicator next to that item
4. THE Mobile_App SHALL show the current price for each Menu_Item
5. THE Mobile_App SHALL provide search functionality to find Menu_Items by name

### Requirement 6: Order Item Entry with Modifiers

**User Story:** As a waiter, I want to add items with customizations, so that I can capture customer preferences accurately.

#### Acceptance Criteria

1. WHEN a waiter selects a Menu_Item, THE Mobile_App SHALL add the item to the current order
2. THE Mobile_App SHALL allow selection of spice level (Mild, Medium, Hot, Extra Hot) without additional charge
3. THE Mobile_App SHALL display available paid add-ons (Extra cheese, Extra gravy) with prices
4. WHEN a paid add-on is selected, THE Mobile_App SHALL add the add-on price to the Order_Item total
5. THE Mobile_App SHALL allow quantity adjustment for each Order_Item
6. FOR ALL Order_Items with modifiers, the total price SHALL equal base price plus sum of paid add-on prices (invariant property)

### Requirement 7: KOT Generation and Routing

**User Story:** As a kitchen staff member, I want orders to print automatically at the correct station, so that I can prepare food efficiently.

#### Acceptance Criteria

1. WHEN Order_Items are sent to the KOT_Router, THE KOT_Router SHALL generate a KOT within 1 second
2. WHEN a KOT contains food items, THE KOT_Router SHALL send the KOT to the Kitchen_Printer
3. WHEN a KOT contains drink items, THE KOT_Router SHALL send the KOT to the Bar_Printer
4. WHEN a KOT contains both food and drink items, THE KOT_Router SHALL generate separate KOTs for each printer
5. THE KOT_Router SHALL route items based on the Menu_Item category field

### Requirement 8: KOT Format and Content

**User Story:** As a kitchen staff member, I want KOTs to show all order details, so that I can prepare items correctly.

#### Acceptance Criteria

1. THE KOT SHALL include the table number
2. THE KOT SHALL include the waiter name
3. THE KOT SHALL include all Order_Items with quantities
4. THE KOT SHALL include all modifiers for each Order_Item
5. THE KOT SHALL include a timestamp in HH:MM format
6. THE KOT SHALL include a unique order number
7. FOR ALL KOTs printed, the KOT SHALL contain all Order_Items that were sent to the KOT_Router (completeness property)

### Requirement 9: Incremental Order Modifications

**User Story:** As a waiter, I want to add items to an existing order, so that customers can order additional items.

#### Acceptance Criteria

1. WHEN a waiter adds Order_Items to an existing order, THE Mobile_App SHALL generate a new KOT with only the new items
2. WHEN a waiter increases the quantity of an existing Order_Item, THE Mobile_App SHALL generate a new KOT showing the incremental quantity (e.g., "+1 Biryani")
3. THE Mobile_App SHALL not allow modification of Order_Items after they are sent to the KOT_Router
4. THE Mobile_App SHALL not allow deletion of Order_Items after they are sent to the KOT_Router
5. FOR ALL order modifications, the sum of all KOT quantities SHALL equal the current order quantity (invariant property)

### Requirement 10: Out-of-Stock Management

**User Story:** As a manager, I want to mark items as out of stock, so that waiters don't take orders for unavailable items.

#### Acceptance Criteria

1. THE Desktop_App SHALL allow managers to manually mark any Menu_Item as out of stock
2. WHEN a Menu_Item is marked out of stock, THE Out_Of_Stock_Indicator SHALL appear on the Mobile_App within 2 seconds
3. WHEN a bar Menu_Item's inventory reaches zero, THE Desktop_App SHALL automatically mark the item as out of stock
4. WHEN godown stock is updated for a bar Menu_Item, THE Desktop_App SHALL automatically restore the item to in-stock status if quantity is greater than zero
5. THE Desktop_App SHALL display a dashboard section listing all Menu_Items currently marked as out of stock

### Requirement 11: Inventory Deduction for Bar Items

**User Story:** As a manager, I want bar item inventory to decrease automatically when sold, so that stock levels stay accurate.

#### Acceptance Criteria

1. WHEN a bar Menu_Item is included in a finalized order, THE Desktop_App SHALL deduct the quantity from inventory
2. THE Desktop_App SHALL not deduct inventory for kitchen Menu_Items
3. WHEN bar inventory reaches zero, THE Desktop_App SHALL mark the Menu_Item as out of stock
4. FOR ALL bar items sold, the inventory quantity SHALL equal initial quantity minus sum of sold quantities (invariant property)

### Requirement 12: Billing Operations

**User Story:** As a manager, I want to generate bills from the desktop, so that I can process payments securely.

#### Acceptance Criteria

1. THE Desktop_App SHALL generate bills for completed orders
2. THE Desktop_App SHALL support Cash, Card, and UPI payment methods
3. THE Desktop_App SHALL allow split payment across a maximum of 2 payment methods
4. THE Mobile_App SHALL not provide bill generation functionality
5. WHEN a split payment is recorded, THE Desktop_App SHALL verify that the sum of payment amounts equals the bill total

### Requirement 13: Bill-Level Discounts

**User Story:** As a manager, I want to apply discounts to bills, so that I can offer promotions to customers.

#### Acceptance Criteria

1. THE Desktop_App SHALL allow percentage discounts (e.g., 10%, 20%)
2. THE Desktop_App SHALL allow fixed amount discounts (e.g., ₹100, ₹50)
3. THE Desktop_App SHALL apply discounts to the total bill amount, not individual items
4. THE Desktop_App SHALL not apply time-based or conditional pricing rules
5. WHEN a percentage discount is applied, THE Desktop_App SHALL calculate the discount as bill_total multiplied by discount_percentage

### Requirement 14: Pending Bills with Customer Tracking

**User Story:** As a manager, I want to track pending bills by customer phone, so that I can manage credit and returning customers.

#### Acceptance Criteria

1. WHEN creating a pending bill, THE Desktop_App SHALL require a customer phone number
2. THE Desktop_App SHALL check if the phone number exists in the customer database
3. WHEN a returning customer phone is entered, THE Desktop_App SHALL display previous order history for that phone number
4. THE Desktop_App SHALL provide search functionality for pending bills by customer name or phone number
5. THE Desktop_App SHALL display all unpaid orders associated with each customer phone number

### Requirement 15: Table Operations

**User Story:** As a waiter or manager, I want to merge, split, and transfer tables, so that I can handle complex seating arrangements.

#### Acceptance Criteria

1. THE Desktop_App SHALL allow merging two or more tables into a single order
2. THE Desktop_App SHALL allow splitting a table's order into multiple separate bills
3. THE Desktop_App SHALL allow transferring an order from one table to another table
4. THE Mobile_App SHALL allow waiters to merge, split, and transfer tables
5. WHEN tables are merged, THE system SHALL combine all Order_Items into a single order while preserving waiter attribution for each item
6. THE Mobile_App SHALL provide the same table operation functionality as the Desktop_App

### Requirement 16: Section and Table Management

**User Story:** As a manager, I want to organize tables into sections and create tables manually, so that I can match my restaurant layout.

#### Acceptance Criteria

1. THE Desktop_App SHALL allow managers to create sections with custom names (e.g., "AC", "Garden", "Outdoor")
2. THE Desktop_App SHALL allow managers to add tables manually to any section
3. WHEN creating a table, THE Desktop_App SHALL require a table name and section assignment
4. THE Desktop_App SHALL allow managers to edit table names and reassign tables to different sections
5. THE Desktop_App SHALL allow managers to delete tables that have no active orders
6. THE Mobile_App SHALL display tables grouped by section
7. WHEN a section is updated in the Desktop_App, THE Mobile_App SHALL reflect the change within 2 seconds
8. FOR ALL tables in the system, each table SHALL belong to exactly one section (invariant property)

### Requirement 17: Waiter Performance Reports

**User Story:** As a manager, I want to see sales per waiter, so that I can track performance and calculate commissions.

#### Acceptance Criteria

1. THE Desktop_App SHALL generate sales reports per waiter for daily, weekly, and monthly periods
2. THE Desktop_App SHALL display the number of orders taken by each waiter
3. THE Desktop_App SHALL display table assignments per waiter
4. THE Desktop_App SHALL calculate total sales amount per waiter
5. FOR ALL waiter reports, the sum of individual waiter sales SHALL equal total restaurant sales for the period (invariant property)

### Requirement 18: Menu Management

**User Story:** As a manager, I want to manage products and prices from the desktop, so that the menu stays current.

#### Acceptance Criteria

1. THE Desktop_App SHALL allow creating, updating, and deleting Menu_Items
2. THE Desktop_App SHALL allow setting prices for Menu_Items and paid add-ons
3. THE Desktop_App SHALL allow organizing Menu_Items into categories
4. WHEN a Menu_Item is updated in the Desktop_App, THE Mobile_App SHALL reflect the change within 2 seconds
5. THE Desktop_App SHALL allow defining which add-ons are available for each Menu_Item

### Requirement 19: Configuration Parser and Printer

**User Story:** As a developer, I want to parse configuration files for printer settings, so that the system can route KOTs correctly.

#### Acceptance Criteria

1. WHEN a valid printer configuration file is provided, THE Configuration_Parser SHALL parse it into a Configuration object
2. WHEN an invalid configuration file is provided, THE Configuration_Parser SHALL return a descriptive error message
3. THE Configuration_Printer SHALL format Configuration objects back into valid configuration files
4. FOR ALL valid Configuration objects, parsing then printing then parsing SHALL produce an equivalent Configuration object (round-trip property)

### Requirement 20: Order Data Serialization

**User Story:** As a developer, I want to serialize orders for network transmission, so that data syncs reliably between devices.

#### Acceptance Criteria

1. WHEN an Order is created, THE Order_Serializer SHALL convert the Order into JSON format
2. WHEN JSON order data is received, THE Order_Deserializer SHALL convert it into an Order object
3. THE Order_Serializer SHALL include all Order_Items, modifiers, waiter information, and timestamps
4. WHEN serialization fails, THE Order_Serializer SHALL return a descriptive error message
5. FOR ALL valid Order objects, serializing then deserializing SHALL produce an equivalent Order object (round-trip property)

### Requirement 21: Concurrent Device Support

**User Story:** As a system administrator, I want to support 20-30 devices simultaneously, so that all waiters can work without conflicts.

#### Acceptance Criteria

1. THE Cloud_Database SHALL handle 20 to 30 concurrent connections without performance degradation
2. WHEN multiple devices modify different orders simultaneously, THE Sync_Engine SHALL process all changes without data loss
3. WHEN multiple devices modify the same order simultaneously, THE Sync_Engine SHALL apply conflict resolution and notify affected devices
4. THE system SHALL maintain response times under 2 seconds for order synchronization with 30 concurrent devices
5. FOR ALL concurrent operations on different orders, the final database state SHALL contain all operations (confluence property)

### Requirement 22: Background Synchronization

**User Story:** As a waiter, I want orders to sync automatically in the background, so that I don't have to manually trigger sync.

#### Acceptance Criteria

1. WHILE the Mobile_App is running, THE Sync_Engine SHALL check for pending synchronization every 5 seconds
2. WHEN pending changes exist and network is available, THE Sync_Engine SHALL automatically synchronize without user interaction
3. THE Sync_Engine SHALL continue synchronization attempts when the Mobile_App is in the background
4. WHEN synchronization fails, THE Sync_Engine SHALL retry with exponential backoff up to 5 attempts
5. THE Mobile_App SHALL display a notification when synchronization completes after being offline

### Requirement 23: Error Handling for Network Failures

**User Story:** As a waiter, I want clear error messages when sync fails, so that I know if my orders are saved.

#### Acceptance Criteria

1. WHEN network synchronization fails, THE Mobile_App SHALL display an error notification with the failure reason
2. WHEN the Local_Database is full, THE Mobile_App SHALL display a storage warning and prevent new order creation
3. WHEN the Cloud_Database is unreachable for more than 60 seconds, THE Mobile_App SHALL display an offline mode indicator
4. WHEN printer communication fails, THE Desktop_App SHALL log the error and display a printer offline notification
5. THE Mobile_App SHALL guarantee that all orders are stored in the Local_Database before confirming order submission to the waiter

### Requirement 24: Data Integrity Validation

**User Story:** As a developer, I want to validate order data before saving, so that invalid data doesn't corrupt the database.

#### Acceptance Criteria

1. WHEN an Order is created, THE Mobile_App SHALL validate that at least one Order_Item exists
2. WHEN an Order_Item is added, THE Mobile_App SHALL validate that quantity is greater than zero
3. WHEN a modifier is applied, THE Mobile_App SHALL validate that the modifier is valid for the Menu_Item
4. WHEN a price is calculated, THE Desktop_App SHALL validate that the total is non-negative
5. FOR ALL orders in the system, the order total SHALL equal the sum of all Order_Item totals (invariant property)

### Requirement 25: Idempotent Order Submission

**User Story:** As a developer, I want order submissions to be idempotent, so that network retries don't create duplicate orders.

#### Acceptance Criteria

1. WHEN an order is submitted multiple times with the same order identifier, THE Cloud_Database SHALL store only one instance
2. THE Sync_Engine SHALL assign a unique identifier to each order before first submission attempt
3. WHEN a retry occurs, THE Sync_Engine SHALL use the same order identifier as the original attempt
4. FOR ALL order submission operations, submitting the same order twice SHALL produce the same database state as submitting once (idempotence property)

### Requirement 26: Manager PIN Authentication for Inventory Operations

**User Story:** As a restaurant owner, I want inventory movements to require manager PIN authentication, so that unauthorized stock transfers are prevented.

#### Acceptance Criteria

1. WHEN a user attempts to move stock from godown to counter, THE Desktop_App SHALL prompt for manager PIN authentication
2. WHEN a valid manager PIN is entered, THE Desktop_App SHALL allow the inventory operation to proceed
3. WHEN an invalid manager PIN is entered, THE Desktop_App SHALL deny the inventory operation and display an error message
4. THE Desktop_App SHALL log all inventory movements with the authenticated manager identifier and timestamp
5. THE Desktop_App SHALL allow managers to set and update their own PINs
6. THE Desktop_App SHALL support multiple manager accounts with unique PINs
7. WHEN a manager PIN is entered, THE Desktop_App SHALL not display the PIN characters (masked input)
8. THE Desktop_App SHALL lock the inventory operation screen after 3 failed PIN attempts for 5 minutes
9. FOR ALL inventory movements, the system SHALL record which manager authorized the operation (audit trail property)

### Requirement 27: Desktop Order Entry

**User Story:** As a manager, I want to create orders directly from the desktop application, so that I can handle phone orders, counter orders, and assist during rush hours.

#### Acceptance Criteria

1. THE Desktop_App SHALL provide an order entry interface similar to the Mobile_App
2. THE Desktop_App SHALL allow managers to select a table and create a new order
3. THE Desktop_App SHALL allow managers to add menu items with modifiers to orders
4. THE Desktop_App SHALL display a "Send to Kitchen" button to submit orders
5. WHEN the "Send to Kitchen" button is clicked, THE Desktop_App SHALL route order items to the KOT_Router
6. THE Desktop_App SHALL generate and print KOTs to appropriate printers (kitchen/bar) based on item category
7. THE Desktop_App SHALL associate desktop-created orders with a system user identifier (e.g., "Manager" or "Counter")
8. THE Desktop_App SHALL allow managers to modify orders before sending to kitchen
9. THE Desktop_App SHALL provide the same order modification rules as the Mobile_App (no modification after KOT sent)
10. THE Desktop_App SHALL sync desktop-created orders to the Cloud_Database for mobile app visibility

