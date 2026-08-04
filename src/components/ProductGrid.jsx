import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { categories as staticCategories } from '../data/categories';
import ProductCard from './ProductCard';
import ProductSearch from './ProductSearch';
import ProductFilters from './ProductFilters';
import { getCachedCatalog, setCachedCatalog } from '../lib/catalogCache';

export default function ProductGrid({ 
  selectedCategory, 
  onSelectCategory, 
  searchQuery, 
  onSearchChange 
}) {
  const initialCache = getCachedCatalog();
  const [productsList, setProductsList] = useState(() => initialCache ? initialCache.products : []);
  const [categoriesList, setCategoriesList] = useState(() => initialCache ? initialCache.categories : []);
  const [loading, setLoading] = useState(() => !initialCache);
  const [onlyOffers, setOnlyOffers] = useState(false);
  const [sortBy, setSortBy] = useState('default');

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

  useEffect(() => {
    if (loading || productsList.length === 0) return;

    const lastViewedId = sessionStorage.getItem('last_viewed_product_id');
    if (lastViewedId) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`product-card-${lastViewedId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('product-card-highlighted');
          setTimeout(() => {
            element.classList.remove('product-card-highlighted');
          }, 2000);
        }
        sessionStorage.removeItem('last_viewed_product_id');
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [loading, productsList]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...productsList];

    // Filter by Category
    if (selectedCategory !== 'all') {
      result = result.filter(p => p.categoria_id === selectedCategory);
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
        (p.marca && normalize(p.marca).includes(query)) ||
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
  }, [productsList, selectedCategory, searchQuery, onlyOffers, sortBy]);

  const handleResetFilters = () => {
    onSelectCategory('all');
    onSearchChange('');
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
          onSelectCategory={onSelectCategory}
          onlyOffers={onlyOffers}
          onToggleOffers={setOnlyOffers}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
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
