import { supabase } from '../supabaseClient';
import { getStoragePathFromUrl, generateUniqueStoragePath } from '../utils/campaignImageUtils';

const BUCKET_NAME = 'campaign-flyers';

/**
 * Uploads a campaign image file to Supabase Storage.
 * @param {string} campaignId 
 * @param {File} file 
 * @returns {Promise<{ path: string, publicUrl: string }>}
 */
export async function uploadCampaignImage(campaignId, file) {
  // 1. File size validation (10 MB limit)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('El tamaño de la imagen excede el límite de 10 MB.');
  }

  // 2. File type validation
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Tipo de archivo inválido. Solo se aceptan imágenes JPEG, PNG, WEBP y GIF.');
  }

  // 3. Generate unique name
  const path = generateUniqueStoragePath(campaignId, file.name);

  // 4. Upload to storage
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file);

  if (error) {
    console.error('Supabase Storage upload error:', error);
    if (error.status === 403 || error.message?.includes('403')) {
      throw new Error(`Acceso denegado (403): Asegúrate de tener permisos de administrador o de que las políticas RLS del bucket "${BUCKET_NAME}" permitan la inserción de objetos. Detalle: ${error.message}`);
    }
    throw error;
  }

  // 5. Retrieve public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  if (!urlData || !urlData.publicUrl) {
    throw new Error('No se pudo generar la URL pública de la imagen subida.');
  }

  return {
    path,
    publicUrl: urlData.publicUrl
  };
}

/**
 * Counts how many campaigns use the same popup_imagen_url.
 * @param {string} publicUrl 
 * @returns {Promise<number>}
 */
export async function countImageUsage(publicUrl) {
  if (!publicUrl) return 0;
  
  const { data, error } = await supabase
    .from('campaigns')
    .select('id')
    .or(`imagen_url.eq."${publicUrl}",popup_imagen_url.eq."${publicUrl}"`);

  if (error) {
    console.warn('Error counting image usage in campaigns:', error);
    return 0;
  }
  return data ? data.length : 0;
}

/**
 * Safely deletes a campaign image from Supabase Storage if it's not shared.
 * @param {string} publicUrl 
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function deleteCampaignImage(publicUrl) {
  const path = getStoragePathFromUrl(publicUrl);
  
  if (!path) {
    return { success: true, message: 'URL externa o no perteneciente al bucket. No se elimina de Storage.' };
  }

  try {
    // Check if the image is shared among other campaigns
    const usageCount = await countImageUsage(publicUrl);
    if (usageCount > 1) {
      console.log(`Image at ${path} is shared by ${usageCount} campaigns. Preserving file.`);
      return { success: true, message: 'Imagen compartida preservada en Storage.' };
    }

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      console.warn(`Failed to delete object from storage: ${error.message}`);
      return { success: false, message: `Error al borrar objeto de Storage: ${error.message}` };
    }

    return { success: true, message: 'Imagen eliminada de Storage con éxito.' };
  } catch (err) {
    console.error('Failed to perform image deletion check:', err);
    return { success: false, message: err.message || 'Error al intentar borrar la imagen.' };
  }
}
