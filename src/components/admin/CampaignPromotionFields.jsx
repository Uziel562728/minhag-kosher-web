import React, { useState, useMemo } from 'react';
import { Trash2 } from 'lucide-react';

const EDITABLE_DECIMAL_PATTERN = /^\d*(?:[.,]\d*)?$/;

function DecimalInput({ onChange, ...props }) {
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      onChange={(event) => {
        if (EDITABLE_DECIMAL_PATTERN.test(event.target.value)) {
          onChange(event.target.value);
        }
      }}
    />
  );
}

export default function CampaignPromotionFields({
  campaign,
  onChange,
  errors,
  categories = [],
  products = [],
  selectedProducts = [],
  onSelectedProductsChange
}) {
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Search products locally
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 10);
    const query = productSearch.toLowerCase();
    return products.filter(p => 
      p.nombre.toLowerCase().includes(query) || 
      (p.marca && p.marca.toLowerCase().includes(query))
    ).slice(0, 10);
  }, [products, productSearch]);

  const handleProductSelect = (product) => {
    const exists = selectedProducts.some(p => p.product_id === product.id);
    if (!exists) {
      const newSelected = [
        ...selectedProducts,
        {
          product_id: product.id,
          incluido: true,
          isCustomDiscount: false,
          tipo_descuento: 'porcentaje',
          porcentaje: '',
          importe_fijo: '',
          precio_fijo: '',
          cantidad_compra: '2',
          cantidad_paga: '1',
          texto_etiqueta: '',
          product_meta: product
        }
      ];
      onSelectedProductsChange(newSelected);
    }
    setProductSearch('');
    setShowProductDropdown(false);
  };

  const handleRemoveProduct = (productId) => {
    onSelectedProductsChange(selectedProducts.filter(p => p.product_id !== productId));
  };

  const handleProductFieldChange = (productId, field, value) => {
    const updated = selectedProducts.map(p => {
      if (p.product_id === productId) {
        return { ...p, [field]: value };
      }
      return p;
    });
    onSelectedProductsChange(updated);
  };

  // Generate dynamic promotion summary
  const promotionSummary = useMemo(() => {
    const type = campaign.tipo_descuento;
    const pct = campaign.porcentaje;
    const fixedImp = campaign.importe_fijo;
    const fixedPre = campaign.precio_fijo;
    const bQty = campaign.cantidad_compra;
    const pQty = campaign.cantidad_paga;

    if (type === 'porcentaje' && pct > 0) {
      return `Descuento del ${pct}% sobre el precio de venta.`;
    }
    if (type === 'importe_fijo' && fixedImp > 0) {
      return `Bonificación fija de $${fixedImp} de descuento en el total del producto.`;
    }
    if (type === 'precio_fijo' && fixedPre > 0) {
      return `Precio de venta especial establecido a $${fixedPre}.`;
    }
    if (type === 'compra_x_paga_y' && bQty > 0 && pQty >= 0) {
      return `Promoción tipo ${bQty}x${pQty} (Llevás ${bQty}, pagás ${pQty}).`;
    }
    return 'Completa los campos del tipo de descuento para ver el resumen.';
  }, [campaign]);

  return (
    <div className="admin-form-section">
      <h3 className="section-subtitle-admin" style={{ color: '#fff' }}>🏷️ Configuración de la Promoción</h3>
      <div className="section-divider-admin"></div>

      {/* Alcance de la Promoción */}
      <div className="form-row">
        <div className="form-group col">
          <label htmlFor="alcance_promocion" style={{ color: '#cbd5e1' }}>Alcance de la promoción *</label>
          <select
            id="alcance_promocion"
            value={campaign.alcance_promocion || 'todos'}
            onChange={(e) => {
              onChange('alcance_promocion', e.target.value);
              if (e.target.value !== 'categoria') onChange('categoria_id', null);
            }}
            style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
          >
            <option value="todos">Todos los productos</option>
            <option value="categoria">Por Categoría</option>
            <option value="productos_seleccionados">Productos Seleccionados</option>
          </select>
          {errors.alcance_promocion && <span className="error-text">{errors.alcance_promocion}</span>}
        </div>

        {campaign.alcance_promocion === 'categoria' && (
          <div className="form-group col">
            <label htmlFor="categoria_id" style={{ color: '#cbd5e1' }}>Categoría afectada *</label>
            <select
              id="categoria_id"
              value={campaign.categoria_id || ''}
              onChange={(e) => onChange('categoria_id', e.target.value)}
              className={errors.categoria_id ? 'input-error' : ''}
              style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
            >
              <option value="">Selecciona una categoría...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.nombre} {c.activa ? '' : '(Inactiva)'}</option>
              ))}
            </select>
            {errors.categoria_id && <span className="error-text">{errors.categoria_id}</span>}
          </div>
        )}
      </div>

      {/* Tipo de Descuento General */}
      <div className="form-row">
        <div className="form-group col">
          <label htmlFor="tipo_descuento" style={{ color: '#cbd5e1' }}>Tipo de descuento general *</label>
          <select
            id="tipo_descuento"
            value={campaign.tipo_descuento || 'porcentaje'}
            onChange={(e) => onChange('tipo_descuento', e.target.value)}
            className={errors.tipo_descuento ? 'input-error' : ''}
            aria-invalid={Boolean(errors.tipo_descuento)}
            aria-describedby={errors.tipo_descuento ? 'descuento-general-error' : undefined}
            style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
          >
            <option value="porcentaje">Porcentaje (%)</option>
            <option value="importe_fijo">Importe Fijo ($ descuento)</option>
            <option value="precio_fijo">Precio Fijo ($ precio final)</option>
            <option value="compra_x_paga_y">Llevá X pagá Y (2x1, 3x2, etc.)</option>
          </select>
        </div>

        {campaign.tipo_descuento === 'porcentaje' && (
          <div className="form-group col">
            <label htmlFor="porcentaje" style={{ color: '#cbd5e1' }}>Porcentaje de descuento *</label>
            <DecimalInput
              id="porcentaje"
              placeholder="Ej: 30"
              value={campaign.porcentaje !== undefined ? campaign.porcentaje : ''}
              onChange={(value) => onChange('porcentaje', value)}
              aria-invalid={Boolean(errors.tipo_descuento)}
              aria-describedby={errors.tipo_descuento ? 'descuento-general-error' : undefined}
              style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
            />
            {errors.tipo_descuento && <span id="descuento-general-error" className="error-text" role="alert">{errors.tipo_descuento}</span>}
          </div>
        )}

        {campaign.tipo_descuento === 'importe_fijo' && (
          <div className="form-group col">
            <label htmlFor="importe_fijo" style={{ color: '#cbd5e1' }}>Importe de descuento fijo ($) *</label>
            <DecimalInput
              id="importe_fijo"
              placeholder="Ej: 1500,50"
              value={campaign.importe_fijo !== undefined ? campaign.importe_fijo : ''}
              onChange={(value) => onChange('importe_fijo', value)}
              aria-invalid={Boolean(errors.tipo_descuento)}
              aria-describedby={errors.tipo_descuento ? 'descuento-general-error' : undefined}
              style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
            />
            {errors.tipo_descuento && <span id="descuento-general-error" className="error-text" role="alert">{errors.tipo_descuento}</span>}
          </div>
        )}

        {campaign.tipo_descuento === 'precio_fijo' && (
          <div className="form-group col">
            <label htmlFor="precio_fijo" style={{ color: '#cbd5e1' }}>Precio final establecido ($) *</label>
            <DecimalInput
              id="precio_fijo"
              placeholder="Ej: 999"
              value={campaign.precio_fijo !== undefined ? campaign.precio_fijo : ''}
              onChange={(value) => onChange('precio_fijo', value)}
              aria-invalid={Boolean(errors.tipo_descuento)}
              aria-describedby={errors.tipo_descuento ? 'descuento-general-error' : undefined}
              style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
            />
            {errors.tipo_descuento && <span id="descuento-general-error" className="error-text" role="alert">{errors.tipo_descuento}</span>}
          </div>
        )}

        {campaign.tipo_descuento === 'compra_x_paga_y' && (
          <>
            <div className="form-group col">
              <label htmlFor="cantidad_compra" style={{ color: '#cbd5e1' }}>Cantidad a comprar (X) *</label>
              <input
                type="number"
                id="cantidad_compra"
                min="1"
                step="1"
                inputMode="numeric"
                placeholder="Ej: 2"
                value={campaign.cantidad_compra !== undefined ? campaign.cantidad_compra : ''}
                onChange={(e) => onChange('cantidad_compra', e.target.value)}
                aria-invalid={Boolean(errors.tipo_descuento)}
                aria-describedby={errors.tipo_descuento ? 'descuento-general-error' : undefined}
                style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
              />
            </div>
            <div className="form-group col">
              <label htmlFor="cantidad_paga" style={{ color: '#cbd5e1' }}>Cantidad a pagar (Y) *</label>
              <input
                type="number"
                id="cantidad_paga"
                min="0"
                step="1"
                inputMode="numeric"
                placeholder="Ej: 1"
                value={campaign.cantidad_paga !== undefined ? campaign.cantidad_paga : ''}
                onChange={(e) => onChange('cantidad_paga', e.target.value)}
                aria-invalid={Boolean(errors.tipo_descuento)}
                aria-describedby={errors.tipo_descuento ? 'descuento-general-error' : undefined}
                style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
              />
              {errors.tipo_descuento && <span id="descuento-general-error" className="error-text" role="alert">{errors.tipo_descuento}</span>}
            </div>
          </>
        )}
      </div>

      {/* Resumen de la Promoción General */}
      <div className="promotion-summary-box" style={{ margin: '15px 0', padding: '10px 15px', backgroundColor: '#0f172a', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--primary)', fontSize: '0.85rem', color: '#cbd5e1' }}>
        <strong style={{ color: '#fff' }}>Resumen general de promoción:</strong> {promotionSummary}
      </div>

      <div className="form-row">
        <div className="form-group col">
          <label htmlFor="texto_etiqueta" style={{ color: '#cbd5e1' }}>Texto de la etiqueta promocional</label>
          <input
            type="text"
            id="texto_etiqueta"
            placeholder="Ej: 30% OFF, 2x1, Promo Importados"
            value={campaign.texto_etiqueta || ''}
            onChange={(e) => onChange('texto_etiqueta', e.target.value)}
            style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
          />
          <span className="help-text" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Este texto se mostrará como distintivo en el catálogo del cliente.</span>
        </div>
        <div className="form-group col" style={{ display: 'flex', alignItems: 'center', height: '100%', marginTop: '30px' }}>
          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#fff' }}>
            <input
              type="checkbox"
              checked={campaign.acumulable !== false}
              onChange={(e) => onChange('acumulable', e.target.checked)}
            />
            <span>Acumulable con otras promociones del catálogo</span>
          </label>
        </div>
      </div>

      {/* Alcance: Productos Seleccionados */}
      {campaign.alcance_promocion === 'productos_seleccionados' && (
        <div className="selected-products-block" style={{ marginTop: '25px', position: 'relative' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '10px', color: '#fff' }}>🔍 Selección de productos aplicables</h4>
          
          <div className="form-group">
            <input
              type="text"
              placeholder="Buscar producto por nombre o marca para agregar..."
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setShowProductDropdown(true);
              }}
              onFocus={() => setShowProductDropdown(true)}
              style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
            />
            {showProductDropdown && (
              <div 
                className="product-autocomplete-dropdown" 
                style={{
                  position: 'absolute',
                  top: '65px',
                  left: 0,
                  right: 0,
                  zIndex: 99,
                  border: '1px solid #475569',
                  backgroundColor: '#1e293b',
                  borderRadius: 'var(--radius-md)',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                }}
              >
                {filteredProducts.map(p => {
                  const isSelected = selectedProducts.some(sp => sp.product_id === p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => !isSelected && handleProductSelect(p)}
                      style={{
                        padding: '8px 12px',
                        cursor: isSelected ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid #334155',
                        backgroundColor: isSelected ? '#334155' : 'transparent',
                        opacity: isSelected ? 0.6 : 1,
                        color: '#fff'
                      }}
                      onMouseEnter={(e) => !isSelected && (e.currentTarget.style.backgroundColor = '#334155')}
                      onMouseLeave={(e) => !isSelected && (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img 
                          src={p.imagen_principal || '/placeholder.png'} 
                          alt={p.nombre} 
                          style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '4px' }}
                        />
                        <div>
                          <div style={{ fontWeight: '500', fontSize: '0.85rem', color: isSelected ? '#94a3b8' : '#fff' }}>{p.nombre}</div>
                          <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>${p.precio}</div>
                        </div>
                      </div>
                      {isSelected && <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '600' }}>Agregado</span>}
                    </div>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <div style={{ padding: '8px 12px', color: '#cbd5e1' }}>No se encontraron productos</div>
                )}
              </div>
            )}
          </div>

          {errors.productos && <div className="error-text" style={{ marginBottom: '15px' }}>{errors.productos}</div>}

          {/* Tabla de Productos Seleccionados */}
          {selectedProducts.length > 0 ? (
            <div className="table-responsive-admin" style={{ overflowX: 'auto', marginTop: '15px', border: '1px solid #334155', borderRadius: 'var(--radius-md)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #334155', textAlign: 'left', color: '#fff' }}>
                    <th style={{ padding: '10px' }}>Producto</th>
                    <th style={{ padding: '10px' }}>Precio Base</th>
                    <th style={{ padding: '10px' }}>Tipo Descuento</th>
                    <th style={{ padding: '10px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProducts.map((p) => {
                    const meta = p.product_meta || {};
                    const customError = errors.productos_personalizados?.[p.product_id];
                    return (
                      <React.Fragment key={p.product_id}>
                        <tr style={{ borderBottom: '1px solid #334155', color: '#fff' }}>
                          <td style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img 
                              src={meta.imagen_principal || '/placeholder.png'} 
                              alt={meta.nombre} 
                              style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '4px' }}
                            />
                            <div>
                              <div style={{ fontWeight: '600' }}>{meta.nombre}</div>
                              <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Categoría: {categories.find(c => c.id === meta.categoria_id)?.nombre || 'Sin cat.'}</div>
                            </div>
                          </td>
                          <td style={{ padding: '10px' }}>${meta.precio}</td>
                          <td style={{ padding: '10px' }}>
                            <select
                              value={p.isCustomDiscount ? 'personalizado' : 'general'}
                              onChange={(e) => handleProductFieldChange(p.product_id, 'isCustomDiscount', e.target.value === 'personalizado')}
                              style={{ padding: '4px 8px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
                            >
                              <option value="general">Usar descuento general</option>
                              <option value="personalizado">Personalizado</option>
                            </select>
                          </td>
                          <td style={{ padding: '10px' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveProduct(p.product_id)}
                              style={{ color: 'var(--text-danger)', border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
                              title="Quitar producto"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>

                        {/* Desglose de Descuento Personalizado */}
                        {p.isCustomDiscount && (
                          <tr style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155' }}>
                            <td colSpan="4" style={{ padding: '12px 20px' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                                <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
                                  <label htmlFor={`tipo-descuento-${p.product_id}`} style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#cbd5e1' }}>Tipo descuento</label>
                                  <select
                                    id={`tipo-descuento-${p.product_id}`}
                                    value={p.tipo_descuento || 'porcentaje'}
                                    onChange={(e) => handleProductFieldChange(p.product_id, 'tipo_descuento', e.target.value)}
                                    style={{ padding: '4px', fontSize: '0.8rem', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #475569' }}
                                  >
                                    <option value="porcentaje">Porcentaje (%)</option>
                                    <option value="importe_fijo">Importe Fijo ($)</option>
                                    <option value="precio_fijo">Precio Fijo ($)</option>
                                    <option value="compra_x_paga_y">Llevá X pagá Y</option>
                                  </select>
                                </div>

                                {p.tipo_descuento === 'porcentaje' && (
                                  <div className="form-group" style={{ margin: 0, maxWidth: '100px' }}>
                                    <label htmlFor={`porcentaje-${p.product_id}`} style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#cbd5e1' }}>% Descuento</label>
                                    <DecimalInput
                                      id={`porcentaje-${p.product_id}`}
                                      value={p.porcentaje !== undefined ? p.porcentaje : ''}
                                      onChange={(value) => handleProductFieldChange(p.product_id, 'porcentaje', value)}
                                      aria-invalid={Boolean(customError)}
                                      aria-describedby={customError ? `descuento-error-${p.product_id}` : undefined}
                                      style={{ padding: '4px', fontSize: '0.8rem', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #475569' }}
                                    />
                                  </div>
                                )}

                                {p.tipo_descuento === 'importe_fijo' && (
                                  <div className="form-group" style={{ margin: 0, maxWidth: '100px' }}>
                                    <label htmlFor={`importe-${p.product_id}`} style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#cbd5e1' }}>$ Descuento</label>
                                    <DecimalInput
                                      id={`importe-${p.product_id}`}
                                      value={p.importe_fijo !== undefined ? p.importe_fijo : ''}
                                      onChange={(value) => handleProductFieldChange(p.product_id, 'importe_fijo', value)}
                                      aria-invalid={Boolean(customError)}
                                      aria-describedby={customError ? `descuento-error-${p.product_id}` : undefined}
                                      style={{ padding: '4px', fontSize: '0.8rem', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #475569' }}
                                    />
                                  </div>
                                )}

                                {p.tipo_descuento === 'precio_fijo' && (
                                  <div className="form-group" style={{ margin: 0, maxWidth: '100px' }}>
                                    <label htmlFor={`precio-${p.product_id}`} style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#cbd5e1' }}>$ Precio Fijo</label>
                                    <DecimalInput
                                      id={`precio-${p.product_id}`}
                                      value={p.precio_fijo !== undefined ? p.precio_fijo : ''}
                                      onChange={(value) => handleProductFieldChange(p.product_id, 'precio_fijo', value)}
                                      aria-invalid={Boolean(customError)}
                                      aria-describedby={customError ? `descuento-error-${p.product_id}` : undefined}
                                      style={{ padding: '4px', fontSize: '0.8rem', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #475569' }}
                                    />
                                  </div>
                                )}

                                {p.tipo_descuento === 'compra_x_paga_y' && (
                                  <>
                                    <div className="form-group" style={{ margin: 0, maxWidth: '80px' }}>
                                      <label htmlFor={`compra-${p.product_id}`} style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#cbd5e1' }}>Compra X</label>
                                      <input
                                        type="number"
                                        id={`compra-${p.product_id}`}
                                        min="1"
                                        step="1"
                                        inputMode="numeric"
                                        value={p.cantidad_compra !== undefined ? p.cantidad_compra : ''}
                                        onChange={(e) => handleProductFieldChange(p.product_id, 'cantidad_compra', e.target.value)}
                                        aria-invalid={Boolean(customError)}
                                        aria-describedby={customError ? `descuento-error-${p.product_id}` : undefined}
                                        style={{ padding: '4px', fontSize: '0.8rem', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #475569' }}
                                      />
                                    </div>
                                    <div className="form-group" style={{ margin: 0, maxWidth: '80px' }}>
                                      <label htmlFor={`paga-${p.product_id}`} style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#cbd5e1' }}>Paga Y</label>
                                      <input
                                        type="number"
                                        id={`paga-${p.product_id}`}
                                        min="0"
                                        step="1"
                                        inputMode="numeric"
                                        value={p.cantidad_paga !== undefined ? p.cantidad_paga : ''}
                                        onChange={(e) => handleProductFieldChange(p.product_id, 'cantidad_paga', e.target.value)}
                                        aria-invalid={Boolean(customError)}
                                        aria-describedby={customError ? `descuento-error-${p.product_id}` : undefined}
                                        style={{ padding: '4px', fontSize: '0.8rem', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #475569' }}
                                      />
                                    </div>
                                  </>
                                )}

                                <div className="form-group" style={{ margin: 0, minWidth: '150px', flexGrow: 1 }}>
                                  <label htmlFor={`etiqueta-${p.product_id}`} style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#cbd5e1' }}>Etiqueta personalizada (Opcional)</label>
                                  <input
                                    type="text"
                                    id={`etiqueta-${p.product_id}`}
                                    placeholder="Ej: 3x2 personalizado"
                                    value={p.texto_etiqueta || ''}
                                    onChange={(e) => handleProductFieldChange(p.product_id, 'texto_etiqueta', e.target.value)}
                                    style={{ padding: '4px', fontSize: '0.8rem', width: '100%', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #475569' }}
                                  />
                                </div>
                              </div>
                              {customError && (
                                <div id={`descuento-error-${p.product_id}`} role="alert" style={{ color: 'var(--text-danger)', fontSize: '0.75rem', marginTop: '6px', fontWeight: '600' }}>
                                  ⚠️ {customError}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', border: '1px dashed #334155', borderRadius: 'var(--radius-md)', color: '#cbd5e1', fontSize: '0.85rem' }}>
              Ningún producto seleccionado. Utilizá el buscador para agregar productos.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
