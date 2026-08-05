import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { clearCachedCatalog } from '../../lib/catalogCache';
import { validateCampaign } from '../../utils/campaignValidation';
import { createCampaign, getCampaignById, getCampaignProducts, updateCampaign } from '../../services/campaignService';
import { uploadCampaignImage, deleteCampaignImage } from '../../services/campaignImageService';
import CampaignScheduleFields from './CampaignScheduleFields';
import CampaignPopupFields from './CampaignPopupFields';
import CampaignPromotionFields from './CampaignPromotionFields';
import CampaignFlyerFields from './CampaignFlyerFields';

// Convert ISO string to YYYY-MM-DDTHH:MM
const toDatetimeLocal = (isoString) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const pad = (num) => String(num).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
};

// Convert YYYY-MM-DDTHH:MM to ISO String
const toISOString = (localString) => {
  if (!localString) return null;
  try {
    const d = new Date(localString);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
};

// Convert ISO string or full timestamp to YYYY-MM-DD for date inputs
const toDateInput = (dateString) => {
  if (!dateString) return '';
  return dateString.split('T')[0];
};

const asInputString = (value, fallback = '') => (
  value === null || value === undefined ? fallback : String(value)
);

const normalizeDecimal = (value) => String(value).trim().replace(',', '.');

const parseOptionalDecimal = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  return Number(normalizeDecimal(value));
};

const parseOptionalInteger = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  return parseInt(String(value), 10);
};

