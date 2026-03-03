# Implementation Tasks: WaiterFlow Mobile Ordering System

## Phase 1: Firebase Infrastructure Setup

### Task 1.1: Firebase Project Configuration
- [ ] Create Firebase project in Firebase Console
- [ ] Enable Firestore Database
- [ ] Enable Firebase Authentication
- [ ] Configure Firebase security rules for Firestore
- [ ] Set up Firebase project for web and mobile platforms
- [ ] Generate and store API keys securely

**Estimated Time:** 2 hours
**Dependencies:** None
**Validates:** Requirements 2.1, 2.2

### Task 1.2: Firestore Database Schema Setup
- [ ] Create Firestore collections: waiters, sections, tables, menuCategories, menuItems, modifiers, inventory, orders, bills, customers, syncMetadata
- [ ] Set up composite indexes for queries (tableId, waiterId, status, etc.)
- [ ] Create subcollection structure for order items
- [ ] Configure Firestore security rules
- [ ] Test security rules with Firebase emulator

**Estimated Time:** 3 hours
**Dependencies:** Task 1.1
**Validates:** Requirements 2.4, 4.1, 5.1

### Task 1.3: Firebase Authentication Setup
- [ ] Enable custom token authentication
- [ ] Create Cloud Function for custom token generation
- [ ] Implement PIN-based authentication flow
- [ ] Set up authentication state persistence
- [ ] Test authentication with test waiters

**Estimated Time:** 3 hours
**Dependencies:** Task 1.1
**Validates:** Requirements 1.1, 1.2, 1.3, 1.4

## Phase 2: Desktop Application Integration

### Task 2.1: Firebase SDK Integration (Desktop)
- [ ] Install Firebase SDK in Electron app
- [ ] Configure Firebase initialization
- [ ] Enable Firestore offline persistence
- [ ] Set up Firebase Admin SDK for privileged operations
- [ ] Test connection to Firestore

**Estimated Time:** 2 hours
**Dependencies:** Task 1.1
**Validates:** Requirements 2.1

### Task 2.2: Menu Management with Firebase
- [ ] Update menu management to use Firestore
- [ ] Implement CRUD operations for menu items
- [ ] Implement CRUD operations for modifiers
- [ ] Add real-time menu sync listeners
- [ ] Test menu updates propagate to mobile

**Estimated Time:** 4 hours
**Dependencies:** Task 2.1, Task 1.2
**Validates:** Requirements 5.1, 5.2, 6.2

### Task 2.3: Table Management with Firebase
- [ ] Update table management to use Firestore
- [ ] Implement section CRUD operations
- [ ] Implement table CRUD operations
- [ ] Add table status real-time listeners
- [ ] Implement table merge functionality
- [ ] Implement table split functionality
- [ ] Implement table transfer functionality

**Estimated Time:** 5 hours
**Dependencies:** Task 2.1, Task 1.2
**Validates:** Requirements 4.1, 4.2, 15.1, 15.2, 15.3, 16.1-16.8

### Task 2.4: Inventory Management with Firebase
- [ ] Update inventory tracking to use Firestore
- [ ] Implement inventory deduction with transactions
- [ ] Implement auto out-of-stock logic for bar items
- [ ] Add manual out-of-stock marking for kitchen items
- [ ] Create inventory sync listeners

**Estimated Time:** 4 hours
**Dependencies:** Task 2.1, Task 1.2
**Validates:** Requirements 10.1-10.4, 11.1-11.4

### Task 2.4a: Manager Authentication for Inventory Operations
- [ ] Create managers collection in Firestore
- [ ] Implement manager PIN authentication with bcrypt hashing
- [ ] Add PIN prompt dialog for inventory movements
- [ ] Implement 3-attempt lockout with 5-minute timeout
- [ ] Create inventory movement audit log
- [ ] Add inventory movement history viewer
- [ ] Implement manager account management UI
- [ ] Add "Change My PIN" functionality
- [ ] Test lockout and audit trail

**Estimated Time:** 6 hours
**Dependencies:** Task 2.4, Task 1.2
**Validates:** Requirements 26.1-26.9

### Task 2.5: Billing System with Firebase
- [ ] Update billing to use Firestore
- [ ] Implement bill generation from orders
- [ ] Implement discount application (percentage and fixed)
- [ ] Implement split payment validation (max 2 methods)
- [ ] Implement pending bill with customer phone requirement
- [ ] Add bill history queries

**Estimated Time:** 5 hours
**Dependencies:** Task 2.1, Task 1.2
**Validates:** Requirements 12.1-12.5, 13.1-13.5, 14.1-14.3

### Task 2.6: Reporting with Firebase
- [ ] Implement waiter sales report queries
- [ ] Add daily/weekly/monthly report generation
- [ ] Create report aggregation logic
- [ ] Test report accuracy

