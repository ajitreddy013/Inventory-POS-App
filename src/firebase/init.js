/**
 * Firebase Initialization Module for Desktop App
 * 
 * This module provides comprehensive Firebase initialization for the Electron desktop application.
 * It handles both the regular Firebase SDK (for renderer process) and Firebase Admin SDK (for main process).
 * 
 * Features:
 * - Firestore offline persistence for desktop app
 * - Firebase Admin SDK for privileged operations (custom tokens, admin database access)
 * - Proper error handling and logging
 * - Service account authentication for Admin SDK
 * 
 * Usage:
 * - In renderer process: Use regular Firebase SDK (config.js)
 * - In main process: Use Firebase Admin SDK (this file)
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

/**
 * Firebase Admin SDK instance
 * This is initialized once and reused throughout the application
 */
let adminApp = null;
let adminFirestore = null;
let adminAuth = null;

/**
 * Initialize Firebase Admin SDK
 * 
 * The Admin SDK requires a service account key file for authentication.
 * This provides elevated privileges for operations like:
 * - Creating custom authentication tokens
 * - Direct database access with admin privileges
 * - Bypassing security rules for trusted operations
 * 
 * @returns {Object} Initialized Firebase Admin services
 * @throws {Error} If initialization fails
 */
function initializeAdminSDK() {
  try {
    // Check if already initialized
    if (adminApp) {
      console.log('Firebase Admin SDK already initialized');
      return {
        app: adminApp,
        firestore: adminFirestore,
        auth: adminAuth
      };
    }

    console.log('Initializing Firebase Admin SDK...');

    // Load service account key
    const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
    
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(
        'Firebase service account key not found. Please:\n' +
        '1. Download service account key from Firebase Console\n' +
        '2. Save it as firebase-service-account.json in project root\n' +
        '3. Add firebase-service-account.json to .gitignore\n\n' +
        'Instructions: https://firebase.google.com/docs/admin/setup#initialize-sdk'
      );
    }

    const serviceAccount = require(serviceAccountPath);

    // Validate service account structure
    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
      throw new Error('Invalid service account key file. Missing required fields.');
    }

    // Initialize Admin SDK
    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    });

    // Initialize Firestore with Admin SDK
    adminFirestore = admin.firestore();
    
    // Configure Firestore settings
    adminFirestore.settings({
      ignoreUndefinedProperties: true, // Ignore undefined values in documents
      timestampsInSnapshots: true      // Use Timestamp objects instead of Date
    });

    // Initialize Auth with Admin SDK
    adminAuth = admin.auth();

    console.log('Firebase Admin SDK initialized successfully');
    console.log(`Project ID: ${serviceAccount.project_id}`);
    console.log(`Service Account: ${serviceAccount.client_email}`);

    return {
      app: adminApp,
      firestore: adminFirestore,
      auth: adminAuth
    };

  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error.message);
    throw error;
  }
}

/**
 * Get Firebase Admin Firestore instance
 * Initializes Admin SDK if not already initialized
 * 
 * @returns {admin.firestore.Firestore} Firestore instance
 */
function getAdminFirestore() {
  if (!adminFirestore) {
    initializeAdminSDK();
  }
  return adminFirestore;
}

/**
 * Get Firebase Admin Auth instance
 * Initializes Admin SDK if not already initialized
 * 
 * @returns {admin.auth.Auth} Auth instance
 */
function getAdminAuth() {
  if (!adminAuth) {
    initializeAdminSDK();
  }
  return adminAuth;
}

/**
 * Create custom authentication token for waiter login
 * 
 * This is used by the mobile app to authenticate waiters with their PIN.
 * The desktop app validates the PIN and generates a custom token that
 * the mobile app uses to sign in to Firebase.
 * 
 * @param {string} waiterId - Unique waiter identifier
 * @param {Object} additionalClaims - Optional custom claims to add to token
 * @returns {Promise<string>} Custom authentication token
 */
async function createCustomToken(waiterId, additionalClaims = {}) {
  try {
    const auth = getAdminAuth();
    const token = await auth.createCustomToken(waiterId, additionalClaims);
    console.log(`Custom token created for waiter: ${waiterId}`);
    return token;
  } catch (error) {
    console.error('Error creating custom token:', error);
    throw error;
  }
}

/**
 * Verify Firebase ID token
 * 
 * Used to verify tokens sent from mobile apps to ensure they are valid
 * and haven't been tampered with.
 * 
 * @param {string} idToken - Firebase ID token to verify
 * @returns {Promise<admin.auth.DecodedIdToken>} Decoded token with user info
 */
async function verifyIdToken(idToken) {
  try {
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying ID token:', error);
    throw error;
  }
}

/**
 * Get Firestore document with admin privileges
 * 
 * Bypasses security rules - use with caution!
 * 
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID
 * @returns {Promise<Object|null>} Document data or null if not found
 */
