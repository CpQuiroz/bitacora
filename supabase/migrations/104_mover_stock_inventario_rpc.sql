-- BITÁCORA — mover_stock_inventario(): descuento/reversión de stock por
-- cierre o cancelación de una OS, en UNA sola llamada atómica.
--
-- Antes (backend/src/inventario.ts), aplicarDescuentoInventarioSiCorresponde()
-- y revertirStockPorOS() hacían, por cada producto de la OS, 2 round-trips
-- SECUENCIALES (update de catalogo_items + insert en inventario_movimientos)
-- dentro de un `for`, bloqueando el cierre de la OS. Con 5 productos son 10
-- idas y vueltas en serie.
--
-- Además de lento, tenía una carrera real: el update era "leer
-- stock_actual, calcular el nuevo valor en Node, escribir ese valor
-- absoluto" — si dos OS que tocan el mismo producto se cierran casi al
-- mismo tiempo, la segunda puede pisar el descuento de la primera (lost
-- update), porque ninguna de las dos ve el cambio de la otra hasta después
-- de leer.
--
-- Esta función hace TODO en una sola sentencia UPDATE...FROM (arriba) +
-- INSERT...SELECT (abajo), dentro de la misma transacción: el update es
-- relativo (stock_actual = stock_actual + signo*cantidad), así que Postgres
-- serializa las filas en conflicto usando el lock normal de fila — ya no
-- hay lost update. Un solo round-trip desde el backend, sin importar
-- cuántos productos tenga la OS.
--
-- p_signo: -1 para descuento (cierre de OS), +1 para reversión
-- (cancelación). El caller (Node) decide si generar advertencias de stock
-- insuficiente comparando stock_resultante < 0 en la fila que devuelve.
create or replace function mover_stock_inventario(
  p_empresa_id uuid,
  p_items jsonb, -- [{"catalogo_item_id": "...", "cantidad": 3}, ...]
  p_signo int,
  p_motivo text
)
returns table (catalogo_item_id uuid, nombre text, stock_resultante numeric)
language sql
as $$
  with movimiento as (
    update catalogo_items c
    set stock_actual = coalesce(c.stock_actual, 0) + p_signo * e.cantidad
    from jsonb_to_recordset(p_items) as e(catalogo_item_id uuid, cantidad numeric)
    where c.id = e.catalogo_item_id and c.empresa_id = p_empresa_id
    returning c.id as catalogo_item_id, c.nombre, c.stock_actual as stock_resultante, e.cantidad
  ),
  registrado as (
    insert into inventario_movimientos (empresa_id, catalogo_item_id, tipo, cantidad, stock_resultante, motivo, origen)
    select
      p_empresa_id,
      m.catalogo_item_id,
      case when p_signo < 0 then 'salida' else 'entrada' end,
      m.cantidad,
      m.stock_resultante,
      p_motivo,
      'automatico'
    from movimiento m
    returning catalogo_item_id
  )
  select m.catalogo_item_id, m.nombre, m.stock_resultante from movimiento m;
$$;
