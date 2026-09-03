import type { DatosLaborales, Liquidacion, ParametroPrevisional, Usuario } from "@bitacora/shared";
import { apiFetch } from "./api";

export type LiquidacionConNombre = Liquidacion & { colaborador: { id: string; nombre: string } | null };
export type AfpParametro = { periodo: string; afp: string; nombre: string; codigo_previred: string; tasa_comision: number };
export type FilaDatosLaborales = {
  usuario: Pick<Usuario, "id" | "nombre" | "rol" | "activo" | "rut">;
  datos_laborales: DatosLaborales | null;
};

export type FormatoExport = "previred" | "lre" | "resumen";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Error ${res.status}`);
  return res.json();
}

export const remuneraciones = {
  parametros: (periodo: string) =>
    apiFetch(`/api/remuneraciones/parametros/${periodo}`).then((r) => json<{ parametros: ParametroPrevisional; afp: AfpParametro[] }>(r)),

  guardarParametros: (periodo: string, body: Record<string, unknown>) =>
    apiFetch(`/api/remuneraciones/parametros/${periodo}`, { method: "PATCH", body: JSON.stringify(body) }).then((r) =>
      json<{ parametros: ParametroPrevisional; afp: AfpParametro[] }>(r)
    ),

  datosLaborales: () => apiFetch("/api/remuneraciones/datos-laborales").then((r) => json<FilaDatosLaborales[]>(r)),

  guardarDatosLaborales: (usuarioId: string, body: Record<string, unknown>) =>
    apiFetch(`/api/remuneraciones/datos-laborales/${usuarioId}`, { method: "PUT", body: JSON.stringify(body) }).then((r) =>
      json<DatosLaborales>(r)
    ),

  liquidaciones: (periodo: string) =>
    apiFetch(`/api/remuneraciones/liquidaciones?periodo=${periodo}`).then((r) => json<LiquidacionConNombre[]>(r)),

  liquidacion: (id: string) => apiFetch(`/api/remuneraciones/liquidaciones/${id}`).then((r) => json<LiquidacionConNombre>(r)),

  generar: (periodo: string, usuarioIds?: string[]) =>
    apiFetch("/api/remuneraciones/liquidaciones/generar", {
      method: "POST",
      body: JSON.stringify({ periodo, usuario_ids: usuarioIds }),
    }).then((r) =>
      json<{
        periodo: string;
        generadas: number;
        omitidas_emitidas: number;
        prorrateadas: number;
        incompletas: { usuario_id: string; faltan: string[] }[];
      }>(r)
    ),

  editar: (id: string, body: Record<string, unknown>) =>
    apiFetch(`/api/remuneraciones/liquidaciones/${id}`, { method: "PATCH", body: JSON.stringify(body) }).then((r) =>
      json<LiquidacionConNombre>(r)
    ),

  emitir: (id: string, confirmarLicencia = false) =>
    apiFetch(`/api/remuneraciones/liquidaciones/${id}/emitir`, {
      method: "POST",
      body: JSON.stringify(confirmarLicencia ? { confirmar_licencia: true } : {}),
    }).then((r) => json<LiquidacionConNombre>(r)),

  async abrirPdf(id: string): Promise<boolean> {
    const res = await apiFetch(`/api/remuneraciones/liquidaciones/${id}/pdf`);
    if (!res.ok) return false;
    const { url } = await res.json();
    if (url) window.open(url, "_blank");
    return Boolean(url);
  },

  async exportar(formato: FormatoExport, periodo: string): Promise<void> {
    const res = await apiFetch(`/api/remuneraciones/exportar/${formato}?periodo=${periodo}`);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "No se pudo generar el archivo");
    const blob = await res.blob();
    const nombre =
      res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `${formato}_${periodo}.txt`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  },
};

// 'YYYY-MM' de un mes relativo (0 = mes actual, -1 = mes pasado…).
export function periodoRelativo(offset = 0): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function nombrePeriodo(p: string): string {
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const [a, m] = p.split("-");
  return `${meses[Number(m) - 1] ?? m} ${a}`;
}
