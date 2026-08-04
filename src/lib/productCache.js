import { supabase } from '../supabaseClient';

// ==========================================
// 1. IN-MEMORY CACHE (L1 - 0ms instant access)
// ==========================================
const memoryProductById = new Map(); // id -> { data, timestamp }
const memoryProductBySlug = new Map(); // slug -> id
let memoryCatalog = null; // { products: [], categories: [], timestamp: 0 }

// In-flight fetch deduplication Map (key -> Promise)
const inFlightFetches = new Map();

// Preloaded image URLs Set (prevents duplicate Image downloads)
const preloadedImageUrls = new Set();
const inFlightImageLoads = new Map();

// Default Cache TTL: 5 minutes for freshness, but stale data is served instantly (SWR)
const CACHE_TTL_MS = 5 * 60 * 1000;

// ==========================================
// 2. INDEXEDDB PERSISTENCE (L2 Cache)
// ==========================================
const DB_NAME = 'SupermarketKosherCacheDB';
const DB_VERSION = 1;
const STORE_PRODUCTS = 'products';
const STORE_CATALOG = 'catalog';

let dbPromise = null;

function getDB() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
            const productStore = db.createObjectStore(STORE_PRODUCTS, { keyPath: 'id' });
            productStore.createIndex('slug', 'slug', { unique: false });
          }
          if (!db.objectStoreNames.contains(STORE_CATALOG)) {
            db.createObjectStore(STORE_CATALOG, { keyPath: 'key' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = (err) => {
          console.warn('[Cache] IndexedDB open error:', err);
          resolve(null);
        };
      } catch (err) {
        console.warn('[Cache] IndexedDB not supported or accessible:', err);
        resolve(null);
      }
    });
  }
  return dbPromise;
}

