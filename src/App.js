import React, { useState } from "react";
import { HashRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import {
  Package,
  ShoppingCart,
  BarChart3,
  Settings as SettingsIcon,
  Menu,
  X,
  Coffee,
  ArrowRight,
  DollarSign,
  Wallet,
  Clock,
} from "lucide-react";
import "./App.css";

// Import components
import Dashboard from "./components/Dashboard";
import ProductManagement from "./components/ProductManagement";
import InventoryManagement from "./components/InventoryManagement";
import DailyTransfer from "./components/DailyTransfer";
import POSSystem from "./components/POSSystem";
import TableManagement from "./components/TableManagement";
import TablePOS from "./components/TablePOS";
import SalesReports from "./components/SalesReports";
import Settings from "./components/Settings";
import Spendings from "./components/Spendings";
import CounterBalance from "./components/CounterBalance";
import PendingBills from "./components/PendingBills";

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentUser] = useState("Admin"); // In a real app, this would come from authentication
  const [selectedTable, setSelectedTable] = useState(null);
  const location = useLocation();


  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleTableSelect = (table) => {
    setSelectedTable(table);
  };

  const handleTableUpdate = (updatedTable) => {
    setSelectedTable(updatedTable);
  };

  const handleBackToTables = () => {
    setSelectedTable(null);
  };

  const handleNavItemClick = (event, path, name) => {
    console.log(`Navigation clicked: ${name} -> ${path}`);
    console.log(`Current location: ${location.pathname}`);
    
    // Reset table selection when navigating away from tables
    if (path !== '/tables') {
      setSelectedTable(null);
    }
    
    // Let the Link component handle the navigation naturally
    // Don't prevent default or use navigate() to avoid conflicts
  };

  const menuItems = [
    { path: "/", name: "Dashboard", icon: BarChart3 },
    { path: "/tables", name: "Tables", icon: Coffee },
    { path: "/products", name: "Products", icon: Package },
    { path: "/inventory", name: "Inventory", icon: Package },
    { path: "/transfer", name: "Daily Transfer", icon: ArrowRight },
    { path: "/pos", name: "POS", icon: ShoppingCart },
    { path: "/reports", name: "Reports", icon: BarChart3 },
    { path: "/spendings", name: "Spendings", icon: DollarSign },
    { path: "/counter-balance", name: "Counter Balance", icon: Wallet },
    { path: "/pending-bills", name: "Pending Bills", icon: Clock },
    { path: "/settings", name: "Settings", icon: SettingsIcon },
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
