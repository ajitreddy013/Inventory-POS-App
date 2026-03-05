# Implementation Tasks: WaiterFlow Mobile Ordering System

## Overview

This implementation plan covers the complete WaiterFlow system including mobile app (React Native), desktop app (Electron), and Firebase cloud infrastructure. Phase 1 (Firebase Infrastructure Setup) has been completed.

## Phase 1: Firebase Infrastructure Setup ✅ COMPLETE

### Task 1.1: Firebase Project Configuration ✅
- [x] Create Firebase project in Firebase Console
- [x] Enable Firestore Database
- [x] Enable Firebase Authentication
- [x] Configure Firebase security rules for Firestore
- [x] Set up Firebase project for web and mobile platforms
- [x] Generate and store API keys securely

**Status:** ✅ COMPLETE
**Validates:** Requirements 2.1, 2.2

### Task 1.2: Firestore Database Schema Setup ✅
- [x] Create Firestore collections: waiters, sections, tables, menuCategories, menuItems, modifiers, inventory, orders, bills, customers, syncMetadata
- [x] Set up composite indexes for queries (tableId, waiterId, status, etc.)
- [x] Create subcollection structure for order items
- [x] Configure Firestore security rules
- [x] Test security rules with Firebase emulator

**Status:** ✅ COMPLETE
**Validates:** Requirements 2.4, 4.1, 5.1

**Files Created:**
- `src/firebase/setupSchema.js` - Database initialization script
- `firestore.rules` - Security rules configuration
- `src/firebase/INDEXES.md` - Composite indexes documentation

### Task 1.3: Firebase Authentication Setup ✅
- [x] Enable custom token authentication
- [x] Create Cloud Function for custom token generation
- [x] Implement PIN-based authentication flow
- [x] Set up authentication state persistence
- [x] Test authentication with test waiters

**Status:** ✅ COMPLETE
**Validates:** Requirements 1.1, 1.2, 1.3, 1.4

**Files Created:**
- `src/firebase/authService.js` - Authentication service with PIN validation
- `src/hooks/useAuth.js` - React hook for authentication
- `src/firebase/testAuth.js` - Authentication test suite
- `src/firebase/AUTHENTICATION.md` - Complete authentication documentation

## Phase 2: Desktop Application Core Integration

### Task 2.1: Firebase SDK Integration (Desktop)
- [x] 2.1.1 Install Firebase SDK and Firebase Admin SDK in Electron app
  - Install firebase and firebase-admin packages
  - Configure environment variables for Firebase config
  - _Requirements: 2.1_

- [x] 2.1.2 Initialize Firebase in desktop app
  - Create Firebase initialization module
  - Enable Firestore offline persistence
  - Set up Firebase Admin SDK for privileged operations
  - _Requirements: 2.1_

- [x] 2.1.3 Write unit tests for Firebase connection
  - Test Firestore connectivity
  - Test Admin SDK authentication
  - _Requirements: 2.1_

**Dependencies:** Task 1.1
**Validates:** Requirements 2.1

### Task 2.2: Waiter PIN Management (Desktop)
- [x] 2.2.1 Create waiter management UI screen
  - Build waiter list view with search/filter
  - Add "Add Waiter" dialog with name and PIN fields
  - Add "Edit Waiter" dialog for PIN updates
  - Display waiter status (active/inactive)
  - _Requirements: 1.1, 1.2_

- [x] 2.2.2 Implement waiter CRUD operations
  - Create waiter with PIN (4-6 digits validation)
  - Update waiter PIN with uniqueness check
  - Deactivate/reactivate waiter accounts
  - List all waiters with status
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2.2.3 Write property test for PIN uniqueness
  - **Property 2: Valid PIN Authentication Success**
  - **Validates: Requirements 1.2**

- [x] 2.2.4 Write unit tests for waiter management
  - Test PIN format validation
  - Test PIN uniqueness enforcement
  - Test waiter activation/deactivation
  - _Requirements: 1.1, 1.2, 1.3_

**Dependencies:** Task 2.1
**Validates:** Requirements 1.1, 1.2, 1.3

### Task 2.3: Manager Authentication System
- [x] 2.3.1 Create managers collection and management UI
  - Build manager account creation interface
  - Implement bcrypt PIN hashing
  - Add manager role assignment (owner/manager/supervisor)
  - Create "Change My PIN" interface
  - _Requirements: 26.1, 26.5, 26.6_

- [x] 2.3.2 Implement manager PIN authentication
  - Create PIN prompt dialog component
  - Implement bcrypt PIN comparison
  - Add 3-attempt lockout with 5-minute timeout
  - Display attempts remaining on failure
  - _Requirements: 26.2, 26.3, 26.7, 26.8_

- [x] 2.3.3 Write unit tests for manager authentication
  - Test PIN hashing and verification
  - Test lockout mechanism
  - Test lockout timer reset
  - _Requirements: 26.2, 26.3, 26.8_

**Dependencies:** Task 2.1
**Validates:** Requirements 26.1-26.8

### Task 2.4: Menu Management with Firebase
- [x] 2.4.1 Implement menu item CRUD operations
  - Create menu item with category and price
  - Update menu item details
  - Delete menu item (if no active orders)
  - List menu items by category
  - _Requirements: 18.1, 18.2, 18.3_

