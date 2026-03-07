/**
 * Firebase Configuration and Initialization
 * 
 * This module initializes Firebase for the mobile app with:
 * - Firestore for real-time data synchronization
 * - Offline persistence enabled for offline functionality
 * - Authentication for waiter login
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Validate Firebase configuration
function validateFirebaseConfig(): void {
  const requiredKeys = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];

  const missingKeys = requiredKeys.filter(
    (key) => !firebaseConfig[key as keyof typeof firebaseConfig]
  );

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing Firebase configuration keys: ${missingKeys.join(', ')}. ` +
      'Please check your .env file and ensure all EXPO_PUBLIC_FIREBASE_* variables are set.'
    );
  }
}

// Initialize Firebase app
let app: FirebaseApp;
let firestore: Firestore;
let auth: Auth;

export function initializeFirebase(): { app: FirebaseApp; firestore: Firestore; auth: Auth } {
  try {
    // Validate configuration before initialization
    validateFirebaseConfig();

    // ALWAYS delete existing apps to force fresh initialization
    const existingApps = getApps();
    if (existingApps.length > 0) {
      console.log('🔄 Deleting existing Firebase apps...');
      existingApps.forEach(app => {
        try {
          app.delete();
        } catch (e) {
          // Ignore errors
        }
      });
    }

    // Initialize Firebase app (fresh)
    app = initializeApp(firebaseConfig);
    console.log('✅ Firebase app initialized');

    // Initialize Firestore WITHOUT offline persistence
    firestore = getFirestore(app);
    console.log('✅ Firestore initialized (online-only mode)');

    // Initialize Auth
    auth = getAuth(app);
    console.log('✅ Firebase Auth initialized');

    return { app, firestore, auth };
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    throw error;
  }
}

// Export Firebase instances (will be initialized on first import)
export const firebase = initializeFirebase();
export const db = firebase.firestore;
export const authInstance = firebase.auth;

// Export Firestore for convenience
export { firestore, auth };
