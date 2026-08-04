export const PRODUCT_SLUG_ALIASES = Object.freeze({
  'maicena-x1': 'maicena',
  'maicena-x12': 'maicena',
  'conito-x1': 'conito',
  'conitos-x12': 'conito',
  'alfajor-x1': 'alfajor',
  'alfajores-x12': 'alfajor',
  'bombas-x12': 'bombas',
  'bombas-x20': 'bombas',
});

const normalizePresentation = (presentation) => ({
  id: String(presentation.id || '').trim(),
  label: String(presentation.label || '').trim(),
  cantidad_unidades: Number(presentation.cantidad_unidades),
  precio: Number(presentation.precio),
  tipo: presentation.tipo,
});

export function validatePresentations(value, options = {}) {
  const errors = [];
  if (!Array.isArray(value) || value.length === 0) {
    return { valid: false, errors: ['Debe existir al menos una presentación.'], presentations: [] };
  }

  const presentations = value.map(normalizePresentation);
  const ids = new Set();
  const quantities = new Set();
  let unitCount = 0;
  let packCount = 0;

  presentations.forEach((presentation, index) => {
    const row = `Presentación ${index + 1}`;
    if (!presentation.id) errors.push(`${row}: el ID es obligatorio.`);
    if (!presentation.label) errors.push(`${row}: el nombre visible es obligatorio.`);
    if (!['unidad', 'pack'].includes(presentation.tipo)) errors.push(`${row}: el tipo debe ser unidad o pack.`);
    if (!Number.isInteger(presentation.cantidad_unidades) || presentation.cantidad_unidades <= 0) errors.push(`${row}: la cantidad debe ser un entero mayor que cero.`);
    if (!Number.isFinite(presentation.precio) || presentation.precio < 0) errors.push(`${row}: el precio debe ser mayor o igual a cero.`);
    if (ids.has(presentation.id)) errors.push(`${row}: el ID está repetido.`);
    if (quantities.has(presentation.cantidad_unidades)) errors.push(`${row}: la cantidad de unidades está repetida.`);
    ids.add(presentation.id);
    quantities.add(presentation.cantidad_unidades);
    if (presentation.tipo === 'unidad') {
      unitCount += 1;
      if (presentation.cantidad_unidades !== 1) errors.push(`${row}: una presentación por unidad debe equivaler a 1 unidad.`);
    } else if (presentation.tipo === 'pack') packCount += 1;
  });

  if (unitCount > 1) errors.push('Solo puede existir una presentación de tipo unidad.');
  if (options.mode === 'free' && unitCount !== 1) errors.push('La cantidad libre exige exactamente una presentación de tipo unidad.');
  if (options.mode === 'free' && packCount !== 1) errors.push('La cantidad libre exige exactamente un pack configurado.');
  if (options.mode === 'packs' && unitCount > 0) errors.push('Un producto de packs cerrados no puede tener presentación por unidad.');

  return { valid: errors.length === 0, errors, presentations };
}

export function getValidPresentations(product) {
  const result = validatePresentations(product?.presentaciones);
  return result.valid ? result.presentations : [];
}

export function hasValidPresentations(product) {
  return getValidPresentations(product).length > 0;
}

export function allowsFreeQuantity(product) {
  return getValidPresentations(product).some((presentation) => presentation.tipo === 'unidad');
}

export function onlyAllowsClosedPacks(product) {
  const presentations = getValidPresentations(product);
  return presentations.length > 0 && presentations.every((presentation) => presentation.tipo === 'pack');
}

export function getLowestPresentationPrice(product) {
  const presentations = getValidPresentations(product);
  if (presentations.length === 0) return Number(product?.precio) || 0;
  return Math.min(...presentations.map((presentation) => presentation.precio));
}

export function calculateUnitAndPack(presentationsOrProduct, totalUnits) {
  const presentations = Array.isArray(presentationsOrProduct)
    ? validatePresentations(presentationsOrProduct).presentations
    : getValidPresentations(presentationsOrProduct);
  const unit = presentations.find((presentation) => presentation.tipo === 'unidad');
  const pack = presentations
    .filter((presentation) => presentation.tipo === 'pack')
    .sort((a, b) => b.cantidad_unidades - a.cantidad_unidades)[0];
  const quantity = Math.max(1, Math.floor(Number(totalUnits) || 1));
  if (!unit) return null;
  const completePacks = pack ? Math.floor(quantity / pack.cantidad_unidades) : 0;
  const looseUnits = pack ? quantity % pack.cantidad_unidades : quantity;
  const packSubtotal = completePacks * (pack?.precio || 0);
  const unitSubtotal = looseUnits * unit.precio;
  return {
    mode: 'free',
    totalUnits: quantity,
    completePacks,
    looseUnits,
    pack,
    unit,
    packSubtotal,
    unitSubtotal,
    total: packSubtotal + unitSubtotal,
  };
}

export function calculateClosedPacks(presentation, packCount) {
  if (!presentation || presentation.tipo !== 'pack') return null;
  const count = Math.max(1, Math.floor(Number(packCount) || 1));
  return {
    mode: 'packs',
    presentation,
    packCount: count,
    totalUnits: presentation.cantidad_unidades * count,
    total: presentation.precio * count,
  };
}

export function getReadableBreakdown(calculation) {
  if (!calculation) return '';
  if (calculation.mode === 'packs') {
    return `${calculation.packCount} ${calculation.packCount === 1 ? 'pack' : 'packs'} ${calculation.presentation.label}`;
  }
  const parts = [];
  if (calculation.completePacks > 0) parts.push(`${calculation.completePacks} ${calculation.completePacks === 1 ? 'pack' : 'packs'} x${calculation.pack.cantidad_unidades}`);
  if (calculation.looseUnits > 0) parts.push(`${calculation.looseUnits} ${calculation.looseUnits === 1 ? 'unidad' : 'unidades'}`);
  return parts.join(' + ');
}

export function buildCartLineKey(productId, presentationId = 'traditional') {
  return `${productId}::${presentationId || 'traditional'}`;
}

export function resolveProductSlug(slug = '') {
  return PRODUCT_SLUG_ALIASES[slug] || slug;
}

export function getLegacySlugsFor(slug = '') {
  return Object.entries(PRODUCT_SLUG_ALIASES)
    .filter(([, current]) => current === slug)
    .map(([legacy]) => legacy);
}