- [x] 2.4.2 Implement modifier management
  - Create modifiers (spice levels and paid add-ons)
  - Associate modifiers with menu items
  - Set modifier prices
  - _Requirements: 18.2, 18.5_

- [x] 2.4.3 Add real-time menu sync listeners
  - Subscribe to menu item changes
  - Subscribe to modifier changes
  - Update UI on remote changes
  - _Requirements: 5.2, 18.4_

- [x] 2.4.4 Write property test for menu sync
  - **Property 17: Out-of-Stock Indicator Display**
  - **Validates: Requirements 5.3**

**Dependencies:** Task 2.1
**Validates:** Requirements 5.1, 5.2, 18.1-18.5

### Task 2.5: Table and Section Management
- [x] 2.5.1 Implement section CRUD operations
  - Create sections with custom names
  - Update section names
  - Delete empty sections
  - _Requirements: 16.1, 16.4_

- [x] 2.5.2 Implement table CRUD operations
  - Create tables with name and section assignment
  - Update table name and section
  - Delete tables with no active orders
  - Display tables grouped by section
  - _Requirements: 16.2, 16.3, 16.4, 16.5, 16.6_

- [x] 2.5.3 Implement table operations3
  - Merge multiple tables into single order
  - Split table order into separate bills
  - Transfer order between tables
  - Preserve waiter attribution during operations
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 2.5.4 Add real-time table status listeners
  - Subscribe to table status changes
  - Update UI when tables change
  - _Requirements: 4.2, 16.7_

- [x] 2.5.5 Write property test for table operations
  - **Property 40: Table Merge Item Preservation**
  - **Validates: Requirements 15.5**

- [x] 2.5.6 Write property test for table-section invariant
  - **Property 41: Table Section Membership Invariant**
  - **Validates: Requirements 16.8**

**Dependencies:** Task 2.1
**Validates:** Requirements 4.1, 4.2, 15.1-15.5, 16.1-16.8

### Task 2.6: Inventory Management with Manager Authentication
- [x] 2.6.1 Implement inventory tracking
  - Create inventory records for bar items
  - Update inventory quantities
  - Query inventory levels
  - _Requirements: 11.1, 11.2_

- [x] 2.6.2 Implement inventory deduction with transactions
  - Deduct bar item inventory on order finalization
  - Skip deduction for kitchen items
  - Use Firestore transactions for atomicity
  - _Requirements: 11.1, 11.2_

- [x] 2.6.3 Implement auto out-of-stock logic
  - Mark bar items out of stock when inventory reaches zero
  - Restore in-stock status when inventory > 0
  - _Requirements: 10.3, 10.4, 11.3_

- [x] 2.6.4 Add manual out-of-stock marking
  - Allow managers to manually mark items out of stock
  - Display out-of-stock dashboard
  - _Requirements: 10.1, 10.2, 10.5_

- [x] 2.6.5 Implement manager-authenticated inventory movements
  - Create "Move Stock to Counter" interface
  - Require manager PIN authentication before movement
  - Log all movements with manager ID and timestamp
  - Add optional reason field
  - _Requirements: 26.1, 26.4, 26.9_

- [x] 2.6.6 Create inventory movement history viewer
  - Display all movements with filters (item, date, manager)
  - Show movement details (quantity, from/to, reason)
  - Export to CSV functionality
  - _Requirements: 26.9_

- [x] 2.6.7 Write property test for inventory deduction
  - **Property 35: Inventory Balance Invariant**
  - **Validates: Requirements 11.4**

- [x] 2.6.8 Write property test for auto out-of-stock
  - **Property 31: Zero Inventory Auto Out-of-Stock**
  - **Validates: Requirements 10.3, 11.3**

**Dependencies:** Task 2.1, Task 2.3
**Validates:** Requirements 10.1-10.5, 11.1-11.4, 26.1, 26.4, 26.9

### Task 2.7: Billing System
- [x] 2.7.1 Implement bill generation
  - Generate bill from completed order
  - Calculate subtotal from order items
  - Support Cash, Card, and UPI payment methods
  - _Requirements: 12.1, 12.2_

- [x] 2.7.2 Implement discount application
  - Apply percentage discounts to bill total
  - Apply fixed amount discounts to bill total
  - Calculate final total after discount
  - _Requirements: 13.1, 13.2, 13.3, 13.5_

- [x] 2.7.3 Implement split payment validation
  - Allow maximum 2 payment methods
  - Validate payment sum equals bill total
  - _Requirements: 12.3, 12.5_

- [x] 2.7.4 Implement pending bills with customer tracking
  - Require customer phone for pending bills
  - Check for existing customer records
  - Display previous order history for returning customers
  - Search pending bills by phone/name
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 2.7.5 Write property test for split payment validation
  - **Property 37: Split Payment Sum Validation**
  - **Validates: Requirements 12.5**

- [x] 2.7.6 Write property test for percentage discount
  - **Property 38: Percentage Discount Calculation**
  - **Validates: Requirements 13.5**

