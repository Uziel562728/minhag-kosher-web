/**
 * Pure helper mathematical functions to calculate discounts.
 */

/**
 * Calcula el precio final unitario para descuentos simples (porcentaje, importe_fijo, precio_fijo).
 */
export function calculateDiscountedUnitPrice(price, promo) {
  const original = Number(price) || 0;
  if (!promo) return original;

  const type = promo.tipo_descuento;
  switch (type) {
    case 'porcentaje': {
      const pct = Number(promo.porcentaje) || 0;
      return Math.max(0, original * (1 - pct / 100));
    }
    case 'importe_fijo': {
      const amt = Number(promo.importe_fijo) || 0;
      return Math.max(0, original - amt);
    }
    case 'precio_fijo': {
      return Math.max(0, Number(promo.precio_fijo) || 0);
    }
    default:
      return original;
  }
}

/**
 * Calcula el subtotal promocional acumulado para un item del carrito según cantidad.
 * Aplica reglas de Compra X paga Y (por volumen) y descuentos simples.
 */
export function calculateLineSubtotal(unitPrice, quantity, promo) {
  const originalUnitPrice = Number(unitPrice) || 0;
  const qty = Math.max(0, Number(quantity) || 0);
  if (qty === 0) return 0;
  if (!promo) return originalUnitPrice * qty;

  if (promo.tipo_descuento === 'compra_x_paga_y') {
    const buyX = Math.max(1, Number(promo.cantidad_compra) || 1);
    const payY = Math.max(1, Number(promo.cantidad_paga) || 1);
    
    // Si la cantidad llevada es menor que lo requerido para la promo, cobramos precio completo
    if (qty < buyX) {
      return originalUnitPrice * qty;
    }
    
    const completeGroups = Math.floor(qty / buyX);
    const remainder = qty % buyX;
    const billedUnits = (completeGroups * payY) + remainder;
    return originalUnitPrice * billedUnits;
  }

  // Descuento simple aplicado a cada unidad
  const discPrice = calculateDiscountedUnitPrice(originalUnitPrice, promo);
  return discPrice * qty;
}

/**
 * Formatea un texto legible describiendo la oferta o descuento de la promoción.
 */
export function getPromotionBadgeText(promo) {
  if (!promo) return '';
  const type = promo.tipo_descuento;
  switch (type) {
    case 'porcentaje':
      return `${promo.porcentaje}% OFF`;
    case 'importe_fijo':
      return `$${promo.importe_fijo} OFF`;
    case 'precio_fijo':
      return `$${promo.precio_fijo} Final`;
    case 'compra_x_paga_y':
      return `${promo.cantidad_compra}x${promo.cantidad_paga}`;
    default:
      return 'Promo';
  }
}
