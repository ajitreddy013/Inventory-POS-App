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

    // Check if Firebase is already initialized
    if (getApps().length === 0) {
      // Initialize Firebase app
      app = initializeApp(firebaseConfig);
      console.log('✅ Firebase app initialized');

      // Initialize Firestore (offline persistence is enabled by default in React Native)
      firestore = getFirestore(app);
      console.log('✅ Firestore initialized with offline persistence');

      // Initialize Auth
      auth = getAuth(app);
      console.log('✅ Firebase Auth initialized');
    } else {
      // Use existing Firebase app
      app = getApps()[0];
      firestore = getFirestore(app);
      auth = getAuth(app);
      console.log('✅ Using existing Firebase app');
    }

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
