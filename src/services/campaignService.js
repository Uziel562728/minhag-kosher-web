import { supabase } from '../supabaseClient';

function optionalNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Helper to normalize campaign fields for retrocompatibility
function normalizeCampaign(c) {
  if (!c) return null;
  const imagen = c.imagen_url || c.popup_imagen_url || '';
  const destTipo = c.destino_tipo || c.popup_destino_tipo || 'ninguno';
  const destVal = c.destino_valor || c.popup_destino_valor || '';
  return {
    ...c,
    imagen_url: imagen,
    popup_imagen_url: imagen,
    destino_tipo: destTipo,
    popup_destino_tipo: destTipo,
    destino_valor: destVal,
    popup_destino_valor: destVal,
    mostrar_imagen: c.mostrar_imagen ?? (!!imagen)
  };
}

// 1. Fetch campaigns
export async function getCampaigns() {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('prioridad', { ascending: false })
    .order('fecha_actualizacion', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeCampaign);
}

// 2. Fetch active campaigns from view
export async function getActiveCampaignsList() {
  const { data, error } = await supabase
    .from('active_campaigns')
    .select('id');

  if (error) {
    console.warn('active_campaigns view fetch failed or is unconfigured:', error);
    return [];
  }
  return data ? data.map(c => c.id) : [];
}

// 3. Fetch campaign by ID
export async function getCampaignById(id) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return normalizeCampaign(data);
}

// 4. Fetch campaign products relation
export async function getCampaignProducts(campaignId) {
  const { data, error } = await supabase
    .from('campaign_products')
    .select(`
      *,
      products (
        id,
        nombre,
        precio,
        precio_anterior,
        imagen_principal,
        categoria_id
      )
    `)
    .eq('campaign_id', campaignId);

  if (error) throw error;
  return data || [];
}

// 5. Create a campaign
export async function createCampaign(campaignPayload, selectedProducts = []) {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id || null;

  // Align redundant fields for retrocompatibility
  const image = campaignPayload.imagen_url || null;
  const destType = campaignPayload.destino_tipo || 'ninguno';
  const destVal = campaignPayload.destino_valor || null;

  const newCampaign = {
    ...campaignPayload,
    popup_imagen_url: image,
    popup_destino_tipo: destType,
    popup_destino_valor: destVal,
    imagen_url: image,
    destino_tipo: destType,
    destino_valor: destVal,
    creado_por: userId,
    actualizado_por: userId,
    fecha_creacion: new Date().toISOString(),
    fecha_actualizacion: new Date().toISOString()
  };

  const { data: createdCampaign, error: createError } = await supabase
    .from('campaigns')
    .insert([newCampaign])
    .select()
    .single();

  if (createError) throw createError;

  const campaignId = createdCampaign.id;

  if (campaignPayload.tipo === 'promocion' && campaignPayload.alcance_promocion === 'productos_seleccionados' && selectedProducts.length > 0) {
    const productsToInsert = selectedProducts.map(p => ({
      campaign_id: campaignId,
      product_id: p.product_id,
      incluido: p.incluido !== false,
      tipo_descuento: p.isCustomDiscount ? p.tipo_descuento : null,
      porcentaje: p.isCustomDiscount ? (p.tipo_descuento === 'porcentaje' ? optionalNumber(p.porcentaje) : null) : null,
      importe_fijo: p.isCustomDiscount ? (p.tipo_descuento === 'importe_fijo' ? optionalNumber(p.importe_fijo) : null) : null,
      precio_fijo: p.isCustomDiscount ? (p.tipo_descuento === 'precio_fijo' ? optionalNumber(p.precio_fijo) : null) : null,
      cantidad_compra: p.isCustomDiscount ? (p.tipo_descuento === 'compra_x_paga_y' ? optionalNumber(p.cantidad_compra) : null) : null,
      cantidad_paga: p.isCustomDiscount ? (p.tipo_descuento === 'compra_x_paga_y' ? optionalNumber(p.cantidad_paga) : null) : null,
      texto_etiqueta: p.isCustomDiscount ? p.texto_etiqueta : null,
      presentation_id: null,
      fecha_creacion: new Date().toISOString(),
      fecha_actualizacion: new Date().toISOString()
    }));

    const { error: productsError } = await supabase
      .from('campaign_products')
      .insert(productsToInsert);

    if (productsError) {
      await supabase.from('campaigns').delete().eq('id', campaignId);
      throw new Error(`Error al asociar productos: ${productsError.message}. Campaña revertida.`);
    }
  }

  return normalizeCampaign(createdCampaign);
}

