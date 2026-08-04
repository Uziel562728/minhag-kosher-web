import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

export default function AdminDashboard() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/admin/login', { replace: true });
    } catch (err) {
      console.error('Error closing session:', err);
    }
  };

  return (
    <div className="admin-dashboard-layout">
      {/* Mobile Top Header (only visible on mobile via CSS) */}
      <header className="admin-mobile-header">
        <div className="mobile-brand">
          <h3>Super Market Kosher</h3>
          <span>Admin</span>
        </div>
        <div className="mobile-header-actions">
          <button onClick={() => navigate('/')} className="mobile-header-btn btn-view-site-mobile" title="Ir al Sitio Público">
            🌐 Ir al Sitio
          </button>
          <button onClick={handleLogout} className="mobile-header-btn btn-logout-mobile" title="Cerrar Sesión">
            🚪
          </button>
        </div>
      </header>

      {/* Admin Sidebar Navigation (visible on desktop, hidden on mobile) */}
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <h3>Super Market Kosher</h3>
          <span>Administración</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink 
            to="/admin/orders" 
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            📋 Pedidos
          </NavLink>
          <NavLink 
            to="/admin/products" 
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            📦 Productos
          </NavLink>
          <NavLink 
            to="/admin/categories" 
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            🏷️ Categorías
          </NavLink>
          <NavLink 
            to="/admin/push-notifications" 
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            🔔 Notificaciones
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <button onClick={() => navigate('/')} className="sidebar-btn btn-view-site">
            🌐 Ir al Sitio Público
          </button>
          <button onClick={handleLogout} className="sidebar-btn btn-logout">
            🚪 Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Admin Content Container */}
      <main className="admin-content-area">
        <header className="admin-content-header">
          <h2>Panel de Administración</h2>
          <div className="admin-badge">🔐 Privado</div>
        </header>
        <div className="admin-page-content">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar (only visible on mobile via CSS) */}
      <nav className="admin-mobile-bottom-nav">
        <NavLink 
          to="/admin/orders" 
          className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
        >
          <span className="mobile-nav-icon">📋</span>
          <span className="mobile-nav-label">Pedidos</span>
        </NavLink>
        <NavLink 
          to="/admin/products" 
          className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
        >
          <span className="mobile-nav-icon">📦</span>
          <span className="mobile-nav-label">Productos</span>
        </NavLink>
        <NavLink 
          to="/admin/categories" 
          className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
        >
          <span className="mobile-nav-icon">🏷️</span>
          <span className="mobile-nav-label">Categorías</span>
        </NavLink>
        <NavLink 
          to="/admin/push-notifications" 
          className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
        >
          <span className="mobile-nav-icon">🔔</span>
          <span className="mobile-nav-label">Notif.</span>
        </NavLink>
      </nav>
    </div>
  );
}
