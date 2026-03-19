/**
 * KOT History Screen
 * Shows KOT (Kitchen Order Ticket) history for a specific table and order.
 * Each KOT is a batch of items sent to the kitchen at a particular time.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';

const PRIMARY_RED = '#f20d0d';
const DARK = '#1e293b';
const GRAY = '#64748b';
const LIGHT_BG = '#f8f5f5';
const WHITE = '#FFFFFF';
const BORDER = '#e2e8f0';

interface OrderItem {
  menuItemId?: string;
  menuItemName?: string;
  menu_item_name?: string;
  quantity: number;
  qty?: number;
  base_price: number;
  unitPrice?: number;
  total_price: number;
  lineTotal?: number;
  modifiers?: string | any[];
  category: 'food' | 'drink';
}

interface KOT {
  kotNumber: number;
  sentAt: number;
  items: OrderItem[];
  subtotal: number;
}

interface KOTHistoryScreenProps {
  tableId: string;
  tableName: string;
  orderId: string;
  onBack: () => void;
}

export default function KOTHistoryScreen({
  tableId,
  tableName,
  orderId,
  onBack,
}: KOTHistoryScreenProps) {
  const [kots, setKots] = useState<KOT[]>([]);
  const [loading, setLoading] = useState(true);
  const [grandTotal, setGrandTotal] = useState(0);

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'orders', orderId, 'kotHistory'),
      orderBy('kotNumber', 'asc')
    );
    unsubRef.current = onSnapshot(
      q,
      (snapshot) => {
        const kotGroups: KOT[] = snapshot.docs.map((d) => {
          const data = d.data() as any;
          const sentAt = Number(
            data.sent_at ||
              data.sentAt?.toMillis?.() ||
              data.createdAt?.toMillis?.() ||
              Date.now()
          );
          const rawItems = Array.isArray(data.items) ? data.items : [];
          const items: OrderItem[] = rawItems.map((item: any) => {
            const qty = Number(item.qty ?? item.quantity ?? 0);
            const unitPrice = Number(item.unitPrice ?? item.base_price ?? 0);
            const lineTotal = Number(item.lineTotal ?? qty * unitPrice);
            return {
              menuItemId: item.menuItemId,
              menuItemName: item.menuItemName,
              menu_item_name: item.menu_item_name,
              quantity: qty,
              qty,
              base_price: unitPrice,
              unitPrice,
              total_price: lineTotal,
              lineTotal,
              modifiers: item.modifiers || [],
              category: item.category || 'food',
            };
          });

          return {
            kotNumber: Number(data.kotNumber || 0),
            sentAt,
            items,
            subtotal: Number(
              data.subtotal ||
                items.reduce(
                  (sum, item) => sum + Number(item.total_price || 0),
                  0
                )
            ),
          };
        });

        setKots(kotGroups);
        setGrandTotal(
          kotGroups.reduce((sum, kot) => sum + Number(kot.subtotal || 0), 0)
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [orderId]);

  const formatTime = (ts: number): string => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderKOT = (kot: KOT) => (
    <View key={kot.kotNumber} style={styles.kotCard}>
      {/* KOT Header */}
      <View style={styles.kotHeader}>
        <View style={styles.kotBadge}>
          <Text style={styles.kotBadgeText}>KOT #{kot.kotNumber}</Text>
        </View>
        <Text style={styles.kotTime}>{formatTime(kot.sentAt)}</Text>
        <Text style={styles.kotSubtotal}>₹{kot.subtotal.toFixed(2)}</Text>
      </View>

      {/* Divider */}
      <View style={styles.dottedDivider} />

      {/* Items */}
      {kot.items.map((item) => {
        const mods = item.modifiers
          ? (() => {
              try {
                return Array.isArray(item.modifiers)
                  ? item.modifiers
                  : JSON.parse(item.modifiers as string);
              } catch {
                return [];
              }
            })()
          : [];
        const qty = Number(item.qty ?? item.quantity ?? 0);
        const lineTotal = Number(item.lineTotal ?? item.total_price ?? 0);
        const itemName = item.menuItemName || item.menu_item_name || 'Item';
        return (
          <View
            key={`${kot.kotNumber}-${item.menuItemId || itemName}`}
            style={styles.kotItem}
          >
            <View style={styles.kotItemLeft}>
              <Text style={styles.kotItemQty}>{qty}×</Text>
              <View>
                <Text style={styles.kotItemName}>{itemName}</Text>
                {mods.length > 0 && (
                  <Text style={styles.kotItemMods}>
                    {mods.map((m: any) => m.name).join(', ')}
                  </Text>
                )}
              </View>
            </View>
            <Text style={styles.kotItemPrice}>₹{lineTotal.toFixed(2)}</Text>
          </View>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>KOT History</Text>
          <Text style={styles.headerSub}>{tableName}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.kotCount}>
            {kots.length} KOT{kots.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={PRIMARY_RED} />
          <Text style={styles.loadingText}>Loading KOTs...</Text>
        </View>
      ) : kots.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🍽️</Text>
          <Text style={styles.emptyTitle}>No KOTs yet</Text>
          <Text style={styles.emptySubtitle}>
            No items have been sent to the kitchen for this table.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {kots.map(renderKOT)}
          </ScrollView>

          {/* Footer grand total */}
          <View style={styles.footer}>
            <Text style={styles.footerLabel}>Grand Total</Text>
            <Text style={styles.footerAmount}>₹{grandTotal.toFixed(2)}</Text>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: LIGHT_BG,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: DARK,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK,
  },
  headerSub: {
    fontSize: 12,
    color: GRAY,
    marginTop: 1,
  },
  headerRight: {
    width: 60,
    alignItems: 'flex-end',
  },
  kotCount: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY_RED,
    backgroundColor: 'rgba(242,13,13,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },

  /* Loading / Empty */
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: GRAY,
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: DARK,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: GRAY,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Scroll */
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },

  /* KOT Card */
  kotCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  kotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(242,13,13,0.04)',
  },
  kotBadge: {
    backgroundColor: PRIMARY_RED,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 10,
  },
  kotBadgeText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  kotTime: {
    flex: 1,
    fontSize: 13,
    color: GRAY,
    fontWeight: '500',
  },
  kotSubtotal: {
    fontSize: 15,
    fontWeight: '700',
    color: DARK,
  },
  dottedDivider: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderStyle: 'dashed',
    marginHorizontal: 16,
  },

  /* KOT items */
  kotItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  kotItemLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 10,
  },
  kotItemQty: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY_RED,
    minWidth: 28,
  },
  kotItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK,
    flexShrink: 1,
  },
  kotItemMods: {
    fontSize: 11,
    color: GRAY,
    marginTop: 2,
  },
  kotItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK,
    marginLeft: 8,
  },

  /* Footer */
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: WHITE,
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  footerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: GRAY,
  },
  footerAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: PRIMARY_RED,
  },
});
