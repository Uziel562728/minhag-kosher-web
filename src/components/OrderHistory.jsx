import React, { useEffect, useState } from 'react';
import { clearOrderHistory, deleteOrderFromHistory, getOrderHistory } from '../utils/orderHistory';
import { getCachedProduct } from '../lib/productCache';
import { allowsFreeQuantity, buildCartLineKey, calculateClosedPacks, calculateUnitAndPack, getReadableBreakdown, getValidPresentations, hasValidPresentations, resolveProductSlug } from '../utils/productPresentations';

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' });
const shortId = (id = '') => id.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();
const slugFromName = (name = '') => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function OrderHistory({ cartHasItems, onBack, onRepeat }) {
  const [orders, setOrders] = useState(getOrderHistory);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [repeatOrder, setRepeatOrder] = useState(null);

  useEffect(() => {
    if (!selectedOrder && !repeatOrder) return undefined;
    const close = (event) => {
      if (event.key === 'Escape') {
        setSelectedOrder(null);
        setRepeatOrder(null);
      }
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [selectedOrder, repeatOrder]);

  const removeOrder = (id) => setOrders(deleteOrderFromHistory(id));
  const removeAll = () => {
    if (!window.confirm('¿Seguro que querés borrar todo tu historial de pedidos? Esta acción no se puede deshacer.')) return;
    clearOrderHistory();
    setOrders([]);
  };

  const prepareRepeat = (order) => {
    if (cartHasItems) setRepeatOrder(order);
    else repeat(order, 'replace');
  };

  const repeat = (order, mode) => {
    const available = [];
    let unavailableCount = 0;
    order.products.forEach((item) => {
      const historicalSlug = item.productSlug || slugFromName(item.name);
      const current = getCachedProduct(item.productId) || getCachedProduct(historicalSlug) || getCachedProduct(resolveProductSlug(historicalSlug));
      if (!current || current.disponible === false) {
        unavailableCount += 1;
        return;
      }
      if (!hasValidPresentations(current)) {
        available.push({ product: current, quantity: item.quantity });
        return;
      }
      if (allowsFreeQuantity(current)) {
        const legacyPackSize = /-x12$/.test(historicalSlug) ? 12 : 1;
        const requestedUnits = item.cantidadUnidadesTotales || item.totalUnits || item.quantity * legacyPackSize;
        const calculation = calculateUnitAndPack(current, requestedUnits);
        available.push({ product: current, quantity: requestedUnits, cartLine: {
          lineKey: buildCartLineKey(current.id, 'free'), productId: current.id, nombre: current.nombre, product: current, mode: 'free', presentationId: 'free', presentationLabel: 'Cantidad libre', quantity: calculation.totalUnits,
          cantidadPacks: calculation.completePacks, cantidadUnidadesSueltas: calculation.looseUnits, cantidadUnidadesTotales: calculation.totalUnits, precioUnitario: calculation.unit.precio,
          precioPresentacion: calculation.pack?.precio || null, packSize: calculation.pack?.cantidad_unidades || null, subtotal: calculation.total, breakdown: getReadableBreakdown(calculation),
        } });
        return;
      }
      const legacyPresentationId = item.presentationId || (historicalSlug.match(/-x(\d+)$/) ? `pack-${historicalSlug.match(/-x(\d+)$/)[1]}` : null);
      const presentation = getValidPresentations(current).find((candidate) => candidate.id === legacyPresentationId);
      const calculation = calculateClosedPacks(presentation, item.cantidadPacks || item.packCount || item.quantity);
      if (!calculation) {
        unavailableCount += 1;
        return;
      }
      available.push({ product: current, quantity: calculation.packCount, cartLine: {
        lineKey: buildCartLineKey(current.id, presentation.id), productId: current.id, nombre: current.nombre, product: current, mode: 'packs', presentationId: presentation.id, presentationLabel: presentation.label,
        quantity: calculation.packCount, cantidadPacks: calculation.packCount, cantidadUnidadesSueltas: 0, cantidadUnidadesTotales: calculation.totalUnits, precioPresentacion: presentation.precio,
        subtotal: calculation.total, breakdown: getReadableBreakdown(calculation),
      } });
    });
    setRepeatOrder(null);
    onRepeat(available, mode, unavailableCount);
  };

  return (
    <section className="order-history" aria-labelledby="order-history-title">
      <div className="order-history-heading">
        <div><h3 id="order-history-title">Mis pedidos</h3><p>Tus pedidos se guardan únicamente en este dispositivo.</p></div>
        <div className="order-history-heading-actions">
          {orders.length > 0 && <button type="button" className="history-danger-link" onClick={removeAll}>Borrar historial</button>}
          <button type="button" className="btn btn-secondary" onClick={onBack}>Volver al carrito</button>
        </div>
      </div>

      {orders.length === 0 ? <div className="history-empty"><h4>Todavía no hay pedidos guardados</h4><p>Los pedidos enviados por WhatsApp aparecerán acá.</p></div> : (
        <>
          <div className="history-table-wrap">
            <table className="history-table"><thead><tr><th>Fecha</th><th>Pedido</th><th>Productos</th><th>Entrega</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>{orders.map((order) => <tr key={order.id}>
                <td>{date.format(new Date(order.createdAt))}</td><td>#{shortId(order.id)}</td><td>{order.products.length} productos</td>
                <td>{order.deliveryType === 'envio' ? 'Envío' : 'Retiro'}</td><td>{money.format(order.total)}</td><td><span className="history-status">Enviado por WhatsApp</span></td>
                <td><div className="history-actions"><button type="button" onClick={() => setSelectedOrder(order)}>Ver</button><button type="button" onClick={() => prepareRepeat(order)}>Repetir</button><button type="button" onClick={() => removeOrder(order.id)}>Eliminar</button></div></td>
              </tr>)}</tbody></table>
          </div>
          <div className="history-mobile-list">{orders.map((order) => <article className="history-card" key={order.id}>
            <strong>Pedido #{shortId(order.id)}</strong><time>{date.format(new Date(order.createdAt))}</time><p>{order.products.length} productos<br />{order.deliveryType === 'envio' ? 'Envío a domicilio' : 'Retiro por el local'}<br /><b>Total: {money.format(order.total)}</b></p>
            <span className="history-status">Enviado por WhatsApp</span><div className="history-actions"><button type="button" onClick={() => setSelectedOrder(order)}>Ver detalle</button><button type="button" onClick={() => prepareRepeat(order)}>Repetir pedido</button><button type="button" onClick={() => removeOrder(order.id)}>Eliminar</button></div>
          </article>)}</div>
        </>
      )}

      {selectedOrder && <div className="history-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setSelectedOrder(null)}><div className="history-modal" role="dialog" aria-modal="true" aria-labelledby="history-detail-title">
        <button type="button" className="history-modal-close" onClick={() => setSelectedOrder(null)} aria-label="Cerrar">×</button>
        <h3 id="history-detail-title">Pedido #{shortId(selectedOrder.id)}</h3><p>{date.format(new Date(selectedOrder.createdAt))} · <span className="history-status">Enviado por WhatsApp</span></p>
        <div className="history-detail-grid"><div><b>Cliente</b><p>{selectedOrder.customerName}<br />{selectedOrder.phone}</p></div><div><b>Entrega</b><p>{selectedOrder.deliveryType === 'envio' ? 'Envío a domicilio' : 'Retiro por el local'}{selectedOrder.address ? <><br />{selectedOrder.address}{selectedOrder.floor ? `, piso ${selectedOrder.floor}` : ''}{selectedOrder.department ? `, depto. ${selectedOrder.department}` : ''}<br />{selectedOrder.neighborhood}{selectedOrder.notes ? <><br />{selectedOrder.notes}</> : null}</> : null}</p></div></div>
        <div className="history-detail-items">{selectedOrder.products.map((item) => <div key={`${item.productId}-${item.presentationId || 'traditional'}`}><span>{item.name}{item.mode === 'free' ? ` — ${item.breakdown}, ${item.cantidadUnidadesTotales || item.totalUnits} unidades` : item.mode === 'packs' ? ` — ${item.presentationLabel}, ${item.cantidadPacks || item.packCount} packs, ${item.cantidadUnidadesTotales || item.totalUnits} unidades` : ` — ${item.quantity} unidades`}</span><b>{money.format(item.subtotal)}</b></div>)}</div>
        <div className="history-detail-totals"><span>Subtotal <b>{money.format(selectedOrder.subtotal)}</b></span><span>Envío <b>{selectedOrder.shippingCost === null ? 'A coordinar' : money.format(selectedOrder.shippingCost)}</b></span><span>Total <b>{money.format(selectedOrder.total)}</b></span></div>
      </div></div>}

      {repeatOrder && <div className="history-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setRepeatOrder(null)}><div className="history-modal history-choice" role="dialog" aria-modal="true" aria-labelledby="repeat-title"><h3 id="repeat-title">Tu carrito ya tiene productos</h3><p>¿Querés agregar este pedido al carrito actual o reemplazarlo?</p><div className="history-choice-actions"><button className="btn btn-primary" type="button" onClick={() => repeat(repeatOrder, 'add')}>Agregar</button><button className="btn btn-secondary" type="button" onClick={() => repeat(repeatOrder, 'replace')}>Reemplazar</button><button className="btn btn-secondary" type="button" onClick={() => setRepeatOrder(null)}>Cancelar</button></div></div></div>}
    </section>
  );
}
