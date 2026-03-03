/**
 * Test Authentication Service
 * 
 * Tests PIN-based authentication for waiters and managers
 * Run with: node src/firebase/testAuth.js
 */

const { initializeApp } = require('firebase/app');
const AuthService = require('./authService');
require('dotenv').config();

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const authService = new AuthService(app);

console.log('🔐 Testing Authentication Service\n');

/**
 * Test waiter authentication
 */
async function testWaiterAuth() {
  console.log('👨‍🍳 Testing Waiter Authentication...');
  
  // Test 1: Valid waiter PIN
  console.log('\n  Test 1: Valid waiter PIN (1234)');
  const result1 = await authService.authenticateWaiter('1234');
  if (result1.success) {
    console.log('  ✅ Success:', result1.waiter.name);
  } else {
    console.log('  ❌ Failed:', result1.error);
  }

  // Test 2: Invalid waiter PIN
  console.log('\n  Test 2: Invalid waiter PIN (9999)');
  const result2 = await authService.authenticateWaiter('9999');
  if (result2.success) {
    console.log('  ❌ Should have failed but succeeded');
  } else {
    console.log('  ✅ Correctly rejected:', result2.error);
  }

  // Test 3: Invalid PIN format
  console.log('\n  Test 3: Invalid PIN format (abc)');
  const result3 = await authService.authenticateWaiter('abc');
  if (result3.success) {
    console.log('  ❌ Should have failed but succeeded');
  } else {
    console.log('  ✅ Correctly rejected:', result3.error);
  }

  // Test 4: Another valid waiter
  console.log('\n  Test 4: Another valid waiter PIN (5678)');
  const result4 = await authService.authenticateWaiter('5678');
  if (result4.success) {
    console.log('  ✅ Success:', result4.waiter.name);
  } else {
    console.log('  ❌ Failed:', result4.error);
  }
}

/**
 * Test manager authentication
 */
async function testManagerAuth() {
  console.log('\n\n👤 Testing Manager Authentication...');
  
  // Test 1: Valid manager PIN (123456 - Rajesh Kumar)
  console.log('\n  Test 1: Valid manager PIN (123456)');
  const result1 = await authService.authenticateManager('123456');
  if (result1.success) {
    console.log('  ✅ Success:', result1.manager.name, '-', result1.manager.role);
  } else {
    console.log('  ❌ Failed:', result1.error);
  }

  // Test 2: Invalid manager PIN
  console.log('\n  Test 2: Invalid manager PIN (999999)');
  const result2 = await authService.authenticateManager('999999');
  if (result2.success) {
    console.log('  ❌ Should have failed but succeeded');
  } else {
    console.log('  ✅ Correctly rejected:', result2.error);
    if (result2.attemptsRemaining !== undefined) {
      console.log('  ℹ️  Attempts remaining:', result2.attemptsRemaining);
    }
  }

  // Test 3: Another valid manager PIN (234567 - Priya Sharma)
  console.log('\n  Test 3: Another valid manager PIN (234567)');
  const result3 = await authService.authenticateManager('234567');
  if (result3.success) {
    console.log('  ✅ Success:', result3.manager.name, '-', result3.manager.role);
  } else {
    console.log('  ❌ Failed:', result3.error);
  }
}

/**
 * Test lockout mechanism
 */
async function testLockout() {
  console.log('\n\n🔒 Testing Lockout Mechanism...');
  
  // Clear any existing lockout
  authService.clearFailedAttempts('test_lockout');
  
  console.log('\n  Attempting 3 failed logins...');
  
  for (let i = 1; i <= 3; i++) {
    console.log(`\n  Attempt ${i}:`);
    const result = await authService.authenticateManager('000000');
    console.log('    Result:', result.error);
    if (result.attemptsRemaining !== undefined) {
      console.log('    Attempts remaining:', result.attemptsRemaining);
    }
  }
  
  console.log('\n  Attempting 4th login (should be locked)...');
  const result4 = await authService.authenticateManager('123456');
  if (result4.success) {
    console.log('  ❌ Should have been locked but succeeded');
  } else {
    console.log('  ✅ Correctly locked:', result4.error);
  }
  
  // Clear lockout for next tests
  authService.clearFailedAttempts('manager_lockout');
  console.log('\n  ℹ️  Lockout cleared for next tests');
}

/**
 * Test session management
 */
async function testSession() {
  console.log('\n\n📱 Testing Session Management...');
  
  // Login as waiter
  console.log('\n  Logging in as waiter...');
  const loginResult = await authService.authenticateWaiter('1234');
  if (loginResult.success) {
    console.log('  ✅ Logged in:', loginResult.waiter.name);
  }
  
  // Check current user
  console.log('\n  Checking current user...');
  const currentUser = authService.getCurrentUser();
  console.log('    User:', currentUser.user?.name);
  console.log('    Type:', currentUser.type);
  console.log('    Is authenticated:', authService.isAuthenticated());
  console.log('    Is waiter:', authService.isWaiter());
  console.log('    Is manager:', authService.isManager());
  
  // Logout
  console.log('\n  Logging out...');
  const logoutResult = await authService.logout();
  if (logoutResult.success) {
    console.log('  ✅ Logged out successfully');
  }
  
  // Check after logout
  console.log('\n  Checking after logout...');
  const afterLogout = authService.getCurrentUser();
  console.log('    User:', afterLogout.user);
  console.log('    Is authenticated:', authService.isAuthenticated());
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    await testWaiterAuth();
    await testManagerAuth();
    await testLockout();
    await testSession();
    
    console.log('\n\n✅ All authentication tests completed!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test error:', error);
    process.exit(1);
  }
}

// Run tests
runTests();
