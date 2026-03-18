import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Lock,
  Plus,
  Minus,
  Loader,
  AlertCircle,
  Tag,
  Percent,
  X,
  Search,
  Info,
  Send,
  ShoppingCart,
  Coffee,
  Pizza,
  Salad,
  Wine,
  UtensilsCrossed,
  ChefHat,
  ChevronRight,
  Trash2,
  History,
  User,
  Phone,
} from 'lucide-react';
import './DesktopOrderEntry.css';

// ─── Theme (matches desktop TableManagement) ─────────────────────────────────
// Food type dot is now handled via CSS or simplified component
const FoodTypeDot = ({ type }) => {
  if (!type) return null;
  return <span className={`food-dot ${type}`} />;
};

const resolveTableOrderId = (table) =>
  table?.currentOrderId || table?.current_order_id || null;

export default function TableOrderEntry({ table, onBack, onTableUpdate }) {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [counterStockMap, setCounterStockMap] = useState({});
  const [godownStockMap, setGodownStockMap] = useState({});
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState(null);

  const [orderId, setOrderId] = useState(resolveTableOrderId(table));
  const [orderItems, setOrderItems] = useState([]);

  const [saving] = useState(false);
  const [error, setError] = useState(null);
  const [kotSending, setKotSending] = useState(false);

  // Auto-dismiss error after 7 seconds
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 7000);
    return () => clearTimeout(t);
  }, [error]);

  const [showDiscount, setShowDiscount] = useState(false);
  const [discountType, setDiscountType] = useState('fixed');
  const [discountInput, setDiscountInput] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);

  const [showSplit, setShowSplit] = useState(false);
  const [splitCash, setSplitCash] = useState('');
  const [splitUpi, setSplitUpi] = useState('');
  const [paying, setPaying] = useState(false);

  const [showKOTHistory, setShowKOTHistory] = useState(false);

  // Pending Customer Modal States
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [phoneSuggestions, setPhoneSuggestions] = useState([]);
  const [customerDataError, setCustomerDataError] = useState(null);
  const [isSavingPending, setIsSavingPending] = useState(false);

  const debounceRefs = useRef({});
  const pendingUpserts = useRef({}); // menuItemId -> { oid, item, tableId, sub }
  const listBottomRef = useRef(null);
  const orderItemsUnsubRef = useRef(null);

  // Keep local order context aligned with whichever table is currently open.
  useEffect(() => {
    setOrderId(resolveTableOrderId(table));
    setOrderItems([]);
  }, [table?.id, table?.currentOrderId, table?.current_order_id]);

  // ─── Load menu ────────────────────────────────────────────────────────────
  const loadMenu = useCallback(async () => {
    setMenuLoading(true);
    setMenuError(null);
    try {
      const [itemsRes, counterRes, godownRes] = await Promise.all([
        window.electronAPI.getMenuItems({
          includeInactive: false,
          includeOutOfStock: true,
        }),
        window.electronAPI.getCounterStock(),
        window.electronAPI.getMenuItemsWithStock(),
      ]);

      // Build counter stock map for bar items
      const counterMap = {};
      if (counterRes?.success) {
        for (const item of counterRes.items)
          counterMap[item.id] = item.counterStock || 0;
      }
      setCounterStockMap(counterMap);

      // Build godown stock map
      const godownMap = {};
      if (godownRes?.success) {
        for (const item of godownRes.items)
          godownMap[item.id] = item.godownStock || 0;
      }
      setGodownStockMap(godownMap);

      const items = (itemsRes?.items || []).filter((i) => {
        if (i.isActive === false) return false;
        if (i.isBarItem) {
          // Bar items: only show if counter stock > 0
          return (counterMap[i.id] || 0) > 0;
        }
        // Restaurant items: exclude if out of stock
        return !i.isOutOfStock;
      });

      setMenuItems(items);
      const seen = new Set();
      const cats = [];
      for (const item of items) {
        const sc = item.subCategory || item.category || 'Other';
        if (!seen.has(sc)) {
          seen.add(sc);
          cats.push(sc);
        }
      }
      setCategories(cats);
      setSelectedCategory(null);
    } catch (e) {
      setMenuError(e.message || 'Failed to load menu');
    } finally {
      setMenuLoading(false);
    }
  }, []);

  // ─── Real-time order items ────────────────────────────────────────────────
  const subscribeToOrderItems = useCallback((oid) => {
    if (!oid) return;
    if (orderItemsUnsubRef.current) {
      orderItemsUnsubRef.current();
      orderItemsUnsubRef.current = null;
    }
    const channel = `order-items-update:${oid}`;

    // Register listener FIRST before subscribing to avoid missing the initial snapshot
    const sub = window.electronAPI.on(channel, (items) => setOrderItems(items));
    orderItemsUnsubRef.current = () => {
      window.electronAPI.invoke('firebase:unsubscribe-order-items', {
        orderId: oid,
      });
      window.electronAPI.removeListener(channel, sub);
    };

    // Now subscribe — initial snapshot will fire and listener is already ready
    window.electronAPI
      .invoke('firebase:subscribe-order-items', { orderId: oid })
      .then(() => {
        // Fallback: also fetch directly in case snapshot already fired before listener was ready
        window.electronAPI
          .invoke('firebase:get-order-items', { orderId: oid })
          .then((res) => {
            if (res?.success && res.items?.length > 0) setOrderItems(res.items);
          })
          .catch(() => {});
      })
      .catch(() => {});
  }, []);

  const resolveActiveOrderIdForTable = useCallback(async (tableId) => {
    if (!tableId) return null;
    try {
      const result = await window.electronAPI.invoke(
        'firebase:get-table-orders',
        tableId
      );
      if (
        !result?.success ||
        !Array.isArray(result.orders) ||
        result.orders.length === 0
      ) {
        return null;
      }

      const toTimestamp = (v) => {
        if (!v) return 0;
        if (typeof v === 'number') return v;
        if (typeof v?.toMillis === 'function') return v.toMillis();
        if (typeof v?.seconds === 'number') return v.seconds * 1000;
        const t = new Date(v).getTime();
        return Number.isNaN(t) ? 0 : t;
      };

      const sorted = [...result.orders].sort((a, b) => {
        const aTs = toTimestamp(a.updatedAt) || toTimestamp(a.createdAt);
        const bTs = toTimestamp(b.updatedAt) || toTimestamp(b.createdAt);
        return bTs - aTs;
      });

      return sorted[0]?.id || null;
    } catch (error) {
      console.error('Failed to resolve active order for table:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadMenu();

    const initOrderSubscription = async () => {
      let oid = resolveTableOrderId(table) || orderId;

      // Fallback for legacy/stale table docs that don't carry currentOrderId fields.
      if (!oid && table?.id) {
        oid = await resolveActiveOrderIdForTable(table.id);
        if (cancelled) return;
        if (oid) {
          setOrderId(oid);
          if (onTableUpdate) {
            onTableUpdate({
              ...table,
              currentOrderId: oid,
              current_order_id: oid,
            });
          }
        }
      }

      if (oid) subscribeToOrderItems(oid);
    };

    initOrderSubscription();

    return () => {
      cancelled = true;
      if (orderItemsUnsubRef.current) orderItemsUnsubRef.current();
      // Flush any pending debounced upserts immediately on unmount
      Object.values(debounceRefs.current).forEach((t) => clearTimeout(t));
      const pending = Object.values(pendingUpserts.current);
      if (pending.length > 0) {
        pending.forEach(({ oid: o, item, tableId, sub }) => {
          window.electronAPI
            .upsertOrderItem(o, { ...item, tableId, subtotal: sub })
            .catch(() => {});
        });
        pendingUpserts.current = {};
      }
    };
  }, [
    loadMenu,
    subscribeToOrderItems,
    table,
    orderId,
    resolveActiveOrderIdForTable,
    onTableUpdate,
  ]);

  useEffect(() => {
    if (listBottomRef.current)
      listBottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [orderItems.length]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const scheduleUpsert = useCallback(
    (oid, item, tableId, sub) => {
      clearTimeout(debounceRefs.current[item.menuItemId]);
      // Store latest pending upsert data so we can flush on unmount
      pendingUpserts.current[item.menuItemId] = { oid, item, tableId, sub };
      debounceRefs.current[item.menuItemId] = setTimeout(async () => {
        delete pendingUpserts.current[item.menuItemId];
        try {
          const result = await window.electronAPI.upsertOrderItem(oid, {
            ...item,
            tableId,
            subtotal: sub,
          });

          if (!result?.success) {
            throw new Error(result?.error || 'Stock not available.');
          }
        } catch (e) {
          console.error('Upsert failed:', e);
          setError(e.message || 'Stock not available.');

          // Re-sync after optimistic update failure (e.g., stock exhausted during race).
          try {
            const latest = await window.electronAPI.invoke(
              'firebase:get-order-items',
              {
                orderId: oid,
              }
            );
            if (latest?.success) {
              setOrderItems(latest.items || []);
            }
          } catch (e) {
            console.warn('settle refresh:', e.message);
          }

          loadMenu();
        }
      }, 500);
    },
    [loadMenu]
  );

  const ensureOrder = useCallback(async () => {
    if (orderId) return orderId;
    const res = await window.electronAPI.createOrder({
      tableId: table.id,
      tableName: table.name,
      status: 'open',
      createdAt: new Date(),
    });
    if (!res?.success) throw new Error(res?.error || 'Failed to create order');
    setOrderId(res.orderId);
    subscribeToOrderItems(res.orderId);
    if (onTableUpdate) {
      onTableUpdate({
        ...table,
        status: 'occupied',
        currentOrderId: res.orderId,
        current_order_id: res.orderId,
      });
    }
    return res.orderId;
  }, [orderId, table, subscribeToOrderItems, onTableUpdate]);

  const subtotal = orderItems.reduce(
    (s, i) => s + i.currentQty * i.unitPrice,
    0
  );
  const payableTotal = Math.max(0, subtotal - discountAmount);

  const kotGroups = (() => {
    const sorted = [...orderItems].sort(
      (a, b) => (a.created_at || 0) - (b.created_at || 0)
    );
    const groups = [];
    let n = 1;
    for (const item of sorted) {
      const t = item.created_at || 0;
      const last = groups[groups.length - 1];
      if (!last || t - last.sentAt > 30000)
        groups.push({ kotNumber: n++, sentAt: t, items: [item] });
      else last.items.push(item);
    }
    return groups;
  })();

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleAddItem = useCallback(
    async (menuItem) => {
      // Check counter stock cap for bar items BEFORE updating state
      if (menuItem.isBarItem) {
        const availableQty = counterStockMap[menuItem.id] || 0;
        if (availableQty <= 0) {
          const inGodown = godownStockMap[menuItem.id] || 0;
          setError(
            inGodown > 0
              ? `Counter stock exhausted. ${inGodown} available in godown — transfer to counter first.`
              : 'Stock not available.'
          );
          return;
        }
      }
      let oid;
      try {
        oid = await ensureOrder();
      } catch (e) {
        setError(e.message);
        return;
      }

      if (menuItem.isBarItem) {
        setCounterStockMap((prev) => ({
          ...prev,
          [menuItem.id]: Math.max(0, (prev[menuItem.id] || 0) - 1),
        }));
      }

      setOrderItems((prev) => {
        const existing = prev.find((i) => i.menuItemId === menuItem.id);
        const updated = existing
          ? prev.map((i) =>
              i.menuItemId === menuItem.id
                ? { ...i, currentQty: i.currentQty + 1 }
                : i
            )
          : [
              ...prev,
              {
                menuItemId: menuItem.id,
                menuItemName: menuItem.name,
                unitPrice: menuItem.price,
                currentQty: 1,
                sentQty: 0,
                category: menuItem.subCategory || menuItem.category || '',
                isBarItem: menuItem.isBarItem,
              },
            ];
        const item = updated.find((i) => i.menuItemId === menuItem.id);
        scheduleUpsert(
          oid,
          item,
          table.id,
          updated.reduce((s, i) => s + i.currentQty * i.unitPrice, 0)
        );
        return updated;
      });
    },
    [
      ensureOrder,
      scheduleUpsert,
      table,
      counterStockMap,
      godownStockMap,
      orderItems,
    ]
  );

  const handleIncrement = useCallback(
    async (menuItemId) => {
      // Check counter stock cap for bar items BEFORE updating state
      // Use isBarItem from orderItems (stored in Firestore) or fall back to menuItems lookup
      const orderItem = orderItems.find((i) => i.menuItemId === menuItemId);
      const menuItem = menuItems.find((i) => i.id === menuItemId);
      const isBarItem = orderItem?.isBarItem || menuItem?.isBarItem || false;
      if (isBarItem) {
        const availableQty = counterStockMap[menuItemId] || 0;
        if (availableQty <= 0) {
          const inGodown = godownStockMap[menuItemId] || 0;
          setError(
            inGodown > 0
              ? `Counter stock exhausted. ${inGodown} available in godown — transfer to counter first.`
              : 'Stock not available.'
          );
          return;
        }
      }
      let oid;
      try {
        oid = await ensureOrder();
      } catch (e) {
        setError(e.message);
        return;
      }

      if (isBarItem) {
        setCounterStockMap((prev) => ({
          ...prev,
          [menuItemId]: Math.max(0, (prev[menuItemId] || 0) - 1),
        }));
      }

      setOrderItems((prev) => {
        const updated = prev.map((i) =>
          i.menuItemId === menuItemId
            ? { ...i, currentQty: i.currentQty + 1 }
            : i
        );
        const updatedItem = updated.find((i) => i.menuItemId === menuItemId);
        scheduleUpsert(
          oid,
          updatedItem,
          table.id,
          updated.reduce((s, i) => s + i.currentQty * i.unitPrice, 0)
        );
        return updated;
      });
    },
    [
      ensureOrder,
      scheduleUpsert,
      table,
      counterStockMap,
      godownStockMap,
      orderItems,
      menuItems,
    ]
  );

  const handleDecrement = useCallback(
    async (menuItemId) => {
      let oid;
      try {
        oid = await ensureOrder();
      } catch (e) {
        setError(e.message);
        return;
      }
      setOrderItems((prev) => {
        const item = prev.find((i) => i.menuItemId === menuItemId);
        if (!item) return prev;

        if (item.isBarItem) {
          setCounterStockMap((stockPrev) => ({
            ...stockPrev,
            [menuItemId]: (stockPrev[menuItemId] || 0) + 1,
          }));
        }

        const pendingQty = item.currentQty - item.sentQty;
        if (pendingQty <= 1 && item.sentQty === 0) {
          window.electronAPI
            .deleteOrderItem(oid, menuItemId)
            .catch(console.error);
          return prev.filter((i) => i.menuItemId !== menuItemId);
        }
        const updated = prev.map((i) =>
          i.menuItemId === menuItemId
            ? { ...i, currentQty: i.currentQty - 1 }
            : i
        );
        const updatedItem = updated.find((i) => i.menuItemId === menuItemId);
        scheduleUpsert(
          oid,
          updatedItem,
          table.id,
          updated.reduce((s, i) => s + i.currentQty * i.unitPrice, 0)
        );
        return updated;
      });
    },
    [ensureOrder, scheduleUpsert, table]
  );

  const handleRemovePending = useCallback(
    async (menuItemId) => {
      let oid;
      try {
        oid = await ensureOrder();
      } catch (e) {
        setError(e.message);
        return;
      }
      setOrderItems((prev) => {
        const item = prev.find((i) => i.menuItemId === menuItemId);
        if (!item) return prev;

        const restoredQty =
          item.sentQty === 0
            ? item.currentQty
            : Math.max(0, item.currentQty - item.sentQty);

        if (item.isBarItem && restoredQty > 0) {
          setCounterStockMap((stockPrev) => ({
            ...stockPrev,
            [menuItemId]: (stockPrev[menuItemId] || 0) + restoredQty,
          }));
        }

        if (item.sentQty === 0) {
          window.electronAPI
            .deleteOrderItem(oid, menuItemId)
            .catch(console.error);
          return prev.filter((i) => i.menuItemId !== menuItemId);
        }
        const updated = prev.map((i) =>
          i.menuItemId === menuItemId ? { ...i, currentQty: i.sentQty } : i
        );
        const updatedItem = updated.find((i) => i.menuItemId === menuItemId);
        scheduleUpsert(
          oid,
          updatedItem,
          table.id,
          updated.reduce((s, i) => s + i.currentQty * i.unitPrice, 0)
        );
        return updated;
      });
    },
    [ensureOrder, scheduleUpsert, table]
  );

  const handleSendKot = useCallback(async () => {
    const kotItems = orderItems.filter((i) => i.currentQty - i.sentQty > 0);
    if (!kotItems.length) {
      setError('No new items to send');
      return;
    }
    if (!orderId) {
      setError('No order created yet');
      return;
    }
    setKotSending(true);
    try {
      const res = await window.electronAPI.sendKot({
        orderId,
        tableId: table.id,
        tableName: table.name,
        kotItems,
      });
      if (!res?.success) throw new Error(res?.error || 'KOT failed');
      setOrderItems((prev) =>
        prev.map((i) => ({ ...i, sentQty: i.currentQty }))
      );
      if (onTableUpdate) {
        onTableUpdate({
          ...table,
          status: 'occupied',
          currentOrderId: orderId,
          current_order_id: orderId,
        });
      }
      loadMenu(); // refresh counter stock map
    } catch (e) {
      setError(e.message);
    } finally {
      setKotSending(false);
    }
  }, [orderItems, orderId, table, onTableUpdate, loadMenu]);

  const handleKeepPending = useCallback(async () => {
    if (orderItems.length === 0) {
      onBack();
      return;
    }
    setShowCustomerModal(true);
  }, [orderItems, onBack]);

  const onConfirmPending = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      setCustomerDataError('Both Name and Mobile Number are mandatory');
      return;
    }
    setIsSavingPending(true);
    setCustomerDataError(null);
    try {
      const res = await window.electronAPI.savePendingBill({
        orderId,
        tableId: table.id,
        tableName: table.name,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        items: orderItems.map((i) => ({
          menuItemId: i.menuItemId,
          name: i.menuItemName,
          quantity: i.currentQty,
          unitPrice: i.unitPrice,
          totalPrice: i.currentQty * i.unitPrice,
        })),
        subtotal,
        discountAmount,
        totalAmount: payableTotal,
      });
      if (!res?.success)
        throw new Error(res?.error || 'Failed to save pending bill');
      if (onTableUpdate) {
        onTableUpdate({
          ...table,
          status: 'available',
          currentOrderId: null,
          current_order_id: null,
        });
      }
      onBack();
    } catch (e) {
      setCustomerDataError(e.message || 'An error occurred while saving');
    } finally {
      setIsSavingPending(false);
    }
  };

  const handlePhoneChange = async (e) => {
    const val = e.target.value;
    setCustomerPhone(val);
    if (val.length >= 3) {
      try {
        const res = await window.electronAPI.getCustomerSuggestions({
          phone: val,
        });
        setPhoneSuggestions(res?.customers || []);
      } catch (_) {
        setPhoneSuggestions([]);
      }
    } else {
      setPhoneSuggestions([]);
    }
  };

  const handleNameChange = async (e) => {
    const val = e.target.value;
    setCustomerName(val);
    if (val.length >= 2) {
      try {
        const res = await window.electronAPI.getCustomerSuggestions({
          name: val,
        });
        setNameSuggestions(res?.customers || []);
      } catch (_) {
        setNameSuggestions([]);
      }
    } else {
      setNameSuggestions([]);
    }
  };

  const selectNameSuggestion = (cust) => {
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone);
    setNameSuggestions([]);
    setPhoneSuggestions([]);
  };

  const selectPhoneSuggestion = (cust) => {
    setCustomerPhone(cust.phone);
    setCustomerName(cust.name);
    setNameSuggestions([]);
    setPhoneSuggestions([]);
  };

  const applyDiscount = () => {
    const val = parseFloat(discountInput) || 0;
    let amt = discountType === 'percent' ? (subtotal * val) / 100 : val;
    if (amt > subtotal) amt = subtotal;
    setDiscountAmount(amt);
    setShowDiscount(false);
  };

  const handlePay = useCallback(
    async (type) => {
      if (!orderId) {
        setError('No order to bill');
        return;
      }
      setPaying(true);
      try {
        const res = await window.electronAPI.generateBill({
          orderId,
          tableId: table.id,
          payments: [{ type, amount: payableTotal }],
          discount: discountAmount,
        });
        if (!res?.success) throw new Error(res?.error || 'Bill failed');
        loadMenu(); // refresh counter stock
        onBack();
      } catch (e) {
        setError(e.message);
      } finally {
        setPaying(false);
      }
    },
    [orderId, table, payableTotal, discountAmount, onBack, loadMenu]
  );

  const handleSplitPay = useCallback(async () => {
    const cash = parseFloat(splitCash) || 0;
    const upi = parseFloat(splitUpi) || 0;
    if (Math.abs(cash + upi - payableTotal) > 0.01) {
      setError(`Cash + UPI must equal ₹${payableTotal.toFixed(2)}`);
      return;
    }
    if (!orderId) {
      setError('No order to bill');
      return;
    }
    setPaying(true);
    try {
      const res = await window.electronAPI.generateBill({
        orderId,
        tableId: table.id,
        payments: [
          { type: 'cash', amount: cash },
          { type: 'upi', amount: upi },
        ],
        discount: discountAmount,
      });
      if (!res?.success) throw new Error(res?.error || 'Bill failed');
      loadMenu(); // refresh counter stock
      onBack();
    } catch (e) {
      setError(e.message);
    } finally {
      setPaying(false);
    }
  }, [
    splitCash,
    splitUpi,
    payableTotal,
    orderId,
    table,
    discountAmount,
    onBack,
    loadMenu,
  ]);

  const getCategoryIcon = (categoryName) => {
    const name = (categoryName || '').toLowerCase();
    if (name.includes('pizza')) return <Pizza size={18} />;
    if (
      name.includes('coffee') ||
      name.includes('drink') ||
      name.includes('beverage')
    )
      return <Coffee size={18} />;
    if (name.includes('salad') || name.includes('veg'))
      return <Salad size={18} />;
    if (name.includes('wine') || name.includes('alcohol'))
      return <Wine size={18} />;
    if (name.includes('main')) return <UtensilsCrossed size={18} />;
    return <ChefHat size={18} />;
  };

  const visibleItems = menuItems.filter((i) => {
    const cat = i.subCategory || i.category || 'Other';
    const matchesSearch =
      !searchTerm ||
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.description &&
        i.description.toLowerCase().includes(searchTerm.toLowerCase()));
    // When searching, show all matching items regardless of category
    if (searchTerm) return matchesSearch;
    const matchesCategory = !selectedCategory || cat === selectedCategory;
    return matchesCategory;
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="desktop-order-entry">
      {/* Header */}
      <header className="order-header">
        <div className="header-left">
          <button className="btn-back" onClick={onBack} title="Go Back">
            <ArrowLeft size={20} />
          </button>
          <h1>
            Order: <span className="text-primary">{table?.name}</span>
          </h1>
          {table?.section && (
            <span
              className="status-badge available"
              style={{ marginLeft: '0.5rem' }}
            >
              {table.section}
            </span>
          )}
        </div>

        <div className="header-center">
          <div className="global-search-container">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              placeholder="Search dishes, drinks or codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            className={`btn-kot-header ${showKOTHistory ? 'active' : ''}`}
            onClick={() => {
              setShowKOTHistory(!showKOTHistory);
              setShowDiscount(false);
              setShowSplit(false);
            }}
          >
            History
          </button>
        </div>

        <div className="header-right">
          {saving && <Loader size={16} className="text-muted spin" />}
        </div>
      </header>

      {/* Error toast — fixed overlay, auto-dismisses */}
      {error && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            background: '#fee2e2',
            color: '#991b1b',
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.875rem',
            maxWidth: '380px',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '1.25rem',
              lineHeight: 1,
              padding: 0,
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Body */}
      <div className="order-layout">
        {/* Column 1: Categories Sidebar */}
        <aside className="categories-sidebar">
          <button
            className={`category-item ${!selectedCategory ? 'active' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            <div className="category-icon">
              <ChefHat size={20} />
            </div>
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`category-item ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              <div className="category-icon">{getCategoryIcon(cat)}</div>
              {cat}
            </button>
          ))}
        </aside>

        {/* Column 2: Items Gallery */}
        <main className="items-panel">
          {showKOTHistory ? (
            <div className="kot-history-panel">
              <div className="panel-header-compact">
                <h3>KOT History ({kotGroups.length})</h3>
                <button
                  className="btn-close-panel"
                  onClick={() => setShowKOTHistory(false)}
                >
                  Back to Menu
                </button>
              </div>

              <div className="kot-scroll-area">
                {kotGroups.length === 0 ? (
                  <div className="empty-state">
                    <History
                      size={48}
                      style={{ opacity: 0.2, marginBottom: '1rem' }}
                    />
                    <p>No KOTs sent for this table yet</p>
                  </div>
                ) : (
                  <div className="kot-list-grid">
                    {kotGroups.map((kot) => (
                      <div key={kot.kotNumber} className="kot-card-premium">
                        <div className="kot-card-header">
                          <div className="kot-id">KOT #{kot.kotNumber}</div>
                          <div className="kot-time">
                            {kot.sentAt
                              ? new Date(kot.sentAt).toLocaleTimeString(
                                  'en-IN',
                                  {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true,
                                  }
                                )
                              : ''}
                          </div>
                        </div>
                        <div className="kot-card-body">
                          {kot.items.map((item) => (
                            <div key={item.menuItemId} className="kot-item-row">
                              <span className="kot-item-qty">
                                {item.currentQty}×
                              </span>
                              <span className="kot-item-name">
                                {item.menuItemName}
                              </span>
                              <span className="kot-item-price">
                                ₹{(item.currentQty * item.unitPrice).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="kot-card-footer">
                          <span>Total</span>
                          <span>
                            ₹
                            {kot.items
                              .reduce(
                                (s, i) => s + i.currentQty * i.unitPrice,
                                0
                              )
                              .toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="items-grid">
              {menuLoading ? (
                <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                  <Loader size={32} className="spin text-primary" />
                  <p>Loading menu...</p>
                </div>
              ) : (
                visibleItems.map((item) => (
                  <div
                    key={item.id}
                    className="item-card"
                    onClick={() => handleAddItem(item)}
                  >
                    <div>
                      <div
                        className="item-footer"
                        style={{ marginBottom: '0.5rem' }}
                      >
                        <span className="item-tag">
                          {item.subCategory || item.category || 'Other'}
                        </span>
                        <FoodTypeDot type={item.foodType} />
                      </div>
                      <h4>{item.name}</h4>
                      {item.description && (
                        <p className="item-desc">{item.description}</p>
                      )}
                    </div>
                    <div className="item-footer">
                      <span className="item-price">
                        ₹{Number(item.price).toFixed(2)}
                      </span>
                      <div
                        className="btn-qty"
                        style={{ width: '32px', height: '32px' }}
                      >
                        <Plus size={18} />
                      </div>
                    </div>
                  </div>
                ))
              )}
              {!menuLoading && visibleItems.length === 0 && (
                <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                  <Search
                    size={48}
                    className="text-muted"
                    style={{ marginBottom: '1rem' }}
                  />
                  <p className="text-muted">
                    No items found matching your search.
                  </p>
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── Column 3: Billing Area (65% in layout, but let flex handle) ── */}
        <aside className="billing-panel">
          <div className="billing-header">
            <h2>
              <ShoppingCart size={22} className="text-primary" /> Current Order
            </h2>
          </div>

          <div className="billing-items">
            {orderItems.length === 0 ? (
              <div
                className="empty-state"
                style={{ textAlign: 'center', padding: '3rem 1rem' }}
              >
                <ShoppingCart
                  size={32}
                  className="text-muted"
                  style={{ marginBottom: '1rem', opacity: 0.5 }}
                />
                <p className="text-muted">Selection is empty.</p>
                <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                  Tap items on the left to start billing.
                </p>
                {(table?.currentBillAmount || table?.current_bill_amount || 0) >
                  0 && (
                  <button
                    style={{
                      marginTop: '1.5rem',
                      padding: '0.5rem 1.2rem',
                      background: '#e74c3c',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                    onClick={async () => {
                      if (
                        !window.confirm('Clear stale amount from this table?')
                      )
                        return;
                      try {
                        await window.electronAPI.invoke(
                          'firebase:clear-table',
                          table.id
                        );
                        if (onTableUpdate) {
                          onTableUpdate({
                            ...table,
                            status: 'available',
                            currentOrderId: null,
                            current_order_id: null,
                            currentBillAmount: 0,
                            current_bill_amount: 0,
                          });
                        }
                        onBack();
                      } catch (e) {
                        setError('Failed to clear table: ' + e.message);
                      }
                    }}
                  >
                    Clear Stale Amount
                  </button>
                )}
              </div>
            ) : (
              [...orderItems]
                .sort((a, b) => {
                  const aS = a.sentQty > 0 && a.currentQty === a.sentQty;
                  const bS = b.sentQty > 0 && b.currentQty === b.sentQty;
                  return aS === bS ? 0 : aS ? -1 : 1;
                })
                .map((item) => {
                  const pendingQty = item.currentQty - item.sentQty;
                  const isSent = item.sentQty > 0 && pendingQty === 0;
                  return (
                    <div
                      key={item.menuItemId}
                      className={`order-item-row ${isSent ? 'sent-to-kitchen' : ''}`}
                    >
                      <div className="row-top-line">
                        <div className="item-name-qty-group">
                          <span className="row-title" title={item.menuItemName}>
                            {item.menuItemName}
                          </span>
                          {pendingQty > 0 && (
                            <span className="pending-badge">+{pendingQty}</span>
                          )}
                          <div className="qty-controls-inline">
                            <button
                              className="btn-qty-sm"
                              disabled={isSent}
                              onClick={() => handleDecrement(item.menuItemId)}
                            >
                              <Minus size={14} />
                            </button>
                            <span className="qty-val-sm">
                              {item.currentQty}
                            </span>
                            <button
                              className="btn-qty-sm"
                              onClick={() => handleIncrement(item.menuItemId)}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1.25rem',
                          }}
                        >
                          <div className="price-stack">
                            <span className="price-total-main">
                              ₹{(item.currentQty * item.unitPrice).toFixed(2)}
                            </span>
                            <span className="price-unit-small">
                              ₹{Number(item.unitPrice).toFixed(2)}
                            </span>
                          </div>

                          <div className="actions-cluster">
                            <button
                              className="btn-remove"
                              disabled={pendingQty === 0}
                              onClick={() =>
                                handleRemovePending(item.menuItemId)
                              }
                              title="Remove Unsent Items"
                              style={{
                                opacity: pendingQty === 0 ? 0.3 : 1,
                                cursor:
                                  pendingQty === 0 ? 'default' : 'pointer',
                              }}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
            <div ref={listBottomRef} />
          </div>

          {/* Extra Panels: Discount */}
          {showDiscount && (
            <div className="billing-extra-panel">
              <div className="panel-controls">
                <button
                  onClick={() => setDiscountType('fixed')}
                  className={`btn-secondary-pos ${discountType === 'fixed' ? 'active' : ''}`}
                >
                  <Tag size={14} /> Fixed
                </button>
                <button
                  onClick={() => setDiscountType('percent')}
                  className={`btn-secondary-pos ${discountType === 'percent' ? 'active' : ''}`}
                >
                  <Percent size={14} /> Percent
                </button>
                <input
                  type="number"
                  className="input-modern"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder={discountType === 'percent' ? '0–100' : 'Amount'}
                />
                <button
                  onClick={applyDiscount}
                  className="btn-send"
                  style={{ width: 'auto', padding: '0.6rem 1.2rem' }}
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* Extra Panels: Split Pay */}
          {showSplit && (
            <div className="billing-extra-panel">
              <div className="panel-controls">
                <input
                  type="number"
                  className="input-modern"
                  value={splitCash}
                  onChange={(e) => setSplitCash(e.target.value)}
                  placeholder="Cash Amount"
                />
                <input
                  type="number"
                  className="input-modern"
                  value={splitUpi}
                  onChange={(e) => setSplitUpi(e.target.value)}
                  placeholder="UPI Amount"
                />
                <button
                  onClick={handleSplitPay}
                  disabled={
                    paying ||
                    Math.abs(
                      (parseFloat(splitCash) || 0) +
                        (parseFloat(splitUpi) || 0) -
                        payableTotal
                    ) > 0.01
                  }
                  className="btn-send"
                  style={{ width: 'auto', padding: '0.6rem 1rem' }}
                >
                  {paying ? (
                    <Loader size={12} className="spin" />
                  ) : (
                    'Confirm Split'
                  )}
                </button>
              </div>
              <div
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  color:
                    Math.abs(
                      (parseFloat(splitCash) || 0) +
                        (parseFloat(splitUpi) || 0) -
                        payableTotal
                    ) < 0.01
                      ? '#10b981'
                      : '#f43f5e',
                }}
              >
                Total: ₹
                {(
                  (parseFloat(splitCash) || 0) + (parseFloat(splitUpi) || 0)
                ).toFixed(2)}{' '}
                / Required: ₹{payableTotal.toFixed(2)}
              </div>
            </div>
          )}

          <div className="billing-summary">
            <div className="summary-row">
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div
                className="summary-row"
                style={{ color: '#f43f5e', fontWeight: 600 }}
              >
                <span>Discount</span>
                <span>-₹{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="summary-total">
              <span>Total</span>
              <span>₹{payableTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="secondary-actions">
            <button className="btn-secondary-pos" onClick={handleKeepPending}>
              Keep Pending
            </button>
            <button
              className={`btn-secondary-pos ${showDiscount ? 'active' : ''}`}
              onClick={() => {
                setShowDiscount(!showDiscount);
                setShowSplit(false);
                setShowKOTHistory(false);
              }}
            >
              Discount
            </button>
          </div>

          <div className="action-area" style={{ padding: '1rem 1.5rem' }}>
            <button
              className="btn-large btn-send"
              disabled={
                kotSending ||
                orderItems.filter((i) => i.currentQty - i.sentQty > 0)
                  .length === 0
              }
              onClick={handleSendKot}
            >
              {kotSending ? (
                'Sending...'
              ) : (
                <>
                  <Send size={20} />
                  Send KOT
                </>
              )}
            </button>

            <div className="payment-actions">
              <button
                className="btn-pay btn-cash"
                disabled={paying || orderItems.length === 0}
                onClick={() => handlePay('cash')}
              >
                Cash
              </button>
              <button
                className="btn-pay btn-upi"
                disabled={paying || orderItems.length === 0}
                onClick={() => handlePay('upi')}
              >
                UPI
              </button>
              <button
                className="btn-pay btn-split"
                disabled={paying || orderItems.length === 0}
                onClick={() => {
                  setShowSplit(!showSplit);
                  setShowDiscount(false);
                  setShowKOTHistory(false);
                }}
              >
                Split
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Pending Customer Details Modal */}
      {showCustomerModal && (
        <div className="customer-modal-overlay">
          <div className="customer-modal">
            <div className="customer-modal-header">
              <h3>Customer Details</h3>
              <button
                className="close-modal-btn"
                onClick={() => {
                  setShowCustomerModal(false);
                  setCustomerDataError(null);
                  setNameSuggestions([]);
                  setPhoneSuggestions([]);
                }}
                disabled={isSavingPending}
              >
                <X size={20} />
              </button>
            </div>

            <div className="customer-modal-body">
              <p className="modal-description">
                Please enter customer details to keep this bill pending.
              </p>

              <div className="input-group">
                <label>
                  <User size={16} /> Customer Name *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={customerName}
                    onChange={handleNameChange}
                    placeholder="Enter customer name"
                    disabled={isSavingPending}
                    autoFocus
                    autoComplete="off"
                  />
                  {nameSuggestions.length > 0 && (
                    <div className="customer-suggestions">
                      {nameSuggestions.map((c) => (
                        <div
                          key={c.id}
                          className="suggestion-item"
                          onClick={() => selectNameSuggestion(c)}
                        >
                          <span className="sug-name">{c.name}</span>
                          <span className="sug-phone">{c.phone}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="input-group">
                <label>
                  <Phone size={16} /> Mobile Number *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={handlePhoneChange}
                    placeholder="Enter mobile number"
                    disabled={isSavingPending}
                    autoComplete="off"
                  />
                  {phoneSuggestions.length > 0 && (
                    <div className="customer-suggestions">
                      {phoneSuggestions.map((c) => (
                        <div
                          key={c.id}
                          className="suggestion-item"
                          onClick={() => selectPhoneSuggestion(c)}
                        >
                          <span className="sug-phone">{c.phone}</span>
                          <span className="sug-name">{c.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {customerDataError && (
                <div className="modal-error">
                  <AlertCircle size={16} />
                  <span>{customerDataError}</span>
                </div>
              )}
            </div>

            <div className="customer-modal-footer">
              <button
                className="btn-cancel"
                onClick={() => {
                  setShowCustomerModal(false);
                  setCustomerDataError(null);
                }}
                disabled={isSavingPending}
              >
                Cancel
              </button>
              <button
                className="btn-confirm"
                onClick={onConfirmPending}
                disabled={isSavingPending}
              >
                {isSavingPending ? 'Saving...' : 'Keep Pending'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
