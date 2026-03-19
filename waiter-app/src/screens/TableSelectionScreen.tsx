/**
 * Table Selection Screen - Restaurant Table Management Dashboard
 * Modern 3-column grid with section tabs, profile popup, and logout flow
 * Stitch-inspired fresh design
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
  Dimensions,
  Animated,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { getAll, query as dbQuery } from '../services/databaseHelpers';
import OfflineIndicator from '../components/OfflineIndicator';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

// Stitch-inspired fresh color palette
const COLORS = {
  background: '#F8F9FA',
  white: '#FFFFFF',
  darkGray: '#212529',
  textSecondary: '#6C757D',
  mutedGray: '#ADB5BD',
  lightGray: '#DEE2E6',
  primary: '#DC3545', // Stitch red
  primaryLight: '#FFEBEE',
  greenAvailable: '#28A745',
  greenLight: '#D4EDDA',
  amberOccupied: '#FFC107',
  amberLight: '#FFF3CD',
  redPending: '#DC3545',
  redLight: '#F8D7DA',
  cardBorder: '#E9ECEF',
};

interface Section {
  id: string;
  name: string;
}

interface Table {
  id: string;
  name: string;
  section_id: string;
  status: 'available' | 'occupied' | 'pending_bill';
  current_order_id?: string;
  occupied_since?: number;
  billAmount?: number;
}

interface TableSelectionScreenProps {
  waiterId: string;
  waiterName: string;
  onTableSelect: (tableId: string, tableName: string, orderId?: string) => void;
  onViewKOT: (tableId: string, tableName: string, orderId?: string) => void;
  onTableOperation: (
    tableId: string,
    tableName: string,
    operation: 'merge' | 'split' | 'transfer'
  ) => void;
  onLogout: () => void;
}

const { width } = Dimensions.get('window');
const CARD_GAP = 10;
const ACTION_CARD_WIDTH = (width - 64) / 2;
const GRID_PADDING = 16;
const cardWidth = Math.floor((width - GRID_PADDING * 2 - CARD_GAP * 2) / 3);

export default function TableSelectionScreen({
  waiterId,
  waiterName,
  onTableSelect,
  onViewKOT,
  onTableOperation,
  onLogout,
}: TableSelectionScreenProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const { status, pendingSyncCount } = useSyncStatus();
  const bottomSheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Load sections once from SQLite (synced on startup)
    const initLoad = async () => {
      await loadSections();
      setIsLoading(false);
    };
    initLoad();

    // Real-time listener for tables — use snapshot data directly, no extra getDocs call
    const unsubscribe = onSnapshot(collection(db, 'tables'), (snapshot) => {
      const tablesData: Table[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Table));
      const tablesWithBills = tablesData.map(table => ({
        ...table,
        billAmount: (table as any).currentBillAmount || (table as any).current_bill_amount || 0,
      }));
      setTables(tablesWithBills.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
    });

    const timeInterval = setInterval(() => setCurrentTime(Date.now()), 60000);

    return () => {
      unsubscribe();
      clearInterval(timeInterval);
    };
  }, []);

  useEffect(() => {
    if (sections.length > 0 && selectedSectionId === 'all') {
      setSelectedSectionId(sections[0].id);
    }
  }, [sections]);

  const loadSections = async () => {
    try {
      const data = await getAll<Section>('sections', 'name ASC');
      setSections(data);
    } catch (error) {
      console.error('Error loading sections from SQLite:', error);
    }
  };


  const getElapsedTime = (table: Table): string | null => {
    const occupiedSince =
      (table as any).occupiedSince || (table as any).occupied_since;
    if (!occupiedSince) return null;
    const ts =
      typeof occupiedSince === 'object' && occupiedSince.seconds
        ? occupiedSince.seconds * 1000
        : Number(occupiedSince);
    const elapsed = Math.floor((currentTime - ts) / 60000);
    return `${elapsed} min`;
  };

  const getTableColor = (table: Table): string => {
    const status = table.status || 'available';
    if (status === 'available') return '#82E0AA';
    if (status === 'pending_bill') return '#E74C3C';
    return '#F4D03F';
  };

  const getStatusColor = (tableStatus: string): string => {
    switch (tableStatus) {
      case 'available':
        return COLORS.greenAvailable;
      case 'occupied':
        return COLORS.amberOccupied;
      case 'pending_bill':
        return COLORS.redPending;
      default:
        return COLORS.greenAvailable;
    }
  };

  const getCardBg = (tableStatus: string) => {
    switch (tableStatus) {
      case 'available':
        return COLORS.greenLight;
      case 'occupied':
        return COLORS.amberLight;
      case 'pending_bill':
        return COLORS.redLight;
      default:
        return COLORS.white;
    }
  };

  const handleTablePress = (table: Table) => {
    // Single tap should always open the order/menu screen.
    onTableSelect(table.id, table.name, table.current_order_id);
  };

  const handleTableLongPress = (table: Table) => {
    // Long press opens quick table operations.
    setSelectedTable(table);
    openBottomSheet();
  };

  const openBottomSheet = () => {
    setShowBottomSheet(true);
    Animated.spring(bottomSheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  };

  const closeBottomSheet = () => {
    Animated.timing(bottomSheetAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowBottomSheet(false);
      setSelectedTable(null);
    });
  };

  const [showBottomSheet, setShowBottomSheet] = useState(false);

  const filteredTables =
    selectedSectionId === 'all'
      ? tables
      : tables.filter((t) => t.section_id === selectedSectionId);

  // ─── Header ─────────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => {}} style={styles.menuButton}>
        <Text style={styles.menuIcon}>☰</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Tables</Text>
      <View style={styles.headerIcons}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => {
            Alert.alert(
              'Reset Database',
              'Clear local cache and sync fresh data from server?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Reset',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const { resetDatabase } =
                        await import('../services/databaseReset');
                      await resetDatabase();
                      Alert.alert(
                        'Database Reset',
                        'Please reload the app now (shake device → Reload)',
                        [{ text: 'OK' }]
                      );
                    } catch (error) {
                      Alert.alert('Error', 'Failed to reset database');
                    }
                  },
                },
              ]
            );
          }}
        >
          <Text style={styles.icon}>🔄</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton}>
          <Text style={styles.icon}>🔔</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setShowProfilePopup(!showProfilePopup)}
        >
          <Text style={styles.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      {/* Profile Popup */}
      {showProfilePopup && (
        <View style={styles.profilePopup}>
          <View style={styles.profilePopupHeader}>
            <Text style={styles.profilePopupName}>
              {waiterName || 'Waiter'}
            </Text>
            <Text style={styles.profilePopupRole}>Waiter</Text>
          </View>
          <TouchableOpacity
            style={styles.profilePopupAction}
            onPress={() => {
              setShowProfilePopup(false);
              setShowLogoutConfirm(true);
            }}
          >
            <Text style={styles.profilePopupActionText}>Logout</Text>
            <Text style={styles.profilePopupActionIcon}>→</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // ─── Section Tabs ─────────────────────────────────────────────────────────────
  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {sections.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.tab, selectedSectionId === s.id && styles.tabActive]}
            onPress={() => setSelectedSectionId(s.id)}
          >
            <Text
              style={[
                styles.tabText,
                selectedSectionId === s.id && styles.tabTextActive,
              ]}
            >
              {s.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // ─── Table Card ───────────────────────────────────────────────────────────────
  const renderTableCard = (table: Table) => {
    const backgroundColor = getTableColor(table);
    const elapsedTime = getElapsedTime(table);
    const isOccupied = table.status !== 'available';

    return (
      <TouchableOpacity
        key={table.id}
        style={[styles.tableCard, { backgroundColor }]}
        onPress={() => handleTablePress(table)}
        onLongPress={() => handleTableLongPress(table)}
        delayLongPress={280}
        activeOpacity={0.7}
      >
        {/* Three rows layout */}
        <View style={styles.cardContent}>
          {/* Row 1: Elapsed Time (only if occupied) */}
          {isOccupied && elapsedTime && (
            <Text style={styles.elapsedTime}>{elapsedTime}</Text>
          )}

          {/* Row 2: Table Number (large, centered) */}
          <Text style={styles.tableId}>{table.name}</Text>

          {/* Row 3: Bill Amount (only if occupied and has bill amount) */}
          {isOccupied &&
            table.billAmount !== undefined &&
            table.billAmount > 0 && (
              <Text style={styles.billAmount}>₹{table.billAmount}</Text>
            )}
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Empty State ─────────────────────────────────────────────────────────────
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} />
      ) : (
        <>
          <Text style={styles.emptyIcon}>🪑</Text>
          <Text style={styles.emptyText}>No tables</Text>
          <Text style={styles.emptySubtext}>Tables will appear here</Text>
        </>
      )}
    </View>
  );

  // ─── Bottom Sheet ─────────────────────────────────────────────────────────────
  const renderBottomSheet = () => {
    if (!showBottomSheet || !selectedTable) return null;
    const translateY = bottomSheetAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [600, 0],
    });
    const statusColor = getStatusColor(selectedTable.status);

    return (
      <Modal
        visible
        transparent
        animationType="none"
        onRequestClose={closeBottomSheet}
      >
        <Pressable style={styles.bottomSheetOverlay} onPress={closeBottomSheet}>
          <Animated.View
            style={[styles.bottomSheet, { transform: [{ translateY }] }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.handleBar} />
            <Text style={styles.bottomSheetTitle}>
              Table {selectedTable.name}
            </Text>

            <View
              style={[
                styles.statusInfoBadge,
                { backgroundColor: statusColor + '15' },
              ]}
            >
              <Text style={[styles.statusInfoText, { color: statusColor }]}>
                {selectedTable.status === 'available'
                  ? 'Available'
                  : selectedTable.status === 'occupied'
                    ? 'Occupied'
                    : 'Bill Pending'}
              </Text>
            </View>

            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => {
                  closeBottomSheet();
                  onViewKOT(
                    selectedTable.id,
                    selectedTable.name,
                    selectedTable.current_order_id
                  );
                }}
              >
                <Text style={styles.actionIcon}>🧾</Text>
                <Text style={styles.actionLabel}>View KOT</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => {
                  closeBottomSheet();
                  onTableOperation(
                    selectedTable.id,
                    selectedTable.name,
                    'transfer'
                  );
                }}
              >
                <Text style={styles.actionIcon}>↔️</Text>
                <Text style={styles.actionLabel}>Transfer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => {
                  closeBottomSheet();
                  onTableOperation(
                    selectedTable.id,
                    selectedTable.name,
                    'merge'
                  );
                }}
              >
                <Text style={styles.actionIcon}>🔗</Text>
                <Text style={styles.actionLabel}>Merge</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    );
  };

  // ─── Main Render ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Full-screen backdrop to dismiss popup */}
      {showProfilePopup && (
        <Pressable
          style={[StyleSheet.absoluteFillObject, { zIndex: 10 }]}
          onPress={() => setShowProfilePopup(false)}
        />
      )}

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.logoutModal}>
            <Text style={styles.logoutTitle}>Logout</Text>
            <Text style={styles.logoutBody}>
              Are you sure you want to logout?
            </Text>
            <View style={styles.logoutActions}>
              <TouchableOpacity
                style={styles.logoutCancel}
                onPress={() => setShowLogoutConfirm(false)}
              >
                <Text style={styles.logoutCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.logoutConfirm}
                onPress={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
              >
                <Text style={styles.logoutConfirmText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Offline Indicator */}
      <OfflineIndicator status={status} pendingSyncCount={pendingSyncCount} />

      {/* Header */}
      {renderHeader()}

      {/* Tabs */}
      {renderTabs()}

      {/* Table Grid */}
      <FlatList
        data={filteredTables}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderTableCard(item)}
        numColumns={3}
        contentContainerStyle={[
          styles.gridContent,
          isLoading && { flex: 1, justifyContent: 'center' },
        ]}
        columnWrapperStyle={styles.gridRow}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      {/* Bottom Sheet */}
      {renderBottomSheet()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  menuButton: { padding: 4 },
  menuIcon: { fontSize: 24, color: COLORS.primary, fontWeight: '600' },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.darkGray,
    flex: 1,
    marginLeft: 8,
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 18,
  },
  icon: { fontSize: 18 },
  profileIcon: { fontSize: 20 },

  // Profile Popup
  profilePopup: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 180,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
    overflow: 'hidden',
  },
  profilePopupHeader: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  profilePopupName: { fontSize: 15, fontWeight: '700', color: COLORS.darkGray },
  profilePopupRole: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  profilePopupAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  profilePopupActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  profilePopupActionIcon: { fontSize: 16, color: COLORS.primary },

  // Section Tabs
  tabContainer: {
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBar: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  tabBarContent: { paddingHorizontal: 16, gap: 24 },
  tab: {
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#E74C3C',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.mutedGray,
  },
  tabTextActive: {
    color: COLORS.darkGray,
    fontWeight: '600',
  },

  // Grid
  gridContent: { padding: GRID_PADDING, paddingBottom: 80 },
  gridRow: {
    justifyContent: 'flex-start',
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },

  // Table Card
  tableCard: {
    width: cardWidth,
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  cardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
    paddingVertical: 8,
  },
  elapsedTime: {
    fontSize: 10,
    color: '#2C3E50',
    fontWeight: '600',
    marginBottom: 2,
  },
  tableId: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2C3E50',
    textAlign: 'center',
    marginVertical: 4,
    letterSpacing: 0.5,
  },
  billAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2C3E50',
    marginTop: 2,
    letterSpacing: 0.3,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: COLORS.darkGray },
  emptySubtext: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },

  // Bottom Sheet
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.mutedGray,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.darkGray,
    textAlign: 'center',
    marginBottom: 12,
  },
  statusInfoBadge: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 20,
  },
  statusInfoText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    width: ACTION_CARD_WIDTH,
    aspectRatio: 1.5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  actionIcon: { fontSize: 26, marginBottom: 6 },
  actionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.darkGray },

  // Logout Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoutModal: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
  },
  logoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.darkGray,
    marginBottom: 8,
    textAlign: 'center',
  },
  logoutBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
    textAlign: 'center',
  },
  logoutActions: { flexDirection: 'row', gap: 12 },
  logoutCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  logoutCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  logoutConfirm: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutConfirmText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});
