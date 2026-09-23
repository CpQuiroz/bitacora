-- ============================================================
-- BITÁCORA — Supervisor puede registrar ventas (23-sep-2026, pedido
-- explícito: "habilita las ventas" → Supervisor).
--
-- La acción "registrar_venta" nació el mismo día solo para Admin (que
-- las tiene todas siempre, sin pasar por esta tabla). roles.acciones es
-- un snapshot por fila (migración 71): cambiar ACCIONES_POR_ROL en
-- packages/shared/src/permisos.ts solo afecta la siembra inicial, así
-- que el rol de sistema "supervisor" ya existente se actualiza acá.
-- Colaborador sigue SIN la acción (pedido explícito).
-- Idempotente: no duplica si ya la tiene.
-- ============================================================

update roles
set acciones = array_append(acciones, 'registrar_venta')
where slug = 'supervisor'
  and not ('registrar_venta' = any(acciones));
