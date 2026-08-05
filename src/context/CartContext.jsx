import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildCartLineKey } from '../utils/productPresentations';
import { fetchActivePromotions } from '../services/promotionService';
import { resolveCartLineTotals } from '../utils/promotionResolver';

const CartContext = createContext();
const CART_STORAGE_KEY = 'minhag_cart_v2';
const LEGACY_CART_STORAGE_KEY = 'sm_cart';

const normalizeTraditionalLine = (item) => {
  if (!item?.product?.id || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) return null;
  return {
    ...item,
    productId: item.product.id,
    nombre: item.product.nombre,
    lineKey: buildCartLineKey(item.product.id),
    mode: 'traditional',
    quantity: Number(item.quantity),
  };
};

const loadStoredCart = () => {
  try {
    const current = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || 'null');
    if (Array.isArray(current)) return { cart: current, removed: 0, notice: '' };
    const legacy = JSON.parse(localStorage.getItem(LEGACY_CART_STORAGE_KEY) || '[]');
    if (!Array.isArray(legacy)) return { cart: [], removed: 0, notice: '' };
    const migrated = legacy.map(normalizeTraditionalLine).filter(Boolean);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(migrated));
    localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
    return { cart: migrated, removed: legacy.length - migrated.length, notice: '' };
  } catch {
    return { cart: [], removed: 0, notice: 'No se pudo recuperar el carrito anterior porque sus datos eran incompatibles.' };
  }
};

