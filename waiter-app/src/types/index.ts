/**
 * Common TypeScript type definitions for WaiterFlow Mobile App
 */

// Table Types
export type TableStatus = 'available' | 'occupied' | 'pending_bill';

export interface Table {
  id: string;
  name: string;
  sectionId: string;
  status: TableStatus;
  currentOrderId?: string;
}

export interface Section {
  id: string;
  name: string;
  tables: Table[];
}

// Menu Types
export type MenuItemCategory = 'food' | 'drink';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  category: MenuItemCategory;
  isOutOfStock: boolean;
  availableModifiers: Modifier[];
}

export type ModifierType = 'spice_level' | 'paid_addon';

export interface Modifier {
  id: string;
  name: string;
  type: ModifierType;
  price: number;
}

// Order Types
export type OrderStatus = 'draft' | 'submitted' | 'completed';

export interface Order {
  id: string;
  tableId: string;
  waiterId: string;
  items: OrderItem[];
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  basePrice: number;
  modifiers: AppliedModifier[];
  totalPrice: number;
  sentToKitchen: boolean;
}

export interface AppliedModifier {
  modifierId: string;
  name: string;
  price: number;
}

// Authentication Types
export interface AuthResult {
  success: boolean;
  waiterId?: string;
  waiterName?: string;
  error?: string;
}

export interface Waiter {
  id: string;
  name: string;
  pin: string;
  isActive: boolean;
  createdAt: Date;
}

// Sync Types
export type SyncState = 'connected' | 'syncing' | 'offline';

export interface SyncStatus {
  state: SyncState;
  lastSync?: Date;
  progress?: number;
  pendingChanges?: number;
}

// Network Types
export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}
