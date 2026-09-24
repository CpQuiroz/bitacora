"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Modulo, Plan } from "@bitacora/shared";
import { ETIQUETA_PLAN, GRUPOS_MODULOS } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { avisarModulosCambiados } from "@/lib/eventosModulos";
import { ETIQUETA_MODULO } from "@/lib/etiquetasModulo";
import { Button, Card, Textarea } from "@bitacora/ui/web";
import { useConfiguracion } from "../ConfiguracionContext";

type EstadoModulos = {
  plan: Plan;
  modulosMax: number | null;
  activos: number;
  modulos: { modulo: Modulo; activado: boolean }[];
};

// Configuración › Módulos (tarea 124, etapa 3). El plan fija CUÁNTAS
// secciones puede tener activas la empresa; acá el Admin elige cuáles.
// El tope lo hace cumplir el backend (403 LIMITE_PLAN); la pantalla
// solo evita ofrecer lo que no cabe. La IA y la configuración base no
// cuentan y no se tocan desde acá.
export default function ModulosPage() {
  const { recargar } = useConfiguracion();
  const [estado, setEstado] = useState<EstadoModulos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<Modulo | null>(null);
  const [solicitudAbierta, setSolicitudAbierta] = useState(false);
  const [pedidos, setPedidos] = useState<Modulo[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorSolicitud, setErrorSolicitud] = useState<string | null>(null);
  const [solicitudEnviada, setSolicitudEnviada] = useState(false);

  const cargar = useCallback(async () => {
    const res = await apiFetch("/api/modulos");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "No se pudieron cargar los módulos");
      return;
    }
    setEstado(body);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function cambiar(modulo: Modulo, activado: boolean) {
    setError(null);
    setGuardando(modulo);
    const res = await apiFetch("/api/modulos", { method: "PATCH", body: JSON.stringify({ modulo, activado }) });
    const body = await res.json().catch(() => ({}));
    setGuardando(null);
    if (!res.ok) {
      setError(body.error ?? "No se pudo cambiar el módulo");
      return;
    }
    setEstado(body);
    // El menú lateral y el de Configuración se actualizan sin recargar.
    avisarModulosCambiados();
    void recargar();
  }

  async function enviarSolicitud() {
    setErrorSolicitud(null);
    setEnviando(true);
    const res = await apiFetch("/api/modulos/solicitar", { method: "POST", body: JSON.stringify({ modulos: pedidos, mensaje }) });
    const body = await res.json().catch(() => ({}));
    setEnviando(false);
    if (!res.ok) {
      setErrorSolicitud(body.error ?? "No pudimos enviar tu solicitud");
      return;
    }
    setSolicitudEnviada(true);
  }

  if (!estado) {
    return (
      <div className="flex flex-col gap-ds-2">
        <p className="ds-heading text-ds-h3 text-ds-text">Módulos</p>
        <p className="font-ds-body text-ds-small text-ds-text/70">{error ?? "Cargando…"}</p>
      </div>
    );
  }

  const activado = new Map(estado.modulos.map((m) => [m.modulo, m.activado]));
  const lleno = estado.modulosMax != null && estado.activos >= estado.modulosMax;
  const inactivos = estado.modulos.filter((m) => !m.activado).map((m) => m.modulo);
  const gruposQueCuentan = GRUPOS_MODULOS.filter((g) => g.cuenta);

  return (
    <div className="flex flex-col gap-ds-6">
      <div>
        <p className="ds-heading text-ds-h3 text-ds-text">Módulos</p>
        <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
          Elige qué secciones usa tu empresa. Apagar una la oculta del menú para todo el equipo; tus datos no se borran.
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-ds-3">
          <div>
            <p className="font-ds-body text-ds-small font-semibold text-ds-text">
              Plan {ETIQUETA_PLAN[estado.plan]}
            </p>
            <p className="mt-ds-1 font-ds-body text-ds-small tabular-nums text-ds-text/70">
              {estado.modulosMax != null
                ? `${estado.activos} de ${estado.modulosMax} módulos activos`
                : `${estado.activos} módulos activos · tu plan no tiene tope`}
            </p>
          </div>
          {estado.modulosMax != null ? (
            <div className="flex flex-wrap gap-ds-2">
              <Link
                href="/dashboard/configuracion/plan"
                className="rounded-ds-pill border border-ds-divider px-ds-3 py-1 font-ds-body text-ds-caption font-medium text-ds-text hover:bg-ds-brand/[0.08]"
              >
                Subir de plan
              </Link>
              <Button variante="ghost" tamano="sm" onPress={() => setSolicitudAbierta((v) => !v)}>
                Solicitar más módulos
              </Button>
            </div>
          ) : null}
        </div>
        {lleno ? (
          <p className="mt-ds-3 font-ds-body text-ds-small text-ds-accent-700">
            Llegaste al tope de tu plan. Para activar otro módulo, apaga uno, sube de plan o solicítalo.
          </p>
        ) : null}
      </Card>

      {solicitudAbierta ? (
        <Card>
          <p className="font-ds-body text-ds-small font-semibold text-ds-text">Solicitar más módulos</p>
          {solicitudEnviada ? (
            <p className="mt-ds-3 font-ds-body text-ds-small font-medium text-ds-accent2-800">
              Recibimos tu solicitud. Te escribimos al correo de tu cuenta.
            </p>
          ) : (
            <div className="mt-ds-3 flex flex-col gap-ds-3">
              {inactivos.length > 0 ? (
                <div className="grid gap-ds-2 sm:grid-cols-2">
                  {inactivos.map((m) => (
                    <label key={m} className="flex cursor-pointer items-center gap-2 font-ds-body text-ds-small text-ds-text">
                      <input
                        type="checkbox"
                        checked={pedidos.includes(m)}
                        onChange={(e) => setPedidos((p) => (e.target.checked ? [...p, m] : p.filter((x) => x !== m)))}
                        className="accent-ds-brand"
                      />
                      {ETIQUETA_MODULO[m] ?? m}
                    </label>
                  ))}
                </div>
              ) : null}
              <Textarea
                etiqueta="Cuéntanos qué necesitas (opcional)"
                filas={3}
                valor={mensaje}
                onCambio={setMensaje}
                placeholder="Ej.: necesitamos Flota para controlar las mantenciones de 4 camiones."
              />
              {errorSolicitud ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorSolicitud}</p> : null}
              <div>
                <Button onPress={enviarSolicitud} cargando={enviando} deshabilitado={pedidos.length === 0 && !mensaje.trim()}>
                  Enviar solicitud
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}

      <Card>
        <div className="flex flex-col gap-ds-5">
          {gruposQueCuentan.map((g) => (
            <section key={g.titulo}>
              <p className="mb-ds-2 font-ds-body text-ds-caption font-semibold uppercase tracking-wide text-ds-text/70">{g.titulo}</p>
              <div className="grid gap-ds-2 sm:grid-cols-2">
                {g.modulos.map((modulo) => {
                  const on = activado.get(modulo) ?? false;
                  const bloqueado = !on && lleno;
                  return (
                    <label
                      key={modulo}
                      className={`flex items-center gap-ds-2 rounded-ds-md border border-ds-divider px-ds-3 py-ds-2 font-ds-body text-ds-small text-ds-text ${
                        bloqueado ? "opacity-60" : "cursor-pointer"
                      }`}
                      title={bloqueado ? "Llegaste al tope de módulos de tu plan" : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={guardando !== null || bloqueado}
                        onChange={(e) => void cambiar(modulo, e.target.checked)}
                        className="accent-ds-brand"
                      />
                      <span>{ETIQUETA_MODULO[modulo] ?? modulo}</span>
                      {guardando === modulo ? <span className="text-ds-caption text-ds-text/50">Guardando…</span> : null}
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <p className="mt-ds-5 font-ds-body text-ds-caption text-ds-text/60">
          El informe con IA, el asistente y la configuración de la cuenta no cuentan para el tope: dependen de tu plan.
        </p>
      </Card>
    </div>
  );
}
