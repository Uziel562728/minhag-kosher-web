import { calculateDiscountedUnitPrice, calculateLineSubtotal, getPromotionBadgeText } from './promotionCalculations';

/**
 * Resuelve la promoción activa que corresponde a un producto específico según las reglas de prioridad.
 * 
 * Reglas de Prioridad:
 * 1. Personalización específica en campaign_products (con tipo_descuento propio)
 * 2. Campaña de productos seleccionados (incluido en la lista de la campaña)
 * 3. Campaña de categoría
 * 4. Campaña para todo el catálogo (todos)
 * 5. Desempate: mayor prioridad de la campaña
 * 6. Desempate: más reciente (fecha_actualizacion o fecha_creacion desc)
 * 
 * @param {Object} product - Producto a evaluar
 * @param {Array} promotions - Listado de promociones activas
 * @param {Array} relations - Relaciones de productos asociadas
 */
export function resolveActivePromotionForProduct(product, promotions, relations) {
  if (!product || !promotions || promotions.length === 0) return null;

  const productRelations = (relations || []).filter(r => r.product_id === product.id);

  const matchedPromos = [];

  promotions.forEach(promo => {
    // 1. Verificar si coincide con una personalización específica del producto (incluido con descuento propio)
    const specificRelation = productRelations.find(r => r.campaign_id === promo.id && r.incluido === true && r.tipo_descuento);
    if (specificRelation) {
      matchedPromos.push({
        promo,
        level: 1, // Prioridad 1: Personalizado
        customPromo: {
          ...promo,
          tipo_descuento: specificRelation.tipo_descuento,
          porcentaje: specificRelation.porcentaje,
          importe_fijo: specificRelation.importe_fijo,
          precio_fijo: specificRelation.precio_fijo,
          cantidad_compra: specificRelation.cantidad_compra,
          cantidad_paga: specificRelation.cantidad_paga,
          texto_etiqueta: specificRelation.texto_etiqueta
        }
      });
      return;
    }

    // 2. Verificar si está incluido en una campaña de productos seleccionados (hereda el descuento general)
    const includedRelation = productRelations.find(r => r.campaign_id === promo.id && r.incluido === true);
    if (promo.alcance_promocion === 'productos_seleccionados' && includedRelation) {
      matchedPromos.push({
        promo,
        level: 2, // Prioridad 2: Incluido en campaña de productos seleccionados
        customPromo: promo
      });
      return;
    }

    // 3. Verificar si aplica por Categoría
    if (promo.alcance_promocion === 'categoria' && promo.categoria_id === product.categoria_id) {
      matchedPromos.push({
        promo,
        level: 3, // Prioridad 3: Campaña de categoría
        customPromo: promo
      });
      return;
    }

    // 4. Verificar si aplica para todos
    if (promo.alcance_promocion === 'todos') {
      matchedPromos.push({
        promo,
        level: 4, // Prioridad 4: Todo el catálogo
        customPromo: promo
      });
    }
  });

  if (matchedPromos.length === 0) return null;

  // Ordenar candidatos por nivel de especificidad (asc), prioridad de campaña (desc), y fecha más reciente (desc)
  matchedPromos.sort((a, b) => {
    if (a.level !== b.level) {
      return a.level - b.level;
    }
    if (b.promo.prioridad !== a.promo.prioridad) {
      return b.promo.prioridad - a.promo.prioridad;
    }
    const timeA = new Date(a.promo.fecha_actualizacion || a.promo.fecha_creacion).getTime();
    const timeB = new Date(b.promo.fecha_actualizacion || b.promo.fecha_creacion).getTime();
    return timeB - timeA;
  });

  const winner = matchedPromos[0];

  return {
    campaign: winner.promo,
    resolvedPromo: winner.customPromo,
    level: winner.level
  };
}

/**
 * Resuelve y calcula toda la metadata promocional para un producto y su precio unitario,
 * soportando opcionalmente presentaciones.
 */
export function getProductPromotionDetails(product, activePromos = [], relations = [], selectedPresentation = null) {
  const result = {
    hasPromotion: false,
    promo: null,
    badgeText: '',
    originalPrice: 0,
    promoPrice: 0,
    isVolumetric: false, // Compra X paga Y
    textLabel: ''
  };

  if (!product) return result;

  // 1. Determinar precio original de la presentación elegida o precio base del producto
  let originalPrice = Number(product.precio) || 0;
  if (selectedPresentation) {
    originalPrice = Number(selectedPresentation.precio) || 0;
  }

  result.originalPrice = originalPrice;
  result.promoPrice = originalPrice;

  // 2. Buscar promoción ganadora
  const resolved = resolveActivePromotionForProduct(product, activePromos, relations);
  if (!resolved) return result;

  const promo = resolved.resolvedPromo;
  result.hasPromotion = true;
  result.promo = promo;
  result.badgeText = getPromotionBadgeText(promo);
  result.textLabel = promo.texto_etiqueta || '';

  if (promo.tipo_descuento === 'compra_x_paga_y') {
    result.isVolumetric = true;
  } else {
    result.promoPrice = calculateDiscountedUnitPrice(originalPrice, promo);
  }

  return result;
}

