// supabase/functions/send-test-notification/index.ts
// Supabase Edge Function to send test push notifications to authenticated administrators.

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

  // Retrieve Authorization Header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'No autorizado. Falta el token de sesión.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase configuration.");
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 1. Authenticate and resolve user strictly via user JWT token
    const jwtToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwtToken);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sesión no válida o expirada.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Fetch active tokens belonging strictly to the authenticated user
    const { data: subscriptions, error: dbError } = await supabaseClient
      .from('push_subscriptions')
      .select('token')
      .eq('user_id', user.id)
      .eq('enabled', true);

    if (dbError) {
      throw new Error(`Error en base de datos: ${dbError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ error: 'No tenés ningún navegador registrado activo para recibir notificaciones push en este usuario.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Load Firebase credentials securely
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID');
    const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
    const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY');
    const siteUrlRaw = Deno.env.get('PUBLIC_SITE_URL');

    if (!projectId || !clientEmail || !privateKey) {
      return new Response(JSON.stringify({ error: 'Firebase Cloud Messaging no está configurado en los secretos de Supabase.' }), {
        status: 501,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const siteUrl = siteUrlRaw?.replace(/\/+$/, "");
    if (!siteUrl) {
      return new Response(JSON.stringify({ error: 'FCM no configurado: Falta la secreto PUBLIC_SITE_URL en Supabase.' }), {
        status: 501,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Generate Access Token and Dispatch test push notification
    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const testUrl = `${siteUrl}/admin/orders`;
    let sentCount = 0;

    for (const sub of subscriptions) {
      try {
        const payload = {
          message: {
            token: sub.token,
            data: {
              title: "Notificaciones activadas",
              body: "Tu dispositivo recibirá los nuevos pedidos.",
              url: testUrl,
              type: 'test'
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

        if (response.ok) {
          sentCount++;
        } else {
          const status = response.status;
          const errorCode = resData?.error?.status;
          const errorMessage = resData?.error?.message || '';

          // Disable token if unregistered
          if (status === 404 || status === 410 || errorCode === 'NOT_FOUND' || errorMessage.includes('not registered')) {
            console.log(`Unregistered test FCM token found. Disabling: ${sub.token.substring(0, 15)}...`);
            await supabaseClient
              .from('push_subscriptions')
              .update({ enabled: false, updated_at: new Date().toISOString() })
              .eq('token', sub.token);
          } else {
            console.error(`FCM error on test dispatch: ${errorMessage}`);
          }
        }
      } catch (tokenErr) {
        console.error("Test notification delivery error for token:", tokenErr.message);
      }
    }

    if (sentCount === 0) {
      return new Response(JSON.stringify({ error: 'No se pudo entregar la notificación a ningún dispositivo (posiblemente tokens inválidos).' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ ok: true, message: `Notificación de prueba enviada a ${sentCount} dispositivos.` }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("System test notification error:", error.message);
    return new Response(JSON.stringify({ error: `Error interno: ${error.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
});
