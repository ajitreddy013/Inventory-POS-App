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
  Pressable,
} from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { getAll } from '../services/databaseHelpers';
import { db } from '../services/firebase';

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
  category?: string;
  sub_category?: string;
  subCategory?: string;
  item_category: 'food' | 'drink';
  is_active?: number;
  isActive?: boolean;
  is_out_of_stock: number;
  isOutOfStock?: boolean;
  is_bar_item: number;
  isBarItem?: boolean;
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

export default function MenuBrowser({
  onItemSelect,
  showSearch = true,
}: MenuBrowserProps) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [counterStockMap, setCounterStockMap] = useState<
    Record<string, number>
  >({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showCategoryDrawer, setShowCategoryDrawer] = useState(false);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(
    null
  );

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
      const categoriesData = await getAll<MenuCategory>(
        'menu_categories',
        'display_order ASC'
      );
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadMenuItems = async () => {
    const normalizeItem = (id: string, raw: any): MenuItem => ({
      id,
      name: String(raw.name ?? ''),
      price: Number(raw.price ?? 0),
      category_id: String(raw.category_id ?? raw.categoryId ?? ''),
      category: raw.category ?? undefined,
      sub_category: raw.sub_category ?? raw.subCategory ?? undefined,
      subCategory: raw.subCategory ?? raw.sub_category ?? undefined,
      item_category: (raw.item_category ?? raw.itemCategory ?? 'food') as
        | 'food'
        | 'drink',
      is_active:
        raw.is_active !== undefined
          ? Number(raw.is_active)
          : raw.isActive === false
            ? 0
            : 1,
      isActive: raw.isActive,
      is_out_of_stock:
        raw.is_out_of_stock !== undefined
          ? Number(raw.is_out_of_stock)
          : raw.isOutOfStock
            ? 1
            : 0,
      isOutOfStock: raw.isOutOfStock,
      is_bar_item:
        raw.is_bar_item !== undefined
          ? Number(raw.is_bar_item)
          : raw.isBarItem
            ? 1
            : 0,
      isBarItem: raw.isBarItem,
      available_modifier_ids:
        raw.available_modifier_ids ??
        (Array.isArray(raw.availableModifiers)
          ? raw.availableModifiers.join(',')
          : undefined),
    });

    try {
      // Desktop parity: read current menu directly from Firestore first.
      const snapshot = await getDocs(collection(db, 'menuItems'));
      const itemsData = snapshot.docs.map((docSnap) =>
        normalizeItem(docSnap.id, docSnap.data())
      );
      setMenuItems(
        itemsData.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        )
      );
    } catch (error) {
      console.error(
        'Error loading menu items from Firestore, falling back to SQLite:',
        error
      );
      try {
        const fallbackData = await getAll<MenuItem>('menu_items', 'name ASC');
        setMenuItems(fallbackData.map((item) => normalizeItem(item.id, item)));
      } catch (fallbackError) {
        console.error(
          'Error loading menu items from SQLite fallback:',
          fallbackError
        );
      }
    }
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

      // Desktop parity fallback: if counter stock is missing in inventory, use transfer movements sum.
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
    } catch (error) {
      console.error('Error loading counter stock:', error);
      // Keep last known map if fetch fails.
    }
  };

  const getResolvedCounterStock = (item: MenuItem): number | null => {
    const stockFromMap = Object.prototype.hasOwnProperty.call(
      counterStockMap,
      item.id
    )
      ? Number(counterStockMap[item.id])
      : null;
    const stockFromItem = Number(
      (item as any).counterStock ?? (item as any).counter_stock
    );

    if (stockFromMap !== null) return stockFromMap;
    return Number.isFinite(stockFromItem) ? stockFromItem : null;
  };

  const isItemOutOfStock = (item: MenuItem): boolean => {
    const isBarItem = item.is_bar_item === 1 || item.isBarItem === true;
    const flagOutOfStock =
      item.is_out_of_stock === 1 || item.isOutOfStock === true;

    if (!isBarItem) return flagOutOfStock;

    const resolvedCounterStock = getResolvedCounterStock(item);
    // If stock is unknown, fall back to flag; otherwise trust counter stock.
    return resolvedCounterStock === null
      ? flagOutOfStock
      : resolvedCounterStock <= 0;
  };

  const getVisibleItems = (): MenuItem[] => {
    const visibleItems = menuItems.filter((item) => {
      const isActive = item.is_active !== 0 && item.isActive !== false;
      if (!isActive) return false;

      return !isItemOutOfStock(item);
    });

    // Keep every distinct item id (desktop parity), guard only against accidental duplicate rows.
    const byId = new Map<string, MenuItem>();
    visibleItems.forEach((item) => {
      if (!byId.has(item.id)) {
        byId.set(item.id, item);
      }
    });

    return Array.from(byId.values());
  };

  const getSubCategoryName = (item: MenuItem): string => {
    const explicitSubCategory = item.sub_category || item.subCategory;
    if (explicitSubCategory && explicitSubCategory.trim()) {
      return explicitSubCategory.trim();
    }

    // Keep mobile grouping strictly subcategory-based (no category fallback).
    return 'Uncategorized';
  };

  const getFilteredItems = (): MenuItem[] => {
    let filtered = getVisibleItems();

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) =>
        item.name.toLowerCase().includes(query)
      );
    }

    // Filter by subcategory if selected
    if (selectedSubCategory) {
      filtered = filtered.filter(
        (item) => getSubCategoryName(item) === selectedSubCategory
      );
    }

    return filtered;
  };

  const getSubCategoryOptions = (): string[] => {
    const options = new Set<string>();
    getVisibleItems().forEach((item) => {
      options.add(getSubCategoryName(item));
    });
    return Array.from(options).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  };

  const getItemsBySubCategory = (): {
    heading: string;
    items: MenuItem[];
  }[] => {
    const filtered = getFilteredItems();

    const groupedMap = new Map<string, MenuItem[]>();
    filtered.forEach((item) => {
      const heading = getSubCategoryName(item);
      if (!groupedMap.has(heading)) {
        groupedMap.set(heading, []);
      }
      groupedMap.get(heading)!.push(item);
    });

    return Array.from(groupedMap.entries())
      .sort(([a], [b]) => {
        return a.localeCompare(b, undefined, { sensitivity: 'base' });
      })
      .map(([heading, items]) => ({
        heading,
        items: [...items].sort((x, y) =>
          x.name.localeCompare(y.name, undefined, { sensitivity: 'base' })
        ),
      }));
  };

  const handleItemPress = (item: MenuItem) => {
    if (isItemOutOfStock(item)) {
      // Don't allow selection of out-of-stock items
      return;
    }
    onItemSelect(item);
  };

  const handleCategorySelect = (subCategory: string) => {
    setSelectedSubCategory(subCategory);
    setShowCategoryDrawer(false);
  };

  const renderCategoryHeader = (heading: string) => {
    return (
      <View style={styles.categoryHeader}>
        <View style={styles.categoryAccent} />
        <Text style={styles.categoryHeaderText}>{heading}</Text>
      </View>
    );
  };

  const renderMenuItem = (item: MenuItem, index: number) => {
    const isBarItem = item.is_bar_item === 1 || item.isBarItem === true;
    const isVeg = item.item_category === 'food'; // Simplified - should check actual veg/non-veg flag
    const isOutOfStock = isItemOutOfStock(item);
    const isEndOfRow = (index + 1) % 3 === 0;

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.menuItemCard,
          !isEndOfRow && styles.menuItemCardWithGap,
          isOutOfStock && styles.menuItemCardDisabled,
        ]}
        onPress={() => handleItemPress(item)}
        disabled={isOutOfStock}
      >
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>

        <View style={styles.itemCardTopRow}>
          <Text style={styles.itemPrice}>₹{item.price}</Text>
          {!isBarItem && (
            <View
              style={[
                styles.vegIndicator,
                { borderColor: isVeg ? VEG_GREEN : NON_VEG_RED },
              ]}
            >
              <View
                style={[
                  styles.vegDot,
                  { backgroundColor: isVeg ? VEG_GREEN : NON_VEG_RED },
                ]}
              />
            </View>
          )}
        </View>

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
                  setSelectedSubCategory(null);
                  setShowCategoryDrawer(false);
                }}
              >
                <Text style={styles.drawerItemText}>All Items</Text>
              </TouchableOpacity>

              {getSubCategoryOptions().map((subCategory) => (
                <TouchableOpacity
                  key={subCategory}
                  style={styles.drawerItem}
                  onPress={() => handleCategorySelect(subCategory)}
                >
                  <Text style={styles.drawerItemText}>{subCategory}</Text>
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

  const groupedItems = getItemsBySubCategory();

  useEffect(() => {
    loadCounterStock();

    const stockInterval = setInterval(() => {
      loadCounterStock();
    }, 10000);

    return () => clearInterval(stockInterval);
  }, []);

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
            {renderCategoryHeader(group.heading)}

            <View style={styles.menuGrid}>
              {group.items.map((item, itemIndex) =>
                renderMenuItem(item, itemIndex)
              )}
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
    backgroundColor: '#FFFFFF',
  },
  searchContainer: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInput: {
    height: 48,
    backgroundColor: LIGHT_GRAY,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: DARK_GRAY,
  },
  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 80, // Space for FAB
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  categoryAccent: {
    width: 3,
    height: 18,
    backgroundColor: BRAND_RED,
    marginRight: 8,
  },
  categoryHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND_RED,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  menuItemCard: {
    width: '32%',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 74,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    marginBottom: 6,
  },
  menuItemCardWithGap: {
    marginRight: '2%',
  },
  menuItemCardDisabled: {
    opacity: 0.5,
  },
  itemCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  itemPrice: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5F6368',
  },
  vegIndicator: {
    width: 13,
    height: 13,
    borderWidth: 1.5,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '600',
    color: DARK_GRAY,
    textAlign: 'left',
    lineHeight: 15,
    minHeight: 30,
  },
  outOfStockBadge: {
    marginTop: 4,
    backgroundColor: BRAND_RED,
    paddingVertical: 2,
    borderRadius: 4,
  },
  outOfStockText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999999',
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
    shadowRadius: 8,
  },
  fabIcon: {
    fontSize: 24,
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawer: {
    width: '80%',
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  drawerHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    alignItems: 'center',
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: DARK_GRAY,
  },
  drawerContent: {
    maxHeight: 400,
  },
  drawerItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  drawerItemText: {
    fontSize: 16,
    color: DARK_GRAY,
  },
  drawerCloseButton: {
    padding: 16,
    backgroundColor: BRAND_RED,
    alignItems: 'center',
  },
  drawerCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
