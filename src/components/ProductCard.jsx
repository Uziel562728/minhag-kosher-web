import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useProductCardPreload } from '../lib/useProductVisibilityObserver';

export default function ProductCard({ product, categories = [] }) {
  const navigate = useNavigate();
  const { cart, addToCart, updateQuantity } = useCart();
  const { cardRef, handleMouseEnter, handlePointerDown } = useProductCardPreload(product, categories);
  const cartItem = cart.find((item) => item.product.id === product.id);
  const quantity = cartItem ? cartItem.quantity : 0;
  const {
    nombre,
    precio,
    precio_anterior,
    imagen_principal,
    categoria_id,
    marca,
    descripcion,
    oferta,
    disponible
  } = product;

  const openProduct = () => {
    if (product.slug) {
      sessionStorage.setItem('last_viewed_product_id', product.id);
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      navigate(`/${product.slug}`);
    }
  };

  // Find category name
  const categoryInfo = categories.find(c => c.id === categoria_id);
  const categoryLabel = categoryInfo ? categoryInfo.nombre : 'Sin categoría';

  // Calculate discount percentage if previous price exists
  const discount = precio_anterior && precio_anterior > precio
    ? Math.round(((precio_anterior - precio) / precio_anterior) * 100)
    : 0;

  return (
    <div
      ref={cardRef}
      id={`product-card-${product.id}`}
      className={`product-card ${product.slug ? 'product-card-clickable' : ''} ${oferta ? 'product-on-sale' : ''} ${!disponible ? 'product-out-of-stock' : ''}`}
      onClick={openProduct}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handlePointerDown}
      onPointerDown={handlePointerDown}
      onKeyDown={(e) => {
        if (product.slug && (e.key === 'Enter' || e.key === ' ')) openProduct();
      }}
      role={product.slug ? 'link' : undefined}
      tabIndex={product.slug ? 0 : undefined}
    >
      {/* Badges */}
      <div className="product-badges">
        {oferta && <span className="badge-offer">🔥 OFERTA</span>}
        {discount > 0 && <span className="badge-discount">-{discount}%</span>}
        {!disponible && <span className="badge-stock">Sin Stock</span>}
      </div>

      {/* Image */}
      <div className="product-image-container">
        <img
          src={imagen_principal || 'https://via.placeholder.com/300?text=Producto'}
          alt={nombre}
          loading="lazy"
          className="product-image"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80'; // fallback grocery image
          }}
        />
      </div>

      {/* Content */}
      <div className="product-info">
        <div className="product-meta">
          <span className="product-brand">{marca || 'Genérico'}</span>
          <span className="product-category-tag">{categoryLabel}</span>
        </div>
        <h3 className="product-name" title={nombre}>{nombre}</h3>
        {descripcion && <p className="product-description">{descripcion}</p>}
        
        {/* Prices */}
        <div className="product-price-section">
          {precio_anterior && precio_anterior > precio && (
            <span className="price-old">${precio_anterior.toLocaleString('es-AR')}</span>
          )}
          <span className="price-current">${precio.toLocaleString('es-AR')}</span>
        </div>

        {/* Action Button / Quantity Selector */}
        <div className="product-card-action-container" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`btn-product-add-cart ${!disponible ? 'disabled' : ''} ${quantity > 0 ? 'inactive' : 'active'}`}
            disabled={!disponible}
            onClick={() => {
              if (disponible) {
                addToCart(product);
              }
            }}
          >
            <svg className="cart-btn-icon-svg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            <span className="cart-label-full">{disponible ? 'Agregar al Carrito' : 'Sin Stock'}</span>
            <span className="cart-label-mobile">{disponible ? 'Agregar' : 'Sin Stock'}</span>
          </button>

          {disponible && (
            <div className={`card-qty-selector ${quantity > 0 ? 'active' : 'inactive'}`}>
              <button
                type="button"
                className="qty-btn"
                onClick={() => updateQuantity(product.id, quantity - 1)}
                aria-label="Disminuir cantidad"
              >
                -
              </button>
              <span className="qty-val">{quantity}</span>
              <button
                type="button"
                className="qty-btn"
                onClick={() => updateQuantity(product.id, quantity + 1)}
                aria-label="Aumentar cantidad"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
