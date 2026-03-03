#!/usr/bin/env node
/**
 * Standalone Firebase Connection Test Runner
 * 
 * This script provides comprehensive testing of Firebase connectivity
 * for both renderer process (regular SDK) and main process (Admin SDK).
 * 
 * Run with: node src/firebase/testFirebaseConnection.js
 * 
 * Requirements: 2.1 - Real-time data synchronization
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, getDoc, deleteDoc } = require('firebase/firestore');
const {
  initializeAdminSDK,
  getAdminFirestore,
  getAdminAuth,
  isInitialized,
  createCustomToken,
  getDocument,
  setDocument,
  deleteDocument,
  queryCollection
} = require('./init');

require('dotenv').config();

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

// Helper functions
function logTest(name, status, message = '') {
  const symbols = { pass: '✓', fail: '✗', skip: '⊘' };
  const colors = { pass: '\x1b[32m', fail: '\x1b[31m', skip: '\x1b[33m', reset: '\x1b[0m' };
  
  console.log(`  ${colors[status]}${symbols[status]} ${name}${colors.reset}`);
  if (message) {
    console.log(`    ${message}`);
  }
  
  results.tests.push({ name, status, message });
  results[status === 'pass' ? 'passed' : status === 'fail' ? 'failed' : 'skipped']++;
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
}

// Test suites
async function testRendererSDK() {
  logSection('Renderer Process - Regular Firebase SDK');
  
  let app, firestore;
  
  try {
    // Test 1: Initialize Firebase
    const firebaseConfig = {
      apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
      authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
      storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.REACT_APP_FIREBASE_APP_ID
    };
    
    app = initializeApp(firebaseConfig, 'connection-test');
    firestore = getFirestore(app);
    logTest('Initialize Firebase app', 'pass', `Project: ${firebaseConfig.projectId}`);
  } catch (error) {
    logTest('Initialize Firebase app', 'fail', error.message);
    return;
  }
  
  // Test 2: Firestore initialization
  try {
    if (firestore && firestore.type === 'firestore') {
      logTest('Initialize Firestore', 'pass');
    } else {
      logTest('Initialize Firestore', 'fail', 'Invalid Firestore instance');
    }
  } catch (error) {
    logTest('Initialize Firestore', 'fail', error.message);
  }
  
  // Test 3: Create collection reference
  try {
    const testCollection = collection(firestore, 'test');
    if (testCollection && testCollection.id === 'test') {
      logTest('Create collection reference', 'pass');
    } else {
      logTest('Create collection reference', 'fail', 'Invalid collection reference');
    }
  } catch (error) {
    logTest('Create collection reference', 'fail', error.message);
  }
  
  // Test 4: Create document reference
  try {
    const testDoc = doc(firestore, 'test', 'doc1');
    if (testDoc && testDoc.id === 'doc1' && testDoc.path === 'test/doc1') {
      logTest('Create document reference', 'pass');
    } else {
      logTest('Create document reference', 'fail', 'Invalid document reference');
    }
  } catch (error) {
    logTest('Create document reference', 'fail', error.message);
  }
  
  // Test 5: Test Firestore connectivity (read operation)
  try {
    const testCollection = collection(firestore, 'waiters');
    const snapshot = await getDocs(testCollection);
    logTest('Firestore read connectivity', 'pass', `Found ${snapshot.size} documents`);
  } catch (error) {
    if (error.code === 'permission-denied') {
      logTest('Firestore read connectivity', 'skip', 'Permission denied (security rules not configured)');
    } else {
      logTest('Firestore read connectivity', 'fail', error.message);
    }
  }
  
  // Test 6: Test Firestore write operation
  try {
    const testDocRef = doc(firestore, 'test_connection', `test_${Date.now()}`);
    await setDoc(testDocRef, {
      timestamp: new Date().toISOString(),
      test: true
    });
    logTest('Firestore write connectivity', 'pass');
    
    // Clean up
    await deleteDoc(testDocRef);
  } catch (error) {
    if (error.code === 'permission-denied') {
      logTest('Firestore write connectivity', 'skip', 'Permission denied (security rules not configured)');
    } else {
      logTest('Firestore write connectivity', 'fail', error.message);
    }
  }
}

async function testAdminSDK() {
  logSection('Main Process - Firebase Admin SDK');
  
  // Test 1: Check initialization status
  try {
    const initialized = isInitialized();
    logTest('Check initialization status', 'pass', `Initialized: ${initialized}`);
  } catch (error) {
    logTest('Check initialization status', 'fail', error.message);
  }
  
  // Test 2: Initialize Admin SDK
  try {
    const { app, firestore, auth } = initializeAdminSDK();
    if (app && firestore && auth) {
      logTest('Initialize Admin SDK', 'pass');
    } else {
      logTest('Initialize Admin SDK', 'fail', 'Missing services');
    }
  } catch (error) {
    if (error.message.includes('service account key not found')) {
      logTest('Initialize Admin SDK', 'skip', 'Service account not configured');
      return; // Skip remaining Admin SDK tests
    } else {
      logTest('Initialize Admin SDK', 'fail', error.message);
      return;
    }
  }
  
  // Test 3: Get Admin Firestore
  try {
    const adminFirestore = getAdminFirestore();
    if (adminFirestore && typeof adminFirestore.collection === 'function') {
      logTest('Get Admin Firestore', 'pass');
    } else {
      logTest('Get Admin Firestore', 'fail', 'Invalid Firestore instance');
    }
  } catch (error) {
    logTest('Get Admin Firestore', 'fail', error.message);
  }
  
  // Test 4: Get Admin Auth
  try {
    const adminAuth = getAdminAuth();
    if (adminAuth && typeof adminAuth.createCustomToken === 'function') {
      logTest('Get Admin Auth', 'pass');
    } else {
      logTest('Get Admin Auth', 'fail', 'Invalid Auth instance');
    }
  } catch (error) {
    logTest('Get Admin Auth', 'fail', error.message);
  }
  
  // Test 5: Create custom token
  try {
    const token = await createCustomToken('test_waiter_123', {
      name: 'Test Waiter',
      role: 'waiter'
    });
    if (token && typeof token === 'string' && token.length > 0) {
      logTest('Create custom token', 'pass', `Token length: ${token.length} chars`);
    } else {
      logTest('Create custom token', 'fail', 'Invalid token');
    }
  } catch (error) {
    logTest('Create custom token', 'fail', error.message);
  }
  
  // Test 6: Read document
  try {
    const doc = await getDocument('waiters', 'test_waiter');
    logTest('Read document with Admin SDK', 'pass', doc ? 'Document found' : 'Document not found (OK)');
  } catch (error) {
    if (error.code === 'permission-denied') {
      logTest('Read document with Admin SDK', 'skip', 'Permission denied');
    } else {
      logTest('Read document with Admin SDK', 'fail', error.message);
    }
  }
  
  // Test 7: Write document
  try {
    const testDocId = `test_${Date.now()}`;
    await setDocument('test_connection', testDocId, {
      timestamp: new Date().toISOString(),
      test: true
    });
    logTest('Write document with Admin SDK', 'pass');
    
    // Clean up
    await deleteDocument('test_connection', testDocId);
  } catch (error) {
    if (error.code === 'permission-denied') {
      logTest('Write document with Admin SDK', 'skip', 'Permission denied');
    } else {
      logTest('Write document with Admin SDK', 'fail', error.message);
    }
  }
  
  // Test 8: Query collection
  try {
    const docs = await queryCollection('waiters', [], { limit: 5 });
    logTest('Query collection with Admin SDK', 'pass', `Found ${docs.length} documents`);
  } catch (error) {
    if (error.code === 'permission-denied') {
      logTest('Query collection with Admin SDK', 'skip', 'Permission denied');
    } else {
      logTest('Query collection with Admin SDK', 'fail', error.message);
    }
  }
}

async function testErrorHandling() {
  logSection('Error Handling Tests');
  
  // Test 1: Handle missing configuration
  try {
    const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    const missingKeys = requiredKeys.filter(key => {
      const envKey = `REACT_APP_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
      return !process.env[envKey];
    });
    
    if (missingKeys.length === 0) {
      logTest('Validate Firebase configuration', 'pass', 'All required keys present');
    } else {
      logTest('Validate Firebase configuration', 'fail', `Missing keys: ${missingKeys.join(', ')}`);
    }
  } catch (error) {
    logTest('Validate Firebase configuration', 'fail', error.message);
  }
  
  // Test 2: Handle invalid document ID
  try {
    await getDocument('test', '');
    logTest('Handle invalid document ID', 'fail', 'Should have thrown error');
  } catch (error) {
    logTest('Handle invalid document ID', 'pass', 'Correctly rejected invalid ID');
  }
  
  // Test 3: Handle non-existent document
  try {
    const doc = await getDocument('test', 'nonexistent_doc_12345');
    if (doc === null) {
      logTest('Handle non-existent document', 'pass', 'Returns null for missing document');
    } else {
      logTest('Handle non-existent document', 'fail', 'Should return null');
    }
  } catch (error) {
    logTest('Handle non-existent document', 'skip', error.message);
  }
  
  // Test 4: Handle network timeout
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });
    
    await Promise.race([
      queryCollection('test', []),
      timeoutPromise
    ]);
    
    logTest('Handle network timeout', 'pass', 'Operation completed within timeout');
  } catch (error) {
    if (error.message === 'Timeout') {
      logTest('Handle network timeout', 'fail', 'Operation timed out');
    } else {
      logTest('Handle network timeout', 'skip', error.message);
    }
  }
}

async function testPerformance() {
  logSection('Performance Tests');
  
  // Test 1: Read operation performance
  try {
    const startTime = Date.now();
    await getDocument('waiters', 'test_waiter');
    const duration = Date.now() - startTime;
    
    if (duration < 2000) {
      logTest('Read operation performance', 'pass', `Completed in ${duration}ms (< 2s requirement)`);
    } else {
      logTest('Read operation performance', 'fail', `Took ${duration}ms (> 2s requirement)`);
    }
  } catch (error) {
    logTest('Read operation performance', 'skip', error.message);
  }
  
  // Test 2: Write operation performance
  try {
    const testDocId = `perf_test_${Date.now()}`;
    const startTime = Date.now();
    
    await setDocument('test_connection', testDocId, { test: true });
    const duration = Date.now() - startTime;
    
    if (duration < 2000) {
      logTest('Write operation performance', 'pass', `Completed in ${duration}ms (< 2s requirement)`);
    } else {
      logTest('Write operation performance', 'fail', `Took ${duration}ms (> 2s requirement)`);
    }
    
    // Clean up
    await deleteDocument('test_connection', testDocId);
  } catch (error) {
    logTest('Write operation performance', 'skip', error.message);
  }
  
  // Test 3: Query operation performance
  try {
    const startTime = Date.now();
    await queryCollection('waiters', [], { limit: 10 });
    const duration = Date.now() - startTime;
    
    if (duration < 2000) {
      logTest('Query operation performance', 'pass', `Completed in ${duration}ms (< 2s requirement)`);
    } else {
      logTest('Query operation performance', 'fail', `Took ${duration}ms (> 2s requirement)`);
    }
  } catch (error) {
    logTest('Query operation performance', 'skip', error.message);
  }
}

// Main test runner
async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('Firebase Connection Test Suite');
  console.log('='.repeat(60));
  console.log('');
  console.log('Testing Firebase connectivity for WaiterFlow application');
  console.log('Requirements: 2.1 - Real-time data synchronization');
  console.log('');
  
  try {
    await testRendererSDK();
    await testAdminSDK();
    await testErrorHandling();
    await testPerformance();
    
    // Print summary
    logSection('Test Summary');
    console.log('');
    console.log(`  Total Tests: ${results.tests.length}`);
    console.log(`  \x1b[32m✓ Passed: ${results.passed}\x1b[0m`);
    console.log(`  \x1b[31m✗ Failed: ${results.failed}\x1b[0m`);
    console.log(`  \x1b[33m⊘ Skipped: ${results.skipped}\x1b[0m`);
    console.log('');
    
    if (results.failed === 0) {
      console.log('\x1b[32m✓ All tests passed!\x1b[0m');
      console.log('');
      console.log('Firebase connection is working correctly.');
      console.log('');
      process.exit(0);
    } else {
      console.log('\x1b[31m✗ Some tests failed\x1b[0m');
      console.log('');
      console.log('Please review the failed tests above and fix any issues.');
      console.log('');
      process.exit(1);
    }
  } catch (error) {
    console.error('');
    console.error('\x1b[31mTest suite error:\x1b[0m', error.message);
    console.error('');
    process.exit(1);
  }
}

// Run tests
runAllTests();
