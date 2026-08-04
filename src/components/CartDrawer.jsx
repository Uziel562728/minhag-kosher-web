import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import { business } from '../config/business';

export default function CartDrawer() {
  const {
    cart,
    removeFromCart,
    updateQuantity,
    cartTotal,
    cartCount,
    isCartOpen,
    setIsCartOpen,
    clearCart
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
  const [orderResult, setOrderResult] = useState(null);

  // Animation states
  const [removingItems, setRemovingItems] = useState([]);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Config check for the chosen WhatsApp contact
  const selectedWa = business.whatsapp.find(w => w.id === selectedWhatsAppId);
  const isWhatsAppConfigured = !!selectedWa?.internationalNumber;

  const handleUpdateQuantity = (productId, newQty) => {
    if (newQty <= 0) {
      setRemovingItems((prev) => [...prev, productId]);
      setTimeout(() => {
        updateQuantity(productId, 0);
        setRemovingItems((prev) => prev.filter((id) => id !== productId));
      }, 300);
    } else {
      updateQuantity(productId, newQty);
    }
  };

  const handleRemoveFromCart = (productId) => {
    setRemovingItems((prev) => [...prev, productId]);
    setTimeout(() => {
      removeFromCart(productId);
      setRemovingItems((prev) => prev.filter((id) => id !== productId));
    }, 300);
  };

  const handleClearCart = () => {
    if (window.confirm('¿Estás seguro de que deseas vaciar tu carrito?')) {
      setIsClearingAll(true);
      const duration = 300 + cart.length * 50;
      setTimeout(() => {
        clearCart();
        setIsClearingAll(false);
      }, duration);
    }
  };

  const handleClose = () => {
    setIsCartOpen(false);
  };

  const validateForm = () => {
    const tempErrors = {};
    if (!name.trim()) tempErrors.name = 'El nombre y apellido son obligatorios';
    
    const phoneTrimmed = phone.trim();
    if (!phoneTrimmed) {
      tempErrors.phone = 'El teléfono es obligatorio';
    } else {
      // Basic Argentine mobile / landline format check
      const phoneRegex = /^[0-9+\s\-()]{6,25}$/;
      if (!phoneRegex.test(phoneTrimmed)) {
        tempErrors.phone = 'Formato de teléfono inválido (ej: 11 2345-6789)';
      }
    }
    
    if (shippingMethod === 'envio') {
      if (!street.trim()) tempErrors.street = 'La calle y altura son obligatorias';
      if (!neighborhood.trim()) tempErrors.neighborhood = 'El barrio o localidad es obligatorio';
    }
    
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  // Reusable message builder functions as requested
  const buildWhatsAppOrderMessage = (orderData) => {
    const formatter = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });

    const deliveryText = orderData.shippingMethod === 'envio' ? 'Envío a domicilio' : 'Retiro por el local';
    
    let msg = `Hola, Minhag Kosher. Quiero realizar el siguiente pedido:\n\n`;
    msg += `DATOS DEL CLIENTE\n`;
    msg += `Nombre: ${orderData.name}\n`;
    msg += `Teléfono: ${orderData.phone}\n`;
    msg += `Entrega: ${deliveryText}\n`;
    
    if (orderData.shippingMethod === 'envio') {
      msg += `\nDIRECCIÓN DE ENTREGA\n`;
      msg += `Dirección: ${orderData.street}\n`;
      msg += `Barrio/localidad: ${orderData.neighborhood}\n`;
      msg += `Piso: ${orderData.floor || 'No indicado'}\n`;
      msg += `Departamento: ${orderData.dept || 'No indicado'}\n`;
      msg += `Indicaciones: ${orderData.notes || 'Sin indicaciones'}\n`;
    }
    
    msg += `\nPEDIDO\n`;
    orderData.cart.forEach((item, index) => {
      const subtotal = item.product.precio * item.quantity;
      msg += `${index + 1}. ${item.quantity} x ${item.product.nombre} — ${formatter.format(subtotal)}\n`;
    });
    
    msg += `\nSubtotal: ${formatter.format(orderData.cartTotal)}\n`;
    
    if (orderData.shippingMethod === 'envio') {
      msg += `Envío: A coordinar\n`;
    } else {
      msg += `Envío: No corresponde\n`;
    }
    
    msg += `TOTAL: ${formatter.format(orderData.cartTotal)}\n\n`;
    msg += `Quedo a la espera de la confirmación. Gracias.`;
    
    return msg;
  };

  const buildWhatsAppUrl = (phoneNumber, message) => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const encodedText = encodeURIComponent(message);
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  };

  const handleCheckout = (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validateForm()) return;

    if (!isWhatsAppConfigured) {
      setSubmitError('El número de WhatsApp todavía no está configurado.');
      return;
    }

    // Honeypot check
    if (website) {
      console.warn("Honeypot triggered");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const orderData = {
        name: name.trim(),
        phone: phone.trim(),
        shippingMethod,
        street: shippingMethod === 'envio' ? street.trim() : '',
        neighborhood: shippingMethod === 'envio' ? neighborhood.trim() : '',
        floor: shippingMethod === 'envio' ? floor.trim() : '',
        dept: shippingMethod === 'envio' ? dept.trim() : '',
        notes: shippingMethod === 'envio' ? notes.trim() : '',
        cart,
        cartTotal
      };

      // Generate order message and link
      const messageText = buildWhatsAppOrderMessage(orderData);
      const whatsappUrl = buildWhatsAppUrl(selectedWa.internationalNumber, messageText);

      // Open WhatsApp link in new tab
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

      // Set orderResult to show success view without clearing the cart automatically
      setOrderResult({
        name: orderData.name,
        total: orderData.cartTotal,
        whatsappUrl: whatsappUrl,
        message: messageText,
        whatsappLabel: selectedWa?.label || "WhatsApp"
      });

      // SUPABASE DATABASE SAVE INTEGRATION IS CURRENTLY PENDING CONFIRMATION OF THE DATABASE.
      // WE CONSERVE THE CODE IN CASE THE CLIENT WANTS TO ENABLE IT LATER:
      /*
      // Code template for saving order to Supabase:
      const payload = {
        customer: { name: name.trim(), phone: phone.trim() },
        shipping: {
          method: shippingMethod,
          street: shippingMethod === 'envio' ? street.trim() : '',
          neighborhood: shippingMethod === 'envio' ? neighborhood.trim() : '',
          floor: shippingMethod === 'envio' ? floor.trim() : '',
          department: shippingMethod === 'envio' ? dept.trim() : '',
          notes: shippingMethod === 'envio' ? notes.trim() : ''
        },
        items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity })),
        website
      };
      const { data, error } = await supabase.functions.invoke('create-order', { body: payload });
      if (error) console.error("Database save failed:", error);
      */

    } catch (err) {
      console.error('Error in checkout:', err);
      setSubmitError(err.message || 'Ocurrió un error inesperado al preparar tu pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmOrderSent = () => {
    // Clear cart and reset states after user confirms WhatsApp sent
    clearCart();
    setName('');
    setPhone('');
    setStreet('');
    setNeighborhood('');
    setFloor('');
    setDept('');
    setNotes('');
    setOrderResult(null);
    setIsCartOpen(false);
  };

  const handleBackToCart = () => {
    setOrderResult(null);
  };

  const formatter = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  });

  return (
    <div className={`cart-drawer-overlay ${isCartOpen ? 'active' : ''}`} onClick={handleClose}>
      <div className="cart-drawer-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cart-drawer-header">
          <div className="cart-header-title">
            <svg className="cart-header-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            <h2>{orderResult ? 'Pedido listo para enviar' : 'Mi Carrito'}</h2>
            {!orderResult && <span className="cart-badge">{cartCount}</span>}
          </div>
          <div className="cart-header-actions">
            {!orderResult && cart.length > 0 && (
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
          {orderResult ? (
            <div className="cart-success-view">
              <svg className="cart-success-icon-svg" xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--whatsapp)' }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              <h3>¡Pedido listo para enviar!</h3>
              <p className="order-instruction" style={{ marginBottom: '16px' }}>
                Se ha abierto la ventana de WhatsApp para enviar el mensaje a <strong>{orderResult.whatsappLabel}</strong>.
              </p>
              
              <div className="order-summary-box" style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '20px', textAlign: 'left' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.95rem' }}>Cliente: <strong>{name}</strong></p>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.95rem' }}>Total estimado: <strong>{formatter.format(orderResult.total)}</strong></p>
                <p style={{ margin: '0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Si el enlace de WhatsApp no se abrió, haz clic en el botón de abajo para intentar de nuevo.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                <a 
                  href={orderResult.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-whatsapp btn-large"
                  style={{ width: '100%', textDecoration: 'none' }}
                >
                  💬 Enviar de nuevo por WhatsApp
                </a>
                
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleConfirmOrderSent}
                  style={{ width: '100%', padding: '12px 24px' }}
                >
                  ✓ Confirmar y vaciar carrito
                </button>

                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={handleBackToCart}
                  style={{ width: '100%', padding: '10px 24px' }}
                >
                  ← Modificar carrito / Volver
                </button>
              </div>
            </div>
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
                  const isRemoving = removingItems.includes(product.id);
                  const isClearing = isClearingAll;
                  const delay = isClearing ? `${index * 50}ms` : '0ms';

                  return (
                    <div 
                      className={`cart-item ${isRemoving ? 'removing' : ''} ${isClearing ? 'clearing' : ''}`} 
                      key={product.id}
                      style={{ transitionDelay: delay }}
                    >
                      <div 
                        className="cart-item-img-container" 
                        onClick={() => { navigate(`/${product.slug}`); handleClose(); }}
                        style={{ cursor: 'pointer' }}
                        title="Ver detalle del producto"
                      >
                        <img 
                          src={product.imagen_principal || 'https://via.placeholder.com/100?text=Producto'} 
                          alt={product.nombre}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150&auto=format&fit=crop&q=80';
                          }}
                        />
                      </div>
                      <div className="cart-item-details">
                        <div className="cart-item-meta">
                          <span className="cart-item-brand">{product.marca || 'Artesanal'}</span>
                        </div>
                        <h4 
                          className="cart-item-name" 
                          onClick={() => { navigate(`/${product.slug}`); handleClose(); }}
                          style={{ cursor: 'pointer' }}
                          title="Ver detalle del producto"
                        >
                          {product.nombre}
                        </h4>
                        <div className="cart-item-pricing">
                          <span className="cart-item-price-each">
                            {formatter.format(product.precio)} c/u
                          </span>
                          <span className="cart-item-subtotal">
                            Subtotal: {formatter.format(product.precio * item.quantity)}
                          </span>
                        </div>
                        
                        <div className="cart-item-actions">
                          {/* Quantity Selector */}
                          <div className="cart-qty-selector">
                            <button 
                              type="button"
                              className="qty-btn"
                              onClick={() => handleUpdateQuantity(product.id, item.quantity - 1)}
                              aria-label="Disminuir cantidad"
                              disabled={isSubmitting}
                            >
                              -
                            </button>
                            <span className="qty-val">{item.quantity}</span>
                            <button 
                              type="button"
                              className="qty-btn"
                              onClick={() => updateQuantity(product.id, item.quantity + 1)}
                              aria-label="Aumentar cantidad"
                              disabled={isSubmitting}
                            >
                              +
                            </button>
                          </div>
                          
                          {/* Remove Button */}
                          <button 
                            type="button"
                            className="cart-item-remove"
                            onClick={() => handleRemoveFromCart(product.id)}
                            aria-label="Eliminar producto"
                            disabled={isSubmitting}
                          >
                            Eliminar
                          </button>
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
  );
}
