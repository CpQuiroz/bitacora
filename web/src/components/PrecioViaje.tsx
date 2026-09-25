"use client";

import { useState } from "react";
import type { ModoPrecioViaje, TramoPrecio } from "@bitacora/shared";
import { Button, Select } from "@bitacora/ui/web";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { Combobox, type ComboboxOpcion } from "@/components/Combobox";

// Forma de cobro de un viaje (tarea 135): monto fijo, por tramos (origen →
// paradas → destino con Viajes › Tarifas) o por km (km del mapa o a mano ×
// precio por km). Propone el monto y lo pone en el campo "Monto del viaje";
// el Admin puede ajustarlo. Solo lo ven Admin y Supervisor.
type Props = {
  modo: ModoPrecioViaje;
  onModo: (m: ModoPrecioViaje) => void;
  origen: string;
  destino: string;
  paradas: string[];
  onParadas: (p: string[]) => void;
  km: string;
  onKm: (km: string) => void;
  clienteId: string;
  onMontoPropuesto: (monto: string) => void;
  opcionesCiudad: ComboboxOpcion[];
  onCiudadLibre: (texto: string) => void;
  moneda?: string;
};

export function PrecioViaje({ modo, onModo, origen, destino, paradas, onParadas, km, onKm, clienteId, onMontoPropuesto, opcionesCiudad, onCiudadLibre, moneda }: Props) {
  const [tramos, setTramos] = useState<TramoPrecio[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calculando, setCalculando] = useState<"precio" | "km" | null>(null);

  const recorrido = [origen, ...paradas, destino].map((p) => p.trim()).filter(Boolean);

  async function calcularKm() {
    setError(null);
    setAviso(null);
    if (!origen || !destino) return setError("Primero elige origen y destino");
    setCalculando("km");
    const res = await apiFetch("/api/viajes/tarifas/distancia", { method: "POST", body: JSON.stringify({ paradas: recorrido }) });
    setCalculando(null);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? "No se pudieron calcular los km");
    onKm(String(body.km));
    await calcularPrecio("km", String(body.km));
  }

  async function calcularPrecio(m: ModoPrecioViaje = modo, kmUsar: string = km) {
    setError(null);
    setAviso(null);
    if (!origen || !destino) return setError("Primero elige origen y destino");
    setCalculando("precio");
    const res = await apiFetch("/api/viajes/tarifas/calcular", {
      method: "POST",
      body: JSON.stringify(m === "tramos" ? { modo: m, paradas: recorrido, cliente_id: clienteId || null } : { modo: m, km: kmUsar, cliente_id: clienteId || null }),
    });
    setCalculando(null);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? "No se pudo calcular el precio");
    onMontoPropuesto(String(body.subtotal));
    if (m === "tramos") {
      setTramos(body.tramos);
      setAviso(
        body.faltantes.length
          ? `Faltan tarifas para: ${body.faltantes.map((f: { origen: string; destino: string }) => `${f.origen} ↔ ${f.destino}`).join(", ")}. Agrégalas en Viajes › Tarifas o ajusta el monto.`
          : `Monto propuesto: ${formatMoneda(body.subtotal, moneda)}. Puedes ajustarlo.`
      );
    } else {
      setTramos(null);
      setAviso(`${body.km} km × ${formatMoneda(body.precio_km, moneda)} = ${formatMoneda(body.subtotal, moneda)}. Puedes ajustarlo.`);
    }
  }

  return (
    <div className="flex flex-col gap-ds-3 rounded-ds-md border border-ds-divider p-ds-4 sm:col-span-2 lg:col-span-3">
      <div className="flex flex-wrap items-end gap-ds-3">
        <div className="w-56">
          <Select
            etiqueta="Forma de cobro"
            valor={modo}
            onCambio={(v) => {
              setTramos(null);
              setAviso(null);
              setError(null);
              onModo(v as ModoPrecioViaje);
            }}
            opciones={[
              { valor: "fijo", etiqueta: "Monto fijo" },
              { valor: "tramos", etiqueta: "Por tramos" },
              { valor: "km", etiqueta: "Por km" },
            ]}
          />
        </div>
        {modo === "km" ? (
          <>
            <div className="flex w-36 flex-col gap-ds-1">
              <label htmlFor="precio-viaje-km" className="font-ds-body text-ds-caption font-medium text-ds-text/70">
                Kilómetros
              </label>
              <input
                id="precio-viaje-km"
                inputMode="decimal"
                value={km}
                onChange={(e) => onKm(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))}
                className="h-11 rounded-ds-pill border border-ds-divider bg-ds-surface px-ds-4 font-ds-body text-ds-body text-ds-text tabular-nums"
              />
            </div>
            <Button variante="secundario" onPress={() => void calcularKm()} cargando={calculando === "km"}>
              Calcular km con el mapa
            </Button>
          </>
        ) : null}
        {modo !== "fijo" ? (
          <Button variante="secundario" onPress={() => void calcularPrecio()} cargando={calculando === "precio"}>
            Calcular precio
          </Button>
        ) : null}
      </div>

      {modo !== "fijo" ? (
        <div className="flex flex-col gap-ds-2">
          <p className="font-ds-body text-ds-caption text-ds-text/60">
            Recorrido: {recorrido.length ? recorrido.join(" → ") : "elige origen y destino arriba"}
          </p>
          {paradas.map((p, i) => (
            <div key={i} className="flex flex-wrap items-end gap-ds-2">
              <div className="min-w-[200px] flex-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Parada {i + 1}</label>
                <Combobox
                  value={p}
                  onChange={(v) => onParadas(paradas.map((x, j) => (j === i ? v : x)))}
                  opciones={opcionesCiudad}
                  placeholder="Ciudad intermedia"
                  etiquetaCrear={(t) => `Usar "${t}"`}
                  onCrear={(t) => {
                    onCiudadLibre(t);
                    onParadas(paradas.map((x, j) => (j === i ? t : x)));
                  }}
                />
              </div>
              <button type="button" onClick={() => onParadas(paradas.filter((_, j) => j !== i))} className="pb-3 font-ds-body text-ds-caption font-medium text-ds-accent-700 hover:underline">
                Quitar
              </button>
            </div>
          ))}
          {paradas.length < 8 ? (
            <button type="button" onClick={() => onParadas([...paradas, ""])} className="self-start font-ds-body text-ds-caption font-medium text-ds-brand hover:underline">
              + Agregar parada intermedia
            </button>
          ) : null}
        </div>
      ) : null}

      {tramos && tramos.length ? (
        <ul className="flex flex-col gap-ds-1 font-ds-body text-ds-small text-ds-text">
          {tramos.map((t, i) => (
            <li key={i} className="flex justify-between gap-ds-3">
              <span>
                {t.origen} → {t.destino}
              </span>
              <span className={`tabular-nums ${t.precio === null ? "text-ds-accent-700" : ""}`}>{t.precio === null ? "sin tarifa" : formatMoneda(t.precio, moneda)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {aviso ? <p className="font-ds-body text-ds-small text-ds-text/70">{aviso}</p> : null}
      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
    </div>
  );
}
