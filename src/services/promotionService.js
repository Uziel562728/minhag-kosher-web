import { supabase } from '../supabaseClient';
import { getActiveCampaignsList } from './campaignService';

let cachedCampaigns = null;
let cachedRelations = [];
let isLoaded = false;

function normalizeCampaign(c) {
  if (!c) return null;
  return {
    ...c,
    popup_frecuencia: c.popup_frecuencia || 'una_vez_sesion',
    popup_dispositivo: c.popup_dispositivo || 'todos',
    popup_retraso_segundos: c.popup_retraso_segundos !== undefined && c.popup_retraso_segundos !== null ? c.popup_retraso_segundos : 0,
    popup_se_puede_cerrar: c.popup_se_puede_cerrar !== false,
    mostrar_imagen: c.mostrar_imagen || false
  };
}

/**
 * Obtiene todas las campañas vigentes activas (tanto promocion como popup) y sus relaciones.
 */
export async function fetchActivePromotions(forceRefresh = false) {
  if (isLoaded && !forceRefresh && cachedCampaigns !== null) {
    const promotions = cachedCampaigns.filter(c => c.tipo === 'promocion');
    return { promotions, campaigns: cachedCampaigns, relations: cachedRelations };
  }

  try {
    // 1. Obtener IDs de campañas vigentes activas según la vista
    const activeIds = await getActiveCampaignsList();
    if (activeIds.length === 0) {
      cachedCampaigns = [];
      cachedRelations = [];
      isLoaded = true;
      return { promotions: [], campaigns: [], relations: [] };
    }

    // 2. Obtener detalles de campañas (tipo promocion o popup) habilitadas
    const { data: campaignData, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .in('id', activeIds)
      .eq('habilitada', true);

    if (campaignError) throw campaignError;

    const normalized = (campaignData || []).map(normalizeCampaign);

    // 3. Obtener relaciones de productos asociadas a campañas activas de tipo promocion
    const promoIds = normalized.filter(c => c.tipo === 'promocion').map(p => p.id);
    let relationsData = [];
    if (promoIds.length > 0) {
      const { data: relData, error: relationsError } = await supabase
        .from('campaign_products')
        .select('*')
        .in('campaign_id', promoIds);

      if (relationsError) {
        console.warn('Fallo al obtener campaign_products para promociones:', relationsError);
      } else {
        relationsData = relData || [];
      }
    }

    cachedCampaigns = normalized;
    cachedRelations = relationsData;
    isLoaded = true;

    const promotions = normalized.filter(c => c.tipo === 'promocion');
    return { promotions, campaigns: normalized, relations: relationsData };
  } catch (error) {
    console.error('Error cargando promociones y campañas del catálogo:', error);
    return { promotions: [], campaigns: [], relations: [] };
  }
}

export function getLoadedActivePromotions() {
  const campaigns = cachedCampaigns || [];
  const promotions = campaigns.filter(c => c.tipo === 'promocion');
  return { promotions, campaigns, relations: cachedRelations || [] };
}

export function clearPromotionsCache() {
  cachedCampaigns = null;
  cachedRelations = [];
  isLoaded = false;
}
