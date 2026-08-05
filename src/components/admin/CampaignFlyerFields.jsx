import React, { useState, useMemo } from 'react';
import CampaignImageSelector from './CampaignImageSelector';

export default function CampaignFlyerFields({
  campaign,
  onChange,
  errors,
  products = [],
  categories = [],
  onImageFileSelect,        // (file, localPreviewUrl)
  tempImagePreview          // Local preview URL blob
}) {
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [previewDevice, setPreviewDevice] = useState('escritorio'); // 'escritorio' or 'movil'

  // Search products locally
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 10);
    const query = productSearch.toLowerCase();
    return products.filter(p => 
      p.nombre.toLowerCase().includes(query) || 
      (p.marca && p.marca.toLowerCase().includes(query))
    ).slice(0, 10);
  }, [products, productSearch]);

  // Extract unique sections from products
  const uniqueSections = useMemo(() => {
    const sections = new Set();
    products.forEach(p => {
      if (p.seccion) sections.add(p.seccion);
    });
    return Array.from(sections).sort();
  }, [products]);

  const handleProductSelect = (product) => {
    onChange('destino_valor', `/${product.slug}`);
    setProductSearch(product.nombre);
    setShowProductDropdown(false);
  };

  const getDestValueLabel = () => {
    const type = campaign.destino_tipo;
    const val = campaign.destino_valor;

    if (!val) return 'Ninguno';

    if (type === 'producto') {
      const match = products.find(p => `/${p.slug}` === val);
      return match ? `Producto: ${match.nombre}` : val;
    }
    if (type === 'categoria') {
      const match = categories.find(c => c.id === val);
      return match ? `Categoría: ${match.nombre}` : val;
    }
    return val;
  };

  const displayPreviewUrl = tempImagePreview || campaign.imagen_url || campaign.popup_imagen_url;

  return (
    <div className="admin-form-section">
      <h3 className="section-subtitle-admin" style={{ color: '#fff' }}>🖼️ Flyer de la Campaña</h3>
      <div className="section-divider-admin"></div>

      {/* Toggle to show flyer */}
      <div className="form-checkboxes-group" style={{ marginBottom: '15px' }}>
        <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#fff' }}>
          <input
            type="checkbox"
            checked={campaign.mostrar_imagen || false}
            onChange={(e) => onChange('mostrar_imagen', e.target.checked)}
          />
          <span>Mostrar flyer visual en la web</span>
        </label>
      </div>

      {campaign.mostrar_imagen && (
        <>
          {/* Image Selector Component */}
          <div className="form-group">
            <label style={{ color: '#cbd5e1' }}>Seleccionar imagen para el flyer *</label>
            <CampaignImageSelector
              currentImageUrl={campaign.imagen_url || campaign.popup_imagen_url}
              onImageSelected={(url, file, _mode) => {
                if (file) {
                  onImageFileSelect(file, url);
                } else {
                  onImageFileSelect(null, '');
                  onChange('imagen_url', url);
                }
              }}
              onImageCleared={() => {
                onImageFileSelect(null, '');
                onChange('imagen_url', null);
              }}
            />
            {errors.imagen_url && <span className="error-text">{errors.imagen_url}</span>}
          </div>

          {/* Configuration of appearance (Frecuencia, Dispositivo, etc.) */}
          {displayPreviewUrl && (
            <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #334155', borderRadius: 'var(--radius-md)', backgroundColor: '#1e293b' }}>
              <h4 style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '12px' }}>⚙️ Configuración de aparición</h4>
              
              <div className="form-row">
                <div className="form-group col">
                  <label htmlFor="popup_frecuencia" style={{ color: '#cbd5e1' }}>Frecuencia *</label>
                  <select
                    id="popup_frecuencia"
                    value={campaign.popup_frecuencia || 'una_vez_sesion'}
                    onChange={(e) => onChange('popup_frecuencia', e.target.value)}
                    style={{ backgroundColor: '#0f172a', color: '#fff', border: '1px solid #475569' }}
                  >
                    <option value="siempre">En cada carga</option>
                    <option value="una_vez_sesion">Una vez por sesión</option>
                    <option value="una_vez_dia">Una vez por día</option>
                    <option value="una_vez_total">Una sola vez</option>
                  </select>
                  <small style={{ display: 'block', marginTop: '6px', color: '#94a3b8', fontSize: '0.75rem' }}>
                    {campaign.popup_frecuencia === 'siempre' && 'En cada carga: vuelve a mostrarse cuando se recarga o vuelve a entrar.'}
                    {campaign.popup_frecuencia === 'una_vez_sesion' && 'Una vez por sesión: se muestra una sola vez mientras dure la sesión del navegador.'}
                    {campaign.popup_frecuencia === 'una_vez_dia' && 'Una vez por día: se muestra una vez por día en ese navegador.'}
                    {campaign.popup_frecuencia === 'una_vez_total' && 'Una sola vez: no vuelve a mostrarse en ese navegador.'}
                    {!campaign.popup_frecuencia && 'Una vez por sesión: se muestra una sola vez mientras dure la sesión del navegador.'}
                  </small>
                </div>

                <div className="form-group col">
                  <label htmlFor="popup_dispositivo" style={{ color: '#cbd5e1' }}>Dispositivo *</label>
                  <select
                    id="popup_dispositivo"
                    value={campaign.popup_dispositivo || 'todos'}
                    onChange={(e) => onChange('popup_dispositivo', e.target.value)}
                    style={{ backgroundColor: '#0f172a', color: '#fff', border: '1px solid #475569' }}
                  >
                    <option value="todos">Todos</option>
                    <option value="movil">Solo móvil</option>
                    <option value="escritorio">Solo escritorio</option>
                  </select>
                </div>
              </div>

              <div className="form-row" style={{ marginTop: '10px' }}>
                <div className="form-group col">
                  <label htmlFor="popup_retraso_segundos" style={{ color: '#cbd5e1' }}>Retraso antes de mostrar (segundos)</label>
                  <input
                    type="number"
                    id="popup_retraso_segundos"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    placeholder="Ej: 10"
                    value={campaign.popup_retraso_segundos !== undefined ? campaign.popup_retraso_segundos : ''}
                    onChange={(e) => onChange('popup_retraso_segundos', e.target.value)}
                    className={errors.popup_retraso_segundos ? 'input-error' : ''}
                    aria-invalid={Boolean(errors.popup_retraso_segundos)}
                    aria-describedby={errors.popup_retraso_segundos ? 'popup-retraso-error' : undefined}
                    style={{ backgroundColor: '#0f172a', color: '#fff', border: '1px solid #475569' }}
                  />
                  {errors.popup_retraso_segundos && <span id="popup-retraso-error" className="error-text" role="alert">{errors.popup_retraso_segundos}</span>}
                </div>

                <div className="form-group col" style={{ display: 'flex', alignItems: 'center', height: '100%', marginTop: '30px' }}>
                  <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#fff' }}>
                    <input
                      type="checkbox"
                      checked={campaign.popup_se_puede_cerrar !== false}
                      onChange={(e) => onChange('popup_se_puede_cerrar', e.target.checked)}
                    />
                    <span>Permitir cerrar el flyer</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Action Destination configuration */}
          <div className="form-row" style={{ marginTop: '15px' }}>
            <div className="form-group col">
              <label htmlFor="destino_tipo" style={{ color: '#cbd5e1' }}>Al tocar la imagen (Acción de destino)</label>
              <select
                id="destino_tipo"
                value={campaign.destino_tipo || 'ninguno'}
                onChange={(e) => {
                  onChange('destino_tipo', e.target.value);
                  onChange('destino_valor', '');
                }}
                style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
              >
                <option value="ninguno">No hacer nada (solo informativo)</option>
                <option value="producto">Ir a un producto específico</option>
                <option value="categoria">Filtrar por una categoría</option>
                <option value="seccion">Ir a una sección del catálogo</option>
                <option value="ruta_interna">Abrir una ruta interna (ej: /contacto)</option>
                <option value="url_externa">Abrir una página externa (ej: https://site.com)</option>
                <option value="whatsapp">Abrir chat de WhatsApp</option>
              </select>
            </div>

            <div className="form-group col" style={{ position: 'relative' }}>
              <label htmlFor="destino_valor" style={{ color: '#cbd5e1' }}>Valor del destino *</label>

              {campaign.destino_tipo === 'producto' && (
                <>
                  <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    className={errors.destino_valor ? 'input-error' : ''}
                    style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
                  />
                  {showProductDropdown && (
                    <div 
                      className="product-autocomplete-dropdown" 
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 99,
                        border: '1px solid #475569',
                        backgroundColor: '#1e293b',
                        borderRadius: 'var(--radius-md)',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                      }}
                    >
                      {filteredProducts.map(p => (
                        <div
                          key={p.id}
                          onClick={() => handleProductSelect(p)}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            borderBottom: '1px solid #334155',
                            color: '#fff'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#334155'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <img 
                            src={p.imagen_principal || '/placeholder.png'} 
                            alt={p.nombre} 
                            style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '4px' }}
                          />
                          <div>
                            <div style={{ fontWeight: '500', fontSize: '0.85rem' }}>{p.nombre}</div>
                            <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>${p.precio}</div>
                          </div>
                        </div>
                      ))}
                      {filteredProducts.length === 0 && (
                        <div style={{ padding: '8px 12px', color: '#cbd5e1' }}>No se encontraron productos</div>
                      )}
                    </div>
                  )}
                </>
              )}

              {campaign.destino_tipo === 'categoria' && (
                <select
                  value={campaign.destino_valor || ''}
                  onChange={(e) => onChange('destino_valor', e.target.value)}
                  className={errors.destino_valor ? 'input-error' : ''}
                  style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
                >
                  <option value="">Seleccioná una categoría...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              )}

              {campaign.destino_tipo === 'seccion' && (
                <select
                  value={campaign.destino_valor || ''}
                  onChange={(e) => onChange('destino_valor', e.target.value)}
                  className={errors.destino_valor ? 'input-error' : ''}
                  style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
                >
                  <option value="">Seleccioná una sección...</option>
                  {uniqueSections.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}

              {['ruta_interna', 'url_externa', 'whatsapp'].includes(campaign.destino_tipo) && (
                <input
                  type="text"
                  id="destino_valor"
                  placeholder={
                    campaign.destino_tipo === 'ruta_interna'
                      ? 'Ej: /contacto'
                      : campaign.destino_tipo === 'url_externa'
                      ? 'Ej: https://sitioweb.com'
                      : 'Ej: 5491123456789 o enlace de chat'
                  }
                  value={campaign.destino_valor || ''}
                  onChange={(e) => onChange('destino_valor', e.target.value)}
                  className={errors.destino_valor ? 'input-error' : ''}
                  style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
                />
              )}

              {(!campaign.destino_tipo || campaign.destino_tipo === 'ninguno') && (
                <input
                  type="text"
                  disabled
                  placeholder="No requiere valor de destino"
                  style={{ backgroundColor: '#0f172a', color: '#64748b', border: '1px solid #334155' }}
                />
              )}

              {errors.destino_valor && <span className="error-text">{errors.destino_valor}</span>}
            </div>
          </div>

          {/* Real-time simulation viewport */}
          <div className="preview-container-admin" style={{ marginTop: '25px', padding: '15px', border: '1px solid #334155', borderRadius: 'var(--radius-lg)', backgroundColor: '#1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#fff' }}>🖼️ Vista Previa del Flyer (Resultado Real)</h4>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button
                  type="button"
                  className={`btn btn-secondary ${previewDevice === 'escritorio' ? 'active' : ''}`}
                  onClick={() => setPreviewDevice('escritorio')}
                  style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: previewDevice === 'escritorio' ? '#475569' : '#0f172a', color: '#fff', border: '1px solid #475569' }}
                >
                  💻 Escritorio
                </button>
                <button
                  type="button"
                  className={`btn btn-secondary ${previewDevice === 'movil' ? 'active' : ''}`}
                  onClick={() => setPreviewDevice('movil')}
                  style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: previewDevice === 'movil' ? '#475569' : '#0f172a', color: '#fff', border: '1px solid #475569' }}
                >
                  📱 Móvil
                </button>
              </div>
            </div>

            {/* Simulated frame */}
            <div 
              className="simulator-window"
              style={{
                width: '100%',
                maxWidth: previewDevice === 'movil' ? '320px' : '650px',
                margin: '0 auto',
                minHeight: '260px',
                border: '2px dashed #475569',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                boxSizing: 'border-box',
                transition: 'all 0.3s ease',
                position: 'relative'
              }}
            >
              {/* Image only container (contain, no text over) */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  cursor: campaign.destino_tipo !== 'ninguno' ? 'pointer' : 'default'
                }}
              >
                {/* simulated close button outside image or on top-right */}
                {(campaign.popup_se_puede_cerrar !== false) && (
                  <button
                    type="button"
                    aria-label="Cerrar"
                    style={{
                      position: 'absolute',
                      top: '-15px',
                      right: '-15px',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: '#fff',
                      color: '#000',
                      border: '1px solid #ccc',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 10,
                      boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                      padding: 0
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      alert('Botón cerrar presionado en la vista previa.');
                    }}
                  >
                    &times;
                  </button>
                )}

                {displayPreviewUrl ? (
                  <img
                    src={displayPreviewUrl}
                    alt="Campaña"
                    style={{
                      width: '100%',
                      maxHeight: '380px',
                      objectFit: 'contain',
                      borderRadius: 'var(--radius-md)',
                      display: 'block'
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '150px',
                      backgroundColor: '#334155',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94a3b8',
                      fontSize: '0.8rem',
                      flexDirection: 'column',
                      gap: '5px'
                    }}
                  >
                    <span>🖼️ (Sin imagen del flyer)</span>
                    <span style={{ fontSize: '0.75rem' }}>Sube una imagen para ver la simulación</span>
                  </div>
                )}
              </div>
            </div>

            {/* Admin destination summary label (outside simulator) */}
            <div 
              style={{ 
                marginTop: '15px', 
                padding: '8px 12px', 
                backgroundColor: '#0f172a', 
                borderRadius: 'var(--radius-md)', 
                fontSize: '0.8rem', 
                color: '#38bdf8', 
                fontWeight: '600',
                borderLeft: '4px solid #38bdf8' 
              }}
            >
              Destino configurado en el panel: {campaign.destino_tipo} → {getDestValueLabel()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
