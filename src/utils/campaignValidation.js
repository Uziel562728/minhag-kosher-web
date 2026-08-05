/**
 * Validates a campaign form payload.
 * Returns { valid: boolean, errors: Object }
 */
export function validateCampaign(campaign, selectedProducts = []) {
  const errors = {};

  // 1. General validations
  if (!campaign.nombre || !campaign.nombre.trim()) {
    errors.nombre = 'El nombre de la campaña es obligatorio.';
  }

  const priority = parseInteger(campaign.prioridad);
  if (priority === null) {
    errors.prioridad = 'La prioridad es obligatoria.';
  } else if (!Number.isInteger(priority) || priority < 0) {
    errors.prioridad = 'La prioridad debe ser un número entero mayor o igual a 0.';
  }

  if (!['popup', 'promocion'].includes(campaign.tipo)) {
    errors.tipo = 'El tipo de campaña es inválido.';
  }

  if (!['borrador', 'programada', 'activa', 'pausada', 'finalizada'].includes(campaign.estado)) {
    errors.estado = 'El estado de la campaña es inválido.';
  }

  // 2. Scheduling validations
  if (campaign.tipo_programacion === 'puntual') {
    if (!campaign.fecha_inicio) {
      errors.fecha_inicio = 'La fecha de inicio es obligatoria para programación puntual.';
    } else if (!isValidDatetimeLocal(campaign.fecha_inicio)) {
      errors.fecha_inicio = 'Ingresá una fecha y hora válidas en formato YYYY-MM-DDTHH:mm.';
    }
    if (campaign.fecha_fin && !isValidDatetimeLocal(campaign.fecha_fin)) {
      errors.fecha_fin = 'Ingresá una fecha y hora válidas en formato YYYY-MM-DDTHH:mm.';
    }
    if (campaign.fecha_inicio && campaign.fecha_fin) {
      const start = new Date(campaign.fecha_inicio);
      const end = new Date(campaign.fecha_fin);
      if (isValidDatetimeLocal(campaign.fecha_inicio) && isValidDatetimeLocal(campaign.fecha_fin) && end <= start) {
        errors.fecha_fin = 'La fecha de fin debe ser posterior a la fecha de inicio.';
      }
    }
  } else if (campaign.tipo_programacion === 'semanal') {
    if (!Array.isArray(campaign.dias_semana) || campaign.dias_semana.length === 0) {
      errors.dias_semana = 'Debés seleccionar al menos un día de la semana.';
    } else {
      const invalidDay = campaign.dias_semana.some(d => d < 0 || d > 6);
      if (invalidDay) {
        errors.dias_semana = 'Días de la semana inválidos (deben ser del 0 al 6).';
      }
    }

    validateRequiredTime(campaign.hora_inicio, 'hora_inicio', errors);
    validateRequiredTime(campaign.hora_fin, 'hora_fin', errors);

    if (TIME_PATTERN.test(campaign.hora_inicio) && TIME_PATTERN.test(campaign.hora_fin)) {
      const [hStart, mStart] = campaign.hora_inicio.split(':').map(Number);
      const [hEnd, mEnd] = campaign.hora_fin.split(':').map(Number);
      const totalStart = hStart * 60 + mStart;
      const totalEnd = hEnd * 60 + mEnd;

      if (totalEnd <= totalStart) {
        errors.hora_fin = 'La hora final debe ser posterior a la inicial.';
      }
    }

    if (campaign.fecha_recurrencia_inicio && !isValidDateInput(campaign.fecha_recurrencia_inicio)) {
      errors.fecha_recurrencia_inicio = 'Ingresá una fecha válida en formato YYYY-MM-DD.';
    }
    if (campaign.fecha_recurrencia_fin && !isValidDateInput(campaign.fecha_recurrencia_fin)) {
      errors.fecha_recurrencia_fin = 'Ingresá una fecha válida en formato YYYY-MM-DD.';
    }

    if (campaign.fecha_recurrencia_inicio && campaign.fecha_recurrencia_fin) {
      const startRec = new Date(campaign.fecha_recurrencia_inicio);
      const endRec = new Date(campaign.fecha_recurrencia_fin);
      if (isValidDateInput(campaign.fecha_recurrencia_inicio) && isValidDateInput(campaign.fecha_recurrencia_fin) && endRec < startRec) {
        errors.fecha_recurrencia_fin = 'La fecha final de recurrencia debe ser posterior o igual a la fecha inicial.';
      }
    }
  } else {
    errors.tipo_programacion = 'El tipo de programación es inválido.';
  }

  // 3. Campaign Type Specific Validations
  if (campaign.tipo === 'popup') {
    const delay = parseInteger(campaign.popup_retraso_segundos);
    if (!isBlank(campaign.popup_retraso_segundos) && (!Number.isInteger(delay) || delay < 0)) {
      errors.popup_retraso_segundos = 'El retraso debe ser un número entero mayor o igual a 0.';
    }

    if (!['siempre', 'una_vez_sesion', 'una_vez_dia', 'una_vez_total'].includes(campaign.popup_frecuencia)) {
      errors.popup_frecuencia = 'Frecuencia de popup inválida.';
    }

    if (!['todos', 'movil', 'escritorio'].includes(campaign.popup_dispositivo)) {
      errors.popup_dispositivo = 'Dispositivo de popup inválido.';
    }

    const destTipo = campaign.popup_destino_tipo;
    const destValor = campaign.popup_destino_valor;

    if (destTipo && destTipo !== 'ninguno') {
      if (!destValor || !destValor.trim()) {
        errors.popup_destino_valor = 'El valor del destino es obligatorio si se especifica un tipo.';
      } else {
        if (destTipo === 'ruta_interna' && !destValor.startsWith('/')) {
          errors.popup_destino_valor = 'La ruta interna debe comenzar con "/".';
        }
        if (destTipo === 'url_externa' && !/^https?:\/\//i.test(destValor)) {
          errors.popup_destino_valor = 'La URL externa debe comenzar con "http://" o "https://".';
        }
      }
    }
  } else if (campaign.tipo === 'promocion') {
    if (!['todos', 'categoria', 'productos_seleccionados'].includes(campaign.alcance_promocion)) {
      errors.alcance_promocion = 'El alcance de la promoción es inválido.';
    }

    if (campaign.alcance_promocion === 'categoria' && !campaign.categoria_id) {
      errors.categoria_id = 'La categoría de alcance es obligatoria.';
    }

    // General discount validation
    const discountError = validateDiscountValues(
      campaign.tipo_descuento,
      campaign.porcentaje,
      campaign.importe_fijo,
      campaign.precio_fijo,
      campaign.cantidad_compra,
      campaign.cantidad_paga
    );
    if (discountError) {
      errors.tipo_descuento = discountError;
    }

    // Selected products validation
    if (campaign.alcance_promocion === 'productos_seleccionados') {
      if (!Array.isArray(selectedProducts) || selectedProducts.length === 0) {
        errors.productos = 'Debés seleccionar al menos un producto para la promoción.';
      } else {
        selectedProducts.forEach((p) => {
          if (p.isCustomDiscount) {
            const pError = validateDiscountValues(
              p.tipo_descuento,
              p.porcentaje,
              p.importe_fijo,
              p.precio_fijo,
              p.cantidad_compra,
              p.cantidad_paga
            );
            if (pError) {
              if (!errors.productos_personalizados) {
                errors.productos_personalizados = {};
              }
              errors.productos_personalizados[p.product_id] = pError;
            }
          }
        });
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

function validateDiscountValues(type, pct, fixedImp, fixedPre, buyQty, payQty) {
  if (!['porcentaje', 'importe_fijo', 'precio_fijo', 'compra_x_paga_y'].includes(type)) {
    return 'El tipo de descuento es inválido.';
  }

  if (type === 'porcentaje') {
    const val = parseDecimal(pct);
    if (val === null || val <= 0 || val > 100) {
      return 'El porcentaje de descuento debe estar entre 1 y 100.';
    }
  } else if (type === 'importe_fijo') {
    const val = parseDecimal(fixedImp);
    if (val === null || val < 0) {
      return 'El importe fijo debe ser un número positivo.';
    }
  } else if (type === 'precio_fijo') {
    const val = parseDecimal(fixedPre);
    if (val === null || val < 0) {
      return 'El precio fijo debe ser un número positivo.';
    }
  } else if (type === 'compra_x_paga_y') {
    const bVal = parseInteger(buyQty);
    const pVal = parseInteger(payQty);
    if (bVal === null || bVal <= 0 || !Number.isInteger(bVal)) {
      return 'La cantidad a comprar debe ser un número entero mayor a 0.';
    }
    if (pVal === null || pVal < 0 || !Number.isInteger(pVal)) {
      return 'La cantidad a pagar debe ser un número entero mayor o igual a 0.';
    }
    if (pVal >= bVal) {
      return 'La cantidad a pagar debe ser menor a la cantidad a comprar (ej: Compra 3, Paga 2).';
    }
  }
  return null;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_LOCAL_PATTERN = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/;
const DECIMAL_PATTERN = /^\d+(?:[.,]\d+)?$/;
const INTEGER_PATTERN = /^-?\d+$/;

function isBlank(value) {
  return value === '' || value === null || value === undefined;
}

function parseDecimal(value) {
  if (isBlank(value)) return null;
  const normalized = String(value).trim().replace(',', '.');
  if (!DECIMAL_PATTERN.test(String(value).trim())) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value) {
  if (isBlank(value)) return null;
  const normalized = String(value).trim();
  if (!INTEGER_PATTERN.test(normalized)) return null;
  return parseInt(normalized, 10);
}

function validateRequiredTime(value, field, errors) {
  if (!value) {
    errors[field] = 'La hora es obligatoria. Ingresala en formato HH:MM.';
  } else if (!TIME_PATTERN.test(value)) {
    errors[field] = 'Ingresá la hora en formato HH:MM.';
  }
}

function isValidDateInput(value) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00`);
  return !Number.isNaN(date.getTime())
    && date.getFullYear() === Number(year)
    && date.getMonth() + 1 === Number(month)
    && date.getDate() === Number(day);
}

function isValidDatetimeLocal(value) {
  const match = DATETIME_LOCAL_PATTERN.exec(value);
  return Boolean(match && isValidDateInput(match[1]));
}
