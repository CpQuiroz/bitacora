# bitacora
Proyecto de app para bitacoras de trabajo

## Variables de entorno del backend

Todas las variables están documentadas en `backend/.env.example`. Dos que
requieren atención especial al desplegar (cada ambiente necesita su propio
valor, nunca reutilizar el de otro ambiente):

- **`USUARIOS_MFA_ENCRYPTION_KEY`** — obligatoria. Cifra en reposo el
  secreto TOTP de la autenticación de dos factores de usuarios (ver
  `backend/src/routes/mfa.ts`). Sin esta variable el backend no arranca.
  Generar con: `openssl rand -base64 32`.
- **`RESEND_API_KEY`** / **`RESEND_FROM_EMAIL`** — opcionales, pero varias
  funciones dependen de ellas para enviar correos de verdad (sin
  configurarlas, esas funciones fallan con un mensaje claro de "envío no
  configurado" en vez de silenciarse):
  - Código de verificación del 2FA por correo.
  - Invitación de un colaborador nuevo (Gestión y Control) y del
    administrador inicial al crear una empresa desde el Panel de
    Super-Admin.
  - Encuesta de satisfacción post-servicio y envío de PDFs (cotización,
    orden de servicio) por correo.

  Se consiguen en [console.resend.com](https://resend.com) → API Keys.
