# Login con Google en la app móvil — pasos de configuración

El código ya está (`mobile/src/features/auth/googleAuth.ts`, botón en
`LoginScreen`, PKCE en `mobile/src/lib/supabase.ts`, scheme `bitacora://`
en `app.json`). El flag `EXPO_PUBLIC_GOOGLE_LOGIN="true"` ya está en
`eas.json` (preview + production), así que el botón "Continuar con
Google" aparece en el **próximo build**.

Falta esto — son cuentas y secretos tuyos, hay que hacerlo una sola vez:

## 1. Google Cloud Console

1. Entra a <https://console.cloud.google.com/> → crea (o elige) un
   proyecto.
2. **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - Tipo de usuario: **Externo**.
   - Completa nombre de la app, correo de soporte, dominio
   (`transportesitineris.cl`), correo del desarrollador.
   - Scopes: los de por defecto (`email`, `profile`, `openid`) alcanzan.
   - Mientras esté en "Testing" solo entran los correos que agregues como
   *test users*; para abrirlo a cualquiera hay que "Publicar la app"
   (Google puede pedir verificación si usas scopes sensibles — estos no
   lo son).
3. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente
   de OAuth**:
   - Tipo de aplicación: **Aplicación web** (sí, "web" aunque sea para la
   app — Supabase hace de intermediario).
   - **URI de redireccionamiento autorizado**:
     ```
     https://yjbskbskyadxjooxngjv.supabase.co/auth/v1/callback
     ```
   - Guarda. Copia el **ID de cliente** y el **Secreto de cliente**.

## 2. Supabase (proyecto de producción `yjbskbskyadxjooxngjv`)

1. Dashboard → **Authentication → Providers → Google**:
   - Activar.
   - Pegar **Client ID** y **Client Secret** del paso anterior.
   - Guardar.
2. Dashboard → **Authentication → URL Configuration → Redirect URLs** →
   *Add URL*:
   ```
   bitacora://auth-callback
   ```
   (opcional, para tolerar variantes: `bitacora://*`)

## 3. Probar

- Requiere un **build nuevo** (el deep link se maneja en código nativo,
  no en Expo Go / export).
- El correo de Google con el que entres tiene que estar registrado como
  usuario en alguna empresa de Bitácora (mismo correo). Si no, la app
  muestra "Sin empresa asociada" y hay que agregarlo desde el panel web.

## Notas

- Si tocás el botón antes de terminar los pasos 1–2, da un error tipo
  "Unsupported provider" o "provider is not enabled" — es esperado.
- iOS en dispositivo real necesita además cuenta del Apple Developer
  Program para el build; el simulador y Android no.
