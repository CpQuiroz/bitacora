"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import type { BloqueEncabezado, NivelEncabezado, PlantillaDocumento, PosicionLogo, SeccionPdfOS, TipoPlantilla, VariablePlantilla } from "@bitacora/shared";
import {
  ETIQUETA_SECCION_PDF_OS,
  SECCIONES_PDF_OS,
  VARIABLES_COBRANZA,
  VARIABLES_COTIZACION,
  VARIABLES_OS,
  sustituirVariables,
  sustituirVariablesEnBloques,
} from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, Input, LoadingState, Select, Textarea, useToast } from "@bitacora/ui/web";
import { useConfiguracion } from "../ConfiguracionContext";

const VARIABLES_POR_TIPO: Record<TipoPlantilla, VariablePlantilla[]> = {
  cotizacion: VARIABLES_COTIZACION,
  orden_servicio: VARIABLES_OS,
  cobranza: VARIABLES_COBRANZA,
  terminos_aceptacion: [],
};

const DATOS_EJEMPLO: Record<string, string> = {
  cliente: "Juan Pérez",
  fecha: "24-08-2026",
  tecnico: "Pedro Soto",
  monto: "$45.000",
  folio: "0087",
  direccion: "Av. Providencia 1234, Providencia",
  empresa: "Tu empresa",
};

const TABS: { valor: TipoPlantilla; etiqueta: string }[] = [
  { valor: "cotizacion", etiqueta: "Cotización" },
  { valor: "orden_servicio", etiqueta: "Orden de Servicio" },
  { valor: "cobranza", etiqueta: "Cobranza" },
  { valor: "terminos_aceptacion", etiqueta: "Términos de Aceptación" },
];

const POSICIONES: { valor: PosicionLogo; etiqueta: string }[] = [
  { valor: "izquierda", etiqueta: "Izquierda" },
  { valor: "centro", etiqueta: "Centro" },
  { valor: "derecha", etiqueta: "Derecha" },
];

const TITULO_DOC: Record<TipoPlantilla, string> = {
  cotizacion: "Cotización N° 0142",
  orden_servicio: "Orden de Servicio N° 0087",
  cobranza: "Cobranza N° 0034",
  terminos_aceptacion: "Términos de Aceptación",
};

// "Texto de encabezado" con niveles (migración 113, 20-sep-2026) — antes
// un <input> de una sola línea, sin poder ni cortar renglones. Ahora una
// lista de bloques con nivel; cada nivel tiene su propio tamaño en el
// PDF y en la vista previa (ver ESTILO_PREVIEW_NIVEL más abajo y
// bloquesEncabezado() en backend/src/pdfEstilo.ts — mismo criterio
// visual en los dos lados).
const NIVELES_ENCABEZADO: { valor: NivelEncabezado; etiqueta: string }[] = [
  { valor: "titulo", etiqueta: "Título" },
  { valor: "subtitulo", etiqueta: "Subtítulo" },
  { valor: "chico", etiqueta: "Texto chico" },
  { valor: "parrafo", etiqueta: "Párrafo" },
];

const ESTILO_PREVIEW_NIVEL: Record<NivelEncabezado, string> = {
  titulo: "ds-heading text-base text-gray-800",
  subtitulo: "text-sm font-bold text-gray-800",
  chico: "text-[10px] text-gray-500",
  parrafo: "text-xs text-gray-500",
};

