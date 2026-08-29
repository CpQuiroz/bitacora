-- Las credenciales de Integraciones (API keys de Anthropic, Google
-- Document AI, pasarelas de pago, etc.) pasan de jsonb en texto plano
-- a un blob cifrado (AES-256-GCM, ver backend/src/crypto.ts) guardado
-- como texto. El cifrado/descifrado ocurre en el backend — la columna
-- deja de tener forma de JSON consultable, es solo un blob opaco.
alter table integraciones alter column credenciales type text using credenciales::text;
alter table integraciones alter column credenciales set default '{}';
