# Módulos Desactivados (Legacy)

Este directorio contiene los módulos y scripts del proyecto original ("Super Market Kosher") que gestionaban los pedidos y las notificaciones web push. 

En la versión actual de **Minhag Kosher**, se simplificó la aplicación para evitar dependencias innecesarias del backend y costes adicionales de almacenamiento en red. El flujo de pedidos funciona de manera local en el navegador y finaliza directamente en WhatsApp.

## Archivos Desactivados

- `AdminOrders.jsx.legacy`: Panel de administración para visualizar el listado de pedidos entrantes.
- `AdminOrderDetail.jsx.legacy`: Vista detallada de un pedido específico.
- `AdminNotificationSettings.jsx.legacy`: Panel para activar notificaciones de escritorio/móvil y enviar notificaciones de prueba.
- `firebaseMessaging.js.legacy`: Lógica de integración de Firebase Cloud Messaging y registro del Service Worker en el cliente.
- `firebase-messaging-sw.js.legacy`: Script del Service Worker cargado por el navegador para escuchar notificaciones Push en segundo plano.

## Consideraciones para Reactivación
Si en el futuro deseas reactivar estas funcionalidades:
1. Renombra las extensiones quitando el sufijo `.legacy`.
2. Restaura los imports y rutas en `src/App.jsx`.
3. Restaura las opciones en el menú lateral de `src/components/admin/AdminDashboard.jsx`.
4. Asegúrate de configurar una base de datos activa de Supabase (con las tablas `orders`, `order_items` y `push_subscriptions`) y las credenciales FCM en el archivo `.env`.
