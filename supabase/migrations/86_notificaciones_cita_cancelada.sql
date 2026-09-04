-- Correo/WhatsApp al cliente cuando se cancela una cita (Fase 4) — hasta
-- ahora no existía ningún aviso de cancelación, solo el de "cita
-- agendada" (ver 39_agenda_pro / cita_agendada). Default true: mismo
-- criterio que el resto de los switches, viene prendido salvo que la
-- empresa lo apague a mano en Configuración > Notificaciones.
alter table notificaciones_config add column cita_cancelada boolean not null default true;
