-- ============================================================
-- Tarifas de viajes (tarea 135): sin acceso directo por PostgREST, mismo
-- criterio que la migración 130 (y 134/135). Las tarifas solo las ven Admin
-- y Supervisor por el backend (service_role); si `authenticated` tuviera
-- grants, un chofer con su sesión podría leerlas o editarlas saltándose esa
-- regla. distancias_cache es dato interno del backend.
-- Idempotente.
-- ============================================================
revoke all on tarifas_tramo from anon, authenticated;
revoke all on tarifas_km from anon, authenticated;
revoke all on distancias_cache from anon, authenticated;
