"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button, Input, StatusBadge, Table } from "@bitacora/ui/web";

// Fase 5.3 ("Mis trabajos") — historial de levantamientos/OS
// terminados de un colaborador. Compartido entre la página self-service
// (/dashboard/mis-trabajos, sin colaboradorId) y la ficha de una
// persona (/dashboard/personas/[id], con colaboradorId — solo gestión
// puede pedir el de otro, el backend lo hace cumplir).
type ItemHistorial = {
  tipo: "os" | "levantamiento";
  id: string;
  folio: number | null;
  fecha: string;
  cliente_nombre: string;
  estado: string;
};

const ETIQUETA_TIPO: Record<"os" | "levantamiento", string> = { os: "OS", levantamiento: "Levantamiento" };
const TONO_ESTADO: Record<string, "en_progreso" | "completado" | "cancelado"> = {
  completada: "completado",
  firmada: "completado",
  cancelada: "cancelado",
  completado_tecnico: "completado",
  cotizado_externo: "en_progreso",
  aprobado: "completado",
  rechazado: "cancelado",
};

export function HistorialTrabajos({ colaboradorId }: { colaboradorId?: string }) {
  const [items, setItems] = useState<ItemHistorial[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dias, setDias] = useState<30 | 90>(30);
  const [tipo, setTipo] = useState<"todos" | "os" | "levantamiento">("todos");
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [abriendoPdfId, setAbriendoPdfId] = useState<string | null>(null);
  const limite = 20;

  // GET /:id/pdf exige el header de auth (Bearer) — un <a href> plano
  // no lo manda. La versión más reciente viene con una URL YA firmada
  // (Storage, sin auth) en pdf-versiones — se pide y se abre.
  async function abrirPdf(trabajoId: string) {
    setAbriendoPdfId(trabajoId);
    const res = await apiFetch(`/api/trabajos/${trabajoId}/pdf-versiones`);
    setAbriendoPdfId(null);
    if (!res.ok) return;
    const versiones: { url: string }[] = await res.json();
    if (versiones[0]) window.open(versiones[0].url, "_blank", "noopener,noreferrer");
  }

  const cargar = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({ dias: String(dias), pagina: String(pagina), limite: String(limite) });
    if (tipo !== "todos") params.set("tipo", tipo);
    if (q.trim()) params.set("q", q.trim());
    if (colaboradorId) params.set("colaborador_id", colaboradorId);
    const res = await apiFetch(`/api/mis-trabajos?${params.toString()}`);
    if (!res.ok) {
      setError("No se pudo cargar el historial");
      return;
    }
    const body = await res.json();
    setItems(body.items);
    setTotal(body.total);
  }, [dias, tipo, q, pagina, colaboradorId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Cambiar filtro/búsqueda vuelve a la página 1 — si no, se puede
  // quedar pidiendo una página que ya no existe.
  useEffect(() => {
    setPagina(1);
  }, [dias, tipo, q]);

  return (
    <div className="flex flex-col gap-ds-3">
      <div className="flex flex-wrap items-center gap-ds-2">
        <div className="flex rounded-ds-md border border-ds-divider p-0.5">
          {([30, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDias(d)}
              className={`rounded-ds-sm px-ds-3 py-1 font-ds-body text-ds-small transition-colors ${
                dias === d ? "bg-ds-accent-700 text-white" : "text-ds-text/70 hover:bg-ds-neutral-100"
              }`}
            >
              {d} días
            </button>
          ))}
        </div>
        <div className="flex rounded-ds-md border border-ds-divider p-0.5">
          {(["todos", "os", "levantamiento"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`rounded-ds-sm px-ds-3 py-1 font-ds-body text-ds-small transition-colors ${
                tipo === t ? "bg-ds-accent-700 text-white" : "text-ds-text/70 hover:bg-ds-neutral-100"
              }`}
            >
              {t === "todos" ? "Todos" : ETIQUETA_TIPO[t]}
            </button>
          ))}
        </div>
        <div className="min-w-[200px] flex-1">
          <Input placeholder="Buscar por cliente…" valor={q} onCambio={setQ} iconoIzq={<Search size={16} />} />
        </div>
      </div>

      <Table
        columnas={[
          { encabezado: "Tipo", celda: (i: ItemHistorial) => ETIQUETA_TIPO[i.tipo] },
          { encabezado: "Folio", celda: (i: ItemHistorial) => (i.folio != null ? `#${i.folio}` : "—") },
          { encabezado: "Fecha", celda: (i: ItemHistorial) => i.fecha },
          { encabezado: "Cliente", celda: (i: ItemHistorial) => i.cliente_nombre },
          { encabezado: "Estado", celda: (i: ItemHistorial) => <StatusBadge estado={i.estado} tonoForzado={TONO_ESTADO[i.estado]} /> },
          {
            encabezado: "PDF",
            celda: (i: ItemHistorial) =>
              i.tipo === "os" ? (
                <button
                  type="button"
                  disabled={abriendoPdfId === i.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    void abrirPdf(i.id);
                  }}
                  className="font-ds-body text-ds-small text-ds-accent-700 underline disabled:opacity-50"
                >
                  {abriendoPdfId === i.id ? "Abriendo…" : "Ver PDF"}
                </button>
              ) : (
                "—"
              ),
          },
        ]}
        filas={items ?? []}
        claveFila={(i: ItemHistorial) => `${i.tipo}:${i.id}`}
        cargando={items === null && !error}
        error={error}
        onReintentar={cargar}
        vacio={{ titulo: "Sin trabajos en este período", mensaje: "Probá extender a 90 días o cambiar el filtro." }}
      />

      {items && items.length > 0 && total > limite ? (
        <div className="flex items-center justify-between">
          <span className="font-ds-body text-ds-small text-ds-text/60">
            {(pagina - 1) * limite + 1}–{Math.min(pagina * limite, total)} de {total}
          </span>
          <div className="flex gap-ds-2">
            <Button variante="secundario" tamano="sm" deshabilitado={pagina <= 1} onPress={() => setPagina((p) => p - 1)}>
              Anterior
            </Button>
            <Button variante="secundario" tamano="sm" deshabilitado={pagina * limite >= total} onPress={() => setPagina((p) => p + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
