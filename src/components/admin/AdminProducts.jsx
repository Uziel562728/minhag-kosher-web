import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { clearCachedCatalog } from '../../lib/catalogCache';
import { Pencil, Trash2 } from 'lucide-react';
import { getProductImage } from '../../utils/getProductImage';
import { getProductSectionLabel } from '../../config/productSections';

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [deletingId, setDeletingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Fetch categories
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('orden', { ascending: true });

      if (catError) throw catError;
      setCategories(catData || []);

      // 2. Fetch products (ordered by orden then name)
      const { data: prodData, error: prodError } = await supabase
        .from('products')
        .select('*')
        .order('orden', { ascending: true })
        .order('nombre', { ascending: true });

      if (prodError) throw prodError;
      setProducts(prodData || []);
    } catch (err) {
      console.error('Error al cargar datos desde Supabase:', {
        message: err.message || err,
        code: err.code || 'N/A',
        details: err.details || 'N/A',
        hint: err.hint || 'N/A',
        stack: err.stack
      });
      setErrorMsg('Error al cargar datos de la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, nombre) => {
    if (!window.confirm(`¿Seguro que querés eliminar '${nombre}'? Esta acción no se puede deshacer.`)) return;
    
    setDeletingId(id);
    setErrorMsg('');
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      clearCachedCatalog();
      setProducts(products.filter(p => p.id !== id));
    } catch (err) {
      console.error('Error al eliminar el producto de Supabase:', {
        message: err.message || err,
        code: err.code || 'N/A',
        details: err.details || 'N/A',
        hint: err.hint || 'N/A',
        stack: err.stack
      });
      setErrorMsg('No se pudo eliminar el producto de la base de datos.');
    } finally {
      setDeletingId(null);
    }
  };

  // Map category ID to Category Name and Slug
  const { categoryMap, categorySlugMap } = useMemo(() => {
    const nameMap = {};
    const slugMap = {};
    categories.forEach((cat) => {
      nameMap[cat.id] = cat.nombre;
      slugMap[cat.id] = cat.slug;
    });
    return { categoryMap: nameMap, categorySlugMap: slugMap };
  }, [categories]);

  // Client-side search and category filtering for dashboard administration
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'all' || p.categoria_id === selectedCategory;
      const matchesSearch = p.nombre.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  if (loading) {
    return (
      <div className="admin-loading-inner">
        <div className="admin-spinner"></div>
        <p>Cargando catálogo de productos...</p>
      </div>
    );
  }

  return (
    <div className="admin-products-view">
      <div className="view-action-header">
        <h3>Lista de Productos ({filteredProducts.length})</h3>
        <button 
          onClick={() => navigate('/admin/products/new')} 
          className="btn btn-primary btn-add"
        >
          ➕ Agregar Producto
        </button>
      </div>

      {errorMsg && <div className="admin-error-alert">{errorMsg}</div>}

      {/* Filters and Controls */}
      <div className="admin-filters-bar">
        <div className="filter-group search-filter">
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-group category-filter">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">Todas las Categorías</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="admin-desktop-only">Imagen</th>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Precio</th>
              <th>Estado</th>
              <th className="admin-desktop-only">Destacado</th>
              <th className="admin-desktop-only">Oferta</th>
              <th className="actions-column">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-table-row">
                  No se encontraron productos en el catálogo.
                </td>
              </tr>
            ) : (
              filteredProducts.map((prod) => (
                <tr key={prod.id}>
                  <td data-label="Imagen" className="admin-desktop-only">
                    <div className="table-img-wrapper">
                      <img 
                        src={getProductImage({ ...prod, categories: { slug: categorySlugMap[prod.categoria_id] } })} 
                        alt={prod.nombre} 
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = getProductImage({});
                        }}
                      />
                    </div>
                  </td>
                  <td data-label="Nombre">
                    <div className="table-product-name">
                      <strong>{prod.nombre}</strong>
                      {prod.seccion && (
                        <span className="product-brand-tag admin-desktop-only">
                      {getProductSectionLabel(prod.seccion, categorySlugMap[prod.categoria_id])}
                        </span>
                      )}
                    </div>
                  </td>
                  {prod.seccion && (
                    <td data-label="Sección" className="admin-mobile-only">
                      <span className="product-brand-tag">
                      {getProductSectionLabel(prod.seccion, categorySlugMap[prod.categoria_id])}
                      </span>
                    </td>
                  )}
                  <td data-label="Categoría">{categoryMap[prod.categoria_id] || 'Sin categoría'}</td>
                  <td data-label="Precio">
                    <div className="table-prices">
                      <span className="price-tag">${prod.precio}</span>
                      {prod.precio_anterior && (
                        <span className="old-price-tag">${prod.precio_anterior}</span>
                      )}
                    </div>
                  </td>
                  <td data-label="Estado">
                    <span className={`status-badge ${prod.disponible ? 'status-active' : 'status-inactive'}`}>
                      {prod.disponible ? 'Disponible' : 'Sin Stock'}
                    </span>
                  </td>
                  <td data-label="Destacado" className="admin-desktop-only">{prod.destacado ? '⭐ Sí' : 'No'}</td>
                  <td data-label="Oferta" className="admin-desktop-only">{prod.oferta ? '🏷️ Sí' : 'No'}</td>
                  <td data-label="Acciones">
                    <div className="table-actions">
                      <button
                        onClick={() => navigate(`/admin/products/edit/${prod.id}`)}
                        className="admin-icon-button admin-icon-button--edit"
                        title="Editar producto"
                        aria-label="Editar producto"
                        disabled={deletingId === prod.id}
                      >
                        <Pencil size={18} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleDelete(prod.id, prod.nombre)}
                        className="admin-icon-button admin-icon-button--delete"
                        title="Eliminar producto"
                        aria-label="Eliminar producto"
                        disabled={deletingId === prod.id}
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
