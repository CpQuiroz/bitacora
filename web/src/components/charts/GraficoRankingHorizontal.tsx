"use client";

// Reutilizable para cualquier ranking "nombre + barra + valor" —
// Ranking de Tipos, Ranking de Categorías, Ranking de Centros de
// Costo, Clientes por Comuna. Es una lista simple (no un chart de
// recharts) porque el ancho de cada barra ya se calcula con CSS
// directo contra el máximo del propio ranking.
export type PuntoRanking = { nombre: string; valor: number };

export function GraficoRankingHorizontal({
  datos,
  mensajeVacio,
  formatearValor,
}: {
  datos: PuntoRanking[];
  mensajeVacio: string;
  formatearValor?: (n: number) => string;
}) {
  if (datos.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-ds-2 text-center">
        <p className="font-ds-body text-ds-small text-ds-text/70">{mensajeVacio}</p>
      </div>
    );
  }

  const maximo = Math.max(...datos.map((d) => d.valor), 1);
  const fmt = formatearValor ?? ((n: number) => String(n));

  return (
    <div className="flex flex-col gap-ds-3">
      {datos.map((d) => (
        <div key={d.nombre}>
          <div className="mb-ds-1 flex items-center justify-between font-ds-body text-ds-small">
            <span className="font-medium text-ds-text">{d.nombre}</span>
            <span className="text-ds-text/60">{fmt(d.valor)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-ds-pill bg-ds-brand/[0.08]">
            <div className="h-full rounded-ds-pill bg-ds-brand" style={{ width: `${(d.valor / maximo) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
