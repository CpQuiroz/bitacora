-- % de descuento a mencionar (solo informativo, texto en el correo —
-- nunca se calcula ni se aplica nada en la app, lo aplica la empresa
-- a mano cuando el cliente vuelve) en la felicitación de cumpleaños.
-- null = no mencionar ningún descuento. Un conjunto fijo de valores a
-- propósito (10/15/20), no un número libre — así lo pidió el usuario.
alter table notificaciones_config add column cliente_cumpleanos_descuento_pct integer
  check (cliente_cumpleanos_descuento_pct is null or cliente_cumpleanos_descuento_pct in (10, 15, 20));
