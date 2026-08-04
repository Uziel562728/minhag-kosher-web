import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { clearCachedCatalog } from '../../lib/catalogCache';

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

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta categoría? Esto podría afectar a los productos vinculados.')) return;

    setDeletingId(id);
    setErrorMsg('');
    try {
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
        details: err.details || 'N/A',
        hint: err.hint || 'N/A',
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
        <h3>Categorías del Supermercado ({categories.length})</h3>
        <button 
          onClick={() => navigate('/admin/categories/new')} 
          className="btn btn-primary btn-add"
        >
          ➕ Agregar Categoría
        </button>
      </div>

      {errorMsg && <div className="admin-error-alert">{errorMsg}</div>}

      {/* Categories Table */}
      <div className="table-responsive">
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
                        className="btn-action btn-edit"
                        title="Editar"
                        disabled={deletingId === cat.id}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="btn-action btn-delete"
                        title="Eliminar"
                        disabled={deletingId === cat.id}
                      >
                        🗑️
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
