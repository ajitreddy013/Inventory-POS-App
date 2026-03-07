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
import OfflineIndicator from '../components/OfflineIndicator';
import { useSyncStatus } from '../hooks/useSyncStatus';

const BRAND_RED = '#f20d0d'; // Stitch primary
const DARK_GRAY = '#1e293b'; // slate-800
const LIGHT_GRAY = '#f8f5f5'; // Stitch background-light
const WHITE = '#FFFFFF';
const SLATE_300 = '#cbd5e1';

interface AuthScreenProps {
  onAuthSuccess: (waiterId: string, waiterName: string) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { status, pendingSyncCount } = useSyncStatus();

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
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      setError('');
      
      // Auto-submit when 4 digits entered
      if (newPin.length === 4) {
        handleLogin(newPin);
      }
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
    // PIN must be exactly 4 digits
    return /^\d{4}$/.test(pin);
  };

  const handleLogin = async (pinToValidate?: string) => {
    const pinValue = pinToValidate || pin;
    
    console.log('Login attempt with PIN:', pinValue);
    
    if (!validatePinFormat(pinValue)) {
      console.log('PIN validation failed');
      setError('PIN must be 4 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Query Firestore for waiter with matching PIN
      console.log('Querying Firestore for PIN:', pinValue);
      const waitersRef = collection(db, 'waiters');
      const q = query(
        waitersRef,
        where('pin', '==', pinValue),
        where('is_active', '==', true)
      );
      
      const snapshot = await getDocs(q);
      console.log('Query result - docs found:', snapshot.docs.length);

      if (snapshot.empty) {
        console.log('No waiter found with PIN:', pinValue);
        setError('Invalid PIN. Please try again.');
        setLoading(false);
        return;
      }

      const waiterDoc = snapshot.docs[0];
      const waiterData = waiterDoc.data();
      const waiterId = waiterDoc.id;
      const waiterName = waiterData.name;

      console.log('Login successful:', { waiterId, waiterName });

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
        {[0, 1, 2, 3].map((index) => (
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
                activeOpacity={0.5}
                delayPressIn={0}
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
      {/* Offline Indicator */}
      <OfflineIndicator status={status} pendingSyncCount={pendingSyncCount} />
      
      <View style={styles.contentWrapper}>
        <View style={styles.header}>
          <Text style={styles.title}>WaiterFlow</Text>
          <Text style={styles.subtitle}>Enter your PIN to access POS</Text>
        </View>

        {renderPinDots()}

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : <View style={{ height: 35 }} />}

        {renderKeypad()}

        <View style={styles.loginActionContainer}>
          <TouchableOpacity
            style={[styles.loginButton, (!validatePinFormat(pin) || loading) && styles.loginButtonDisabled]}
            activeOpacity={0.7}
            delayPressIn={0}
            onPress={() => handleLogin(pin)}
            disabled={!validatePinFormat(pin) || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.spacer} />
        
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIGHT_GRAY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: LIGHT_GRAY,
    flex: 1,
    paddingTop: 40, // Push content higher up
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: DARK_GRAY,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b', // slate-500
  },
  pinDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
    gap: 16,
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: SLATE_300,
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: BRAND_RED,
    borderColor: BRAND_RED,
    shadowColor: BRAND_RED,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  errorText: {
    color: BRAND_RED,
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
    fontWeight: '600',
    height: 19,
  },
  keypad: {
    paddingHorizontal: 40,
    paddingBottom: 16,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 24,
  },
  keypadButton: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  keypadButtonText: {
    fontSize: 24,
    fontWeight: '500',
    color: DARK_GRAY,
  },
  loginActionContainer: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    paddingBottom: 32,
  },
  loginButton: {
    backgroundColor: BRAND_RED,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: BRAND_RED,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  loginButtonDisabled: {
    backgroundColor: '#cbd5e1', // slate-300
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  spacer: {
    flex: 1,
  },
  versionText: {
    textAlign: 'center',
    color: '#94a3b8', // slate-400
    fontSize: 12,
    fontWeight: '500',
    paddingBottom: 32,
  }
});
