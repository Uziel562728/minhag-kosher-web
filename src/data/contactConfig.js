import { business } from '../config/business';

export const contactConfig = {
  whatsAppNumbers: business.whatsapp.map((w, idx) => ({
    id: w.id,
    label: w.label,
    numberDisplay: w.displayNumber || w.localNumber,
    numberApi: w.internationalNumber,
    defaultMessage: `Hola ${business.name}, quería hacer una consulta.`,
    isDefault: idx === 0
  })),
  socialMedia: {
    instagramGeneral: business.instagram,
    instagrams: [
      {
        id: 'kosher',
        label: `@${business.instagram.split('/').filter(Boolean).pop() || 'minhagkosher'}`,
        url: business.instagram,
        branchId: 'branch-1'
      }
    ],
    facebook: '',  // Prepared for future Facebook URL
    email: '',     // Prepared for future Email address
    telefono: ''   // Prepared for future landline/phone
  }
};

/**
 * Helper function to generate a WhatsApp API link.
 * @param {string} apiNumber - Clean number (e.g. 5491134213919)
 * @param {string} message - Text message to pre-fill
 * @returns {string} Fully formed WhatsApp API link or '#' if not configured
 */
export function getWhatsAppLink(apiNumber, message) {
  if (!apiNumber) return '#';
  const cleanPhone = apiNumber.replace(/[^0-9]/g, '');
  const encodedText = encodeURIComponent(message || '');
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}