**Estimated Time:** 3 hours
**Dependencies:** Task 2.1, Task 1.2
**Validates:** Requirements 17.1-17.5

### Task 2.7: Desktop Order Entry
- [ ] Create desktop order entry UI component
- [ ] Implement table selection for desktop orders
- [ ] Add menu item browser with search
- [ ] Implement add/remove items functionality
- [ ] Add modifier selection interface
- [ ] Display order total calculation
- [ ] Implement "Send to Kitchen" button
- [ ] Integrate with KOT Router
- [ ] Associate orders with "Manager" or "Counter" user
- [ ] Sync desktop orders to Firestore
- [ ] Test order creation and KOT printing from desktop

**Estimated Time:** 6 hours
**Dependencies:** Task 2.1, Task 4.1
**Validates:** Requirements 27.1-27.10

## Phase 3: Mobile Application Development

### Task 3.1: React Native Project Setup
- [ ] Initialize React Native project with Expo
- [ ] Install required dependencies (Firebase, SQLite, Navigation)
- [ ] Configure Firebase for mobile
- [ ] Set up project structure and navigation
- [ ] Configure build settings for Android

**Estimated Time:** 3 hours
**Dependencies:** Task 1.1
**Validates:** Requirements 18.1

### Task 3.2: Local SQLite Database Setup
- [ ] Create SQLite database schema (mirror of Firestore)
- [ ] Implement database initialization
- [ ] Create sync queue table
- [ ] Implement database helper functions
- [ ] Test database operations

**Estimated Time:** 3 hours
**Dependencies:** Task 3.1
**Validates:** Requirements 3.1, 3.4

### Task 3.3: Firebase Sync Engine (Mobile)
- [ ] Implement FirestoreSyncEngine class
- [ ] Set up Firestore offline persistence
- [ ] Implement real-time listeners for collections
- [ ] Implement local SQLite mirror sync
- [ ] Add network status monitoring
- [ ] Test offline write queueing
- [ ] Test automatic sync on reconnection

**Estimated Time:** 6 hours
**Dependencies:** Task 3.1, Task 3.2, Task 1.2
**Validates:** Requirements 2.1-2.6, 3.1-3.5

### Task 3.4: Authentication Screen
- [ ] Create PIN entry UI
- [ ] Implement PIN format validation (4-6 digits)
- [ ] Implement Firebase authentication with custom token
- [ ] Add session persistence
- [ ] Add logout functionality
- [ ] Test authentication flow

**Estimated Time:** 4 hours
**Dependencies:** Task 3.1, Task 1.3
**Validates:** Requirements 1.1-1.5

### Task 3.5: Table Selection Screen
- [ ] Create table grid UI
- [ ] Implement section filtering
- [ ] Add table status indicators (available, occupied, pending_bill)
- [ ] Implement real-time table status updates
- [ ] Add table selection navigation
- [ ] Test with multiple tables

**Estimated Time:** 4 hours
**Dependencies:** Task 3.3, Task 3.4
**Validates:** Requirements 4.1-4.5

### Task 3.6: Menu Browser Component
- [ ] Create menu item list UI
- [ ] Implement category filtering
- [ ] Add search functionality
- [ ] Display out-of-stock indicators (red marker)
- [ ] Implement real-time menu updates
- [ ] Test menu browsing performance

**Estimated Time:** 5 hours
**Dependencies:** Task 3.3
**Validates:** Requirements 5.1-5.5

### Task 3.7: Order Entry Screen
- [ ] Create order item list UI
- [ ] Implement add item functionality
- [ ] Add modifier selection (spice levels, paid add-ons)
- [ ] Implement quantity adjustment
- [ ] Add item removal
- [ ] Display order total calculation
- [ ] Implement order submission
- [ ] Test order creation flow

**Estimated Time:** 6 hours
**Dependencies:** Task 3.5, Task 3.6
**Validates:** Requirements 6.1-6.6

### Task 3.8: Offline Functionality
- [ ] Test order creation while offline
- [ ] Verify local storage of offline orders
- [ ] Test sync queue population
- [ ] Test automatic sync on reconnection
- [ ] Add offline indicator UI
- [ ] Test conflict resolution

**Estimated Time:** 4 hours
**Dependencies:** Task 3.3, Task 3.7
**Validates:** Requirements 3.1-3.5

## Phase 4: KOT Printing Integration

### Task 4.1: KOT Router Implementation
- [ ] Create KOTRouter class
- [ ] Implement category-based routing logic (food → kitchen, drink → bar)
- [ ] Add KOT generation with metadata
- [ ] Implement incremental KOT logic
- [ ] Add KOT record storage in Firestore
- [ ] Test routing with mixed orders

**Estimated Time:** 5 hours
**Dependencies:** Task 2.1
**Validates:** Requirements 7.1-7.5, 8.1-8.7

