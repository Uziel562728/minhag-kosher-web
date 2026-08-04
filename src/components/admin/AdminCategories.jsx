import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { clearCachedCatalog } from '../../lib/catalogCache';
import { Pencil, Trash2 } from 'lucide-react';

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('orden', { ascending: true })
        .order('nombre', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error al cargar las categorías desde Supabase:', {
        message: err.message || err,
        code: err.code || 'N/A',
        details: err.details || 'N/A',
        hint: err.hint || 'N/A',
        stack: err.stack
      });
      setErrorMsg('Error al cargar las categorías de la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, nombre) => {
    setDeletingId(id);
    setErrorMsg('');
    try {
      // Check if there are products associated with this category
      const { count, error: countError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('categoria_id', id);

      if (countError) throw countError;

      if (count && count > 0) {
        alert(`No se puede eliminar la categoría porque tiene ${count} producto(s) asociado(s). Primero debes reasignar o eliminar los productos vinculados.`);
        setDeletingId(null);
        return;
      }

      if (!window.confirm(`¿Seguro que querés eliminar la categoría '${nombre}'? Esta acción no se puede deshacer.`)) {
        setDeletingId(null);
        return;
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      clearCachedCatalog();
      setCategories(categories.filter(c => c.id !== id));
    } catch (err) {
      console.error('Error al eliminar la categoría de Supabase:', {
        message: err.message || err,
        code: err.code || 'N/A',
        stack: err.stack
      });
      setErrorMsg('No se pudo eliminar la categoría de la base de datos.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="admin-loading-inner">
        <div className="admin-spinner"></div>
        <p>Cargando listado de categorías...</p>
      </div>
    );
  }

  return (
    <div className="admin-categories-view">
      <div className="view-action-header">
        <h3>Categorías ({categories.length})</h3>
        <button 
          onClick={() => navigate('/admin/categories/new')} 
          className="btn btn-primary btn-add"
        >
          ➕ Agregar Categoría
        </button>
      </div>

      {errorMsg && <div className="admin-error-alert">{errorMsg}</div>}

      {/* Categories Table (Desktop View) */}
      <div className="table-responsive admin-desktop-only">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Slug</th>
              <th>Orden</th>
              <th>Estado</th>
              <th className="actions-column">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty-table-row">
                  No se encontraron categorías en la base de datos.
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id}>
                  <td data-label="Nombre">
                    <strong>{cat.nombre}</strong>
                    {cat.descripcion && (
                      <p className="table-row-desc">{cat.descripcion}</p>
                    )}
                  </td>
                  <td data-label="Slug"><code>{cat.slug}</code></td>
                  <td data-label="Orden">{cat.orden}</td>
                  <td data-label="Estado">
                    <span className={`status-badge ${cat.activa ? 'status-active' : 'status-inactive'}`}>
                      {cat.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td data-label="Acciones">
                    <div className="table-actions">
                      <button
                        onClick={() => navigate(`/admin/categories/edit/${cat.id}`)}
                        className="admin-icon-button admin-icon-button--edit"
                        title="Editar categoría"
                        aria-label="Editar categoría"
                        disabled={deletingId === cat.id}
                      >
                        <Pencil size={18} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id, cat.nombre)}
                        className="admin-icon-button admin-icon-button--delete"
                        title="Eliminar categoría"
                        aria-label="Eliminar categoría"
                        disabled={deletingId === cat.id}
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

      {/* Categories Cards (Mobile View) */}
      <div className="admin-mobile-only category-mobile-list">
        {categories.length === 0 ? (
          <div className="empty-table-row" style={{ color: '#aeb7c6', fontStyle: 'italic', padding: '40px', textAlign: 'center' }}>
            No se encontraron categorías en la base de datos.
          </div>
        ) : (
          categories.map((cat) => (
            <div key={cat.id} className="category-mobile-card">
              <div className="category-mobile-name">{cat.nombre}</div>
              <div className="category-mobile-actions">
                <button
                  onClick={() => navigate(`/admin/categories/edit/${cat.id}`)}
                  className="category-mobile-action category-mobile-action--edit"
                  title={`Editar categoría ${cat.nombre}`}
                  aria-label={`Editar categoría ${cat.nombre}`}
                  disabled={deletingId === cat.id}
                >
                  <Pencil size={17} aria-hidden="true" /> Editar
                </button>
                <button
                  onClick={() => handleDelete(cat.id, cat.nombre)}
                  className="category-mobile-action category-mobile-action--delete"
                  title={`Eliminar categoría ${cat.nombre}`}
                  aria-label={`Eliminar categoría ${cat.nombre}`}
                  disabled={deletingId === cat.id}
                >
                  <Trash2 size={17} aria-hidden="true" /> Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
