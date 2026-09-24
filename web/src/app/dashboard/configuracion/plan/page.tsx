"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, CreditCard } from "lucide-react";
import type { EmpresaPlanHistorial, Modulo, PackRubro, Plan, PlanPago, Suscripcion, SuscripcionCobro } from "@bitacora/shared";
import { ETIQUETA_PACK, ETIQUETA_PLAN, LIMITES_POR_PLAN, PACKS, PACKS_RUBRO, PLANES_PAGO, PRECIO_PLAN_UF, modulosDelPlan } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, Input, StatusBadge, Table, Textarea, type TonoEstado } from "@bitacora/ui/web";
import { ETIQUETA_MODULO } from "@/lib/etiquetasModulo";
import { useConfiguracion } from "../ConfiguracionContext";

// Lo que traen todos los planes (tarea 124). Los topes de usuarios y
// OS van en cada tarjeta — antes esta lista decía "OS ilimitadas" aunque
// el plan de entrada tiene tope.
const INCLUIDO_EN_TODOS = [
  "Clientes y cotizaciones ilimitados",
  "App móvil para técnicos, también sin señal",
  "Órdenes de servicio con firma y PDF",
  "Fotos de la OS guardadas como evidencia",
  "Exportación a PDF",
  "Soporte por correo",
];

// Qué muestra cada tarjeta, en palabras del cliente (los módulos reales
// los define modulosDelPlan en packages/shared/src/planes.ts).
const DESTACADOS: Record<PlanPago, string[]> = {
  basico: ["Agenda", "Órdenes de servicio", "Cotizaciones y cobros", "Gastos y rendiciones", "Informes"],
  operacion: ["Todo lo de Esencial", "Un pack de rubro a elección", `Informe con IA (${LIMITES_POR_PLAN.operacion.informesIAPorMes} al mes)`],
  pro: ["Todo lo de Operación", "Los 3 packs de rubro", "Informe con IA sin tope", "Asistente", "Análisis de fotos con IA"],
  empresa: ["Todo lo de Pro", "Implementación y capacitación", "Soporte prioritario", "Precio a convenir según tamaño"],
};

const uf = (n: number) => `${n.toLocaleString("es-CL")} UF`;
const clp = (n: number) => `$${n.toLocaleString("es-CL")}`;

const ETIQUETA_ESTADO: Record<string, string> = {
  trial: "En prueba",
  activa: "Activa",
  pago_pendiente: "Pago pendiente",
  suspendida_por_pago: "Suspendida por falta de pago",
  cancelada: "Cancelada",
};

// StatusBadge solo expone 4 tonos (en_progreso/completado/cerrado/
// cancelado) — no hay un tono "peligro" propio, así que "suspendida" /
// "fallido" caen en el gris de "cancelado" (lo más parecido disponible).
const TONO_SUSCRIPCION: Record<string, TonoEstado> = {
  trial: "en_progreso",
  activa: "completado",
  pago_pendiente: "en_progreso",
  suspendida_por_pago: "cancelado",
  cancelada: "cancelado",
  exitoso: "completado",
  fallido: "cancelado",
  pendiente: "en_progreso",
};


