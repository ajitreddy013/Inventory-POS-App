import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { RefreshCw } from 'lucide-react';

const COLORS = {
  background: '#F8F9FA',
  white: '#FFFFFF',
  darkGray: '#212529',
  textSecondary: '#6C757D',
  mutedGray: '#ADB5BD',
  lightGray: '#DEE2E6',
  primary: '#DC3545',
  primaryLight: '#FFEBEE',
  greenAvailable: '#28A745',
  greenLight: '#D4EDDA',
  amberOccupied: '#FFC107',
  amberLight: '#FFF3CD',
  redPending: '#DC3545',
  redLight: '#F8D7DA',
  cardBorder: '#E9ECEF',
};

// Robust date parsing for Firestore Timestamp and strings
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') return new Date(val);
  if (typeof val === 'string') return new Date(val);
  // Firestore Timestamp object { seconds, nanoseconds } or { _seconds, _nanoseconds }
  if (val.seconds || val._seconds) {
    return new Date((val.seconds || val._seconds) * 1000);
  }
  return null;
}

function formatElapsed(ms) {
  if (!ms || ms <= 0) return null;
  const minutes = Math.floor(ms / 60000);
  return `${minutes} min`;
}

const TableManagement = ({ onSelectTable }) => {
  const [tables, setTables] = useState([]);
  const [sections, setSections] = useState([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // Refresh elapsed time every minute
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const loadTables = useCallback(async () => {
    try {
      const result = await window.electronAPI.invoke('firebase:get-tables');
      if (result.success) setTables(result.tables || []);
    } catch (err) {
      console.error('Error loading tables:', err);
    }
  }, []);

  const loadSections = useCallback(async () => {
    try {
      const result = await window.electronAPI.invoke('firebase:get-sections');
      if (result.success) setSections(result.sections || []);
    } catch (err) {
      console.error('Error loading sections:', err);
    }
  }, []);

  useEffect(() => {
    loadTables();
    loadSections();

    // Set up real-time subscription for tables
    let activeSubscription = null;
    const setupSubscription = async () => {
      try {
        // Subscribe to tables collection
        const result = await window.electronAPI.invoke(
          'firebase:subscribe-tables'
        );
        if (result.success) {
          // Listen for table updates from main process
          activeSubscription = window.electronAPI.on(
            'firebase:tables-changed',
            (changes) => {
              if (changes && changes.length > 0) {
                // Reload tables to get latest data
                loadTables();
              }
            }
          );
        }
      } catch (err) {
        console.error('Failed to subscribe to tables:', err);
      }
    };

    setupSubscription();

    return () => {
      if (activeSubscription) {
        window.electronAPI.removeListener(
          'firebase:tables-changed',
          activeSubscription
        );
      }
      window.electronAPI.invoke('firebase:unsubscribe-all');
    };
  }, [loadTables, loadSections]);

  const tablesBySection = {};
  sections.forEach((s) => {
    tablesBySection[s.id] = [];
  });
  tables.forEach((t) => {
    const sid = t.sectionId || t.section_id;
    if (sid) {
      if (!tablesBySection[sid]) tablesBySection[sid] = [];
      tablesBySection[sid].push(t);
    }
  });

  const unassigned = tables.filter((t) => !t.sectionId && !t.section_id);

  const getTableState = (table) => {
    const amount =
      table.currentBillAmount ||
      table.current_bill_amount ||
      table.billAmount ||
      0;
    const status = table.status || 'available';
    if (
      status === 'pending_bill' ||
      status === 'paid' ||
      status === 'paid_bill' ||
      status === 'Pending Bill' ||
      status === 'Printed'
    )
      return 'pending_bill';
    if (
      amount > 0 ||
      status === 'occupied' ||
      status === 'Running' ||
      status === 'Occupied'
    )
      return 'occupied';
    return 'available';
  };

  const getCardBg = (state) => {
    switch (state) {
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

  const renderTable = (table) => {
    const state = getTableState(table);
    const backgroundColor = getCardBg(state);
    const amount =
      table.currentBillAmount ||
      table.current_bill_amount ||
      table.billAmount ||
      0;
    const occupiedAtVal =
      table.occupiedAt || table.occupied_at || table.occupied_since;
    const occupiedAtDate = parseDate(occupiedAtVal);
    const elapsedTime = occupiedAtDate
      ? formatElapsed(now - occupiedAtDate.getTime())
      : null;
    const isOccupied = state !== 'available';

    return (
      <div
        key={table.id}
        onClick={() => onSelectTable(table)}
        style={{
          width: 100,
          aspectRatio: 1,
          backgroundColor,
          borderRadius: 16,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 8,
          position: 'relative',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          border: `1px solid ${COLORS.cardBorder}`,
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.03)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            width: '100%',
          }}
        >
          {/* Row 1: Elapsed Time - Always rendered to maintain layout, but empty if not occupied */}
          <div
            style={{
              fontSize: 10,
              color: '#2C3E50',
              fontWeight: '600',
              marginBottom: 4,
              height: 12,
              opacity: isOccupied ? 1 : 0,
            }}
          >
            {elapsedTime || (isOccupied ? '0 min' : '')}
          </div>

          {/* Row 2: Table Name */}
          <div
            style={{
              fontSize: 26,
              fontWeight: '800',
              color: '#2C3E50',
              textAlign: 'center',
              margin: '4px 0',
              letterSpacing: 0.5,
            }}
          >
            {table.name}
          </div>

          {/* Row 3: Bill Amount */}
          <div
            style={{
              fontSize: 14,
              fontWeight: '700',
              color: '#2C3E50',
              marginTop: 4,
              height: 16,
              opacity: isOccupied ? 1 : 0,
            }}
          >
            {amount > 0 ? `₹${amount}` : isOccupied ? '₹0' : ''}
          </div>
        </div>
      </div>
    );
  };

  const renderSection = (sectionName, sectionTables) => (
    <div key={sectionName} style={{ marginBottom: 32 }}>
      <div
        style={{
          fontSize: 16,
          fontWeight: '700',
          color: COLORS.darkGray,
          marginBottom: 16,
          paddingLeft: 4,
        }}
      >
        {sectionName}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        {sectionTables.map(renderTable)}
      </div>
    </div>
  );

  const noSections = sections.length === 0 && unassigned.length === 0;

  return (
    <div
      style={{
        backgroundColor: COLORS.background,
        minHeight: '100vh',
        padding: '24px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h1
          style={{
            fontSize: 24,
            fontWeight: '700',
            color: COLORS.darkGray,
            margin: 0,
          }}
        >
          Tables
        </h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => {
              loadTables();
              loadSections();
            }}
            style={{
              backgroundColor: COLORS.white,
              border: `1px solid ${COLORS.lightGray}`,
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: '600',
              color: COLORS.primary,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <RefreshCw size={18} /> Refresh
          </button>
        </div>
      </div>

      {/* Main content */}
      <div>
        {noSections && (
          <div
            style={{
              textAlign: 'center',
              padding: '100px 20px',
              color: COLORS.textSecondary,
            }}
          >
            <div style={{ fontSize: 64, marginBottom: 16 }}>🪑</div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: '600',
                color: COLORS.darkGray,
              }}
            >
              No tables found
            </h2>
            <p>Go to Settings to add sections and tables</p>
          </div>
        )}

        {/* Sections */}
        {sections.map((s) => {
          const sectionTables = tablesBySection[s.id] || [];
          if (sectionTables.length === 0) return null;
          return renderSection(s.name, sectionTables);
        })}

        {/* Other */}
        {unassigned.length > 0 && renderSection('Other', unassigned)}
      </div>
    </div>
  );
};

TableManagement.propTypes = {
  onSelectTable: PropTypes.func.isRequired,
};

export default TableManagement;