// 6. Update a campaign
export async function updateCampaign(campaignId, campaignPayload, selectedProducts = []) {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id || null;

  // Align redundant fields for retrocompatibility
  const image = campaignPayload.imagen_url || null;
  const destType = campaignPayload.destino_tipo || 'ninguno';
  const destVal = campaignPayload.destino_valor || null;

  const updatedCampaign = {
    ...campaignPayload,
    popup_imagen_url: image,
    popup_destino_tipo: destType,
    popup_destino_valor: destVal,
    imagen_url: image,
    destino_tipo: destType,
    destino_valor: destVal,
    actualizado_por: userId,
    fecha_actualizacion: new Date().toISOString()
  };

  // 1. Update main campaign
  const { data: resultCampaign, error: updateError } = await supabase
    .from('campaigns')
    .update(updatedCampaign)
    .eq('id', campaignId)
    .select()
    .single();

  if (updateError) throw updateError;

  // 2. Sync products
  const shouldHaveProducts = campaignPayload.tipo === 'promocion' && campaignPayload.alcance_promocion === 'productos_seleccionados';

  if (!shouldHaveProducts) {
    const { error: deleteError } = await supabase
      .from('campaign_products')
      .delete()
      .eq('campaign_id', campaignId);
    
    if (deleteError) {
      throw new Error(`Campaña actualizada, pero falló al limpiar los productos anteriores: ${deleteError.message}`);
    }
  } else {
    const { data: existingRelations, error: fetchRelError } = await supabase
      .from('campaign_products')
      .select('id, product_id')
      .eq('campaign_id', campaignId);

    if (fetchRelError) throw fetchRelError;

    const existingMap = new Map(existingRelations.map(r => [r.product_id, r.id]));
    const targetProductIds = new Set(selectedProducts.map(p => p.product_id));

    const toDeleteIds = existingRelations
      .filter(r => !targetProductIds.has(r.product_id))
      .map(r => r.id);

    if (toDeleteIds.length > 0) {
      const { error: bulkDeleteError } = await supabase
        .from('campaign_products')
        .delete()
        .in('id', toDeleteIds);
      if (bulkDeleteError) throw bulkDeleteError;
    }

    const toInsert = [];
    const toUpdate = [];

    selectedProducts.forEach(p => {
      const payload = {
        campaign_id: campaignId,
        product_id: p.product_id,
        incluido: p.incluido !== false,
        tipo_descuento: p.isCustomDiscount ? p.tipo_descuento : null,
        porcentaje: p.isCustomDiscount ? (p.tipo_descuento === 'porcentaje' ? optionalNumber(p.porcentaje) : null) : null,
        importe_fijo: p.isCustomDiscount ? (p.tipo_descuento === 'importe_fijo' ? optionalNumber(p.importe_fijo) : null) : null,
        precio_fijo: p.isCustomDiscount ? (p.tipo_descuento === 'precio_fijo' ? optionalNumber(p.precio_fijo) : null) : null,
        cantidad_compra: p.isCustomDiscount ? (p.tipo_descuento === 'compra_x_paga_y' ? optionalNumber(p.cantidad_compra) : null) : null,
        cantidad_paga: p.isCustomDiscount ? (p.tipo_descuento === 'compra_x_paga_y' ? optionalNumber(p.cantidad_paga) : null) : null,
        texto_etiqueta: p.isCustomDiscount ? p.texto_etiqueta : null,
        presentation_id: null,
        fecha_actualizacion: new Date().toISOString()
      };

      const dbId = existingMap.get(p.product_id);
      if (dbId) {
        toUpdate.push({ id: dbId, ...payload });
      } else {
        toInsert.push({
          ...payload,
          fecha_creacion: new Date().toISOString()
        });
      }
    });

    if (toInsert.length > 0) {
      const { error: insError } = await supabase
        .from('campaign_products')
        .insert(toInsert);
      if (insError) throw insError;
    }

    if (toUpdate.length > 0) {
      const { error: upsError } = await supabase
        .from('campaign_products')
        .upsert(toUpdate);
      if (upsError) throw upsError;
    }
  }

  return normalizeCampaign(resultCampaign);
}

// 7. Toggle enable state
export async function toggleCampaignEnabled(id, enabled) {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id || null;

  const { error } = await supabase
    .from('campaigns')
    .update({
      habilitada: enabled,
      estado: enabled ? 'programada' : 'pausada',
      actualizado_por: userId,
      fecha_actualizacion: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw error;
  return true;
}

// 8. Delete a campaign
export async function deleteCampaign(id) {
  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// 9. Duplicate campaign
export async function duplicateCampaign(campaignId) {
  const campaign = await getCampaignById(campaignId);
  const products = await getCampaignProducts(campaignId);

  const { id: _id, order_number: _on, creado_por: _cp, actualizado_por: _ap, fecha_creacion: _fc, fecha_actualizacion: _fa, ...cleanCampaign } = campaign;
  const duplicatePayload = {
    ...cleanCampaign,
    nombre: `${campaign.nombre} Copia`,
    estado: 'borrador',
    habilitada: false
  };

  const selectedProducts = products.map(p => ({
    product_id: p.product_id,
    incluido: p.incluido,
    isCustomDiscount: !!p.tipo_descuento,
    tipo_descuento: p.tipo_descuento,
    porcentaje: p.porcentaje,
    importe_fijo: p.importe_fijo,
    precio_fijo: p.precio_fijo,
    cantidad_compra: p.cantidad_compra,
    cantidad_paga: p.cantidad_paga,
    texto_etiqueta: p.texto_etiqueta
  }));

  return await createCampaign(duplicatePayload, selectedProducts);
}
