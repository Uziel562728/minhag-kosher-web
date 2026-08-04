# Guía de Configuración de Notificaciones Web Push (Firebase Cloud Messaging + Supabase)

Esta guía detalla los pasos para configurar las notificaciones web push en **Super Market Kosher**, permitiendo que el administrador reciba avisos instantáneos ante nuevos pedidos en su celular o computadora.

---

## ⚠️ Advertencia de Seguridad Importante

> [!CAUTION]
> **Nunca expongas las credenciales privadas:**
> - Jamás agregues la clave privada (`FIREBASE_PRIVATE_KEY` o el JSON de la service account) en el frontend (React, archivos `VITE_`, carpeta `public/` o `dist/`).
> - No subas el JSON de la cuenta de servicio de Firebase ni archivos `.env` a Git. Asegúrate de que estén registrados en tu `.gitignore`.
> - Las claves privadas solo deben subirse como secretos en el entorno de Supabase en producción.

---

## Paso 1: Configurar Firebase Console

1. Entrá a [Firebase Console](https://console.firebase.google.com/) e iniciá sesión con tu cuenta de Google.
2. Hacé clic en **Agregar proyecto** (o selecciona uno existente). Ponle un nombre (ej. `Super Market Pedidos`) y completa los pasos. Podés desactivar Google Analytics para simplificar la configuración.
3. En el panel principal del proyecto, hacé clic en el ícono de **Web (</>)** para registrar una aplicación.
4. Escribí un apodo para la aplicación (ej. `super-market-web`) y haz clic en **Registrar app**.
5. Copiá el objeto `firebaseConfig` que aparece en pantalla:
   ```javascript
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

---

## Paso 2: Configurar las Variables de Entorno en el Frontend

1. En la raíz del proyecto web, editá tu archivo `.env` local (o duplicá `.env.example` como `.env`).
2. Completá los campos correspondientes con la información pública del objeto `firebaseConfig` copiado anteriormente:
   ```ini
   VITE_FIREBASE_API_KEY=tu-api-key
   VITE_FIREBASE_AUTH_DOMAIN=tu-auth-domain.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=tu-proyecto-id
   VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto-id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=tu-sender-id
   VITE_FIREBASE_APP_ID=tu-app-id
   ```

---

## Paso 3: Generar la Clave Web Push (VAPID)

1. En la consola de Firebase, andá a **Configuración del Proyecto** (ícono de engranaje) -> pestaña **Mensajería en la nube (Cloud Messaging)**.
2. En la sección **Configuración web**, debajo de **Certificados de inserción web (Web Push certificates)**, haz clic en **Generar par de claves**.
3. Copiá la clave pública generada (una cadena larga de caracteres).
4. Agregá esta clave en tu archivo `.env` del frontend:
   ```ini
   VITE_FIREBASE_VAPID_KEY=tu-clave-vapid-publica
   ```

---

## Paso 4: Crear la Cuenta de Servicio y Obtener la Clave Privada

1. En la consola de Firebase, ve a **Configuración del Proyecto** -> pestaña **Cuentas de servicio (Service accounts)**.
2. Hacé clic en el botón **Generar nueva clave privada** al final de la página. Esto descargará automáticamente un archivo `.json` a tu computadora.
3. Abrí el archivo `.json` descargado. Contiene secretos privados sumamente sensibles.
4. Identifica los siguientes campos dentro del archivo:
   - `project_id`
   - `client_email`
   - `private_key`

---

## Paso 5: Configurar los Secretos de Supabase Edge Functions

Para que las Edge Functions puedan autorizarse con Google APIs e interactuar con FCM v1, debés inyectar los secretos de la Service Account.

1. Creá un archivo local temporal e ignorado por Git en `supabase/functions/.env.production` (no lo versionés).
2. Agregá los siguientes campos (reemplazando `\n` por saltos de línea reales dentro de la clave si es necesario, o escribiendo la clave completa entre comillas):
   ```ini
   FIREBASE_PROJECT_ID="tu-project-id"
   FIREBASE_CLIENT_EMAIL="tu-client-email@gserviceaccount.com"
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
   ```
3. Ejecutá el siguiente comando para registrar masivamente los secretos en Supabase usando la CLI:
   ```bash
   npx supabase secrets set --env-file supabase/functions/.env.production
   ```

---

## Paso 6: Aplicar la Migración de la Base de Datos

Ejecutá el siguiente comando para empujar la migración que crea la tabla `push_subscriptions` y sus políticas RLS al servidor de Supabase:
```bash
npx supabase db push
```

---

## Paso 7: Desplegar las Edge Functions

Desplegá ambas Edge Functions usando los comandos correspondientes:

1. **create-order** (se despliega públicamente sin validar JWT del cliente, ya que el pedido lo inicia un visitante anónimo):
   ```bash
   npx supabase functions deploy create-order --no-verify-jwt
   ```

2. **send-test-notification** (se despliega de forma segura, exigiendo un JWT de sesión del administrador autenticado):
   ```bash
   npx supabase functions deploy send-test-notification
   ```

---

## Paso 8: Instrucciones de Prueba

### 💻 Probar en Computadora (Navegador)
1. Iniciá sesión como administrador en `/admin/login`.
2. Dirigite a la nueva sección **🔔 Notificaciones** en el menú lateral.
3. Hacé clic en **Activar notificaciones en este navegador**. Te aparecerá la ventana emergente solicitando el permiso. Hacé clic en **Permitir**.
4. Una vez activado, hacé clic en **🧪 Enviar notificación de prueba**.
5. Deberías recibir una notificación push de prueba en tu sistema operativo:
   - Título: *Notificaciones activadas*
   - Cuerpo: *Tu dispositivo recibirá los nuevos pedidos.*
6. Dejá el panel admin abierto en una pestaña, abrí el sitio público en otra y realizá un pedido de prueba. Deberías ver un banner/alerta interno (foreground notification alert toast) apareciendo en tiempo real arriba a la derecha de la pantalla del panel admin.

### 🤖 Probar en Android
1. Abrí Google Chrome en tu celular Android e ingresá al panel de administración.
2. Iniciá sesión y andá a la pestaña de notificaciones.
3. Presioná el botón de activar y acepta el diálogo de permisos del sistema.
4. Enviá una notificación de prueba para comprobar que se recibe en la bandeja del celular.

### 📱 Probar en iPhone (iOS)
> [!IMPORTANT]
> iOS requiere obligatoriamente que el sitio web se ejecute bajo HTTPS y esté guardado como PWA (Home Screen App) para poder recibir notificaciones push en segundo plano.
1. Abrí Safari en tu iPhone e ingresá al sitio de administración.
2. Hacé clic en el botón de **Compartir** en la barra de Safari y selecciona **Agregar a la pantalla de inicio**.
3. Abrí la aplicación desde tu pantalla de inicio como una PWA independiente.
4. Iniciá sesión, navega a notificaciones, presiona **Activar notificaciones** y autoriza el permiso.
5. Realiza la prueba con la notificación test.

---

## Solución de Problemas Comunes

- **Error: "Permission Denied"**
  - Si bloqueaste el permiso accidentalmente, debés ir a la configuración del sitio en la barra del navegador (ícono del candado) y restablecer el permiso de notificaciones a "Permitir".
- **La notificación no llega en segundo plano (Background)**
  - Comprobá que no tengas activado el modo "No molestar" o "Enfoque" en tu computadora o celular.
  - Asegúrate de que el Service Worker se haya registrado correctamente verificando en las DevTools del navegador (pestaña *Application* -> *Service Workers*).

---

## 🔒 Riesgos Heredados de Seguridad

### Privilegios de Acceso de Usuarios Autenticados
Dado que el diseño base del proyecto no cuenta con una tabla de usuarios administradores dedicados (como `profiles` con una columna `role = 'admin'`), la base de datos considera **administrador a cualquier usuario autenticado**.

* **Riesgo:** Cualquier usuario que logre registrarse o autenticarse en el cliente Supabase tendrá acceso para:
  1. Leer y actualizar la tabla `orders` (todos los pedidos de clientes).
  2. Leer todos los `order_items` de la tienda.
  3. Modificar o inyectar registros en `push_subscriptions` para secuestrar o silenciar las notificaciones push.
* **Mitigación Recomendada:** En etapas futuras, se debe implementar un trigger en Postgres o una política RLS estricta vinculada a una tabla de roles para validar que `auth.jwt() -> 'user_metadata' -> 'role' = 'admin'` o similar antes de conceder accesos en las políticas de la base de datos.

