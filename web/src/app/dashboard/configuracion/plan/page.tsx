"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Suscripcion, SuscripcionCobro } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Badge, Button, Card, ErrorText, PageHeader, SuccessText } from "@/components/ui";
import { IconCheck, IconCreditCard } from "@/components/icons";
import { useConfiguracion } from "../ConfiguracionContext";

const FEATURES = [
  "Clientes ilimitados",
  "Órdenes de servicio ilimitadas",
  "Catálogo de productos/servicios",
  "Informes avanzados",
  "Integración WhatsApp",
  "Cotizaciones ilimitadas",
  "Cobros ilimitados",
  "Gestión de gastos",
  "Exportación a PDF",
  "Soporte prioritario",
];

const PRECIO_MENSUAL = 29990;
const clp = (n: number) => `$${n.toLocaleString("es-CL")}`;

const ETIQUETA_ESTADO: Record<string, string> = {
  trial: "En prueba",
  activa: "Activa",
  pago_pendiente: "Pago pendiente",
  suspendida_por_pago: "Suspendida por falta de pago",
  cancelada: "Cancelada",
};

function diasRestantes(fechaTermino: string | null): number | null {
  if (!fechaTermino) return null;
  const hoy = new Date();
  const termino = new Date(`${fechaTermino}T00:00:00`);
  return Math.ceil((termino.getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86_400_000);
}

export default function PlanPage() {
  const { usuario } = useConfiguracion();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dias = diasRestantes(usuario.empresa.prueba_termina_en);

  const [suscripcion, setSuscripcion] = useState<Suscripcion | null>(null);
  const [cobros, setCobros] = useState<SuscripcionCobro[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargandoTarjeta, setCargandoTarjeta] = useState(false);
  const [confirmandoRetorno, setConfirmandoRetorno] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [cancelando, setCancelando] = useState(false);

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

  useEffect(() => {
    cargar();
  }, [cargar]);

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
    <div className="flex flex-col gap-6">
      <PageHeader title="Plan" subtitle="Tu suscripción y método de pago" />

      {confirmandoRetorno && (
        <Card className="border-brand/40 bg-brand-soft">
          <p className="text-sm text-brand">Confirmando el registro de tu tarjeta con Flow…</p>
        </Card>
      )}

      {suscripcion?.estado === "trial" && (
        <Card className="border-brand/40 bg-brand-soft">
          <p className="text-sm font-semibold text-brand">Período de prueba</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {dias != null && dias >= 0 ? `${dias} ${dias === 1 ? "día restante" : "días restantes"}` : "Tu prueba terminó"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {tieneTarjeta
              ? "Ya registraste tu tarjeta — el primer cobro se hará automáticamente al terminar la prueba."
              : "Agrega tu tarjeta para que la suscripción siga activa sin interrupciones al terminar la prueba."}
          </p>
        </Card>
      )}

      {suscripcion?.estado === "activa" && (
        <Card className="border-success/40 bg-success-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-success">Suscripción activa</p>
              {suscripcion.proxima_fecha_cobro && (
                <p className="mt-1 text-sm text-foreground">
                  Próximo cobro: {new Date(`${suscripcion.proxima_fecha_cobro}T00:00:00`).toLocaleDateString("es-CL")}
                </p>
              )}
            </div>
            <Badge value={suscripcion.estado} />
          </div>
        </Card>
      )}

      {estaSuspendidaOFallida && (
        <Card className="border-danger/40 bg-danger-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-danger">{ETIQUETA_ESTADO[suscripcion!.estado]}</p>
              <p className="mt-1 text-sm text-foreground">
                {suscripcion?.estado === "suspendida_por_pago"
                  ? "Tu cuenta quedó suspendida tras varios intentos de cobro fallidos. Actualiza tu tarjeta para reactivarla."
                  : "No pudimos procesar tu último cobro — vamos a reintentar automáticamente. Si tu tarjeta cambió, actualízala."}
              </p>
            </div>
            <Badge value={suscripcion!.estado} />
          </div>
        </Card>
      )}

      {suscripcion?.estado === "cancelada" && (
        <Card className="border-border">
          <p className="text-sm font-semibold text-foreground">Suscripción cancelada</p>
          <p className="mt-1 text-sm text-muted">
            {suscripcion.cancelada_en && `Cancelada el ${new Date(suscripcion.cancelada_en).toLocaleDateString("es-CL")}.`} Tus datos se
            conservan — contáctanos si quieres reactivarla.
          </p>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Método de pago</h2>
            {tieneTarjeta ? (
              <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                <IconCreditCard className="h-4 w-4" />
                {suscripcion?.tarjeta_marca ?? "Tarjeta"} terminada en {suscripcion?.tarjeta_ultimos4}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">Todavía no registraste una tarjeta.</p>
            )}
          </div>
          <Button type="button" variant="outline" onClick={onAgregarTarjeta} disabled={cargandoTarjeta}>
            {cargandoTarjeta ? "Redirigiendo…" : tieneTarjeta ? "Actualizar tarjeta" : "Agregar tarjeta"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted">
          Vas a ser redirigido a Flow para ingresar tu tarjeta — nunca pasa por nuestros servidores.
        </p>
      </Card>

      {error && <ErrorText>{error}</ErrorText>}
      {aviso && <SuccessText>{aviso}</SuccessText>}

      <Card>
        <p className="text-sm font-semibold text-foreground">Mensual</p>
        <p className="mt-2 text-3xl font-bold text-foreground">
          {clp(PRECIO_MENSUAL)} <span className="text-sm font-normal text-muted">/ mes</span>
        </p>
        <p className="mt-1 text-xs text-muted">Facturado cada mes — 21 días de prueba gratis para cuentas nuevas.</p>
        <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-foreground">
              <IconCheck className="h-4 w-4 shrink-0 text-success" />
              {f}
            </li>
          ))}
        </ul>
      </Card>

      {cobros.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <h2 className="p-6 pb-3 text-sm font-semibold text-foreground">Historial de cobros</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Monto</th>
                <th className="px-5 py-3 font-medium">Intento</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {cobros.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-muted">{new Date(c.creado_en).toLocaleString("es-CL")}</td>
                  <td className="px-5 py-3 text-foreground">{clp(c.monto)}</td>
                  <td className="px-5 py-3 text-muted">{c.intento_numero}</td>
                  <td className="px-5 py-3">
                    <Badge value={c.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {suscripcion && suscripcion.estado !== "cancelada" && suscripcion.flow_subscription_id && (
        <Card className="border-danger/40">
          <h2 className="mb-2 text-sm font-semibold text-danger">Cancelar suscripción</h2>
          {!confirmandoCancelar ? (
            <Button type="button" variant="danger" onClick={() => setConfirmandoCancelar(true)}>
              Cancelar suscripción
            </Button>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">
                Al cancelar, dejamos de cobrarte — mantienes acceso hasta el final del período ya pagado. Tus datos{" "}
                <strong>no se borran</strong>: siguen disponibles si te vuelves a suscribir. Si además quieres eliminar los datos de tu
                empresa, eso se hace por separado desde Configuración &gt; Seguridad.
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="danger" onClick={onCancelar} disabled={cancelando}>
                  {cancelando ? "Cancelando…" : "Sí, cancelar mi suscripción"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirmandoCancelar(false)}>
                  Volver
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
