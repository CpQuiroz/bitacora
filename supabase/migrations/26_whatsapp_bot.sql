-- BITÁCORA — Bot de WhatsApp para choferes: registro de mensajes ya
-- procesados, para no duplicar un viaje si Meta reintenta la entrega
-- del mismo webhook (pasa seguido con la Cloud API).
create table whatsapp_mensajes_procesados (
  id text primary key,
  procesado_en timestamptz not null default now()
);