export default function AdminCampaignForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const location = useLocation();

  // Master Data
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  // Campaign State
  const [campaign, setCampaign] = useState({
    nombre: '',
    descripcion: '',
    tipo: 'promocion',
    estado: 'borrador',
    habilitada: false,
    prioridad: '0',
    tipo_programacion: 'puntual',
    zona_horaria: 'America/Argentina/Buenos_Aires',
    fecha_inicio: '',
    fecha_fin: '',
    dias_semana: [],
    hora_inicio: '',
    hora_fin: '',
    fecha_recurrencia_inicio: '',
    fecha_recurrencia_fin: '',
    imagen_url: '',
    popup_imagen_url: '',
    mostrar_imagen: false,
    destino_tipo: 'ninguno',
    popup_destino_tipo: 'ninguno',
    destino_valor: '',
    popup_destino_valor: '',
    popup_titulo: '',
    popup_descripcion: '',
    popup_frecuencia: 'una_vez_sesion',
    popup_dispositivo: 'todos',
    popup_retraso_segundos: '0',
    popup_se_puede_cerrar: true,
    alcance_promocion: 'todos',
    categoria_id: null,
    tipo_descuento: 'porcentaje',
    porcentaje: '',
    importe_fijo: '',
    precio_fijo: '',
    cantidad_compra: '2',
    cantidad_paga: '1',
    texto_etiqueta: '',
    acumulable: true
  });

  // Selected products for scope = 'productos_seleccionados'
  const [selectedProducts, setSelectedProducts] = useState([]);

  // Local Image Upload States
  const [imageFile, setImageFile] = useState(null);
  const [tempImagePreview, setTempImagePreview] = useState('');
  const [originalImageUrl, setOriginalImageUrl] = useState('');

  // UI state
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [errors, setErrors] = useState({});
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState(() => location.state?.infoMsg || '');

  // Fetch products & categories on mount
  useEffect(() => {
    async function loadMasterData() {
      setFetching(true);
      setErrorMsg('');
      try {
        const { data: catData, error: catError } = await supabase
          .from('categories')
          .select('*')
          .order('orden', { ascending: true });
        if (catError) throw catError;
        setCategories(catData || []);

        const { data: prodData, error: prodError } = await supabase
          .from('products')
          .select('*')
          .order('nombre', { ascending: true });
        if (prodError) throw prodError;
        setProducts(prodData || []);

        if (isEdit) {
          const fetchedCampaign = await getCampaignById(id);
          if (!fetchedCampaign) {
            setErrorMsg('La campaña no existe o fue eliminada.');
            return;
          }

          const formatted = {
            ...fetchedCampaign,
            prioridad: asInputString(fetchedCampaign.prioridad, '0'),
            popup_retraso_segundos: asInputString(fetchedCampaign.popup_retraso_segundos, '0'),
            porcentaje: asInputString(fetchedCampaign.porcentaje),
            importe_fijo: asInputString(fetchedCampaign.importe_fijo),
            precio_fijo: asInputString(fetchedCampaign.precio_fijo),
            cantidad_compra: asInputString(fetchedCampaign.cantidad_compra),
            cantidad_paga: asInputString(fetchedCampaign.cantidad_paga),
            fecha_inicio: toDatetimeLocal(fetchedCampaign.fecha_inicio),
            fecha_fin: toDatetimeLocal(fetchedCampaign.fecha_fin),
            fecha_recurrencia_inicio: toDateInput(fetchedCampaign.fecha_recurrencia_inicio),
            fecha_recurrencia_fin: toDateInput(fetchedCampaign.fecha_recurrencia_fin),
            // Apply compatibility read mapping
            imagen_url: fetchedCampaign.imagen_url || fetchedCampaign.popup_imagen_url || '',
            destino_tipo: fetchedCampaign.destino_tipo || fetchedCampaign.popup_destino_tipo || 'ninguno',
            destino_valor: fetchedCampaign.destino_valor || fetchedCampaign.popup_destino_valor || '',
            mostrar_imagen: fetchedCampaign.mostrar_imagen ?? (!!(fetchedCampaign.imagen_url || fetchedCampaign.popup_imagen_url))
          };

          setCampaign(formatted);
          setOriginalImageUrl(formatted.imagen_url || '');

          if (fetchedCampaign.tipo === 'promocion' && fetchedCampaign.alcance_promocion === 'productos_seleccionados') {
            const rels = await getCampaignProducts(id);
            const mapped = rels.map(r => ({
              product_id: r.product_id,
              incluido: r.incluido,
              isCustomDiscount: !!r.tipo_descuento,
              tipo_descuento: r.tipo_descuento || 'porcentaje',
              porcentaje: asInputString(r.porcentaje),
              importe_fijo: asInputString(r.importe_fijo),
              precio_fijo: asInputString(r.precio_fijo),
              cantidad_compra: asInputString(r.cantidad_compra, '2'),
              cantidad_paga: asInputString(r.cantidad_paga, '1'),
              texto_etiqueta: r.texto_etiqueta || '',
              product_meta: r.products
            }));
            setSelectedProducts(mapped);
          }
        }
      } catch (err) {
        console.error('Error al iniciar formulario de campaña:', err);
        setErrorMsg(`No se pudo cargar la información requerida: ${err.message || err}`);
      } finally {
        setFetching(false);
      }
    }

    loadMasterData();
  }, [id, isEdit]);

  // Clean local URL blob preview on unmount
  useEffect(() => {
    return () => {
      if (tempImagePreview && tempImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(tempImagePreview);
      }
    };
  }, [tempImagePreview]);

  // Handle field change
  const handleFieldChange = (field, value) => {
    setCampaign(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      if (field === 'tipo_descuento') {
        updated.porcentaje = '';
        updated.importe_fijo = '';
        updated.precio_fijo = '';
        updated.cantidad_compra = '';
        updated.cantidad_paga = '';
      }
      return updated;
    });
    const errorField = ['porcentaje', 'importe_fijo', 'precio_fijo', 'cantidad_compra', 'cantidad_paga'].includes(field)
      ? 'tipo_descuento'
      : field;
    if (errors[errorField]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[errorField];
        return next;
      });
    }
  };

  const handleImageFileSelect = (file, previewUrl) => {
    setImageFile(file);
    setTempImagePreview(previewUrl);
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setErrorMsg('');
    setInfoMsg('');
    setErrors({});
    setSaveStatus('Validando datos...');

    // Validate the editable strings before converting anything for Supabase.
    const validation = validateCampaign(campaign, selectedProducts);
    if (!validation.valid) {
      setErrors(validation.errors);
      setErrorMsg('Por favor corregí los errores en el formulario antes de guardar.');
      setSaving(false);
      setSaveStatus('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Determine clean discount fields based on the discount type
    let cleanPorcentaje = null;
    let cleanImporteFijo = null;
    let cleanPrecioFijo = null;
    let cleanCantidadCompra = null;
    let cleanCantidadPaga = null;

    if (campaign.tipo === 'promocion') {
      const type = campaign.tipo_descuento;
      if (type === 'porcentaje') {
        cleanPorcentaje = parseOptionalDecimal(campaign.porcentaje);
      } else if (type === 'importe_fijo') {
        cleanImporteFijo = parseOptionalDecimal(campaign.importe_fijo);
      } else if (type === 'precio_fijo') {
        cleanPrecioFijo = parseOptionalDecimal(campaign.precio_fijo);
      } else if (type === 'compra_x_paga_y') {
        cleanCantidadCompra = parseOptionalInteger(campaign.cantidad_compra);
        cleanCantidadPaga = parseOptionalInteger(campaign.cantidad_paga);
      }
    }

    // Normalize schedule payloads to UTC/ISO and sanitize discount fields
    const payload = {
      ...campaign,
      prioridad: parseOptionalInteger(campaign.prioridad),
      popup_retraso_segundos: parseOptionalInteger(campaign.popup_retraso_segundos),
      estado: campaign.habilitada ? 'programada' : 'pausada',
      tipo_descuento: campaign.tipo === 'promocion' ? campaign.tipo_descuento : null,
      porcentaje: cleanPorcentaje,
      importe_fijo: cleanImporteFijo,
      precio_fijo: cleanPrecioFijo,
      cantidad_compra: cleanCantidadCompra,
      cantidad_paga: cleanCantidadPaga,
      // Alcance
      alcance_promocion: campaign.tipo === 'promocion' ? campaign.alcance_promocion : null,
      categoria_id: campaign.tipo === 'promocion' && campaign.alcance_promocion === 'categoria' ? campaign.categoria_id : null,
      
      fecha_inicio: campaign.tipo_programacion === 'puntual' ? toISOString(campaign.fecha_inicio) : null,
      fecha_fin: campaign.tipo_programacion === 'puntual' ? toISOString(campaign.fecha_fin) : null,
      fecha_recurrencia_inicio: campaign.tipo_programacion === 'semanal' ? toISOString(campaign.fecha_recurrencia_inicio) : null,
      fecha_recurrencia_fin: campaign.tipo_programacion === 'semanal' ? toISOString(campaign.fecha_recurrencia_fin) : null,
      dias_semana: campaign.tipo_programacion === 'semanal' ? campaign.dias_semana : null,
      hora_inicio: campaign.tipo_programacion === 'semanal' ? campaign.hora_inicio : null,
      hora_fin: campaign.tipo_programacion === 'semanal' ? campaign.hora_fin : null
    };

    // Sanitize discounts on selected products
    const cleanSelectedProducts = selectedProducts.map(p => {
      let prodPorcentaje = null;
      let prodImporteFijo = null;
      let prodPrecioFijo = null;
      let prodCantidadCompra = null;
      let prodCantidadPaga = null;

      if (p.isCustomDiscount) {
        const type = p.tipo_descuento;
        if (type === 'porcentaje') {
          prodPorcentaje = parseOptionalDecimal(p.porcentaje);
        } else if (type === 'importe_fijo') {
          prodImporteFijo = parseOptionalDecimal(p.importe_fijo);
        } else if (type === 'precio_fijo') {
          prodPrecioFijo = parseOptionalDecimal(p.precio_fijo);
        } else if (type === 'compra_x_paga_y') {
          prodCantidadCompra = parseOptionalInteger(p.cantidad_compra);
          prodCantidadPaga = parseOptionalInteger(p.cantidad_paga);
        }
      }

      return {
        ...p,
        porcentaje: prodPorcentaje,
        importe_fijo: prodImporteFijo,
        precio_fijo: prodPrecioFijo,
        cantidad_compra: prodCantidadCompra,
        cantidad_paga: prodCantidadPaga
      };
    });

    try {
      if (isEdit) {
        setSaveStatus('Guardando cambios de campaña...');
        
        // 1. Guardar cambios básicos de la campaña
        await updateCampaign(id, payload, cleanSelectedProducts);

        // 2. Si se seleccionó una nueva imagen para subir
        if (imageFile) {
          setSaveStatus('Subiendo nueva imagen a Storage...');
          const uploadResult = await uploadCampaignImage(id, imageFile);
          
          setSaveStatus('Actualizando enlace de imagen...');
          await updateCampaign(id, { ...payload, imagen_url: uploadResult.publicUrl, popup_imagen_url: uploadResult.publicUrl }, cleanSelectedProducts);
          
          // Clean up old image if it existed and is different
          if (originalImageUrl && originalImageUrl !== uploadResult.publicUrl) {
            setSaveStatus('Limpiando imagen anterior...');
            const delResult = await deleteCampaignImage(originalImageUrl);
            if (!delResult.success) {
              console.warn(delResult.message);
            }
          }
        } 
        // 3. Si el usuario removió la imagen actual
        else if ((campaign.imagen_url === null || campaign.imagen_url === '') && originalImageUrl) {
          setSaveStatus('Borrando imagen anterior de Storage...');
          const delResult = await deleteCampaignImage(originalImageUrl);
          if (!delResult.success) {
            console.warn(delResult.message);
          }
        }
      } else {
        setSaveStatus('Creando campaña...');
        // 1. Crear campaña con imagen nula inicialmente
        const initialPayload = { ...payload, imagen_url: null, popup_imagen_url: null };
        const created = await createCampaign(initialPayload, cleanSelectedProducts);
        const createdId = created.id;

        // 2. Subir imagen local si existe
        if (imageFile) {
          setSaveStatus('Subiendo imagen a Storage...');
          try {
            const uploadResult = await uploadCampaignImage(createdId, imageFile);
            setSaveStatus('Actualizando enlace de imagen...');
            await updateCampaign(createdId, { ...payload, imagen_url: uploadResult.publicUrl, popup_imagen_url: uploadResult.publicUrl }, cleanSelectedProducts);
          } catch (uploadErr) {
            // Rollback campaign creation on image upload fail to prevent orphaned campaigns
            console.error('Fallo al subir imagen en creación. Revirtiendo campaña.', uploadErr);
            setSaveStatus('Revirtiendo campaña creada...');
            await supabase.from('campaigns').delete().eq('id', createdId);
            throw new Error(`Fallo la subida del archivo de imagen: ${uploadErr.message || uploadErr}. La campaña no fue creada.`);
          }
        } 
        // 3. Usar URL externa o biblioteca si fue seleccionada
        else if (campaign.imagen_url) {
          setSaveStatus('Actualizando enlace de imagen...');
          await updateCampaign(createdId, { ...payload, imagen_url: campaign.imagen_url, popup_imagen_url: campaign.imagen_url }, cleanSelectedProducts);
        }
      }

      clearCachedCatalog();
      navigate('/admin/campaigns');
    } catch (err) {
      console.error('Error al guardar campaña:', err);
      setErrorMsg(err.message || 'Error de base de datos.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
      setSaveStatus('');
    }
  };

  if (fetching) {
    return (
      <div className="admin-loading-inner" style={{ color: '#fff' }}>
        <div className="admin-spinner"></div>
        <p>Cargando datos de la campaña...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard admin-form-view" style={{ color: '#fff', backgroundColor: '#0f172a', padding: '24px', borderRadius: 'var(--radius-lg)' }}>
      <div className="view-action-header">
        <h3 style={{ color: '#fff' }}>{isEdit ? `Editar Campaña: ${campaign.nombre}` : 'Agregar Nueva Campaña'}</h3>
        <button 
          onClick={() => navigate('/admin/campaigns')} 
          className="btn btn-secondary"
          disabled={saving}
          style={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff' }}
        >
          Volver a la Lista
        </button>
      </div>

      {infoMsg && <div className="admin-error-alert" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.2)' }}>ℹ️ {infoMsg}</div>}
      {errorMsg && <div className="admin-error-alert" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.2)' }}>{errorMsg}</div>}
      {saveStatus && <div className="admin-error-alert" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.2)' }}>⏳ {saveStatus}</div>}

      <form onSubmit={handleSubmit} className="admin-form-grid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Sección General */}
        <div className="admin-form-section">
          <h3 className="section-subtitle-admin" style={{ color: '#fff' }}>📢 Datos Generales</h3>
          <div className="section-divider-admin"></div>

          <div className="form-row">
            <div className="form-group col">
              <label htmlFor="nombre" style={{ color: '#cbd5e1' }}>Nombre de la campaña *</label>
              <input
                type="text"
                id="nombre"
                placeholder="Ej: Hot Sale 2026 o Banner Inicial"
                value={campaign.nombre}
                onChange={(e) => handleFieldChange('nombre', e.target.value)}
                className={errors.nombre ? 'input-error' : ''}
                disabled={saving}
                style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
              />
              {errors.nombre && <span className="error-text">{errors.nombre}</span>}
            </div>

            <div className="form-group col">
              <label htmlFor="tipo" style={{ color: '#cbd5e1' }}>Tipo de campaña *</label>
              <select
                id="tipo"
                value={campaign.tipo}
                onChange={(e) => handleFieldChange('tipo', e.target.value)}
                disabled={isEdit || saving}
                style={{ backgroundColor: isEdit ? '#0f172a' : '#1e293b', color: '#fff', border: '1px solid #475569' }}
              >
                <option value="promocion">🏷️ Promoción o Descuento</option>
                <option value="popup">📢 Popup o Flyer Informativo</option>
              </select>
              {isEdit && <small className="help-text" style={{ display: 'block', marginTop: '4px', color: '#94a3b8' }}>El tipo de campaña no se puede cambiar en edición.</small>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="descripcion" style={{ color: '#cbd5e1' }}>Descripción de uso interno</label>
            <textarea
              id="descripcion"
              placeholder="Notas sobre el objetivo de la campaña, condiciones, vigencias, etc..."
              value={campaign.descripcion || ''}
              onChange={(e) => handleFieldChange('descripcion', e.target.value)}
              rows="2"
              disabled={saving}
              style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
            />
          </div>

          <div className="form-row">
            <div className="form-group col">
              <label htmlFor="prioridad" style={{ color: '#cbd5e1' }}>Prioridad (Mayor número = Mayor prioridad) *</label>
              <input
                type="number"
                id="prioridad"
                min="0"
                step="1"
                inputMode="numeric"
                value={campaign.prioridad}
                onChange={(e) => handleFieldChange('prioridad', e.target.value)}
                className={errors.prioridad ? 'input-error' : ''}
                aria-invalid={Boolean(errors.prioridad)}
                aria-describedby={errors.prioridad ? 'prioridad-error' : undefined}
                required
                disabled={saving}
                style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
              />
              {errors.prioridad && <span id="prioridad-error" className="error-text" role="alert">{errors.prioridad}</span>}
            </div>

            <div className="form-group col" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <label style={{ color: '#cbd5e1', marginBottom: '8px' }}>Estado de la Campaña</label>
              <label 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  cursor: 'pointer', 
                  color: '#fff',
                  backgroundColor: '#1e293b',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #475569',
                  width: 'fit-content'
                }}
              >
                <div style={{ position: 'relative' }}>
                  <input
                    type="checkbox"
                    checked={campaign.habilitada}
                    onChange={(e) => handleFieldChange('habilitada', e.target.checked)}
                    disabled={saving}
                    style={{
                      opacity: 0,
                      position: 'absolute',
                      width: '40px',
                      height: '20px',
                      margin: 0,
                      cursor: 'pointer',
                      zIndex: 5
                    }}
                  />
                  <div 
                    style={{
                      width: '40px',
                      height: '20px',
                      backgroundColor: campaign.habilitada ? '#10b981' : '#64748b',
                      borderRadius: '10px',
                      transition: 'background-color 0.2s',
                      position: 'relative'
                    }}
                  >
                    <div 
                      style={{
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: campaign.habilitada ? '22px' : '2px',
                        transition: 'left 0.2s'
                      }}
                    />
                  </div>
                </div>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                  {campaign.habilitada ? 'Campaña Habilitada' : 'Campaña Deshabilitada'}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Sección de programación */}
        <CampaignScheduleFields
          campaign={campaign}
          onChange={handleFieldChange}
          errors={errors}
          disabled={saving}
        />

        {/* Flyer / Imagen Configurable (Both Popups and Promos) */}
        <CampaignFlyerFields
          campaign={campaign}
          onChange={handleFieldChange}
          errors={errors}
          products={products}
          categories={categories}
          onImageFileSelect={handleImageFileSelect}
          tempImagePreview={tempImagePreview}
          disabled={saving}
        />

        {/* Sección específica del tipo de campaña */}
        {campaign.tipo === 'popup' ? (
          <CampaignPopupFields
            campaign={campaign}
            onChange={handleFieldChange}
            errors={errors}
            disabled={saving}
          />
        ) : (
          <CampaignPromotionFields
            campaign={campaign}
            onChange={handleFieldChange}
            errors={errors}
            categories={categories}
            products={products}
            selectedProducts={selectedProducts}
            onSelectedProductsChange={setSelectedProducts}
            disabled={saving}
          />
        )}

        {/* Guardar */}
        <div className="form-submit-row">
          <button 
            type="submit" 
            className="btn btn-primary btn-large" 
            disabled={saving}
          >
            {saving ? (saveStatus || 'Guardando cambios...') : '💾 Guardar Campaña'}
          </button>
        </div>
      </form>
    </div>
  );
}
