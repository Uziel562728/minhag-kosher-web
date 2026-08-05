/**
 * Safe utility to extract the Storage internal path from a Supabase public URL.
 */

const STORAGE_SEGMENT = '/storage/v1/object/public/campaign-flyers/';

/**
 * Checks if a given URL belongs to the campaign-flyers bucket of the Supabase project.
 * @param {string} url 
 * @returns {boolean}
 */
export function isProjectStorageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.includes(STORAGE_SEGMENT);
}

/**
 * Extracts the storage file path (e.g. campaigns/id/file.png) from a Supabase public URL.
 * @param {string} url 
 * @returns {string|null}
 */
export function getStoragePathFromUrl(url) {
  if (!isProjectStorageUrl(url)) return null;
  try {
    const parts = url.split(STORAGE_SEGMENT);
    if (parts.length > 1 && parts[1].trim()) {
      return decodeURIComponent(parts[1].trim());
    }
  } catch (err) {
    console.error('Error decoding storage URL path:', err);
  }
  return null;
}

/**
 * Formats a clean, safe, and unique filename based on the campaignId and original extension.
 * @param {string} campaignId 
 * @param {string} originalName 
 * @returns {string}
 */
export function generateUniqueStoragePath(campaignId, originalName) {
  const extension = originalName.split('.').pop() || 'jpg';
  const cleanExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, '');
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).slice(2, 8);
  return `campaigns/${campaignId}/${timestamp}-${randomId}.${cleanExtension}`;
}
