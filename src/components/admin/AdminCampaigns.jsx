import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  deleteCampaign, 
  getActiveCampaignsList, 
  getCampaigns, 
  getCampaignById, 
  createCampaign, 
  getCampaignProducts, 
  toggleCampaignEnabled 
} from '../../services/campaignService';
import { deleteCampaignImage } from '../../services/campaignImageService';
import { supabase } from '../../supabaseClient';
import { clearCachedCatalog } from '../../lib/catalogCache';
import { Pencil, Trash2, RefreshCw, Bookmark, Power } from 'lucide-react';

// Compact and responsive thumbnail component
function CampaignThumbnail({ imageUrl, name, onClick }) {
  const [hasError, setHasError] = useState(false);

  if (!imageUrl || hasError) {
    return (
      <div 
        className="campaign-thumbnail-placeholder"
        style={{
          width: '72px',
          height: '72px',
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
          fontSize: '0.65rem',
          flexShrink: 0,
          boxSizing: 'border-box'
        }}
        title="Sin imagen"
      >
        <span style={{ fontSize: '1.2rem', marginBottom: '2px' }}>🖼️</span>
        <span>Sin imagen</span>
      </div>
    );
  }

  return (
    <img 
      src={imageUrl} 
      alt={`Flyer de ${name}`}
      loading="lazy"
      onError={() => setHasError(true)}
      onClick={onClick}
      className="campaign-thumbnail-img"
      style={{
        width: '72px',
        height: '72px',
        objectFit: 'contain',
        objectPosition: 'center',
        backgroundColor: '#0f172a',
        border: '1px solid #334155',
        borderRadius: '6px',
        cursor: 'pointer',
        flexShrink: 0,
        boxSizing: 'border-box',
        transition: 'transform 0.2s, border-color 0.2s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.borderColor = '#38bdf8';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.borderColor = '#334155';
      }}
    />
  );
}

