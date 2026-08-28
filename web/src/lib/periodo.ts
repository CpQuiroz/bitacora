// Espejo en el cliente de backend/src/routes/dashboard.ts → resolverPeriodo.
// Se mantiene la misma lógica de fechas en ambos lados para que los
// chips muestren el mismo rango que después calcula el backend.

export type PeriodoValor = "hoy" | "ayer" | "7d" | "30d" | "este_mes" | "mes_pasado" | "este_anio" | "personalizado";

export const PERIODOS: { valor: PeriodoValor; etiqueta: string }[] = [
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "ayer", etiqueta: "Ayer" },
  { valor: "7d", etiqueta: "Últimos 7 días" },
  { valor: "30d", etiqueta: "Últimos 30 días" },
  { valor: "este_mes", etiqueta: "Este Mes" },
  { valor: "mes_pasado", etiqueta: "Mes Pasado" },
  { valor: "este_anio", etiqueta: "Este Año" },
  { valor: "personalizado", etiqueta: "Personalizado" },
];

const fmt = (d: Date) => d.toISOString().slice(0, 10);

export function resolverPeriodo(
  periodo: PeriodoValor,
  desdePersonalizado?: string,
  hastaPersonalizado?: string
): { desde: string; hasta: string } {
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  switch (periodo) {
    case "hoy":
      return { desde: fmt(inicioHoy), hasta: fmt(inicioHoy) };
    case "ayer": {
      const ayer = new Date(inicioHoy);
      ayer.setDate(ayer.getDate() - 1);
      return { desde: fmt(ayer), hasta: fmt(ayer) };
    }
    case "7d": {
      const d = new Date(inicioHoy);
      d.setDate(d.getDate() - 6);
      return { desde: fmt(d), hasta: fmt(inicioHoy) };
    }
    case "30d": {
      const d = new Date(inicioHoy);
      d.setDate(d.getDate() - 29);
      return { desde: fmt(d), hasta: fmt(inicioHoy) };
    }
    case "mes_pasado": {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      return { desde: fmt(inicio), hasta: fmt(fin) };
    }
    case "este_anio": {
      const inicio = new Date(hoy.getFullYear(), 0, 1);
      return { desde: fmt(inicio), hasta: fmt(inicioHoy) };
    }
    case "personalizado": {
      if (desdePersonalizado && hastaPersonalizado) {
        return { desde: desdePersonalizado, hasta: hastaPersonalizado };
      }
      // Sin rango válido todavía, cae al mismo default que "este_mes".
    }
    // eslint-disable-next-line no-fallthrough
    case "este_mes":
    default: {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return { desde: fmt(inicio), hasta: fmt(inicioHoy) };
    }
  }
}