- [x] 2.7.7 Write property test for pending bill phone requirement
  - **Property 39: Pending Bill Phone Requirement**
  - **Validates: Requirements 14.1**

**Dependencies:** Task 2.1
**Validates:** Requirements 12.1-12.5, 13.1-13.5, 14.1-14.5

### Task 2.8: Waiter Performance Reporting
- [x] 2.8.1 Implement waiter sales report queries
  - Query orders by waiter and date range
  - Calculate total sales per waiter
  - Count orders per waiter
  - List table assignments per waiter
  - _Requirements: 17.1, 17.2, 17.3, 17.4_

- [x] 2.8.2 Add report period selection
  - Support daily, weekly, and monthly periods
  - Generate reports for all waiters
  - Display comparative metrics
  - _Requirements: 17.1_

- [x] 2.8.3 Write property test for sales sum invariant
  - **Property 42: Waiter Sales Sum Invariant**
  - **Validates: Requirements 17.5**

**Dependencies:** Task 2.1
**Validates:** Requirements 17.1-17.5

### Task 2.9: Desktop Order Entry
- [x] 2.9.1 Create desktop order entry UI
  - Build table selection interface
  - Add menu item browser with search and categories
  - Display order items list with totals
  - _Requirements: 27.1, 27.2, 27.3_

- [x] 2.9.2 Implement order item management
  - Add menu items to order
  - Apply modifiers (spice levels and paid add-ons)
  - Adjust item quantities
  - Remove items before sending to kitchen
  - Calculate and display order total
  - _Requirements: 27.3, 27.4, 27.8_

- [x] 2.9.3 Implement "Send to Kitchen" functionality
  - Add "Send to Kitchen" button
  - Route order items to KOT Router
  - Associate order with system user (Manager/Counter)
  - Sync order to Firestore
  - _Requirements: 27.4, 27.5, 27.6, 27.7, 27.10_

- [x] 2.9.4 Enforce order modification rules
  - Prevent modification after KOT sent
  - Apply same rules as mobile app
  - _Requirements: 27.9_

- [x] 2.9.5 Write unit tests for desktop order entry
  - Test order creation from desktop
  - Test KOT generation from desktop orders
  - Test sync to Firestore
  - _Requirements: 27.1-27.10_

**Dependencies:** Task 2.1, Task 4.1
**Validates:** Requirements 27.1-27.10

## Phase 3: Mobile Application Development

### Task 3.1: React Native Project Setup
- [x] 3.1.1 Initialize React Native project with Expo
  - Create new Expo project
  - Configure TypeScript
  - Set up folder structure (screens, components, services, hooks)
  - _Requirements: N/A_

- [x] 3.1.2 Install required dependencies
  - Install Firebase SDK (@react-native-firebase or firebase)
  - Install SQLite (expo-sqlite)
  - Install React Navigation
  - Install NetInfo for network monitoring
  - _Requirements: 2.1, 3.1_

- [x] 3.1.3 Configure Firebase for mobile
  - Add Firebase configuration
  - Initialize Firebase app
  - Enable Firestore offline persistence
  - _Requirements: 2.1_

- [x] 3.1.4 Configure Android build settings
  - Set up app permissions (network, storage)
  - Configure app icons and splash screen
  - Set minimum SDK version
  - _Requirements: N/A_

**Dependencies:** Task 1.1
**Validates:** Requirements 2.1

### Task 3.2: Local SQLite Database Setup
- [x] 3.2.1 Create SQLite database schema
  - Mirror Firestore collections in SQLite
  - Create sync_queue table for pending changes
  - Create device_info table
  - _Requirements: 3.1, 3.4_

- [x] 3.2.2 Implement database helper functions
  - Create insert, update, delete, query functions
  - Add transaction support
  - Implement upsert functionality
  - _Requirements: 3.1, 3.4_

- [x] 3.2.3 Write unit tests for database operations
  - Test CRUD operations
  - Test transaction rollback
  - _Requirements: 3.1, 3.4_

**Dependencies:** Task 3.1
**Validates:** Requirements 3.1, 3.4

### Task 3.3: Firebase Sync Engine (Mobile)
- [x] 3.3.1 Implement FirestoreSyncEngine class
  - Set up Firestore offline persistence
  - Create collection subscription methods
  - Implement sync status tracking
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 3.3.2 Implement real-time listeners
  - Subscribe to orders collection
  - Subscribe to menuItems collection
  - Subscribe to tables collection
  - Subscribe to modifiers collection
  - Update local SQLite mirror on changes
  - _Requirements: 2.2, 5.2_

- [x] 3.3.3 Implement network status monitoring
  - Use NetInfo to detect connectivity changes
  - Show online/offline notifications
  - Update sync status indicator
  - _Requirements: 2.6, 3.3_

- [x] 3.3.4 Implement offline write queueing
  - Queue writes when offline
  - Firestore SDK handles automatic retry
  - Monitor pending write count
  - _Requirements: 3.1, 3.3_

- [x] 3.3.5 Write property test for offline sync completeness
  - **Property 6: Offline Sync Completeness**
  - **Validates: Requirements 2.3, 3.3**

- [x] 3.3.6 Write property test for conflict resolution
  - **Property 7: Last-Write-Wins Conflict Resolution**
  - **Validates: Requirements 2.5**