export default function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaignIds, setActiveCampaignIds] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal Preview state
  const [previewImage, setPreviewImage] = useState(null);
  
  // Filters State
  const [filterTipo, setFilterTipo] = useState('todos'); 
  const [filterEstado, setFilterEstado] = useState('todos'); // 'todos', 'activas', 'inactivas', 'plantillas'
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  // Listen to Escape key to close image modal
  useEffect(() => {
    if (!previewImage) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setPreviewImage(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage]);

  // Polling to update active_campaigns in real-time
  useEffect(() => {
    const fetchActiveOnly = async () => {
      try {
        const activeIds = await getActiveCampaignsList();
        setActiveCampaignIds(activeIds);
      } catch (err) {
        console.warn('Error en polling de active_campaigns:', err);
      }
    };

    // Poll every 30 seconds
    const interval = setInterval(fetchActiveOnly, 30000);

    // Refresh immediately when tab gains focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchActiveOnly();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const campaignsData = await getCampaigns();
      setCampaigns(campaignsData);

      const activeIds = await getActiveCampaignsList();
      setActiveCampaignIds(activeIds);

      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('id, nombre');
      if (catError) throw catError;
      setCategories(catData || []);

    } catch (err) {
      console.error('Error al cargar campañas en Supabase:', err);
      setErrorMsg('No se pudieron obtener las campañas de la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnable = async (campaign) => {
    setErrorMsg('');
    setSuccessMsg('');
    const newEnabled = !campaign.habilitada;
    const actionText = newEnabled ? 'habilitar' : 'deshabilitar';
    if (!window.confirm(`¿Seguro que querés ${actionText} la campaña "${campaign.nombre}"?`)) return;

    try {
      await toggleCampaignEnabled(campaign.id, newEnabled);
      
      // Update local state immediately
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, habilitada: newEnabled } : c));
      
      // Re-fetch active_campaigns list
      const activeIds = await getActiveCampaignsList();
      setActiveCampaignIds(activeIds);

      setSuccessMsg(`Campaña "${campaign.nombre}" ${newEnabled ? 'habilitada' : 'deshabilitada'} con éxito.`);
      setTimeout(() => setSuccessMsg(''), 3000);

      clearCachedCatalog();
    } catch (err) {
      console.error('Error en toggle campaign enable:', err);
      setErrorMsg(`No se pudo cambiar el estado: ${err.message || err}`);
    }
  };

  // Reusable duplication logic for "Reutilizar/Reprogramar" or "Plantilla"
  const handleReutilizar = async (campaignId, nombre) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!window.confirm(`¿Querés reutilizar la campaña "${nombre}"? Se creará una copia deshabilitada para que configures nuevas fechas.`)) return;

    try {
      const campaignObj = await getCampaignById(campaignId);
      const relations = await getCampaignProducts(campaignId);

      const { id: _id, order_number: _on, creado_por: _cp, actualizado_por: _ap, fecha_creacion: _fc, fecha_actualizacion: _fa, ...cleanCampaign } = campaignObj;
      const copyPayload = {
        ...cleanCampaign,
        nombre: `${campaignObj.nombre} Copia`,
        estado: 'pausada',
        habilitada: false,
        fecha_inicio: null,
        fecha_fin: null,
        fecha_recurrencia_inicio: null,
        fecha_recurrencia_fin: null
      };

      const selectedProducts = relations.map(r => ({
        product_id: r.product_id,
        incluido: r.incluido,
        isCustomDiscount: !!r.tipo_descuento,
        tipo_descuento: r.tipo_descuento,
        porcentaje: r.porcentaje,
        importe_fijo: r.importe_fijo,
        precio_fijo: r.precio_fijo,
        cantidad_compra: r.cantidad_compra,
        cantidad_paga: r.cantidad_paga,
        texto_etiqueta: r.texto_etiqueta
      }));

      const copy = await createCampaign(copyPayload, selectedProducts);

      navigate(`/admin/campaigns/edit/${copy.id}`, {
        state: { infoMsg: 'La campaña fue duplicada. Habilitala tras configurar sus fechas.' }
      });

    } catch (err) {
      console.error('Error al reutilizar campaña:', err);
      setErrorMsg(`No se pudo reutilizar la campaña: ${err.message || err}`);
    }
  };

  // Duplicate as Template handler
  const handleGuardarComoPlantilla = async (campaignId, nombre) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!window.confirm(`¿Querés guardar la campaña "${nombre}" como plantilla reusable?`)) return;

    try {
      const campaignObj = await getCampaignById(campaignId);
      const relations = await getCampaignProducts(campaignId);

      const { id: _id, order_number: _on, creado_por: _cp, actualizado_por: _ap, fecha_creacion: _fc, fecha_actualizacion: _fa, ...cleanCampaign } = campaignObj;
      const copyPayload = {
        ...cleanCampaign,
        nombre: `${campaignObj.nombre} Plantilla`,
        estado: 'pausada',
        habilitada: false,
        fecha_inicio: null,
        fecha_fin: null,
        fecha_recurrencia_inicio: null,
        fecha_recurrencia_fin: null
      };

      const selectedProducts = relations.map(r => ({
        product_id: r.product_id,
        incluido: r.incluido,
        isCustomDiscount: !!r.tipo_descuento,
        tipo_descuento: r.tipo_descuento,
        porcentaje: r.porcentaje,
        importe_fijo: r.importe_fijo,
        precio_fijo: r.precio_fijo,
        cantidad_compra: r.cantidad_compra,
        cantidad_paga: r.cantidad_paga,
        texto_etiqueta: r.texto_etiqueta
      }));

      await createCampaign(copyPayload, selectedProducts);
      await fetchData();
      setSuccessMsg('Plantilla guardada y añadida al catálogo de campañas con éxito.');
      setTimeout(() => setSuccessMsg(''), 4500);

    } catch (err) {
      console.error('Error al guardar plantilla:', err);
      setErrorMsg(`No se pudo guardar la plantilla: ${err.message || err}`);
    }
  };

  // Delete Campaign
  const handleDelete = async (id, nombre, popupImageUrl) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!window.confirm(`¿Seguro que querés eliminar la campaña "${nombre}"? Esta acción borrará todas sus relaciones y es irreversible.`)) return;

    try {
      await deleteCampaign(id);
      setCampaigns(prev => prev.filter(c => c.id !== id));
      clearCachedCatalog();
      
      setSuccessMsg('Campaña eliminada de la base de datos con éxito.');
      setTimeout(() => setSuccessMsg(''), 3000);

      if (popupImageUrl) {
        const delResult = await deleteCampaignImage(popupImageUrl);
        if (!delResult.success) {
          console.warn(delResult.message);
        }
      }
    } catch (err) {
      console.error('Error al eliminar campaña:', err);
      setErrorMsg('No se pudo eliminar la campaña de la base de datos.');
    }
  };

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      const matchSearch = c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (c.descripcion && c.descripcion.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchTipo = filterTipo === 'todos' || c.tipo === filterTipo;

      const isActive = activeCampaignIds.includes(c.id) && c.habilitada;
      let matchEstado = true;

      if (filterEstado !== 'todos') {
        if (filterEstado === 'activas') {
          matchEstado = isActive;
        } else if (filterEstado === 'inactivas') {
          matchEstado = !isActive;
        } else if (filterEstado === 'plantillas') {
          // Plantilla: estado Borrador (o pausado) deshabilitado sin fecha
          matchEstado = c.habilitada === false && !c.fecha_inicio && !c.fecha_recurrencia_inicio;
        }
      }

      return matchSearch && matchTipo && matchEstado;
    });
  }, [campaigns, searchQuery, filterTipo, filterEstado, activeCampaignIds]);

  const formatCompactDate = (dateString) => {
    if (!dateString) return { date: 'N/A', time: '' };
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return { date: 'N/A', time: '' };
    
    const pad = (num) => String(num).padStart(2, '0');
    const datePart = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const timePart = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return { date: datePart, time: timePart };
  };

  const getScheduleSummary = (c) => {
    const start = c.fecha_inicio ? new Date(c.fecha_inicio) : null;
    const end = c.fecha_fin ? new Date(c.fecha_fin) : null;
    const pad = (num) => String(num).padStart(2, '0');
    
    if (c.tipo_programacion === 'puntual') {
      const startDate = start 
        ? `${pad(start.getDate())}/${pad(start.getMonth() + 1)}/${start.getFullYear()}`
        : 'Inmediato';
      
      const startTime = start ? `${pad(start.getHours())}:${pad(start.getMinutes())}` : '';
      const endTime = end ? `${pad(end.getHours())}:${pad(end.getMinutes())}` : 'Siempre';
      const timeRange = startTime ? ` · ${startTime}–${endTime}` : '';
        
      return (
        <div style={{ fontSize: '0.8rem', lineHeight: '1.3' }}>
          <div style={{ fontWeight: '600', color: '#fff' }}>Puntual</div>
          <div style={{ color: '#cbd5e1', fontSize: '0.75rem', marginTop: '2px' }}>
            {startDate}{timeRange}
          </div>
        </div>
      );
    } else {
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const days = (c.dias_semana || []).map(d => dayNames[d]).join(', ');
      
      return (
        <div style={{ fontSize: '0.8rem', lineHeight: '1.3' }}>
          <div style={{ fontWeight: '600', color: '#fff' }}>Semanal</div>
          <div style={{ color: '#cbd5e1', fontSize: '0.75rem', marginTop: '2px' }}>
            {days || 'Ninguno'} · {c.hora_inicio || '00:00'}–{c.hora_fin || '23:59'}
          </div>
        </div>
      );
    }
  };

  const getPromoDestSummary = (c) => {
    const isVisual = c.mostrar_imagen;
    const dest = c.destino_tipo && c.destino_tipo !== 'ninguno'
      ? `Flyer → ${c.destino_tipo.replace('_', ' ')}`
      : 'Flyer → Informativo';

    if (c.tipo === 'popup') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.8rem', lineHeight: '1.3' }}>
          <div style={{ color: '#fff', fontWeight: '500' }}>Popup Informativo</div>
          {isVisual && <div style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>{dest}</div>}
        </div>
      );
    }

    const scope = c.alcance_promocion === 'todos' 
      ? 'Todo el catálogo' 
      : c.alcance_promocion === 'categoria' 
      ? `Categoría: ${categories.find(cat => cat.id === c.categoria_id)?.nombre || 'Cat. borrada'}`
      : 'Productos selecc.';
      
    const disc = c.tipo_descuento === 'porcentaje'
      ? `${c.porcentaje}% OFF`
      : c.tipo_descuento === 'importe_fijo'
      ? `$${c.importe_fijo} OFF`
      : c.tipo_descuento === 'precio_fijo'
      ? `Precio Fijo: $${c.precio_fijo}`
      : `${c.cantidad_compra}x${c.cantidad_paga}`;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.8rem', lineHeight: '1.3' }}>
        <div style={{ color: '#fff', fontWeight: '500' }}>{`${scope} · ${disc}`}</div>
        {isVisual && <div style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>{dest}</div>}
      </div>
    );
  };

  const getStatusBadge = (c) => {
    const isActive = activeCampaignIds.includes(c.id) && c.habilitada;
    
    let color = '#ef4444';
    let bgColor = 'rgba(239, 68, 68, 0.15)';
    let statusText = 'Inactiva';
    
    if (isActive) {
      color = '#10b981';
      bgColor = 'rgba(16, 185, 129, 0.15)';
      statusText = 'Activa';
    } else {
      color = '#94a3b8';
      bgColor = 'rgba(148, 163, 184, 0.12)';
    }

    // Calculate inactivity reason
    let motivo = '';
    if (!isActive) {
      if (!c.habilitada) {
        motivo = 'Deshabilitada manualmente';
      } else {
        const ahora = new Date();
        if (c.tipo_programacion === 'puntual') {
          const inicio = c.fecha_inicio ? new Date(c.fecha_inicio) : null;
          const fin = c.fecha_fin ? new Date(c.fecha_fin) : null;
          if (inicio && ahora < inicio) {
            motivo = 'Todavía no comenzó';
          } else if (fin && ahora > fin) {
            motivo = 'Horario finalizado';
          } else {
            motivo = 'Fuera de rango horario';
          }
        } else if (c.tipo_programacion === 'semanal') {
          const recInicio = c.fecha_recurrencia_inicio ? new Date(c.fecha_recurrencia_inicio) : null;
          const recFin = c.fecha_recurrencia_fin ? new Date(c.fecha_recurrencia_fin) : null;
          
          if (recInicio && ahora < recInicio) {
            motivo = 'Todavía no comenzó';
          } else if (recFin && ahora > recFin) {
            motivo = 'Horario finalizado';
          } else {
            const dayHoy = ahora.getDay(); 
            const diasConfigurados = c.dias_semana || [];
            if (!diasConfigurados.includes(dayHoy)) {
              motivo = 'Fuera del horario semanal';
            } else {
              motivo = 'Fuera de horario diario';
            }
          }
        } else {
          motivo = 'Configuración incompleta';
        }
      }
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
        <span 
          style={{ 
            fontSize: '0.75rem', 
            fontWeight: 'bold', 
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: '12px',
            color,
            backgroundColor: bgColor,
            display: 'inline-block'
          }}
        >
          {statusText}
        </span>
        {motivo && (
          <span 
            style={{ 
              fontSize: '0.68rem', 
              color: '#94a3b8', 
              fontWeight: '500', 
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '120px',
              textAlign: 'center'
            }}
            title={motivo}
          >
            {motivo}
          </span>
        )}
      </div>
    );
  };

  const getTypeBadge = (c) => {
    const isVisual = c.mostrar_imagen;
    const badgeText = c.tipo === 'popup' ? 'Popup' : 'Promoción';
    const color = c.tipo === 'popup' ? '#60a5fa' : '#34d399';
    const bgColor = c.tipo === 'popup' ? 'rgba(96, 165, 250, 0.15)' : 'rgba(52, 211, 153, 0.15)';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
        <span 
          style={{ 
            fontSize: '0.75rem', 
            fontWeight: 'bold', 
            padding: '3px 8px', 
            borderRadius: '12px',
            color,
            backgroundColor: bgColor,
            display: 'inline-block'
          }}
        >
          {badgeText}
        </span>
        {isVisual && (
          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
            Con flyer
          </span>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="admin-loading-inner" style={{ color: '#fff' }}>
        <div className="admin-spinner"></div>
        <p>Cargando listado de campañas...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard admin-products-view" style={{ color: '#fff', backgroundColor: '#0f172a', padding: '24px', borderRadius: 'var(--radius-lg)' }}>
      <div className="view-action-header">
        <h3 style={{ color: '#fff' }}>📢 Campañas y Promociones</h3>
        <button 
          onClick={() => navigate('/admin/campaigns/new')} 
          className="btn btn-primary"
        >
          ➕ Nueva Campaña
        </button>
      </div>

      {errorMsg && <div className="admin-error-alert" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.2)' }}>{errorMsg}</div>}
      {successMsg && <div className="admin-error-alert" style={{ backgroundColor: 'rgba(72, 187, 120, 0.1)', color: '#48bb78', borderColor: 'rgba(72, 187, 120, 0.2)' }}>{successMsg}</div>}

      {/* Filters bar */}
      <div className="products-filter-row" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
        <div style={{ flex: '1', minWidth: '200px' }}>
          <input
            type="text"
            placeholder="Buscar por nombre o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid #475569', backgroundColor: '#1e293b', color: '#fff' }}
          />
        </div>
        
        <div>
          <select 
            value={filterTipo} 
            onChange={(e) => setFilterTipo(e.target.value)}
            style={{ padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid #475569', backgroundColor: '#1e293b', color: '#fff', cursor: 'pointer' }}
          >
            <option value="todos">Todos los tipos</option>
            <option value="promocion">🏷️ Promociones</option>
            <option value="popup">📢 Popups/Flyers</option>
          </select>
        </div>

        <div>
          <select 
            value={filterEstado} 
            onChange={(e) => setFilterEstado(e.target.value)}
            style={{ padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid #475569', backgroundColor: '#1e293b', color: '#fff', cursor: 'pointer' }}
          >
            <option value="todos">Todos los estados</option>
            <option value="activas">🟢 Activas</option>
            <option value="inactivas">🔴 Inactivas</option>
            <option value="plantillas">📋 Plantillas (Deshabilitadas sin fechas)</option>
          </select>
        </div>
      </div>

      {filteredCampaigns.length > 0 ? (
        <>
          {/* Desktop Table View */}
          <div className="products-table-container admin-desktop-only" style={{ border: '1px solid #334155', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #334155', textAlign: 'left', fontSize: '0.85rem', color: '#cbd5e1' }}>
                  <th style={{ padding: '10px 12px', width: '24%', verticalAlign: 'middle' }}>Campaña</th>
                  <th style={{ padding: '10px 12px', width: '10%', textAlign: 'center', verticalAlign: 'middle' }}>Tipo</th>
                  <th style={{ padding: '10px 12px', width: '14%', verticalAlign: 'middle' }}>Programación</th>
                  <th style={{ padding: '10px 12px', width: '19%', verticalAlign: 'middle' }}>Resumen</th>
                  <th className="admin-campaign-priority" style={{ padding: '10px 12px', width: '6%', textAlign: 'center', verticalAlign: 'middle' }}>Prioridad</th>
                  <th style={{ padding: '10px 12px', width: '12%', textAlign: 'center', verticalAlign: 'middle' }}>Estado</th>
                  <th style={{ padding: '10px 12px', width: '8%', verticalAlign: 'middle' }}>Actualización</th>
                  <th style={{ padding: '10px 12px', width: '12%', textAlign: 'center', verticalAlign: 'middle' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((c) => {
                  const cleanDesc = c.descripcion && c.descripcion.trim() !== c.nombre.trim() ? c.descripcion : '';
                  const updateTime = formatCompactDate(c.fecha_actualizacion);
                  const activeImg = c.imagen_url || c.popup_imagen_url;
                  
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #334155', fontSize: '0.85rem', color: '#fff', backgroundColor: '#1e293b', transition: 'background-color 0.2s' }}>
                      
                      {/* Columna Campaña con Miniatura */}
                      <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                          <CampaignThumbnail 
                            imageUrl={activeImg}
                            name={c.nombre}
                            onClick={() => setPreviewImage(activeImg)}
                          />
                          <div style={{ display: 'block', overflow: 'hidden', flex: 1 }} title={c.nombre}>
                            <div style={{ fontWeight: '700', fontSize: '0.88rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {c.nombre}
                            </div>
                            {cleanDesc && (
                              <div 
                                style={{ 
                                  fontSize: '0.75rem', 
                                  color: '#cbd5e1', 
                                  marginTop: '2px', 
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {cleanDesc}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Columna Tipo */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', verticalAlign: 'middle' }}>
                        {getTypeBadge(c)}
                      </td>

                      {/* Columna Programación */}
                      <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                        {getScheduleSummary(c)}
                      </td>

                      {/* Columna Resumen */}
                      <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                        <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {getPromoDestSummary(c)}
                        </div>
                      </td>

                      {/* Columna Prioridad */}
                      <td className="admin-campaign-priority" style={{ padding: '10px 12px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 'bold' }}>
                        {c.prioridad}
                      </td>

                      {/* Columna Estado */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', verticalAlign: 'middle' }}>
                        {getStatusBadge(c)}
                      </td>

                      {/* Columna Actualización */}
                      <td style={{ padding: '10px 12px', verticalAlign: 'middle', color: '#cbd5e1', lineHeight: '1.3' }}>
                        <div>{updateTime.date}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{updateTime.time}</div>
                      </td>

                      {/* Columna Acciones */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap' }}>
                          {/* Quick Enable Toggle */}
                          <button
                            onClick={() => handleToggleEnable(c)}
                            style={{ 
                              border: 'none', 
                              backgroundColor: 'transparent', 
                              cursor: 'pointer', 
                              color: c.habilitada ? '#10b981' : '#94a3b8', 
                              padding: 0,
                              width: '36px',
                              height: '36px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '50%',
                              transition: 'background-color 0.2s, color 0.2s'
                            }}
                            title={c.habilitada ? 'Desactivar campaña' : 'Activar campaña'}
                            aria-label={c.habilitada ? 'Desactivar campaña' : 'Activar campaña'}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Power size={16} style={{ strokeWidth: 2.5 }} />
                          </button>

                          <button
                            onClick={() => navigate(`/admin/campaigns/edit/${c.id}`)}
                            style={{ 
                              border: 'none', 
                              backgroundColor: 'transparent', 
                              cursor: 'pointer', 
                              color: '#60a5fa', 
                              padding: 0,
                              width: '36px',
                              height: '36px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '50%',
                              transition: 'background-color 0.2s'
                            }}
                            title="Editar campaña"
                            aria-label="Editar campaña"
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Pencil size={16} />
                          </button>
                          
                          <button
                            onClick={() => handleReutilizar(c.id, c.nombre)}
                            style={{ 
                              border: 'none', 
                              backgroundColor: 'transparent', 
                              cursor: 'pointer', 
                              color: '#38bdf8', 
                              padding: 0,
                              width: '36px',
                              height: '36px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '50%',
                              transition: 'background-color 0.2s'
                            }}
                            title="Reutilizar campaña"
                            aria-label="Reutilizar campaña"
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <RefreshCw size={16} />
                          </button>
                          
                          <button
                            onClick={() => handleGuardarComoPlantilla(c.id, c.nombre)}
                            style={{ 
                              border: 'none', 
                              backgroundColor: 'transparent', 
                              cursor: 'pointer', 
                              color: '#fbbf24', 
                              padding: 0,
                              width: '36px',
                              height: '36px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '50%',
                              transition: 'background-color 0.2s'
                            }}
                            title="Guardar como plantilla"
                            aria-label="Guardar como plantilla"
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Bookmark size={16} />
                          </button>
                          
                          <button
                            onClick={() => handleDelete(c.id, c.nombre, c.imagen_url || c.popup_imagen_url)}
                            style={{ 
                              border: 'none', 
                              backgroundColor: 'transparent', 
                              cursor: 'pointer', 
                              color: '#f87171', 
                              padding: 0,
                              width: '36px',
                              height: '36px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '50%',
                              transition: 'background-color 0.2s'
                            }}
                            title="Eliminar campaña"
                            aria-label="Eliminar campaña"
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="campaigns-mobile-cards admin-mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredCampaigns.map((c) => {
              const cleanDesc = c.descripcion && c.descripcion.trim() !== c.nombre.trim() ? c.descripcion : '';
              const updateTime = formatCompactDate(c.fecha_actualizacion);
              const activeImg = c.imagen_url || c.popup_imagen_url;
              
              return (
                <div 
                  key={c.id} 
                  style={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #334155', 
                    borderRadius: '8px', 
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  {/* Fila superior: Miniatura, Nombre y Estado */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <CampaignThumbnail 
                      imageUrl={activeImg}
                      name={c.nombre}
                      onClick={() => setPreviewImage(activeImg)}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ overflow: 'hidden' }}>
                          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.nombre}
                          </h4>
                          {cleanDesc && (
                            <p 
                              style={{ 
                                margin: '4px 0 0 0', 
                                fontSize: '0.78rem', 
                                color: '#cbd5e1',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {cleanDesc}
                            </p>
                          )}
                        </div>
                        <div style={{ flexShrink: 0 }}>
                          {getStatusBadge(c)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fila intermedia: Tipo y Programación */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #334155', paddingTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: '600' }}>Tipo:</span>
                      {getTypeBadge(c)}
                      <span style={{ fontSize: '0.75rem', color: '#cbd5e1', marginLeft: 'auto' }}>Prioridad: <b>{c.prioridad}</b></span>
                    </div>
                    <div>
                      {getScheduleSummary(c)}
                    </div>
                  </div>

                  {/* Resumen */}
                  <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '6px', fontSize: '0.8rem' }}>
                    {getPromoDestSummary(c)}
                  </div>

                  {/* Actualización y Acciones */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #334155', paddingTop: '8px', marginTop: '4px' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: '1.2' }}>
                      Actualizado: {updateTime.date} {updateTime.time}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {/* Mobile Power Toggle */}
                      <button
                        onClick={() => handleToggleEnable(c)}
                        style={{ border: 'none', backgroundColor: 'transparent', color: c.habilitada ? '#10b981' : '#94a3b8', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
                        title={c.habilitada ? 'Desactivar' : 'Activar'}
                        aria-label={c.habilitada ? 'Desactivar' : 'Activar'}
                      >
                        <Power size={16} style={{ strokeWidth: 2.5 }} />
                      </button>

                      <button
                        onClick={() => navigate(`/admin/campaigns/edit/${c.id}`)}
                        style={{ border: 'none', backgroundColor: 'transparent', color: '#60a5fa', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
                        title="Editar"
                        aria-label="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleReutilizar(c.id, c.nombre)}
                        style={{ border: 'none', backgroundColor: 'transparent', color: '#38bdf8', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
                        title="Reutilizar"
                        aria-label="Reutilizar"
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button
                        onClick={() => handleGuardarComoPlantilla(c.id, c.nombre)}
                        style={{ border: 'none', backgroundColor: 'transparent', color: '#fbbf24', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
                        title="Guardar plantilla"
                        aria-label="Guardar plantilla"
                      >
                        <Bookmark size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id, c.nombre, c.imagen_url || c.popup_imagen_url)}
                        style={{ border: 'none', backgroundColor: 'transparent', color: '#f87171', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
                        title="Eliminar"
                        aria-label="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed #334155', borderRadius: 'var(--radius-lg)', color: '#cbd5e1' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📢</div>
          <h4>No se encontraron campañas ni promociones</h4>
          <p style={{ maxWidth: '400px', margin: '0 auto 15px auto', fontSize: '0.85rem', color: '#cbd5e1' }}>
            {searchQuery || filterTipo !== 'todos' || filterEstado !== 'todos'
              ? 'Probá cambiando los filtros o la búsqueda actual.'
              : 'Gatillá promociones automáticas y muestra comunicados o avisos a los clientes.'}
          </p>
          <button 
            onClick={() => navigate('/admin/campaigns/new')} 
            className="btn btn-primary"
          >
            ➕ Nueva Campaña
          </button>
        </div>
      )}

      {/* Modal Preview for Full Flyer Image */}
      {previewImage && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(5px)',
            zIndex: 100000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '24px',
            boxSizing: 'border-box'
          }}
          onClick={() => setPreviewImage(null)}
        >
          <div 
            style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: '-45px',
                right: '0px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                color: '#000000',
                border: 'none',
                fontWeight: '900',
                fontSize: '1.4rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                zIndex: 10,
                padding: 0
              }}
              aria-label="Cerrar vista previa"
            >
              &times;
            </button>
            <img 
              src={previewImage} 
              alt="Vista previa del flyer completo" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '85vh', 
                objectFit: 'contain', 
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                display: 'block'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