export function CartProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [initialCart] = useState(loadStoredCart);
  const [cart, setCart] = useState(initialCart.cart);
  const [migrationNotice, setMigrationNotice] = useState(() => initialCart.notice || (initialCart.removed > 0
    ? `Se quitaron ${initialCart.removed} artículo(s) antiguos incompatibles del carrito.`
    : ''));

  // Campaigns & Promotions State loaded globally
  const [promotions, setPromotions] = useState([]);
  const [campaigns, setCampaigns] = useState([]); // All campaigns (popup + promocion)
  const [relations, setRelations] = useState([]);
  const [promotionsLoading, setPromotionsLoading] = useState(true);
  const [cartNotification, setCartNotification] = useState('');

  // Refs to avoid concurrent queries and access latest values
  const isRefreshing = useRef(false);
  const cartRef = useRef(cart);
  const promotionsRef = useRef(promotions);
  const relationsRef = useRef(relations);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    promotionsRef.current = promotions;
  }, [promotions]);

  useEffect(() => {
    relationsRef.current = relations;
  }, [relations]);

  // Centralized Refresh Function
  const refreshActivePromotions = useCallback(async (isSilent = false) => {
    if (isRefreshing.current) {
      return { promotions: promotionsRef.current, relations: relationsRef.current };
    }
    isRefreshing.current = true;

    if (!isSilent) {
      setPromotionsLoading(true);
    }

    let result = { promotions: promotionsRef.current, relations: relationsRef.current };

    try {
      // Force refresh without cache
      const data = await fetchActivePromotions(true);
      
      const newPromos = data.promotions || [];
      const newCampaigns = data.campaigns || [];
      const newRels = data.relations || [];

      // Calculate totals to see if promotions changed prices for cart items
      const currentCart = cartRef.current;
      if (currentCart.length > 0) {
        const totalOld = currentCart.reduce((total, item) => {
          const totals = resolveCartLineTotals(item, promotionsRef.current, relationsRef.current);
          return total + totals.promoSubtotal;
        }, 0);

        const totalNew = currentCart.reduce((total, item) => {
          const totals = resolveCartLineTotals(item, newPromos, newRels);
          return total + totals.promoSubtotal;
        }, 0);

        if (totalNew > totalOld) {
          setCartNotification("Una promoción terminó y el total del carrito fue actualizado.");
          // Auto clear notification after 8 seconds
          setTimeout(() => setCartNotification(''), 8000);
        } else if (totalNew < totalOld) {
          setCartNotification("Se aplicó una nueva promoción a tu carrito.");
          setTimeout(() => setCartNotification(''), 8000);
        }
      }

      setPromotions(newPromos);
      setCampaigns(newCampaigns);
      setRelations(newRels);
      result = { promotions: newPromos, relations: newRels };
    } catch (err) {
      console.warn('Error refreshing campaigns and promotions:', err);
      // Keep existing states on query failure (fail-safe)
    } finally {
      setPromotionsLoading(false);
      isRefreshing.current = false;
    }

    return result;
  }, []);

  // Initial load
  useEffect(() => {
    refreshActivePromotions(false);
  }, [refreshActivePromotions]);

  // Polling (every 15 seconds) & Visibility/Focus Listeners
  useEffect(() => {
    const interval = setInterval(() => {
      refreshActivePromotions(true);
    }, 15000);

    const handleInteraction = () => {
      if (document.visibilityState === 'visible') {
        refreshActivePromotions(true);
      }
    };

    document.addEventListener('visibilitychange', handleInteraction);
    window.addEventListener('focus', handleInteraction);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleInteraction);
      window.removeEventListener('focus', handleInteraction);
    };
  }, [refreshActivePromotions]);

  const isCartOpen = location.hash === '#cart';

  const setIsCartOpen = (open) => {
    if (open) {
      if (location.hash !== '#cart') {
        navigate('#cart');
      }
    } else {
      if (location.hash === '#cart') {
        navigate(-1);
      }
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // The in-memory cart remains usable when storage is restricted.
    }
  }, [cart]);

  const addToCart = (product, quantity = 1) => {
    const lineKey = buildCartLineKey(product.id);
    setCart((prev) => {
      const existing = prev.find((item) => item.lineKey === lineKey || (!item.lineKey && item.product.id === product.id));
      if (existing) {
        return prev.map((item) =>
          (item.lineKey === lineKey || (!item.lineKey && item.product.id === product.id))
            ? { ...item, lineKey, mode: 'traditional', quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { productId: product.id, nombre: product.nombre, product, quantity, lineKey, mode: 'traditional' }];
    });
  };

  const addConfiguredLine = (line) => {
    if (!line?.lineKey || !line.product) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.lineKey === line.lineKey);
      if (!existing) return [...prev, line];
      return prev.map((item) => item.lineKey === line.lineKey ? line : item);
    });
  };

  const removeFromCart = (identifier) => {
    setCart((prev) => prev.filter((item) => item.lineKey !== identifier && item.product.id !== identifier));
  };

  const updateQuantity = (identifier, quantity) => {
    if (quantity <= 0) {
      removeFromCart(identifier);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        (item.lineKey === identifier || (item.mode === 'traditional' && item.product.id === identifier))
          ? { ...item, quantity }
          : item
      )
    );
  };

  const updateConfiguredLine = (lineKey, updater) => {
    setCart((prev) => prev.map((item) => item.lineKey === lineKey ? updater(item) : item));
  };

  const clearCart = () => {
    setCart([]);
  };

  const addItemsToCart = (items, mode = 'add') => {
    setCart((currentCart) => {
      const nextCart = mode === 'replace' ? [] : [...currentCart];
      items.forEach(({ product, quantity, cartLine }) => {
        if (cartLine) {
          const configuredIndex = nextCart.findIndex((item) => item.lineKey === cartLine.lineKey);
          if (configuredIndex >= 0) nextCart[configuredIndex] = cartLine;
          else nextCart.push(cartLine);
          return;
        }
        const lineKey = buildCartLineKey(product.id);
        const index = nextCart.findIndex((item) => item.lineKey === lineKey || (item.mode === 'traditional' && item.product.id === product.id));
        if (index >= 0) nextCart[index] = { ...nextCart[index], quantity: nextCart[index].quantity + quantity };
        else nextCart.push({ productId: product.id, nombre: product.nombre, product, quantity, lineKey, mode: 'traditional' });
      });
      return nextCart;
    });
  };

  const cartCount = cart.reduce((total, item) => total + (item.cantidadUnidadesTotales || item.quantity || 0), 0);
  
  // Dynamic calculation using active promotions
  const cartTotal = cart.reduce((total, item) => {
    const lineTotals = resolveCartLineTotals(item, promotions, relations);
    return total + lineTotals.promoSubtotal;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        addConfiguredLine,
        removeFromCart,
        updateQuantity,
        updateConfiguredLine,
        clearCart,
        addItemsToCart,
        cartCount,
        cartTotal,
        isCartOpen,
        setIsCartOpen,
        migrationNotice,
        clearMigrationNotice: () => setMigrationNotice(''),
        promotions,
        campaigns,
        relations,
        promotionsLoading,
        cartNotification,
        clearCartNotification: () => setCartNotification(''),
        refreshActivePromotions
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
