// supabase/functions/create-order/index.ts
// Supabase Edge Function to securely process customer orders and send push notifications via FCM.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Helper to generate Google OAuth2 access token using Web Crypto
async function getGoogleAccessToken(clientEmail: string, privateKeyStr: string) {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  
  let cleanKey = privateKeyStr;
  if (cleanKey.includes(pemHeader)) {
    cleanKey = cleanKey.split(pemHeader)[1].split(pemFooter)[0];
  }
  cleanKey = cleanKey.replace(/\s/g, "");
  
  const binaryKey = Uint8Array.from(atob(cleanKey), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
  
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  
  const base64url = (str: string) => {
    return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  };
  
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaimSet = base64url(JSON.stringify(claimSet));
  
  const stringToSign = `${encodedHeader}.${encodedClaimSet}`;
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(stringToSign)
  );
  
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
    
  const jwt = `${stringToSign}.${encodedSignature}`;
  
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });
  
  const data = await res.json();
  if (data.error) {
    throw new Error(`Token exchange failed: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

// Function to send Push Notification via Firebase Cloud Messaging v1
async function sendFCMNotifications(
  supabaseClient: any,
  orderNumber: string,
  customerName: string,
  total: number,
  orderId: string
) {
  // Retrieve Firebase credentials securely from Deno environment inside the function scope
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID');
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY');
  const siteUrlRaw = Deno.env.get('PUBLIC_SITE_URL');

  if (!projectId || !clientEmail || !privateKey) {
    console.warn("FCM Not Configured: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY missing.");
    return;
  }

  const siteUrl = siteUrlRaw?.replace(/\/+$/, "");
  if (!siteUrl) {
    console.error("FCM Dispatcher skipped: PUBLIC_SITE_URL secret is not set.");
    return;
  }

  try {
    // 1. Fetch enabled push subscriptions from Supabase
    const { data: subscriptions, error: subError } = await supabaseClient
      .from('push_subscriptions')
      .select('token')
      .eq('enabled', true);

    if (subError) {
      throw new Error(`Error fetching push subscriptions: ${subError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No active push subscriptions found. Skipping notifications.");
      return;
    }

    // 2. Generate Google OAuth2 Token
    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const formattedTotal = Number(total).toLocaleString('es-AR');
    const orderUrl = `${siteUrl}/admin/orders/${orderId}`;

    // 3. Send notification to each device token
    for (const sub of subscriptions) {
      try {
        const payload = {
          message: {
            token: sub.token,
            data: {
              title: `Nuevo pedido #${orderNumber}`,
              body: `${customerName} — $${formattedTotal}`,
              orderId: String(orderId),
              orderNumber: String(orderNumber),
              url: orderUrl,
              type: "new_order"
            },
            webpush: {
              headers: {
                Urgency: "high"
              }
            }
          }
        };

        const response = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const resData = await response.json();

        // 4. Handle expired/unregistered tokens
        if (!response.ok) {
          const status = response.status;
          const errorCode = resData?.error?.status;
          const errorMessage = resData?.error?.message || '';

          if (status === 404 || status === 410 || errorCode === 'NOT_FOUND' || errorMessage.includes('not registered')) {
            console.log(`Unregistered FCM token found. Disabling subscription: ${sub.token.substring(0, 15)}...`);
            await supabaseClient
              .from('push_subscriptions')
              .update({ enabled: false, updated_at: new Date().toISOString() })
              .eq('token', sub.token);
          } else {
            console.error(`FCM send error for token: ${errorMessage}`);
          }
        }
      } catch (tokenErr) {
        console.error("Failed to send push notification to single token:", tokenErr.message);
      }
    }
  } catch (error) {
    // Log failure securely without revealing secrets
    console.error("FCM Dispatcher Error:", error.message);
  }
}

serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Enforce POST method
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Validate Content-Type
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return new Response(JSON.stringify({ error: 'Content-Type must be application/json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await req.json();
    
    // Honeypot spam check
    if (body.website !== undefined && body.website !== "") {
      return new Response(JSON.stringify({ error: 'Solicitud inválida' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { customer, shipping, items, idempotencyKey } = body;

    // Validate Customer Details
    if (!customer || !customer.name || typeof customer.name !== 'string' || customer.name.trim().length < 2 || customer.name.trim().length > 100) {
      return new Response(JSON.stringify({ error: 'Nombre de cliente inválido (mínimo 2 caracteres).' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const phoneRegex = /^[0-9+\s\-()]{6,25}$/;
    if (!customer.phone || typeof customer.phone !== 'string' || !phoneRegex.test(customer.phone.trim())) {
      return new Response(JSON.stringify({ error: 'Teléfono de contacto inválido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate Shipping Method
    if (!shipping || !['retiro', 'envio'].includes(shipping.method)) {
      return new Response(JSON.stringify({ error: 'Método de entrega inválido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (shipping.method === 'envio') {
      if (!shipping.street || typeof shipping.street !== 'string' || shipping.street.trim() === '') {
        return new Response(JSON.stringify({ error: 'La dirección (calle y altura) es obligatoria para envíos a domicilio.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Validate Items Array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'El carrito no puede estar vacío.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (items.length > 50) {
      return new Response(JSON.stringify({ error: 'Límite de productos excedido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const item of items) {
      if (!item.productId || !uuidRegex.test(item.productId)) {
        return new Response(JSON.stringify({ error: 'ID de producto inválido.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) {
        return new Response(JSON.stringify({ error: 'La cantidad por producto debe estar entre 1 y 100.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Retrieve Supabase credentials inside request handler
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase URL or Service Role configuration.");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch products from database
    const productIds = items.map(item => item.productId);
    const { data: dbProducts, error: dbError } = await supabase
      .from('products')
      .select('id, nombre, marca, precio, disponible')
      .in('id', productIds);

    if (dbError) {
      console.error("Database query error:", dbError);
      return new Response(JSON.stringify({ error: 'Error al verificar productos en el servidor.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const dbProductsMap = new Map();
    dbProducts?.forEach(p => dbProductsMap.set(p.id, p));

    const finalItems = [];
    let calculatedSubtotal = 0;

    for (const item of items) {
      const dbProduct = dbProductsMap.get(item.productId);
      if (!dbProduct) {
        return new Response(JSON.stringify({ error: 'Uno o más productos del carrito no existen.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      if (!dbProduct.disponible) {
        return new Response(JSON.stringify({ error: `El producto "${dbProduct.nombre}" ya no está disponible.` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const price = Number(dbProduct.precio);
      const qty = Number(item.quantity);
      
      const subtotal = Number((price * qty).toFixed(2));
      calculatedSubtotal += subtotal;

      finalItems.push({
        product_id: dbProduct.id,
        product_name: dbProduct.nombre,
        product_brand: dbProduct.marca || null,
        unit_price: price,
        quantity: qty,
        subtotal: subtotal
      });
    }

    calculatedSubtotal = Number(calculatedSubtotal.toFixed(2));
    const calculatedTotal = calculatedSubtotal;

    // Call database RPC to insert order & items atomically
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_order_transaction', {
      p_customer_name: customer.name.trim(),
      p_customer_phone: customer.phone.trim(),
      p_shipping_method: shipping.method,
      p_street: shipping.method === 'envio' ? shipping.street.trim() : null,
      p_floor: shipping.method === 'envio' ? (shipping.floor?.trim() || null) : null,
      p_department: shipping.method === 'envio' ? (shipping.department?.trim() || null) : null,
      p_customer_notes: body.customerNotes?.trim() || null,
      p_idempotency_key: idempotencyKey || null,
      p_subtotal: calculatedSubtotal,
      p_total: calculatedTotal,
      p_items: finalItems
    });

    if (rpcError) {
      console.error("Database RPC error:", rpcError);
      return new Response(JSON.stringify({ error: `Error al registrar el pedido: ${rpcError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const createdOrder = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!createdOrder || !createdOrder.id) {
      return new Response(JSON.stringify({ error: 'No se pudo crear el pedido.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Logging without personal data details
    const customerInitial = customer.name.trim().charAt(0) + "...";
    console.log(`Order #${createdOrder.order_number} successfully processed for customer ${customerInitial}`);

    // Fire and forget FCM dispatch without blocking response or reverting order on FCM failures
    setTimeout(async () => {
      try {
        await sendFCMNotifications(
          supabase,
          createdOrder.order_number.toString(),
          customerInitial,
          calculatedTotal,
          createdOrder.id
        );
      } catch (err) {
        console.error("Asynchronous FCM dispatcher threw an error:", err.message);
      }
    }, 0);

    return new Response(JSON.stringify({
      ok: true,
      order: {
        id: createdOrder.id,
        orderNumber: Number(createdOrder.order_number),
        total: Number(createdOrder.total),
        status: 'pending',
        createdAt: createdOrder.created_at
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("System error:", error.message);
    return new Response(JSON.stringify({ error: 'Error interno en el servidor.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
});
