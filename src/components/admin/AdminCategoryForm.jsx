import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { clearCachedCatalog } from '../../lib/catalogCache';

export default function AdminCategoryForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  // Form Fields State
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [orden, setOrden] = useState('0');
  const [activa, setActiva] = useState(true);

  // UI state
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchCategory = async () => {
      setFetching(true);
      setErrorMsg('');
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        if (data) {
          setNombre(data.nombre || '');
          setSlug(data.slug || '');
          setDescripcion(data.descripcion || '');
          setOrden(data.orden !== undefined ? data.orden.toString() : '0');
          setActiva(data.activa ?? true);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg('No se pudo cargar la categoría de la base de datos.');
      } finally {
        setFetching(false);
      }
    };

    if (isEdit) {
      fetchCategory();
    }
  }, [id, isEdit]);

  // Helper to generate URL-safe slugs
  const slugify = (text) => {
    return text
      .toString()
      .toLowerCase()
      .normalize('NFD') // splits diacritics
      .replace(/[\u0300-\u036f]/g, '') // removes diacritics
      .replace(/\s+/g, '-') // replaces spaces with hyphens
      .replace(/[^\w-]+/g, '') // removes all non-word chars
      .replace(/-+/g, '-') // replaces multiple hyphens with single
      .replace(/^-+/, '') // trims leading hyphens
      .replace(/-+$/, ''); // trims trailing hyphens
  };

  const handleNombreChange = (e) => {
    const val = e.target.value;
    setNombre(val);
    if (!isEdit) {
      setSlug(slugify(val));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (!nombre.trim()) {
      setErrorMsg('El nombre es obligatorio.');
      setLoading(false);
      return;
    }
    if (!slug.trim()) {
      setErrorMsg('El slug es obligatorio y debe ser único.');
      setLoading(false);
      return;
    }

    const categoryPayload = {
      nombre: nombre.trim(),
      slug: slug.trim().toLowerCase(),
      descripcion: descripcion.trim() || null,
      orden: parseInt(orden) || 0,
      activa,
      fecha_actualizacion: new Date().toISOString()
    };

    try {
      if (isEdit) {
        const { error } = await supabase
          .from('categories')
          .update(categoryPayload)
          .eq('id', id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('categories')
          .insert([{ ...categoryPayload, fecha_creacion: new Date().toISOString() }]);

        if (error) throw error;
      }

      clearCachedCatalog();
      navigate('/admin/categories');
    } catch (err) {
      console.error('Error al guardar la categoría en Supabase:', {
        message: err.message || err,
        code: err.code || 'N/A',
        details: err.details || 'N/A',
        hint: err.hint || 'N/A',
        stack: err.stack
      });
      const detailedError = `${err.message || err} (Código: ${err.code || 'N/A'}, Detalles: ${err.details || 'N/A'}, Hint: ${err.hint || 'N/A'})`;
      setErrorMsg(err.code === '23505' 
        ? 'El slug ya existe. Elige un nombre de categoría diferente o edita el slug.' 
        : `Error al guardar la categoría: ${detailedError}`
      );
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="admin-loading-inner">
        <div className="admin-spinner"></div>
        <p>Cargando detalles de la categoría...</p>
      </div>
    );
  }

  return (
    <div className="admin-form-view">
      <div className="view-action-header">
        <h3>{isEdit ? 'Editar Categoría' : 'Agregar Nueva Categoría'}</h3>
        <button onClick={() => navigate('/admin/categories')} className="btn btn-secondary">
          Volver a la Lista
        </button>
      </div>

      {errorMsg && <div className="admin-error-alert">{errorMsg}</div>}

      <form onSubmit={handleSubmit} className="admin-form-grid single-column-form">
        <div className="form-group">
          <label htmlFor="nombre">Nombre de la Categoría *</label>
          <input
            type="text"
            id="nombre"
            value={nombre}
            onChange={handleNombreChange}
            placeholder="Ej: Almacén o Bebidas"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="slug">Slug (URL identificador) *</label>
          <input
            type="text"
            id="slug"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            placeholder="Ej: almacen"
            required
          />
          <small className="form-help-text">
            Se genera automáticamente. Debe contener letras, números y guiones, sin espacios.
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="descripcion">Descripción</label>
          <textarea
            id="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Productos secos, conservas y aceites."
            rows="3"
          />
        </div>

        <div className="form-group">
          <label htmlFor="orden">Orden</label>
          <input
            type="number"
            id="orden"
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            placeholder="Ej: 0"
          />
        </div>

        <div className="form-checkboxes-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={activa}
              onChange={(e) => setActiva(e.target.checked)}
            />
            Categoría Activa (Visible en catálogo)
          </label>
        </div>

        <div className="form-submit-row">
          <button type="submit" className="btn btn-primary btn-large" disabled={loading}>
            {loading ? 'Guardando cambios...' : '💾 Guardar Categoría'}
          </button>
        </div>
      </form>
    </div>
  );
}