async function idbGet(storeName, key) {
  try {
    const db = await getDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbGetByIndex(storeName, indexName, key) {
  try {
    const db = await getDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbSet(storeName, value) {
  try {
    const db = await getDB();
    if (!db) return;
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(value);
  } catch (err) {
    console.warn('[Cache] IndexedDB put error:', err);
  }
}

async function idbClear() {
  try {
    const db = await getDB();
    if (!db) return;
    const tx = db.transaction([STORE_PRODUCTS, STORE_CATALOG], 'readwrite');
    tx.objectStore(STORE_PRODUCTS).clear();
    tx.objectStore(STORE_CATALOG).clear();
  } catch (err) {
    console.warn('[Cache] IndexedDB clear error:', err);
  }
}

// Populate memory cache from IndexedDB on startup
if (typeof window !== 'undefined') {
  (async () => {
    try {
      const cachedCat = await idbGet(STORE_CATALOG, 'main_catalog');
      if (cachedCat && cachedCat.products && cachedCat.categories) {
        if (!memoryCatalog) {
          memoryCatalog = {
            products: cachedCat.products,
            categories: cachedCat.categories,
            timestamp: cachedCat.timestamp || Date.now()
          };
          for (const prod of cachedCat.products) {
            if (prod && prod.id) {
              const cat = cachedCat.categories.find(c => c.id === prod.categoria_id);
              const formatted = {
                ...prod,
                categories: cat ? { nombre: cat.nombre } : (prod.categories || null)
              };
              memoryProductById.set(prod.id, { data: formatted, timestamp: cachedCat.timestamp || Date.now() });
              if (prod.slug) {
                memoryProductBySlug.set(prod.slug, prod.id);
              }
            }
          }
        }
      }
    } catch {
      // Ignore background startup hydration errors
    }
  })();
}

// ==========================================
// 3. IMAGE PRELOADER (Uses HTTP Cache)
// ==========================================
export const preloadImage = (url) => {
  if (!url || typeof url !== 'string' || preloadedImageUrls.has(url)) {
    return Promise.resolve(url || null);
  }

  if (inFlightImageLoads.has(url)) {
    return inFlightImageLoads.get(url);
  }

  const promise = new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      preloadedImageUrls.add(url);
      inFlightImageLoads.delete(url);
      resolve(url);
    };
    img.onerror = () => {
      inFlightImageLoads.delete(url);
      resolve(null);
    };
    img.src = url;
  });

  inFlightImageLoads.set(url, promise);
  return promise;
};

export const preloadProductImages = (product) => {
  if (!product) return;

  // 1. First image (imagen_principal)
  if (product.imagen_principal) {
    preloadImage(product.imagen_principal);
  }

  // 2. Second image if exists (first item of imagenes_adicionales or second gallery item)
  if (Array.isArray(product.imagenes_adicionales) && product.imagenes_adicionales.length > 0) {
    const secondImg = product.imagenes_adicionales[0];
    if (secondImg && secondImg !== product.imagen_principal) {
      preloadImage(secondImg);
    }
  }
};

// ==========================================
// 4. PRODUCT CACHE & PRELOADER ENGINE
// ==========================================

// Format and store product in memory & IndexedDB
export const storeProductInCache = (product, categories = null) => {
  if (!product || !product.id) return null;

  let categoryData = product.categories;
  if (!categoryData && categories && Array.isArray(categories)) {
    const matched = categories.find(c => c.id === product.categoria_id);
    if (matched) {
      categoryData = { nombre: matched.nombre };
    }
  }

  const normalized = {
    ...product,
    categories: categoryData || (product.categories || null)
  };

  const entry = {
    data: normalized,
    timestamp: Date.now()
  };

  memoryProductById.set(normalized.id, entry);
  if (normalized.slug) {
    memoryProductBySlug.set(normalized.slug, normalized.id);
  }

  // Persist to IndexedDB asynchronously
  idbSet(STORE_PRODUCTS, entry);

  // Preload primary and secondary images
  preloadProductImages(normalized);

  return normalized;
};

// Synchronous fast-read for instant page transition (0ms latency)
export const getCachedProduct = (idOrSlug) => {
  if (!idOrSlug) return null;

  // 1. By ID
  if (memoryProductById.has(idOrSlug)) {
    return memoryProductById.get(idOrSlug).data;
  }

  // 2. By Slug
  if (memoryProductBySlug.has(idOrSlug)) {
    const id = memoryProductBySlug.get(idOrSlug);
    if (memoryProductById.has(id)) {
      return memoryProductById.get(id).data;
    }
  }

  // 3. Fallback check in memory catalog
  if (memoryCatalog && Array.isArray(memoryCatalog.products)) {
    const found = memoryCatalog.products.find(p => p.id === idOrSlug || p.slug === idOrSlug);
    if (found) {
      return storeProductInCache(found, memoryCatalog.categories);
    }
  }

  return null;
};

// Async getter checking memory -> IndexedDB
export const getProductFromStorage = async (idOrSlug) => {
  const mem = getCachedProduct(idOrSlug);
  if (mem) return mem;

  // Try IndexedDB by ID
  const dbItemById = await idbGet(STORE_PRODUCTS, idOrSlug);
  if (dbItemById && dbItemById.data) {
    storeProductInCache(dbItemById.data);
    return dbItemById.data;
  }

  // Try IndexedDB by Slug
  const dbItemBySlug = await idbGetByIndex(STORE_PRODUCTS, 'slug', idOrSlug);
  if (dbItemBySlug && dbItemBySlug.data) {
    storeProductInCache(dbItemBySlug.data);
    return dbItemBySlug.data;
  }

  return null;
};

// Fetch product with full deduplication
export const fetchProductData = async (idOrSlug) => {
  if (!idOrSlug) return null;

  const dedupKey = `fetch_${idOrSlug}`;
  if (inFlightFetches.has(dedupKey)) {
    return inFlightFetches.get(dedupKey);
  }

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

  const fetchPromise = (async () => {
    try {
      let query = supabase
        .from('products')
        .select('*, categories(nombre)')
        .eq('disponible', true);

      if (isUUID) {
        query = query.eq('id', idOrSlug);
      } else {
        query = query.eq('slug', idOrSlug);
      }

      const { data, error } = await query.maybeSingle();

      if (error || !data) {
        if (error) console.warn('[Preload] Error fetching product from Supabase:', error);
        return null;
      }

      const stored = storeProductInCache(data);
      return stored;
    } catch (err) {
      console.warn('[Preload] Exception fetching product:', err);
      return null;
    } finally {
      inFlightFetches.delete(dedupKey);
    }
  })();

  inFlightFetches.set(dedupKey, fetchPromise);
  return fetchPromise;
};

/**
 * Intelligent background preload for a product:
 * - If product object is passed: caches it immediately & preloads images without DB query.
 * - If only ID or slug is passed: retrieves/fetches and preloads images.
 * - Deduplicates network requests and image downloads.
 */
export const preloadProduct = (productOrIdOrSlug, options = {}) => {
  if (!productOrIdOrSlug) return;

  // Scenario A: Product object already available from list / state
  if (typeof productOrIdOrSlug === 'object' && productOrIdOrSlug.id) {
    const cached = storeProductInCache(productOrIdOrSlug, options.categories);
    // If background verification requested or missing additional details
    if (options.forceRevalidate) {
      fetchProductData(productOrIdOrSlug.slug || productOrIdOrSlug.id);
    }
    return cached;
  }

  // Scenario B: ID or Slug string passed
  const idOrSlug = String(productOrIdOrSlug);
  const existing = getCachedProduct(idOrSlug);
  if (existing) {
    preloadProductImages(existing);
    return existing;
  }

  // If not yet in memory or in flight, fetch in background
  return fetchProductData(idOrSlug);
};

/**
 * SWR (Stale-While-Revalidate) loader for ProductDetail page:
 * 1. Synchronously returns cached product if available (0ms paint).
 * 2. Asynchronously revalidates stock/price in background and notifies via callback.
 * 3. If not cached, fetches from DB.
 */
export const loadProductWithSWR = async (slugOrId, onBackgroundUpdate = null) => {
  // 1. Check L1 Memory cache
  let product = getCachedProduct(slugOrId);

  // 2. Check L2 IndexedDB if not in memory
  if (!product) {
    product = await getProductFromStorage(slugOrId);
  }

  if (product) {
    // Ensure images are preloaded/cached
    preloadProductImages(product);

    // Check entry timestamp for background revalidation
    const id = product.id;
    const entry = memoryProductById.get(id);
    const isStale = !entry || (Date.now() - entry.timestamp > CACHE_TTL_MS);

    // Silent background revalidation for updated stock, price, or details
    if (isStale || onBackgroundUpdate) {
      fetchProductData(product.slug || product.id).then((freshData) => {
        if (freshData && onBackgroundUpdate) {
          const hasChanged = 
            freshData.precio !== product.precio ||
            freshData.precio_anterior !== product.precio_anterior ||
            freshData.disponible !== product.disponible ||
            JSON.stringify(freshData.imagenes_adicionales) !== JSON.stringify(product.imagenes_adicionales);

          if (hasChanged) {
            onBackgroundUpdate(freshData);
          }
        }
      }).catch(() => {});
    }

    return { product, isCached: true };
  }

  // 3. Not in cache: perform network fetch
  const fetched = await fetchProductData(slugOrId);
  return { product: fetched, isCached: false };
};

// ==========================================
// 5. CATALOG CACHE (Backwards-compatible)
// ==========================================
export const getCachedCatalog = () => {
  if (memoryCatalog && memoryCatalog.products && memoryCatalog.categories) {
    return { products: memoryCatalog.products, categories: memoryCatalog.categories };
  }
  return null;
};

export const setCachedCatalog = (products, categories) => {
  const timestamp = Date.now();
  memoryCatalog = { products, categories, timestamp };

  // Index each product in memory and preload
  if (Array.isArray(products)) {
    for (const prod of products) {
      if (prod && prod.id) {
        storeProductInCache(prod, categories);
      }
    }
  }

  // Persist to IndexedDB
  idbSet(STORE_CATALOG, {
    key: 'main_catalog',
    products,
    categories,
    timestamp
  });
};

export const clearCachedCatalog = () => {
  memoryCatalog = null;
  memoryProductById.clear();
  memoryProductBySlug.clear();
  idbClear();
};
