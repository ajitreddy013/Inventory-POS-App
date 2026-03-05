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
  if (status === 'online' && pendingSyncCount === 0) {
    return null; // Don't show anything when fully online and synced
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'offline':
        return {
          backgroundColor: BRAND_RED,
          text: 'Offline - Changes will sync when connected',
          icon: '📡'
        };
      case 'syncing':
        return {
          backgroundColor: YELLOW,
          text: `Syncing ${pendingSyncCount} changes...`,
          icon: '🔄'
        };
      case 'error':
        return {
          backgroundColor: BRAND_RED,
          text: 'Sync error - Please check connection',
          icon: '⚠️'
        };
      case 'online':
        return {
          backgroundColor: GREEN,
          text: `Connected - ${pendingSyncCount} pending`,
          icon: '✓'
        };
      default:
        return {
          backgroundColor: BRAND_RED,
          text: 'Unknown status',
          icon: '?'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={[styles.container, { backgroundColor: config.backgroundColor }]}>
      <Text style={styles.icon}>{config.icon}</Text>
      <Text style={styles.text}>{config.text}</Text>
    </View>
  );
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
