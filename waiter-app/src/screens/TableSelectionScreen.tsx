/**
 * Table Selection Screen - Restaurant Table Management Dashboard
 * 
 * Modern dashboard with horizontal section tabs (red underline) and table grid
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
  RefreshControl,
  Animated,
  Dimensions,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getAll, query as dbQuery } from '../services/databaseHelpers';
import OfflineIndicator from '../components/OfflineIndicator';
import { useSyncStatus } from '../hooks/useSyncStatus';

// Theme Colors
const COLORS = {
  background: '#f8f5f5',
  white: '#FFFFFF',
  darkGray: '#1e293b',
  textSecondary: '#64748b',
  mutedGray: '#94a3b8',
  lightGray: '#e2e8f0',
  iconBg: 'transparent', // Header icons are transparent in design
  primary: '#f20d0d', // Stitch primary red
  greenAvailable: '#10b981',
  yellowOccupied: '#f59e0b',
  cardAvailableBg: 'rgba(16, 185, 129, 0.1)', // 10% opacity green
  cardOccupiedBg: 'rgba(245, 158, 11, 0.1)', // 10% opacity yellow
  cardShadow: '#000000'
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
  onTableOperation: (tableId: string, tableName: string, operation: 'merge' | 'split' | 'transfer') => void;
  onLogout: () => void;
}

export default function TableSelectionScreen({
  waiterId,
  waiterName,
  onTableSelect,
  onViewKOT,
  onTableOperation,
  onLogout
}: TableSelectionScreenProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const { status, pendingSyncCount } = useSyncStatus();
  const bottomSheetAnim = useRef(new Animated.Value(0)).current;
  
  // For tab indicator animation
  const [tabIndicatorPosition, setTabIndicatorPosition] = useState(0);
  const [tabWidth, setTabWidth] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const tabRefs = useRef<{ [key: string]: View }>({});

  useEffect(() => {
    const initLoad = async () => {
      await Promise.all([loadSections(), loadTables()]);
      setIsLoading(false);
    };
    initLoad();
    
    const tableInterval = setInterval(() => {
      loadTables();
    }, 5000);

    const timeInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => {
      clearInterval(tableInterval);
      clearInterval(timeInterval);
    };
  }, []);

  useEffect(() => {
    // Set initial section to first one if available
    if (sections.length > 0 && selectedSectionId === 'all') {
      setSelectedSectionId(sections[0].id);
    }
  }, [sections]);

  const loadSections = async () => {
    try {
      const sectionsData = await getAll<Section>('sections', 'name ASC');
      setSections(sectionsData);
    } catch (error) {
      console.error('Error loading sections:', error);
    }
  };

  const loadTables = async () => {
    try {
      const tablesData = await getAll<Table>('tables', 'name ASC');

      const tablesWithBills = await Promise.all(
        tablesData.map(async (table) => {
          if (table.current_order_id && table.status !== 'available') {
            try {
              const items = await dbQuery<any>(
                'order_items',
                'order_id = ? AND sent_to_kitchen = 1',
                [table.current_order_id]
              );
              const totalAmount = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
              return { ...table, billAmount: totalAmount };
            } catch (err) {
              console.error(`Error loading bill for table ${table.id}:`, err);
              return table;
            }
          }
          return table;
        })
      );

      setTables(tablesWithBills);
    } catch (error) {
      console.error('Error loading tables:', error);
    }
  };

  const getElapsedTime = (occupiedSince?: number): string | null => {
    if (!occupiedSince) return null;
    const elapsed = Math.floor((currentTime - occupiedSince) / 60000);
    return `${elapsed} min`;
  };

  const getTableStatusColor = (tableStatus: string): string => {
    switch (tableStatus) {
      case 'available':
        return COLORS.greenAvailable;
      case 'occupied':
        return COLORS.yellowOccupied;
      case 'pending_bill':
        return COLORS.primary;
      default:
        return COLORS.greenAvailable;
    }
  };

  const getStatusText = (tableStatus: string): string => {
    switch (tableStatus) {
      case 'available':
        return 'Available';
      case 'occupied':
        return 'Occupied';
      case 'pending_bill':
        return 'Bill Pending';
      default:
        return '';
    }
  };

  const getCardStyle = (table: Table) => {
    if (table.status === 'available') {
      return {
        backgroundColor: COLORS.cardAvailableBg,
        borderColor: COLORS.greenAvailable,
      };
    }
    return {
      backgroundColor: COLORS.cardOccupiedBg,
      borderColor: COLORS.yellowOccupied,
    };
  };

  const hasAlertRibbon = (table: Table): boolean => {
    return false; // Placeholder, implement actual logic if needed
  };

  const handleTablePress = (table: Table) => {
    if (table.status === 'available') {
      onTableSelect(table.id, table.name);
    } else {
      setSelectedTable(table);
      openBottomSheet();
    }
  };

  const handleSectionPress = (sectionId: string) => {
    setSelectedSectionId(sectionId);
  };

  const openBottomSheet = () => {
    setShowBottomSheet(true);
    Animated.spring(bottomSheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 8
    }).start();
  };

  const closeBottomSheet = () => {
    Animated.timing(bottomSheetAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true
    }).start(() => {
      setShowBottomSheet(false);
      setSelectedTable(null);
    });
  };

  const filteredTables = selectedSectionId === 'all' 
    ? tables 
    : tables.filter(t => t.section_id === selectedSectionId);

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => console.log('Menu Tapped')} style={styles.menuButton}>
        <Text style={styles.menuIcon}>≡</Text>
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { textAlign: 'center' }]}>Table Selection</Text>
      <View style={styles.headerIcons}>
        <TouchableOpacity style={styles.iconButton}>
          <Text style={styles.icon}>🔔</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={() => setShowProfilePopup(!showProfilePopup)}
        >
          <Text style={styles.dotsIcon}>⋮</Text>
        </TouchableOpacity>
      </View>
      
      {/* Profile Popup Menu */}
      {showProfilePopup && (
        <View style={styles.profilePopup}>
          <View style={styles.profilePopupHeader}>
            <Text style={styles.profilePopupName}>{waiterName || 'John Doe'}</Text>
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
            <Text style={styles.profilePopupActionIcon}>➜</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderSectionTabs = () => (
    <View style={styles.tabContainer}>
      <ScrollView 
        ref={scrollViewRef}
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {sections.map((section, index) => {
          const isActive = selectedSectionId === section.id;
          return (
            <TouchableOpacity
              key={section.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => handleSectionPress(section.id)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {section.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderTableCard = (table: Table) => {
    const isOccupied = table.status !== 'available';
    const cardStyle = getCardStyle(table);
    const elapsedTime = getElapsedTime(table.occupied_since);
    const showRibbon = hasAlertRibbon(table);

    return (
      <TouchableOpacity
        key={table.id}
        style={[styles.tableCardContainer, cardStyle]}
        onPress={() => handleTablePress(table)}
        activeOpacity={0.8}
      >
        {/* Folded Ribbon */}
        {showRibbon && (
          <View style={styles.alertRibbon} />
        )}

        {/* Card Content Wrapper */}
        <View style={styles.cardContent}>
          {/* Elapsed Time / Order ID Top */}
          {isOccupied ? (
            <Text style={styles.elapsedTime}>{elapsedTime || '0 min'}</Text>
          ) : (
            <Text style={[styles.elapsedTime, { color: COLORS.greenAvailable, opacity: 0 }]}>0 min</Text>
          )}

          {/* Table Name */}
          <Text style={styles.tableId}>
            {table.name}
          </Text>

          {/* Order/Bill ID */}
          {table.current_order_id && table.billAmount !== undefined ? (
            <Text style={styles.billAmount}>₹{table.billAmount.toFixed(2)}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} />
      ) : (
        <>
          <Text style={styles.emptyIcon}>🪑</Text>
          <Text style={styles.emptyText}>No tables available</Text>
          <Text style={styles.emptySubtext}>Tables will appear here once added</Text>
        </>
      )}
    </View>
  );

  const renderBottomSheet = () => {
    if (!showBottomSheet || !selectedTable) return null;

    const translateY = bottomSheetAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [600, 0]
    });

    const statusColor = getTableStatusColor(selectedTable.status);

    return (
      <Modal
        visible={showBottomSheet}
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
              Table No: {selectedTable.name}
            </Text>
            <View style={[styles.statusInfo, { backgroundColor: statusColor + '15' }]}>
              <Text style={[styles.statusInfoText, { color: statusColor }]}>
                {getStatusText(selectedTable.status)}
              </Text>
            </View>
            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => {
                  closeBottomSheet();
                  onViewKOT(selectedTable.id, selectedTable.name, selectedTable.current_order_id);
                }}
              >
                <Text style={styles.actionIcon}>🧾</Text>
                <Text style={styles.actionLabel}>View KOT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => {
                  closeBottomSheet();
                  onTableOperation(selectedTable.id, selectedTable.name, 'transfer');
                }}
              >
                <Text style={styles.actionIcon}>↔️</Text>
                <Text style={styles.actionLabel}>Transfer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => {
                  closeBottomSheet();
                  onTableOperation(selectedTable.id, selectedTable.name, 'merge');
                }}
              >
                <Text style={styles.actionIcon}>🔗</Text>
                <Text style={styles.actionLabel}>Merge</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => {
                  closeBottomSheet();
                  onTableOperation(selectedTable.id, selectedTable.name, 'split');
                }}
              >
                <Text style={styles.actionIcon}>✂️</Text>
                <Text style={styles.actionLabel}>Split</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {/* Full-screen transparent backdrop — closes popup when tapping anywhere */}
      {showProfilePopup && (
        <Pressable
          style={[StyleSheet.absoluteFillObject, { zIndex: 10 }]}
          onPress={() => setShowProfilePopup(false)}
        />
      )}

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.logoutModalContainer}>
            <Text style={styles.logoutModalTitle}>Logout</Text>
            <Text style={styles.logoutModalBody}>
              Are you sure you want to logout? Please confirm you wish to sign out of your session.
            </Text>
            <View style={styles.logoutModalActions}>
              <TouchableOpacity
                style={styles.logoutModalCancel}
                onPress={() => setShowLogoutConfirm(false)}
              >
                <Text style={styles.logoutModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.logoutModalConfirm}
                onPress={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
              >
                <Text style={styles.logoutModalConfirmText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Synchronizer Offline Indicator */}
      <OfflineIndicator status={status} pendingSyncCount={pendingSyncCount} />
      {renderHeader()}
      {renderSectionTabs()}

      <FlatList
        data={filteredTables}
        keyExtractor={item => item.id}
        renderItem={({ item }) => renderTableCard(item)}
        numColumns={3}
        contentContainerStyle={[styles.gridContent, isLoading && { flex: 1, justifyContent: 'center' }]}
        columnWrapperStyle={styles.gridRow}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      {renderBottomSheet()}
    </View>
  );
}

const { width } = Dimensions.get('window');
const cardSpacing = 12;
const cardWidth = Math.floor((width - 32 - (cardSpacing * 2)) / 3);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  menuButton: {
    padding: 4,
  },
  menuIcon: {
    fontSize: 28,
    color: COLORS.darkGray,
    fontWeight: '300'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.darkGray,
    flex: 1,
    // marginLeft: 8, // Removed as textAlign: 'center' is used
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  iconButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
    color: COLORS.textSecondary
  },
  dotsIcon: {
    fontSize: 24,
    color: COLORS.textSecondary,
  },
  tabContainer: {
    backgroundColor: COLORS.white,
    // shadowColor: '#000', // Removed shadow
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.08,
    // shadowRadius: 4,
    // elevation: 2,
  },
  tabBar: {
    backgroundColor: COLORS.white,
    maxHeight: 55,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  tabBarContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tab: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginRight: 16,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.primary
  },
  tabText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '700',
    // textTransform: 'uppercase', // Removed textTransform
    // letterSpacing: 0.5, // Removed letterSpacing
  },
  tabTextActive: {
    color: '#0f172a', /* Dark slate for active tab text in standard mode */
  },
  // tabIndicatorContainer: { // Removed
  //   height: 3,
  //   backgroundColor: COLORS.white,
  // },
  // tabIndicator: { // Removed
  //   height: 3,
  //   backgroundColor: COLORS.brandRed,
  //   borderRadius: 2,
  // },
  gridContent: {
    padding: 16,
    paddingBottom: 100,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: cardSpacing,
  },
  tableCardContainer: {
    width: cardWidth,
    aspectRatio: 1,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden', // For the ribbon
    justifyContent: 'center',
    padding: 16,
  },
  alertRibbon: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderRightWidth: 30,
    borderTopWidth: 30,
    borderRightColor: 'transparent',
    borderTopColor: COLORS.primary, // Red color for the ribbon
    transform: [{ rotate: '90deg' }],
    zIndex: 1,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableId: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.darkGray,
    marginBottom: 4,
    textAlign: 'center',
  },
  elapsedTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  billAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.darkGray,
    textAlign: 'center',
  },
  // Profile Popup Styling
  profilePopup: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 200,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    shadowColor: COLORS.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 100,
    overflow: 'hidden',
  },
  profilePopupHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  profilePopupName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  profilePopupRole: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  profilePopupAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: COLORS.white,
  },
  profilePopupActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  profilePopupActionIcon: {
    fontSize: 18,
    color: COLORS.primary,
  },
  
  // Logout Modal Styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoutModalContainer: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  logoutModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.darkGray,
    marginBottom: 8,
  },
  logoutModalBody: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  logoutModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  logoutModalCancel: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutModalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  logoutModalConfirm: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutModalConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  //   fontWeight: '700',
  //   textTransform: 'uppercase',
  //   letterSpacing: 0.5,
  // },
  // orderId: { // Removed
  //   fontSize: 11,
  //   color: COLORS.mutedGray,
  //   fontWeight: '600',
  //   marginTop: 2,
  // },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.darkGray,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.mutedGray,
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  bottomSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    minHeight: 350 // Adjusted minHeight
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.mutedGray,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20
  },
  bottomSheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.darkGray,
    textAlign: 'center',
    marginBottom: 12
  },
  statusInfo: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 20,
  },
  statusInfoText: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  actionCard: {
    width: (width - 64) / 2,
    aspectRatio: 1.4,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: 8
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.darkGray,
    textAlign: 'center'
  }
});
