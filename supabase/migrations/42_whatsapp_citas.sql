-- Recordatorios al cliente por WhatsApp (Agenda Pro) — segundo canal
-- además del correo. mensajes_personalizados.mensaje_whatsapp ya existía
-- (editable en la UI) pero nunca se enviaba a ningún lado.
alter table notificaciones_config add column whatsapp_activado boolean not null default true;

alter table notificaciones_cliente_log add column canal text not null default 'correo' check (canal in ('correo', 'whatsapp'));
