import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Lock, Plus, Minus, Loader, AlertCircle, Tag, Percent, X } from 'lucide-react';

// ─── Theme (matches desktop TableManagement) ─────────────────────────────────
const T = {
  bg: '#F8F9FA',
  white: '#FFFFFF',
  dark: '#212529',
  secondary: '#6C757D',
  muted: '#ADB5BD',
  border: '#DEE2E6',
  cardBorder: '#E9ECEF',
  primary: '#DC3545',
  primaryLight: '#FFEBEE',
  sidebarBg: '#FFFFFF',
  sidebarActive: '#DC3545',
  sidebarActiveBg: '#FFEBEE',
  headerBg: '#FFFFFF',
  panelBg: '#F8F9FA',
  errorBg: '#F8D7DA',
  errorText: '#842029',
  green: '#28A745',
  amber: '#FFC107',
  blue: '#0D6EFD',
  purple: '#6F42C1',
  teal: '#0DCAF0',
};

// Food type dot
const FOOD_DOT = { veg: '#28A745', 'non-veg': '#DC3545' };
function FoodDot({ type }) {
  const c = FOOD_DOT[type];
  if (!c) return null;
  return <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:c, marginRight:5, flexShrink:0 }} />;
}

export default function TableOrderEntry({ table, onBack, onTableUpdate }) {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState(null);

  const [orderId, setOrderId] = useState(table?.currentOrderId || null);
  const [orderItems, setOrderItems] = useState([]);

  const [saving] = useState(false);
  const [error, setError] = useState(null);
  const [kotSending, setKotSending] = useState(false);

  const [showDiscount, setShowDiscount] = useState(false);
  const [discountType, setDiscountType] = useState('fixed');
  const [discountInput, setDiscountInput] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);

  const [showSplit, setShowSplit] = useState(false);
  const [splitCash, setSplitCash] = useState('');
  const [splitUpi, setSplitUpi] = useState('');
  const [paying, setPaying] = useState(false);

  const [showKOTHistory, setShowKOTHistory] = useState(false);

  const debounceRefs = useRef({});
  const listBottomRef = useRef(null);
  const orderItemsUnsubRef = useRef(null);

  // ─── Load menu ────────────────────────────────────────────────────────────
  const loadMenu = useCallback(async () => {
    setMenuLoading(true); setMenuError(null);
    try {
      const [itemsRes] = await Promise.all([
        window.electronAPI.getMenuItems({ includeInactive: false }),
        window.electronAPI.getMenuCategoriesWithIds(),
      ]);
      const items = (itemsRes?.items || []).filter(i => i.isActive !== false && !i.isOutOfStock);
      setMenuItems(items);
      const seen = new Set(); const cats = [];
      for (const item of items) {
        const sc = item.subCategory || item.category || 'Other';
        if (!seen.has(sc)) { seen.add(sc); cats.push(sc); }
      }
      setCategories(cats);
      setSelectedCategory(cats[0] || null);
    } catch (e) { setMenuError(e.message || 'Failed to load menu'); }
    finally { setMenuLoading(false); }
  }, []);

  // ─── Real-time order items ────────────────────────────────────────────────
  const subscribeToOrderItems = useCallback((oid) => {
    if (!oid) return;
    if (orderItemsUnsubRef.current) { orderItemsUnsubRef.current(); orderItemsUnsubRef.current = null; }
    const channel = `order-items-update:${oid}`;
    window.electronAPI.invoke('firebase:subscribe-order-items', { orderId: oid });
    const sub = window.electronAPI.on(channel, items => setOrderItems(items));
    orderItemsUnsubRef.current = () => {
      window.electronAPI.invoke('firebase:unsubscribe-order-items', { orderId: oid });
      window.electronAPI.removeListener(channel, sub);
    };
  }, []);

  useEffect(() => {
    loadMenu();
    const oid = table?.currentOrderId || orderId;
    if (oid) subscribeToOrderItems(oid);
    return () => { if (orderItemsUnsubRef.current) orderItemsUnsubRef.current(); };
  }, [loadMenu, subscribeToOrderItems, table, orderId]);

  useEffect(() => {
    if (listBottomRef.current) listBottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [orderItems.length]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const scheduleUpsert = useCallback((oid, item, tableId, sub) => {
    clearTimeout(debounceRefs.current[item.menuItemId]);
    debounceRefs.current[item.menuItemId] = setTimeout(async () => {
      try { await window.electronAPI.upsertOrderItem(oid, { ...item, tableId, subtotal: sub }); }
      catch (e) { console.error('Upsert failed:', e); }
    }, 500);
  }, []);

  const ensureOrder = useCallback(async () => {
    if (orderId) return orderId;
    const res = await window.electronAPI.createOrder({ tableId: table.id, tableName: table.name, status: 'open', createdAt: new Date() });
    if (!res?.success) throw new Error(res?.error || 'Failed to create order');
    setOrderId(res.orderId); subscribeToOrderItems(res.orderId);
    return res.orderId;
  }, [orderId, table, subscribeToOrderItems]);

  const subtotal = orderItems.reduce((s, i) => s + i.currentQty * i.unitPrice, 0);
  const payableTotal = Math.max(0, subtotal - discountAmount);

  const kotGroups = (() => {
    const sorted = [...orderItems].sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    const groups = []; let n = 1;
    for (const item of sorted) {
      const t = item.created_at || 0; const last = groups[groups.length - 1];
      if (!last || t - last.sentAt > 30000) groups.push({ kotNumber: n++, sentAt: t, items: [item] });
      else last.items.push(item);
    }
    return groups;
  })();

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleAddItem = useCallback(async (menuItem) => {
    let oid; try { oid = await ensureOrder(); } catch (e) { setError(e.message); return; }
    setOrderItems(prev => {
      const existing = prev.find(i => i.menuItemId === menuItem.id);
      const updated = existing
        ? prev.map(i => i.menuItemId === menuItem.id ? { ...i, currentQty: i.currentQty + 1 } : i)
        : [...prev, { menuItemId: menuItem.id, menuItemName: menuItem.name, unitPrice: menuItem.price, currentQty: 1, sentQty: 0, category: menuItem.subCategory || menuItem.category || '' }];
      const item = updated.find(i => i.menuItemId === menuItem.id);
      scheduleUpsert(oid, item, table.id, updated.reduce((s, i) => s + i.currentQty * i.unitPrice, 0));
      return updated;
    });
  }, [ensureOrder, scheduleUpsert, table]);

  const handleIncrement = useCallback(async (menuItemId) => {
    let oid; try { oid = await ensureOrder(); } catch (e) { setError(e.message); return; }
    setOrderItems(prev => {
      const updated = prev.map(i => i.menuItemId === menuItemId ? { ...i, currentQty: i.currentQty + 1 } : i);
      const item = updated.find(i => i.menuItemId === menuItemId);
      scheduleUpsert(oid, item, table.id, updated.reduce((s, i) => s + i.currentQty * i.unitPrice, 0));
      return updated;
    });
  }, [ensureOrder, scheduleUpsert, table]);

  const handleDecrement = useCallback(async (menuItemId) => {
    let oid; try { oid = await ensureOrder(); } catch (e) { setError(e.message); return; }
    setOrderItems(prev => {
      const item = prev.find(i => i.menuItemId === menuItemId); if (!item) return prev;
      const pendingQty = item.currentQty - item.sentQty;
      if (pendingQty <= 1 && item.sentQty > 0) return prev;
      if (pendingQty <= 1 && item.sentQty === 0) {
        window.electronAPI.deleteOrderItem(oid, menuItemId).catch(console.error);
        return prev.filter(i => i.menuItemId !== menuItemId);
      }
      const updated = prev.map(i => i.menuItemId === menuItemId ? { ...i, currentQty: i.currentQty - 1 } : i);
      const updatedItem = updated.find(i => i.menuItemId === menuItemId);
      scheduleUpsert(oid, updatedItem, table.id, updated.reduce((s, i) => s + i.currentQty * i.unitPrice, 0));
      return updated;
    });
  }, [ensureOrder, scheduleUpsert, table]);

  const handleSendKot = useCallback(async () => {
    const kotItems = orderItems.filter(i => i.currentQty - i.sentQty > 0);
    if (!kotItems.length) { setError('No new items to send'); return; }
    if (!orderId) { setError('No order created yet'); return; }
    setKotSending(true);
    try {
      const res = await window.electronAPI.sendKot({ orderId, tableId: table.id, tableName: table.name, kotItems });
      if (!res?.success) throw new Error(res?.error || 'KOT failed');
      setOrderItems(prev => prev.map(i => ({ ...i, sentQty: i.currentQty })));
      if (onTableUpdate) onTableUpdate({ ...table, status: 'occupied', currentOrderId: orderId });
    } catch (e) { setError(e.message); } finally { setKotSending(false); }
  }, [orderItems, orderId, table, onTableUpdate]);

  const handleKeepPending = useCallback(async () => {
    if (!orderId && orderItems.length > 0) { try { await ensureOrder(); } catch (e) { setError(e.message); return; } }
    onBack();
  }, [orderId, orderItems, ensureOrder, onBack]);

  const applyDiscount = () => {
    const val = parseFloat(discountInput) || 0;
    let amt = discountType === 'percent' ? (subtotal * val) / 100 : val;
    if (amt > subtotal) amt = subtotal;
    setDiscountAmount(amt); setShowDiscount(false);
  };

  const handlePay = useCallback(async (type) => {
    if (!orderId) { setError('No order to bill'); return; }
    setPaying(true);
    try {
      const res = await window.electronAPI.generateBill({ orderId, tableId: table.id, payments: [{ type, amount: payableTotal }], discount: discountAmount });
      if (!res?.success) throw new Error(res?.error || 'Bill failed');
      onBack();
    } catch (e) { setError(e.message); } finally { setPaying(false); }
  }, [orderId, table, payableTotal, discountAmount, onBack]);

  const handleSplitPay = useCallback(async () => {
    const cash = parseFloat(splitCash) || 0; const upi = parseFloat(splitUpi) || 0;
    if (Math.abs(cash + upi - payableTotal) > 0.01) { setError(`Cash + UPI must equal ₹${payableTotal.toFixed(2)}`); return; }
    if (!orderId) { setError('No order to bill'); return; }
    setPaying(true);
    try {
      const res = await window.electronAPI.generateBill({ orderId, tableId: table.id, payments: [{ type: 'cash', amount: cash }, { type: 'upi', amount: upi }], discount: discountAmount });
      if (!res?.success) throw new Error(res?.error || 'Bill failed');
      onBack();
    } catch (e) { setError(e.message); } finally { setPaying(false); }
  }, [splitCash, splitUpi, payableTotal, orderId, table, discountAmount, onBack]);

  const visibleItems = selectedCategory
    ? menuItems.filter(i => (i.subCategory || i.category || 'Other') === selectedCategory)
    : menuItems;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background: T.bg, color: T.dark, fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 20px', background: T.white, borderBottom:`1px solid ${T.border}`, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
        <button onClick={onBack} style={btn(T.bg, T.dark, T.border)}>
          <ArrowLeft size={16} />
        </button>
        <span style={{ fontWeight:700, fontSize:17, color: T.dark }}>{table?.name}</span>
        {table?.section && <span style={{ color: T.secondary, fontSize:13 }}>{table.section}</span>}
        {saving && <Loader size={14} style={{ marginLeft:'auto', color: T.secondary }} />}
      </div>

      {/* Error bar */}
      {error && (
        <div style={{ background: T.errorBg, color: T.errorText, padding:'8px 20px', display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
          <AlertCircle size={14} />
          <span style={{ flex:1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background:'none', border:'none', color: T.errorText, cursor:'pointer', fontSize:16 }}>×</button>
        </div>
      )}

      {/* Body */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* ── Left: Menu Browser (35%) ── */}
        <div style={{ width:'35%', display:'flex', borderRight:`1px solid ${T.border}`, overflow:'hidden' }}>

          {/* Sub-category sidebar */}
          <div style={{ width:130, overflowY:'auto', background: T.white, borderRight:`1px solid ${T.border}`, padding:'8px 0' }}>
            {menuLoading ? (
              <div style={{ padding:16, textAlign:'center', color: T.secondary }}><Loader size={18} /></div>
            ) : menuError ? (
              <div style={{ padding:8 }}>
                <div style={{ color: T.primary, fontSize:12, marginBottom:8 }}>{menuError}</div>
                <button onClick={loadMenu} style={btn(T.bg, T.dark, T.border, 12)}>Retry</button>
              </div>
            ) : categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} style={{
                display:'block', width:'100%', textAlign:'left', padding:'10px 14px',
                border:'none', cursor:'pointer', fontSize:12, fontWeight: selectedCategory === cat ? 700 : 400,
                background: selectedCategory === cat ? T.primaryLight : 'transparent',
                color: selectedCategory === cat ? T.primary : T.dark,
                borderLeft: selectedCategory === cat ? `3px solid ${T.primary}` : '3px solid transparent',
                transition:'all 0.15s',
              }}>
                {cat}
              </button>
            ))}
          </div>

          {/* Item grid */}
          <div style={{ flex:1, overflowY:'auto', padding:10, display:'flex', flexDirection:'column', gap:6, background: T.bg }}>
            {visibleItems.map(item => (
              <button key={item.id} onClick={() => handleAddItem(item)} style={{
                background: T.white, border:`1px solid ${T.cardBorder}`, borderRadius:8,
                padding:'10px 12px', cursor:'pointer', textAlign:'left', color: T.dark,
                display:'flex', flexDirection:'column', gap:3, boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
                transition:'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.boxShadow = '0 2px 8px rgba(220,53,69,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.cardBorder; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
              >
                <div style={{ display:'flex', alignItems:'center', fontSize:13, fontWeight:600 }}>
                  <FoodDot type={item.foodType} />{item.name}
                </div>
                <div style={{ color: T.secondary, fontSize:12 }}>₹{Number(item.price).toFixed(2)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Right: Billing Area (65%) ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background: T.white }}>

          {/* Order items list */}
          <div style={{ flex:1, overflowY:'auto', padding:16 }}>
            {orderItems.length === 0 ? (
              <div style={{ color: T.muted, textAlign:'center', marginTop:60, fontSize:14 }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🍽️</div>
                Tap items on the left to add them
              </div>
            ) : (
              <>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ borderBottom:`2px solid ${T.border}` }}>
                      <th style={{ textAlign:'left', padding:'6px 8px', fontWeight:600, color: T.secondary, fontSize:12 }}>Item</th>
                      <th style={{ textAlign:'center', padding:'6px 8px', fontWeight:600, color: T.secondary, fontSize:12 }}>Qty</th>
                      <th style={{ textAlign:'right', padding:'6px 8px', fontWeight:600, color: T.secondary, fontSize:12 }}>Price</th>
                      <th style={{ textAlign:'right', padding:'6px 8px', fontWeight:600, color: T.secondary, fontSize:12 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...orderItems]
                      .sort((a, b) => {
                        const aS = a.sentQty > 0 && a.currentQty === a.sentQty;
                        const bS = b.sentQty > 0 && b.currentQty === b.sentQty;
                        return aS === bS ? 0 : aS ? -1 : 1;
                      })
                      .map(item => {
                        const pendingQty = item.currentQty - item.sentQty;
                        const isSent = item.sentQty > 0 && pendingQty === 0;
                        return (
                          <tr key={item.menuItemId} style={{ borderBottom:`1px solid ${T.cardBorder}` }}>
                            <td style={{ padding:'9px 8px', color: isSent ? T.muted : T.dark }}>
                              {isSent && <Lock size={10} style={{ marginRight:4, color: T.muted }} />}
                              {item.menuItemName}
                              {item.sentQty > 0 && pendingQty > 0 && (
                                <span style={{ color: T.muted, fontSize:11, marginLeft:4 }}>({item.sentQty} sent)</span>
                              )}
                            </td>
                            <td style={{ padding:'9px 4px', textAlign:'center' }}>
                              {isSent ? (
                                <span style={{ color: T.muted, fontWeight:600 }}>{item.currentQty}</span>
                              ) : (
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                                  <button onClick={() => handleDecrement(item.menuItemId)} style={qtyBtn}>
                                    <Minus size={11} />
                                  </button>
                                  <span style={{ minWidth:22, textAlign:'center', fontWeight:600 }}>{item.currentQty}</span>
                                  <button onClick={() => handleIncrement(item.menuItemId)} style={qtyBtn}>
                                    <Plus size={11} />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td style={{ padding:'9px 8px', textAlign:'right', color: T.secondary }}>
                              ₹{Number(item.unitPrice).toFixed(2)}
                            </td>
                            <td style={{ padding:'9px 8px', textAlign:'right', fontWeight:600, color: T.dark }}>
                              ₹{(item.currentQty * item.unitPrice).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                <div ref={listBottomRef} />
              </>
            )}
          </div>

          {/* Totals */}
          <div style={{ padding:'10px 20px', borderTop:`1px solid ${T.border}`, background: T.bg }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color: T.secondary, marginBottom:4 }}>
              <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color: T.primary, marginBottom:4 }}>
                <span>Discount</span><span>-₹{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:16, fontWeight:700, color: T.dark }}>
              <span>Total</span><span>₹{payableTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Discount panel */}
          {showDiscount && (
            <div style={{ padding:'10px 16px', background: T.white, borderTop:`1px solid ${T.border}` }}>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <button onClick={() => setDiscountType('fixed')} style={btn(discountType==='fixed' ? T.primary : T.bg, discountType==='fixed' ? '#fff' : T.dark, T.border, 12)}>
                  <Tag size={12} /> Fixed
                </button>
                <button onClick={() => setDiscountType('percent')} style={btn(discountType==='percent' ? T.primary : T.bg, discountType==='percent' ? '#fff' : T.dark, T.border, 12)}>
                  <Percent size={12} /> %
                </button>
                <input type="number" min="0" value={discountInput} onChange={e => setDiscountInput(e.target.value)}
                  placeholder={discountType === 'percent' ? '0–100' : 'Amount'}
                  style={{ flex:1, border:`1px solid ${T.border}`, borderRadius:6, padding:'5px 10px', fontSize:13, color: T.dark, background: T.white }} />
                <button onClick={applyDiscount} style={btn(T.green, '#fff', T.green, 12)}>Apply</button>
                <button onClick={() => { setShowDiscount(false); setDiscountInput(''); }} style={btn(T.bg, T.dark, T.border, 12)}><X size={12} /></button>
              </div>
            </div>
          )}

          {/* Split panel */}
          {showSplit && (
            <div style={{ padding:'10px 16px', background: T.white, borderTop:`1px solid ${T.border}` }}>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <input type="number" min="0" value={splitCash} onChange={e => setSplitCash(e.target.value)} placeholder="Cash"
                  style={splitInput} />
                <input type="number" min="0" value={splitUpi} onChange={e => setSplitUpi(e.target.value)} placeholder="UPI"
                  style={splitInput} />
                <span style={{ fontSize:12, color: Math.abs((parseFloat(splitCash)||0)+(parseFloat(splitUpi)||0)-payableTotal)<0.01 ? T.green : T.primary }}>
                  = ₹{((parseFloat(splitCash)||0)+(parseFloat(splitUpi)||0)).toFixed(2)} / ₹{payableTotal.toFixed(2)}
                </span>
                <button onClick={handleSplitPay}
                  disabled={paying || Math.abs((parseFloat(splitCash)||0)+(parseFloat(splitUpi)||0)-payableTotal)>0.01}
                  style={btn(T.green, '#fff', T.green, 12)}>
                  {paying ? <Loader size={12} /> : 'Confirm'}
                </button>
                <button onClick={() => setShowSplit(false)} style={btn(T.bg, T.dark, T.border, 12)}><X size={12} /></button>
              </div>
            </div>
          )}

          {/* KOT History panel */}
          {showKOTHistory && (
            <div style={{ borderTop:`1px solid ${T.border}`, background: T.white, maxHeight:300, overflowY:'auto' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 16px', borderBottom:`1px solid ${T.border}`, background: T.bg }}>
  
                <span style={{ fontWeight:700, fontSize:13, color: T.dark }}>KOT History</span>
                <span style={{ fontSize:12, color: T.secondary }}>{kotGroups.length} KOT{kotGroups.length !== 1 ? 's' : ''}</span>
              </div>
              {kotGroups.length === 0 ? (
                <div style={{ padding:16, color: T.muted, fontSize:13, textAlign:'center' }}>No KOTs sent yet</div>
              ) : kotGroups.map(kot => (
                <div key={kot.kotNumber} style={{ borderBottom:`1px solid ${T.cardBorder}`, padding:'10px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ background: T.amber, color: T.dark, fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:4 }}>
                      KOT #{kot.kotNumber}
                    </span>
                    <span style={{ color: T.secondary, fontSize:11 }}>
                      {kot.sentAt ? new Date(kot.sentAt).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true }) : ''}
                    </span>
                    <span style={{ marginLeft:'auto', fontSize:13, fontWeight:700, color: T.dark }}>
                      ₹{kot.items.reduce((s, i) => s + i.currentQty * i.unitPrice, 0).toFixed(2)}
                    </span>
                  </div>
                  {kot.items.map(item => (
                    <div key={item.menuItemId} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color: T.secondary, paddingLeft:8, marginBottom:2 }}>
                      <span>{item.currentQty}× {item.menuItemName}</span>
                      <span>₹{(item.currentQty * item.unitPrice).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Action bar */}
          <div style={{ display:'flex', gap:6, padding:'10px 14px', background: T.white, borderTop:`1px solid ${T.border}`, flexWrap:'wrap', boxShadow:'0 -1px 4px rgba(0,0,0,0.06)' }}>
            <button onClick={handleSendKot} disabled={kotSending} style={btn('#FFC107', T.dark, '#FFC107')}>
              {kotSending ? <Loader size={14} /> : 'Send KOT'}
            </button>
            <button onClick={() => { setShowKOTHistory(h => !h); setShowDiscount(false); setShowSplit(false); }}
              style={btn(showKOTHistory ? T.cardBorder : T.bg, T.dark, T.border)}>
              KOT History
            </button>
            <button onClick={handleKeepPending} style={btn(T.bg, T.dark, T.border)}>Keep Pending</button>
            <button onClick={() => { setShowDiscount(d => !d); setShowSplit(false); setShowKOTHistory(false); }}
              style={btn(showDiscount ? T.purple : T.bg, showDiscount ? '#fff' : T.dark, T.border)}>
              Discount
            </button>
            <div style={{ flex:1 }} />
            <button onClick={() => handlePay('cash')} disabled={paying || !orderItems.length} style={btn(T.green, '#fff', T.green)}>
              {paying ? <Loader size={14} /> : 'Cash'}
            </button>
            <button onClick={() => handlePay('upi')} disabled={paying || !orderItems.length} style={btn(T.blue, '#fff', T.blue)}>
              UPI
            </button>
            <button onClick={() => { setShowSplit(s => !s); setShowDiscount(false); setShowKOTHistory(false); }}
              disabled={!orderItems.length} style={btn(T.teal, T.dark, T.teal)}>
              Split
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────
const btn = (bg, color, borderColor, fontSize = 13) => ({
  background: bg, border: `1px solid ${borderColor}`, borderRadius: 6,
  padding: '6px 12px', color, cursor: 'pointer', fontSize,
  display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500,
  fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
});

const qtyBtn = {
  background: '#F8F9FA', border: '1px solid #DEE2E6', borderRadius: 4,
  padding: '3px 7px', color: '#212529', cursor: 'pointer',
  display: 'flex', alignItems: 'center',
};

const splitInput = {
  width: 90, border: '1px solid #DEE2E6', borderRadius: 6,
  padding: '5px 10px', color: '#212529', fontSize: 13, background: '#FFFFFF',
};
