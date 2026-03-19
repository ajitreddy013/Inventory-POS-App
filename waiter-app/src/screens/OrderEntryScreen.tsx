/**
 * Order Entry Screen
 *
 * Allows waiters to add items to orders, apply modifiers, and submit to kitchen
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query as fsQuery,
  orderBy,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  getById,
  query as dbQuery,
  insert,
  update,
} from '../services/databaseHelpers';
import MenuBrowser from '../components/MenuBrowser';
import OfflineIndicator from '../components/OfflineIndicator';
import { useSyncStatus } from '../hooks/useSyncStatus';
import KOTHistoryScreen from './KOTHistoryScreen';

const BRAND_RED = '#C0392B';
const DARK_GRAY = '#2C3E50';
const LIGHT_GRAY = '#F5F6FA';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category_id: string;
  item_category: 'food' | 'drink';
  is_out_of_stock: number;
  available_modifier_ids?: string;
}

interface Modifier {
  id: string;
  name: string;
  type: 'spice_level' | 'paid_addon';
  price: number;
}

interface OrderItem {
  id: string;
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
  base_price: number;
  total_price: number;
  sent_to_kitchen: boolean;
  modifiers: Modifier[];
  category: 'food' | 'drink';
}

interface OrderEntryScreenProps {
  tableId: string;
  tableName: string;
  orderId?: string;
  waiterId: string;
  waiterName: string;
  onBack: () => void;
}

export default function OrderEntryScreen({
  tableId,
  tableName,
  orderId,
  waiterId,
  waiterName,
  onBack,
}: OrderEntryScreenProps) {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [currentOrderId, setCurrentOrderId] = useState<string | undefined>(
    orderId
  );
  const [showModifierModal, setShowModifierModal] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(
    null
  );
  const [availableModifiers, setAvailableModifiers] = useState<Modifier[]>([]);
  const [selectedModifiers, setSelectedModifiers] = useState<Modifier[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showKOTHistory, setShowKOTHistory] = useState(false);
  const { status, pendingSyncCount } = useSyncStatus();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Subscribe to real-time order items from Firestore
  const subscribeToOrderItems = (oid: string) => {
    if (unsubscribeRef.current) unsubscribeRef.current();
    const q = fsQuery(
      collection(db, 'orders', oid, 'items'),
      orderBy('created_at', 'asc')
    );
    unsubscribeRef.current = onSnapshot(q, (snapshot) => {
      const items: OrderItem[] = snapshot.docs.map((d) => {
        const data = d.data() as any;
        const quantity = data.quantity ?? data.currentQty ?? 0;
        const basePrice = data.base_price ?? data.unitPrice ?? 0;
        const persistedTotal = Number(data.total_price ?? data.totalPrice);
        return {
          id: d.id,
          menu_item_id: data.menu_item_id || data.menuItemId || d.id,
          menu_item_name: data.menu_item_name || data.menuItemName || '',
          quantity,
          base_price: basePrice,
          total_price: Number.isFinite(persistedTotal)
            ? persistedTotal
            : quantity * basePrice,
          sent_to_kitchen: !!(data.sent_to_kitchen || data.sentQty > 0),
          modifiers:
            typeof data.modifiers === 'string'
              ? JSON.parse(data.modifiers || '[]')
              : data.modifiers || [],
          category: data.category || 'food',
        };
      });
      setOrderItems(items);
    });
  };

  useEffect(() => {
    if (orderId) subscribeToOrderItems(orderId);
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [orderId]);

  const handleMenuItemSelect = async (menuItem: MenuItem) => {
    setSelectedMenuItem(menuItem);

    // Load available modifiers
    if (menuItem.available_modifier_ids) {
      const modifierIds = menuItem.available_modifier_ids.split(',');
      const modifiers: Modifier[] = [];

      for (const id of modifierIds) {
        const modifier = await getById<Modifier>('modifiers', id.trim());
        if (modifier) {
          modifiers.push(modifier);
        }
      }

      setAvailableModifiers(modifiers);
    } else {
      setAvailableModifiers([]);
    }

    setSelectedModifiers([]);
    setShowModifierModal(true);
  };

  const handleModifierToggle = (modifier: Modifier) => {
    const isSelected = selectedModifiers.some((m) => m.id === modifier.id);

    if (isSelected) {
      setSelectedModifiers(
        selectedModifiers.filter((m) => m.id !== modifier.id)
      );
    } else {
      setSelectedModifiers([...selectedModifiers, modifier]);
    }
  };

  const handleAddItem = () => {
    if (!selectedMenuItem) return;

    // Calculate total price (base + paid add-ons only, spice levels are free)
    const paidAddons = selectedModifiers.filter((m) => m.type === 'paid_addon');
    const addonTotal = paidAddons.reduce((sum, m) => sum + m.price, 0);
    const totalPrice = selectedMenuItem.price + addonTotal;

    const newItem: OrderItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      menu_item_id: selectedMenuItem.id,
      menu_item_name: selectedMenuItem.name,
      quantity: 1,
      base_price: selectedMenuItem.price,
      total_price: totalPrice,
      sent_to_kitchen: false,
      modifiers: selectedModifiers,
      category: selectedMenuItem.item_category,
    };

    setOrderItems([...orderItems, newItem]);
    setShowModifierModal(false);
    setSelectedMenuItem(null);
    setSelectedModifiers([]);
  };

  const handleQuantityChange = (itemId: string, delta: number) => {
    setOrderItems(
      orderItems.map((item) => {
        if (item.id === itemId && !item.sent_to_kitchen) {
          const newQuantity = Math.max(1, item.quantity + delta);
          return {
            ...item,
            quantity: newQuantity,
            total_price:
              item.base_price * newQuantity +
              item.modifiers
                .filter((m) => m.type === 'paid_addon')
                .reduce((sum, m) => sum + m.price, 0) *
                newQuantity,
          };
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (itemId: string) => {
    const item = orderItems.find((i) => i.id === itemId);

    if (item?.sent_to_kitchen) {
      Alert.alert(
        'Cannot Remove',
        'Items already sent to kitchen cannot be removed'
      );
      return;
    }

    setOrderItems(orderItems.filter((i) => i.id !== itemId));
  };

  const currentOrderItems = orderItems.filter((item) => !item.sent_to_kitchen);

  const calculateOrderTotal = (): number => {
    return currentOrderItems.reduce((sum, item) => sum + item.total_price, 0);
  };

  const calculateTableBillTotal = (): number => {
    return orderItems.reduce((sum, item) => sum + item.total_price, 0);
  };

  const handleSubmitOrder = async () => {
    if (currentOrderItems.length === 0) {
      Alert.alert('Empty Order', 'Please add items before submitting');
      return;
    }

    const unsentItems = currentOrderItems;

    if (unsentItems.length === 0) {
      Alert.alert(
        'No New Items',
        'All items have already been sent to kitchen'
      );
      return;
    }

    setSubmitting(true);

    try {
      let orderIdToUse = currentOrderId;

      // Create order if it doesn't exist
      if (!orderIdToUse) {
        const orderNumber = `ORD-${Date.now()}`;
        const orderData = {
          order_number: orderNumber,
          table_id: tableId,
          waiter_id: waiterId,
          status: 'submitted',
          created_at: Date.now(),
          updated_at: Date.now(),
        };

        // Save to Firestore (primary)
        const orderRef = await addDoc(collection(db, 'orders'), orderData);
        orderIdToUse = orderRef.id;
        setCurrentOrderId(orderIdToUse);
        subscribeToOrderItems(orderIdToUse);

        // Save to local SQLite (non-fatal)
        try {
          await insert('orders', { id: orderIdToUse, ...orderData });
        } catch (e) {
          console.warn('SQLite order insert failed (non-fatal):', e);
        }
      }

      // Mark all unsent items as sent
      setOrderItems(
        orderItems.map((item) => ({ ...item, sent_to_kitchen: true }))
      );

      // Save order items to Firestore and SQLite
      for (const item of unsentItems) {
        const itemData = {
          order_id: orderIdToUse,
          menu_item_id: item.menu_item_id,
          menu_item_name: item.menu_item_name,
          quantity: item.quantity,
          base_price: item.base_price,
          total_price: item.total_price,
          sent_to_kitchen: 1,
          modifiers: JSON.stringify(item.modifiers),
          category: item.category,
          created_at: Date.now(),
          updated_at: Date.now(),
        };

        // Save to Firestore (primary)
        await addDoc(
          collection(db, 'orders', orderIdToUse!, 'items'),
          itemData
        );

        // Save to local SQLite (non-fatal)
        try {
          await insert('order_items', { id: item.id, ...itemData });
        } catch (e) {
          console.warn('SQLite order_item insert failed (non-fatal):', e);
        }
      }

      // Update table status in Firestore
      try {
        const totalAmount = calculateTableBillTotal();
        await updateDoc(doc(db, 'tables', tableId), {
          status: 'occupied',
          currentOrderId: orderIdToUse,
          current_order_id: orderIdToUse,
          currentBillAmount: totalAmount,
          current_bill_amount: totalAmount,
          occupiedSince: Date.now(),
          occupied_since: Date.now(),
          updatedAt: Date.now(),
          updated_at: Date.now(),
        });
      } catch (e) {
        console.warn('Table status update failed (non-fatal):', e);
      }

      Alert.alert('Success', 'Order sent to kitchen!');
    } catch (error) {
      console.error('Error submitting order:', error);
      Alert.alert('Error', 'Failed to submit order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderModifierModal = () => {
    if (!selectedMenuItem) return null;

    const spiceLevels = availableModifiers.filter(
      (m) => m.type === 'spice_level'
    );
    const paidAddons = availableModifiers.filter(
      (m) => m.type === 'paid_addon'
    );

    return (
      <Modal
        visible={showModifierModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModifierModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowModifierModal(false)}
        >
          <Pressable style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedMenuItem.name}</Text>
            <Text style={styles.modalPrice}>₹{selectedMenuItem.price}</Text>

            {spiceLevels.length > 0 && (
              <View style={styles.modifierSection}>
                <Text style={styles.modifierSectionTitle}>
                  Spice Level (Free)
                </Text>
                {spiceLevels.map((modifier) => (
                  <TouchableOpacity
                    key={modifier.id}
                    style={[
                      styles.modifierOption,
                      selectedModifiers.some((m) => m.id === modifier.id) &&
                        styles.modifierOptionSelected,
                    ]}
                    onPress={() => handleModifierToggle(modifier)}
                  >
                    <Text style={styles.modifierOptionText}>
                      {modifier.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {paidAddons.length > 0 && (
              <View style={styles.modifierSection}>
                <Text style={styles.modifierSectionTitle}>Add-ons</Text>
                {paidAddons.map((modifier) => (
                  <TouchableOpacity
                    key={modifier.id}
                    style={[
                      styles.modifierOption,
                      selectedModifiers.some((m) => m.id === modifier.id) &&
                        styles.modifierOptionSelected,
                    ]}
                    onPress={() => handleModifierToggle(modifier)}
                  >
                    <Text style={styles.modifierOptionText}>
                      {modifier.name} (+₹{modifier.price})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setShowModifierModal(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalButtonAdd}
                onPress={handleAddItem}
              >
                <Text style={styles.modalButtonAddText}>Add to Order</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  const renderOrderItem = (item: OrderItem) => {
    return (
      <View key={item.id} style={styles.orderItem}>
        <View style={styles.orderItemHeader}>
          <Text style={styles.orderItemName}>{item.menu_item_name}</Text>
          {!item.sent_to_kitchen && (
            <TouchableOpacity onPress={() => handleRemoveItem(item.id)}>
              <Text style={styles.orderItemRemove}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {item.modifiers.length > 0 && (
          <Text style={styles.orderItemModifiers}>
            {item.modifiers.map((m) => m.name).join(', ')}
          </Text>
        )}

        <View style={styles.orderItemFooter}>
          <View style={styles.orderItemQuantity}>
            {!item.sent_to_kitchen && (
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleQuantityChange(item.id, -1)}
              >
                <Text style={styles.quantityButtonText}>−</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.quantityText}>{item.quantity}</Text>

            {!item.sent_to_kitchen && (
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleQuantityChange(item.id, 1)}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.orderItemPrice}>
            ₹{item.total_price.toFixed(2)}
          </Text>
        </View>

        {item.sent_to_kitchen && (
          <View style={styles.sentBadge}>
            <Text style={styles.sentBadgeText}>Sent to Kitchen</Text>
          </View>
        )}
      </View>
    );
  };

  // Show KOT history as a dedicated full-screen view.
  if (showKOTHistory && currentOrderId) {
    return (
      <KOTHistoryScreen
        tableId={tableId}
        tableName={tableName}
        orderId={currentOrderId}
        onBack={() => setShowKOTHistory(false)}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order for table: {tableName}</Text>
        {currentOrderId && (
          <TouchableOpacity
            onPress={() => setShowKOTHistory(true)}
            style={styles.kotHistoryBtn}
          >
            <Text style={styles.kotHistoryBtnText}>KOT History</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Offline Indicator */}
      <OfflineIndicator status={status} pendingSyncCount={pendingSyncCount} />

      {/* Menu Browser */}
      <View style={styles.menuSection}>
        <MenuBrowser onItemSelect={handleMenuItemSelect} />
      </View>

      {/* Order Items */}
      {currentOrderItems.length > 0 && (
        <View style={styles.orderSection}>
          <Text style={styles.orderSectionTitle}>Order Items</Text>
          <ScrollView style={styles.orderItemsList}>
            {currentOrderItems.map((item) => renderOrderItem(item))}
          </ScrollView>

          <View style={styles.orderTotal}>
            <Text style={styles.orderTotalLabel}>Total:</Text>
            <Text style={styles.orderTotalAmount}>
              ₹{calculateOrderTotal().toFixed(2)}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              submitting && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmitOrder}
            disabled={submitting}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? 'Submitting...' : 'Send to Kitchen'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modifier Modal */}
      {renderModifierModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: DARK_GRAY,
    elevation: 4,
  },
  backButton: {
    fontSize: 24,
    color: '#FFFFFF',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  kotHistoryBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  kotHistoryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  menuSection: {
    flex: 1,
  },
  orderSection: {
    maxHeight: '40%',
    backgroundColor: LIGHT_GRAY,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  orderSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: DARK_GRAY,
    marginBottom: 12,
  },
  orderItemsList: {
    maxHeight: 200,
  },
  orderItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    position: 'relative',
  },
  orderItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK_GRAY,
    flex: 1,
  },
  orderItemRemove: {
    fontSize: 20,
    color: BRAND_RED,
    padding: 4,
  },
  orderItemModifiers: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 8,
  },
  orderItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderItemQuantity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BRAND_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK_GRAY,
    minWidth: 24,
    textAlign: 'center',
  },
  orderItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: DARK_GRAY,
  },
  sentBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  sentBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  orderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 2,
    borderTopColor: '#E0E0E0',
    marginTop: 8,
  },
  orderTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: DARK_GRAY,
  },
  orderTotalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: BRAND_RED,
  },
  submitButton: {
    backgroundColor: BRAND_RED,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: DARK_GRAY,
    marginBottom: 8,
  },
  modalPrice: {
    fontSize: 18,
    color: BRAND_RED,
    fontWeight: '600',
    marginBottom: 24,
  },
  modifierSection: {
    marginBottom: 24,
  },
  modifierSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK_GRAY,
    marginBottom: 12,
  },
  modifierOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginBottom: 8,
  },
  modifierOptionSelected: {
    borderColor: BRAND_RED,
    backgroundColor: '#FFE5E5',
  },
  modifierOptionText: {
    fontSize: 14,
    color: DARK_GRAY,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: BRAND_RED,
    alignItems: 'center',
  },
  modalButtonCancelText: {
    color: BRAND_RED,
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonAdd: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: BRAND_RED,
    alignItems: 'center',
  },
  modalButtonAddText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
