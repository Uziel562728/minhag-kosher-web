import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { categories as staticCategories } from '../data/categories';
import ProductCard from './ProductCard';
import ProductSearch from './ProductSearch';
import ProductFilters from './ProductFilters';
import { getCachedCatalog, setCachedCatalog } from '../lib/catalogCache';
import { clearCatalogState, getCatalogState } from '../utils/catalogNavigationState';
import { categoryHasProductSections, getProductSectionOptions, normalizeProductSection } from '../config/productSections';

export default function ProductGrid({ 
  selectedCategory, 
  onSelectCategory, 
  searchQuery, 
  onSearchChange,
  navigationState,
}) {
  const initialCache = getCachedCatalog();
  const [productsList, setProductsList] = useState(() => initialCache ? initialCache.products : []);
  const [categoriesList, setCategoriesList] = useState(() => initialCache ? initialCache.categories : []);
  const [loading, setLoading] = useState(() => !initialCache);
  const [onlyOffers, setOnlyOffers] = useState(false);
  const [sortBy, setSortBy] = useState('default');
  const [pendingRestore, setPendingRestore] = useState(() => getCatalogState(navigationState));
  const [restoreTargetId, setRestoreTargetId] = useState(null);
  const [restoreNotice, setRestoreNotice] = useState('');

  useEffect(() => {
    async function loadCatalog() {
      // Check cache first
      const cached = getCachedCatalog();
      if (cached && cached.products?.length > 0) {
        setProductsList(cached.products);
        setCategoriesList(cached.categories);
        setLoading(false);
        return;
      }

      try {
        // 1. Fetch active categories from Supabase
        const { data: catData, error: catError } = await supabase
          .from('categories')
          .select('*')
          .eq('activa', true)
          .order('orden', { ascending: true });

        if (catError) throw catError;

        // 2. Fetch available products from Supabase
        const { data: prodData, error: prodError } = await supabase
          .from('products')
          .select('*')
          .eq('disponible', true)
          .order('orden', { ascending: true });

        if (prodError) throw prodError;

        const finalCategories = (catData && catData.length > 0) ? catData : staticCategories;
        const finalProducts = prodData || [];

        // Save to cache
        setCachedCatalog(finalProducts, finalCategories);

        setCategoriesList(finalCategories);
        setProductsList(finalProducts);
      } catch (err) {
        console.warn('Supabase catalog loading failed:', err);
        setCategoriesList(staticCategories);
        setProductsList([]);
      } finally {
        setLoading(false);
      }
    }

    loadCatalog();
  }, []);

  const [selectedSection, setSelectedSection] = useState('all');

  useEffect(() => {
    const handleSelectSec = (e) => {
      setSelectedSection(e.detail);
    };
    window.addEventListener('minhag-select-section', handleSelectSec);
    return () => window.removeEventListener('minhag-select-section', handleSelectSec);
  }, []);

  useEffect(() => {
    if (loading || !pendingRestore || categoriesList.length === 0) return;
    const restoredCategory = pendingRestore.categorySlug === 'all'
      ? 'all'
      : categoriesList.find((category) => category.slug === pendingRestore.categorySlug)?.id;
    onSelectCategory(restoredCategory || 'all');
    setSelectedSection(pendingRestore.section || 'all');
    onSearchChange(pendingRestore.search || '');
  }, [loading, pendingRestore, categoriesList, onSelectCategory, onSearchChange]);

  const activeCategory = useMemo(() => {
    return categoriesList.find(c => c.id === selectedCategory);
  }, [categoriesList, selectedCategory]);

  const showSectionFilter = activeCategory && categoryHasProductSections(activeCategory.slug);
  const sectionOptions = activeCategory
    ? [{ value: 'all', label: 'Todos' }, ...getProductSectionOptions(activeCategory.slug)]
    : [];

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...productsList];

    // Filter by Category
    if (selectedCategory !== 'all') {
      result = result.filter(p => p.categoria_id === selectedCategory);
    }

    // Filter by Section
    if (selectedSection !== 'all') {
      result = result.filter(p => normalizeProductSection(p.seccion) === selectedSection);
    }

    // Filter by Search Query
    if (searchQuery.trim() !== '') {
      const normalize = (str) => {
        if (!str) return '';
        return str
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, ""); // removes accents/tildes
      };

      const query = normalize(searchQuery).trim();
      result = result.filter(p => 
        normalize(p.nombre).includes(query) || 
        (p.descripcion && normalize(p.descripcion).includes(query))
      );
    }

    // Filter by Offers
    if (onlyOffers) {
      result = result.filter(p => p.oferta === true);
    }

    // Sorting Logic
    if (sortBy === 'price-asc') {
      result.sort((a, b) => a.precio - b.precio);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.precio - a.precio);
    } else if (sortBy === 'name-asc') {
      result.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } else {
      // Default sorting: Destacados first, then by orden
      result.sort((a, b) => {
        if (a.destacado && !b.destacado) return -1;
        if (!a.destacado && b.destacado) return 1;
        return a.orden - b.orden;
      });
    }

    return result;
  }, [productsList, selectedCategory, selectedSection, searchQuery, onlyOffers, sortBy]);

  useEffect(() => {
    if (loading || !pendingRestore) return undefined;
    const expectedCategoryId = pendingRestore.categorySlug === 'all'
      ? 'all'
      : categoriesList.find((category) => category.slug === pendingRestore.categorySlug)?.id || 'all';
    if (selectedCategory !== expectedCategoryId || selectedSection !== (pendingRestore.section || 'all') || searchQuery !== (pendingRestore.search || '')) return undefined;

    let firstFrame;
    let secondFrame;
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const targetProduct = filteredProducts.find((product) =>
          (pendingRestore.productId != null && String(product.id) === String(pendingRestore.productId)) ||
          product.slug === pendingRestore.productSlug
        );
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const headerHeight = document.querySelector('header')?.getBoundingClientRect().height || 80;

        if (targetProduct) {
          const element = document.getElementById(`product-card-${targetProduct.id}`);
          if (element) {
            setRestoreTargetId(targetProduct.id);
            const targetTop = reduceMotion
              ? pendingRestore.scrollY
              : element.getBoundingClientRect().top + window.scrollY - headerHeight - 24;
            window.scrollTo({ top: Math.max(0, targetTop), behavior: reduceMotion ? 'auto' : 'smooth' });
          }
        } else {
          const grid = document.querySelector('.product-grid') || document.getElementById('catalog');
          const top = grid ? grid.getBoundingClientRect().top + window.scrollY - headerHeight - 20 : pendingRestore.scrollY;
          window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
          setRestoreNotice('El producto ya no está disponible en esta sección.');
        }

        clearCatalogState();
        setPendingRestore(null);
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [loading, pendingRestore, categoriesList, selectedCategory, selectedSection, searchQuery, filteredProducts]);

  useEffect(() => {
    if (restoreTargetId == null) return undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setRestoreTargetId(null), reduceMotion ? 0 : 1100);
    return () => window.clearTimeout(timer);
  }, [restoreTargetId]);

  useEffect(() => {
    if (!restoreNotice) return undefined;
    const timer = window.setTimeout(() => setRestoreNotice(''), 4500);
    return () => window.clearTimeout(timer);
  }, [restoreNotice]);

  const handleCategorySelect = (categoryId) => {
    setSelectedSection('all');
    onSelectCategory(categoryId);
  };

  const handleResetFilters = () => {
    handleCategorySelect('all');
    onSearchChange('');
    setSelectedSection('all');
    setOnlyOffers(false);
    setSortBy('default');
  };

  if (loading) {
    return (
      <section id="catalog" className="catalog-section">
        <div className="section-header">
          <span className="section-subtitle">Nuestra Tienda</span>
          <h2 className="section-title">Catálogo de Productos</h2>
          <div className="section-divider"></div>
        </div>
        <div className="catalog-loading-inner">
          <div className="admin-spinner"></div>
          <p>Cargando catálogo...</p>
        </div>
      </section>
    );
  }

  return (
    <section id="catalog" className="catalog-section">
      {restoreNotice && <div className="catalog-restore-notice" role="status">{restoreNotice}</div>}
      <div className="section-header">
        <span className="section-subtitle">Nuestra Tienda</span>
        <h2 className="section-title">Catálogo de Productos</h2>
        <div className="section-divider"></div>
      </div>

      <div className="catalog-controls">
        {/* Search Bar */}
        <ProductSearch 
          query={searchQuery} 
          onSearchChange={onSearchChange} 
        />

        {/* Filter Pills, Toggles & Sorts */}
        <ProductFilters 
          categories={categoriesList}
          selectedCategory={selectedCategory}
          onSelectCategory={handleCategorySelect}
          onlyOffers={onlyOffers}
          onToggleOffers={setOnlyOffers}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        {/* Section Filter Pills */}
        {showSectionFilter && (
          <div className="section-filters-bar" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px', justifyContent: 'center', width: '100%' }}>
            {sectionOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`filter-pill ${selectedSection === opt.value ? 'active' : ''}`}
                onClick={() => setSelectedSection(opt.value)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '999px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  border: '1px solid',
                  transition: 'var(--transition-fast)',
                  backgroundColor: selectedSection === opt.value ? 'var(--primary)' : 'transparent',
                  color: selectedSection === opt.value ? '#ffffff' : 'var(--text-main)',
                  borderColor: selectedSection === opt.value ? 'var(--primary)' : 'var(--border)'
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid Results Counter */}
      <div className="results-info">
        Mostrando <strong>{filteredProducts.length}</strong> {filteredProducts.length === 1 ? 'producto' : 'productos'}
      </div>

      {/* Product Cards Grid / Empty States */}
      {productsList.length === 0 ? (
        <div className="catalog-empty-state">
          <div className="empty-icon">🏪</div>
          <h3>Todavía no hay productos cargados.</h3>
          <p>Próximamente verás nuestro catálogo online aquí.</p>
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="product-grid">
          {filteredProducts.map((product) => (
            <ProductCard 
              key={product.id} 
              product={product} 
              categories={categoriesList}
              catalogState={{
                categorySlug: activeCategory?.slug || 'all',
                section: selectedSection,
                search: searchQuery,
              }}
              isRestoreTarget={String(restoreTargetId) === String(product.id)}
            />
          ))}
        </div>
      ) : (
        <div className="catalog-empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No encontramos resultados</h3>
          <p>Intentá buscar con otros términos o cambiá los filtros aplicados.</p>
          <button onClick={handleResetFilters} className="btn btn-primary">
            Restablecer Filtros
          </button>
        </div>
      )}
    </section>
  );
}
