"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { InformeGenerado, InformePersonalizado, SeccionInforme, TipoInforme } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { abrirPdfInforme } from "@/lib/descargarPdf";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { PageHeader } from "@/components/PageHeader";
import { IconCamera, IconSparkle } from "@/components/icons";
import { Aviso, Button, Card, DatePicker, Input, Select, Textarea, useConfirmar } from "@bitacora/ui/web";

type InformeConUsuario = InformeGenerado & { usuario?: { nombre: string } | null };
type PlantillaConCreador = InformePersonalizado & { creador?: { nombre: string } | null };

const TIPOS: { valor: TipoInforme; etiqueta: string }[] = [
  { valor: "financiero", etiqueta: "Financiero" },
  { valor: "operativo", etiqueta: "Operativo / OT" },
  { valor: "clientes", etiqueta: "Clientes" },
  { valor: "colaboradores", etiqueta: "Desempeño de colaboradores" },
];

const SECCIONES: { valor: SeccionInforme; etiqueta: string }[] = [
  { valor: "financiero", etiqueta: "Financiero" },
  { valor: "ventas", etiqueta: "Ventas" },
  { valor: "operaciones", etiqueta: "Operaciones" },
  { valor: "servicios", etiqueta: "Servicios" },
  { valor: "clientes", etiqueta: "Clientes" },
  { valor: "gastos", etiqueta: "Gastos" },
];

// Rótulo con el mismo look que `etiqueta` de @bitacora/ui, para grupos
// de controles que no son un solo campo (chips de secciones, adjuntos).
const LABEL = "font-ds-body text-ds-caption font-medium text-ds-text/70";

// Chip conmutable (secciones del informe personalizado).
function claseChip(activo: boolean) {
  return `rounded-ds-sm border px-ds-3 py-ds-1 font-ds-body text-ds-caption font-medium transition-colors ${
    activo ? "border-ds-brand bg-ds-brand/[0.08] text-ds-brand" : "border-ds-divider text-ds-text-secondary hover:border-ds-text/30"
  }`;
}

// Pestaña de la cabecera.
function claseTab(activa: boolean) {
  return `px-ds-3 py-ds-2 font-ds-body text-ds-small font-medium ${
    activa ? "border-b-2 border-ds-brand text-ds-brand" : "text-ds-text-secondary"
  }`;
}

