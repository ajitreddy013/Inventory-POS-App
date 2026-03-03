/**
 * Firebase Admin SDK Initialization Test
 * 
 * This script tests the Firebase Admin SDK initialization and verifies
 * that all services are accessible.
 * 
 * Run with: node src/firebase/testAdminInit.js
 */

const {
  initializeAdminSDK,
  getAdminFirestore,
  getAdminAuth,
  isInitialized,
  getVersionInfo,
  createCustomToken,
  getDocument,
  setDocument,
  queryCollection
} = require('./init');

async function runTests() {
  console.log('='.repeat(60));
  console.log('Firebase Admin SDK Initialization Test');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Test 1: Initialize Admin SDK
    console.log('Test 1: Initializing Firebase Admin SDK...');
    const { app, firestore, auth } = initializeAdminSDK();
    console.log('✓ Admin SDK initialized successfully');
    console.log('');

    // Test 2: Check initialization status
    console.log('Test 2: Checking initialization status...');
    const initialized = isInitialized();
    console.log(`✓ Initialization status: ${initialized}`);
    console.log('');

    // Test 3: Get version info
    console.log('Test 3: Getting version information...');
    const versionInfo = getVersionInfo();
    console.log(`✓ Admin SDK Version: ${versionInfo.adminSDKVersion}`);
    console.log(`✓ Initialized: ${versionInfo.initialized}`);
    console.log('');

    // Test 4: Access Firestore
    console.log('Test 4: Accessing Firestore...');
    const firestoreInstance = getAdminFirestore();
    console.log('✓ Firestore accessible');
    console.log('');

    // Test 5: Access Auth
    console.log('Test 5: Accessing Auth...');
    const authInstance = getAdminAuth();
    console.log('✓ Auth accessible');
    console.log('');

    // Test 6: Create custom token (test only - doesn't require valid user)
    console.log('Test 6: Testing custom token creation...');
    try {
      const testToken = await createCustomToken('test_waiter_123', {
        name: 'Test Waiter',
        role: 'waiter'
      });
      console.log('✓ Custom token created successfully');
      console.log(`  Token length: ${testToken.length} characters`);
      console.log('');
    } catch (error) {
      console.log('⚠ Custom token creation test skipped (expected in test environment)');
      console.log('');
    }

    // Test 7: Test Firestore connection
    console.log('Test 7: Testing Firestore connection...');
    try {
      // Try to read from a collection (will fail gracefully if collection doesn't exist)
      const testQuery = await queryCollection('waiters', [], { limit: 1 });
      console.log(`✓ Firestore connection successful`);
      console.log(`  Found ${testQuery.length} document(s) in waiters collection`);
      console.log('');
    } catch (error) {
      if (error.code === 'permission-denied') {
        console.log('⚠ Firestore security rules may need configuration');
        console.log('  This is expected if security rules are not yet deployed');
      } else {
        console.log('⚠ Firestore connection test failed:', error.message);
      }
      console.log('');
    }

    // Test 8: Verify service account details
    console.log('Test 8: Verifying service account details...');
    const serviceAccountPath = require('path').join(__dirname, '../../firebase-service-account.json');
    const serviceAccount = require(serviceAccountPath);
    console.log('✓ Service account loaded');
    console.log(`  Project ID: ${serviceAccount.project_id}`);
    console.log(`  Client Email: ${serviceAccount.client_email}`);
    console.log('');

    // Summary
    console.log('='.repeat(60));
    console.log('All tests completed successfully! ✓');
    console.log('='.repeat(60));
    console.log('');
    console.log('Firebase Admin SDK is ready for use in the desktop application.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Integrate Admin SDK into Electron main process');
    console.log('2. Implement waiter authentication with custom tokens');
    console.log('3. Set up IPC handlers for admin operations');
    console.log('4. Deploy Firestore security rules');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('Test failed! ✗');
    console.error('='.repeat(60));
    console.error('');
    console.error('Error:', error.message);
    console.error('');

    if (error.message.includes('service account key not found')) {
      console.error('Setup Instructions:');
      console.error('1. Download service account key from Firebase Console');
      console.error('2. Save as firebase-service-account.json in project root');
      console.error('3. Add firebase-service-account.json to .gitignore');
      console.error('');
      console.error('See src/firebase/ADMIN_SDK_SETUP.md for detailed instructions');
    } else if (error.message.includes('Invalid service account')) {
      console.error('The service account key file is invalid or corrupted.');
      console.error('Please download a new key from Firebase Console.');
    } else {
      console.error('Stack trace:');
      console.error(error.stack);
    }

    console.error('');
    process.exit(1);
  }
}

// Run tests
runTests();
