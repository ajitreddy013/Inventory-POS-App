/**
 * Offline Indicator Component
 * 
 * Shows connection status and syncing state
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BRAND_RED = '#C0392B';
const GREEN = '#4CAF50';
const YELLOW = '#FFC107';

interface OfflineIndicatorProps {
  status: 'online' | 'offline' | 'syncing' | 'error';
  pendingSyncCount?: number;
}

export default function OfflineIndicator({ status, pendingSyncCount = 0 }: OfflineIndicatorProps) {
  // Only show when there's an actual error, hide for offline/syncing
  if (status === 'error') {
    return (
      <View style={[styles.container, { backgroundColor: BRAND_RED }]}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.text}>Sync error - Please check connection</Text>
      </View>
    );
  }
  
  // Don't show anything for online, offline, or syncing states
  return null;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8
  },
  icon: {
    fontSize: 16
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1
  }
});