function EditorEncabezado({
  bloques,
  onCambiar,
  variables,
}: {
  bloques: BloqueEncabezado[];
  onCambiar: (bloques: BloqueEncabezado[]) => void;
  variables: VariablePlantilla[];
}) {
  function agregar(nivel: NivelEncabezado) {
    onCambiar([...bloques, { nivel, texto: "" }]);
  }
  function actualizarTexto(i: number, texto: string) {
    onCambiar(bloques.map((b, idx) => (idx === i ? { ...b, texto } : b)));
  }
  function quitar(i: number) {
    onCambiar(bloques.filter((_, idx) => idx !== i));
  }
  function mover(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= bloques.length) return;
    const next = [...bloques];
    [next[i], next[j]] = [next[j], next[i]];
    onCambiar(next);
  }
  function insertarVariable(clave: string) {
    if (bloques.length === 0) {
      onCambiar([{ nivel: "parrafo", texto: `{${clave}}` }]);
      return;
    }
    const ultimo = bloques.length - 1;
    onCambiar(bloques.map((b, idx) => (idx === ultimo ? { ...b, texto: `${b.texto}{${clave}}` } : b)));
  }

  return (
    <div className="flex flex-col gap-ds-2">
      <div className="flex flex-wrap gap-ds-2">
        {NIVELES_ENCABEZADO.map((n) => (
          <button
            key={n.valor}
            type="button"
            onClick={() => agregar(n.valor)}
            className="rounded-ds-md border border-dashed border-ds-divider px-ds-2 py-1 font-ds-body text-ds-caption font-semibold text-ds-text/70 hover:border-ds-brand hover:text-ds-brand"
          >
            + {n.etiqueta}
          </button>
        ))}
      </div>
      {bloques.length === 0 ? (
        <p className="font-ds-body text-ds-caption text-ds-text-secondary">Sin bloques todavía — agregá uno de arriba.</p>
      ) : (
        <div className="flex flex-col gap-ds-2">
          {bloques.map((b, i) => (
            <div key={i} className="flex items-center gap-ds-2">
              <span className="shrink-0 rounded-ds-pill bg-ds-accent2-100 px-ds-2 py-0.5 font-ds-body text-[10px] font-bold uppercase tracking-wide text-ds-accent2-800">
                {NIVELES_ENCABEZADO.find((n) => n.valor === b.nivel)?.etiqueta ?? b.nivel}
              </span>
              <div className="flex-1">
                <Input valor={b.texto} onCambio={(v) => actualizarTexto(i, v)} placeholder="Escribí el texto de este bloque…" />
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  className="rounded-ds-md border border-ds-divider px-1.5 py-1 text-ds-text-secondary disabled:opacity-30"
                  title="Subir"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, 1)}
                  disabled={i === bloques.length - 1}
                  className="rounded-ds-md border border-ds-divider px-1.5 py-1 text-ds-text-secondary disabled:opacity-30"
                  title="Bajar"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => quitar(i)}
                  className="rounded-ds-md border border-ds-divider px-1.5 py-1 text-ds-accent-700"
                  title="Quitar bloque"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ChipsVariables variables={variables} onInsertar={insertarVariable} />
    </div>
  );
}

function ChipsVariables({ variables, onInsertar }: { variables: VariablePlantilla[]; onInsertar: (clave: string) => void }) {
  if (variables.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {variables.map((v) => (
        <button
          key={v.clave}
          type="button"
          title={v.etiqueta}
          onClick={() => onInsertar(v.clave)}
          className="rounded-ds-pill border border-ds-divider px-2 py-0.5 font-mono text-[11px] text-ds-text-secondary hover:border-ds-brand hover:text-ds-brand"
        >
          {`{${v.clave}}`}
        </button>
      ))}
    </div>
  );
}

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
// La "vista previa en vivo" simula la hoja PDF impresa (fondo blanco,
// grises fijos) — a propósito no usa tokens ds-, igual que un documento
// impreso no cambia con el tema de la app.
export default function PlantillasPage() {
  const { usuario } = useConfiguracion();
  const [tab, setTab] = useState<TipoPlantilla>("cotizacion");
  const [plantilla, setPlantilla] = useState<PlantillaDocumento | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mostrarLogo, setMostrarLogo] = useState(true);
  const [posicionLogo, setPosicionLogo] = useState<PosicionLogo>("izquierda");
  const [colorPrimario, setColorPrimario] = useState("#4338ca");
  const [colorSecundario, setColorSecundario] = useState("#0d9488");
  const [textoEncabezado, setTextoEncabezado] = useState<BloqueEncabezado[]>([]);
  const [textoPie, setTextoPie] = useState("");
  const [mensajePredeterminado, setMensajePredeterminado] = useState("");
  const [terminosCondiciones, setTerminosCondiciones] = useState("");
  const [mostrarFirma, setMostrarFirma] = useState(true);
  // Migración 106 — solo aplica al tab "Orden de Servicio". Ausente en
  // el objeto guardado = mostrar (default seguro).
  const [seccionesPdf, setSeccionesPdf] = useState<Partial<Record<SeccionPdfOS, boolean>>>({});
  const seccionActiva = (s: SeccionPdfOS) => seccionesPdf[s] !== false;
  const alternarSeccion = (s: SeccionPdfOS) => setSeccionesPdf((prev) => ({ ...prev, [s]: !seccionActiva(s) }));

  const [guardando, setGuardando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const toast = useToast();

  const cargarTab = useCallback(async (tipo: TipoPlantilla) => {
    setCargando(true);
    setError(null);
    const res = await apiFetch(`/api/plantillas/${tipo}`);
    setCargando(false);
    if (!res.ok) {
      setError("No se pudo cargar la plantilla");
      return;
    }
    const p: PlantillaDocumento = await res.json();
    setPlantilla(p);
    setMostrarLogo(p.mostrar_logo);
    setPosicionLogo(p.posicion_logo);
    setColorPrimario(p.color_primario || usuario.empresa.color_primario || "#4338ca");
    setColorSecundario(p.color_secundario || usuario.empresa.color_secundario || "#0d9488");
    setTextoEncabezado(p.texto_encabezado ?? []);
    setTextoPie(p.texto_pie ?? "");
    setMensajePredeterminado(p.mensaje_predeterminado ?? "");
    setTerminosCondiciones(p.terminos_condiciones ?? "");
    setMostrarFirma(p.mostrar_firma);
    setSeccionesPdf(p.secciones_pdf ?? {});
  }, [usuario.empresa.color_primario, usuario.empresa.color_secundario]);

  useEffect(() => {
    cargarTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function onGuardar() {
    setError(null);
    setGuardando(true);
    const res = await apiFetch(`/api/plantillas/${tab}`, {
      method: "PATCH",
      body: JSON.stringify({
        mostrar_logo: mostrarLogo,
        posicion_logo: posicionLogo,
        color_primario: colorPrimario,
        color_secundario: colorSecundario,
        texto_encabezado: textoEncabezado,
        texto_pie: textoPie,
        mensaje_predeterminado: mensajePredeterminado,
        terminos_condiciones: terminosCondiciones,
        mostrar_firma: mostrarFirma,
        ...(tab === "orden_servicio" ? { secciones_pdf: seccionesPdf } : {}),
      }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar");
      return;
    }
    setPlantilla(await res.json());
    toast("Plantilla guardada", { tono: "exito" });
  }

  async function onRestaurar() {
    setError(null);
    setRestaurando(true);
    const res = await apiFetch(`/api/plantillas/${tab}/restaurar`, { method: "POST" });
    setRestaurando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo restaurar");
      return;
    }
    await cargarTab(tab);
    toast("Se restauró a los valores por defecto", { tono: "exito" });
  }

  const justify = posicionLogo === "izquierda" ? "justify-start" : posicionLogo === "derecha" ? "justify-end" : "justify-center";
  const variablesTab = VARIABLES_POR_TIPO[tab];

  return (
    <div className="flex flex-col gap-ds-6">
      <div>
        <p className="ds-heading text-ds-h3 text-ds-text">Plantillas</p>
        <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Apariencia de tus documentos PDF</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-ds-divider">
        {TABS.map((t) => (
          <button
            key={t.valor}
            type="button"
            onClick={() => setTab(t.valor)}
            className={`shrink-0 whitespace-nowrap px-ds-3 py-2 font-ds-body text-ds-small font-medium transition-colors ${
              tab === t.valor ? "border-b-2 border-ds-brand text-ds-brand" : "text-ds-text-secondary hover:text-ds-brand"
            }`}
          >
            {t.etiqueta}
          </button>
        ))}
      </div>

      {cargando ? (
        <LoadingState />
      ) : (
        plantilla && (
          <div className="grid gap-ds-6 lg:grid-cols-[1fr_22rem]">
            <div className="flex flex-col gap-ds-6">
              <Card>
                <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Logo</p>
                <label className="flex items-center gap-ds-2 font-ds-body text-ds-small text-ds-text">
                  <input type="checkbox" checked={mostrarLogo} onChange={(e) => setMostrarLogo(e.target.checked)} className="accent-[var(--ds-brand)]" />
                  Mostrar logo
                </label>
                {mostrarLogo && (
                  <div className="mt-ds-3 w-48">
                    <Select etiqueta="Posición" valor={posicionLogo} onCambio={(v) => setPosicionLogo(v as PosicionLogo)} opciones={POSICIONES} />
                  </div>
                )}
              </Card>

              <Card>
                <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Colores</p>
                <div className="grid gap-ds-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="plantilla-color-primario" className="font-ds-body text-ds-caption font-medium text-ds-text/70">Color primario</label>
                    <div className="mt-ds-1 flex items-center gap-ds-3">
                      <input
                        id="plantilla-color-primario"
                        type="color"
                        value={colorPrimario}
                        onChange={(e) => setColorPrimario(e.target.value)}
                        className="h-10 w-14 cursor-pointer rounded-ds-md border border-ds-divider bg-ds-surface p-1"
                      />
                      <div className="flex-1">
                        <Input valor={colorPrimario} onCambio={setColorPrimario} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="plantilla-color-secundario" className="font-ds-body text-ds-caption font-medium text-ds-text/70">Color secundario</label>
                    <div className="mt-ds-1 flex items-center gap-ds-3">
                      <input
                        id="plantilla-color-secundario"
                        type="color"
                        value={colorSecundario}
                        onChange={(e) => setColorSecundario(e.target.value)}
                        className="h-10 w-14 cursor-pointer rounded-ds-md border border-ds-divider bg-ds-surface p-1"
                      />
                      <div className="flex-1">
                        <Input valor={colorSecundario} onCambio={setColorSecundario} />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Textos</p>
                <div className="flex flex-col gap-ds-4">
                  <div>
                    <span className="mb-ds-1 block font-ds-body text-ds-caption font-medium text-ds-text/70">Texto de encabezado</span>
                    <EditorEncabezado bloques={textoEncabezado} onCambiar={setTextoEncabezado} variables={variablesTab} />
                  </div>
                  <div>
                    <Input etiqueta="Texto de pie de página" valor={textoPie} onCambio={setTextoPie} />
                    <ChipsVariables variables={variablesTab} onInsertar={(c) => setTextoPie((v) => `${v}{${c}}`)} />
                  </div>
                  <div>
                    <Textarea etiqueta="Mensaje predeterminado" filas={3} valor={mensajePredeterminado} onCambio={setMensajePredeterminado} />
                    <ChipsVariables variables={variablesTab} onInsertar={(c) => setMensajePredeterminado((v) => `${v}{${c}}`)} />
                  </div>
                  <div>
                    <Textarea etiqueta="Términos y condiciones" filas={4} valor={terminosCondiciones} onCambio={setTerminosCondiciones} />
                    <ChipsVariables variables={variablesTab} onInsertar={(c) => setTerminosCondiciones((v) => `${v}{${c}}`)} />
                  </div>
                  <label className="flex items-center gap-ds-2 font-ds-body text-ds-small text-ds-text">
                    <input type="checkbox" checked={mostrarFirma} onChange={(e) => setMostrarFirma(e.target.checked)} className="accent-[var(--ds-brand)]" />
                    Mostrar campo de firma
                  </label>
                </div>
              </Card>

              {tab === "orden_servicio" ? (
                <Card>
                  <p className="mb-ds-1 font-ds-body text-ds-small font-semibold text-ds-text">Secciones del informe de OS</p>
                  <p className="mb-ds-4 font-ds-body text-ds-caption text-ds-text-secondary">
                    Elegí qué secciones se muestran en el PDF/informe que recibe el cliente.
                  </p>
                  <div className="grid gap-ds-3 sm:grid-cols-3">
                    {SECCIONES_PDF_OS.map((s) => (
                      <label key={s} className="flex items-center gap-ds-2 font-ds-body text-ds-small text-ds-text">
                        <input type="checkbox" checked={seccionActiva(s)} onChange={() => alternarSeccion(s)} className="accent-[var(--ds-brand)]" />
                        {ETIQUETA_SECCION_PDF_OS[s]}
                      </label>
                    ))}
                  </div>
                </Card>
              ) : null}

              {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
              <div className="flex gap-ds-3">
                <Button onPress={onGuardar} cargando={guardando}>
                  Guardar plantilla
                </Button>
                <Button variante="secundario" onPress={onRestaurar} cargando={restaurando}>
                  Restaurar predeterminado
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-ds-2 font-ds-body text-ds-caption font-medium uppercase tracking-wide text-ds-text-secondary">Vista previa en vivo</p>
              <div className="rounded-2xl border border-ds-divider bg-white p-5 text-[#16161f] shadow-sm">
                {mostrarLogo && (
                  <div className={`mb-3 flex ${justify}`}>
                    {usuario.empresa.logo_url ? (
                      <Image src={usuario.empresa.logo_url} alt="" width={40} height={40} className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded" style={{ background: colorPrimario }} />
                    )}
                  </div>
                )}
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colorSecundario }}>
                  {usuario.empresa.nombre}
                </p>
                <h3 className="mt-0.5 text-lg font-bold" style={{ color: colorPrimario }}>
                  {TITULO_DOC[tab]}
                </h3>
                {textoEncabezado.length > 0 && (
                  <div className="mt-1 flex flex-col gap-0.5">
                    {sustituirVariablesEnBloques(textoEncabezado, DATOS_EJEMPLO).map((b, i) =>
                      b.texto ? (
                        <p key={i} className={ESTILO_PREVIEW_NIVEL[b.nivel]}>
                          {b.texto}
                        </p>
                      ) : null
                    )}
                  </div>
                )}

                {tab !== "terminos_aceptacion" && (
                  <div className="mt-4 overflow-hidden rounded-lg border" style={{ borderColor: "#e6e6ee" }}>
                    <div className="flex justify-between px-2 py-1.5 text-[10px] font-semibold text-white" style={{ background: colorPrimario }}>
                      <span>Descripción</span>
                      <span>Total</span>
                    </div>
                    <div className="flex justify-between px-2 py-1.5 text-xs text-gray-700">
                      <span>Servicio de ejemplo</span>
                      <span>$45.000</span>
                    </div>
                  </div>
                )}

                {mensajePredeterminado && <p className="mt-4 text-xs text-gray-600">{sustituirVariables(mensajePredeterminado, DATOS_EJEMPLO)}</p>}
                {terminosCondiciones && (
                  <div className="mt-4 rounded-lg bg-gray-50 p-2.5 text-[10px] leading-relaxed text-gray-500">
                    {sustituirVariables(terminosCondiciones, DATOS_EJEMPLO)}
                  </div>
                )}

                {mostrarFirma && (
                  <div className="mt-6 border-t pt-3 text-center text-[10px] text-gray-400" style={{ borderColor: "#e6e6ee" }}>
                    ___________________________
                    <br />
                    Firma
                  </div>
                )}
                {textoPie && <p className="mt-4 text-center text-[10px] text-gray-400">{sustituirVariables(textoPie, DATOS_EJEMPLO)}</p>}
              </div>
              <p className="mt-ds-2 font-ds-body text-ds-caption text-ds-text-secondary">Así se ve con los cambios sin guardar todavía.</p>
            </div>
          </div>
        )
      )}
    </div>
  );
}
