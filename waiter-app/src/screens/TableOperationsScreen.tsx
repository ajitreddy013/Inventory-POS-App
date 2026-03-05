/**
 * Table Operations Screen
 * 
 * Handles table merge, split, and transfer operations
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { collection, doc, updateDoc, addDoc, deleteDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  getById,
  query as dbQuery,
  update,
  insert,
  deleteRecord,
  addToSyncQueue
} from '../services/databaseHelpers';

const BRAND_RED = '#C0392B';
const DARK_GRAY = '#2C3E50';
const LIGHT_GRAY = '#F5F6FA';

interface Table {
  id: string;
  name: string;
  section_id: string;
  status: 'available' | 'occupied' | 'pending_bill';
  current_order_id?: string;
}

interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
  base_price: number;
  total_price: number;
  sent_to_kitchen: number;
  modifiers: string;
  category: string;
  waiter_id?: string;
  waiter_name?: string;
}

interface Order {
  id: string;
  order_number: string;
  table_id: string;
  waiter_id: string;
  status: string;
  created_at: number;
  updated_at: number;
}

type OperationType = 'merge' | 'split' | 'transfer';

interface TableOperationsScreenProps {
  sourceTableId: string;
  sourceTableName: string;
  operationType: OperationType;
  waiterId: string;
  waiterName: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function TableOperationsScreen({
  sourceTableId,
  sourceTableName,
  operationType,
  waiterId,
  waiterName,
  onComplete,
  onCancel
}: TableOperationsScreenProps) {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: string[] }>({});
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (operationType === 'merge') {
        // Load all occupied tables except source
        const allTables = await dbQuery<Table>(
          'tables',
          'status = ? AND id != ?',
          ['occupied', sourceTableId]
        );
        setTables(allTables);
      } else if (operationType === 'transfer') {
        // Load all available tables
        const allTables = await dbQuery<Table>(
          'tables',
          'status = ?',
          ['available']
        );
        setTables(allTables);
      } else if (operationType === 'split') {
        // Load order items for the source table
        const sourceTable = await getById<Table>('tables', sourceTableId);
        if (sourceTable?.current_order_id) {
          const items = await dbQuery<OrderItem>(
            'order_items',
            'order_id = ?',
            [sourceTable.current_order_id]
          );
          setOrderItems(items);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleTableToggle = (tableId: string) => {
    if (operationType === 'transfer') {
      // Only one table can be selected for transfer
      setSelectedTables([tableId]);
    } else {
      // Multiple tables can be selected for merge
      if (selectedTables.includes(tableId)) {
        setSelectedTables(selectedTables.filter(id => id !== tableId));
      } else {
        setSelectedTables([...selectedTables, tableId]);
      }
    }
  };

  const handleItemToggle = (itemId: string, splitIndex: number) => {
    const splitKey = `split${splitIndex}`;
    const currentItems = selectedItems[splitKey] || [];
    
    if (currentItems.includes(itemId)) {
      setSelectedItems({
        ...selectedItems,
        [splitKey]: currentItems.filter(id => id !== itemId)
      });
    } else {
      setSelectedItems({
        ...selectedItems,
        [splitKey]: [...currentItems, itemId]
      });
    }
  };

  const handleMergeTables = async () => {
    if (selectedTables.length === 0) {
      Alert.alert('No Tables Selected', 'Please select at least one table to merge');
      return;
    }

    setProcessing(true);

    try {
      // Get source table and order
      const sourceTable = await getById<Table>('tables', sourceTableId);
      if (!sourceTable?.current_order_id) {
        throw new Error('Source table has no order');
      }

      const sourceOrder = await getById<Order>('orders', sourceTable.current_order_id);
      if (!sourceOrder) {
        throw new Error('Source order not found');
      }

      // Get all items from source order
      const sourceItems = await dbQuery<OrderItem>(
        'order_items',
        'order_id = ?',
        [sourceTable.current_order_id]
      );

      // Collect items from all selected tables
      const allItems: OrderItem[] = [...sourceItems];
      const tablesToClear: string[] = [];

      for (const tableId of selectedTables) {
        const table = await getById<Table>('tables', tableId);
        if (table?.current_order_id) {
          const items = await dbQuery<OrderItem>(
            'order_items',
            'order_id = ?',
            [table.current_order_id]
          );
          
          // Preserve waiter attribution for each item
          const itemsWithWaiter = items.map(item => ({
            ...item,
            waiter_id: item.waiter_id || waiterId,
            waiter_name: item.waiter_name || waiterName
          }));
          
          allItems.push(...itemsWithWaiter);
          tablesToClear.push(tableId);
        }
      }

      // Update all items to belong to source order
      for (const item of allItems) {
        const itemData = {
          ...item,
          order_id: sourceTable.current_order_id,
          updated_at: Date.now()
        };

        // Update in Firestore
        const itemRef = doc(db, 'orders', sourceTable.current_order_id, 'items', item.id);
        await updateDoc(itemRef, itemData);

        // Update in SQLite
        await update('order_items', item.id, itemData);

        // Add to sync queue
        await addToSyncQueue('order_items', item.id, 'update', itemData);
      }

      // Clear merged tables
      for (const tableId of tablesToClear) {
        const table = await getById<Table>('tables', tableId);
        if (table?.current_order_id) {
          // Delete the old order
          await deleteDoc(doc(db, 'orders', table.current_order_id));
          await deleteRecord('orders', table.current_order_id);
        }

        // Update table status
        const tableData = {
          status: 'available',
          current_order_id: null,
          updated_at: Date.now()
        };

        await updateDoc(doc(db, 'tables', tableId), tableData);
        await update('tables', tableId, tableData);
        await addToSyncQueue('tables', tableId, 'update', tableData);
      }

      Alert.alert('Success', 'Tables merged successfully', [
        { text: 'OK', onPress: onComplete }
      ]);
    } catch (error) {
      console.error('Error merging tables:', error);
      Alert.alert('Error', 'Failed to merge tables');
    } finally {
      setProcessing(false);
    }
  };

  const handleSplitTable = async () => {
    const splitCount = Object.keys(selectedItems).length;
    
    if (splitCount < 2) {
      Alert.alert('Invalid Split', 'Please create at least 2 splits');
      return;
    }

    // Verify all items are assigned
    const allSelectedItems = Object.values(selectedItems).flat();
    const unassignedItems = orderItems.filter(item => !allSelectedItems.includes(item.id));
    
    if (unassignedItems.length > 0) {
      Alert.alert('Incomplete Split', 'Please assign all items to a split');
      return;
    }

    setProcessing(true);

    try {
      const sourceTable = await getById<Table>('tables', sourceTableId);
      if (!sourceTable?.current_order_id) {
        throw new Error('Source table has no order');
      }

      // Create new orders for each split
      const splits = Object.entries(selectedItems);
      
      for (let i = 0; i < splits.length; i++) {
        const [splitKey, itemIds] = splits[i];
        
        // Create new order
        const orderNumber = `ORD-${Date.now()}-${i}`;
        const orderData = {
          order_number: orderNumber,
          table_id: sourceTableId,
          waiter_id: waiterId,
          status: 'submitted',
          created_at: Date.now(),
          updated_at: Date.now()
        };

        const orderRef = await addDoc(collection(db, 'orders'), orderData);
        const newOrderId = orderRef.id;

        await insert('orders', { id: newOrderId, ...orderData });
        await addToSyncQueue('orders', newOrderId, 'insert', orderData);

        // Move items to new order
        for (const itemId of itemIds) {
          const item = orderItems.find(i => i.id === itemId);
          if (item) {
            const itemData = {
              ...item,
              order_id: newOrderId,
              updated_at: Date.now()
            };

            await addDoc(collection(db, 'orders', newOrderId, 'items'), itemData);
            await insert('order_items', { id: item.id, ...itemData });
            await addToSyncQueue('order_items', item.id, 'update', itemData);
          }
        }
      }

      // Delete original order
      await deleteDoc(doc(db, 'orders', sourceTable.current_order_id));
      await deleteRecord('orders', sourceTable.current_order_id);

      Alert.alert('Success', 'Table split successfully', [
        { text: 'OK', onPress: onComplete }
      ]);
    } catch (error) {
      console.error('Error splitting table:', error);
      Alert.alert('Error', 'Failed to split table');
    } finally {
      setProcessing(false);
    }
  };

  const handleTransferTable = async () => {
    if (selectedTables.length === 0) {
      Alert.alert('No Table Selected', 'Please select a destination table');
      return;
    }

    setProcessing(true);

    try {
      const sourceTable = await getById<Table>('tables', sourceTableId);
      if (!sourceTable?.current_order_id) {
        throw new Error('Source table has no order');
      }

      const destinationTableId = selectedTables[0];

      // Update order table_id
      const orderData = {
        table_id: destinationTableId,
        updated_at: Date.now()
      };

      await updateDoc(doc(db, 'orders', sourceTable.current_order_id), orderData);
      await update('orders', sourceTable.current_order_id, orderData);
      await addToSyncQueue('orders', sourceTable.current_order_id, 'update', orderData);

      // Update source table
      const sourceTableData = {
        status: 'available',
        current_order_id: null,
        updated_at: Date.now()
      };

      await updateDoc(doc(db, 'tables', sourceTableId), sourceTableData);
      await update('tables', sourceTableId, sourceTableData);
      await addToSyncQueue('tables', sourceTableId, 'update', sourceTableData);

      // Update destination table
      const destTableData = {
        status: 'occupied',
        current_order_id: sourceTable.current_order_id,
        occupied_since: Date.now(),
        updated_at: Date.now()
      };

      await updateDoc(doc(db, 'tables', destinationTableId), destTableData);
      await update('tables', destinationTableId, destTableData);
      await addToSyncQueue('tables', destinationTableId, 'update', destTableData);

      Alert.alert('Success', 'Table transferred successfully', [
        { text: 'OK', onPress: onComplete }
      ]);
    } catch (error) {
      console.error('Error transferring table:', error);
      Alert.alert('Error', 'Failed to transfer table');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (operationType === 'merge') {
      handleMergeTables();
    } else if (operationType === 'split') {
      handleSplitTable();
    } else if (operationType === 'transfer') {
      handleTransferTable();
    }
  };

  const getTitle = () => {
    switch (operationType) {
      case 'merge':
        return `Merge ${sourceTableName}`;
      case 'split':
        return `Split ${sourceTableName}`;
      case 'transfer':
        return `Transfer ${sourceTableName}`;
      default:
        return 'Table Operation';
    }
  };

  const getInstructions = () => {
    switch (operationType) {
      case 'merge':
        return 'Select tables to merge with this table:';
      case 'split':
        return 'Assign items to different splits:';
      case 'transfer':
        return 'Select destination table:';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel}>
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{getTitle()}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND_RED} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{getTitle()}</Text>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsText}>{getInstructions()}</Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {operationType === 'split' ? (
          <View>
            {[1, 2, 3].map(splitIndex => (
              <View key={splitIndex} style={styles.splitSection}>
                <Text style={styles.splitTitle}>Split {splitIndex}</Text>
                {orderItems.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.itemCard,
                      selectedItems[`split${splitIndex}`]?.includes(item.id) && styles.itemCardSelected
                    ]}
                    onPress={() => handleItemToggle(item.id, splitIndex)}
                  >
                    <Text style={styles.itemName}>{item.menu_item_name}</Text>
                    <Text style={styles.itemDetails}>
                      Qty: {item.quantity} × ₹{item.base_price} = ₹{item.total_price}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.tableGrid}>
            {tables.map(table => (
              <TouchableOpacity
                key={table.id}
                style={[
                  styles.tableCard,
                  selectedTables.includes(table.id) && styles.tableCardSelected
                ]}
                onPress={() => handleTableToggle(table.id)}
              >
                <Text style={styles.tableName}>{table.name}</Text>
                {operationType === 'merge' && table.status === 'occupied' && (
                  <Text style={styles.tableStatus}>Occupied</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          disabled={processing}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmButton, processing && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={processing}
        >
          <Text style={styles.confirmButtonText}>
            {processing ? 'Processing...' : 'Confirm'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: DARK_GRAY,
    elevation: 4
  },
  backButton: {
    fontSize: 24,
    color: '#FFFFFF',
    marginRight: 16
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  instructions: {
    padding: 16,
    backgroundColor: LIGHT_GRAY
  },
  instructionsText: {
    fontSize: 16,
    color: DARK_GRAY,
    fontWeight: '500'
  },
  content: {
    flex: 1,
    padding: 16
  },
  tableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  tableCard: {
    width: '47%',
    padding: 16,
    borderRadius: 8,
    backgroundColor: LIGHT_GRAY,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center'
  },
  tableCardSelected: {
    borderColor: BRAND_RED,
    backgroundColor: '#FFE5E5'
  },
  tableName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: DARK_GRAY,
    marginBottom: 4
  },
  tableStatus: {
    fontSize: 12,
    color: '#666666'
  },
  splitSection: {
    marginBottom: 24
  },
  splitTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: DARK_GRAY,
    marginBottom: 12,
    paddingLeft: 4,
    borderLeftWidth: 4,
    borderLeftColor: BRAND_RED
  },
  itemCard: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: LIGHT_GRAY,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 8
  },
  itemCardSelected: {
    borderColor: BRAND_RED,
    backgroundColor: '#FFE5E5'
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK_GRAY,
    marginBottom: 4
  },
  itemDetails: {
    fontSize: 14,
    color: '#666666'
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0'
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: BRAND_RED,
    alignItems: 'center'
  },
  cancelButtonText: {
    color: BRAND_RED,
    fontSize: 16,
    fontWeight: '600'
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: BRAND_RED,
    alignItems: 'center'
  },
  confirmButtonDisabled: {
    backgroundColor: '#CCCCCC'
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  }
});
