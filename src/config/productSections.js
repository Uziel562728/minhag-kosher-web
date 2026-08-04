const normalizeText = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

export const PRODUCT_SECTIONS_BY_CATEGORY = Object.freeze({
  unidades: Object.freeze([
    Object.freeze({ value: 'carne', label: 'Carne' }),
    Object.freeze({ value: 'lactea', label: 'Láctea' }),
    Object.freeze({ value: 'neutro', label: 'Neutro' }),
  ]),
  tortas: Object.freeze([
    Object.freeze({ value: 'parve', label: 'Parve' }),
    Object.freeze({ value: 'lactea', label: 'Láctea' }),
  ]),
  dulces: Object.freeze([
    Object.freeze({ value: 'neutro', label: 'Neutro' }),
    Object.freeze({ value: 'lactea', label: 'Lácteo' }),
  ]),
});

const SECTION_ALIASES = Object.freeze({
  lacteo: 'lactea',
  lacteos: 'lactea',
  lacteas: 'lactea',
  neutra: 'neutro',
  neutros: 'neutro',
  carnes: 'carne',
});

export const normalizeCategorySlug = (value = '') => normalizeText(value);

export const normalizeProductSection = (value = '') => {
  const normalized = normalizeText(value);
  return SECTION_ALIASES[normalized] || normalized;
};

export const getProductSectionOptions = (categorySlug = '') => (
  PRODUCT_SECTIONS_BY_CATEGORY[normalizeCategorySlug(categorySlug)] || []
);

export const categoryHasProductSections = (categorySlug = '') => (
  getProductSectionOptions(categorySlug).length > 0
);

export const isValidProductSection = (categorySlug = '', section = '') => {
  const normalizedSection = normalizeProductSection(section);
  return getProductSectionOptions(categorySlug).some(({ value }) => value === normalizedSection);
};

export const getProductSectionLabel = (section = '', categorySlug = '') => {
  const normalizedSection = normalizeProductSection(section);
  const configuredOption = getProductSectionOptions(categorySlug)
    .find(({ value }) => value === normalizedSection);

  if (configuredOption) return configuredOption.label;
  if (!normalizedSection) return '';
  return normalizedSection.charAt(0).toUpperCase() + normalizedSection.slice(1);
};
