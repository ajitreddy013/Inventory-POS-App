/**
 * Table Selection Screen - Restaurant Table Management Dashboard
 * 
 * Modern dashboard with section tabs, table cards, and action bottom sheet
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
  Animated
} from 'react-native';
import { getAll } from '../services/databaseHelpers';
import OfflineIndicator from '../components/OfflineIndicator';
import { useSyncStatus } from '../hooks/useSyncStatus';

// Theme Colors
const COLORS = {
  background: '#F5F5F5',
  white: '#FFFFFF',
  darkGray: '#2C3E50',
  mutedGray: '#95A5A6',
  lightGray: '#E8E8E8',
  brandRed: '#C0392B',
  yellow: '#F4D03F',
  green: '#82E0AA',
  alertRed: '#E74C3C'
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
}

interface TableSelectionScreenProps {
  waiterId: string;
  waiterName: string;
  onTableSelect: (tableId: string, tableName: string, orderId?: string) => void;
  onTableOperation: (tableId: string, tableName: string, operation: 'merge' | 'split' | 'transfer') => void;
  onLogout: () => void;
}

export default function TableSelectionScreen({
  waiterId,
  waiterName,
  onTableSelect,
  onTableOperation,
  onLogout
}: TableSelectionScreenProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const { status, pendingSyncCount } = useSyncStatus();
  const bottomSheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadSections();
    loadTables();
    
    // Update tables every 5 seconds
    const tableInterval = setInterval(() => {
      loadTables();
    }, 5000);

    // Update time every minute for elapsed time display
    const timeInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => {
      clearInterval(tableInterval);
      clearInterval(timeInterval);
    };
  }, []);

  const loadSections = async () => {
    try {
      const sectionsData = await getAll<Section>('sections', 'name ASC');
      setSections(sectionsData);
      if (sectionsData.length > 0) {
        setSelectedSection(sectionsData[0].id);
      }
    } catch (error) {
      console.error('Error loading sections:', error);
    }
  };

  const loadTables = async () => {
    try {
      const tablesData = await getAll<Table>('tables', 'name ASC');
      setTables(tablesData);
    } catch (error) {
      console.error('Error loading tables:', error);
    }
  };

  const getFilteredTables = () => {
    if (selectedSection === 'all') {
      return tables;
    }
    return tables.filter(table => table.section_id === selectedSection);
  };

  const getElapsedTime = (occupiedSince?: number): string => {
    if (!occupiedSince) return '';
    const elapsed = Math.floor((currentTime - occupiedSince) / 60000); // minutes
    return `${elapsed} min`;
  };

  const getTableColor = (table: Table): string => {
    if (table.status === 'available') return COLORS.lightGray;
    if (table.status === 'pending_bill') return COLORS.yellow;
    return COLORS.green;
  };

  const shouldShowAlert = (table: Table): boolean => {
    if (!table.occupied_since) return false;
    const elapsed = (currentTime - table.occupied_since) / 60000;
    return elapsed > 15; // Show alert if occupied for more than 15 minutes
  };

  const handleTablePress = (table: Table) => {
    if (table.status === 'available') {
      // Directly open order entry for empty tables
      onTableSelect(table.id, table.name);
    } else {
      // Show bottom sheet for occupied tables
      setSelectedTable(table);
      openBottomSheet();
    }
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

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={onLogout}>
        <Text style={styles.menuIcon}>☰</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>All Tables</Text>
      <View style={styles.headerIcons}>
        <TouchableOpacity style={styles.iconButton}>
          <Text style={styles.icon}>🔔</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton}>
          <Text style={styles.icon}>⚙</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSectionTabs = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.tabBar}
      contentContainerStyle={styles.tabBarContent}
    >
      <TouchableOpacity
        style={[styles.tab, selectedSection === 'all' && styles.tabActive]}
        onPress={() => setSelectedSection('all')}
      >
        <Text style={[styles.tabText, selectedSection === 'all' && styles.tabTextActive]}>
          All Tables
        </Text>
      </TouchableOpacity>
      {sections.map(section => (
        <TouchableOpacity
          key={section.id}
          style={[styles.tab, selectedSection === section.id && styles.tabActive]}
          onPress={() => setSelectedSection(section.id)}
        >
          <Text style={[styles.tabText, selectedSection === section.id && styles.tabTextActive]}>
            {section.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderTableCard = (table: Table) => {
    const backgroundColor = getTableColor(table);
    const showAlert = shouldShowAlert(table);
    const elapsedTime = getElapsedTime(table.occupied_since);

    return (
      <TouchableOpacity
        key={table.id}
        style={[styles.tableCard, { backgroundColor }]}
        onPress={() => handleTablePress(table)}
        activeOpacity={0.7}
      >
        {/* Alert Ribbon */}
        {showAlert && <View style={styles.alertRibbon} />}

        {/* Elapsed Time */}
        {table.status !== 'available' && elapsedTime && (
          <Text style={styles.elapsedTime}>{elapsedTime}</Text>
        )}

        {/* Table ID */}
        <Text style={styles.tableId}>{table.name}</Text>

        {/* Bill Amount / Order ID */}
        {table.current_order_id && (
          <Text style={styles.billAmount}>#{table.current_order_id.slice(0, 6)}</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderTableGrid = () => {
    const filteredTables = getFilteredTables();
    
    if (filteredTables.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No tables in this section</Text>
        </View>
      );
    }

    return (
      <View style={styles.tableGrid}>
        {filteredTables.map(table => renderTableCard(table))}
      </View>
    );
  };

  const renderBottomSheet = () => {
    if (!showBottomSheet || !selectedTable) return null;

    const translateY = bottomSheetAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [600, 0]
    });

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
            {/* Handle Bar */}
            <View style={styles.handleBar} />

            {/* Header */}
            <Text style={styles.bottomSheetTitle}>
              Table No: {selectedTable.name}
            </Text>

            {/* Action Buttons */}
            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => {
                  closeBottomSheet();
                  onTableSelect(selectedTable.id, selectedTable.name, selectedTable.current_order_id);
                }}
              >
                <Text style={styles.actionIcon}>📋</Text>
                <Text style={styles.actionLabel}>View KOT(s)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => {
                  closeBottomSheet();
                  onTableOperation(selectedTable.id, selectedTable.name, 'transfer');
                }}
              >
                <Text style={styles.actionIcon}>↔️</Text>
                <Text style={styles.actionLabel}>Move Table</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => {
                  closeBottomSheet();
                  onTableOperation(selectedTable.id, selectedTable.name, 'merge');
                }}
              >
                <Text style={styles.actionIcon}>🔗</Text>
                <Text style={styles.actionLabel}>Merge Table</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => {
                  closeBottomSheet();
                  onTableOperation(selectedTable.id, selectedTable.name, 'split');
                }}
              >
                <Text style={styles.actionIcon}>✂️</Text>
                <Text style={styles.actionLabel}>Split Bill</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <OfflineIndicator status={status} pendingSyncCount={pendingSyncCount} />
      
      {renderHeader()}
      {renderSectionTabs()}
      
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {renderTableGrid()}
      </ScrollView>

      {renderBottomSheet()}
    </View>
  );
}

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2; // 2 columns with 16px padding on sides and 16px gap

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
    paddingVertical: 16,
    paddingTop: 48,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray
  },
  menuIcon: {
    fontSize: 24,
    color: COLORS.darkGray
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.darkGray
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 12
  },
  iconButton: {
    padding: 4
  },
  icon: {
    fontSize: 20
  },
  tabBar: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    marginBottom: 0
  },
  tabBarContent: {
    paddingHorizontal: 16,
    gap: 24
  },
  tab: {
    paddingVertical: 16,
    paddingHorizontal: 4
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.brandRed
  },
  tabText: {
    fontSize: 14,
    color: COLORS.mutedGray,
    fontWeight: '500'
  },
  tabTextActive: {
    color: COLORS.darkGray,
    fontWeight: '600'
  },
  content: {
    flex: 1
  },
  contentContainer: {
    padding: 16,
    paddingTop: 0,
    flexGrow: 0
  },
  tableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 16
  },
  tableCard: {
    width: cardWidth,
    aspectRatio: 1,
    borderRadius: 12,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  alertRibbon: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: 40,
    borderRightWidth: 40,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopColor: COLORS.alertRed,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderTopRightRadius: 12
  },
  elapsedTime: {
    position: 'absolute',
    top: 12,
    left: 12,
    fontSize: 12,
    color: COLORS.darkGray,
    fontWeight: '400'
  },
  tableId: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.darkGray,
    marginBottom: 8
  },
  billAmount: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.darkGray
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.mutedGray
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
    minHeight: 300
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
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.darkGray,
    textAlign: 'center',
    marginBottom: 24
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16
  },
  actionCard: {
    width: (width - 64) / 2,
    aspectRatio: 1.5,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.brandRed,
    textAlign: 'center'
  }
});
