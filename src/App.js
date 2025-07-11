/**
 * MAIN APPLICATION COMPONENT - React Router Implementation
 * 
 * This is the root React component for the Inventory POS Application.
 * It implements a single-page application with:
 * - Hash-based routing for Electron compatibility
 * - Responsive sidebar navigation
 * - Dynamic component loading based on routes
 * - Table management with state persistence
 * - Clean UI with icon-based navigation
 * 
 * Architecture:
 * - Uses React Router for client-side routing
 * - Implements a collapsible sidebar for navigation
 * - Manages global application state (user, selected table)
 * - Provides consistent layout across all modules
 * 
 * Features:
 * - Dashboard: Business metrics and overview
 * - Tables: Restaurant/bar table management
 * - Products: Product catalog management
 * - Inventory: Stock level monitoring
 * - Daily Transfer: Stock movement between locations
 * - POS: Point of sale transactions
 * - Reports: Sales analysis and reporting
 * - Spendings: Business expense tracking
 * - Counter Balance: Daily cash management
 * - Pending Bills: Saved bills for later completion
 * - Settings: Application configuration
 * 
 * @author Ajit Reddy
 * @version 1.0.0
 * @since 2024
 */

// React core imports
import React, { useState } from "react";
import { HashRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";

// Icon imports for navigation menu
import {
  Package,         // Products and inventory icons
  ShoppingCart,    // POS system icon
  BarChart3,       // Dashboard and reports icon
  Settings as SettingsIcon, // Settings icon
  Menu,            // Menu open icon
  X,               // Menu close icon
  Coffee,          // Tables icon
  ArrowRight,      // Transfer icon
  DollarSign,      // Spendings icon
  Wallet,          // Counter balance icon
  Clock,           // Pending bills icon
} from "lucide-react";

// Application styles
import "./App.css";

// Business component imports
import Dashboard from "./components/Dashboard";                   // Main dashboard
import ProductManagement from "./components/ProductManagement";   // Product catalog
import InventoryManagement from "./components/InventoryManagement"; // Stock monitoring
import DailyTransfer from "./components/DailyTransfer";           // Stock transfers
import POSSystem from "./components/POSSystem";                   // Point of sale
import TableManagement from "./components/TableManagement";       // Table management
import TablePOS from "./components/TablePOS";                     // Table-specific POS
import SalesReports from "./components/SalesReports";             // Sales reporting
import Settings from "./components/Settings";                     // App settings
import Spendings from "./components/Spendings";                   // Expense tracking
import CounterBalance from "./components/CounterBalance";         // Cash management
import PendingBills from "./components/PendingBills";             // Saved bills

/**
 * APP CONTENT COMPONENT
 * 
 * Main application content component that handles:
 * - Sidebar navigation state
 * - Route-based component rendering
 * - Table selection and management
 * - Global application state
 * 
 * State Management:
 * - sidebarOpen: Controls sidebar visibility
 * - currentUser: Current user information (Admin by default)
 * - selectedTable: Currently selected table for POS operations
 * - location: Current route location from React Router
 */
function AppContent() {
  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true);  // Sidebar collapsed/expanded state
  const [currentUser] = useState("Admin");                // Current user (future: from authentication)
  
  // Business State
  const [selectedTable, setSelectedTable] = useState(null); // Currently selected table for POS
  
  // Router state
  const location = useLocation(); // Current route location

  /**
   * Toggle sidebar visibility
   * Allows users to collapse/expand the navigation sidebar
   */
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  /**
   * Handle table selection from TableManagement component
   * When a table is selected, it switches to TablePOS component
   * @param {Object} table - Selected table object
   */
  const handleTableSelect = (table) => {
    setSelectedTable(table);
  };

  /**
   * Handle table updates from TablePOS component
   * Updates the selected table state when table status changes
   * @param {Object} updatedTable - Updated table object
   */
  const handleTableUpdate = (updatedTable) => {
    setSelectedTable(updatedTable);
  };

  /**
   * Handle back navigation from TablePOS to TableManagement
   * Clears the selected table to return to table list view
   */
  const handleBackToTables = () => {
    setSelectedTable(null);
  };

  /**
   * Handle navigation item clicks
   * Manages state transitions when navigating between different modules
   * @param {Event} event - Click event
   * @param {string} path - Navigation path
   * @param {string} name - Navigation item name
   */
  const handleNavItemClick = (event, path, name) => {
    console.log(`Navigation clicked: ${name} -> ${path}`);
    console.log(`Current location: ${location.pathname}`);
    
    // Reset table selection when navigating away from tables
    // This ensures clean state when switching between modules
    if (path !== '/tables') {
      setSelectedTable(null);
    }
    
    // Let the Link component handle the navigation naturally
    // Don't prevent default or use navigate() to avoid conflicts
  };

  /**
   * NAVIGATION MENU CONFIGURATION
   * 
   * Defines all navigation items with their routes, names, and icons.
   * Each item corresponds to a major business module.
   * 
   * Menu Structure:
   * - Dashboard: Business overview and key metrics
   * - Tables: Restaurant/bar table management
   * - Products: Product catalog management
   * - Inventory: Stock level monitoring
   * - Daily Transfer: Stock movement operations
   * - POS: Point of sale transactions
   * - Reports: Sales analysis and reporting
   * - Spendings: Business expense tracking
   * - Counter Balance: Daily cash management
   * - Pending Bills: Saved bills management
   * - Settings: Application configuration
   */
  const menuItems = [
    { path: "/", name: "Dashboard", icon: BarChart3 },           // Main overview
    { path: "/tables", name: "Tables", icon: Coffee },             // Table management
    { path: "/products", name: "Products", icon: Package },        // Product catalog
    { path: "/inventory", name: "Inventory", icon: Package },      // Stock monitoring
    { path: "/transfer", name: "Daily Transfer", icon: ArrowRight }, // Stock transfers
    { path: "/pos", name: "POS", icon: ShoppingCart },             // Point of sale
    { path: "/reports", name: "Reports", icon: BarChart3 },         // Sales reports
    { path: "/spendings", name: "Spendings", icon: DollarSign },   // Expense tracking
    { path: "/counter-balance", name: "Counter Balance", icon: Wallet }, // Cash management
    { path: "/pending-bills", name: "Pending Bills", icon: Clock }, // Saved bills
    { path: "/settings", name: "Settings", icon: SettingsIcon },   // Configuration
  ];

  return (
    <div className="app">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-header">
          {sidebarOpen && <h2>Inventory POS</h2>}
          <button onClick={toggleSidebar} className="toggle-btn">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                className={`nav-item ${isActive ? "active" : ""}`}
                onClick={(event) => handleNavItemClick(event, item.path, item.name)}
              >
                <IconComponent size={20} />
                {sidebarOpen && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {sidebarOpen && (
          <div className="sidebar-footer">
            <div className="user-info">
              <span>Welcome, {currentUser}</span>
              <br />
              <span className="current-tab">Current: {location.pathname}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div
        className={`main-content ${
          sidebarOpen ? "with-sidebar" : "full-width"
        }`}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route
            path="/tables"
            element={
              selectedTable ? (
                <TablePOS
                  table={selectedTable}
                  onBack={handleBackToTables}
                  onTableUpdate={handleTableUpdate}
                />
              ) : (
                <TableManagement onSelectTable={handleTableSelect} />
              )
            }
          />
          <Route path="/products" element={<ProductManagement />} />
          <Route path="/inventory" element={<InventoryManagement />} />
          <Route path="/transfer" element={<DailyTransfer />} />
          <Route path="/pos" element={<POSSystem />} />
          <Route path="/reports" element={<SalesReports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/spendings" element={<Spendings />} />
          <Route path="/counter-balance" element={<CounterBalance />} />
          <Route path="/pending-bills" element={<PendingBills />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
