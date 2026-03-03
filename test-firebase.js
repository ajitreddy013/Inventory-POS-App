// Quick Firebase Connection Test
require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Validate required Firebase configuration
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingKeys = requiredKeys.filter(key => !firebaseConfig[key]);

if (missingKeys.length > 0) {
  console.error('❌ Missing required Firebase configuration:', missingKeys.join(', '));
  console.error('Please check your .env file and ensure all REACT_APP_FIREBASE_* variables are set.');
  process.exit(1);
}

async function testConnection() {
  try {
    console.log('🔄 Testing Firebase connection...');
    console.log('Project ID:', firebaseConfig.projectId);
    
    const app = initializeApp(firebaseConfig);
    const firestore = getFirestore(app);
    
    // Try to read from Firestore
    const testCollection = collection(firestore, 'test');
    await getDocs(testCollection);
    
    console.log('✅ Firebase connection successful!');
    console.log('✅ Firestore is accessible');
    process.exit(0);
  } catch (error) {
    console.error('❌ Firebase connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
