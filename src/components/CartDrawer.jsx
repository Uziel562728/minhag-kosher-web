import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2 } from 'lucide-react';
import { business } from '../config/business';
import { getProductImage } from '../utils/getProductImage';
import { saveOrderToHistory } from '../utils/orderHistory';
import { buildWhatsAppOrderMessage } from '../utils/whatsappOrderMessage';
import OrderHistory from './OrderHistory';
import { calculateClosedPacks, calculateUnitAndPack, getReadableBreakdown, getValidPresentations } from '../utils/productPresentations';
import { resolveCartLineTotals } from '../utils/promotionResolver';

export default function CartDrawer() {
  const {
    cart,
    removeFromCart,
    updateQuantity,
    updateConfiguredLine,
    cartTotal,
    cartCount,
    isCartOpen,
    setIsCartOpen,
    clearCart,
    addItemsToCart,
    migrationNotice,
    clearMigrationNotice,
    promotions,
    relations,
    cartNotification,
    clearCartNotification,
    refreshActivePromotions
  } = useCart();

  const navigate = useNavigate();

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [shippingMethod, setShippingMethod] = useState('retiro'); // 'retiro' or 'envio'
  const [street, setStreet] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [floor, setFloor] = useState('');
  const [dept, setDept] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedWhatsAppId, setSelectedWhatsAppId] = useState(business.whatsapp[0].id);
  const [errors, setErrors] = useState({});

  // Abuse protection & state management
  const [website, setWebsite] = useState(''); // Honeypot
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [drawerView, setDrawerView] = useState('cart');
  const [toast, setToast] = useState('');

  // Animation states
  const [removingItems, setRemovingItems] = useState([]);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Config check for the chosen WhatsApp contact
  const selectedWa = business.whatsapp.find(w => w.id === selectedWhatsAppId);
  const isWhatsAppConfigured = !!selectedWa?.internationalNumber;

  const handleUpdateQuantity = (identifier, newQty) => {
    if (newQty <= 0) {
      setRemovingItems((prev) => [...prev, identifier]);
      setTimeout(() => {
        updateQuantity(identifier, 0);
        setRemovingItems((prev) => prev.filter((id) => id !== identifier));
      }, 300);
    } else {
      updateQuantity(identifier, newQty);
    }
  };

  const handleRemoveFromCart = (identifier) => {
    setRemovingItems((prev) => [...prev, identifier]);
    setTimeout(() => {
      removeFromCart(identifier);
      setRemovingItems((prev) => prev.filter((id) => id !== identifier));
    }, 300);
  };

  const handleClearCart = () => {
    setIsClearingAll(true);
    const duration = 200 + cart.length * 30;
    setTimeout(() => {
      clearCart();
      setIsClearingAll(false);
    }, duration);
  };

  const handleClose = () => {
    setIsCartOpen(false);
  };

  useEffect(() => {
    if (!isCartOpen) setDrawerView('cart');
  }, [isCartOpen]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const validateForm = () => {
    const nextErrors = {};
    if (!name.trim()) nextErrors.name = 'El nombre es obligatorio.';
    if (!phone.trim()) {
      nextErrors.phone = 'El teléfono es obligatorio.';
    } else {
      const cleanPhone = phone.replace(/[^0-9+]/g, '');
      if (cleanPhone.length < 8) nextErrors.phone = 'El número de teléfono parece inválido.';
    }

    if (shippingMethod === 'envio') {
      if (!street.trim()) nextErrors.street = 'La calle y altura son obligatorias.';
      if (!neighborhood.trim()) nextErrors.neighborhood = 'El barrio es obligatorio.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildWhatsAppUrl = (internationalNumber, text) => {
    const cleanNumber = internationalNumber.replace(/[^0-9]/g, '');
    const encodedText = encodeURIComponent(text);
    return `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodedText}`;
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (website.trim()) {
      setToast('Pedido procesado con éxito (bot).');
      clearCart();
      setIsCartOpen(false);
      return;
    }

    if (!validateForm()) {
      setSubmitError('Revisá los datos ingresados en el formulario.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Force fresh fetch of active campaigns and relations right before sending to WhatsApp
      const freshData = await refreshActivePromotions(true);
      const freshPromos = freshData?.promotions || promotions;
      const freshRels = freshData?.relations || relations;

      // 2. Resolve dynamic item subtotals using the newly fetched active promotions
      const processedCart = cart.map(item => {
        const totals = resolveCartLineTotals(item, freshPromos, freshRels);
        return {
          ...item,
          originalSubtotal: totals.originalSubtotal,
          promoSubtotal: totals.promoSubtotal,
          promoApplied: totals.promoApplied,
          badgeText: totals.badgeText,
          discountAmount: totals.discountAmount
        };
      });

      // 3. Calculate fresh dynamic cart total
      const freshCartTotal = processedCart.reduce((total, item) => total + item.promoSubtotal, 0);

      const orderData = {
        name: name.trim(),
        phone: phone.trim(),
        shippingMethod,
        street: shippingMethod === 'envio' ? street.trim() : '',
        neighborhood: shippingMethod === 'envio' ? neighborhood.trim() : '',
        floor: shippingMethod === 'envio' ? floor.trim() : '',
        dept: shippingMethod === 'envio' ? dept.trim() : '',
        notes: shippingMethod === 'envio' ? notes.trim() : '',
        cart: processedCart,
        cartTotal: freshCartTotal
      };

      // Generate order message and link
      const messageText = buildWhatsAppOrderMessage(orderData);
      const whatsappUrl = buildWhatsAppUrl(selectedWa.internationalNumber, messageText);

      const whatsappWindow = window.open(whatsappUrl, '_blank');
      if (!whatsappWindow) {
        setSubmitError('El navegador bloqueó WhatsApp. Permití las ventanas emergentes e intentá nuevamente.');
        return;
      }
      try {
        whatsappWindow.opener = null;
      } catch {
        // Ignore
      }

      const savedOrder = saveOrderToHistory({
        customerName: orderData.name,
        phone: orderData.phone,
        deliveryType: orderData.shippingMethod,
        address: orderData.street,
        neighborhood: orderData.neighborhood,
        floor: orderData.floor,
        department: orderData.dept,
        notes: orderData.notes,
        whatsapp: {
          id: selectedWa.id,
          label: selectedWa.label,
          number: selectedWa.localNumber,
        },
        products: orderData.cart.map((item) => ({
          productId: item.product.id,
          productSlug: item.product.slug,
          name: item.product.nombre,
          quantity: item.quantity,
          mode: item.mode || 'traditional',
          presentationId: item.presentationId || null,
          presentationLabel: item.presentationLabel || null,
          cantidadPacks: item.cantidadPacks || 0,
          cantidadUnidadesSueltas: item.cantidadUnidadesSueltas || 0,
          cantidadUnidadesTotales: item.cantidadUnidadesTotales || item.quantity,
          breakdown: item.breakdown || '',
          precioUnitario: item.precioUnitario ?? Number(item.product.precio),
          precioPresentacion: item.precioPresentacion ?? null,
          subtotal: item.promoSubtotal, // Use promotional subtotal here
        })),
        subtotal: orderData.cartTotal,
        shippingCost: orderData.shippingMethod === 'envio' ? null : 0,
        total: orderData.cartTotal,
      });

      clearCart();
      setIsCartOpen(false);
      setToast(savedOrder
        ? 'Pedido guardado en Mis pedidos. Revisá WhatsApp para enviarlo.'
        : 'WhatsApp abierto, pero el navegador no permitió guardar el pedido localmente.');
      setName(''); setPhone(''); setStreet(''); setNeighborhood(''); setFloor(''); setDept(''); setNotes('');

    } catch (err) {
      console.error('Error in checkout:', err);
      setSubmitError(err.message || 'Ocurrió un error inesperado al preparar tu pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRepeatOrder = (items, mode, unavailableCount) => {
    if (items.length > 0) addItemsToCart(items, mode);
    setDrawerView('cart');
    setToast(unavailableCount > 0
      ? `Pedido agregado. ${unavailableCount} producto(s) ya no están disponibles.`
      : 'Pedido agregado al carrito con los precios actuales.');
  };

  const changeConfiguredQuantity = (item, nextQuantity) => {
    if (nextQuantity <= 0) {
      handleRemoveFromCart(item.lineKey);
      return;
    }
    if (item.mode === 'free') {
      const calculation = calculateUnitAndPack(item.product, nextQuantity);
      if (!calculation) return;
      updateConfiguredLine(item.lineKey, (current) => ({ ...current, quantity: calculation.totalUnits, cantidadUnidadesTotales: calculation.totalUnits, cantidadPacks: calculation.completePacks, cantidadUnidadesSueltas: calculation.looseUnits, subtotal: calculation.total, breakdown: getReadableBreakdown(calculation) }));
      return;
    }
    const presentation = getValidPresentations(item.product).find((candidate) => candidate.id === item.presentationId);
    const calculation = calculateClosedPacks(presentation, nextQuantity);
    if (!calculation) return;
    updateConfiguredLine(item.lineKey, (current) => ({ ...current, quantity: calculation.packCount, cantidadPacks: calculation.packCount, cantidadUnidadesTotales: calculation.totalUnits, subtotal: calculation.total, breakdown: getReadableBreakdown(calculation), precioPresentacion: presentation.precio }));
  };

  const formatter = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  });

  return (
    <>
    {toast && <div className="app-toast" role="status">{toast}</div>}
    <div className={`cart-drawer-overlay ${isCartOpen ? 'active' : ''}`} onClick={handleClose}>
      <div className="cart-drawer-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cart-drawer-header">
          <div className="cart-header-title">
            <svg className="cart-header-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            <h2>{drawerView === 'history' ? 'Mis pedidos' : 'Mi Carrito'}</h2>
            {drawerView === 'cart' && <span className="cart-badge">{cartCount}</span>}
          </div>
          <div className="cart-header-actions">
            {drawerView === 'cart' && <button type="button" className="cart-history-btn" onClick={() => setDrawerView('history')}>Mis pedidos</button>}
            {drawerView === 'cart' && cart.length > 0 && (
              <button 
                type="button" 
                className="cart-clear-btn" 
                onClick={handleClearCart}
              >
                Vaciar
              </button>
            )}
            <button 
              type="button" 
              className="cart-close-btn" 
              onClick={handleClose}
              aria-label="Cerrar carrito"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="cart-drawer-body">
          {migrationNotice && <div className="checkout-error-message cart-migration-notice" role="status">{migrationNotice}<button type="button" onClick={clearMigrationNotice} aria-label="Cerrar aviso">×</button></div>}
          {cartNotification && (
            <div 
              className="checkout-error-message cart-migration-notice" 
              style={{ backgroundColor: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.2)' }}
              role="status"
            >
              {cartNotification}
              <button type="button" onClick={clearCartNotification} aria-label="Cerrar aviso">×</button>
            </div>
          )}
          {drawerView === 'history' ? (
            <OrderHistory cartHasItems={cart.length > 0} onBack={() => setDrawerView('cart')} onRepeat={handleRepeatOrder} />
          ) : cart.length === 0 ? (
            <div className="cart-empty">
              <svg className="cart-empty-icon-svg" xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              <h3>Tu carrito está vacío</h3>
              <p>Agrega productos desde nuestro catálogo para realizar un pedido.</p>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleClose}
              >
                Ver productos
              </button>
            </div>
          ) : (
            <>
              {/* Product List */}
              <div className="cart-items-list">
                {cart.map((item, index) => {
                  const product = item.product;
                  const identifier = item.lineKey || product.id;
                  const isRemoving = removingItems.includes(identifier);
                  const isClearing = isClearingAll;
                  const delay = isClearing ? `${index * 50}ms` : '0ms';

                  // Calculate promotional values dynamically
                  const totals = resolveCartLineTotals(item, promotions, relations);
                  const hasPromo = totals.discountAmount > 0;

                  return (
                    <div 
                      className={`cart-item ${isRemoving ? 'removing' : ''} ${isClearing ? 'clearing' : ''}`} 
                      key={identifier}
                      style={{ transitionDelay: delay }}
                    >
                      <div className="cart-item-mobile-header">
                        <div 
                          className="cart-item-img-container" 
                          onClick={() => { navigate(`/${product.slug}`); handleClose(); }}
                          style={{ cursor: 'pointer' }}
                          title="Ver detalle del producto"
                        >
                          <img 
                            src={getProductImage(product)} 
                            alt={product.nombre}
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = getProductImage({});
                            }}
                          />
                        </div>
                        <div className="cart-item-mobile-info">
                          <span className="cart-item-brand">{product.categories?.nombre || 'Minhag Kosher'}</span>
                          <h4 
                            className="cart-item-name" 
                            onClick={() => { navigate(`/${product.slug}`); handleClose(); }}
                            style={{ cursor: 'pointer' }}
                            title="Ver detalle del producto"
                          >
                            {product.nombre}
                          </h4>
                          {hasPromo && (
                            <span 
                              style={{ 
                                display: 'inline-block', 
                                backgroundColor: 'rgba(239, 68, 68, 0.12)', 
                                color: '#ef4444', 
                                fontSize: '0.68rem', 
                                padding: '2px 6px', 
                                borderRadius: '4px',
                                fontWeight: 'bold',
                                marginTop: '4px'
                              }}
                            >
                              🎉 Promo {totals.badgeText} aplicada
                            </span>
                          )}
                        </div>
                        <button 
                          type="button"
                          className="cart-item-mobile-remove"
                          onClick={() => handleRemoveFromCart(identifier)}
                          aria-label={`Eliminar ${product.nombre} del carrito`}
                          disabled={isSubmitting}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                          <span>Eliminar</span>
                        </button>
                      </div>

                      <div className="cart-item-details">
                        <div className="cart-item-mobile-summary">
                          {item.mode !== 'traditional' && (
                            <div className="cart-item-mobile-summary-row">
                              <span className="cart-item-mobile-label">Presentación</span>
                              <span className="cart-item-mobile-value">
                                {item.mode === 'free'
                                  ? item.breakdown
                                  : `${item.cantidadPacks} ${item.cantidadPacks === 1 ? 'pack' : 'packs'} ${item.presentationLabel?.replace(/^Pack\s*/i, '') || ''}`}
                              </span>
                            </div>
                          )}
                          {item.mode === 'traditional' && (
                            <div className="cart-item-mobile-summary-row">
                              <span className="cart-item-mobile-label">Precio unitario</span>
                              <span className="cart-item-mobile-value">
                                {hasPromo && totals.promoApplied.tipo_descuento !== 'compra_x_paga_y' ? (
                                  <>
                                    <span style={{ textDecoration: 'line-through', opacity: '0.6', marginRight: '6px' }}>
                                      {formatter.format(product.precio)}
                                    </span>
                                    <span style={{ color: '#ef4444', fontWeight: 'bold' }}>
                                      {formatter.format(totals.promoSubtotal / item.quantity)}
                                    </span>
                                  </>
                                ) : (
                                  formatter.format(product.precio)
                                )}
                              </span>
                            </div>
                          )}
                          <div className="cart-item-mobile-summary-row">
                            <span className="cart-item-mobile-label">Cantidad total</span>
                            <span className="cart-item-mobile-value">
                              {item.mode === 'packs' || item.mode === 'free'
                                ? `${item.cantidadUnidadesTotales} unidades`
                                : `${item.quantity} ${item.quantity === 1 ? 'unidad' : 'unidades'}`}
                            </span>
                          </div>
                          <div className="cart-item-mobile-summary-row">
                            <span className="cart-item-mobile-label">Subtotal</span>
                            <span className="cart-item-mobile-subtotal">
                              {hasPromo ? (
                                <>
                                  <span style={{ textDecoration: 'line-through', opacity: '0.5', fontSize: '0.78rem', marginRight: '8px' }}>
                                    {formatter.format(totals.originalSubtotal)}
                                  </span>
                                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                                    {formatter.format(totals.promoSubtotal)}
                                  </span>
                                </>
                              ) : (
                                formatter.format(totals.originalSubtotal)
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="cart-item-actions">
                          <div className="cart-item-mobile-controls cart-qty-selector">
                            <button 
                              type="button"
                              className="qty-btn"
                              onClick={() => item.mode === 'traditional' ? handleUpdateQuantity(identifier, item.quantity - 1) : changeConfiguredQuantity(item, item.quantity - 1)}
                              aria-label={item.mode === 'packs' ? 'Disminuir cantidad de packs' : 'Disminuir cantidad'}
                              disabled={isSubmitting}
                            >
                              -
                            </button>
                            <span className="qty-val">
                              {item.mode === 'packs'
                                ? `${item.quantity} ${item.quantity === 1 ? 'pack' : 'packs'}`
                                : `${item.quantity} ${item.quantity === 1 ? 'unidad' : 'unidades'}`}
                            </span>
                            <button 
                              type="button"
                              className="qty-btn"
                              onClick={() => item.mode === 'traditional' ? updateQuantity(identifier, item.quantity + 1) : changeConfiguredQuantity(item, item.quantity + 1)}
                              aria-label={item.mode === 'packs' ? 'Aumentar cantidad de packs' : 'Aumentar cantidad'}
                              disabled={isSubmitting}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Checkout Form */}
              <form className="cart-checkout-form" onSubmit={handleCheckout}>
                <h3>Datos del Pedido</h3>
                
                {submitError && (
                  <div className="checkout-error-message">
                    {submitError}
                  </div>
                )}

                {/* Honeypot hidden input */}
                <div style={{ display: 'none' }} aria-hidden="true">
                  <input 
                    type="text" 
                    name="website" 
                    value={website} 
                    onChange={(e) => setWebsite(e.target.value)} 
                    tabIndex={-1} 
                    autoComplete="off" 
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="cart-name">Nombre y Apellido *</label>
                  <input 
                    id="cart-name"
                    type="text" 
                    placeholder="Ej: Juan Pérez"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={errors.name ? 'input-error' : ''}
                    disabled={isSubmitting}
                  />
                  {errors.name && <span className="error-text">{errors.name}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="cart-phone">Teléfono de contacto *</label>
                  <input 
                    id="cart-phone"
                    type="tel" 
                    placeholder="Ej: 11 2345-6789"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={errors.phone ? 'input-error' : ''}
                    disabled={isSubmitting}
                  />
                  {errors.phone && <span className="error-text">{errors.phone}</span>}
                </div>

                {/* Delivery Method Selector */}
                <div className="form-group">
                  <label>Método de entrega</label>
                  <div className="delivery-methods">
                    <button
                      type="button"
                      className={`method-btn ${shippingMethod === 'retiro' ? 'active' : ''}`}
                      onClick={() => setShippingMethod('retiro')}
                      disabled={isSubmitting}
                    >
                      <svg className="method-icon-svg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      <span className="method-label">Retiro por local</span>
                    </button>
                    <button
                      type="button"
                      className={`method-btn ${shippingMethod === 'envio' ? 'active' : ''}`}
                      onClick={() => setShippingMethod('envio')}
                      disabled={isSubmitting}
                    >
                      <svg className="method-icon-svg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                      <span className="method-label">Envío a domicilio</span>
                    </button>
                  </div>
                </div>

                {/* Conditional Shipping Fields */}
                <AnimatePresence initial={false}>
                  {shippingMethod === 'envio' && (
                    <motion.div 
                      className="shipping-fields"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="form-group" style={{ paddingTop: '10px' }}>
                        <label htmlFor="cart-street">Dirección (Calle y Altura) *</label>
                        <input 
                          id="cart-street"
                          type="text" 
                          placeholder="Ej: Terrada 500"
                          value={street}
                          onChange={(e) => setStreet(e.target.value)}
                          className={errors.street ? 'input-error' : ''}
                          disabled={isSubmitting}
                        />
                        {errors.street && <span className="error-text">{errors.street}</span>}
                      </div>

                      <div className="form-group">
                        <label htmlFor="cart-neighborhood">Barrio o Localidad *</label>
                        <input 
                          id="cart-neighborhood"
                          type="text" 
                          placeholder="Ej: Flores"
                          value={neighborhood}
                          onChange={(e) => setNeighborhood(e.target.value)}
                          className={errors.neighborhood ? 'input-error' : ''}
                          disabled={isSubmitting}
                        />
                        {errors.neighborhood && <span className="error-text">{errors.neighborhood}</span>}
                      </div>

                      <div className="form-row">
                        <div className="form-group col">
                          <label htmlFor="cart-floor">Piso (Opcional)</label>
                          <input 
                            id="cart-floor"
                            type="text" 
                            placeholder="Ej: 3"
                            value={floor}
                            onChange={(e) => setFloor(e.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="form-group col">
                          <label htmlFor="cart-dept">Departamento (Opcional)</label>
                          <input 
                            id="cart-dept"
                            type="text" 
                            placeholder="Ej: B"
                            value={dept}
                            onChange={(e) => setDept(e.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label htmlFor="cart-notes">Indicaciones adicionales (Opcional)</label>
                        <textarea 
                          id="cart-notes"
                          rows="2"
                          placeholder="Ej: Tocar timbre negro, dejar en recepción, etc."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          disabled={isSubmitting}
                          style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontFamily: 'inherit', resize: 'vertical' }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Contact Selection */}
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label>Enviar pedido a:</label>
                  <div className="whatsapp-selector" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    {business.whatsapp.map((wa) => (
                      <label key={wa.id} className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                        <input 
                          type="radio" 
                          name="whatsapp-target" 
                          value={wa.id} 
                          checked={selectedWhatsAppId === wa.id} 
                          onChange={() => setSelectedWhatsAppId(wa.id)}
                          disabled={isSubmitting}
                        />
                        <span>{wa.label}: {wa.localNumber}</span>
                      </label>
                    ))}
                  </div>
                  {!isWhatsAppConfigured && (
                    <div className="whatsapp-warning" style={{ marginTop: '10px', padding: '10px', backgroundColor: 'rgba(229, 62, 62, 0.1)', color: '#e53e3e', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: '600', border: '1px solid rgba(229, 62, 62, 0.2)' }}>
                      ⚠️ El número de WhatsApp todavía no está configurado.
                    </div>
                  )}
                </div>

                {/* Summary & Checkout Action */}
                <div className="cart-summary">
                  <div className="summary-row">
                    <span>Subtotal</span>
                    <span>{formatter.format(cartTotal)}</span>
                  </div>
                  {shippingMethod === 'envio' && (
                    <div className="summary-row">
                      <span>Costo de envío</span>
                      <span style={{ color: 'var(--primary)', fontWeight: '600' }}>A coordinar</span>
                    </div>
                  )}
                  <div className="summary-row total">
                    <span>Total</span>
                    <span>{formatter.format(cartTotal)}</span>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn-cart-checkout" 
                  disabled={isSubmitting || !isWhatsAppConfigured}
                  style={{ opacity: (!isWhatsAppConfigured) ? 0.6 : 1, cursor: (!isWhatsAppConfigured) ? 'not-allowed' : 'pointer' }}
                >
                  {isSubmitting ? (
                    <span>Procesando...</span>
                  ) : !isWhatsAppConfigured ? (
                    <span>WhatsApp no configurado</span>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
                        <path d="M21.19 12.18c0 .28-.22.5-.5.5H3.31c-.28 0-.5-.22-.5-.5V8.5c0-.28.22-.5.5-.5h17.38c.28 0 .5.22.5.5v3.68z"></path>
                        <path d="M22 21H2"></path>
                      </svg>
                      Enviar pedido por WhatsApp
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
