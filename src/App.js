import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { 
  Package, 
  ShoppingCart, 
  BarChart3, 
  Settings as SettingsIcon,
  Menu,
  X,
  Coffee,
  ArrowRight
} from 'lucide-react';
import './App.css';

// Import components
import Dashboard from './components/Dashboard';
import ProductManagement from './components/ProductManagement';
import InventoryManagement from './components/InventoryManagement';
import DailyTransfer from './components/DailyTransfer';
import POSSystem from './components/POSSystem';
import TableManagement from './components/TableManagement';
import TablePOS from './components/TablePOS';
import SalesReports from './components/SalesReports';
import Settings from './components/Settings';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentUser] = useState('Admin'); // In a real app, this would come from authentication
  const [selectedTable, setSelectedTable] = useState(null);

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

  const menuItems = [
    { path: '/', name: 'Dashboard', icon: BarChart3 },
    { path: '/tables', name: 'Tables', icon: Coffee },
    { path: '/products', name: 'Products', icon: Package },
    { path: '/inventory', name: 'Inventory', icon: Package },
    { path: '/transfer', name: 'Daily Transfer', icon: ArrowRight },
    { path: '/pos', name: 'POS', icon: ShoppingCart },
    { path: '/reports', name: 'Reports', icon: BarChart3 },
    { path: '/settings', name: 'Settings', icon: SettingsIcon }
  ];

  return (
    <Router>
      <div className="app">
        {/* Sidebar */}
        <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-header">
            <h2>Inventory POS</h2>
            <button onClick={toggleSidebar} className="toggle-btn">
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
          
          <nav className="sidebar-nav">
            {menuItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <Link key={item.path} to={item.path} className="nav-item">
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
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className={`main-content ${sidebarOpen ? 'with-sidebar' : 'full-width'}`}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tables" element={
              selectedTable ? (
                <TablePOS 
                  table={selectedTable} 
                  onBack={handleBackToTables} 
                  onTableUpdate={handleTableUpdate} 
                />
              ) : (
                <TableManagement onSelectTable={handleTableSelect} />
              )
            } />
            <Route path="/products" element={<ProductManagement />} />
            <Route path="/inventory" element={<InventoryManagement />} />
            <Route path="/transfer" element={<DailyTransfer />} />
            <Route path="/pos" element={<POSSystem />} />
            <Route path="/reports" element={<SalesReports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