/**
 * Resuelve y calcula el subtotal original y promocional para cualquier item del carrito.
 * Soporta productos tradicionales y con presentaciones (libre y packs cerrados).
 */
export function resolveCartLineTotals(item, promotions = [], relations = []) {
  const result = {
    originalSubtotal: 0,
    promoSubtotal: 0,
    promoApplied: null,
    badgeText: '',
    discountAmount: 0
  };

  if (!item || !item.product) return result;

  const product = item.product;
  const quantity = Number(item.quantity) || 0;

  // 1. Resolver promoción
  const resolved = resolveActivePromotionForProduct(product, promotions, relations);
  const promo = resolved ? resolved.resolvedPromo : null;
  result.promoApplied = promo;

  if (promo) {
    result.badgeText = getPromotionBadgeText(promo);
  }

  // 2. Resolver por modo de carrito
  if (item.mode === 'traditional') {
    const originalPrice = Number(product.precio) || 0;
    result.originalSubtotal = originalPrice * quantity;
    result.promoSubtotal = calculateLineSubtotal(originalPrice, quantity, promo);
  } else if (item.mode === 'packs') {
    // Packs cerrados. El precio original por pack es item.precioPresentacion
    const packPrice = Number(item.precioPresentacion) || 0;
    const packCount = Number(item.quantity) || 0;
    result.originalSubtotal = packPrice * packCount;

    if (promo) {
      if (promo.tipo_descuento === 'compra_x_paga_y') {
        const buyX = Math.max(1, Number(promo.cantidad_compra) || 1);
        const payY = Math.max(1, Number(promo.cantidad_paga) || 1);
        if (packCount >= buyX) {
          const completeGroups = Math.floor(packCount / buyX);
          const remainder = packCount % buyX;
          const billedPacks = (completeGroups * payY) + remainder;
          result.promoSubtotal = packPrice * billedPacks;
        } else {
          result.promoSubtotal = packPrice * packCount;
        }
      } else {
        // Descuentos de porcentaje, importe o precio fijo se aplican al precio del pack
        const discountedPackPrice = calculateDiscountedUnitPrice(packPrice, promo);
        result.promoSubtotal = discountedPackPrice * packCount;
      }
    } else {
      result.promoSubtotal = result.originalSubtotal;
    }
  } else if (item.mode === 'free') {
    // Modo libre: tiene completePacks y looseUnits
    const unitPrice = Number(item.precioUnitario) || 0;
    const packPrice = Number(item.precioPresentacion) || 0;
    const completePacks = Number(item.cantidadPacks) || 0;
    const looseUnits = Number(item.cantidadUnidadesSueltas) || 0;

    const originalPackSubtotal = completePacks * packPrice;
    const originalUnitSubtotal = looseUnits * unitPrice;
    result.originalSubtotal = originalPackSubtotal + originalUnitSubtotal;

    if (promo) {
      if (promo.tipo_descuento === 'compra_x_paga_y') {
        // Compra X paga Y se aplica sobre las unidades sueltas
        const buyX = Math.max(1, Number(promo.cantidad_compra) || 1);
        const payY = Math.max(1, Number(promo.cantidad_paga) || 1);
        
        // El subtotal de los packs permanece intacto
        const promoPackSub = originalPackSubtotal;
        
        // Las unidades sueltas aplican 2x1
        let promoUnitSub = originalUnitSubtotal;
        if (looseUnits >= buyX) {
          const completeGroups = Math.floor(looseUnits / buyX);
          const remainder = looseUnits % buyX;
          const billedUnits = (completeGroups * payY) + remainder;
          promoUnitSub = unitPrice * billedUnits;
        }
        
        result.promoSubtotal = promoPackSub + promoUnitSub;
      } else {
        // Descuentos simples (porcentaje, importe) se aplican a los subtotales respectivos
        const discountedUnitPrice = calculateDiscountedUnitPrice(unitPrice, promo);
        const discountedPackPrice = calculateDiscountedUnitPrice(packPrice, promo);
        result.promoSubtotal = (completePacks * discountedPackPrice) + (looseUnits * discountedUnitPrice);
      }
    } else {
      result.promoSubtotal = result.originalSubtotal;
    }
  }

  result.discountAmount = Math.max(0, result.originalSubtotal - result.promoSubtotal);
  return result;
}
