import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import AuthScreen from './src/screens/AuthScreen';
import TableSelectionScreen from './src/screens/TableSelectionScreen';
import OrderEntryScreen from './src/screens/OrderEntryScreen';
import TableOperationsScreen from './src/screens/TableOperationsScreen';
import { initializeSyncEngine } from './src/services/syncEngine';
import { initializeDatabase } from './src/services/database';

type Screen = 'auth' | 'tables' | 'order' | 'tableOperation';
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

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize database first
      console.log('Initializing database...');
      await initializeDatabase();
      console.log('Database initialized');

      // Then initialize sync engine
      console.log('Initializing sync engine...');
      await initializeSyncEngine({
        onStatusChange: (status) => {
          console.log('Sync status:', status);
        },
        onSyncComplete: () => {
          console.log('Sync complete');
        },
        onError: (error) => {
          // Ignore hot reload errors in development
          if (error.message && error.message.includes('Target ID already exists')) {
            return;
          }
          console.error('Sync error:', error);
        }
      });
      console.log('Sync engine initialized');
    } catch (error) {
      console.error('Error initializing app:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (id: string, name: string) => {
    setWaiterId(id);
    setWaiterName(name);
    setCurrentScreen('tables');
  };

  const handleLogout = () => {
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

  const handleBackToTables = () => {
    setCurrentScreen('tables');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#C0392B" />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {currentScreen === 'auth' && (
        <AuthScreen onAuthSuccess={handleLogin} />
      )}

      {currentScreen === 'tables' && (
        <TableSelectionScreen
          waiterId={waiterId}
          waiterName={waiterName}
          onTableSelect={handleTableSelect}
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

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  }
});