async function getDocument(collection, docId) {
  try {
    const firestore = getAdminFirestore();
    const docRef = firestore.collection(collection).doc(docId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return null;
    }
    
    return {
      id: doc.id,
      ...doc.data()
    };
  } catch (error) {
    console.error(`Error getting document ${collection}/${docId}:`, error);
    throw error;
  }
}

/**
 * Set Firestore document with admin privileges
 * 
 * Bypasses security rules - use with caution!
 * 
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID
 * @param {Object} data - Document data
 * @param {Object} options - Set options (merge, mergeFields)
 * @returns {Promise<void>}
 */
async function setDocument(collection, docId, data, options = {}) {
  try {
    const firestore = getAdminFirestore();
    const docRef = firestore.collection(collection).doc(docId);
    await docRef.set(data, options);
    console.log(`Document set: ${collection}/${docId}`);
  } catch (error) {
    console.error(`Error setting document ${collection}/${docId}:`, error);
    throw error;
  }
}

/**
 * Update Firestore document with admin privileges
 * 
 * Bypasses security rules - use with caution!
 * 
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID
 * @param {Object} data - Fields to update
 * @returns {Promise<void>}
 */
async function updateDocument(collection, docId, data) {
  try {
    const firestore = getAdminFirestore();
    const docRef = firestore.collection(collection).doc(docId);
    await docRef.update(data);
    console.log(`Document updated: ${collection}/${docId}`);
  } catch (error) {
    console.error(`Error updating document ${collection}/${docId}:`, error);
    throw error;
  }
}

/**
 * Delete Firestore document with admin privileges
 * 
 * Bypasses security rules - use with caution!
 * 
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID
 * @returns {Promise<void>}
 */
async function deleteDocument(collection, docId) {
  try {
    const firestore = getAdminFirestore();
    const docRef = firestore.collection(collection).doc(docId);
    await docRef.delete();
    console.log(`Document deleted: ${collection}/${docId}`);
  } catch (error) {
    console.error(`Error deleting document ${collection}/${docId}:`, error);
    throw error;
  }
}

/**
 * Query Firestore collection with admin privileges
 * 
 * Bypasses security rules - use with caution!
 * 
 * @param {string} collection - Collection name
 * @param {Array<Object>} filters - Array of filter objects {field, operator, value}
 * @param {Object} options - Query options {orderBy, limit, startAfter}
 * @returns {Promise<Array<Object>>} Array of documents
 */
async function queryCollection(collection, filters = [], options = {}) {
  try {
    const firestore = getAdminFirestore();
    let query = firestore.collection(collection);
    
    // Apply filters
    filters.forEach(filter => {
      query = query.where(filter.field, filter.operator, filter.value);
    });
    
    // Apply ordering
    if (options.orderBy) {
      query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
    }
    
    // Apply limit
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    // Apply pagination
    if (options.startAfter) {
      query = query.startAfter(options.startAfter);
    }
    
    const snapshot = await query.get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error(`Error querying collection ${collection}:`, error);
    throw error;
  }
}

/**
 * Execute Firestore transaction with admin privileges
 * 
 * Transactions ensure atomic operations across multiple documents.
 * 
 * @param {Function} updateFunction - Function that receives transaction object
 * @returns {Promise<any>} Transaction result
 */
async function runTransaction(updateFunction) {
  try {
    const firestore = getAdminFirestore();
    return await firestore.runTransaction(updateFunction);
  } catch (error) {
    console.error('Error running transaction:', error);
    throw error;
  }
}

/**
 * Execute Firestore batch write with admin privileges
 * 
 * Batches allow multiple write operations to be committed atomically.
 * 
 * @param {Function} batchFunction - Function that receives batch object
 * @returns {Promise<void>}
 */
async function runBatch(batchFunction) {
  try {
    const firestore = getAdminFirestore();
    const batch = firestore.batch();
    await batchFunction(batch);
    await batch.commit();
    console.log('Batch write committed successfully');
  } catch (error) {
    console.error('Error running batch:', error);
    throw error;
  }
}

/**
 * Check if Firebase Admin SDK is initialized
 * 
 * @returns {boolean} True if initialized
 */
function isInitialized() {
  return adminApp !== null;
}

/**
 * Get Firebase Admin SDK version info
 * 
 * @returns {Object} Version information
 */
function getVersionInfo() {
  return {
    adminSDKVersion: admin.SDK_VERSION,
    initialized: isInitialized()
  };
}

// Export all functions
module.exports = {
  // Initialization
  initializeAdminSDK,
  isInitialized,
  getVersionInfo,
  
  // Service getters
  getAdminFirestore,
  getAdminAuth,
  
  // Authentication
  createCustomToken,
  verifyIdToken,
  
  // Document operations
  getDocument,
  setDocument,
  updateDocument,
  deleteDocument,
  
  // Query operations
  queryCollection,
  
  // Transaction and batch operations
  runTransaction,
  runBatch,
  
  // Direct access to admin instances (use with caution)
  get admin() {
    return admin;
  },
  get app() {
    return adminApp;
  },
  get firestore() {
    return adminFirestore;
  },
  get auth() {
    return adminAuth;
  }
};
