// public/firebase-messaging-sw.js
// Service worker for handling background push notifications via Firebase Cloud Messaging.

// Parse firebase configuration passed dynamically via query string params during sw registration
const urlParams = new URLSearchParams(self.location.search);
const baseUrl = urlParams.get('baseUrl') || '/';

// 1. Capture notificationclick at the very top (before importScripts) to prevent Firebase imports from replacing the event handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url;
  console.log("[SW] click target", targetUrl);

  if (!targetUrl) {
    return;
  }

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true
      })
      .then(async (windowClients) => {
        // Look for any tab matching the current origin
        for (const client of windowClients) {
          if (new URL(client.url).origin === self.location.origin) {
            if ("navigate" in client) {
              await client.navigate(targetUrl);
            }

            if ("focus" in client) {
              await client.focus();
            }

            return;
          }
        }

        // If no tab is open at this origin, open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// 2. Import and initialize Firebase Compatibility SDKs
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: urlParams.get('apiKey'),
  authDomain: urlParams.get('authDomain'),
  projectId: urlParams.get('projectId'),
  storageBucket: urlParams.get('storageBucket'),
  messagingSenderId: urlParams.get('messagingSenderId'),
  appId: urlParams.get('appId'),
};

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Background message listener to intercept data-only messages and show notification manually
  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    console.log("[SW] notification data", data);

    return self.registration.showNotification(
      data.title || "Nuevo pedido",
      {
        body: data.body || "Se recibió un nuevo pedido.",
        icon: `${baseUrl}favicon.webp`,
        badge: `${baseUrl}favicon.webp`,
        tag: data.orderId
          ? `order-${data.orderId}`
          : `notification-${Date.now()}`,
        renotify: true,
        data: {
          url: data.url,
          orderId: data.orderId,
          type: data.type
        },
        actions: [
          {
            action: "view-order",
            title: "Ver pedido"
          }
        ]
      }
    );
  });
} else {
  console.warn('[firebase-messaging-sw.js] SW initialized without Firebase config parameters.');
}
