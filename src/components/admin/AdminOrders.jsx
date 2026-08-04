import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

export default function AdminOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [orderItems, setOrderItems] = useState({}); // { [orderId]: [...] }
  const [loadingItems, setLoadingItems] = useState({}); // { [orderId]: boolean }
  const [updatingStatus, setUpdatingStatus] = useState({}); // { [orderId]: boolean }
  
  // Realtime tracking for newly inserted orders during current session
  const [realtimeNewOrders, setRealtimeNewOrders] = useState({}); // { [orderId]: boolean }

  // Tab State
  const [activeTab, setActiveTab] = useState('pending');

  // Filter States
  const [filterOrderNumber, setFilterOrderNumber] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterShippingMethod, setFilterShippingMethod] = useState('all');

  // Web Audio Synth Notification Beep
  const playBeepNotification = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.35); // 350ms duration
    } catch (err) {
      console.warn("Failed to play web audio synth notification beep:", err);
    }
  };

  // Load orders on mount
  useEffect(() => {
    fetchOrders();

    // Subscribe to realtime updates for orders
    const channel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          // Play synthesized order alert sound
          playBeepNotification();

          // Add to orders list avoiding duplicates
          setOrders((prev) => {
            if (prev.some((o) => o.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });

          // Mark as a new realtime order to highlight in the interface
          setRealtimeNewOrders((prev) => ({ ...prev, [payload.new.id]: true }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          setOrders((prev) =>
            prev.map((o) => (o.id === payload.new.id ? payload.new : o))
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'orders' },
        (payload) => {
          setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*');

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setErrorMsg('No se pudieron cargar los pedidos de la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderItems = async (orderId) => {
    if (orderItems[orderId]) return;

    setLoadingItems((prev) => ({ ...prev, [orderId]: true }));
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (error) throw error;
      setOrderItems((prev) => ({ ...prev, [orderId]: data || [] }));
    } catch (err) {
      console.error('Error fetching order items:', err);
      alert('Error al cargar el detalle de los productos del pedido.');
    } finally {
      setLoadingItems((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const toggleExpand = async (orderId) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
    } else {
      setExpandedOrderId(orderId);
      await fetchOrderItems(orderId);
      // Remove realtime highlight tag once clicked/expanded
      if (realtimeNewOrders[orderId]) {
        setRealtimeNewOrders((prev) => {
          const updated = { ...prev };
          delete updated[orderId];
          return updated;
        });
      }
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingStatus((prev) => ({ ...prev, [orderId]: true }));
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;
      
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('No se pudo actualizar el estado del pedido.');
    } finally {
      setUpdatingStatus((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const handleAcceptOrder = (orderId) => {
    handleStatusChange(orderId, 'confirmed');
  };

  const handleRejectOrder = (orderId) => {
    const confirmReject = window.confirm("¿Estás seguro de que deseas rechazar y cancelar este pedido?");
    if (confirmReject) {
      handleStatusChange(orderId, 'cancelled');
    }
  };

  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    };
    return new Date(dateString).toLocaleDateString('es-AR', options);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending': return 'badge-status-pending';
      case 'confirmed': return 'badge-status-confirmed';
      case 'preparing': return 'badge-status-preparing';
      case 'ready': return 'badge-status-ready';
      case 'delivered': return 'badge-status-delivered';
      case 'cancelled': return 'badge-status-cancelled';
      default: return 'badge-status-default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'confirmed': return 'Confirmado';
      case 'preparing': return 'Preparando';
      case 'ready': return 'Listo';
      case 'delivered': return 'Entregado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  // Group and sort orders based on business requirements
  const pendingOrders = orders.filter(o => o.status === 'pending');
  // Sort oldest first for pending
  pendingOrders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const processOrders = orders.filter(o => ['confirmed', 'preparing', 'ready'].includes(o.status));
  // Sort: confirmed first, preparing second, ready third. Within status, oldest first
  processOrders.sort((a, b) => {
    const statusWeight = { confirmed: 1, preparing: 2, ready: 3 };
    const weightA = statusWeight[a.status] || 99;
    const weightB = statusWeight[b.status] || 99;
    if (weightA !== weightB) {
      return weightA - weightB;
    }
    return new Date(a.created_at) - new Date(b.created_at);
  });

  const completedOrders = orders.filter(o => o.status === 'delivered');
  // Sort newest first
  completedOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const cancelledOrders = orders.filter(o => o.status === 'cancelled');
  // Sort newest first
  cancelledOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Determine active tab list
  let activeTabOrders = [];
  if (activeTab === 'pending') activeTabOrders = pendingOrders;
  else if (activeTab === 'process') activeTabOrders = processOrders;
  else if (activeTab === 'completed') activeTabOrders = completedOrders;
  else if (activeTab === 'cancelled') activeTabOrders = cancelledOrders;

  // Apply filters to active list
  const filteredOrders = activeTabOrders.filter((o) => {
    if (filterOrderNumber && !String(o.order_number).includes(filterOrderNumber)) return false;
    if (filterName && !o.customer_name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterPhone && !o.customer_phone.includes(filterPhone)) return false;
    if (filterShippingMethod !== 'all' && o.shipping_method !== filterShippingMethod) return false;
    return true;
  });

  return (
    <div className="admin-orders-container">
      {/* Top dashboard summary cards */}
      <div className="admin-orders-stats">
        <div className="stat-card" onClick={() => setActiveTab('pending')} style={{ cursor: 'pointer' }}>
          <span className="stat-icon">📥</span>
          <div className="stat-info">
            <h4>Pendientes</h4>
            <p className="stat-val text-warning">{pendingOrders.length}</p>
          </div>
        </div>
        <div className="stat-card" onClick={() => setActiveTab('process')} style={{ cursor: 'pointer' }}>
          <span className="stat-icon">⏳</span>
          <div className="stat-info">
            <h4>En Proceso</h4>
            <p className="stat-val text-info">{processOrders.length}</p>
          </div>
        </div>
        <div className="stat-card" onClick={() => setActiveTab('completed')} style={{ cursor: 'pointer' }}>
          <span className="stat-icon">✅</span>
          <div className="stat-info">
            <h4>Completados</h4>
            <p className="stat-val text-success">{completedOrders.length}</p>
          </div>
        </div>
        <div className="stat-card" onClick={() => setActiveTab('cancelled')} style={{ cursor: 'pointer' }}>
          <span className="stat-icon">❌</span>
          <div className="stat-info">
            <h4>Cancelados</h4>
            <p className="stat-val text-danger">{cancelledOrders.length}</p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="admin-error-box">
          <p>{errorMsg}</p>
          <button onClick={fetchOrders} className="btn-retry">Reintentar</button>
        </div>
      )}

      {/* Tabs Menu Navigation */}
      <div className="admin-orders-tabs-wrapper">
        <button 
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          📥 Pendientes ({pendingOrders.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'process' ? 'active' : ''}`}
          onClick={() => setActiveTab('process')}
        >
          ⏳ En Proceso ({processOrders.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          ✅ Completados ({completedOrders.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'cancelled' ? 'active' : ''}`}
          onClick={() => setActiveTab('cancelled')}
        >
          ❌ Cancelados ({cancelledOrders.length})
        </button>
      </div>

      {/* Search & Filters Panel */}
      <div className="admin-orders-filters-bar">
        <div className="filter-group">
          <label htmlFor="filter-number">Número:</label>
          <input 
            type="text" 
            id="filter-number"
            value={filterOrderNumber}
            onChange={(e) => setFilterOrderNumber(e.target.value)}
            placeholder="Ej. 12"
          />
        </div>
        <div className="filter-group">
          <label htmlFor="filter-name">Cliente:</label>
          <input 
            type="text" 
            id="filter-name"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder="Nombre..."
          />
        </div>
        <div className="filter-group">
          <label htmlFor="filter-phone">Teléfono:</label>
          <input 
            type="text" 
            id="filter-phone"
            value={filterPhone}
            onChange={(e) => setFilterPhone(e.target.value)}
            placeholder="Teléfono..."
          />
        </div>
        <div className="filter-group">
          <label htmlFor="filter-shipping">Entrega:</label>
          <select 
            id="filter-shipping"
            value={filterShippingMethod}
            onChange={(e) => setFilterShippingMethod(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="envio">Envío a domicilio</option>
            <option value="retiro">Retiro en local</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="admin-loading-spinner-container">
          <div className="admin-spinner"></div>
          <p>Cargando lista de pedidos...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="admin-empty-state">
          <span className="empty-icon">📦</span>
          <h3>No hay pedidos en este listado</h3>
          <p>Los pedidos que coincidan con los filtros y la pestaña activa aparecerán aquí.</p>
        </div>
      ) : (
        <div className="orders-table-wrapper">
          <table className="admin-orders-table">
            <thead>
              <tr>
                <th>Nro. Pedido</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Entrega</th>
                <th>Total</th>
                <th>Estado</th>
                <th className="actions-header">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const items = orderItems[order.id] || [];
                const itemsLoading = loadingItems[order.id];
                const statusUpdating = updatingStatus[order.id];
                const isNew = realtimeNewOrders[order.id] || order.status === 'pending';

                return (
                  <React.Fragment key={order.id}>
                    {/* Primary Row */}
                    <tr 
                      className={`order-row ${isExpanded ? 'row-expanded' : ''} ${isNew ? 'row-new-highlight' : ''}`}
                      onClick={() => toggleExpand(order.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td data-label="Nro. Pedido" className="col-order-number">
                        <div className="order-number-badge-wrapper">
                          <strong>#{order.order_number}</strong>
                          {isNew && <span className="pulsing-new-badge">NUEVO</span>}
                        </div>
                      </td>
                      <td data-label="Cliente" className="col-customer">
                        <div className="customer-info-cell">
                          <span className="customer-name">{order.customer_name}</span>
                          <span className="customer-phone">{order.customer_phone}</span>
                        </div>
                      </td>
                      <td data-label="Fecha">{formatDate(order.created_at)}</td>
                      <td data-label="Entrega" className="col-shipping">
                        <span className={`shipping-type-tag ${order.shipping_method}`}>
                          {order.shipping_method === 'envio' ? '🚀 Envío' : '🏪 Retiro'}
                        </span>
                      </td>
                      <td data-label="Total" className="col-total">
                        <strong>${Number(order.total).toLocaleString('es-AR')}</strong>
                      </td>
                      <td data-label="Estado">
                        <span className={`badge-status ${getStatusBadgeClass(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td data-label="Acciones" className="col-actions" onClick={(e) => e.stopPropagation()}>
                        <div className="action-buttons-group">
                          {order.status === 'pending' ? (
                            <div className="quick-action-btns">
                              <button 
                                className="btn-quick-accept"
                                onClick={() => handleAcceptOrder(order.id)}
                                disabled={statusUpdating}
                              >
                                Aceptar
                              </button>
                              <button 
                                className="btn-quick-reject"
                                onClick={() => handleRejectOrder(order.id)}
                                disabled={statusUpdating}
                              >
                                Rechazar
                              </button>
                              <button 
                                className="btn-quick-view"
                                onClick={() => navigate(`/admin/orders/${order.id}`)}
                              >
                                Ver
                              </button>
                            </div>
                          ) : (
                            <>
                              <select 
                                className={`select-status-changer ${order.status}`}
                                value={order.status}
                                onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                disabled={statusUpdating}
                              >
                                <option value="pending">Pendiente</option>
                                <option value="confirmed">Confirmado</option>
                                <option value="preparing">Preparando</option>
                                <option value="ready">Listo</option>
                                <option value="delivered">Entregado</option>
                                <option value="cancelled">Cancelado</option>
                              </select>
                              <button 
                                className="btn-quick-view"
                                onClick={() => navigate(`/admin/orders/${order.id}`)}
                                style={{ marginLeft: '6px' }}
                              >
                                Ver
                              </button>
                            </>
                          )}
                          <button 
                            className="btn-details-toggle" 
                            onClick={() => toggleExpand(order.id)}
                            aria-label="Ver detalles"
                          >
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Detail Area */}
                    {isExpanded && (
                      <tr className="order-detail-row">
                        <td colSpan="7">
                          <div className="order-details-expanded-container">
                            <div className="details-grid">
                              {/* Shipping address & Info */}
                              <div className="details-info-box">
                                <h4>Detalles de Entrega</h4>
                                <p><strong>Nombre:</strong> {order.customer_name}</p>
                                <p><strong>Teléfono:</strong> {order.customer_phone}</p>
                                <p>
                                  <strong>Método:</strong>{' '}
                                  {order.shipping_method === 'envio' 
                                    ? 'Envío a domicilio' 
                                    : 'Retiro en sucursal'}
                                </p>
                                {order.shipping_method === 'envio' && (
                                  <p>
                                    <strong>Dirección:</strong>{' '}
                                    {order.street}
                                    {order.floor ? `, Piso ${order.floor}` : ''}
                                    {order.department ? `, Depto ${order.department}` : ''}
                                  </p>
                                )}
                                {order.customer_notes && (
                                  <div className="notes-box">
                                    <strong>Notas del cliente:</strong>
                                    <p className="notes-text">"{order.customer_notes}"</p>
                                  </div>
                                )}
                              </div>

                              {/* Order items table */}
                              <div className="details-products-box">
                                <h4>Productos del Pedido</h4>
                                {itemsLoading ? (
                                  <div className="details-items-loading">
                                    <div className="admin-spinner small"></div>
                                    <span>Cargando productos...</span>
                                  </div>
                                ) : items.length === 0 ? (
                                  <p className="text-muted">No hay productos registrados en este pedido.</p>
                                ) : (
                                  <table className="details-products-table">
                                    <thead>
                                      <tr>
                                        <th>Producto</th>
                                        <th>Marca</th>
                                        <th className="text-center">Cant.</th>
                                        <th className="text-right">Precio unit.</th>
                                        <th className="text-right">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {items.map((item) => (
                                        <tr key={item.id}>
                                          <td>{item.product_name}</td>
                                          <td><span className="product-brand-tag">{item.product_brand || 'Genérico'}</span></td>
                                          <td className="text-center">{item.quantity}</td>
                                          <td className="text-right">${Number(item.unit_price).toLocaleString('es-AR')}</td>
                                          <td className="text-right"><strong>${Number(item.subtotal).toLocaleString('es-AR')}</strong></td>
                                        </tr>
                                      ))}
                                      <tr className="row-summary-prices">
                                        <td colSpan="3"></td>
                                        <td className="text-right">Subtotal:</td>
                                        <td className="text-right">${Number(order.subtotal).toLocaleString('es-AR')}</td>
                                      </tr>
                                      <tr className="row-summary-prices total-row">
                                        <td colSpan="3"></td>
                                        <td className="text-right"><strong>Total:</strong></td>
                                        <td className="text-right"><strong>${Number(order.total).toLocaleString('es-AR')}</strong></td>
                                      </tr>
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
