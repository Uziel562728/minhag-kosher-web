import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import { useCart } from '../context/CartContext';
import { getCachedProduct, loadProductWithSWR, preloadProductImages } from '../lib/productCache';
import { getProductImage, hasRealProductImage } from '../utils/getProductImage';
import { Check, ShoppingCart } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import {
  allowsFreeQuantity,
  buildCartLineKey,
  calculateClosedPacks,
  calculateUnitAndPack,
  getLowestPresentationPrice,
  getReadableBreakdown,
  getValidPresentations,
  hasValidPresentations,
  onlyAllowsClosedPacks,
  resolveProductSlug,
} from '../utils/productPresentations';
import { getProductSectionLabel } from '../config/productSections';

export default function ProductDetail() {
  const { slug } = useParams();
  
  // Instant synchronous cache check (0ms latency - no loading flash)
  const [product, setProduct] = useState(() => getCachedProduct(slug) || getCachedProduct(resolveProductSlug(slug)));
  const [loading, setLoading] = useState(() => !(getCachedProduct(slug) || getCachedProduct(resolveProductSlug(slug))));
  const [notFound, setNotFound] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [totalUnits, setTotalUnits] = useState(1);
  const [packCount, setPackCount] = useState(1);
  const [selectedPresentationId, setSelectedPresentationId] = useState('');
  const { cart, addToCart, addConfiguredLine, updateQuantity } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();

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
    if (location.state?.fromCatalog && window.history.length > 1) {
      navigate(-1);
    } else if (location.state?.catalogRestore) {
      navigate('/', { replace: true, state: { catalogRestore: location.state.catalogRestore } });
    } else {
      navigate('/');
    }
  };

  useEffect(() => {
    setActiveImageIndex(0);
    setTotalUnits(1);
    setPackCount(1);
    setSelectedPresentationId('');

    let isMounted = true;

    const loadProduct = async () => {
      // Check if already in memory
      const resolvedSlug = resolveProductSlug(slug);
      const syncProduct = getCachedProduct(slug) || getCachedProduct(resolvedSlug);
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
        let { product: loadedProduct } = await loadProductWithSWR(
          slug,
          (backgroundUpdatedProduct) => {
            if (isMounted && backgroundUpdatedProduct) {
              setProduct(backgroundUpdatedProduct);
            }
          }
        );

        if (!loadedProduct && resolvedSlug !== slug) {
          const aliasResult = await loadProductWithSWR(resolvedSlug);
          loadedProduct = aliasResult.product;
        }

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
    const validPresentations = getValidPresentations(product);
    const hasPresentations = hasValidPresentations(product);
    const freeQuantity = allowsFreeQuantity(product);
    const closedPacks = onlyAllowsClosedPacks(product);
    const packPresentations = validPresentations.filter((presentation) => presentation.tipo === 'pack');
    const selectedPresentation = packPresentations.find((presentation) => presentation.id === selectedPresentationId) || packPresentations[0];
    const freeCalculation = freeQuantity ? calculateUnitAndPack(product, totalUnits) : null;
    const packCalculation = closedPacks ? calculateClosedPacks(selectedPresentation, packCount) : null;
    const packHasAdvantage = Boolean(freeCalculation?.pack && freeCalculation.pack.precio < freeCalculation.unit.precio * freeCalculation.pack.cantidad_unidades);
    const additionalImages = Array.isArray(product.imagenes_adicionales)
      ? product.imagenes_adicionales
      : [];
    const hasRealImg = hasRealProductImage(product);
    const gallery = hasRealImg
      ? [...new Set([product.imagen_principal, ...additionalImages].filter(Boolean))]
      : [getProductImage(product)];
    const hasMultipleImages = gallery.length > 1;
    const showPreviousImage = () => {
      setActiveImageIndex((current) => (current - 1 + gallery.length) % gallery.length);
    };
    const showNextImage = () => {
      setActiveImageIndex((current) => (current + 1) % gallery.length);
    };

    return (
      <article className="product-detail-card">
        <div className="product-detail-gallery" style={{ position: 'relative' }}>
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
                    decoding="async"
                    className={`product-carousel-image ${index === activeImageIndex ? 'active' : ''}`}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = getProductImage({});
                    }}
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
                {!hasRealImg && <span className="badge-illustrative">Imagen Ilustrativa</span>}
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
          {product.seccion && (
            <span className="product-detail-brand">
                {getProductSectionLabel(product.seccion, product.categories?.slug)}
            </span>
          )}
          <h1>{product.nombre}</h1>
          {product.categories?.nombre && (
            <span className="product-detail-category">{product.categories.nombre}</span>
          )}
          <div className="product-detail-prices">
            {!hasPresentations && product.precio_anterior > product.precio && (
              <span className="price-old">${Number(product.precio_anterior).toLocaleString('es-AR')}</span>
            )}
            <span className="price-current">{hasPresentations ? 'Desde ' : ''}${Number(hasPresentations ? getLowestPresentationPrice(product) : product.precio).toLocaleString('es-AR')}</span>
          </div>
          {product.descripcion && <p className="product-detail-description">{product.descripcion}</p>}
          {freeQuantity && freeCalculation && <section className="product-purchase-panel" aria-label="Configurar cantidad del producto">
            <div className="presentation-price-grid">{validPresentations.map((presentation) => {
              const isAdvantagePack = presentation.tipo === 'pack' && packHasAdvantage;
              return <div className={`presentation-price-card ${isAdvantagePack ? 'is-best-value' : ''}`} key={presentation.id}>
                <span className="presentation-price-label">{presentation.label}</span>
                <strong>${presentation.precio.toLocaleString('es-AR')}</strong>
                {isAdvantagePack && <small>Mejor precio por cantidad</small>}
              </div>;
            })}</div>

            <div className="purchase-section">
              <span className="purchase-section-title">Cantidad</span>
              <div className="quantity-control">
                <button type="button" disabled={totalUnits === 1} onClick={() => setTotalUnits((value) => Math.max(1, value - 1))} aria-label="Disminuir cantidad de unidades">−</button>
                <span className="quantity-value"><strong>{totalUnits}</strong> {totalUnits === 1 ? 'unidad' : 'unidades'}</span>
                <button type="button" onClick={() => setTotalUnits((value) => value + 1)} aria-label="Aumentar cantidad de unidades">+</button>
              </div>
            </div>

            <div className="purchase-summary">
              <h3>Resumen</h3>
              {freeCalculation.completePacks > 0 && <div className="purchase-summary-row"><span><b>{freeCalculation.pack.label}</b><small>{freeCalculation.completePacks} × ${freeCalculation.pack.precio.toLocaleString('es-AR')}</small></span><strong>${freeCalculation.packSubtotal.toLocaleString('es-AR')}</strong></div>}
              {freeCalculation.looseUnits > 0 && <div className="purchase-summary-row"><span><b>Unidades sueltas</b><small>{freeCalculation.looseUnits} × ${freeCalculation.unit.precio.toLocaleString('es-AR')}</small></span><strong>${freeCalculation.unitSubtotal.toLocaleString('es-AR')}</strong></div>}
              <div className="purchase-summary-total"><span>Total</span><strong>${freeCalculation.total.toLocaleString('es-AR')}</strong></div>
            </div>

            <motion.button whileTap={reduceMotion ? undefined : { scale: 0.985 }} transition={{ duration: reduceMotion ? 0 : 0.12 }} type="button" className="purchase-primary-button" disabled={!product.disponible} onClick={() => addConfiguredLine({
              lineKey: buildCartLineKey(product.id, 'free'), productId: product.id, nombre: product.nombre, product, mode: 'free', presentationId: 'free', presentationLabel: 'Cantidad libre', quantity: totalUnits,
              cantidadPacks: freeCalculation.completePacks, cantidadUnidadesSueltas: freeCalculation.looseUnits, cantidadUnidadesTotales: freeCalculation.totalUnits,
              precioUnitario: freeCalculation.unit.precio, precioPresentacion: freeCalculation.pack?.precio || null, packSize: freeCalculation.pack?.cantidad_unidades || null,
              subtotal: freeCalculation.total, breakdown: getReadableBreakdown(freeCalculation),
            })}><ShoppingCart size={20} aria-hidden="true" /><span>Agregar al carrito</span></motion.button>
            {totalUnits > 1 && <p className="purchase-add-note">Se agregarán {totalUnits} unidades</p>}
          </section>}

          {closedPacks && packCalculation && <section className="product-purchase-panel" aria-label="Elegir presentación y cantidad de packs">
            <div className="purchase-section"><span className="purchase-section-title">Elegí una presentación</span><div className="pack-presentation-grid">{packPresentations.map((presentation) => {
              const active = selectedPresentation.id === presentation.id;
              return <button type="button" key={presentation.id} className={`pack-presentation-option ${active ? 'is-selected' : ''}`} aria-pressed={active} onClick={() => { setSelectedPresentationId(presentation.id); setPackCount((value) => Math.max(1, value)); }}><span><b>{presentation.label}</b><strong>${presentation.precio.toLocaleString('es-AR')}</strong></span>{active && <Check size={20} aria-label="Seleccionada" />}</button>;
            })}</div></div>

            <div className="purchase-section"><span className="purchase-section-title">Cantidad de packs</span><div className="quantity-control">
              <button type="button" disabled={packCount === 1} onClick={() => setPackCount((value) => Math.max(1, value - 1))} aria-label="Disminuir cantidad de packs">−</button>
              <span className="quantity-value"><strong>{packCount}</strong> {packCount === 1 ? 'pack' : 'packs'}</span>
              <button type="button" onClick={() => setPackCount((value) => value + 1)} aria-label="Aumentar cantidad de packs">+</button>
            </div></div>

            <div className="purchase-summary"><h3>Resumen</h3><div className="purchase-summary-row"><span><b>{selectedPresentation.label}</b><small>{packCalculation.packCount} {packCalculation.packCount === 1 ? 'pack' : 'packs'} · {packCalculation.totalUnits} unidades</small></span><strong>${packCalculation.total.toLocaleString('es-AR')}</strong></div><div className="purchase-summary-total"><span>Total</span><strong>${packCalculation.total.toLocaleString('es-AR')}</strong></div></div>

            <motion.button whileTap={reduceMotion ? undefined : { scale: 0.985 }} transition={{ duration: reduceMotion ? 0 : 0.12 }} type="button" className="purchase-primary-button" disabled={!product.disponible} onClick={() => addConfiguredLine({
              lineKey: buildCartLineKey(product.id, selectedPresentation.id), productId: product.id, nombre: product.nombre, product, mode: 'packs', presentationId: selectedPresentation.id,
              presentationLabel: selectedPresentation.label, quantity: packCalculation.packCount, cantidadPacks: packCalculation.packCount,
              cantidadUnidadesTotales: packCalculation.totalUnits, cantidadUnidadesSueltas: 0, precioUnitario: null, precioPresentacion: selectedPresentation.precio,
              subtotal: packCalculation.total, breakdown: getReadableBreakdown(packCalculation),
            })}><ShoppingCart size={20} aria-hidden="true" /><span>Agregar al carrito</span></motion.button>
            {packCalculation.totalUnits > 1 && <p className="purchase-add-note">Se agregarán {packCalculation.totalUnits} unidades en packs cerrados</p>}
          </section>}

          {!hasPresentations && <div className="product-detail-action-container">
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
          }
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
