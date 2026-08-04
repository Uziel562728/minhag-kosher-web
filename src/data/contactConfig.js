export const contactConfig = {
  whatsAppNumbers: [
    {
      id: 'main',
      label: 'WhatsApp Consultas',
      numberDisplay: '+54 9 11 2328 7769',
      numberApi: '5491123287769', // Properly formatted API number (Argentina country code + 9 + mobile area code + number)
      defaultMessage: 'Hola Super Market Kosher, quería hacer una consulta.',
      isDefault: true
    }
  ],
  socialMedia: {
    instagramGeneral: '', // Prepared for general main Instagram account
    instagrams: [
      {
        id: 'kosher',
        label: '@supermarketkosher',
        url: 'https://www.instagram.com/supermarketkosher',
        branchId: 'branch-1' // Linked to the single branch
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
 * @returns {string} Fully formed WhatsApp API link
 */
export function getWhatsAppLink(apiNumber, message) {
  const encodedText = encodeURIComponent(message || '');
  return `https://wa.me/${apiNumber}?text=${encodedText}`;
}
