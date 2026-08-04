export const CATALOG_STATE_KEY = 'minhag_catalog_state_v1';

const sanitize = (state) => {
  if (!state || typeof state !== 'object') return null;
  return {
    categorySlug: typeof state.categorySlug === 'string' ? state.categorySlug : 'all',
    section: typeof state.section === 'string' ? state.section : 'all',
    search: typeof state.search === 'string' ? state.search : '',
    productSlug: typeof state.productSlug === 'string' ? state.productSlug : '',
    productId: state.productId ?? null,
    scrollY: Number.isFinite(Number(state.scrollY)) ? Number(state.scrollY) : 0,
    savedAt: typeof state.savedAt === 'string' ? state.savedAt : new Date().toISOString(),
  };
};

export function saveCatalogState(state) {
  const cleanState = sanitize({ ...state, savedAt: new Date().toISOString() });
  try {
    sessionStorage.setItem(CATALOG_STATE_KEY, JSON.stringify(cleanState));
  } catch {
    // Navigation must continue even when sessionStorage is unavailable.
  }
  return cleanState;
}

export function getCatalogState(routerState) {
  const fromRouter = sanitize(routerState?.catalogRestore || routerState);
  if (fromRouter?.productSlug || fromRouter?.productId) return fromRouter;
  try {
    return sanitize(JSON.parse(sessionStorage.getItem(CATALOG_STATE_KEY) || 'null'));
  } catch {
    return null;
  }
}

export function clearCatalogState() {
  try {
    sessionStorage.removeItem(CATALOG_STATE_KEY);
  } catch {
    // Ignore restricted storage errors.
  }
}
