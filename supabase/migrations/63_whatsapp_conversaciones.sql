-- BITÁCORA — Estado de conversaciones del bot de WhatsApp.
--
-- Hasta ahora el bot de choferes era stateless: una foto de guía creaba
-- un viaje en estado 'borrador' y el único "estado" que se recordaba
-- entre mensajes era ese mismo viaje a medio llenar (km_inicial null).
--
-- El flujo conversacional de "nuevo viaje" (el chofer registra un viaje
-- completo respondiendo preguntas una por una) necesita recordar en qué
-- paso va cada chofer y los datos juntados hasta el momento. Una fila
-- por número de teléfono => cada chofer tiene a lo más UNA conversación
-- activa y dos choferes escribiendo a la vez no se cruzan.
--
-- Al confirmar o cancelar el viaje, la fila se borra. No hay expiración
-- automática todavía (pendiente: un cron que limpie filas viejas si se
-- ve que quedan conversaciones colgadas).
create table whatsapp_conversaciones (
  telefono text primary key,
  empresa_id uuid not null references empresas(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  flujo text not null default 'viaje' check (flujo in ('viaje')),
  paso text not null,
  datos jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Sin RLS — mismo criterio que whatsapp_mensajes_procesados (26),
-- login_2fa_pendiente (50) y super_admins (37): tablas que solo toca el
-- backend con la service role key, nunca un cliente con req.empresaId.
