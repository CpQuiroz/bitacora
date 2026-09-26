"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConfigViaticos } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card } from "@bitacora/ui/web";
import { InputMonto } from "@/components/InputMonto";
import { useConfiguracion } from "../ConfiguracionContext";

// Configuración › Viajes (tarea 137): montos por defecto del viático del
// chofer. Se precargan al elegir el tipo en un viaje (se pueden cambiar
// en cada viaje). Solo el Admin los guarda (el backend lo exige).
export default function ConfigViajesPage() {
  const { usuario } = useConfiguracion();
  const esAdmin = usuario.rol === "admin";
  const [local, setLocal] = useState("");
  const [interregional, setInterregional] = useState("");
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const aTexto = (v: number | null) => (v != null ? String(Math.round(Number(v))) : "");

  const cargar = useCallback(async () => {
    setError(null);
    const res = await apiFetch("/api/viajes/config");
    if (!res.ok) {
      setError("No se pudo cargar la configuración de viajes");
      return;
    }
    const c: ConfigViaticos = await res.json();
    setLocal(aTexto(c.viatico_local_monto));
    setInterregional(aTexto(c.viatico_interregional_monto));
    setCargado(true);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar() {
    setError(null);
    setAviso(null);
    setGuardando(true);
    const res = await apiFetch("/api/viajes/config", {
      method: "PATCH",
      body: JSON.stringify({ viatico_local_monto: local || null, viatico_interregional_monto: interregional || null }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar");
      return;
    }
    setAviso("Montos guardados.");
  }

  return (
    <div className="flex flex-col gap-ds-5">
      <div>
        <p className="ds-heading text-ds-h3 text-ds-text">Viajes</p>
        <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
          Viático del chofer por viaje. Se registra como gasto “Viáticos” y no aparece en el cobro al cliente.
        </p>
      </div>
      <Card>
        <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Montos por defecto del viático</p>
        {!cargado && !error ? <p className="font-ds-body text-ds-small text-ds-text-secondary">Cargando…</p> : null}
        {cargado ? (
          <div className="grid gap-ds-4 sm:grid-cols-2">
            <div className="flex flex-col gap-ds-1">
              <label htmlFor="viatico-local" className="font-ds-body text-ds-caption font-medium text-ds-text/70">Viático local (origen y destino en la Región Metropolitana)</label>
              <InputMonto id="viatico-local" value={local} onChange={setLocal} moneda={usuario.empresa.moneda ?? undefined} disabled={!esAdmin} />
            </div>
            <div className="flex flex-col gap-ds-1">
              <label htmlFor="viatico-interregional" className="font-ds-body text-ds-caption font-medium text-ds-text/70">Viático interregional (sale de la Región Metropolitana)</label>
              <InputMonto id="viatico-interregional" value={interregional} onChange={setInterregional} moneda={usuario.empresa.moneda ?? undefined} disabled={!esAdmin} />
            </div>
          </div>
        ) : null}
        {error ? <p className="mt-ds-3 font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
        {aviso ? <p className="mt-ds-3 font-ds-body text-ds-small text-ds-text/70">{aviso}</p> : null}
        {cargado && esAdmin ? (
          <div className="mt-ds-4">
            <Button onPress={guardar} cargando={guardando}>
              Guardar
            </Button>
          </div>
        ) : null}
        {cargado && !esAdmin ? <p className="mt-ds-3 font-ds-body text-ds-caption text-ds-text-secondary">Solo el administrador puede cambiar estos montos.</p> : null}
      </Card>
    </div>
  );
}
