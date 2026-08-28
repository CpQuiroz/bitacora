"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlantillaDocumento, PosicionLogo, TipoPlantilla } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText, Textarea } from "@/components/ui";
import { useConfiguracion } from "../ConfiguracionContext";

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
  const [textoEncabezado, setTextoEncabezado] = useState("");
  const [textoPie, setTextoPie] = useState("");
  const [mensajePredeterminado, setMensajePredeterminado] = useState("");
  const [terminosCondiciones, setTerminosCondiciones] = useState("");
  const [mostrarFirma, setMostrarFirma] = useState(true);

  const [guardando, setGuardando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargarTab = useCallback(async (tipo: TipoPlantilla) => {
    setCargando(true);
    setError(null);
    setAviso(null);
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
    setTextoEncabezado(p.texto_encabezado ?? "");
    setTextoPie(p.texto_pie ?? "");
    setMensajePredeterminado(p.mensaje_predeterminado ?? "");
    setTerminosCondiciones(p.terminos_condiciones ?? "");
    setMostrarFirma(p.mostrar_firma);
  }, [usuario.empresa.color_primario, usuario.empresa.color_secundario]);

  useEffect(() => {
    cargarTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function onGuardar() {
    setError(null);
    setAviso(null);
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
      }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar");
      return;
    }
    setPlantilla(await res.json());
    setAviso("Plantilla guardada");
  }

  async function onRestaurar() {
    setError(null);
    setAviso(null);
    setRestaurando(true);
    const res = await apiFetch(`/api/plantillas/${tab}/restaurar`, { method: "POST" });
    setRestaurando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo restaurar");
      return;
    }
    await cargarTab(tab);
    setAviso("Se restauró a los valores por defecto");
  }

  const justify = posicionLogo === "izquierda" ? "justify-start" : posicionLogo === "derecha" ? "justify-end" : "justify-center";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Plantillas" subtitle="Apariencia de tus documentos PDF" />

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.valor}
            type="button"
            onClick={() => setTab(t.valor)}
            className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.valor ? "border-b-2 border-brand text-brand" : "text-muted hover:text-brand"
            }`}
          >
            {t.etiqueta}
          </button>
        ))}
      </div>

      {cargando ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        plantilla && (
          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <div className="flex flex-col gap-6">
              <Card>
                <h2 className="mb-4 text-sm font-semibold text-foreground">Logo</h2>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={mostrarLogo} onChange={(e) => setMostrarLogo(e.target.checked)} className="accent-brand" />
                  Mostrar logo
                </label>
                {mostrarLogo && (
                  <div className="mt-3 w-48">
                    <Label>Posición</Label>
                    <Select value={posicionLogo} onChange={(e) => setPosicionLogo(e.target.value as PosicionLogo)}>
                      {POSICIONES.map((p) => (
                        <option key={p.valor} value={p.valor}>
                          {p.etiqueta}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </Card>

              <Card>
                <h2 className="mb-4 text-sm font-semibold text-foreground">Colores</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Color primario</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={colorPrimario}
                        onChange={(e) => setColorPrimario(e.target.value)}
                        className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-surface p-1"
                      />
                      <Input type="text" value={colorPrimario} onChange={(e) => setColorPrimario(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>Color secundario</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={colorSecundario}
                        onChange={(e) => setColorSecundario(e.target.value)}
                        className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-surface p-1"
                      />
                      <Input type="text" value={colorSecundario} onChange={(e) => setColorSecundario(e.target.value)} />
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <h2 className="mb-4 text-sm font-semibold text-foreground">Textos</h2>
                <div className="flex flex-col gap-4">
                  <div>
                    <Label>Texto de encabezado</Label>
                    <Input type="text" value={textoEncabezado} onChange={(e) => setTextoEncabezado(e.target.value)} />
                  </div>
                  <div>
                    <Label>Texto de pie de página</Label>
                    <Input type="text" value={textoPie} onChange={(e) => setTextoPie(e.target.value)} />
                  </div>
                  <div>
                    <Label>Mensaje predeterminado</Label>
                    <Textarea rows={3} value={mensajePredeterminado} onChange={(e) => setMensajePredeterminado(e.target.value)} />
                  </div>
                  <div>
                    <Label>Términos y condiciones</Label>
                    <Textarea rows={4} value={terminosCondiciones} onChange={(e) => setTerminosCondiciones(e.target.value)} />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={mostrarFirma} onChange={(e) => setMostrarFirma(e.target.checked)} className="accent-brand" />
                    Mostrar campo de firma
                  </label>
                </div>
              </Card>

              {error && <ErrorText>{error}</ErrorText>}
              {aviso && <SuccessText>{aviso}</SuccessText>}
              <div className="flex gap-3">
                <Button type="button" onClick={onGuardar} disabled={guardando}>
                  {guardando ? "Guardando…" : "Guardar plantilla"}
                </Button>
                <Button type="button" variant="outline" onClick={onRestaurar} disabled={restaurando}>
                  {restaurando ? "Restaurando…" : "Restaurar predeterminado"}
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Vista previa en vivo</p>
              <div className="rounded-2xl border border-border bg-white p-5 text-[#16161f] shadow-sm">
                {mostrarLogo && (
                  <div className={`mb-3 flex ${justify}`}>
                    {usuario.empresa.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={usuario.empresa.logo_url} alt="" className="h-10 w-10 rounded object-cover" />
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
                {textoEncabezado && <p className="mt-1 text-xs text-gray-500">{textoEncabezado}</p>}

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

                {mensajePredeterminado && <p className="mt-4 text-xs text-gray-600">{mensajePredeterminado}</p>}
                {terminosCondiciones && (
                  <div className="mt-4 rounded-lg bg-gray-50 p-2.5 text-[10px] leading-relaxed text-gray-500">{terminosCondiciones}</div>
                )}

                {mostrarFirma && (
                  <div className="mt-6 border-t pt-3 text-center text-[10px] text-gray-400" style={{ borderColor: "#e6e6ee" }}>
                    ___________________________
                    <br />
                    Firma
                  </div>
                )}
                {textoPie && <p className="mt-4 text-center text-[10px] text-gray-400">{textoPie}</p>}
              </div>
              <p className="mt-2 text-xs text-muted">Así se ve con los cambios sin guardar todavía.</p>
            </div>
          </div>
        )
      )}
    </div>
  );
}