// yyyy-mm-dd ↔ Date en hora local (mismo helper que ordenes/page.tsx).
function aFecha(texto: string): Date | null {
  if (!texto) return null;
  const [y, m, d] = texto.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function aTexto(fecha: Date | null): string {
  if (!fecha) return "";
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const TEXTO_INFORME = "whitespace-pre-wrap font-ds-body text-ds-body leading-relaxed text-ds-text";
const SIN_RESUMEN = "No se pudo generar el resumen narrado con IA en este momento — arriba están los datos reales del período.";

function humanizar(clave: string) {
  let texto = clave.replace(/_/g, " ").replace(/^pct\b/, "%").replace(/\bpct\b/g, "%").replace(/\bot\b/gi, "OT");
  texto = texto.charAt(0).toUpperCase() + texto.slice(1);
  return texto;
}

function pareceMoneda(clave: string) {
  return (
    /monto|ingreso|gasto|facturado|vencido|pendiente|ticket|recibido|neto|total_facturado/.test(clave) &&
    !/^total_(os|cotizaciones|clientes|trabajos|presupuestos)$/.test(clave)
  );
}

function ValorCelda({ clave, valor, moneda }: { clave: string; valor: unknown; moneda: string }) {
  if (typeof valor === "number") {
    if (pareceMoneda(clave)) return <>{formatMoneda(valor, moneda)}</>;
    return <>{Number.isInteger(valor) ? valor : valor.toFixed(1)}</>;
  }
  if (valor === null || valor === undefined || valor === "") return <>—</>;
  return <>{String(valor)}</>;
}

function SeccionDatos({ etiqueta, datos, moneda }: { etiqueta: string; datos: Record<string, unknown>; moneda: string }) {
  const kpis = datos.kpis as Record<string, number> | undefined;
  const listas = Object.entries(datos).filter(
    (entrada): entrada is [string, Record<string, unknown>[]] => Array.isArray(entrada[1]) && entrada[1].length > 0
  );

  return (
    <div className="flex flex-col gap-ds-3">
      <h3 className="font-ds-body text-ds-small font-semibold text-ds-text">{etiqueta}</h3>
      {kpis && Object.keys(kpis).length > 0 && (
        <div className="grid gap-ds-3 sm:grid-cols-3">
          {Object.entries(kpis).map(([clave, valor]) => (
            <div key={clave} className="rounded-ds-sm border border-ds-divider p-ds-3">
              <p className="font-ds-body text-ds-caption text-ds-text-secondary">{humanizar(clave)}</p>
              <p className="mt-ds-1 font-ds-body text-ds-small font-semibold tabular-nums text-ds-text">
                <ValorCelda clave={clave} valor={valor} moneda={moneda} />
              </p>
            </div>
          ))}
        </div>
      )}
      {listas.map(([clave, filas]) => {
        const columnas = Object.keys(filas[0] ?? {});
        return (
          <div key={clave} className="overflow-x-auto rounded-ds-sm border border-ds-divider">
            <table className="w-full text-left font-ds-body text-ds-small">
              <thead>
                <tr className="border-b border-ds-divider bg-ds-neutral-100 font-mono text-ds-micro uppercase tracking-[0.1em] text-ds-text-secondary">
                  {columnas.map((c) => (
                    <th key={c} className="px-3 py-2 font-medium">
                      {humanizar(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.slice(0, 10).map((fila, i) => (
                  <tr key={i} className="border-b border-ds-divider last:border-0">
                    {columnas.map((c) => (
                      <td key={c} className="px-3 py-2">
                        <ValorCelda clave={c} valor={fila[c]} moneda={moneda} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

const ETIQUETAS_KPI: Record<string, { etiqueta: string; moneda?: boolean }> = {
  ingresos_totales: { etiqueta: "Ingresos totales", moneda: true },
  ingresos_recibidos: { etiqueta: "Ingresos recibidos", moneda: true },
  monto_pendiente: { etiqueta: "Pendiente de cobro", moneda: true },
  monto_vencido: { etiqueta: "Monto vencido", moneda: true },
  cant_presupuestos: { etiqueta: "Presupuestos" },
  pct_conversion: { etiqueta: "% conversión" },
  ot_completadas: { etiqueta: "OT completadas" },
  pct_conclusion_ot: { etiqueta: "% conclusión OT" },
  clientes_activos: { etiqueta: "Clientes activos" },
  ticket_promedio: { etiqueta: "Ticket promedio", moneda: true },
};

function DatosAgregados({ datos, moneda }: { datos: Record<string, unknown>; moneda: string }) {
  const kpis = datos.kpis as Record<string, number> | undefined;
  const topClientes = datos.top_clientes as
    | { cliente: string; cantidad_trabajos: number; monto_facturado: number; monto_vencido: number }[]
    | undefined;
  const desempeno = datos.desempeno_colaboradores as
    | { colaborador: string; total_trabajos: number; completados: number; calificacion_promedio: number | null }[]
    | undefined;

  return (
    <div className="flex flex-col gap-ds-4">
      {kpis && (
        <div className="grid gap-ds-3 sm:grid-cols-3">
          {Object.entries(kpis).map(([clave, valor]) => {
            const info = ETIQUETAS_KPI[clave];
            if (!info) return null;
            return (
              <div key={clave} className="rounded-ds-sm border border-ds-divider p-ds-3">
                <p className="font-ds-body text-ds-caption text-ds-text-secondary">{info.etiqueta}</p>
                <p className="mt-ds-1 font-ds-body text-ds-small font-semibold tabular-nums text-ds-text">
                  {info.moneda ? formatMoneda(valor, moneda) : valor.toFixed(valor % 1 === 0 ? 0 : 1)}
                </p>
              </div>
            );
          })}
        </div>
      )}
      {topClientes && topClientes.length > 0 && (
        <div className="overflow-x-auto rounded-ds-sm border border-ds-divider">
          <table className="w-full text-left font-ds-body text-ds-small">
            <thead>
              <tr className="border-b border-ds-divider bg-ds-neutral-100 font-mono text-ds-micro uppercase tracking-[0.1em] text-ds-text-secondary">
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Trabajos</th>
                <th className="px-3 py-2 font-medium">Facturado</th>
                <th className="px-3 py-2 font-medium">Vencido</th>
              </tr>
            </thead>
            <tbody>
              {topClientes.map((c) => (
                <tr key={c.cliente} className="border-b border-ds-divider last:border-0">
                  <td className="px-3 py-2 font-medium text-ds-text">{c.cliente}</td>
                  <td className="px-3 py-2">{c.cantidad_trabajos}</td>
                  <td className="px-3 py-2">{formatMoneda(c.monto_facturado, moneda)}</td>
                  <td className="px-3 py-2">{formatMoneda(c.monto_vencido, moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {desempeno && desempeno.length > 0 && (
        <div className="overflow-x-auto rounded-ds-sm border border-ds-divider">
          <table className="w-full text-left font-ds-body text-ds-small">
            <thead>
              <tr className="border-b border-ds-divider bg-ds-neutral-100 font-mono text-ds-micro uppercase tracking-[0.1em] text-ds-text-secondary">
                <th className="px-3 py-2 font-medium">Colaborador</th>
                <th className="px-3 py-2 font-medium">Trabajos</th>
                <th className="px-3 py-2 font-medium">Completados</th>
                <th className="px-3 py-2 font-medium">Satisfacción</th>
              </tr>
            </thead>
            <tbody>
              {desempeno.map((d) => (
                <tr key={d.colaborador} className="border-b border-ds-divider last:border-0">
                  <td className="px-3 py-2 font-medium text-ds-text">{d.colaborador}</td>
                  <td className="px-3 py-2">{d.total_trabajos}</td>
                  <td className="px-3 py-2">{d.completados}</td>
                  <td className="px-3 py-2">{d.calificacion_promedio != null ? d.calificacion_promedio.toFixed(1) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function InformePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmar = useConfirmar();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [tab, setTab] = useState<"estructurado" | "personalizado" | "libre">("estructurado");

  // --- tab: informe libre (texto + fotos) ---
  const [instrucciones, setInstrucciones] = useState("");
  const [imagenes, setImagenes] = useState<File[]>([]);
  const [informeLibre, setInformeLibre] = useState<string | null>(null);
  const [cargandoLibre, setCargandoLibre] = useState(false);
  const [errorLibre, setErrorLibre] = useState<string | null>(null);

  // --- tab: informe estructurado ---
  const [tipo, setTipo] = useState<TipoInforme>("financiero");
  const [desde, setDesde] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [pregunta, setPregunta] = useState("");
  const [generando, setGenerando] = useState(false);
  const [errorEstructurado, setErrorEstructurado] = useState<string | null>(null);
  const [resultado, setResultado] = useState<InformeGenerado | null>(null);
  const [historial, setHistorial] = useState<InformeConUsuario[] | null>(null);

  // --- tab: informe personalizado (secciones + plantillas) ---
  const [seccionesSel, setSeccionesSel] = useState<SeccionInforme[]>([]);
  const [desdeP, setDesdeP] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [hastaP, setHastaP] = useState(() => new Date().toISOString().slice(0, 10));
  const [preguntaP, setPreguntaP] = useState("");
  const [nombreP, setNombreP] = useState("");
  const [guardarPlantilla, setGuardarPlantilla] = useState(false);
  const [plantillaActivaId, setPlantillaActivaId] = useState<string | null>(null);
  const [generandoP, setGenerandoP] = useState(false);
  const [errorP, setErrorP] = useState<string | null>(null);
  const [resultadoP, setResultadoP] = useState<InformeGenerado | null>(null);
  const [plantillas, setPlantillas] = useState<PlantillaConCreador[] | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editSecciones, setEditSecciones] = useState<SeccionInforme[]>([]);

  const cargarHistorial = useCallback(async () => {
    const res = await apiFetch("/api/informe/historial");
    if (res.ok) setHistorial(await res.json());
  }, []);

  const cargarPlantillas = useCallback(async () => {
    const res = await apiFetch("/api/informe/plantillas");
    if (res.ok) setPlantillas(await res.json());
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const res = await apiFetch("/api/me");
      if (res.ok) {
        const { usuario: u } = await res.json();
        if (u) setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "", empresaLogoUrl: u.empresa?.logo_url ?? null, colorPrimario: u.empresa?.color_primario ?? null, tema: u.empresa?.tema ?? "faena", colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null, colorSecundario: u.empresa?.color_secundario ?? null, fuente: u.empresa?.fuente ?? null, moneda: u.empresa?.moneda ?? "CLP" });
      }
      cargarHistorial();
      cargarPlantillas();
    })();
  }, [router, cargarHistorial, cargarPlantillas]);

  function agregarImagenes(e: React.ChangeEvent<HTMLInputElement>) {
    const nuevas = Array.from(e.target.files ?? []);
    setImagenes((prev) => [...prev, ...nuevas].slice(0, 5));
    if (inputRef.current) inputRef.current.value = "";
  }

  function quitarImagen(i: number) {
    setImagenes((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function generarLibre() {
    setErrorLibre(null);
    setCargandoLibre(true);
    const formData = new FormData();
    if (instrucciones.trim()) formData.append("instrucciones", instrucciones.trim());
    imagenes.forEach((img) => formData.append("imagenes", img));

    const res = await apiFetch("/api/informe", { method: "POST", body: formData });
    setCargandoLibre(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorLibre(body.error ?? "No se pudo generar el informe");
      return;
    }
    const body = await res.json();
    setInformeLibre(body.informe);
  }

  async function generarEstructurado() {
    setErrorEstructurado(null);
    setGenerando(true);
    const res = await apiFetch("/api/informe/estructurado", {
      method: "POST",
      body: JSON.stringify({ tipo, desde, hasta, pregunta: pregunta.trim() || undefined }),
    });
    setGenerando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorEstructurado(body.error ?? "No se pudo generar el informe");
      return;
    }
    const body: InformeGenerado = await res.json();
    setResultado(body);
    cargarHistorial();
  }

  async function verHistorial(id: string) {
    const res = await apiFetch(`/api/informe/historial/${id}`);
    if (!res.ok) return;
    const body: InformeGenerado = await res.json();
    if (body.tipo === "personalizado") {
      setResultadoP(body);
      setTab("personalizado");
    } else {
      setResultado(body);
      setTab("estructurado");
    }
  }

  function toggleSeccion(s: SeccionInforme) {
    setSeccionesSel((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function generarPersonalizado() {
    setErrorP(null);
    setGenerandoP(true);
    const res = await apiFetch("/api/informe/personalizado", {
      method: "POST",
      body: JSON.stringify({
        secciones: seccionesSel,
        desde: desdeP,
        hasta: hastaP,
        pregunta: preguntaP.trim() || undefined,
        nombre: nombreP.trim() || undefined,
        guardar_como_plantilla: guardarPlantilla,
        plantilla_id: plantillaActivaId || undefined,
      }),
    });
    setGenerandoP(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorP(body.error ?? "No se pudo generar el informe");
      return;
    }
    const body: InformeGenerado = await res.json();
    setResultadoP(body);
    cargarHistorial();
    if (guardarPlantilla) cargarPlantillas();
  }

  function usarPlantilla(p: InformePersonalizado) {
    setSeccionesSel(p.secciones);
    setPreguntaP(p.pregunta ?? "");
    setNombreP(p.nombre);
    setPlantillaActivaId(p.id);
    setGuardarPlantilla(false);
    setResultadoP(null);
    setErrorP(null);
  }

  async function guardarEdicionPlantilla(id: string) {
    if (!editNombre.trim() || editSecciones.length === 0) return;
    const res = await apiFetch(`/api/informe/plantillas/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ nombre: editNombre.trim(), secciones: editSecciones }),
    });
    if (res.ok) {
      setEditId(null);
      cargarPlantillas();
    }
  }

  async function eliminarPlantilla(id: string) {
    if (!(await confirmar({ titulo: "¿Eliminar esta plantilla?", mensaje: "Esta acción no se puede deshacer.", accion: "Eliminar", destructivo: true }))) return;
    const res = await apiFetch(`/api/informe/plantillas/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (plantillaActivaId === id) setPlantillaActivaId(null);
      cargarPlantillas();
    }
  }

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <PageHeader
        title="Informe con IA"
        subtitle="Resúmenes ejecutivos generados por Claude a partir de tus datos reales"
      />

      <div className="my-ds-6 flex gap-ds-2 border-b border-ds-divider">
        <button type="button" onClick={() => setTab("estructurado")} className={claseTab(tab === "estructurado")}>
          Informe estructurado
        </button>
        <button type="button" onClick={() => setTab("personalizado")} className={claseTab(tab === "personalizado")}>
          Personalizado
        </button>
        <button type="button" onClick={() => setTab("libre")} className={claseTab(tab === "libre")}>
          Informe libre
        </button>
      </div>

      {tab === "estructurado" && (
        <>
          <div className="mb-ds-6">
            <Card>
              <div className="grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-4">
                <Select
                  etiqueta="Tipo de informe"
                  valor={tipo}
                  onCambio={(v) => setTipo(v as TipoInforme)}
                  opciones={TIPOS.map((t) => ({ valor: t.valor, etiqueta: t.etiqueta }))}
                />
                <DatePicker etiqueta="Desde" valor={aFecha(desde)} onCambio={(f) => setDesde(aTexto(f))} />
                <DatePicker etiqueta="Hasta" valor={aFecha(hasta)} onCambio={(f) => setHasta(aTexto(f))} />
              </div>
              <div className="mt-ds-4">
                <Textarea
                  etiqueta="Pregunta libre (opcional)"
                  filas={2}
                  placeholder="ej: ¿cómo fue mi facturación este trimestre comparado con el anterior?"
                  valor={pregunta}
                  onCambio={setPregunta}
                />
              </div>
              <div className="mt-ds-4">
                <Button onPress={generarEstructurado} deshabilitado={generando} iconoIzq={<IconSparkle className="h-4 w-4" />}>
                  {generando ? "Generando…" : "Generar informe"}
                </Button>
              </div>
              {errorEstructurado && (
                <div className="mt-ds-4">
                  <Aviso tono="error">{errorEstructurado}</Aviso>
                </div>
              )}
            </Card>
          </div>

          {resultado && (
            <div className="mb-ds-6">
              <Card>
                <div className="mb-ds-4 flex flex-wrap items-center justify-between gap-ds-2">
                  <h2 className="font-ds-body text-ds-small font-semibold text-ds-text">
                    {TIPOS.find((t) => t.valor === resultado.tipo)?.etiqueta} · {resultado.desde} a {resultado.hasta}
                  </h2>
                  <Button variante="secundario" onPress={() => abrirPdfInforme(resultado.id)}>
                    Descargar PDF
                  </Button>
                </div>

                <DatosAgregados datos={resultado.datos_agregados} moneda={usuario.moneda ?? "CLP"} />

                <div className="mt-ds-4 border-t border-ds-divider pt-ds-4">
                  {resultado.resultado ? (
                    <pre className={TEXTO_INFORME}>{resultado.resultado}</pre>
                  ) : (
                    <p className="font-ds-body text-ds-small text-ds-text-secondary">{SIN_RESUMEN}</p>
                  )}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {tab === "personalizado" && (
        <>
          <div className="mb-ds-6">
            <Card>
              <p id="informe-secciones" className={`mb-ds-2 ${LABEL}`}>
                Secciones a incluir
              </p>
              <div role="group" aria-labelledby="informe-secciones" className="flex flex-wrap gap-ds-2">
                {SECCIONES.map((s) => {
                  const activo = seccionesSel.includes(s.valor);
                  return (
                    <button
                      key={s.valor}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => toggleSeccion(s.valor)}
                      className={claseChip(activo)}
                    >
                      {s.etiqueta}
                    </button>
                  );
                })}
              </div>

              <div className="mt-ds-4 grid gap-ds-4 sm:grid-cols-2">
                <DatePicker etiqueta="Desde" valor={aFecha(desdeP)} onCambio={(f) => setDesdeP(aTexto(f))} />
                <DatePicker etiqueta="Hasta" valor={aFecha(hastaP)} onCambio={(f) => setHastaP(aTexto(f))} />
              </div>

              <div className="mt-ds-4">
                <Textarea
                  etiqueta="Pregunta libre (opcional)"
                  filas={2}
                  placeholder="ej: ¿qué debería priorizar este mes?"
                  valor={preguntaP}
                  onCambio={setPreguntaP}
                />
              </div>

              <div className="mt-ds-4 flex flex-wrap items-end gap-ds-4">
                <div className="min-w-[220px] flex-1">
                  <Input
                    etiqueta={`Nombre ${guardarPlantilla ? "" : "(opcional)"}`}
                    valor={nombreP}
                    onCambio={setNombreP}
                    placeholder="ej: Resumen mensual para el dueño"
                  />
                </div>
                <label className="flex items-center gap-ds-2 pb-ds-3 font-ds-body text-ds-small text-ds-text">
                  <input
                    type="checkbox"
                    checked={guardarPlantilla}
                    onChange={(e) => setGuardarPlantilla(e.target.checked)}
                  />
                  Guardar como plantilla
                </label>
              </div>

              {plantillaActivaId && (
                <p className="mt-ds-2 font-ds-body text-ds-caption text-ds-text-secondary">
                  Generando a partir de una plantilla guardada.{" "}
                  <button type="button" className="text-ds-brand hover:underline" onClick={() => setPlantillaActivaId(null)}>
                    Quitar
                  </button>
                </p>
              )}

              <div className="mt-ds-4">
                <Button
                  onPress={generarPersonalizado}
                  deshabilitado={generandoP || seccionesSel.length === 0}
                  iconoIzq={<IconSparkle className="h-4 w-4" />}
                >
                  {generandoP ? "Generando…" : "Generar informe"}
                </Button>
              </div>
              {errorP && (
                <div className="mt-ds-4">
                  <Aviso tono="error">{errorP}</Aviso>
                </div>
              )}
            </Card>
          </div>

          {resultadoP && (
            <div className="mb-ds-6">
              <Card>
                <div className="mb-ds-4 flex flex-wrap items-center justify-between gap-ds-2">
                  <h2 className="font-ds-body text-ds-small font-semibold text-ds-text">
                    {resultadoP.nombre ?? "Informe personalizado"} · {resultadoP.desde} a {resultadoP.hasta}
                  </h2>
                  <Button variante="secundario" onPress={() => abrirPdfInforme(resultadoP.id)}>
                    Descargar PDF
                  </Button>
                </div>

                <div className="flex flex-col gap-ds-6">
                  {(resultadoP.secciones ?? []).map((s) => (
                    <SeccionDatos
                      key={s}
                      etiqueta={SECCIONES.find((x) => x.valor === s)?.etiqueta ?? s}
                      datos={(resultadoP.datos_agregados as Record<string, Record<string, unknown>>)[s] ?? {}}
                      moneda={usuario.moneda ?? "CLP"}
                    />
                  ))}
                </div>

                <div className="mt-ds-4 border-t border-ds-divider pt-ds-4">
                  {resultadoP.resultado ? (
                    <pre className={TEXTO_INFORME}>{resultadoP.resultado}</pre>
                  ) : (
                    <p className="font-ds-body text-ds-small text-ds-text-secondary">{SIN_RESUMEN}</p>
                  )}
                </div>
              </Card>
            </div>
          )}

          {plantillas && plantillas.length > 0 && (
            <div className="mb-ds-6">
              <Card>
                <h2 className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Mis plantillas</h2>
                <div className="flex flex-col divide-y divide-ds-divider">
                  {plantillas.map((p) => (
                    <div key={p.id} className="flex flex-col gap-ds-2 py-ds-3">
                      {editId === p.id ? (
                        <div className="flex flex-col gap-ds-3">
                          <Input etiquetaAccesible="Nombre de la plantilla" valor={editNombre} onCambio={setEditNombre} />
                          <div className="flex flex-wrap gap-ds-2">
                            {SECCIONES.map((s) => {
                              const activo = editSecciones.includes(s.valor);
                              return (
                                <button
                                  key={s.valor}
                                  type="button"
                                  aria-pressed={activo}
                                  onClick={() =>
                                    setEditSecciones((prev) =>
                                      activo ? prev.filter((x) => x !== s.valor) : [...prev, s.valor]
                                    )
                                  }
                                  className={claseChip(activo)}
                                >
                                  {s.etiqueta}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex gap-ds-2">
                            <Button onPress={() => guardarEdicionPlantilla(p.id)}>Guardar</Button>
                            <Button variante="secundario" onPress={() => setEditId(null)}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-ds-3">
                          <div>
                            <p className="font-ds-body text-ds-small font-medium text-ds-text">{p.nombre}</p>
                            <div className="mt-ds-1 flex flex-wrap gap-ds-1">
                              {p.secciones.map((s) => (
                                <span key={s} className="rounded-ds-pill bg-ds-brand/[0.08] px-ds-2 py-0.5 text-ds-micro text-ds-brand">
                                  {SECCIONES.find((x) => x.valor === s)?.etiqueta ?? s}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-ds-2">
                            <Button variante="secundario" onPress={() => usarPlantilla(p)}>
                              Usar
                            </Button>
                            <Button
                              variante="secundario"
                              onPress={() => {
                                setEditId(p.id);
                                setEditNombre(p.nombre);
                                setEditSecciones(p.secciones);
                              }}
                            >
                              Editar
                            </Button>
                            <Button variante="secundario" onPress={() => eliminarPlantilla(p.id)}>
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {(tab === "estructurado" || tab === "personalizado") && historial && historial.length > 0 && (
        <div className="mb-ds-6">
          <Card>
            <h2 className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Historial</h2>
            <div className="flex flex-col divide-y divide-ds-divider">
              {historial.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => verHistorial(h.id)}
                  className="flex items-center justify-between gap-ds-3 py-ds-2 text-left font-ds-body text-ds-small hover:text-ds-brand"
                >
                  <span>
                    {h.tipo === "personalizado"
                      ? `${h.nombre ?? "Informe personalizado"} (${(h.secciones ?? [])
                          .map((s) => SECCIONES.find((x) => x.valor === s)?.etiqueta ?? s)
                          .join(", ")})`
                      : `${TIPOS.find((t) => t.valor === h.tipo)?.etiqueta} · ${h.desde} a ${h.hasta}`}
                  </span>
                  <span className="text-ds-caption text-ds-text-secondary">
                    {h.usuario?.nombre ?? "—"} · {new Date(h.creado_en).toLocaleDateString("es-CL")}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "libre" && (
        <>
          <div className="my-ds-6">
            <Card>
              <p className="font-ds-body text-ds-small text-ds-text-secondary">
                Actividad reciente, estado de facturación, riesgos y una recomendación
                concreta — generado en segundos.
              </p>

              <div className="mt-ds-4">
                <Textarea
                  etiqueta="Instrucciones adicionales (opcional)"
                  filas={3}
                  placeholder="ej: enfócate en Minera Los Andes, o compara con el mes pasado"
                  valor={instrucciones}
                  onCambio={setInstrucciones}
                />
              </div>

              <div className="mt-ds-4">
                <label htmlFor="input-imagenes-informe" className={`mb-ds-1 block ${LABEL}`}>
                  Adjuntar imágenes (opcional, máx. 5)
                </label>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={agregarImagenes}
                  className="hidden"
                  id="input-imagenes-informe"
                />
                <div className="flex flex-wrap items-center gap-ds-2">
                  {imagenes.map((img, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-ds-pill bg-ds-brand/[0.08] px-ds-3 py-ds-1 font-ds-body text-ds-caption text-ds-brand"
                    >
                      {img.name}
                      <button
                        type="button"
                        onClick={() => quitarImagen(i)}
                        className="text-ds-brand/70 hover:text-ds-brand"
                        aria-label={`Quitar ${img.name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {imagenes.length < 5 && (
                    <Button
                      variante="secundario"
                      iconoIzq={<IconCamera className="h-4 w-4" />}
                      onPress={() => inputRef.current?.click()}
                    >
                      Agregar imagen
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-ds-4">
                <Button onPress={generarLibre} deshabilitado={cargandoLibre} iconoIzq={<IconSparkle className="h-4 w-4" />}>
                  {cargandoLibre ? "Generando…" : informeLibre ? "Regenerar informe" : "Generar informe"}
                </Button>
              </div>
              {errorLibre && (
                <div className="mt-ds-4">
                  <Aviso tono="error">{errorLibre}</Aviso>
                </div>
              )}
            </Card>
          </div>

          {informeLibre && (
            <Card>
              <pre className={TEXTO_INFORME}>{informeLibre}</pre>
            </Card>
          )}
        </>
      )}
    </DashboardShell>
  );
}