**Dependencies:** Task 3.1, Task 3.2, Task 1.2
**Validates:** Requirements 2.1-2.6, 3.1-3.5

### Task 3.4: Authentication Screen
- [x] 3.4.1 Create PIN entry UI
  - Build numeric keypad
  - Add PIN display with masked digits
  - Add login button
  - Style for mobile UX
  - _Requirements: 1.1_

- [x] 3.4.2 Implement PIN validation and authentication
  - Validate PIN format (4-6 digits)
  - Query Firestore for matching waiter
  - Generate custom token (server-side function)
  - Sign in with custom token
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3.4.3 Implement session persistence
  - Store waiterId and waiterName in AsyncStorage
  - Auto-login on app restart if session exists
  - Add logout functionality
  - _Requirements: 1.4_

- [x] 3.4.4 Write property test for PIN format validation
  - **Property 1: PIN Format Validation**
  - **Validates: Requirements 1.1**

- [x] 3.4.5 Write property test for authentication success
  - **Property 2: Valid PIN Authentication Success**
  - **Validates: Requirements 1.2**

- [x] 3.4.6 Write property test for authentication failure
  - **Property 3: Invalid PIN Authentication Failure**
  - **Validates: Requirements 1.3**

**Dependencies:** Task 3.1, Task 1.3
**Validates:** Requirements 1.1-1.5

### Task 3.5: Table Selection Screen
- [x] 3.5.1 Create table grid UI
  - Display tables in grid layout
  - Show table name and status
  - Add section filter dropdown
  - Style table cards with status colors
  - _Requirements: 4.1, 4.2_

- [x] 3.5.2 Implement table status indicators
  - Show available (green), occupied (yellow), pending_bill (red)
  - Update colors based on table status
  - _Requirements: 4.2_

- [x] 3.5.3 Implement real-time table updates
  - Subscribe to tables collection changes
  - Update UI when table status changes
  - _Requirements: 4.2_

- [x] 3.5.4 Add table selection navigation
  - Navigate to order entry on table tap
  - Load existing order if table is occupied
  - _Requirements: 4.3, 4.5_

- [x] 3.5.5 Write property test for complete table display
  - **Property 13: Complete Table Display**
  - **Validates: Requirements 4.1**

- [x] 3.5.6 Write property test for table status validity
  - **Property 14: Table Status Validity**
  - **Validates: Requirements 4.2**

**Dependencies:** Task 3.3, Task 3.4
**Validates:** Requirements 4.1-4.5

### Task 3.6: Menu Browser Component
- [x] 3.6.1 Create menu item list UI
  - Display menu items in scrollable list
  - Show item name, price, and category
  - Add category filter tabs
  - _Requirements: 5.1_

- [x] 3.6.2 Implement search functionality
  - Add search bar
  - Filter items by name (case-insensitive)
  - Update list in real-time as user types
  - _Requirements: 5.5_

- [x] 3.6.3 Display out-of-stock indicators
  - Show red marker for out-of-stock items
  - Disable selection of out-of-stock items
  - _Requirements: 5.3_

- [x] 3.6.4 Implement real-time menu updates
  - Subscribe to menuItems collection
  - Update UI when items change
  - Update prices and out-of-stock status
  - _Requirements: 5.2, 5.4_

- [x] 3.6.5 Write property test for menu search accuracy
  - **Property 18: Menu Search Accuracy**
  - **Validates: Requirements 5.5**

**Dependencies:** Task 3.3
**Validates:** Requirements 5.1-5.5

### Task 3.7: Order Entry Screen
- [x] 3.7.1 Create order item list UI
  - Display order items with quantities
  - Show item prices and modifiers
  - Display order total at bottom
  - Add "Send to Kitchen" button
  - _Requirements: 6.1_

- [x] 3.7.2 Implement add item functionality
  - Add selected menu item to order
  - Show modifier selection dialog
  - Support spice level selection (free)
  - Support paid add-on selection
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 3.7.3 Implement quantity adjustment
  - Add +/- buttons for quantity
  - Update item total on quantity change
  - _Requirements: 6.5_

- [x] 3.7.4 Implement item removal
  - Add delete button for items
  - Only allow removal before sending to kitchen
  - _Requirements: 9.3, 9.4_

- [x] 3.7.5 Implement order total calculation
  - Calculate item totals (base price + paid add-ons)
  - Sum all item totals for order total
  - Update total in real-time
  - _Requirements: 6.6_

- [x] 3.7.6 Implement order submission
  - Save order to Firestore
  - Mark items as sent to kitchen
  - Trigger KOT generation (desktop handles printing)
  - Associate order with authenticated waiter
  - _Requirements: 1.5, 9.1_

- [x] 3.7.7 Write property test for free spice modifiers
  - **Property 20: Free Spice Level Modifiers**
  - **Validates: Requirements 6.2**

- [x] 3.7.8 Write property test for price calculation
  - **Property 21: Order Item Price Calculation Invariant**
  - **Validates: Requirements 6.6**

- [x] 3.7.9 Write property test for sent item immutability
  - **Property 29: Sent Item Immutability**
  - **Validates: Requirements 9.3, 9.4**

