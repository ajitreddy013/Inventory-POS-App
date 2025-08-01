/**
 * LANDING PAGE COMPONENT
 * 
 * A stunning, modern landing page for the Inventory POS Application.
 * Features include:
 * - Hero section with animated elements
 * - Feature showcase with icons and descriptions
 * - Statistics and benefits display
 * - Call-to-action sections
 * - Responsive design with smooth animations
 * - Modern gradient backgrounds and card layouts
 * 
 * @author Ajit Reddy
 * @version 1.0.0
 * @since 2024
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  Package,
  BarChart3,
  Coffee,
  ArrowRight,
  CheckCircle,
  Users,
  TrendingUp,
  Shield,
  Clock,
  Star,
  Zap,
  Target,
  Award,
  Smartphone,
  Monitor,
  Wifi,
  Database,
  Globe,
  HeartHandshake,
  Sparkles
} from 'lucide-react';

const LandingPage = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    
    // Auto-cycle through features
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: ShoppingCart,
      title: "Advanced POS System",
      description: "Complete point-of-sale solution with intuitive interface, cart management, and multiple payment options.",
      color: "from-blue-500 to-purple-600"
    },
    {
      icon: Package,
      title: "Inventory Management",
      description: "Real-time stock tracking, automated alerts, and comprehensive inventory control across multiple locations.",
      color: "from-green-500 to-teal-600"
    },
    {
      icon: Coffee,
      title: "Table Management",
      description: "Restaurant-ready table management with real-time status updates and order tracking.",
      color: "from-orange-500 to-red-600"
    },
    {
      icon: BarChart3,
      title: "Analytics & Reports",
      description: "Detailed sales reports, profit analysis, and business insights to drive growth.",
      color: "from-indigo-500 to-blue-600"
    },
    {
      icon: ArrowRight,
      title: "Transfer Management",
      description: "Seamless stock transfers between locations with complete audit trail.",
      color: "from-purple-500 to-pink-600"
    },
    {
      icon: Shield,
      title: "Data Security",
      description: "Enterprise-grade security with automatic backups and data protection.",
      color: "from-gray-500 to-slate-600"
    }
  ];

  const stats = [
    { number: "99.9%", label: "Uptime", icon: TrendingUp },
    { number: "1000+", label: "Businesses", icon: Users },
    { number: "24/7", label: "Support", icon: Clock },
    { number: "5-Star", label: "Rating", icon: Star }
  ];

  const benefits = [
    "Streamline operations with automated processes",
    "Reduce errors with real-time inventory tracking",
    "Increase profits with detailed analytics",
    "Scale your business with multi-location support",
    "Enhance customer experience with fast checkout",
    "Secure your data with automatic backups"
  ];

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-background">
          <div className="floating-shapes">
            <div className="shape shape-1"></div>
            <div className="shape shape-2"></div>
            <div className="shape shape-3"></div>
            <div className="shape shape-4"></div>
          </div>
        </div>
        
        <div className="hero-content">
          <div className={`hero-text ${isVisible ? 'animate-in' : ''}`}>
            <div className="hero-badge">
              <Sparkles size={16} />
              <span>Revolutionary POS Solution</span>
            </div>
            
            <h1 className="hero-title">
              Transform Your Business with
              <span className="gradient-text"> Smart Inventory POS</span>
            </h1>
            
            <p className="hero-description">
              Experience the future of retail management with our comprehensive POS system. 
              Streamline operations, boost profits, and delight customers with cutting-edge technology.
            </p>
            
            <div className="hero-actions">
              <Link to="/pos" className="btn btn-primary btn-hero">
                <ShoppingCart size={20} />
                Start Selling Now
              </Link>
              <Link to="/dashboard" className="btn btn-secondary btn-hero">
                <BarChart3 size={20} />
                View Dashboard
              </Link>
            </div>
          </div>
          
          <div className={`hero-visual ${isVisible ? 'animate-in' : ''}`}>
            <div className="pos-mockup">
              <div className="screen">
                <div className="screen-header">
                  <div className="screen-dots">
                    <div className="dot red"></div>
                    <div className="dot yellow"></div>
                    <div className="dot green"></div>
                  </div>
                  <div className="screen-title">Inventory POS</div>
                </div>
                <div className="screen-content">
                  <div className="demo-card">
                    <div className="demo-header">
                      <ShoppingCart size={24} className="demo-icon" />
                      <span>Point of Sale</span>
                    </div>
                    <div className="demo-stats">
                      <div className="stat">
                        <div className="stat-number">₹45,230</div>
                        <div className="stat-label">Today's Sales</div>
                      </div>
                      <div className="stat">
                        <div className="stat-number">127</div>
                        <div className="stat-label">Transactions</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="stats-container">
          {stats.map((stat, index) => (
            <div key={index} className={`stat-card ${isVisible ? 'animate-in' : ''}`} style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="stat-icon">
                <stat.icon size={32} />
              </div>
              <div className="stat-content">
                <div className="stat-number">{stat.number}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="section-header">
          <h2 className="section-title">Powerful Features for Modern Businesses</h2>
          <p className="section-description">
            Everything you need to run a successful retail operation, all in one integrated platform
          </p>
        </div>
        
        <div className="features-grid">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className={`feature-card ${activeFeature === index ? 'active' : ''}`}
              onMouseEnter={() => setActiveFeature(index)}
            >
              <div className={`feature-icon bg-gradient-to-r ${feature.color}`}>
                <feature.icon size={32} />
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
              <div className="feature-link">
                <span>Learn More</span>
                <ArrowRight size={16} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="benefits-section">
        <div className="benefits-container">
          <div className="benefits-content">
            <div className="benefits-header">
              <h2 className="section-title">Why Choose Our POS System?</h2>
              <p className="section-description">
                Join thousands of businesses that have revolutionized their operations
              </p>
            </div>
            
            <div className="benefits-list">
              {benefits.map((benefit, index) => (
                <div key={index} className="benefit-item">
                  <CheckCircle size={20} className="benefit-icon" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
            
            <div className="benefits-actions">
              <Link to="/products" className="btn btn-primary">
                <Package size={20} />
                Explore Products
              </Link>
              <Link to="/inventory" className="btn btn-secondary">
                <Database size={20} />
                View Inventory
              </Link>
            </div>
          </div>
          
          <div className="benefits-visual">
            <div className="dashboard-preview">
              <div className="preview-header">
                <div className="preview-title">
                  <BarChart3 size={20} />
                  Business Dashboard
                </div>
              </div>
              <div className="preview-content">
                <div className="preview-metrics">
                  <div className="metric">
                    <div className="metric-label">Sales</div>
                    <div className="metric-value">₹2,45,680</div>
                    <div className="metric-change positive">+12.5%</div>
                  </div>
                  <div className="metric">
                    <div className="metric-label">Orders</div>
                    <div className="metric-value">1,247</div>
                    <div className="metric-change positive">+8.2%</div>
                  </div>
                  <div className="metric">
                    <div className="metric-label">Inventory</div>
                    <div className="metric-value">456</div>
                    <div className="metric-change negative">-2.1%</div>
                  </div>
                </div>
                <div className="preview-chart">
                  <div className="chart-bars">
                    <div className="bar" style={{ height: '40%' }}></div>
                    <div className="bar" style={{ height: '70%' }}></div>
                    <div className="bar" style={{ height: '50%' }}></div>
                    <div className="bar" style={{ height: '90%' }}></div>
                    <div className="bar" style={{ height: '60%' }}></div>
                    <div className="bar" style={{ height: '80%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="technology-section">
        <div className="tech-container">
          <div className="tech-header">
            <h2 className="section-title">Built with Modern Technology</h2>
            <p className="section-description">
              Cutting-edge technology stack for reliability, performance, and scalability
            </p>
          </div>
          
          <div className="tech-grid">
            <div className="tech-card">
              <Monitor size={48} />
              <h3>Cross-Platform</h3>
              <p>Works seamlessly on desktop, tablet, and mobile devices</p>
            </div>
            <div className="tech-card">
              <Wifi size={48} />
              <h3>Real-Time Sync</h3>
              <p>Instant data synchronization across all your devices</p>
            </div>
            <div className="tech-card">
              <Database size={48} />
              <h3>Secure Database</h3>
              <p>Enterprise-grade security with automatic backups</p>
            </div>
            <div className="tech-card">
              <Globe size={48} />
              <h3>Cloud Ready</h3>
              <p>Access your data from anywhere with cloud integration</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-container">
          <div className="cta-content">
            <h2 className="cta-title">Ready to Transform Your Business?</h2>
            <p className="cta-description">
              Join thousands of businesses already using our POS system to streamline operations and boost profits
            </p>
            <div className="cta-actions">
              <Link to="/dashboard" className="btn btn-primary btn-lg">
                <Zap size={24} />
                Get Started Now
              </Link>
              <Link to="/tables" className="btn btn-secondary btn-lg">
                <Coffee size={24} />
                Try Table Management
              </Link>
            </div>
          </div>
          <div className="cta-badges">
            <div className="badge">
              <Award size={24} />
              <span>Award Winning</span>
            </div>
            <div className="badge">
              <HeartHandshake size={24} />
              <span>Trusted by 1000+ Businesses</span>
            </div>
            <div className="badge">
              <Target size={24} />
              <span>99.9% Uptime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>Inventory POS</h3>
            <p>The complete solution for modern retail management</p>
          </div>
          <div className="footer-links">
            <div className="footer-section">
              <h4>Product</h4>
              <Link to="/pos">POS System</Link>
              <Link to="/inventory">Inventory</Link>
              <Link to="/reports">Reports</Link>
              <Link to="/settings">Settings</Link>
            </div>
            <div className="footer-section">
              <h4>Features</h4>
              <Link to="/tables">Table Management</Link>
              <Link to="/transfer">Stock Transfer</Link>
              <Link to="/spendings">Expense Tracking</Link>
              <Link to="/counter-balance">Counter Balance</Link>
            </div>
            <div className="footer-section">
              <h4>Support</h4>
              <a href="mailto:ajitreddy013@gmail.com">Contact Support</a>
              <a href="tel:+917517323121">Call: +91 7517323121</a>
              <span>24/7 Available</span>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2024 Inventory POS. Built with ❤️ by Ajit Reddy</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
