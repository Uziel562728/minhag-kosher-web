import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
export const supabaseConfigurationError = isSupabaseConfigured
  ? null
  : new Error('Supabase no está configurado. Faltan variables públicas requeridas.');

if (supabaseConfigurationError) {
  console.error('Error de configuración de la aplicación:', supabaseConfigurationError);
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;
