// src/lib/firebaseMessaging.js
// Firebase Cloud Messaging client side integration with Supabase push_subscriptions storage.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, isSupported, getToken, deleteToken, onMessage } from 'firebase/messaging';
import { supabase } from '../supabaseClient';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Initialize Firebase app only if config is populated
let app = null;
let messaging = null;

const initFirebase = async () => {
  if (app) return { app, messaging };

  const isSupportedBrowser = await isSupported();
  if (!isSupportedBrowser) {
    return { app: null, messaging: null };
  }

  // Check that variables exist
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn("FCM config variables are missing from frontend configuration.");
    return { app: null, messaging: null };
  }

  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  messaging = getMessaging(app);
  return { app, messaging };
};

// Check if push notifications are supported by the browser
export async function isPushSupported() {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  
  try {
    const isFCMSupported = await isSupported();
    return isFCMSupported;
  } catch (err) {
    console.error("Error checking FCM browser support:", err);
    return false;
  }
}

// Get the current browser notification permission
export function getNotificationPermissionStatus() {
  if (typeof window === 'undefined') return 'default';
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

// Helper to guess device name from user agent
function getDeviceName() {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'Android Device';
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'iOS Device';
  if (/Macintosh/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Linux/i.test(ua)) return 'Linux PC';
  return 'Web Browser';
}

// Subscribes current user device to web push notifications
export async function subscribeToPush(userId) {
  if (!userId) throw new Error("Se requiere el ID del usuario.");

  const supported = await isPushSupported();
  if (!supported) throw new Error("Las notificaciones push no están soportadas en este navegador.");

  // Request user permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error("Permiso de notificaciones rechazado por el usuario.");
  }

  const { messaging: fcmMessaging } = await initFirebase();
  if (!fcmMessaging) {
    throw new Error("No se pudo inicializar Firebase Messaging.");
  }

  // Construct search params to register service worker with configuration dynamically
  const baseUrl = import.meta.env.BASE_URL;
  const serviceWorkerUrl = new URL(
    `${baseUrl}firebase-messaging-sw.js`,
    window.location.origin
  );
  const queryParams = new URLSearchParams({
    ...firebaseConfig,
    baseUrl: baseUrl
  });
  serviceWorkerUrl.search = queryParams.toString();

  const registration = await navigator.serviceWorker.register(
    serviceWorkerUrl.toString(), 
    { scope: baseUrl }
  );

  // Retrieve token using modular token fetching API passing serviceWorkerRegistration
  const token = await getToken(fcmMessaging, {
    vapidKey: vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new Error("No se recibió ningún token de Firebase.");
  }

  // Upsert token in push_subscriptions table Conflict on unique token column
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      token: token,
      enabled: true,
      device_name: getDeviceName(),
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'token'
    });

  if (error) {
    throw new Error(`Error guardando suscripción en Supabase: ${error.message}`);
  }

  // Keep a reference to the active token locally
  localStorage.setItem('fcm_token', token);

  return token;
}

// Unsubscribes current user device from push notifications
export async function unsubscribeFromPush(userId) {
  if (!userId) throw new Error("Se requiere el ID del usuario.");

  const { messaging: fcmMessaging } = await initFirebase();
  if (!fcmMessaging) return;

  const activeToken = localStorage.getItem('fcm_token');
  if (!activeToken) return;

  try {
    // 1. Delete token in Firebase Cloud Messaging
    await deleteToken(fcmMessaging);
  } catch (err) {
    console.warn("FCM deleteToken error (might be already deleted or expired):", err);
  }

  // 2. Disable or delete from push_subscriptions table in Supabase
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('token', activeToken)
    .eq('user_id', userId);

  if (error) {
    console.error("Error deleting push subscription from Supabase:", error);
  }

  localStorage.removeItem('fcm_token');
}

// Listen for incoming messages while app is in foreground
export async function listenForForegroundMessages(callback) {
  const supported = await isPushSupported();
  if (!supported) return () => {};

  const { messaging: fcmMessaging } = await initFirebase();
  if (!fcmMessaging) return () => {};

  // Register modular onMessage callback
  return onMessage(fcmMessaging, (payload) => {
    console.log("Foreground message received:", payload);
    callback(payload);
  });
}
