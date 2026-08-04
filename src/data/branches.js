import { business } from '../config/business';

export const branches = [
  {
    id: 'branch-1',
    nombre: business.name.toUpperCase(),
    direccion: business.address.full,
    isKosher: true,
    coordenadas: {
      lat: business.coordinates.lat,
      lng: business.coordinates.lng
    },
    googleMapsUrl: business.googleMapsUrl,
    comoLlegarUrl: business.comoLlegarUrl
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
