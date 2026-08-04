import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { supabase } from '../supabaseClient';

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
  const [floor, setFloor] = useState('');
  const [dept, setDept] = useState('');
  const [errors, setErrors] = useState({});

  // Abuse protection & state management
  const [website, setWebsite] = useState(''); // Honeypot
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [orderResult, setOrderResult] = useState(null);

  // Animation states
  const [removingItems, setRemovingItems] = useState([]);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Generate idempotency key on mount / when cart is opened
  useEffect(() => {
    if (isCartOpen && !idempotencyKey) {
      const key = crypto.randomUUID ? crypto.randomUUID() : 'idemp-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
      setIdempotencyKey(key);
    }
  }, [isCartOpen, idempotencyKey]);

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
    setIsClearingAll(true);
    const duration = 300 + cart.length * 50;
    setTimeout(() => {
      clearCart();
      setIsClearingAll(false);
    }, duration);
  };

  const handleClose = () => {
    setIsCartOpen(false);
    if (orderResult) {
      setTimeout(() => {
        setOrderResult(null);
      }, 300);
    }
  };

  const validateForm = () => {
    const tempErrors = {};
    if (!name.trim()) tempErrors.name = 'El nombre es obligatorio';
    
    const phoneTrimmed = phone.trim();
    if (!phoneTrimmed) {
      tempErrors.phone = 'El teléfono es obligatorio';
    } else {
      const phoneRegex = /^[0-9+\s\-()]{6,25}$/;
      if (!phoneRegex.test(phoneTrimmed)) {
        tempErrors.phone = 'Formato de teléfono inválido (ej: 11 2345-6789)';
      }
    }
    
    if (shippingMethod === 'envio') {
      if (!street.trim()) tempErrors.street = 'La calle con altura es obligatoria';
    }
    
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        customer: {
          name: name.trim(),
          phone: phone.trim()
        },
        shipping: {
          method: shippingMethod,
          street: shippingMethod === 'envio' ? street.trim() : '',
          floor: shippingMethod === 'envio' ? floor.trim() : '',
          department: shippingMethod === 'envio' ? dept.trim() : ''
        },
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity
        })),
        idempotencyKey,
        website
      };

      const { data, error } = await supabase.functions.invoke('create-order', {
        body: payload
      });

      if (error) {
        throw new Error(error.message || 'Error al procesar el pedido');
      }

      if (data && data.ok) {
        setOrderResult(data.order);
        clearCart();
        // Reset states
        setName('');
        setPhone('');
        setStreet('');
        setFloor('');
        setDept('');
        setIdempotencyKey('');
      } else {
        throw new Error(data?.error || 'Error al guardar el pedido en el servidor');
      }
    } catch (err) {
      console.error('Error in checkout:', err);
      setSubmitError(err.message || 'Ocurrió un error inesperado al enviar el pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`cart-drawer-overlay ${isCartOpen ? 'active' : ''}`} onClick={handleClose}>
      <div className="cart-drawer-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cart-drawer-header">
          <div className="cart-header-title">
            <svg className="cart-header-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            <h2>{orderResult ? 'Pedido Recibido' : 'Mi Carrito'}</h2>
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
              <svg className="cart-success-icon-svg" xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              <h3>¡Pedido recibido!</h3>
              <p className="order-number-display">Número de pedido: <strong>#{orderResult.orderNumber}</strong></p>
              <p className="order-total-display">Total: <strong>${orderResult.total.toLocaleString('es-AR')}</strong></p>
              <p className="order-instruction">Nos comunicaremos al teléfono indicado para confirmarlo.</p>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleClose}
                style={{ marginTop: '10px', padding: '12px 24px', width: '100%' }}
              >
                Entendido
              </button>
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
                        onClick={() => navigate(`/${product.slug}`)}
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
                          <span className="cart-item-brand">{product.marca || 'Genérico'}</span>
                        </div>
                        <h4 
                          className="cart-item-name" 
                          onClick={() => navigate(`/${product.slug}`)}
                          style={{ cursor: 'pointer' }}
                          title="Ver detalle del producto"
                        >
                          {product.nombre}
                        </h4>
                        <div className="cart-item-pricing">
                          <span className="cart-item-price-each">
                            ${product.precio.toLocaleString('es-AR')}
                          </span>
                          <span className="cart-item-subtotal">
                            Subtotal: ${(product.precio * item.quantity).toLocaleString('es-AR')}
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
                <h3>Datos de Entrega</h3>
                
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
                  <label htmlFor="cart-name">Nombre completo *</label>
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
                      <span className="method-label">Retiro en Sucursal</span>
                    </button>
                    <button
                      type="button"
                      className={`method-btn ${shippingMethod === 'envio' ? 'active' : ''}`}
                      onClick={() => setShippingMethod('envio')}
                      disabled={isSubmitting}
                    >
                      <svg className="method-icon-svg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                      <span className="method-label">Envío a Domicilio</span>
                    </button>
                  </div>
                </div>

                {/* Conditional Shipping Fields */}
                {shippingMethod === 'envio' && (
                  <div className="shipping-fields animated fadeIn">
                    <div className="form-group">
                      <label htmlFor="cart-street">Calle con altura *</label>
                      <input 
                        id="cart-street"
                        type="text" 
                        placeholder="Ej: Av. Corrientes 1234"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        className={errors.street ? 'input-error' : ''}
                        disabled={isSubmitting}
                      />
                      {errors.street && <span className="error-text">{errors.street}</span>}
                    </div>

                    <div className="form-row">
                      <div className="form-group col">
                        <label htmlFor="cart-floor">Piso</label>
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
                        <label htmlFor="cart-dept">Departamento</label>
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
                  </div>
                )}

                {/* Summary & Checkout Action */}
                <div className="cart-summary">
                  <div className="summary-row">
                    <span>Subtotal</span>
                    <span>${cartTotal.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="summary-row total">
                    <span>Total</span>
                    <span>${cartTotal.toLocaleString('es-AR')}</span>
                  </div>
                </div>

                <button type="submit" className="btn-cart-checkout" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span>Enviando pedido...</span>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      Confirmar Pedido
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
