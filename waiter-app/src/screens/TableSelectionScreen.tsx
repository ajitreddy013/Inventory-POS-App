/**
 * Table Selection Screen - All Tables Dashboard
 * 
 * Shows tables grouped by sections with real-time status updates
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Dimensions
} from 'react-native';
import { getAll, query as dbQuery } from '../services/databaseHelpers';
import OfflineIndicator from '../components/OfflineIndicator';
import { useSyncStatus } from '../hooks/useSyncStatus';

const BRAND_RED = '#C0392B';
const DARK_GRAY = '#2C3E50';
const LIGHT_GRAY = '#F5F6FA';
const YELLOW = '#F9E79F';
const GREEN = '#A9DFBF';

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
  const { status, pendingSyncCount } = useSyncStatus();

  useEffect(() => {
    loadSections();
    loadTables();
    
    // Set up real-time updates (polling every 5 seconds)
    const interval = setInterval(() => {
      loadTables();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

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

  const getTableColor = (table: Table) => {
    if (table.status === 'available') {
      return LIGHT_GRAY;
    }

    if (!table.occupied_since) {
      return YELLOW;
    }

    const elapsedMinutes = (Date.now() - table.occupied_since) / (1000 * 60);
    
    if (elapsedMinutes >= 60) {
      return GREEN; // Urgent - 60+ minutes
    } else {
      return YELLOW; // Moderate - less than 60 minutes
    }
  };

  const getElapsedTime = (table: Table): string => {
    if (table.status === 'available' || !table.occupied_since) {
      return '';
    }

    const elapsedMinutes = Math.floor((Date.now() - table.occupied_since) / (1000 * 60));
    
    if (elapsedMinutes < 1) {
      return 'Just started';
    } else if (elapsedMinutes < 60) {
      return `${elapsedMinutes} min`;
    } else {
      const hours = Math.floor(elapsedMinutes / 60);
      const mins = elapsedMinutes % 60;
      return `${hours}h ${mins}m`;
    }
  };

  const handleTablePress = (table: Table) => {
    if (table.status === 'available') {
      // Empty table - go directly to order screen
      onTableSelect(table.id, table.name);
    } else {
      // Occupied table - go to order screen to add items
      onTableSelect(table.id, table.name, table.current_order_id);
    }
  };

  const handleTableLongPress = (table: Table) => {
    if (table.status !== 'available') {
      setSelectedTable(table);
      setShowBottomSheet(true);
    }
  };

  const handleViewKOTs = () => {
    setShowBottomSheet(false);
    // Navigate to KOT list screen
    // TODO: Implement navigation
  };

  const handleMergeTables = () => {
    if (selectedTable) {
      setShowBottomSheet(false);
      onTableOperation(selectedTable.id, selectedTable.name, 'merge');
    }
  };

  const handleSplitTable = () => {
    if (selectedTable) {
      setShowBottomSheet(false);
      onTableOperation(selectedTable.id, selectedTable.name, 'split');
    }
  };

  const handleTransferTable = () => {
    if (selectedTable) {
      setShowBottomSheet(false);
      onTableOperation(selectedTable.id, selectedTable.name, 'transfer');
    }
  };

  const renderSectionTabs = () => {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sectionTabs}
        contentContainerStyle={styles.sectionTabsContent}
      >
        <TouchableOpacity
          style={[
            styles.sectionTab,
            selectedSection === 'all' && styles.sectionTabActive
          ]}
          onPress={() => setSelectedSection('all')}
        >
          <Text
            style={[
              styles.sectionTabText,
              selectedSection === 'all' && styles.sectionTabTextActive
            ]}
          >
            All Tables
          </Text>
        </TouchableOpacity>

        {sections.map(section => (
          <TouchableOpacity
            key={section.id}
            style={[
              styles.sectionTab,
              selectedSection === section.id && styles.sectionTabActive
            ]}
            onPress={() => setSelectedSection(section.id)}
          >
            <Text
              style={[
                styles.sectionTabText,
                selectedSection === section.id && styles.sectionTabTextActive
              ]}
            >
              {section.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderTableCard = (table: Table) => {
    const backgroundColor = getTableColor(table);
    const elapsedTime = getElapsedTime(table);
    const hasUnsubmittedItems = false; // TODO: Check for unsubmitted KOT items

    return (
      <TouchableOpacity
        key={table.id}
        style={[styles.tableCard, { backgroundColor }]}
        onPress={() => handleTablePress(table)}
        onLongPress={() => handleTableLongPress(table)}
        delayLongPress={500}
      >
        {hasUnsubmittedItems && (
          <View style={styles.redCorner} />
        )}

        {elapsedTime ? (
          <Text style={styles.tableTime}>{elapsedTime}</Text>
        ) : null}

        <Text style={styles.tableName}>{table.name}</Text>

        {table.status !== 'available' && (
          <Text style={styles.tableBill}>₹0.00</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderBottomSheet = () => {
    if (!selectedTable) return null;

    return (
      <Modal
        visible={showBottomSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBottomSheet(false)}
      >
        <Pressable
          style={styles.bottomSheetOverlay}
          onPress={() => setShowBottomSheet(false)}
        >
          <Pressable style={styles.bottomSheet}>
            <Text style={styles.bottomSheetTitle}>
              Table No: {selectedTable.name}
            </Text>

            <View style={styles.bottomSheetButtons}>
              <TouchableOpacity
                style={styles.bottomSheetButton}
                onPress={handleViewKOTs}
              >
                <Text style={styles.bottomSheetButtonText}>View KOT(s)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bottomSheetButton}
                onPress={handleTransferTable}
              >
                <Text style={styles.bottomSheetButtonText}>Transfer</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.bottomSheetButtons}>
              <TouchableOpacity
                style={styles.bottomSheetButton}
                onPress={handleMergeTables}
              >
                <Text style={styles.bottomSheetButtonText}>Merge Tables</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bottomSheetButton}
                onPress={handleSplitTable}
              >
                <Text style={styles.bottomSheetButtonText}>Split Table</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>WaiterFlow</Text>
        <View style={styles.headerRight}>
          <Text style={styles.waiterName}>{waiterName}</Text>
          <TouchableOpacity onPress={onLogout}>
            <Text style={styles.logoutButton}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Offline Indicator */}
      <OfflineIndicator status={status} pendingSyncCount={pendingSyncCount} />

      {/* Section Tabs */}
      {renderSectionTabs()}

      {/* Table Grid */}
      <ScrollView
        style={styles.tableGrid}
        contentContainerStyle={styles.tableGridContent}
      >
        <View style={styles.tableRow}>
          {getFilteredTables().map(table => renderTableCard(table))}
        </View>
      </ScrollView>

      {/* Bottom Sheet */}
      {renderBottomSheet()}
    </View>
  );
}

