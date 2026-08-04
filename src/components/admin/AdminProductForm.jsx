import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { categories as staticCategories } from '../../data/categories';
import { clearCachedCatalog } from '../../lib/catalogCache';
import { getLowestPresentationPrice, validatePresentations } from '../../utils/productPresentations';

export default function AdminProductForm() {
  const { id } = useParams(); // If present, we are in Edit mode
  const isEdit = !!id;
  const navigate = useNavigate();

  // Form Fields State
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('');
  const [precioAnterior, setPrecioAnterior] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [seccion, setSeccion] = useState('');
  const [destacado, setDestacado] = useState(false);
  const [oferta, setOferta] = useState(false);
  const [disponible, setDisponible] = useState(true);
  const [orden, setOrden] = useState('0');
  const [presentationMode, setPresentationMode] = useState('traditional');
  const [presentaciones, setPresentaciones] = useState([]);
  const [supportsPresentationsColumn, setSupportsPresentationsColumn] = useState(false);

  // Images state
  const [imagenPrincipal, setImagenPrincipal] = useState('');
  const [imagenesAdicionales, setImagenesAdicionales] = useState([]);
  const [uploadedPaths, setUploadedPaths] = useState([]); // Track newly uploaded paths in this session

  // UI state
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Extract path from public URL
  const getPathFromUrl = (url) => {
    if (!url) return null;
    const parts = url.split('/storage/v1/object/public/product-images/');
    if (parts.length > 1) {
      return parts[1];
    }
    return null;
  };

  // Delete file from Supabase Storage
  const deleteFromStorage = async (path) => {
    if (!path) return;
    try {
      const { error } = await supabase.storage
        .from('product-images')
        .remove([path]);
      if (error) {
        console.warn('Error al eliminar archivo de Storage:', error);
      }
    } catch (err) {
      console.warn('Excepción al eliminar archivo de Storage:', err);
    }
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('orden', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          setCategories(data);
          if (!categoriaId) {
            setCategoriaId(data[0].id); // Default to first category
          }
        } else {
          setCategories(staticCategories);
          if (!categoriaId && staticCategories.length > 0) {
            setCategoriaId(staticCategories[0].id);
          }
        }
      } catch (err) {
        console.warn('Error al cargar categorías desde Supabase, cargando locales de respaldo:', err);
        setCategories(staticCategories);
        if (!categoriaId && staticCategories.length > 0) {
          setCategoriaId(staticCategories[0].id);
        }
      }
    };

    const fetchProduct = async () => {
      setFetching(true);
      setErrorMsg('');
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        if (data) {
          setSupportsPresentationsColumn(Object.prototype.hasOwnProperty.call(data, 'presentaciones'));
          setNombre(data.nombre || '');
          setDescripcion(data.descripcion || '');
          setPrecio(data.precio ? data.precio.toString() : '');
          setPrecioAnterior(data.precio_anterior ? data.precio_anterior.toString() : '');
          setCategoriaId(data.categoria_id || '');
          setSeccion(data.seccion || '');
          setDestacado(data.destacado || false);
          setOferta(data.oferta || false);
          setDisponible(data.disponible ?? true);
          setOrden(data.orden !== undefined ? data.orden.toString() : '0');
          setImagenPrincipal(data.imagen_principal || '');
          setImagenesAdicionales(data.imagenes_adicionales || []);
          if (Array.isArray(data.presentaciones) && data.presentaciones.length > 0) {
            const hasUnit = data.presentaciones.some((presentation) => presentation.tipo === 'unidad');
            setPresentationMode(hasUnit ? 'free' : 'packs');
            setPresentaciones(data.presentaciones);
          } else {
            setPresentationMode('traditional');
            setPresentaciones([]);
          }
        }
      } catch (err) {
        console.error('Error al cargar detalles de producto de Supabase:', {
          message: err.message || err,
          code: err.code || 'N/A',
          details: err.details || 'N/A',
          hint: err.hint || 'N/A',
          stack: err.stack
        });
        setErrorMsg('No se pudo cargar el producto de la base de datos.');
      } finally {
        setFetching(false);
      }
    };

    fetchCategories();
    if (isEdit) {
      fetchProduct();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const selectedCategoryObj = useMemo(() => {
    return categories.find(c => c.id === categoriaId);
  }, [categories, categoriaId]);

  const categorySlug = selectedCategoryObj ? selectedCategoryObj.slug : '';

  // Reset and sanitize section when category changes
  useEffect(() => {
    if (!categorySlug) {
      setSeccion('');
      return;
    }

    if (categorySlug === 'unidades') {
      if (seccion !== 'carne' && seccion !== 'lactea') {
        setSeccion('');
      }
    } else if (categorySlug === 'tortas') {
      if (seccion !== 'parve' && seccion !== 'lactea') {
        setSeccion('');
      }
    } else if (categorySlug === 'dulces') {
      if (seccion !== 'neutro' && seccion !== 'lactea') {
        setSeccion('');
      }
    } else {
      setSeccion('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySlug]);

  // Upload main image to Supabase Storage
  const handleMainImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMain(true);
    setErrorMsg('');
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      // Upload file to product-images bucket
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      // If there was already a newly uploaded main image in this session, delete it
      const oldPath = getPathFromUrl(imagenPrincipal);
      if (oldPath && uploadedPaths.includes(oldPath)) {
        await deleteFromStorage(oldPath);
        setUploadedPaths(prev => prev.filter(p => p !== oldPath));
      }

      setImagenPrincipal(publicUrl);
      setUploadedPaths(prev => [...prev, filePath]);
    } catch (err) {
      console.error('Error al subir la imagen principal a Supabase Storage:', {
        message: err.message || err,
        code: err.code || 'N/A',
        details: err.details || 'N/A',
        hint: err.hint || 'N/A',
        stack: err.stack
      });
      const detailedError = `${err.message || err} (Código: ${err.code || 'N/A'}, Detalles: ${err.details || 'N/A'}, Hint: ${err.hint || 'N/A'})`;
      setErrorMsg(`Error al subir la imagen principal: ${detailedError}`);
    } finally {
      setUploadingMain(false);
    }
  };

  // Upload additional gallery images to Supabase Storage
  const handleGalleryUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingGallery(true);
    setErrorMsg('');
    try {
      const newUrls = [];
      const newPaths = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `products/gallery/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        newUrls.push(publicUrl);
        newPaths.push(filePath);
      }

      setImagenesAdicionales([...imagenesAdicionales, ...newUrls]);
      setUploadedPaths(prev => [...prev, ...newPaths]);
    } catch (err) {
      console.error('Error al subir imágenes de galería a Supabase Storage:', {
        message: err.message || err,
        code: err.code || 'N/A',
        details: err.details || 'N/A',
        hint: err.hint || 'N/A',
        stack: err.stack
      });
      const detailedError = `${err.message || err} (Código: ${err.code || 'N/A'}, Detalles: ${err.details || 'N/A'}, Hint: ${err.hint || 'N/A'})`;
      setErrorMsg(`Error al subir una o más imágenes adicionales: ${detailedError}`);
    } finally {
      setUploadingGallery(false);
    }
  };

  const removeMainImage = async () => {
    const path = getPathFromUrl(imagenPrincipal);
    if (path && uploadedPaths.includes(path)) {
      await deleteFromStorage(path);
      setUploadedPaths(prev => prev.filter(p => p !== path));
    }
    setImagenPrincipal('');
  };

  const removeGalleryImage = async (indexToRemove) => {
    const urlToRemove = imagenesAdicionales[indexToRemove];
    const path = getPathFromUrl(urlToRemove);
    if (path && uploadedPaths.includes(path)) {
      await deleteFromStorage(path);
      setUploadedPaths(prev => prev.filter(p => p !== path));
    }
    setImagenesAdicionales(imagenesAdicionales.filter((_, idx) => idx !== indexToRemove));
  };

  const addPresentation = () => {
    const defaultType = presentationMode === 'packs' ? 'pack' : (presentaciones.some((item) => item.tipo === 'unidad') ? 'pack' : 'unidad');
    const defaultQuantity = defaultType === 'unidad' ? 1 : 12;
    setPresentaciones((current) => [...current, { id: defaultType === 'unidad' ? 'unidad' : `pack-${defaultQuantity}-${current.length + 1}`, label: defaultType === 'unidad' ? 'Unidad' : `Pack x${defaultQuantity}`, tipo: defaultType, cantidad_unidades: defaultQuantity, precio: 0 }]);
  };

  const updatePresentation = (index, field, value) => {
    setPresentaciones((current) => current.map((presentation, rowIndex) => {
      if (rowIndex !== index) return presentation;
      const updated = { ...presentation, [field]: value };
      if (field === 'tipo' && value === 'unidad') {
        updated.cantidad_unidades = 1;
        updated.id = 'unidad';
      } else if (field === 'cantidad_unidades' && updated.tipo === 'pack') {
        updated.id = `pack-${value}`;
      }
      return updated;
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Validations
    if (!nombre.trim()) {
      setErrorMsg('El nombre es obligatorio.');
      setLoading(false);
      return;
    }
    
    // Section validation: required only for units, tortas, and sweets
    const isSectionRequired = ['unidades', 'tortas', 'dulces'].includes(categorySlug);
    if (isSectionRequired && !seccion) {
      setErrorMsg('La sección es obligatoria para esta categoría.');
      setLoading(false);
      return;
    }

    if (presentationMode === 'traditional' && (!precio || isNaN(precio) || parseFloat(precio) < 0)) {
      setErrorMsg('El precio debe ser un número positivo.');
      setLoading(false);
      return;
    }
    if (precioAnterior && (isNaN(precioAnterior) || parseFloat(precioAnterior) < 0)) {
      setErrorMsg('El precio anterior debe ser un número positivo.');
      setLoading(false);
      return;
    }

    let normalizedPresentations = [];
    if (presentationMode !== 'traditional') {
      const validation = validatePresentations(presentaciones, { mode: presentationMode });
      if (!validation.valid) {
        setErrorMsg(validation.errors.join(' '));
        setLoading(false);
        return;
      }
      normalizedPresentations = validation.presentations;
    }

    // Verify if categoriaId is a valid UUID to prevent database type exceptions if falling back to static category slugs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const cleanCategoriaId = (categoriaId && uuidRegex.test(categoriaId)) ? categoriaId : null;

    const slug = nombre
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const productPayload = {
      nombre: nombre.trim(),
      slug,
      descripcion: descripcion.trim() || null,
      precio: presentationMode === 'traditional' ? parseFloat(precio) : getLowestPresentationPrice({ presentaciones: normalizedPresentations, precio }),
      precio_anterior: precioAnterior ? parseFloat(precioAnterior) : null,
      categoria_id: cleanCategoriaId,
      seccion: seccion || null,
      destacado,
      oferta,
      disponible,
      orden: parseInt(orden) || 0,
      imagen_principal: imagenPrincipal || null,
      imagenes_adicionales: imagenesAdicionales,
      fecha_actualizacion: new Date().toISOString()
    };
    if (presentationMode !== 'traditional' || supportsPresentationsColumn) {
      productPayload.presentaciones = presentationMode === 'traditional' ? null : normalizedPresentations;
    }

    try {
      if (isEdit) {
        const { error } = await supabase
          .from('products')
          .update(productPayload)
          .eq('id', id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert([{ ...productPayload, fecha_creacion: new Date().toISOString() }]);

        if (error) throw error;
      }

      clearCachedCatalog();
      navigate('/admin/products');
    } catch (err) {
      console.error('Error al guardar el producto en Supabase:', {
        message: err.message || err,
        code: err.code || 'N/A',
        details: err.details || 'N/A',
        hint: err.hint || 'N/A',
        stack: err.stack
      });

      // CLEANUP NEWLY UPLOADED IMAGES ON FAILURE
      if (uploadedPaths.length > 0) {
        console.log('Limpiando archivos subidos debido a error en el guardado...', uploadedPaths);
        for (const path of uploadedPaths) {
          await deleteFromStorage(path);
        }
        setUploadedPaths([]);
        setImagenPrincipal('');
        setImagenesAdicionales([]);
      }

      const detailedError = `${err.message || err} (Código: ${err.code || 'N/A'}, Detalles: ${err.details || 'N/A'}, Hint: ${err.hint || 'N/A'})`;
      setErrorMsg(err.code === '23505'
        ? 'Ya existe otro producto con ese nombre o URL. Cambiá el nombre para generar una URL diferente.'
        : `Error al guardar el producto: ${detailedError}`
      );
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="admin-loading-inner">
        <div className="admin-spinner"></div>
        <p>Cargando detalles del producto...</p>
      </div>
    );
  }

  return (
    <div className="admin-form-view">
      <div className="view-action-header">
        <h3>{isEdit ? 'Editar Producto' : 'Agregar Nuevo Producto'}</h3>
        <button onClick={() => navigate('/admin/products')} className="btn btn-secondary">
          Volver a la Lista
        </button>
      </div>

      {errorMsg && <div className="admin-error-alert">{errorMsg}</div>}

      <form onSubmit={handleSubmit} className="admin-form-grid">
        {/* Left Column: Text Fields */}
        <div className="form-column-left">
          <div className="form-group">
            <label htmlFor="nombre">Nombre del Producto *</label>
            <input
              type="text"
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del producto"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="descripcion">Descripción</label>
            <textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción del producto"
              rows="4"
            />
          </div>

          <div className="form-row-two">
            <div className="form-group">
              <label htmlFor="precio">Precio Actual ($) {presentationMode === 'traditional' ? '*' : '(se calcula)'}</label>
              <input
                type="number"
                step="0.01"
                id="precio"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="Precio actual"
                required={presentationMode === 'traditional'}
                disabled={presentationMode !== 'traditional'}
              />
            </div>
            <div className="form-group">
              <label htmlFor="precioAnterior">Precio Anterior ($)</label>
              <input
                type="number"
                step="0.01"
                id="precioAnterior"
                value={precioAnterior}
                onChange={(e) => setPrecioAnterior(e.target.value)}
                placeholder="Precio anterior"
              />
            </div>
          </div>

          <div className="admin-presentations-editor">
            <h4>Presentaciones</h4>
            <div className="form-group">
              <label htmlFor="presentation-mode">Comportamiento de venta</label>
              <select id="presentation-mode" value={presentationMode} onChange={(event) => { const mode = event.target.value; setPresentationMode(mode); if (mode === 'traditional') setPresentaciones([]); }}>
                <option value="traditional">Precio tradicional, sin presentaciones</option>
                <option value="free">Permite cantidad libre con unidad y pack</option>
                <option value="packs">Solo permite packs cerrados</option>
              </select>
            </div>
            {presentationMode !== 'traditional' && <>
              <p className="form-help-text">El precio base se actualizará al menor precio configurado. La columna debe existir en Supabase antes de guardar.</p>
              <div className="admin-presentations-list">{presentaciones.map((presentation, index) => <div className="admin-presentation-row" key={`${presentation.id}-${index}`}>
                <div className="form-group"><label>Nombre visible</label><input type="text" value={presentation.label} onChange={(event) => updatePresentation(index, 'label', event.target.value)} placeholder="Pack x12" /></div>
                <div className="form-group"><label>Tipo</label><select value={presentation.tipo} onChange={(event) => updatePresentation(index, 'tipo', event.target.value)}><option value="unidad" disabled={presentationMode === 'packs'}>Unidad</option><option value="pack">Pack</option></select></div>
                <div className="form-group"><label>Cantidad de unidades</label><input type="number" min="1" step="1" value={presentation.cantidad_unidades} disabled={presentation.tipo === 'unidad'} onChange={(event) => updatePresentation(index, 'cantidad_unidades', event.target.value)} /></div>
                <div className="form-group"><label>Precio</label><input type="number" min="0" step="0.01" value={presentation.precio} onChange={(event) => updatePresentation(index, 'precio', event.target.value)} /></div>
                <button type="button" className="btn btn-secondary admin-presentation-remove" onClick={() => setPresentaciones((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Eliminar</button>
              </div>)}</div>
              <button type="button" className="btn btn-secondary" onClick={addPresentation}>Agregar presentación</button>
            </>}
          </div>

          <div className="form-row-two">
            <div className="form-group">
              <label htmlFor="categoria">Categoría</label>
              <select
                id="categoria"
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </select>
            </div>
            {['unidades', 'tortas', 'dulces'].includes(categorySlug) ? (
              <div className="form-group">
                <label htmlFor="seccion">Sección *</label>
                <select
                  id="seccion"
                  value={seccion}
                  onChange={(e) => setSeccion(e.target.value)}
                  required
                >
                  <option value="">Selecciona sección...</option>
                  {categorySlug === 'unidades' && (
                    <>
                      <option value="carne">Carne</option>
                      <option value="lactea">Láctea</option>
                    </>
                  )}
                  {categorySlug === 'tortas' && (
                    <>
                      <option value="parve">Parve</option>
                      <option value="lactea">Láctea</option>
                    </>
                  )}
                  {categorySlug === 'dulces' && (
                    <>
                      <option value="neutro">Neutro</option>
                      <option value="lactea">Lácteo</option>
                    </>
                  )}
                </select>
              </div>
            ) : (
              <div className="form-group" style={{ opacity: 0.5 }}>
                <label>Sección</label>
                <input
                  type="text"
                  disabled
                  value="No aplica para esta categoría"
                  style={{ cursor: 'not-allowed' }}
                />
              </div>
            )}
          </div>

          <div className="form-row-two">
            <div className="form-group">
              <label htmlFor="orden">Orden de Visualización</label>
              <input
                type="number"
                id="orden"
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
                placeholder="Orden de visualización"
              />
            </div>
            <div className="form-checkboxes-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={destacado}
                  onChange={(e) => setDestacado(e.target.checked)}
                />
                Producto Destacado
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={oferta}
                  onChange={(e) => setOferta(e.target.checked)}
                />
                En Oferta
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={disponible}
                  onChange={(e) => setDisponible(e.target.checked)}
                />
                Stock Disponible
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Image Uploads */}
        <div className="form-column-right">
          {/* Main Image Upload */}
          <div className="form-image-section">
            <label>Imagen Principal (Recomendado 500x500)</label>
            {imagenPrincipal ? (
              <div className="image-preview-card">
                <img src={imagenPrincipal} alt="Vista previa principal" />
                <button type="button" onClick={removeMainImage} className="btn-remove-img">
                  ❌ Quitar Imagen
                </button>
              </div>
            ) : (
              <div className="image-upload-placeholder">
                <input
                  type="file"
                  id="main-image-input"
                  accept="image/*"
                  onChange={handleMainImageUpload}
                  disabled={uploadingMain}
                />
                <label htmlFor="main-image-input" className="file-input-label">
                  {uploadingMain ? 'Subiendo archivo...' : '📁 Seleccionar Imagen'}
                </label>
              </div>
            )}
          </div>

          {/* Gallery Images Upload */}
          <div className="form-image-section">
            <label>Imágenes Adicionales (Galería)</label>
            <div className="image-upload-placeholder">
              <input
                type="file"
                id="gallery-images-input"
                accept="image/*"
                multiple
                onChange={handleGalleryUpload}
                disabled={uploadingGallery}
              />
              <label htmlFor="gallery-images-input" className="file-input-label">
                {uploadingGallery ? 'Subiendo archivos...' : '📁 Agregar Fotos a Galería'}
              </label>
            </div>

            {imagenesAdicionales.length > 0 && (
              <div className="gallery-previews-grid">
                {imagenesAdicionales.map((url, idx) => (
                  <div key={idx} className="gallery-preview-item">
                    <img src={url} alt={`Galería ${idx}`} />
                    <button
                      type="button"
                      onClick={() => removeGalleryImage(idx)}
                      className="btn-remove-gallery-img"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Form Action Buttons */}
        <div className="form-submit-row">
          <button type="submit" className="btn btn-primary btn-large" disabled={loading}>
            {loading ? 'Guardando cambios...' : '💾 Guardar Producto'}
          </button>
        </div>
      </form>
    </div>
  );
}
