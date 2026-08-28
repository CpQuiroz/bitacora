"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { InformeGenerado, InformePersonalizado, SeccionInforme, TipoInforme } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { abrirPdfInforme } from "@/lib/descargarPdf";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, ErrorText, Label, PageHeader, Select, Textarea } from "@/components/ui";
import { IconCamera, IconSparkle } from "@/components/icons";

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
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{etiqueta}</h3>
      {kpis && Object.keys(kpis).length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(kpis).map(([clave, valor]) => (
            <div key={clave} className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">{humanizar(clave)}</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                <ValorCelda clave={clave} valor={valor} moneda={moneda} />
              </p>
            </div>
          ))}
        </div>
      )}
      {listas.map(([clave, filas]) => {
        const columnas = Object.keys(filas[0] ?? {});
        return (
          <div key={clave} className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  {columnas.map((c) => (
                    <th key={c} className="px-3 py-2 font-medium">
                      {humanizar(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.slice(0, 10).map((fila, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
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
    <div className="flex flex-col gap-4">
      {kpis && (
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(kpis).map(([clave, valor]) => {
            const info = ETIQUETAS_KPI[clave];
            if (!info) return null;
            return (
              <div key={clave} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted">{info.etiqueta}</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                  {info.moneda ? formatMoneda(valor, moneda) : valor.toFixed(valor % 1 === 0 ? 0 : 1)}
                </p>
              </div>
            );
          })}
        </div>
      )}
      {topClientes && topClientes.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Trabajos</th>
                <th className="px-3 py-2 font-medium">Facturado</th>
                <th className="px-3 py-2 font-medium">Vencido</th>
              </tr>
            </thead>
            <tbody>
              {topClientes.map((c) => (
                <tr key={c.cliente} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">{c.cliente}</td>
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
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-3 py-2 font-medium">Colaborador</th>
                <th className="px-3 py-2 font-medium">Trabajos</th>
                <th className="px-3 py-2 font-medium">Completados</th>
                <th className="px-3 py-2 font-medium">Satisfacción</th>
              </tr>
            </thead>
            <tbody>
              {desempeno.map((d) => (
                <tr key={d.colaborador} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">{d.colaborador}</td>
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
        if (u) setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "", empresaLogoUrl: u.empresa?.logo_url ?? null, colorPrimario: u.empresa?.color_primario ?? null, colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null, colorSecundario: u.empresa?.color_secundario ?? null, fuente: u.empresa?.fuente ?? null, moneda: u.empresa?.moneda ?? "CLP" });
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
    if (!window.confirm("¿Eliminar esta plantilla? Esta acción no se puede deshacer.")) return;
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

      <div className="my-6 flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("estructurado")}
          className={`px-3 py-2 text-sm font-medium ${tab === "estructurado" ? "border-b-2 border-brand text-brand" : "text-muted"}`}
        >
          Informe estructurado
        </button>
        <button
          type="button"
          onClick={() => setTab("personalizado")}
          className={`px-3 py-2 text-sm font-medium ${tab === "personalizado" ? "border-b-2 border-brand text-brand" : "text-muted"}`}
        >
          Personalizado
        </button>
        <button
          type="button"
          onClick={() => setTab("libre")}
          className={`px-3 py-2 text-sm font-medium ${tab === "libre" ? "border-b-2 border-brand text-brand" : "text-muted"}`}
        >
          Informe libre
        </button>
      </div>

      {tab === "estructurado" && (
        <>
          <Card className="mb-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label>Tipo de informe</Label>
                <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoInforme)}>
                  {TIPOS.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.etiqueta}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Desde</Label>
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                />
              </div>
              <div>
                <Label>Hasta</Label>
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                />
              </div>
            </div>
            <div className="mt-4">
              <Label>Pregunta libre (opcional)</Label>
              <Textarea
                rows={2}
                placeholder="ej: ¿cómo fue mi facturación este trimestre comparado con el anterior?"
                value={pregunta}
                onChange={(e) => setPregunta(e.target.value)}
              />
            </div>
            <Button onClick={generarEstructurado} disabled={generando} className="mt-4">
              <IconSparkle className="h-4 w-4" />
              {generando ? "Generando…" : "Generar informe"}
            </Button>
            {errorEstructurado && (
              <div className="mt-4">
                <ErrorText>{errorEstructurado}</ErrorText>
              </div>
            )}
          </Card>

          {resultado && (
            <Card className="mb-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {TIPOS.find((t) => t.valor === resultado.tipo)?.etiqueta} · {resultado.desde} a {resultado.hasta}
                </h2>
                <Button type="button" variant="outline" onClick={() => abrirPdfInforme(resultado.id)}>
                  Descargar PDF
                </Button>
              </div>

              <DatosAgregados datos={resultado.datos_agregados} moneda={usuario.moneda ?? "CLP"} />

              <div className="mt-5 border-t border-border pt-5">
                {resultado.resultado ? (
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                    {resultado.resultado}
                  </pre>
                ) : (
                  <p className="text-sm text-muted">
                    No se pudo generar el resumen narrado con IA en este momento — arriba están los datos reales del período.
                  </p>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {tab === "personalizado" && (
        <>
          <Card className="mb-6">
            <Label>Secciones a incluir</Label>
            <div className="flex flex-wrap gap-2">
              {SECCIONES.map((s) => {
                const activo = seccionesSel.includes(s.valor);
                return (
                  <button
                    key={s.valor}
                    type="button"
                    onClick={() => toggleSeccion(s.valor)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      activo ? "border-transparent bg-brand-soft text-brand" : "border-border text-muted"
                    }`}
                  >
                    {s.etiqueta}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Desde</Label>
                <input
                  type="date"
                  value={desdeP}
                  onChange={(e) => setDesdeP(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                />
              </div>
              <div>
                <Label>Hasta</Label>
                <input
                  type="date"
                  value={hastaP}
                  onChange={(e) => setHastaP(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                />
              </div>
            </div>

            <div className="mt-4">
              <Label>Pregunta libre (opcional)</Label>
              <Textarea
                rows={2}
                placeholder="ej: ¿qué debería priorizar este mes?"
                value={preguntaP}
                onChange={(e) => setPreguntaP(e.target.value)}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div className="min-w-[220px] flex-1">
                <Label>Nombre {guardarPlantilla ? "" : "(opcional)"}</Label>
                <input
                  type="text"
                  value={nombreP}
                  onChange={(e) => setNombreP(e.target.value)}
                  placeholder="ej: Resumen mensual para el dueño"
                  className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                />
              </div>
              <label className="flex items-center gap-2 pb-2.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={guardarPlantilla}
                  onChange={(e) => setGuardarPlantilla(e.target.checked)}
                />
                Guardar como plantilla
              </label>
            </div>

            {plantillaActivaId && (
              <p className="mt-2 text-xs text-muted">
                Generando a partir de una plantilla guardada.{" "}
                <button type="button" className="text-brand hover:underline" onClick={() => setPlantillaActivaId(null)}>
                  Quitar
                </button>
              </p>
            )}

            <Button onClick={generarPersonalizado} disabled={generandoP || seccionesSel.length === 0} className="mt-4">
              <IconSparkle className="h-4 w-4" />
              {generandoP ? "Generando…" : "Generar informe"}
            </Button>
            {errorP && (
              <div className="mt-4">
                <ErrorText>{errorP}</ErrorText>
              </div>
            )}
          </Card>

          {resultadoP && (
            <Card className="mb-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {resultadoP.nombre ?? "Informe personalizado"} · {resultadoP.desde} a {resultadoP.hasta}
                </h2>
                <Button type="button" variant="outline" onClick={() => abrirPdfInforme(resultadoP.id)}>
                  Descargar PDF
                </Button>
              </div>

              <div className="flex flex-col gap-6">
                {(resultadoP.secciones ?? []).map((s) => (
                  <SeccionDatos
                    key={s}
                    etiqueta={SECCIONES.find((x) => x.valor === s)?.etiqueta ?? s}
                    datos={(resultadoP.datos_agregados as Record<string, Record<string, unknown>>)[s] ?? {}}
                    moneda={usuario.moneda ?? "CLP"}
                  />
                ))}
              </div>

              <div className="mt-5 border-t border-border pt-5">
                {resultadoP.resultado ? (
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                    {resultadoP.resultado}
                  </pre>
                ) : (
                  <p className="text-sm text-muted">
                    No se pudo generar el resumen narrado con IA en este momento — arriba están los datos reales del período.
                  </p>
                )}
              </div>
            </Card>
          )}

          {plantillas && plantillas.length > 0 && (
            <Card className="mb-6">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Mis plantillas</h2>
              <div className="flex flex-col divide-y divide-border">
                {plantillas.map((p) => (
                  <div key={p.id} className="flex flex-col gap-2 py-3">
                    {editId === p.id ? (
                      <div className="flex flex-col gap-3">
                        <input
                          type="text"
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          className="w-full rounded-lg border border-border bg-surface px-3.5 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        />
                        <div className="flex flex-wrap gap-2">
                          {SECCIONES.map((s) => {
                            const activo = editSecciones.includes(s.valor);
                            return (
                              <button
                                key={s.valor}
                                type="button"
                                onClick={() =>
                                  setEditSecciones((prev) =>
                                    activo ? prev.filter((x) => x !== s.valor) : [...prev, s.valor]
                                  )
                                }
                                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                  activo ? "border-transparent bg-brand-soft text-brand" : "border-border text-muted"
                                }`}
                              >
                                {s.etiqueta}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" onClick={() => guardarEdicionPlantilla(p.id)}>
                            Guardar
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setEditId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.nombre}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {p.secciones.map((s) => (
                              <span key={s} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand">
                                {SECCIONES.find((x) => x.valor === s)?.etiqueta ?? s}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" onClick={() => usarPlantilla(p)}>
                            Usar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setEditId(p.id);
                              setEditNombre(p.nombre);
                              setEditSecciones(p.secciones);
                            }}
                          >
                            Editar
                          </Button>
                          <Button type="button" variant="outline" onClick={() => eliminarPlantilla(p.id)}>
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {(tab === "estructurado" || tab === "personalizado") && historial && historial.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Historial</h2>
          <div className="flex flex-col divide-y divide-border">
            {historial.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => verHistorial(h.id)}
                className="flex items-center justify-between gap-3 py-2.5 text-left text-sm hover:text-brand"
              >
                <span>
                  {h.tipo === "personalizado"
                    ? `${h.nombre ?? "Informe personalizado"} (${(h.secciones ?? [])
                        .map((s) => SECCIONES.find((x) => x.valor === s)?.etiqueta ?? s)
                        .join(", ")})`
                    : `${TIPOS.find((t) => t.valor === h.tipo)?.etiqueta} · ${h.desde} a ${h.hasta}`}
                </span>
                <span className="text-xs text-muted">
                  {h.usuario?.nombre ?? "—"} · {new Date(h.creado_en).toLocaleDateString("es-CL")}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {tab === "libre" && (
        <>
          <Card className="my-6">
            <p className="text-sm text-muted">
              Actividad reciente, estado de facturación, riesgos y una recomendación
              concreta — generado en segundos.
            </p>

            <div className="mt-4">
              <Label>Instrucciones adicionales (opcional)</Label>
              <Textarea
                rows={3}
                placeholder="ej: enfócate en Minera Los Andes, o compara con el mes pasado"
                value={instrucciones}
                onChange={(e) => setInstrucciones(e.target.value)}
              />
            </div>

            <div className="mt-4">
              <Label>Adjuntar imágenes (opcional, máx. 5)</Label>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={agregarImagenes}
                className="hidden"
                id="input-imagenes-informe"
              />
              <div className="flex flex-wrap items-center gap-2">
                {imagenes.map((img, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs text-brand"
                  >
                    {img.name}
                    <button
                      type="button"
                      onClick={() => quitarImagen(i)}
                      className="text-brand/70 hover:text-brand"
                      aria-label={`Quitar ${img.name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {imagenes.length < 5 && (
                  <label htmlFor="input-imagenes-informe">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => inputRef.current?.click()}
                    >
                      <IconCamera className="h-4 w-4" />
                      Agregar imagen
                    </Button>
                  </label>
                )}
              </div>
            </div>

            <Button onClick={generarLibre} disabled={cargandoLibre} className="mt-5">
              <IconSparkle className="h-4 w-4" />
              {cargandoLibre ? "Generando…" : informeLibre ? "Regenerar informe" : "Generar informe"}
            </Button>
            {errorLibre && (
              <div className="mt-4">
                <ErrorText>{errorLibre}</ErrorText>
              </div>
            )}
          </Card>

          {informeLibre && (
            <Card>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                {informeLibre}
              </pre>
            </Card>
          )}
        </>
      )}
    </DashboardShell>
  );
}
