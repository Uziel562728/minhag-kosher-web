import React from 'react';

export default function CampaignPopupFields({
  campaign,
  onChange,
  errors
}) {
  return (
    <div className="admin-form-section">
      <h3 className="section-subtitle-admin" style={{ color: '#fff' }}>📢 Parámetros adicionales del Popup</h3>
      <div className="section-divider-admin"></div>

      <div className="form-row">
        <div className="form-group col">
          <label htmlFor="popup_titulo" style={{ color: '#cbd5e1' }}>Título del popup (Uso administrativo / accesibilidad)</label>
          <input
            type="text"
            id="popup_titulo"
            placeholder="Ej: ¡Llegaron los productos importados!"
            value={campaign.popup_titulo || ''}
            onChange={(e) => onChange('popup_titulo', e.target.value)}
            className={errors.popup_titulo ? 'input-error' : ''}
            style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
          />
          {errors.popup_titulo && <span className="error-text">{errors.popup_titulo}</span>}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="popup_descripcion" style={{ color: '#cbd5e1' }}>Texto alternativo / descripción interna del popup</label>
        <textarea
          id="popup_descripcion"
          rows="2"
          placeholder="Ej: Aprovechá esta semana 15% de descuento en la góndola de importados..."
          value={campaign.popup_descripcion || ''}
          onChange={(e) => onChange('popup_descripcion', e.target.value)}
          className={errors.popup_descripcion ? 'input-error' : ''}
          style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
        />
        {errors.popup_descripcion && <span className="error-text">{errors.popup_descripcion}</span>}
      </div>
    </div>
  );
}