**Dependencies:** Task 3.5, Task 3.6
**Validates:** Requirements 6.1-6.6, 9.1, 9.3, 9.4

### Task 3.8: Offline Functionality and Testing
- [x] 3.8.1 Test offline order creation
  - Disable network
  - Create orders
  - Verify local storage
  - _Requirements: 3.1, 3.2_

- [x] 3.8.2 Test sync queue population
  - Verify pending changes tracked
  - Check sync_queue table
  - _Requirements: 3.3, 3.4_

- [x] 3.8.3 Test automatic sync on reconnection
  - Re-enable network
  - Verify automatic upload
  - Check sync completion notification
  - _Requirements: 3.3_

- [x] 3.8.4 Add offline indicator UI
  - Show offline banner when disconnected
  - Show syncing indicator during sync
  - Show connected status when online
  - _Requirements: 2.6_

- [x] 3.8.5 Write property test for offline order storage
  - **Property 9: Offline Order Storage**
  - **Validates: Requirements 3.1**

- [x] 3.8.6 Write property test for offline functionality preservation
  - **Property 10: Offline Functionality Preservation**
  - **Validates: Requirements 3.2**

- [x] 3.8.7 Write property test for round-trip integrity
  - **Property 12: Offline Order Round-Trip Integrity**
  - **Validates: Requirements 3.5**

**Dependencies:** Task 3.3, Task 3.7
**Validates:** Requirements 2.6, 3.1-3.5

### Task 3.9: Mobile Table Operations
- [x] 3.9.1 Implement table merge on mobile
  - Add "Merge Tables" button
  - Allow selection of multiple tables
  - Combine orders while preserving waiter attribution
  - _Requirements: 15.4, 15.5_

- [x] 3.9.2 Implement table split on mobile
  - Add "Split Table" button
  - Allow item selection for each split
  - Create separate orders
  - _Requirements: 15.4_

- [x] 3.9.3 Implement table transfer on mobile
  - Add "Transfer Table" button
  - Allow destination table selection
  - Move order to new table
  - _Requirements: 15.4_

- [x] 3.9.4 Write unit tests for mobile table operations
  - Test merge, split, transfer
  - Verify data integrity
  - _Requirements: 15.4, 15.5_

**Dependencies:** Task 3.5, Task 3.7
**Validates:** Requirements 15.4, 15.5, 15.6

## Phase 4: KOT Printing Integration

### Task 4.1: KOT Router Implementation
- [x] 4.1.1 Create KOTRouter class
  - Implement category-based routing logic
  - Separate food items (kitchen) from drink items (bar)
  - Handle mixed orders with split routing
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 4.1.2 Implement KOT generation
  - Generate KOT with metadata (order number, table, waiter, timestamp)
  - Format items with quantities and modifiers
  - Add incremental indicators for quantity increases
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 4.1.3 Implement incremental KOT logic
  - Detect new items vs quantity increases
  - Generate KOTs with only new/incremental items
  - Mark items with "+" prefix for increments
  - _Requirements: 9.1, 9.2_

- [x] 4.1.4 Store KOT records in Firestore
  - Save KOT details to kots collection
  - Link KOT to order
  - Track print status
  - _Requirements: 8.7_

- [x] 4.1.5 Write property test for food item routing
  - **Property 22: Food Item Kitchen Routing**
  - **Validates: Requirements 7.2**

- [x] 4.1.6 Write property test for drink item routing
  - **Property 23: Drink Item Bar Routing**
  - **Validates: Requirements 7.3**

- [x] 4.1.7 Write property test for mixed order routing
  - **Property 24: Mixed Order Split Routing**
  - **Validates: Requirements 7.4**

- [x] 4.1.8 Write property test for KOT completeness
  - **Property 26: KOT Completeness**
  - **Validates: Requirements 8.3, 8.4, 8.7**

- [x] 4.1.9 Write property test for KOT metadata
  - **Property 27: KOT Required Metadata**
  - **Validates: Requirements 8.1, 8.2, 8.5, 8.6**

- [x] 4.1.10 Write property test for incremental KOT content
  - **Property 28: Incremental KOT Content**
  - **Validates: Requirements 9.1, 9.2**

- [x] 4.1.11 Write property test for KOT quantity sum
  - **Property 30: KOT Quantity Sum Invariant**
  - **Validates: Requirements 9.5**

**Dependencies:** Task 2.1
**Validates:** Requirements 7.1-7.5, 8.1-8.7, 9.1, 9.2, 9.5

### Task 4.2: Thermal Printer Driver
- [x] 4.2.1 Implement ESC/POS command generation
  - Create ESCPOSFormatter class
  - Generate printer initialization commands
  - Format text (bold, size, alignment)
  - Add paper cut command
  - _Requirements: 7.1_

- [x] 4.2.2 Implement printer connection management
  - Connect to network printers via IP/port
  - Handle connection errors
  - Implement connection pooling
  - _Requirements: 7.1_

- [x] 4.2.3 Add printer status checking
  - Query printer status (online/offline/error)
  - Detect paper out, cover open
  - _Requirements: 23.4_

