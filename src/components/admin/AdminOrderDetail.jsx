import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

export default function AdminOrderDetail() {
  const { orderId } = useParams();
  console.log("AdminOrderDetail orderId:", orderId);
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchOrderDetail = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Fetch order details
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;
      if (!orderData) {
        setOrder(null);
        setLoading(false);
        return;
      }

      setOrder(orderData);

      // 2. Fetch order items
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;
      setItems(itemsData || []);
    } catch (err) {
      console.error("Error fetching order details:", err);
      setErrorMsg("No se pudieron cargar los detalles del pedido de la base de datos.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrderDetail();
  }, [fetchOrderDetail]);

  const handleStatusChange = async (newStatus) => {
    if (!order) return;
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', order.id);

      if (error) throw error;
      setOrder(prev => ({ ...prev, status: newStatus }));
    } catch (err) {
      console.error("Error updating order status:", err);
      alert("Error al actualizar el estado del pedido.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-loading-spinner-container">
        <div className="admin-spinner"></div>
        <p>Cargando detalles del pedido...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="admin-detail-error-container">
        <div className="checkout-error-message">{errorMsg}</div>
        <button onClick={() => navigate('/admin/orders')} className="btn btn-secondary">
          ⬅ Volver a Pedidos
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="admin-detail-error-container">
        <div className="checkout-error-message">El pedido especificado no existe o fue eliminado.</div>
        <button onClick={() => navigate('/admin/orders')} className="btn btn-secondary">
          ⬅ Volver a Pedidos
        </button>
      </div>
    );
  }

  const formattedDate = new Date(order.created_at).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="admin-order-detail-wrapper">
      <div className="detail-header">
        <button onClick={() => navigate('/admin/orders')} className="btn-back-link">
          📋 Volver a la Lista
        </button>
        <h2>Pedido #{order.order_number}</h2>
        <span className={`badge-status badge-status-${order.status}`}>
          {order.status.toUpperCase()}
        </span>
      </div>

      <div className="detail-grid">
        {/* Info Column */}
        <div className="detail-info-column">
          <div className="detail-section-card">
            <h4>Datos del Cliente</h4>
            <p><strong>Nombre:</strong> {order.customer_name}</p>
            <p><strong>Teléfono:</strong> <a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a></p>
            <p><strong>Fecha/Hora:</strong> {formattedDate}</p>
          </div>

          <div className="detail-section-card">
            <h4>Método de Entrega</h4>
            <p><strong>Modalidad:</strong> {order.shipping_method === 'envio' ? '🚚 Envío a Domicilio' : '🏪 Retiro en Sucursal'}</p>
            {order.shipping_method === 'envio' && (
              <div className="shipping-address-box">
                <p><strong>Calle:</strong> {order.street}</p>
                {(order.floor || order.department) && (
                  <p><strong>Piso / Depto:</strong> {order.floor || '-'} / {order.department || '-'}</p>
                )}
              </div>
            )}
            {order.customer_notes && (
              <div className="notes-box">
                <strong>Notas / Aclaraciones:</strong>
                <p className="notes-text">{order.customer_notes}</p>
              </div>
            )}
          </div>

          <div className="detail-section-card status-manager-card">
            <h4>Acciones del Pedido</h4>
            <label htmlFor="status-select">Cambiar Estado:</label>
            <select
              id="status-select"
              value={order.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={updatingStatus}
              className={`select-status-changer ${order.status}`}
            >
              <option value="pending">Pendiente (Revisión)</option>
              <option value="confirmed">Confirmado (Aceptado)</option>
              <option value="preparing">En Preparación</option>
              <option value="ready">Listo para Entregar</option>
              <option value="delivered">Entregado (Finalizado)</option>
              <option value="cancelled">Cancelado / Rechazado</option>
            </select>
            {updatingStatus && <span className="status-updating-label">Actualizando...</span>}
          </div>
        </div>

        {/* Items Column */}
        <div className="detail-items-column">
          <div className="detail-section-card">
            <h4>Detalle de Productos ({items.length})</h4>
            <div className="details-products-box-no-padding">
              <table className="details-products-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="text-center">Cant.</th>
                    <th className="text-right">Precio Unit.</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="product-name-txt">{item.product_name}</span>
                        {item.product_brand && (
                          <span className="product-brand-tag" style={{ marginLeft: '8px' }}>
                            {item.product_brand}
                          </span>
                        )}
                      </td>
                      <td className="text-center">{item.quantity}</td>
                      <td className="text-right">${Number(item.unit_price).toLocaleString('es-AR')}</td>
                      <td className="text-right">${Number(item.subtotal).toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                  <tr className="row-summary-prices">
                    <td colSpan="3" className="text-right">Subtotal:</td>
                    <td className="text-right">${Number(order.subtotal).toLocaleString('es-AR')}</td>
                  </tr>
                  <tr className="row-summary-prices total-row">
                    <td colSpan="3" className="text-right"><strong>Total:</strong></td>
                    <td className="text-right"><strong>${Number(order.total).toLocaleString('es-AR')}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
