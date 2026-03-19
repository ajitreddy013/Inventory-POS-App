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
  setDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query as fsQuery,
  orderBy,
  runTransaction,
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
import { playErrorSound } from '../utils/errorSound';

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
  is_bar_item?: number;
  isBarItem?: boolean;
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
  is_bar_item?: number;
  isBarItem?: boolean;
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
  const [counterStockMap, setCounterStockMap] = useState<
    Record<string, number>
  >({});
  const { status, pendingSyncCount } = useSyncStatus();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const showErrorAlert = (title: string, message: string) => {
    void playErrorSound();
    Alert.alert(title, message);
  };

  const loadCounterStock = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'inventory'));
      const stockMap: Record<string, number> = {};
      const hasExplicitCounter = new Set<string>();

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const menuItemId = data.menuItemId || data.menu_item_id || docSnap.id;
        const hasCounterValue =
          (data.counterStock !== undefined && data.counterStock !== null) ||
          (data.counter_stock !== undefined && data.counter_stock !== null);
        const counterCamel = Number(data.counterStock);
        const counterSnake = Number(data.counter_stock);
        const counter = Math.max(
          Number.isFinite(counterCamel) ? counterCamel : 0,
          Number.isFinite(counterSnake) ? counterSnake : 0
        );
        if (menuItemId) {
          stockMap[String(menuItemId)] = Number.isFinite(counter) ? counter : 0;
          if (hasCounterValue) {
            hasExplicitCounter.add(String(menuItemId));
          }
        }
      });

      // Keep parity with menu visibility: if counter value is missing in inventory,
      // derive from godown->counter transfer movements.
      const movementSnap = await getDocs(collection(db, 'inventoryMovements'));
      movementSnap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (data.movementType !== 'godown_to_counter') return;

        const menuItemId = data.menuItemId || data.menu_item_id;
        if (!menuItemId) return;

        const key = String(menuItemId);
        if (hasExplicitCounter.has(key)) return;

        const qty = Number(data.quantity ?? 0);
        if (!Number.isFinite(qty)) return;

        stockMap[key] = (stockMap[key] || 0) + qty;
      });

      setCounterStockMap(stockMap);
      return stockMap;
    } catch (error) {
      console.error('Error loading counter stock:', error);
      return null;
    }
  };

  const getCurrentQtyForMenuItem = (menuItemId: string): number => {
    return orderItems
      .filter(
        (item) => item.menu_item_id === menuItemId && !item.sent_to_kitchen
      )
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  };

  const deductCounterStockForKOT = async (items: OrderItem[]) => {
    const barQtyMap = new Map<string, number>();

    items.forEach((item) => {
      const isBarItem = item.is_bar_item === 1 || item.isBarItem === true;
      if (!isBarItem) return;
      const qty = Number(item.quantity || 0);
      if (qty <= 0) return;
      barQtyMap.set(
        item.menu_item_id,
        (barQtyMap.get(item.menu_item_id) || 0) + qty
      );
    });

    if (barQtyMap.size === 0) return;

    await runTransaction(db, async (tx) => {
      const now = Date.now();
      const nowDate = new Date(now);
      const stockChecks: Array<{
        menuItemId: string;
        qty: number;
        currentStock: number;
      }> = [];

      for (const [menuItemId, qty] of barQtyMap.entries()) {
        const invRef = doc(db, 'inventory', menuItemId);
        const invSnap = await tx.get(invRef);
        const currentStock = Number(
          invSnap.exists()
            ? ((invSnap.data() as any).counterStock ??
                (invSnap.data() as any).counter_stock ??
                0)
            : 0
        );

        stockChecks.push({ menuItemId, qty, currentStock });
      }

      for (const { menuItemId, qty, currentStock } of stockChecks) {
        if (currentStock < qty) {
          throw new Error(`Stock not available for item ${menuItemId}`);
        }

        const newCounterStock = currentStock - qty;
        const invRef = doc(db, 'inventory', menuItemId);
        const menuItemRef = doc(db, 'menuItems', menuItemId);

        tx.set(
          invRef,
          {
            menuItemId,
            counterStock: newCounterStock,
            updatedAt: nowDate,
            updated_at: now,
          },
          { merge: true }
        );

        tx.set(
          menuItemRef,
          {
            isOutOfStock: newCounterStock === 0,
            updatedAt: nowDate,
            updated_at: now,
          },
          { merge: true }
        );
      }
    });
  };

  const reserveGlobalKotNumber = async (): Promise<number> => {
    return runTransaction(db, async (tx) => {
      const counterRef = doc(db, 'counters', 'kot');
      const counterSnap = await tx.get(counterRef);
      const lastKotNumber = Number(
        counterSnap.exists()
          ? ((counterSnap.data() as any).lastKotNumber ?? 0)
          : 0
      );
      const nextKotNumber = lastKotNumber + 1;

      tx.set(
        counterRef,
        {
          lastKotNumber: nextKotNumber,
          updatedAt: Date.now(),
          updated_at: Date.now(),
        },
        { merge: true }
      );

      return nextKotNumber;
    });
  };

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
          is_bar_item:
            data.is_bar_item !== undefined
              ? Number(data.is_bar_item)
              : data.isBarItem
                ? 1
                : 0,
          isBarItem: !!data.isBarItem,
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

  useEffect(() => {
    loadCounterStock();
    const interval = setInterval(() => {
      loadCounterStock();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

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

  const handleAddItem = async () => {
    if (!selectedMenuItem) return;

    const isBarItem =
      selectedMenuItem.is_bar_item === 1 || selectedMenuItem.isBarItem === true;
    if (isBarItem) {
      const hasKnownStock = Object.prototype.hasOwnProperty.call(
        counterStockMap,
        selectedMenuItem.id
      );
      const availableQty = hasKnownStock
        ? Number(counterStockMap[selectedMenuItem.id] || 0)
        : Number.POSITIVE_INFINITY;
      const currentQty = getCurrentQtyForMenuItem(selectedMenuItem.id);
      if (currentQty + 1 > availableQty) {
        // Revalidate once with fresh stock fetch to avoid stale-map false negatives.
        const freshMap = await loadCounterStock();
        const freshHasKnownStock = !!freshMap
          ? Object.prototype.hasOwnProperty.call(freshMap, selectedMenuItem.id)
          : hasKnownStock;
        const freshAvailableQty = freshHasKnownStock
          ? Number((freshMap || counterStockMap)[selectedMenuItem.id] || 0)
          : Number.POSITIVE_INFINITY;

        if (currentQty + 1 > freshAvailableQty) {
          showErrorAlert(
            'Out of Stock',
            `Counter stock exhausted for ${selectedMenuItem.name}. Available: ${freshAvailableQty}`
          );
          return;
        }
      }
    }

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
      is_bar_item: selectedMenuItem.is_bar_item,
      isBarItem: selectedMenuItem.isBarItem,
    };

    setOrderItems([...orderItems, newItem]);
    setShowModifierModal(false);
    setSelectedMenuItem(null);
    setSelectedModifiers([]);
  };

  const handleQuantityChange = async (itemId: string, delta: number) => {
    const targetItem = orderItems.find((item) => item.id === itemId);
    if (targetItem && !targetItem.sent_to_kitchen) {
      const isBarItem =
        targetItem.is_bar_item === 1 || targetItem.isBarItem === true;
      if (isBarItem && delta > 0) {
        const currentQtyForItem = getCurrentQtyForMenuItem(
          targetItem.menu_item_id
        );
        const nextQtyForItem = currentQtyForItem + delta;
        const hasKnownStock = Object.prototype.hasOwnProperty.call(
          counterStockMap,
          targetItem.menu_item_id
        );
        const availableQty = hasKnownStock
          ? Number(counterStockMap[targetItem.menu_item_id] || 0)
          : Number.POSITIVE_INFINITY;

        if (nextQtyForItem > availableQty) {
          // Revalidate once with fresh stock fetch to avoid stale-map false negatives.
          const freshMap = await loadCounterStock();
          const freshHasKnownStock = !!freshMap
            ? Object.prototype.hasOwnProperty.call(
                freshMap,
                targetItem.menu_item_id
              )
            : hasKnownStock;
          const freshAvailableQty = freshHasKnownStock
            ? Number(
                (freshMap || counterStockMap)[targetItem.menu_item_id] || 0
              )
            : Number.POSITIVE_INFINITY;

          if (nextQtyForItem > freshAvailableQty) {
            showErrorAlert(
              'Out of Stock',
              `Counter stock exhausted for ${targetItem.menu_item_name}. Available: ${freshAvailableQty}`
            );
            return;
          }
        }
      }
    }

    setOrderItems(
      orderItems.map((item) => {
        if (item.id === itemId && !item.sent_to_kitchen) {
          const isBarItem = item.is_bar_item === 1 || item.isBarItem === true;
          const currentQtyForItem = getCurrentQtyForMenuItem(item.menu_item_id);
          const nextQtyForItem = currentQtyForItem + delta;
          const hasKnownStock = Object.prototype.hasOwnProperty.call(
            counterStockMap,
            item.menu_item_id
          );
          const availableQty = hasKnownStock
            ? Number(counterStockMap[item.menu_item_id] || 0)
            : Number.POSITIVE_INFINITY;

          if (isBarItem && delta > 0 && nextQtyForItem > availableQty) {
            showErrorAlert(
              'Out of Stock',
              `Counter stock exhausted for ${item.menu_item_name}. Available: ${availableQty}`
            );
            return item;
          }

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
      showErrorAlert(
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
      showErrorAlert('Empty Order', 'Please add items before submitting');
      return;
    }

    const unsentItems = currentOrderItems;

    if (unsentItems.length === 0) {
      showErrorAlert(
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

      // Deduct counter stock for bar items at KOT submit time.
      await deductCounterStockForKOT(unsentItems);
      const kotNumber = await reserveGlobalKotNumber();
      const sentAt = Date.now();

      // Mark all unsent items as sent
      setOrderItems(
        orderItems.map((item) => ({ ...item, sent_to_kitchen: true }))
      );

      // Save order items to Firestore and SQLite
      for (const item of unsentItems) {
        const itemRef = doc(
          db,
          'orders',
          orderIdToUse!,
          'items',
          item.menu_item_id
        );
        const existingSnap = await getDoc(itemRef);
        const existingData = existingSnap.exists()
          ? (existingSnap.data() as any)
          : null;
        const existingCurrentQty = Number(
          existingData?.currentQty ?? existingData?.quantity ?? 0
        );
        const existingSentQty = Number(
          existingData?.sentQty ??
            (existingData?.sent_to_kitchen ? existingCurrentQty : 0)
        );

        const mergedCurrentQty =
          existingCurrentQty + Number(item.quantity || 0);
        const mergedSentQty = existingSentQty + Number(item.quantity || 0);

        const itemData = {
          menuItemId: item.menu_item_id,
          menuItemName: item.menu_item_name,
          unitPrice: item.base_price,
          currentQty: mergedCurrentQty,
          sentQty: mergedSentQty,
          order_id: orderIdToUse,
          menu_item_id: item.menu_item_id,
          menu_item_name: item.menu_item_name,
          quantity: mergedCurrentQty,
          base_price: item.base_price,
          total_price: mergedCurrentQty * Number(item.base_price || 0),
          sent_to_kitchen: 1,
          modifiers: JSON.stringify(item.modifiers),
          category: item.category,
          is_bar_item: item.is_bar_item ?? (item.isBarItem ? 1 : 0),
          isBarItem: item.is_bar_item === 1 || item.isBarItem === true,
          kot_number: kotNumber,
          sent_at: sentAt,
          created_at: existingData?.created_at || Date.now(),
          updated_at: Date.now(),
        };

        // Save to Firestore (primary) as one doc per menu item.
        await setDoc(itemRef, itemData, { merge: true });

        // Save to local SQLite (non-fatal)
        try {
          await insert('order_items', { id: item.id, ...itemData });
        } catch (e) {
          console.warn('SQLite order_item insert failed (non-fatal):', e);
        }
      }

      await setDoc(
        doc(db, 'orders', orderIdToUse!, 'kotHistory', String(kotNumber)),
        {
          kotNumber,
          orderId: orderIdToUse,
          tableId,
          tableName,
          sentAt,
          sent_at: sentAt,
          subtotal: unsentItems.reduce(
            (sum, item) => sum + Number(item.total_price || 0),
            0
          ),
          totalItems: unsentItems.reduce(
            (sum, item) => sum + Number(item.quantity || 0),
            0
          ),
          items: unsentItems.map((item) => ({
            menuItemId: item.menu_item_id,
            menuItemName: item.menu_item_name,
            qty: Number(item.quantity || 0),
            unitPrice: Number(item.base_price || 0),
            category: item.category,
            lineTotal: Number(item.total_price || 0),
            modifiers: item.modifiers || [],
          })),
          createdAt: sentAt,
          updatedAt: sentAt,
        },
        { merge: true }
      );

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

      // Refresh stock immediately so the next add reflects latest counter quantity.
      await loadCounterStock();

      Alert.alert('Success', 'Order sent to kitchen!');
    } catch (error) {
      console.error('Error submitting order:', error);
      const message =
        error instanceof Error && /Stock not available/i.test(error.message)
          ? 'Stock not available in counter. Please transfer from godown.'
          : 'Failed to submit order. Please try again.';
      showErrorAlert('Error', message);
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
          <View style={styles.orderItemHeaderLeft}>
            {!item.sent_to_kitchen && (
              <TouchableOpacity onPress={() => handleRemoveItem(item.id)}>
                <Text style={styles.orderItemRemove}>✕</Text>
              </TouchableOpacity>
            )}

            <Text
              style={styles.orderItemName}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.menu_item_name}
            </Text>
          </View>

          <View style={styles.orderItemHeaderRight}>
            {!item.sent_to_kitchen && (
              <View style={styles.orderItemQuantity}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => handleQuantityChange(item.id, -1)}
                >
                  <Text style={styles.quantityButtonText}>−</Text>
                </TouchableOpacity>

                <Text style={styles.quantityText}>{item.quantity}</Text>

                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => handleQuantityChange(item.id, 1)}
                >
                  <Text style={styles.quantityButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {item.modifiers.length > 0 && (
          <Text style={styles.orderItemModifiers}>
            {item.modifiers.map((m) => m.name).join(', ')}
          </Text>
        )}

        <View style={styles.orderItemFooter}>
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

          <View style={styles.orderFooter}>
            <TouchableOpacity
              style={[
                styles.submitButtonCompact,
                submitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmitOrder}
              disabled={submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Submitting...' : 'Send to Kitchen'}
              </Text>
            </TouchableOpacity>

            <View style={styles.orderTotalCompact}>
              <Text style={styles.orderTotalAmountCompact}>
                ₹{calculateOrderTotal().toFixed(2)}
              </Text>
            </View>
          </View>
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
    maxHeight: '52%',
    backgroundColor: LIGHT_GRAY,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  orderSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: DARK_GRAY,
    marginBottom: 8,
  },
  orderItemsList: {
    maxHeight: 280,
  },
  orderItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    position: 'relative',
  },
  orderItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
    gap: 8,
  },
  orderItemHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  orderItemHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 10,
  },
  orderItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: DARK_GRAY,
    flex: 1,
    minWidth: 0,
  },
  orderItemRemove: {
    fontSize: 18,
    color: BRAND_RED,
    paddingHorizontal: 4,
  },
  orderItemModifiers: {
    fontSize: 11,
    color: '#666666',
    marginBottom: 4,
  },
  orderItemFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  orderItemQuantity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BRAND_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK_GRAY,
    minWidth: 20,
    textAlign: 'center',
  },
  orderItemPrice: {
    fontSize: 15,
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
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#E0E0E0',
    marginTop: 4,
  },
  orderTotalCompact: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  orderTotalAmountCompact: {
    fontSize: 20,
    fontWeight: 'bold',
    color: BRAND_RED,
  },
  submitButtonCompact: {
    minWidth: 170,
    backgroundColor: BRAND_RED,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
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