- [x] 4.2.4 Implement print retry logic
  - Retry failed prints with exponential backoff
  - Store failed KOTs for manual retry
  - _Requirements: 22.4_

- [ ] 4.2.5 Test with actual thermal printers
  - Test kitchen printer connectivity
  - Test bar printer connectivity
  - Verify print quality and formatting
  - _Requirements: 7.1_

- [x] 4.2.6 Write unit tests for printer driver
  - Test ESC/POS command generation
  - Test connection handling
  - Test error scenarios
  - _Requirements: 7.1, 23.4_

**Dependencies:** Task 4.1
**Validates:** Requirements 7.1, 22.4, 23.4

### Task 4.3: Failed KOT Management
- [x] 4.3.1 Create failed KOT storage
  - Store failed KOTs in local database
  - Track retry count and error message
  - _Requirements: 23.4_

- [x] 4.3.2 Implement manual retry UI
  - Display list of failed KOTs
  - Add "Retry" button for each KOT
  - Show retry status
  - _Requirements: 23.4_

- [x] 4.3.3 Implement automatic retry on printer reconnection
  - Monitor printer status changes
  - Auto-retry failed KOTs when printer comes online
  - _Requirements: 22.4_

- [x] 4.3.4 Write unit tests for failed KOT handling
  - Test storage and retrieval
  - Test retry logic
  - Test automatic retry
  - _Requirements: 22.4, 23.4_

**Dependencies:** Task 4.2
**Validates:** Requirements 22.4, 23.4

### Task 4.4: Configuration Parser
- [x] 4.4.1 Implement configuration parser
  - Parse printer configuration files
  - Validate configuration structure
  - Return descriptive errors for invalid config
  - _Requirements: 19.1, 19.2_

- [x] 4.4.2 Implement configuration printer
  - Format Configuration objects to string
  - Maintain consistent formatting
  - _Requirements: 19.3_

- [x] 4.4.3 Write property test for config round-trip
  - **Property 43: Configuration Round-Trip Integrity**
  - **Validates: Requirements 19.4**

**Dependencies:** Task 2.1
**Validates:** Requirements 19.1-19.4

## Phase 5: Data Validation and Serialization

### Task 5.1: Order Data Serialization
- [ ] 5.1.1 Implement OrderSerializer
  - Serialize Order objects to JSON
  - Include all items, modifiers, waiter info, timestamps
  - Handle serialization errors
  - _Requirements: 20.1, 20.3, 20.4_

- [ ] 5.1.2 Implement OrderDeserializer
  - Deserialize JSON to Order objects
  - Validate structure during deserialization
  - Handle deserialization errors
  - _Requirements: 20.2, 20.4_

- [ ] 5.1.3 Write property test for order serialization round-trip
  - **Property 44: Order Serialization Round-Trip Integrity**
  - **Validates: Requirements 20.5**

**Dependencies:** Task 2.1
**Validates:** Requirements 20.1-20.5

### Task 5.2: Data Validation
- [ ] 5.2.1 Implement order validation
  - Validate at least one item exists
  - Validate positive quantities
  - Validate valid modifiers for items
  - Validate non-negative total
  - _Requirements: 24.1, 24.2, 24.3, 24.4_

- [ ] 5.2.2 Implement bill validation
  - Validate payment sum equals total
  - Validate max 2 payment methods
  - Validate pending bills have customer phone
  - _Requirements: 12.3, 12.5, 14.1_

- [ ] 5.2.3 Write property test for empty order rejection
  - **Property 48: Empty Order Rejection**
  - **Validates: Requirements 24.1**

- [ ] 5.2.4 Write property test for positive quantity
  - **Property 49: Positive Quantity Validation**
  - **Validates: Requirements 24.2**

- [ ] 5.2.5 Write property test for order total calculation
  - **Property 50: Order Total Calculation Invariant**
  - **Validates: Requirements 24.5**

- [ ] 5.2.6 Write property test for split payment method limit
  - **Property 36: Split Payment Method Limit**
  - **Validates: Requirements 12.3**

**Dependencies:** Task 2.1
**Validates:** Requirements 12.3, 12.5, 14.1, 24.1-24.5

### Task 5.3: Idempotency Implementation
- [ ] 5.3.1 Implement order ID generation
  - Generate unique IDs based on device and timestamp
  - Use deterministic ID generation
  - _Requirements: 25.2_

- [ ] 5.3.2 Implement idempotent order submission
  - Use setDoc with generated ID
  - Ensure multiple submissions create single record
  - Use same ID for retries
  - _Requirements: 25.1, 25.3, 25.4_

- [ ] 5.3.3 Write property test for order submission idempotence
  - **Property 51: Order Submission Idempotence**
  - **Validates: Requirements 25.1, 25.4**

- [ ] 5.3.4 Write property test for unique order IDs
  - **Property 52: Unique Order ID Generation**
  - **Validates: Requirements 25.2**

- [ ] 5.3.5 Write property test for retry ID consistency
  - **Property 53: Retry ID Consistency**
  - **Validates: Requirements 25.3**

**Dependencies:** Task 2.1, Task 3.3
**Validates:** Requirements 25.1-25.4

