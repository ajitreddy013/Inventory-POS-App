import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator, BackHandler } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AuthScreen from './src/screens/AuthScreen';
import TableSelectionScreen from './src/screens/TableSelectionScreen';
import OrderEntryScreen from './src/screens/OrderEntryScreen';
import TableOperationsScreen from './src/screens/TableOperationsScreen';
import KOTHistoryScreen from './src/screens/KOTHistoryScreen';
import { initializeSyncEngine } from './src/services/syncEngine';
import { initializeDatabase } from './src/services/database';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './src/services/firebase';
import { getAll, deleteRecord } from './src/services/databaseHelpers';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Screen = 'auth' | 'tables' | 'order' | 'tableOperation' | 'kot';
type OperationType = 'merge' | 'split' | 'transfer';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('auth');
  const [waiterId, setWaiterId] = useState<string>('');
  const [waiterName, setWaiterName] = useState<string>('');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [selectedTableName, setSelectedTableName] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | undefined>();
  const [operationType, setOperationType] = useState<OperationType>('merge');
  const [loading, setLoading] = useState(true);

  // Android hardware back button support
  useEffect(() => {
    const onBackPress = () => {
      if (currentScreen === 'order' || currentScreen === 'tableOperation' || currentScreen === 'kot') {
        setCurrentScreen('tables');
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [currentScreen]);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('Initializing database...');
      await initializeDatabase();
      console.log('Database initialized');

      console.log('Initializing sync engine...');
      await initializeSyncEngine({
        onStatusChange: (status) => {
          console.log('Sync status:', status);
        },
        onSyncComplete: () => {
          console.log('Sync complete');
        },
        onError: (error) => {
          if (error.message && error.message.includes('Target ID already exists')) {
            return;
          }
          console.error('Sync error:', error);
        }
      });
      console.log('Sync engine initialized');

      // Reconcile local SQLite with Firestore to purge stale records
      await reconcileLocalData();
      console.log('Reconciliation complete');
    } catch (error) {
      console.error('Error initializing app:', error);
    } finally {
      setLoading(false);
    }
  };

  const reconcileLocalData = async () => {
    try {
      for (const { firestoreCol, sqliteTable } of [
        { firestoreCol: 'sections', sqliteTable: 'sections' },
        { firestoreCol: 'tables',   sqliteTable: 'tables'   },
      ]) {
        const snap = await getDocs(collection(db, firestoreCol));
        const remoteIds = new Set(snap.docs.map(d => d.id));
        const localRows = await getAll<{ id: string }>(sqliteTable);
        for (const row of localRows) {
          if (!remoteIds.has(row.id)) {
            await deleteRecord(sqliteTable, row.id);
            console.log(`Removed stale ${sqliteTable}: ${row.id}`);
          }
        }
      }
    } catch (err) {
      console.warn('Reconciliation error (non-fatal):', err);
    }
  };

  const handleLogin = (id: string, name: string) => {
    setWaiterId(id);
    setWaiterName(name);
    setCurrentScreen('tables');
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('waiterId');
    await AsyncStorage.removeItem('waiterName');
    setWaiterId('');
    setWaiterName('');
    setCurrentScreen('auth');
  };

  const handleTableSelect = (tableId: string, tableName: string, orderId?: string) => {
    setSelectedTableId(tableId);
    setSelectedTableName(tableName);
    setSelectedOrderId(orderId);
    setCurrentScreen('order');
  };

  const handleTableOperation = (tableId: string, tableName: string, operation: OperationType) => {
    setSelectedTableId(tableId);
    setSelectedTableName(tableName);
    setOperationType(operation);
    setCurrentScreen('tableOperation');
  };

  const handleViewKOT = (tableId: string, tableName: string, orderId?: string) => {
    if (!orderId) return;
    setSelectedTableId(tableId);
    setSelectedTableName(tableName);
    setSelectedOrderId(orderId);
    setCurrentScreen('kot');
  };

  const handleBackToTables = () => {
    setCurrentScreen('tables');
  };

  if (loading) {
    return (
      <SafeAreaProvider>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#C0392B" />
          <StatusBar style="auto" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {currentScreen === 'auth' && (
          <AuthScreen onAuthSuccess={handleLogin} />
        )}

        {currentScreen === 'tables' && (
          <TableSelectionScreen
            waiterId={waiterId}
            waiterName={waiterName}
            onTableSelect={handleTableSelect}
            onViewKOT={handleViewKOT}
            onTableOperation={handleTableOperation}
            onLogout={handleLogout}
          />
        )}

        {currentScreen === 'order' && (
          <OrderEntryScreen
            tableId={selectedTableId}
            tableName={selectedTableName}
            orderId={selectedOrderId}
            waiterId={waiterId}
            waiterName={waiterName}
            onBack={handleBackToTables}
          />
        )}

        {currentScreen === 'tableOperation' && (
          <TableOperationsScreen
            sourceTableId={selectedTableId}
            sourceTableName={selectedTableName}
            operationType={operationType}
            waiterId={waiterId}
            waiterName={waiterName}
            onComplete={handleBackToTables}
            onCancel={handleBackToTables}
          />
        )}

        {currentScreen === 'kot' && selectedOrderId && (
          <KOTHistoryScreen
            tableId={selectedTableId}
            tableName={selectedTableName}
            orderId={selectedOrderId}
            onBack={handleBackToTables}
          />
        )}

        <StatusBar style="auto" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  }
});