const { width } = Dimensions.get('window');
const cardWidth = (width - 36) / 2; // 2 columns with padding

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: DARK_GRAY,
    elevation: 4
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF'
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  waiterName: {
    color: '#FFFFFF',
    fontSize: 14
  },
  logoutButton: {
    color: BRAND_RED,
    fontSize: 14,
    fontWeight: '600'
  },
  sectionTabs: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  sectionTabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8
  },
  sectionTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: LIGHT_GRAY
  },
  sectionTabActive: {
    backgroundColor: BRAND_RED
  },
  sectionTabText: {
    fontSize: 14,
    color: DARK_GRAY,
    fontWeight: '500'
  },
  sectionTabTextActive: {
    color: '#FFFFFF'
  },
  tableGrid: {
    flex: 1,
    padding: 12
  },
  tableGridContent: {
    paddingBottom: 24
  },
  tableRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  tableCard: {
    width: cardWidth,
    height: 120,
    borderRadius: 8,
    padding: 12,
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: 'relative'
  },
  redCorner: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: 24,
    borderRightWidth: 24,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopColor: BRAND_RED,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent'
  },
  tableTime: {
    fontSize: 12,
    color: DARK_GRAY,
    fontWeight: '500'
  },
  tableName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: DARK_GRAY,
    textAlign: 'center'
  },
  tableBill: {
    fontSize: 14,
    color: DARK_GRAY,
    fontWeight: '600',
    textAlign: 'right'
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    elevation: 8
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: DARK_GRAY,
    textAlign: 'center',
    marginBottom: 24
  },
  bottomSheetButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12
  },
  bottomSheetButton: {
    flex: 1,
    backgroundColor: BRAND_RED,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center'
  },
  bottomSheetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  }
});