## Phase 6: Comprehensive Testing

### Task 6.1: Unit Test Suite
- [ ] 6.1.1 Write authentication unit tests
  - Test PIN validation
  - Test login success/failure
  - Test session persistence
  - Test logout
  - _Requirements: 1.1-1.5_

- [ ] 6.1.2 Write order management unit tests
  - Test order creation
  - Test item addition
  - Test modifier application
  - Test total calculation
  - Test order submission
  - _Requirements: 6.1-6.6_

- [ ] 6.1.3 Write KOT routing unit tests
  - Test food routing
  - Test drink routing
  - Test mixed order splitting
  - Test incremental KOTs
  - _Requirements: 7.1-7.5, 9.1-9.5_

- [ ] 6.1.4 Write billing unit tests
  - Test bill generation
  - Test discount application
  - Test split payment
  - Test pending bills
  - _Requirements: 12.1-12.5, 13.1-13.5, 14.1-14.5_

- [ ] 6.1.5 Write inventory unit tests
  - Test inventory deduction
  - Test auto out-of-stock
  - Test manager authentication
  - Test inventory movements
  - _Requirements: 10.1-10.5, 11.1-11.4, 26.1-26.9_

- [ ] 6.1.6 Achieve 80% code coverage
  - Run coverage reports
  - Add tests for uncovered code
  - _Requirements: All_

**Dependencies:** All implementation tasks
**Validates:** All requirements

### Task 6.2: Property-Based Test Suite
- [ ] 6.2.1 Configure fast-check for TypeScript
  - Install fast-check
  - Set up test configuration
  - Configure 100 iterations per property
  - _Requirements: All_

- [ ] 6.2.2 Implement all 53 correctness properties
  - Create property test for each design property
  - Tag each test with property number
  - Use appropriate arbitraries for input generation
  - _Requirements: All_

- [ ] 6.2.3 Run property test suite
  - Execute all property tests
  - Verify all properties pass
  - Fix any failing properties
  - _Requirements: All_

**Dependencies:** Task 6.1
**Validates:** All requirements

### Task 6.3: Integration Tests
- [ ] 6.3.1 Test end-to-end order flow
  - Waiter login → table selection → order entry → KOT print → billing
  - Verify data flow through all components
  - _Requirements: 1.1-1.5, 4.1-4.5, 6.1-6.6, 7.1-7.5, 12.1-12.5_

- [ ] 6.3.2 Test offline-to-online workflow
  - Create orders offline → reconnect → verify sync → verify KOT print
  - _Requirements: 2.1-2.6, 3.1-3.5_

- [ ] 6.3.3 Test table operations workflow
  - Create tables → merge → split → transfer → verify integrity
  - _Requirements: 15.1-15.6, 16.1-16.8_

- [ ] 6.3.4 Test multi-device synchronization
  - Create orders on multiple devices
  - Verify real-time updates
  - Test conflict resolution
  - _Requirements: 2.1-2.6, 21.1-21.5_

- [ ] 6.3.5 Test desktop order entry integration
  - Create order from desktop → verify KOT print → verify mobile visibility
  - _Requirements: 27.1-27.10_

**Dependencies:** Task 6.1, Task 6.2
**Validates:** All requirements

### Task 6.4: Load and Performance Testing
- [ ] 6.4.1 Test with 20-30 concurrent devices
  - Simulate 20-30 mobile devices
  - Create orders simultaneously
  - Verify no data loss
  - _Requirements: 2.4, 21.1, 21.2_

- [ ] 6.4.2 Verify sync performance
  - Measure sync time for typical orders
  - Ensure sync completes within 2 seconds
  - _Requirements: 2.1, 2.2, 21.4_

- [ ] 6.4.3 Test KOT generation performance
  - Measure KOT generation time
  - Ensure completion within 1 second
  - _Requirements: 7.1_

- [ ] 6.4.4 Test Firebase free tier limits
  - Monitor read/write counts
  - Verify staying within free tier
  - _Requirements: 2.1_

**Dependencies:** Task 6.3
**Validates:** Requirements 2.1, 2.2, 2.4, 7.1, 21.1, 21.2, 21.4

## Phase 7: Deployment and Documentation

### Task 7.1: Mobile App Build and Distribution
- [ ] 7.1.1 Configure Android build settings
  - Set app version and build number
  - Configure signing keys
  - Set minimum SDK version (API 21+)
  - _Requirements: N/A_

- [ ] 7.1.2 Generate signed APK
  - Build release APK with Expo
  - Test APK installation on devices
  - Verify all features work in release build
  - _Requirements: N/A_

- [ ] 7.1.3 Create app distribution method
  - Set up internal distribution (Firebase App Distribution or similar)
  - Document installation process for waiters
  - _Requirements: N/A_

**Dependencies:** All Phase 3 tasks
**Validates:** N/A

### Task 7.2: Desktop App Packaging
- [ ] 7.2.1 Update Electron app with all Firebase integrations
  - Verify all desktop features work
  - Test with mobile devices
  - _Requirements: All desktop requirements_

- [ ] 7.2.2 Test printer connectivity
  - Verify kitchen printer connection
  - Verify bar printer connection
  - Test KOT printing end-to-end
  - _Requirements: 7.1, 23.4_