### Task 4.2: Thermal Printer Driver
- [ ] Implement ESC/POS command generation
- [ ] Create printer connection management
- [ ] Add printer status checking
- [ ] Implement print retry logic
- [ ] Test with actual thermal printers
- [ ] Handle printer offline scenarios

**Estimated Time:** 6 hours
**Dependencies:** Task 4.1
**Validates:** Requirements 19.1-19.5

### Task 4.3: Incremental KOT Handling
- [ ] Implement order modification detection
- [ ] Add quantity increase detection
- [ ] Generate incremental KOTs with "+" prefix
- [ ] Test with multiple order modifications
- [ ] Verify kitchen receives only new items

**Estimated Time:** 3 hours
**Dependencies:** Task 4.1
**Validates:** Requirements 9.1-9.5

### Task 4.4: Failed KOT Management
- [ ] Create failed KOT storage
- [ ] Implement manual retry UI
- [ ] Add failed KOT list view
- [ ] Implement automatic retry on printer reconnection
- [ ] Test error recovery

**Estimated Time:** 3 hours
**Dependencies:** Task 4.2
**Validates:** Requirements 22.1-22.5

## Phase 5: Testing and Validation

### Task 5.1: Unit Tests
- [ ] Write authentication tests
- [ ] Write order management tests
- [ ] Write KOT routing tests
- [ ] Write billing tests
- [ ] Write inventory tests
- [ ] Achieve 80% code coverage

**Estimated Time:** 8 hours
**Dependencies:** All implementation tasks
**Validates:** All requirements

### Task 5.2: Property-Based Tests
- [ ] Implement property tests for all 53 correctness properties
- [ ] Configure fast-check with 100 iterations per property
- [ ] Add property tags for traceability
- [ ] Run property tests in CI pipeline

**Estimated Time:** 10 hours
**Dependencies:** Task 5.1
**Validates:** All requirements

### Task 5.3: Integration Tests
- [ ] Test end-to-end order flow
- [ ] Test offline-to-online workflow
- [ ] Test table operations workflow
- [ ] Test multi-device synchronization
- [ ] Test printer integration

**Estimated Time:** 6 hours
**Dependencies:** Task 5.1
**Validates:** All requirements

### Task 5.4: Load Testing
- [ ] Test with 20-30 concurrent mobile devices
- [ ] Verify sync completes within 2 seconds
- [ ] Test KOT generation performance
- [ ] Verify database query performance
- [ ] Test Firebase free tier limits

**Estimated Time:** 4 hours
**Dependencies:** Task 5.3
**Validates:** Requirements 2.1, 18.1

## Phase 6: Deployment and Documentation

### Task 6.1: Mobile App Build
- [ ] Configure Android build settings
- [ ] Generate signed APK
- [ ] Test APK installation on devices
- [ ] Create app distribution method
- [ ] Document installation process

**Estimated Time:** 3 hours
**Dependencies:** All Phase 3 tasks
**Validates:** Requirements 18.1

### Task 6.2: Desktop App Updates
- [ ] Update Electron app with Firebase integration
- [ ] Test desktop app with mobile devices
- [ ] Verify printer connectivity
- [ ] Create desktop app installer
- [ ] Document setup process

**Estimated Time:** 3 hours
**Dependencies:** All Phase 2 tasks
**Validates:** Requirements 19.1

### Task 6.3: Configuration Documentation
- [ ] Document Firebase project setup
- [ ] Document printer configuration
- [ ] Create waiter onboarding guide
- [ ] Create manager training guide
- [ ] Document troubleshooting procedures

**Estimated Time:** 4 hours
**Dependencies:** Task 6.1, Task 6.2
**Validates:** Requirements 19.1-19.5

### Task 6.4: Data Migration
- [ ] Create data migration scripts from existing system
- [ ] Migrate menu items to Firestore
- [ ] Migrate tables and sections
- [ ] Migrate waiters
- [ ] Verify data integrity

**Estimated Time:** 4 hours
**Dependencies:** Task 1.2
**Validates:** Requirements 2.4

## Summary

**Total Estimated Time:** 142 hours (~3-4 weeks with 1 developer)

**Critical Path:**
1. Firebase setup (Tasks 1.1-1.3)
2. Mobile app core (Tasks 3.1-3.7)
3. Sync engine (Task 3.3)
4. KOT printing (Tasks 4.1-4.2)
5. Testing (Tasks 5.1-5.3)

**Parallel Work Opportunities:**
- Desktop integration (Phase 2) can be done in parallel with mobile development (Phase 3)
- Unit tests can be written alongside implementation
- Documentation can be created during development

**Risk Mitigation:**
- Start with Firebase setup to validate connectivity
- Test offline functionality early
- Validate printer integration with actual hardware
- Monitor Firebase usage to stay within free tier
