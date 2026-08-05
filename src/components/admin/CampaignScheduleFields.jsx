import React from 'react';

const DAYS_OF_WEEK = [
  { value: 0, label: 'D' },
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'Mi' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
];

export default function CampaignScheduleFields({ campaign, onChange, errors }) {
  const handleDayToggle = (day) => {
    const currentDays = campaign.dias_semana || [];
    let nextDays;
    if (currentDays.includes(day)) {
      nextDays = currentDays.filter(d => d !== day);
    } else {
      nextDays = [...currentDays, day].sort((a, b) => a - b);
    }
    onChange('dias_semana', nextDays);
  };

  return (
    <div className="admin-form-section">
      <h3 className="section-subtitle-admin" style={{ color: '#fff' }}>📅 Programación y Vigencia</h3>
      <div className="section-divider-admin"></div>

      <div className="form-group">
        <label htmlFor="tipo_programacion" style={{ color: '#cbd5e1' }}>Tipo de programación *</label>
        <select
          id="tipo_programacion"
          value={campaign.tipo_programacion || 'puntual'}
          onChange={(e) => onChange('tipo_programacion', e.target.value)}
          style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}
        >
          <option value="puntual">Puntual (Rango de fechas específico)</option>
          <option value="semanal">Semanal (Días y horarios recurrentes)</option>
        </select>
        {errors.tipo_programacion && <span className="error-text">{errors.tipo_programacion}</span>}
      </div>

      {campaign.tipo_programacion === 'puntual' ? (
        <div className="form-row">
          <div className="form-group col">
            <label htmlFor="fecha_inicio" style={{ color: '#cbd5e1' }}>Fecha y hora de inicio *</label>
            <input
              type="datetime-local"
              id="fecha_inicio"
              value={campaign.fecha_inicio || ''}
              onChange={(e) => onChange('fecha_inicio', e.target.value)}
              className={errors.fecha_inicio ? 'input-error' : ''}
              aria-invalid={Boolean(errors.fecha_inicio)}
              aria-describedby={errors.fecha_inicio ? 'fecha-inicio-error' : undefined}
              style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569', colorScheme: 'dark' }}
            />
            {errors.fecha_inicio && <span id="fecha-inicio-error" className="error-text" role="alert">{errors.fecha_inicio}</span>}
          </div>
          <div className="form-group col">
            <label htmlFor="fecha_fin" style={{ color: '#cbd5e1' }}>Fecha y hora de fin (Opcional)</label>
            <input
              type="datetime-local"
              id="fecha_fin"
              value={campaign.fecha_fin || ''}
              onChange={(e) => onChange('fecha_fin', e.target.value)}
              className={errors.fecha_fin ? 'input-error' : ''}
              aria-invalid={Boolean(errors.fecha_fin)}
              aria-describedby={errors.fecha_fin ? 'fecha-fin-error' : undefined}
              style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569', colorScheme: 'dark' }}
            />
            {errors.fecha_fin && <span id="fecha-fin-error" className="error-text" role="alert">{errors.fecha_fin}</span>}
          </div>
        </div>
      ) : (
        <>
          <div className="form-group">
            <label style={{ color: '#cbd5e1' }}>Días de la semana vigentes *</label>
            <div className="days-selector" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = (campaign.dias_semana || []).includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    className={`day-btn-circle ${isSelected ? 'active' : ''}`}
                    onClick={() => handleDayToggle(day.value)}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      border: '1px solid #475569',
                      backgroundColor: isSelected ? 'var(--primary)' : 'transparent',
                      color: '#fff',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            {errors.dias_semana && <span className="error-text">{errors.dias_semana}</span>}
          </div>

          <div className="form-row">
            <div className="form-group col">
              <label htmlFor="hora_inicio" style={{ color: '#cbd5e1' }}>Hora de inicio diaria *</label>
              <input
                type="time"
                id="hora_inicio"
                inputMode="numeric"
                placeholder="HH:MM"
                value={campaign.hora_inicio || ''}
                onChange={(e) => onChange('hora_inicio', e.target.value)}
                className={errors.hora_inicio ? 'input-error' : ''}
                aria-invalid={Boolean(errors.hora_inicio)}
                aria-describedby={errors.hora_inicio ? 'hora-inicio-error' : undefined}
                style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569', colorScheme: 'dark' }}
              />
              {errors.hora_inicio && <span id="hora-inicio-error" className="error-text" role="alert">{errors.hora_inicio}</span>}
            </div>
            <div className="form-group col">
              <label htmlFor="hora_fin" style={{ color: '#cbd5e1' }}>Hora de fin diaria *</label>
              <input
                type="time"
                id="hora_fin"
                inputMode="numeric"
                placeholder="HH:MM"
                value={campaign.hora_fin || ''}
                onChange={(e) => onChange('hora_fin', e.target.value)}
                className={errors.hora_fin ? 'input-error' : ''}
                aria-invalid={Boolean(errors.hora_fin)}
                aria-describedby={errors.hora_fin ? 'hora-fin-error' : undefined}
                style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569', colorScheme: 'dark' }}
              />
              {errors.hora_fin && <span id="hora-fin-error" className="error-text" role="alert">{errors.hora_fin}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group col">
              <label htmlFor="fecha_recurrencia_inicio" style={{ color: '#cbd5e1' }}>Fecha desde la cual inicia recurrencia (Opcional)</label>
              <input
                type="date"
                id="fecha_recurrencia_inicio"
                value={campaign.fecha_recurrencia_inicio || ''}
                onChange={(e) => onChange('fecha_recurrencia_inicio', e.target.value)}
                className={errors.fecha_recurrencia_inicio ? 'input-error' : ''}
                aria-invalid={Boolean(errors.fecha_recurrencia_inicio)}
                aria-describedby={errors.fecha_recurrencia_inicio ? 'fecha-recurrencia-inicio-error' : undefined}
                style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569', colorScheme: 'dark' }}
              />
              {errors.fecha_recurrencia_inicio && <span id="fecha-recurrencia-inicio-error" className="error-text" role="alert">{errors.fecha_recurrencia_inicio}</span>}
            </div>
            <div className="form-group col">
              <label htmlFor="fecha_recurrencia_fin" style={{ color: '#cbd5e1' }}>Fecha de finalización de recurrencia (Opcional)</label>
              <input
                type="date"
                id="fecha_recurrencia_fin"
                value={campaign.fecha_recurrencia_fin || ''}
                onChange={(e) => onChange('fecha_recurrencia_fin', e.target.value)}
                className={errors.fecha_recurrencia_fin ? 'input-error' : ''}
                aria-invalid={Boolean(errors.fecha_recurrencia_fin)}
                aria-describedby={errors.fecha_recurrencia_fin ? 'fecha-recurrencia-fin-error' : undefined}
                style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569', colorScheme: 'dark' }}
              />
              {errors.fecha_recurrencia_fin && <span id="fecha-recurrencia-fin-error" className="error-text" role="alert">{errors.fecha_recurrencia_fin}</span>}
            </div>
          </div>
        </>
      )}

      <div className="form-row" style={{ marginTop: '15px' }}>
        <div className="form-group col">
          <label htmlFor="zona_horaria" style={{ color: '#cbd5e1' }}>Zona Horaria *</label>
          <input
            type="text"
            id="zona_horaria"
            value={campaign.zona_horaria || 'America/Argentina/Buenos_Aires'}
            disabled
            style={{ backgroundColor: '#0f172a', color: '#64748b', border: '1px solid #334155' }}
          />
        </div>
      </div>
    </div>
  );
}
