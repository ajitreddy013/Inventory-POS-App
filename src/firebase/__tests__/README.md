# Firebase Connection Tests

This directory contains comprehensive unit tests for Firebase connectivity in the WaiterFlow application.

## Test Files

### 1. `connection.test.js`
Unit tests for Firebase connection functionality. Tests both renderer process (regular SDK) and main process (Admin SDK).

**Run with:**
```bash
npm test -- src/firebase/__tests__/connection.test.js
```

### 2. `integration.test.js`
Integration tests that verify actual Firebase connectivity. These tests require a real Firebase connection.

**Run with:**
```bash
RUN_INTEGRATION_TESTS=true npm test -- src/firebase/__tests__/integration.test.js
```

### 3. `testFirebaseConnection.js`
Standalone test runner that can be executed independently without Jest.

**Run with:**
```bash
node src/firebase/testFirebaseConnection.js
```

## Requirements Tested

These tests validate **Requirement 2.1: Real-time Data Synchronization**
- Firestore connectivity from renderer process
- Admin SDK authentication and connectivity
- Offline persistence configuration
- Error handling for connection failures
- Performance requirements (< 2 seconds for operations)

## Test Coverage

- ✓ Firebase app initialization
- ✓ Firestore connectivity (read/write)
- ✓ Admin SDK initialization
- ✓ Custom token creation
- ✓ Document operations (CRUD)
- ✓ Collection queries
- ✓ Error handling
- ✓ Offline persistence
- ✓ Performance validation
- ✓ Connection resilience

## Setup Requirements

1. **Environment Variables**: Ensure `.env` file contains Firebase configuration
2. **Service Account**: For Admin SDK tests, place `firebase-service-account.json` in project root
3. **Firebase Project**: Tests require an active Firebase project

## Running All Tests

```bash
# Run unit tests
npm test

# Run integration tests
RUN_INTEGRATION_TESTS=true npm test

# Run standalone test
node src/firebase/testFirebaseConnection.js
```
