/**
 * Menu Browser Component
 * 
 * Displays menu items with search, category filtering, and out-of-stock indicators
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable
} from 'react-native';
import { getAll, query as dbQuery } from '../services/databaseHelpers';

const BRAND_RED = '#C0392B';
const DARK_GRAY = '#2C3E50';
const LIGHT_GRAY = '#F5F6FA';
const VEG_GREEN = '#4CAF50';
const NON_VEG_RED = '#E74C3C';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category_id: string;
  item_category: 'food' | 'drink';
  is_out_of_stock: number;
  is_bar_item: number;
  available_modifier_ids?: string;
}

interface MenuCategory {
  id: string;
  name: string;
  display_order: number;
}

interface MenuBrowserProps {
  onItemSelect: (item: MenuItem) => void;
  showSearch?: boolean;
}

export default function MenuBrowser({ onItemSelect, showSearch = true }: MenuBrowserProps) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCategoryDrawer, setShowCategoryDrawer] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
    loadMenuItems();

    // Set up real-time updates (polling every 10 seconds)
    const interval = setInterval(() => {
      loadMenuItems();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadCategories = async () => {
    try {
      const categoriesData = await getAll<MenuCategory>('menu_categories', 'display_order ASC');
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadMenuItems = async () => {
    try {
      const itemsData = await getAll<MenuItem>('menu_items', 'name ASC');
      setMenuItems(itemsData);
    } catch (error) {
      console.error('Error loading menu items:', error);
    }
  };

  const getFilteredItems = (): MenuItem[] => {
    let filtered = menuItems;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query)
      );
    }

    // Filter by category if selected
    if (selectedCategoryId) {
      filtered = filtered.filter(item => item.category_id === selectedCategoryId);
    }

    return filtered;
  };

  const getItemsByCategory = (): { category: MenuCategory | null; items: MenuItem[] }[] => {
    const filtered = getFilteredItems();
    
    if (searchQuery.trim() || selectedCategoryId) {
      // When searching or filtering, show all matching items under one group
      return [{ category: null, items: filtered }];
    }

    // Group by category
    const grouped: { category: MenuCategory; items: MenuItem[] }[] = [];
    
    categories.forEach(category => {
      const categoryItems = filtered.filter(item => item.category_id === category.id);
      if (categoryItems.length > 0) {
        grouped.push({ category, items: categoryItems });
      }
    });

    return grouped;
  };

  const handleItemPress = (item: MenuItem) => {
    if (item.is_out_of_stock) {
      // Don't allow selection of out-of-stock items
      return;
    }
    onItemSelect(item);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setShowCategoryDrawer(false);
  };

  const renderCategoryHeader = (category: MenuCategory) => {
    return (
      <View style={styles.categoryHeader}>
        <View style={styles.categoryAccent} />
        <Text style={styles.categoryHeaderText}>{category.name}</Text>
      </View>
    );
  };

  const renderMenuItem = (item: MenuItem) => {
    const isVeg = item.item_category === 'food'; // Simplified - should check actual veg/non-veg flag
    const isOutOfStock = item.is_out_of_stock === 1;

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.menuItemCard,
          isOutOfStock && styles.menuItemCardDisabled
        ]}
        onPress={() => handleItemPress(item)}
        disabled={isOutOfStock}
      >
        {/* Price - top left */}
        <Text style={styles.itemPrice}>₹{item.price}</Text>

        {/* Veg/Non-veg indicator - top right */}
        <View style={[
          styles.vegIndicator,
          { borderColor: isVeg ? VEG_GREEN : NON_VEG_RED }
        ]}>
          <View style={[
            styles.vegDot,
            { backgroundColor: isVeg ? VEG_GREEN : NON_VEG_RED }
          ]} />
        </View>

        {/* Item name - center */}
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>

        {/* Out of stock indicator */}
        {isOutOfStock && (
          <View style={styles.outOfStockBadge}>
            <Text style={styles.outOfStockText}>OUT OF STOCK</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderCategoryDrawer = () => {
    return (
      <Modal
        visible={showCategoryDrawer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryDrawer(false)}
      >
        <Pressable
          style={styles.drawerOverlay}
          onPress={() => setShowCategoryDrawer(false)}
        >
          <Pressable style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>📋 Menu</Text>
            </View>

            <ScrollView style={styles.drawerContent}>
              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => {
                  setSelectedCategoryId(null);
                  setShowCategoryDrawer(false);
                }}
              >
                <Text style={styles.drawerItemText}>All Items</Text>
              </TouchableOpacity>

              {categories.map(category => (
                <TouchableOpacity
                  key={category.id}
                  style={styles.drawerItem}
                  onPress={() => handleCategorySelect(category.id)}
                >
                  <Text style={styles.drawerItemText}>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.drawerCloseButton}
              onPress={() => setShowCategoryDrawer(false)}
            >
              <Text style={styles.drawerCloseButtonText}>✕</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  const groupedItems = getItemsByCategory();

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search menu items..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999999"
          />
        </View>
      )}

      {/* Menu Items Grid */}
      <ScrollView
        style={styles.menuScroll}
        contentContainerStyle={styles.menuScrollContent}
      >
        {groupedItems.map((group, groupIndex) => (
          <View key={groupIndex}>
            {group.category && renderCategoryHeader(group.category)}
            
            <View style={styles.menuGrid}>
              {group.items.map(item => renderMenuItem(item))}
            </View>
          </View>
        ))}

        {getFilteredItems().length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No items found</Text>
          </View>
        )}
      </ScrollView>

      {/* FAB - Category Drawer */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCategoryDrawer(true)}
      >
        <Text style={styles.fabIcon}>🍴</Text>
      </TouchableOpacity>

      {/* Category Drawer Modal */}
      {renderCategoryDrawer()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  searchContainer: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  searchInput: {
    height: 48,
    backgroundColor: LIGHT_GRAY,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: DARK_GRAY
  },
  menuScroll: {
    flex: 1
  },
  menuScrollContent: {
    padding: 12,
    paddingBottom: 80 // Space for FAB
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12
  },
  categoryAccent: {
    width: 4,
    height: 24,
    backgroundColor: BRAND_RED,
    marginRight: 12
  },
  categoryHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: BRAND_RED
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  menuItemCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: 'relative'
  },
  menuItemCardDisabled: {
    opacity: 0.5
  },
  itemPrice: {
    position: 'absolute',
    top: 8,
    left: 8,
    fontSize: 12,
    color: '#666666'
  },
  vegIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderWidth: 2,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center'
  },
  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK_GRAY,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 8
  },
  outOfStockBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: BRAND_RED,
    paddingVertical: 4,
    borderRadius: 4
  },
  outOfStockText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  emptyState: {
    padding: 48,
    alignItems: 'center'
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999999'
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BRAND_RED,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  fabIcon: {
    fontSize: 24
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  drawer: {
    width: '80%',
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden'
  },
  drawerHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    alignItems: 'center'
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: DARK_GRAY
  },
  drawerContent: {
    maxHeight: 400
  },
  drawerItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  drawerItemText: {
    fontSize: 16,
    color: DARK_GRAY
  },
  drawerCloseButton: {
    padding: 16,
    backgroundColor: BRAND_RED,
    alignItems: 'center'
  },
  drawerCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold'
  }
});