function diasRestantes(fechaTermino: string | null): number | null {
  if (!fechaTermino) return null;
  const hoy = new Date();
  const termino = new Date(`${fechaTermino}T00:00:00`);
  return Math.ceil((termino.getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86_400_000);
}

type InfoPlan = {
  planActual: Plan;
  packRubro: PackRubro | null;
  packSugerido: PackRubro;
  trialVencido: boolean;
  contratables: Record<PlanPago, boolean>;
  historial: EmpresaPlanHistorial[];
};

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
function PlanContenido() {
  const { usuario } = useConfiguracion();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dias = diasRestantes(usuario.empresa.prueba_termina_en);

  const [suscripcion, setSuscripcion] = useState<Suscripcion | null>(null);
  const [cobros, setCobros] = useState<SuscripcionCobro[]>([]);
  const [info, setInfo] = useState<InfoPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargandoTarjeta, setCargandoTarjeta] = useState(false);
  const [confirmandoRetorno, setConfirmandoRetorno] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cambiandoPlan, setCambiandoPlan] = useState<PlanPago | null>(null);
  // Plan al que se quiere bajar, esperando confirmación (pierde módulos).
  const [confirmandoBajarA, setConfirmandoBajarA] = useState<PlanPago | null>(null);
  const [errorPlan, setErrorPlan] = useState<string | null>(null);
  const [pack, setPack] = useState<PackRubro>("transporte");
  const [cotizacionAbierta, setCotizacionAbierta] = useState(false);
  const [usuariosCotizacion, setUsuariosCotizacion] = useState("");
  const [mensajeCotizacion, setMensajeCotizacion] = useState("");
  const [enviandoCotizacion, setEnviandoCotizacion] = useState(false);
  const [errorCotizacion, setErrorCotizacion] = useState<string | null>(null);
  const [cotizacionEnviada, setCotizacionEnviada] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    const res = await apiFetch("/api/suscripcion");
    if (!res.ok) {
      setError("No se pudo cargar tu suscripción");
      return;
    }
    const body = await res.json();
    setSuscripcion(body.suscripcion);
    setCobros(body.cobros ?? []);
  }, []);

  const cargarPlan = useCallback(async () => {
    const res = await apiFetch("/api/plan");
    if (res.ok) {
      const body: InfoPlan = await res.json();
      setInfo(body);
      setPack(body.packRubro ?? body.packSugerido);
    }
  }, []);

  useEffect(() => {
    cargar();
    cargarPlan();
  }, [cargar, cargarPlan]);

  // Flow/Transbank vuelven acá con ?token=... tras registrar la tarjeta.
  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) return;
    setConfirmandoRetorno(true);
    (async () => {
      const res = await apiFetch("/api/suscripcion/tarjeta/confirmar", { method: "POST", body: JSON.stringify({ token }) });
      setConfirmandoRetorno(false);
      if (res.ok) {
        setAviso("Tu tarjeta quedó registrada.");
        cargar();
        cargarPlan();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No se pudo confirmar el registro de tu tarjeta");
      }
      router.replace("/dashboard/configuracion/plan");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function onAgregarTarjeta() {
    setError(null);
    setCargandoTarjeta(true);
    const res = await apiFetch("/api/suscripcion/tarjeta", { method: "POST" });
    setCargandoTarjeta(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo iniciar el registro de tu tarjeta");
      return;
    }
    const body = await res.json();
    window.location.href = body.url;
  }

  // Módulos que se pierden al pasar del plan actual a `plan`.
  function modulosQueSePierden(plan: PlanPago): Modulo[] {
    if (!info) return [];
    const nuevos = new Set(modulosDelPlan(plan, pack));
    return modulosDelPlan(info.planActual, info.packRubro).filter((m) => !nuevos.has(m));
  }

  async function onCambiarPlan(plan: PlanPago) {
    if (modulosQueSePierden(plan).length > 0 && confirmandoBajarA !== plan) {
      setConfirmandoBajarA(plan);
      return;
    }
    setErrorPlan(null);
    setCambiandoPlan(plan);
    const cuerpo = JSON.stringify({ plan, ...(plan === "operacion" ? { pack } : {}) });
    const res = await apiFetch("/api/plan/cambiar", { method: "POST", body: cuerpo });
    if (!res.ok) {
      setCambiandoPlan(null);
      const body = await res.json().catch(() => ({}));
      setErrorPlan(body.error ?? "No se pudo cambiar de plan");
      return;
    }
    const body = await res.json();
    if (body.requiereTarjeta) {
      const resTarjeta = await apiFetch("/api/suscripcion/tarjeta", { method: "POST", body: cuerpo });
      setCambiandoPlan(null);
      if (!resTarjeta.ok) {
        const errBody = await resTarjeta.json().catch(() => ({}));
        setErrorPlan(errBody.error ?? "No se pudo iniciar el registro de tu tarjeta");
        return;
      }
      const { url } = await resTarjeta.json();
      window.location.assign(url);
      return;
    }
    setCambiandoPlan(null);
    setConfirmandoBajarA(null);
    setAviso(
      plan === "operacion" && info?.planActual === "operacion"
        ? `Tu pack quedó en ${ETIQUETA_PACK[pack]}.`
        : `Tu plan quedó en ${ETIQUETA_PLAN[plan]}.`
    );
    cargar();
    cargarPlan();
  }

  async function onPedirCotizacion() {
    setErrorCotizacion(null);
    setEnviandoCotizacion(true);
    const usuarios = Number.parseInt(usuariosCotizacion, 10);
    const res = await apiFetch("/api/plan/cotizar-empresa", {
      method: "POST",
      body: JSON.stringify({ mensaje: mensajeCotizacion, ...(Number.isFinite(usuarios) ? { usuarios } : {}) }),
    });
    setEnviandoCotizacion(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorCotizacion(body.error ?? "No pudimos enviar tu solicitud");
      return;
    }
    setCotizacionEnviada(true);
  }

  async function onCancelar() {
    setError(null);
    setCancelando(true);
    const res = await apiFetch("/api/suscripcion/cancelar", { method: "POST" });
    setCancelando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo cancelar la suscripción");
      return;
    }
    setConfirmandoCancelar(false);
    setAviso("Tu suscripción fue cancelada.");
    cargar();
  }

  const tieneTarjeta = Boolean(suscripcion?.tarjeta_ultimos4);
  const estaSuspendidaOFallida = suscripcion?.estado === "suspendida_por_pago" || suscripcion?.estado === "pago_pendiente";

  return (
    <div className="flex flex-col gap-ds-6">
      <div>
        <p className="ds-heading text-ds-h3 text-ds-text">Plan</p>
        <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Tu suscripción y método de pago</p>
      </div>

      {info?.trialVencido && (
        <div className="rounded-ds-md border border-ds-accent-700 bg-ds-accent-100 p-ds-4">
          <p className="font-ds-body text-ds-small font-semibold text-ds-accent-700">Tu período de prueba terminó</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text">
            El resto de Bitácora queda bloqueado hasta que elijas un plan — tus datos siguen intactos, solo tienes que
            elegir un plan abajo para seguir.
          </p>
        </div>
      )}

      {confirmandoRetorno && (
        <div className="rounded-ds-md border border-ds-brand/40 bg-ds-brand/[0.08] p-ds-4">
          <p className="font-ds-body text-ds-small text-ds-brand">Confirmando el registro de tu tarjeta con Flow…</p>
        </div>
      )}

      {suscripcion?.estado === "trial" && (
        <div className="rounded-ds-md border border-ds-brand/40 bg-ds-brand/[0.08] p-ds-4">
          <p className="font-ds-body text-ds-small font-semibold text-ds-brand">Período de prueba</p>
          <p className="mt-ds-1 text-2xl font-bold text-ds-text">
            {dias != null && dias >= 0 ? `${dias} ${dias === 1 ? "día restante" : "días restantes"}` : "Tu prueba terminó"}
          </p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
            {tieneTarjeta
              ? "Ya registraste tu tarjeta — el primer cobro se hará automáticamente al terminar la prueba."
              : "Elige un plan abajo para que la suscripción siga activa sin interrupciones al terminar la prueba."}
          </p>
        </div>
      )}

      {suscripcion?.estado === "activa" && (
        <div className="rounded-ds-md border border-ds-accent2-700 bg-ds-accent2-100 p-ds-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-ds-body text-ds-small font-semibold text-ds-accent2-800">Suscripción activa</p>
              {suscripcion.proxima_fecha_cobro && (
                <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text">
                  Próximo cobro: {new Date(`${suscripcion.proxima_fecha_cobro}T00:00:00`).toLocaleDateString("es-CL")}
                </p>
              )}
            </div>
            <StatusBadge estado={suscripcion.estado} etiqueta={ETIQUETA_ESTADO[suscripcion.estado]} tonoForzado={TONO_SUSCRIPCION[suscripcion.estado]} />
          </div>
        </div>
      )}

      {estaSuspendidaOFallida && (
        <div className="rounded-ds-md border border-ds-accent-700 bg-ds-accent-100 p-ds-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-ds-body text-ds-small font-semibold text-ds-accent-700">{ETIQUETA_ESTADO[suscripcion!.estado]}</p>
              <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text">
                {suscripcion?.estado === "suspendida_por_pago"
                  ? "Tu cuenta quedó suspendida tras varios intentos de cobro fallidos. Actualiza tu tarjeta para reactivarla."
                  : "No pudimos procesar tu último cobro — vamos a reintentar automáticamente. Si tu tarjeta cambió, actualízala."}
              </p>
            </div>
            <StatusBadge estado={suscripcion!.estado} etiqueta={ETIQUETA_ESTADO[suscripcion!.estado]} tonoForzado={TONO_SUSCRIPCION[suscripcion!.estado]} />
          </div>
        </div>
      )}

      {suscripcion?.estado === "cancelada" && (
        <Card>
          <p className="font-ds-body text-ds-small font-semibold text-ds-text">Suscripción cancelada</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
            {suscripcion.cancelada_en && `Cancelada el ${new Date(suscripcion.cancelada_en).toLocaleDateString("es-CL")}.`} Tus datos se
            conservan — contáctanos si quieres reactivarla.
          </p>
        </Card>
      )}

      <Card>
        <div className="mb-ds-4">
          <p className="font-ds-body text-ds-small font-semibold text-ds-text">Tu plan</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
            Plan actual:{" "}
            <span className="font-medium text-ds-text">
              {info ? ETIQUETA_PLAN[info.planActual] : "—"}
              {info?.planActual === "operacion" && info.packRubro ? ` · pack ${ETIQUETA_PACK[info.packRubro]}` : ""}
            </span>
          </p>
          <p className="mt-ds-1 font-ds-body text-ds-caption text-ds-text/60">Precios mensuales en UF, más IVA. Se cobran en pesos al valor de la UF del día.</p>
        </div>

        {errorPlan ? <p className="mb-ds-4 font-ds-body text-ds-small text-ds-accent-700">{errorPlan}</p> : null}

        <div className="grid gap-ds-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLANES_PAGO.map((plan) => {
            const esActual = info?.planActual === plan;
            const destacado = plan === "operacion";
            const limites = LIMITES_POR_PLAN[plan];
            const contratable = info?.contratables[plan] ?? false;
            return (
              <div
                key={plan}
                className={`flex flex-col gap-ds-3 rounded-ds-lg border p-ds-4 ${destacado ? "border-ds-brand/40 bg-ds-brand/[0.08]" : "border-ds-divider"}`}
              >
                <p className={`font-ds-body text-ds-small font-semibold ${destacado ? "text-ds-brand" : "text-ds-text"}`}>{ETIQUETA_PLAN[plan]}</p>
                <p className="text-2xl font-bold tabular-nums text-ds-text">
                  {plan === "empresa" ? <span className="font-ds-body text-ds-small font-normal text-ds-text/70">desde </span> : null}
                  {uf(PRECIO_PLAN_UF[plan])}
                  <span className="font-ds-body text-ds-small font-normal text-ds-text/70"> + IVA / mes</span>
                </p>
                <p className="font-ds-body text-ds-caption tabular-nums text-ds-text/70">
                  Hasta {limites.usuarios} usuarios · {limites.osPorMes == null ? "OS ilimitadas" : `${limites.osPorMes} OS al mes`}
                </p>
                <ul className="flex flex-col gap-ds-2 font-ds-body text-ds-small text-ds-text">
                  {DESTACADOS[plan].map((d) => (
                    <li key={d} className="flex items-start gap-2">
                      <Check size={16} strokeWidth={2.75} className="mt-0.5 shrink-0 text-ds-accent2-800" />
                      {d}
                    </li>
                  ))}
                </ul>

                {plan === "operacion" ? (
                  <fieldset className="flex flex-col gap-ds-2">
                    <legend className="mb-ds-1 font-ds-body text-ds-caption font-semibold text-ds-text">Pack de rubro</legend>
                    {PACKS.map((p) => (
                      <label key={p} className="flex cursor-pointer items-start gap-2 font-ds-body text-ds-caption text-ds-text">
                        <input
                          type="radio"
                          name="pack-rubro"
                          value={p}
                          checked={pack === p}
                          onChange={() => setPack(p)}
                          className="mt-0.5 accent-ds-brand"
                        />
                        <span>
                          <span className="font-semibold">{ETIQUETA_PACK[p]}</span>
                          <span className="block text-ds-text/60">{PACKS_RUBRO[p].map((m) => ETIQUETA_MODULO[m] ?? m).join(", ")}</span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                ) : null}

                <div className="mt-auto flex flex-col gap-ds-2 pt-ds-2">
                  {esActual && !(plan === "operacion" && info?.packRubro !== pack) ? (
                    <p className="font-ds-body text-ds-caption font-medium text-ds-text/60">Tu plan actual</p>
                  ) : esActual ? (
                    <Button bloque variante="secundario" deshabilitado={cambiandoPlan !== null} cargando={cambiandoPlan === plan} onPress={() => onCambiarPlan(plan)}>
                      Cambiar a pack {ETIQUETA_PACK[pack]}
                    </Button>
                  ) : contratable ? (
                    <Button
                      bloque
                      variante={destacado ? "primario" : "secundario"}
                      deshabilitado={cambiandoPlan !== null}
                      cargando={cambiandoPlan === plan}
                      onPress={() => onCambiarPlan(plan)}
                    >
                      {plan === "empresa" ? "Contratar con tarjeta" : `Cambiar a ${ETIQUETA_PLAN[plan]}`}
                    </Button>
                  ) : plan !== "empresa" ? (
                    <p className="font-ds-body text-ds-caption text-ds-text/60">Disponible pronto — escríbenos si te interesa.</p>
                  ) : null}
                  {plan === "empresa" && !esActual ? (
                    <Button bloque variante="ghost" onPress={() => setCotizacionAbierta((v) => !v)}>
                      Pedir cotización
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {confirmandoBajarA && (
          <div className="mt-ds-4 rounded-ds-lg border border-ds-accent-700 bg-ds-accent-100 p-ds-4">
            <p className="font-ds-body text-ds-small font-semibold text-ds-accent-700">
              Al pasar a {ETIQUETA_PLAN[confirmandoBajarA]}
              {confirmandoBajarA === "operacion" ? ` (pack ${ETIQUETA_PACK[pack]})` : ""} vas a perder acceso a:
            </p>
            <ul className="mt-ds-2 flex flex-col gap-1 font-ds-body text-ds-small text-ds-text">
              {modulosQueSePierden(confirmandoBajarA).map((m) => (
                <li key={m}>• {ETIQUETA_MODULO[m] ?? m}</li>
              ))}
            </ul>
            <p className="mt-ds-2 font-ds-body text-ds-caption text-ds-text/70">Tus datos no se borran: vuelven a verse si cambias de nuevo de plan.</p>
            <div className="mt-ds-3 flex flex-wrap gap-ds-2">
              <Button
                variante="peligro"
                deshabilitado={cambiandoPlan !== null}
                cargando={cambiandoPlan === confirmandoBajarA}
                onPress={() => onCambiarPlan(confirmandoBajarA)}
              >
                Sí, cambiar a {ETIQUETA_PLAN[confirmandoBajarA]}
              </Button>
              <Button variante="ghost" onPress={() => setConfirmandoBajarA(null)}>
                Volver
              </Button>
            </div>
          </div>
        )}

        {cotizacionAbierta && (
          <div className="mt-ds-4 flex flex-col gap-ds-3 rounded-ds-lg border border-ds-divider p-ds-4">
            <p className="font-ds-body text-ds-small font-semibold text-ds-text">Cotizar el plan Empresa</p>
            {cotizacionEnviada ? (
              <p className="font-ds-body text-ds-small font-medium text-ds-accent2-800">
                Recibimos tu solicitud. Te escribimos al correo de tu cuenta para acordar el plan.
              </p>
            ) : (
              <>
                <p className="font-ds-body text-ds-caption text-ds-text/70">
                  Para más de {LIMITES_POR_PLAN.pro.usuarios} usuarios, varias sucursales o si prefieres pagar por transferencia contra factura.
                </p>
                <Input
                  etiqueta="¿Cuántos usuarios necesitas?"
                  valor={usuariosCotizacion}
                  onCambio={(v) => setUsuariosCotizacion(v.replace(/[^0-9]/g, ""))}
                  placeholder="Ej.: 45"
                />
                <Textarea
                  etiqueta="Cuéntanos de tu operación (opcional)"
                  filas={3}
                  valor={mensajeCotizacion}
                  onCambio={setMensajeCotizacion}
                  placeholder="Ej.: 3 sucursales, 12 camiones y 30 técnicos en terreno."
                />
                {errorCotizacion ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorCotizacion}</p> : null}
                <div>
                  <Button onPress={onPedirCotizacion} cargando={enviandoCotizacion}>
                    Enviar solicitud
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-ds-3">
          <div>
            <p className="font-ds-body text-ds-small font-semibold text-ds-text">Método de pago</p>
            {tieneTarjeta ? (
              <p className="mt-ds-1 flex items-center gap-2 font-ds-body text-ds-small text-ds-text/70">
                <CreditCard size={16} strokeWidth={2.75} />
                {suscripcion?.tarjeta_marca ?? "Tarjeta"} terminada en {suscripcion?.tarjeta_ultimos4}
              </p>
            ) : (
              <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Todavía no registraste una tarjeta.</p>
            )}
          </div>
          {tieneTarjeta && (
            <Button variante="secundario" onPress={onAgregarTarjeta} cargando={cargandoTarjeta}>
              Actualizar tarjeta
            </Button>
          )}
        </div>
        <p className="mt-ds-3 font-ds-body text-ds-caption text-ds-text/60">
          Vas a ser redirigido a Flow para ingresar tu tarjeta — nunca pasa por nuestros servidores.
        </p>
      </Card>

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
      {aviso ? <p className="font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}

      <Card>
        <p className="font-ds-body text-ds-small font-semibold text-ds-text">Incluido en todos los planes</p>
        <ul className="mt-ds-5 grid gap-2.5 sm:grid-cols-2">
          {INCLUIDO_EN_TODOS.map((f) => (
            <li key={f} className="flex items-center gap-2 font-ds-body text-ds-small text-ds-text">
              <Check size={16} strokeWidth={2.75} className="shrink-0 text-ds-accent2-800" />
              {f}
            </li>
          ))}
        </ul>
      </Card>

      {info && info.historial.length > 0 && (
        <div>
          <p className="mb-ds-3 font-ds-body text-ds-small font-semibold text-ds-text">Historial de cambios de plan</p>
          <Table
            filas={info.historial}
            claveFila={(h) => h.id}
            columnas={[
              { encabezado: "Fecha", celda: (h) => <span className="text-ds-text/60">{new Date(h.creado_en).toLocaleString("es-CL")}</span> },
              {
                encabezado: "Cambio",
                celda: (h) => (
                  <span className="text-ds-text">
                    {ETIQUETA_PLAN[h.plan_anterior]} → {ETIQUETA_PLAN[h.plan_nuevo]}
                    {!h.cobro_conectado && <span className="ml-2 text-ds-caption text-ds-accent-700">(sin cobro conectado)</span>}
                  </span>
                ),
              },
              { encabezado: "Quién", celda: (h) => <span className="text-ds-text/60">{h.origen === "super_admin" ? "Super-Admin" : "Tu empresa"}</span> },
            ]}
            vacio={{ titulo: "Sin cambios de plan registrados." }}
          />
        </div>
      )}

      {cobros.length > 0 && (
        <div>
          <p className="mb-ds-3 font-ds-body text-ds-small font-semibold text-ds-text">Historial de cobros</p>
          <Table
            filas={cobros}
            claveFila={(c) => c.id}
            columnas={[
              { encabezado: "Fecha", celda: (c) => <span className="text-ds-text/60">{new Date(c.creado_en).toLocaleString("es-CL")}</span> },
              { encabezado: "Monto", celda: (c) => <span className="text-ds-text">{clp(c.monto)}</span> },
              { encabezado: "Intento", celda: (c) => <span className="text-ds-text/60">{c.intento_numero}</span> },
              { encabezado: "Estado", celda: (c) => <StatusBadge estado={c.estado} tonoForzado={TONO_SUSCRIPCION[c.estado]} /> },
            ]}
            vacio={{ titulo: "Sin cobros registrados." }}
          />
        </div>
      )}

      {suscripcion && suscripcion.estado !== "cancelada" && suscripcion.flow_subscription_id && (
        <div className="rounded-ds-md border border-ds-accent-700 bg-ds-accent-100 p-ds-4">
          <p className="mb-ds-2 font-ds-body text-ds-small font-semibold text-ds-accent-700">Cancelar suscripción</p>
          {!confirmandoCancelar ? (
            <Button variante="peligro" onPress={() => setConfirmandoCancelar(true)}>
              Cancelar suscripción
            </Button>
          ) : (
            <div className="flex flex-col gap-ds-3">
              <p className="font-ds-body text-ds-small text-ds-text/70">
                Al cancelar, dejamos de cobrarte — mantienes acceso hasta el final del período ya pagado. Tus datos{" "}
                <strong>no se borran</strong>: siguen disponibles si te vuelves a suscribir. Si además quieres eliminar los datos de tu
                empresa, eso se hace por separado desde Configuración &gt; Seguridad.
              </p>
              <div className="flex gap-ds-2">
                <Button variante="peligro" onPress={onCancelar} cargando={cancelando}>
                  Sí, cancelar mi suscripción
                </Button>
                <Button variante="ghost" onPress={() => setConfirmandoCancelar(false)}>
                  Volver
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// useSearchParams() necesita un boundary de Suspense para el build de
// producción (si no, Next aborta con "missing-suspense-with-csr-bailout").
export default function PlanPage() {
  return (
    <Suspense fallback={null}>
      <PlanContenido />
    </Suspense>
  );
}
