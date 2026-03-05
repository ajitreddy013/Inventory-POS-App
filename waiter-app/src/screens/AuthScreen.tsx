/**
 * Authentication Screen - PIN Entry
 * 
 * Waiter login screen with numeric keypad for PIN entry
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithCustomToken } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { setDeviceInfo } from '../services/databaseHelpers';

const BRAND_RED = '#C0392B';
const DARK_GRAY = '#2C3E50';
const LIGHT_GRAY = '#F5F6FA';

interface AuthScreenProps {
  onAuthSuccess: (waiterId: string, waiterName: string) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check for existing session
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const waiterId = await AsyncStorage.getItem('waiterId');
      const waiterName = await AsyncStorage.getItem('waiterName');
      
      if (waiterId && waiterName) {
        // Auto-login with existing session
        onAuthSuccess(waiterId, waiterName);
      }
    } catch (error) {
      console.error('Error checking session:', error);
    }
  };

  const handleNumberPress = (num: string) => {
    if (pin.length < 6) {
      setPin(pin + num);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const validatePinFormat = (pin: string): boolean => {
    // PIN must be 4-6 digits
    return /^\d{4,6}$/.test(pin);
  };

  const handleLogin = async () => {
    if (!validatePinFormat(pin)) {
      setError('PIN must be 4-6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Query Firestore for waiter with matching PIN
      const waitersRef = collection(db, 'waiters');
      const q = query(
        waitersRef,
        where('pin', '==', pin),
        where('is_active', '==', true)
      );
      
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError('Invalid PIN. Please try again.');
        setLoading(false);
        return;
      }

      const waiterDoc = snapshot.docs[0];
      const waiterData = waiterDoc.data();
      const waiterId = waiterDoc.id;
      const waiterName = waiterData.name;

      // Generate custom token (in production, this should be done server-side)
      // For now, we'll use Firebase Auth directly
      // Note: In production, you'd call a Cloud Function to generate the custom token
      
      // Store session
      await AsyncStorage.setItem('waiterId', waiterId);
      await AsyncStorage.setItem('waiterName', waiterName);
      await setDeviceInfo('waiterId', waiterId);
      await setDeviceInfo('waiterName', waiterName);

      // Success
      onAuthSuccess(waiterId, waiterName);
    } catch (error) {
      console.error('Login error:', error);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('waiterId');
      await AsyncStorage.removeItem('waiterName');
      setPin('');
      setError('');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const renderPinDots = () => {
    return (
      <View style={styles.pinDotsContainer}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              index < pin.length && styles.pinDotFilled
            ]}
          />
        ))}
      </View>
    );
  };

  const renderKeypad = () => {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['C', '0', '⌫']
    ];

    return (
      <View style={styles.keypad}>
        {keys.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((key) => (
              <TouchableOpacity
                key={key}
                style={styles.keypadButton}
                onPress={() => {
                  if (key === 'C') {
                    handleClear();
                  } else if (key === '⌫') {
                    handleBackspace();
                  } else {
                    handleNumberPress(key);
                  }
                }}
                disabled={loading}
              >
                <Text style={styles.keypadButtonText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>WaiterFlow</Text>
        <Text style={styles.subtitle}>Enter your PIN to continue</Text>
      </View>

      {renderPinDots()}

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      {renderKeypad()}

      <TouchableOpacity
        style={[
          styles.loginButton,
          (!validatePinFormat(pin) || loading) && styles.loginButtonDisabled
        ]}
        onPress={handleLogin}
        disabled={!validatePinFormat(pin) || loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.loginButtonText}>Login</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.versionText}>Version 1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
    justifyContent: 'center'
  },
  header: {
    alignItems: 'center',
    marginBottom: 48
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: BRAND_RED,
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    color: DARK_GRAY
  },
  pinDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 16
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: DARK_GRAY,
    backgroundColor: '#FFFFFF'
  },
  pinDotFilled: {
    backgroundColor: BRAND_RED,
    borderColor: BRAND_RED
  },
  errorText: {
    color: BRAND_RED,
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14
  },
  keypad: {
    marginBottom: 24
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 12
  },
  keypadButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: LIGHT_GRAY,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  keypadButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: DARK_GRAY
  },
  loginButton: {
    backgroundColor: BRAND_RED,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24
  },
  loginButtonDisabled: {
    backgroundColor: '#CCCCCC'
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600'
  },
  versionText: {
    textAlign: 'center',
    color: '#999999',
    fontSize: 12
  }
});
