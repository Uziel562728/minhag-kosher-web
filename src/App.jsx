import React, { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import ProductGrid from './components/ProductGrid';
import WhatsAppButton from './components/WhatsAppButton';
import Footer from './components/Footer';
import './App.css';

// Admin imports
import ProtectedRoute from './components/admin/ProtectedRoute';
import { CartProvider } from './context/CartContext';
import CartDrawer from './components/CartDrawer';
import FloatingCartButton from './components/FloatingCartButton';

const Contact = lazy(() => import('./components/Contact'));
const ProductDetail = lazy(() => import('./components/ProductDetail'));
const AdminLogin = lazy(() => import('./components/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const AdminProducts = lazy(() => import('./components/admin/AdminProducts'));
const AdminProductForm = lazy(() => import('./components/admin/AdminProductForm'));
const AdminCategories = lazy(() => import('./components/admin/AdminCategories'));
const AdminCategoryForm = lazy(() => import('./components/admin/AdminCategoryForm'));

const RouteFallback = () => <div className="catalog-loading-inner"><div className="admin-spinner" /><p>Cargando...</p></div>;
const routerBase = import.meta.env.BASE_URL.replace(/\/$/, '');

function ScrollManager() {
  const location = useLocation();

  useLayoutEffect(() => {
    const sectionId = new URLSearchParams(location.search).get('section');
    const hasCatalogRestore = location.pathname === '/' && Boolean(sessionStorage.getItem('minhag_catalog_state_v1'));
    if (!sectionId && !hasCatalogRestore) {
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

  const handleSelectCategory = useCallback((category) => {
    setSelectedCategory(category);
  }, []);

  const handleSearchChange = useCallback((query) => {
    setSearchQuery(query);
  }, []);

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
            navigationState={location.state}
          />

          {/* Contact Info, Map, Hours & direct WhatsApp triggers */}
          <Suspense fallback={<RouteFallback />}><Contact /></Suspense>
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
    <Router basename={routerBase || '/'}>
      <ScrollManager />
      <CartProvider>
        <Suspense fallback={<RouteFallback />}><Routes>
          {/* Public Website */}
          <Route path="/" element={<PublicLayout />} />
          <Route path="/:slug" element={<ProductDetail />} />

          {/* Admin Login Route */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Protected Dashboard Routes */}
          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>}>
            <Route index element={<Navigate to="/admin/products" replace />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/new" element={<AdminProductForm />} />
            <Route path="products/edit/:id" element={<AdminProductForm />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="categories/new" element={<AdminCategoryForm />} />
            <Route path="categories/edit/:id" element={<AdminCategoryForm />} />
            <Route path="*" element={<Navigate to="/admin/products" replace />} />
          </Route>

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes></Suspense>
        <CartDrawer />
        <FloatingCartButton />
      </CartProvider>
    </Router>
  );
}
