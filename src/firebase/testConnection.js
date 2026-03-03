// Test Firebase Connection
import { firestore } from './config';
import { collection, getDocs } from 'firebase/firestore';

export async function testFirebaseConnection() {
  try {
    console.log('Testing Firebase connection...');
    
    // Try to read from Firestore (will be empty but should connect)
    const testCollection = collection(firestore, 'test');
    await getDocs(testCollection);
    
    console.log('✅ Firebase connection successful!');
    console.log('Project ID:', process.env.REACT_APP_FIREBASE_PROJECT_ID);
    
    return { success: true, message: 'Connected to Firebase' };
  } catch (error) {
    console.error('❌ Firebase connection failed:', error);
    return { success: false, error: error.message };
  }
}
