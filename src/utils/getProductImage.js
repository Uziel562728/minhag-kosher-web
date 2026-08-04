import { generatedProductImages } from "../config/generatedProductImages";
import { withBaseUrl } from "./withBaseUrl";

const normalizeText = (value = "") => {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const toProductSlug = (value = "") =>
  normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const productImageRules = [
  {
    keywords: ["empanada", "lajmayin", "sambusak", "sambusek"],
    image: "images/product-placeholders/empanadas.webp",
  },
  {
    keywords: ["ensalada", "salpicon"],
    image: "images/product-placeholders/ensaladas.webp",
  },
  {
    keywords: ["sandwich", "miga", "chips", "figacita", "trencita"],
    image: "images/product-placeholders/sandwiches.webp",
  },
  {
    keywords: ["alfajor", "maicena", "conito"],
    image: "images/product-placeholders/alfajores.webp",
  },
  {
    keywords: ["masa", "bomba", "dulce arabe", "canoncito", "canon"],
    image: "images/product-placeholders/masas.webp",
  },
  {
    keywords: ["merengue"],
    image: "images/product-placeholders/merengues.webp",
  },
  {
    keywords: [
      "pan",
      "pebete",
      "pretzalej",
      "grisines",
      "bizcochito",
      "cuernito",
    ],
    image: "images/product-placeholders/panes.webp",
  },
  {
    keywords: ["pollo", "suprema"],
    image: "images/product-placeholders/pollo.webp",
  },
  {
    keywords: ["filete", "atun", "salmon"],
    image: "images/product-placeholders/pescado.webp",
  },
  {
    keywords: ["torta", "tarta", "souffle", "canelones"],
    image: "images/product-placeholders/tartas.webp",
  },
  {
    keywords: ["copetin", "boio", "knish", "dedito", "muerra"],
    image: "images/product-placeholders/copetin.webp",
  },
];

const categoryFallbacks = {
  unidades: "images/product-placeholders/unidades.webp",
  comidas: "images/product-placeholders/comidas.webp",
  dulces: "images/product-placeholders/dulces.webp",
  panaderia: "images/product-placeholders/panaderia.webp",
  tortas: "images/product-placeholders/tortas.webp",
};

export function hasRealProductImage(product = {}) {
  return typeof product.imagen_principal === "string" && product.imagen_principal.trim().length > 0;
}

export function getProductImage(product = {}) {
  if (hasRealProductImage(product)) {
    return product.imagen_principal.trim();
  }

  const productSlug = toProductSlug(product.slug || product.nombre);
  const generatedImage = generatedProductImages[productSlug];

  if (generatedImage) {
    return withBaseUrl(generatedImage);
  }

  const name = normalizeText(product.nombre);

  const matchingRule = productImageRules.find(({ keywords }) =>
    keywords.some((keyword) => name.includes(normalizeText(keyword)))
  );

  if (matchingRule) {
    return withBaseUrl(matchingRule.image);
  }

  const categorySlug = normalizeText(
    product.categoria_slug ||
    product.categories?.slug ||
    product.category?.slug
  );

  const fallbackPath = categoryFallbacks[categorySlug] || "images/product-placeholders/default.webp";
  return withBaseUrl(fallbackPath);
}
