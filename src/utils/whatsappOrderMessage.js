const SEPARATOR = '━━━━━━━━━━━━━━━━━━';

export const formatCurrency = (value) => new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(Number(value) || 0).replace(/\s/g, '');

export const pluralizePack = (quantity) => `${quantity} ${Number(quantity) === 1 ? 'pack' : 'packs'}`;

export const pluralizeUnit = (quantity) => `${quantity} ${Number(quantity) === 1 ? 'unidad' : 'unidades'}`;

export function buildProductMessageBlock(item, index) {
  const subtotal = item.mode === 'traditional'
    ? Number(item.product.precio) * item.quantity
    : item.subtotal;
  const lines = [`*${index + 1}. ${item.product.nombre}*`];

  if (item.mode === 'free') {
    lines.push(`• Cantidad total: ${pluralizeUnit(item.cantidadUnidadesTotales)}`);
    lines.push(`• Presentación: ${item.breakdown}`);
  } else if (item.mode === 'packs') {
    lines.push(`• Presentación: ${item.presentationLabel}`);
    lines.push(`• Cantidad: ${pluralizePack(item.cantidadPacks)}`);
    lines.push(`• Total de unidades: ${item.cantidadUnidadesTotales}`);
  } else {
    lines.push(`• Cantidad: ${pluralizeUnit(item.quantity)}`);
  }

  lines.push(`• Subtotal: *${formatCurrency(subtotal)}*`);
  return lines;
}

export function buildDeliveryBlock(orderData) {
  if (orderData.shippingMethod !== 'envio') return [];

  const lines = [
    '',
    SEPARATOR,
    '*DATOS DE ENTREGA*',
    SEPARATOR,
    '',
    `*Dirección:* ${orderData.street}`,
    `*Barrio/localidad:* ${orderData.neighborhood}`,
  ];

  if (orderData.floor) lines.push(`*Piso:* ${orderData.floor}`);
  if (orderData.dept) lines.push(`*Departamento:* ${orderData.dept}`);
  if (orderData.notes) lines.push(`*Indicaciones:* ${orderData.notes}`);

  return lines;
}

export function buildWhatsAppOrderMessage(orderData) {
  const deliveryText = orderData.shippingMethod === 'envio'
    ? 'Envío a domicilio'
    : 'Retiro por el local';
  const shippingText = orderData.shippingMethod === 'envio'
    ? 'A coordinar'
    : 'No corresponde';

  const lines = [
    '*NUEVO PEDIDO — MINHAG KOSHER*',
    '',
    SEPARATOR,
    '*DATOS DEL CLIENTE*',
    SEPARATOR,
    '',
    `*Nombre:* ${orderData.name}`,
    `*Teléfono:* ${orderData.phone}`,
    `*Entrega:* ${deliveryText}`,
    ...buildDeliveryBlock(orderData),
    '',
    SEPARATOR,
    '*DETALLE DEL PEDIDO*',
    SEPARATOR,
    '',
  ];

  orderData.cart.forEach((item, index) => {
    if (index > 0) lines.push('');
    lines.push(...buildProductMessageBlock(item, index));
  });

  lines.push(
    '',
    SEPARATOR,
    '*RESUMEN*',
    SEPARATOR,
    '',
    `*Subtotal:* ${formatCurrency(orderData.cartTotal)}`,
    `*Envío:* ${shippingText}`,
    `*TOTAL:* *${formatCurrency(orderData.cartTotal)}*`,
    '',
    '✅ Quedo a la espera de la confirmación.',
    '¡Muchas gracias!',
  );

  return lines.join('\n');
}

