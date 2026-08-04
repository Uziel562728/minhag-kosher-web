import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import { useCart } from '../context/CartContext';
import { getCachedProduct, loadProductWithSWR, preloadProductImages } from '../lib/productCache';

export default function ProductDetail() {
  const { slug } = useParams();
  
  // Instant synchronous cache check (0ms latency - no loading flash)
  const [product, setProduct] = useState(() => getCachedProduct(slug));
  const [loading, setLoading] = useState(() => !getCachedProduct(slug));
  const [notFound, setNotFound] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const { cart, addToCart, updateQuantity } = useCart();
  const navigate = useNavigate();

  // Instant scroll position reset BEFORE paint (prevents any bottom-to-top scroll animation)
  useLayoutEffect(() => {
    const docEl = document.documentElement;
    const prevScrollBehavior = docEl.style.scrollBehavior;
    docEl.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    docEl.scrollTop = 0;

    const raf = requestAnimationFrame(() => {
      docEl.style.scrollBehavior = prevScrollBehavior || '';
    });
    return () => cancelAnimationFrame(raf);
  }, [slug]);

  const handleBack = (e) => {
    e.preventDefault();
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  useEffect(() => {
    setActiveImageIndex(0);

    let isMounted = true;

    const loadProduct = async () => {
      // Check if already in memory
      const syncProduct = getCachedProduct(slug);
      if (syncProduct) {
        if (isMounted) {
          setProduct(syncProduct);
          setLoading(false);
          setNotFound(false);
        }
      } else {
        if (isMounted) {
          setLoading(true);
          setNotFound(false);
        }
      }

      try {
        const { product: loadedProduct } = await loadProductWithSWR(
          slug,
          (backgroundUpdatedProduct) => {
            if (isMounted && backgroundUpdatedProduct) {
              setProduct(backgroundUpdatedProduct);
            }
          }
        );

        if (!isMounted) return;

        if (loadedProduct) {
          setProduct(loadedProduct);
          setNotFound(false);
          // Preload remaining gallery images if any
          if (Array.isArray(loadedProduct.imagenes_adicionales)) {
            loadedProduct.imagenes_adicionales.forEach((imgUrl) => {
              if (imgUrl) preloadProductImages({ imagen_principal: imgUrl });
            });
          }
        } else {
          setProduct(null);
          setNotFound(true);
        }
      } catch (err) {
        console.warn('[ProductDetail] Error loading product:', err);
        if (isMounted) {
          setProduct((prev) => {
            if (!prev) setNotFound(true);
            return prev;
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const pageContent = () => {
    if (loading) {
      return (
        <div className="product-detail-status">
          <div className="admin-spinner"></div>
          <p>Cargando producto...</p>
        </div>
      );
    }

    if (notFound) {
      return (
        <div className="product-detail-status product-not-found">
          <span className="not-found-code">404</span>
          <h1>Producto no encontrado</h1>
          <p>El producto no existe, no está disponible o cambió de dirección.</p>
          <Link to="/" className="btn btn-primary">Volver al catálogo</Link>
        </div>
      );
    }


    const cartItem = cart.find((item) => item.product.id === product.id);
    const quantity = cartItem ? cartItem.quantity : 0;
    const additionalImages = Array.isArray(product.imagenes_adicionales)
      ? product.imagenes_adicionales
      : [];
    const gallery = [...new Set([product.imagen_principal, ...additionalImages].filter(Boolean))];
    const hasMultipleImages = gallery.length > 1;
    const showPreviousImage = () => {
      setActiveImageIndex((current) => (current - 1 + gallery.length) % gallery.length);
    };
    const showNextImage = () => {
      setActiveImageIndex((current) => (current + 1) % gallery.length);
    };

    return (
      <article className="product-detail-card">
        <div className="product-detail-gallery">
          {gallery.length > 0 ? (
            <>
              <div className="product-carousel-stage">
                {hasMultipleImages && (
                  <button
                    type="button"
                    className="product-carousel-arrow product-carousel-arrow-left"
                    onClick={showPreviousImage}
                    aria-label="Ver imagen anterior"
                  >
                    ‹
                  </button>
                )}
                {gallery.map((image, index) => (
                  <img
                    key={`${image}-${index}`}
                    src={image}
                    alt={`${product.nombre} - imagen ${index + 1}`}
                    className={`product-carousel-image ${index === activeImageIndex ? 'active' : ''}`}
                  />
                ))}
                {hasMultipleImages && (
                  <button
                    type="button"
                    className="product-carousel-arrow product-carousel-arrow-right"
                    onClick={showNextImage}
                    aria-label="Ver imagen siguiente"
                  >
                    ›
                  </button>
                )}
              </div>
              {hasMultipleImages && (
                <div className="product-carousel-indicators" aria-label="Seleccionar imagen">
                  {gallery.map((image, index) => (
                    <button
                      key={`${image}-indicator`}
                      type="button"
                      className={`product-carousel-dot ${index === activeImageIndex ? 'active' : ''}`}
                      onClick={() => setActiveImageIndex(index)}
                      aria-label={`Mostrar imagen ${index + 1}`}
                      aria-current={index === activeImageIndex ? 'true' : undefined}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="product-detail-no-image">Sin imagen</div>
          )}
        </div>

        <div className="product-detail-info">
          <a href="/" onClick={handleBack} className="product-detail-back">← Volver al catálogo</a>
          <div className="product-detail-tags">
            {product.oferta && <span className="badge-offer">🔥 OFERTA</span>}
            <span className={`detail-stock ${product.disponible ? 'available' : 'unavailable'}`}>
              {product.disponible ? 'Disponible' : 'Sin stock'}
            </span>
          </div>
          {product.marca && <span className="product-detail-brand">{product.marca}</span>}
          <h1>{product.nombre}</h1>
          {product.categories?.nombre && (
            <span className="product-detail-category">{product.categories.nombre}</span>
          )}
          <div className="product-detail-prices">
            {product.precio_anterior > product.precio && (
              <span className="price-old">${Number(product.precio_anterior).toLocaleString('es-AR')}</span>
            )}
            <span className="price-current">${Number(product.precio).toLocaleString('es-AR')}</span>
          </div>
          {product.descripcion && <p className="product-detail-description">{product.descripcion}</p>}
          {/* Action Button / Quantity Selector */}
          <div className="product-detail-action-container">
            <button
              type="button"
              className={`btn btn-primary btn-large btn-detail-add-cart ${quantity > 0 ? 'inactive' : 'active'}`}
              disabled={!product.disponible}
              onClick={() => {
                if (product.disponible) {
                  addToCart(product);
                }
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              Agregar al Carrito
            </button>

            {product.disponible && (
              <div className={`detail-qty-selector ${quantity > 0 ? 'active' : 'inactive'}`}>
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
      </article>
    );
  };

  return (
    <div className="app-container product-detail-page">
      <Header />
      <main className="product-detail-main">{pageContent()}</main>
      <Footer />
    </div>
  );
}
