import React, { useEffect, useLayoutEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import ProductGrid from './components/ProductGrid';
import Contact from './components/Contact';
import WhatsAppButton from './components/WhatsAppButton';
import Footer from './components/Footer';
import ProductDetail from './components/ProductDetail';
import logoImg from './images/logo supermarket.webp';
import './App.css';

// Admin imports
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminProducts from './components/admin/AdminProducts';
import AdminProductForm from './components/admin/AdminProductForm';
import AdminCategories from './components/admin/AdminCategories';
import AdminCategoryForm from './components/admin/AdminCategoryForm';
import AdminOrders from './components/admin/AdminOrders';
import AdminOrderDetail from './components/admin/AdminOrderDetail';
import AdminNotificationSettings from './components/admin/AdminNotificationSettings';
import ProtectedRoute from './components/admin/ProtectedRoute';
import { CartProvider } from './context/CartContext';
import CartDrawer from './components/CartDrawer';
import FloatingCartButton from './components/FloatingCartButton';

function ScrollManager() {
  const location = useLocation();

  useLayoutEffect(() => {
    const sectionId = new URLSearchParams(location.search).get('section');
    if (!sectionId) {
      const docEl = document.documentElement;
      const prevBehavior = docEl.style.scrollBehavior;
      docEl.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      docEl.scrollTop = 0;
      const raf = requestAnimationFrame(() => {
        docEl.style.scrollBehavior = prevBehavior || '';
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [location.pathname, location.search]);

  return null;
}

function PublicLayout() {
  const location = useLocation();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectCategory = (category) => {
    setSelectedCategory(category);
  };

  const handleSearchChange = (query) => {
    setSearchQuery(query);
  };

  useEffect(() => {
    const sectionId = new URLSearchParams(location.search).get('section');
    if (!sectionId) return;

    const timer = window.setTimeout(() => {
      const element = document.getElementById(sectionId);
      if (!element) return;

      const headerOffset = 80;
      const offsetPosition = element.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [location.search]);

  return (
    <div className="app-container">
      {/* Background Watermark Logo */}
      <div className="bg-watermark">
        <img src={logoImg} alt="Super Market Kosher Watermark" />
      </div>

      {/* Global background diagonal animated lines */}
      <div className="global-bg-lines">
        <div className="diagonal-line line-g1"></div>
        <div className="diagonal-line line-g2"></div>
        <div className="diagonal-line line-g3"></div>
        <div className="diagonal-line line-g4"></div>
        <div className="diagonal-line line-g5"></div>
        <div className="diagonal-line line-g6"></div>
        <div className="diagonal-line line-g7"></div>
        <div className="diagonal-line line-g8"></div>
      </div>

      {/* Navigation Header */}
      <Header />

      {/* Main Sections */}
      <main>
        {/* Welcome / Brand Hero Banner */}
        <Hero />

        {/* Scrollable Main Content overlaying the fixed Hero */}
        <div className="main-content-scroll">
          {/* Catalog: Product Search, Filters and Cards Grid */}
          <ProductGrid 
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
          />

          {/* Contact Info, Map, Hours & direct WhatsApp triggers */}
          <Contact />
        </div>
      </main>

      {/* Floating WhatsApp Action Button */}
      <WhatsAppButton />

      {/* Footer Navigation & Copyright */}
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <ScrollManager />
      <CartProvider>
        <Routes>
          {/* Public Website */}
          <Route path="/" element={<PublicLayout />} />
          <Route path="/:slug" element={<ProductDetail />} />

          {/* Admin Login Route */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Protected Dashboard Routes */}
          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>}>
            <Route index element={<Navigate to="/admin/orders" replace />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:orderId" element={<AdminOrderDetail />} />
            <Route path="push-notifications" element={<AdminNotificationSettings />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/new" element={<AdminProductForm />} />
            <Route path="products/edit/:id" element={<AdminProductForm />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="categories/new" element={<AdminCategoryForm />} />
            <Route path="categories/edit/:id" element={<AdminCategoryForm />} />
          </Route>

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <CartDrawer />
        <FloatingCartButton />
      </CartProvider>
    </Router>
  );
}
