export const branches = [
  {
    id: 'branch-1',
    nombre: 'SUPER MARKET KOSHER',
    direccion: 'Dr. Juan Felipe Aranguren 2866, Flores, Ciudad Autónoma de Buenos Aires',
    isKosher: true,
    coordenadas: {
      lat: -34.625149,
      lng: -58.4715794
    },
    googleMapsUrl: 'https://maps.app.goo.gl/Xaggm8j91K28eYKf7',
    comoLlegarUrl: 'https://www.google.com/maps/dir/?api=1&destination=-34.625149,-58.4715794'
  }
];

/**
 * Checks if the Kosher branch is currently closed for Shabat.
 * Shabat closes on Fridays at 16:00 hs and remains closed all Saturday.
 * @returns {boolean} True if currently Shabat time
 */
export function isKosherClosedForShabat() {
  const now = new Date();
  const day = now.getDay(); // 0: Sunday, 1: Monday, 2: Tuesday, 3: Wednesday, 4: Thursday, 5: Friday, 6: Saturday
  const hour = now.getHours();

  // Friday after 16:00 hs (4 PM)
  if (day === 5 && hour >= 16) {
    return true;
  }
  // Saturday all day
  if (day === 6) {
    return true;
  }
  return false;
}