- [ ] 7.2.3 Create desktop app installer
  - Build Windows/Mac/Linux installers
  - Test installation process
  - _Requirements: N/A_

**Dependencies:** All Phase 2 and Phase 4 tasks
**Validates:** All desktop requirements

### Task 7.3: Configuration and Setup Documentation
- [ ] 7.3.1 Document Firebase project setup
  - Firebase Console configuration steps
  - Security rules deployment
  - API key management
  - _Requirements: 2.1_

- [ ] 7.3.2 Document printer configuration
  - Network printer setup
  - IP address configuration
  - ESC/POS settings
  - Troubleshooting guide
  - _Requirements: 19.1-19.4_

- [ ] 7.3.3 Create waiter onboarding guide
  - Mobile app installation
  - PIN login instructions
  - Order taking workflow
  - Offline mode explanation
  - _Requirements: 1.1-1.5, 3.1-3.5_

- [ ] 7.3.4 Create manager training guide
  - Desktop app features
  - Waiter PIN management
  - Manager PIN setup
  - Menu management
  - Inventory operations
  - Table management
  - Billing and reporting
  - _Requirements: All desktop requirements_

- [ ] 7.3.5 Document troubleshooting procedures
  - Network connectivity issues
  - Printer offline handling
  - Sync failures
  - Database errors
  - _Requirements: 22.1-22.5, 23.1-23.5_

**Dependencies:** Task 7.1, Task 7.2
**Validates:** All requirements

### Task 7.4: Data Migration (If Applicable)
- [ ] 7.4.1 Create data migration scripts
  - Script to migrate menu items from existing system
  - Script to migrate tables and sections
  - Script to create initial waiter accounts
  - _Requirements: N/A_

- [ ] 7.4.2 Execute data migration
  - Migrate menu items to Firestore
  - Migrate tables and sections
  - Create waiter accounts with PINs
  - _Requirements: N/A_

- [ ] 7.4.3 Verify data integrity
  - Verify all menu items migrated correctly
  - Verify all tables and sections exist
  - Test waiter login with migrated PINs
  - _Requirements: N/A_

**Dependencies:** Task 1.2
**Validates:** Requirements 2.4

## Summary

### Implementation Status

**Phase 1: Firebase Infrastructure Setup** ✅ COMPLETE
- Firebase project configured
- Firestore schema created
- Authentication setup complete

**Phase 2: Desktop Application Core Integration** 🔄 IN PROGRESS
- 9 major task groups covering all desktop features
- Includes waiter PIN management, manager authentication, menu/table/inventory management, billing, reporting, and desktop order entry

**Phase 3: Mobile Application Development** ⏳ PENDING
- 9 major task groups covering mobile app
- Includes React Native setup, sync engine, authentication, table selection, menu browsing, order entry, offline functionality, and table operations

**Phase 4: KOT Printing Integration** ⏳ PENDING
- 4 major task groups for printing
- Includes KOT router, thermal printer driver, failed KOT management, and configuration parser

**Phase 5: Data Validation and Serialization** ⏳ PENDING
- 3 major task groups for data handling
- Includes order serialization, validation, and idempotency

**Phase 6: Comprehensive Testing** ⏳ PENDING
- 4 major task groups for testing
- Includes unit tests, property-based tests (53 properties), integration tests, and load testing

**Phase 7: Deployment and Documentation** ⏳ PENDING
- 4 major task groups for deployment
- Includes mobile/desktop builds, documentation, and data migration

### Key Metrics

**Total Tasks:** 100+ individual tasks across 7 phases
**Property-Based Tests:** 53 correctness properties to implement
**Requirements Coverage:** All 27 requirements with 200+ acceptance criteria
**Code Coverage Target:** 80%

### Critical Path

1. **Phase 2:** Desktop application integration (enables KOT printing and management)
2. **Phase 3:** Mobile application development (enables waiter order taking)
3. **Phase 4:** KOT printing (connects orders to kitchen/bar)
4. **Phase 6:** Testing (validates correctness)
5. **Phase 7:** Deployment (delivers to users)

### Parallel Work Opportunities

- Phase 2 (Desktop) and Phase 3 (Mobile) can be developed in parallel
- Unit tests can be written alongside implementation
- Documentation can be created during development
- Property tests can be implemented as features are completed

### Risk Mitigation

- Firebase infrastructure already complete (Phase 1 ✅)
- Offline functionality tested early (Task 3.8)
- Printer integration validated with actual hardware (Task 4.2.5)
- Load testing ensures scalability (Task 6.4)
- Comprehensive property testing validates correctness (Task 6.2)

### Next Steps

1. Begin Phase 2: Desktop Application Core Integration
2. Start with Task 2.1: Firebase SDK Integration (Desktop)
3. Implement waiter PIN management (Task 2.2)
4. Set up manager authentication (Task 2.3)
5. Continue through remaining Phase 2 tasks

### Notes

- Tasks marked with `*` are optional property-based tests
- Each task references specific requirements for traceability
- Property tests include property number and validation mapping
- All tasks build incrementally on previous work
- No orphaned or hanging code - everything integrates
