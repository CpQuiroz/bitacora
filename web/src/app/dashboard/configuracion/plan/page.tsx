"use client";

import { Card, PageHeader } from "@/components/ui";
import { IconCheck, IconCreditCard, IconWallet } from "@/components/icons";
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
const PRECIO_ANUAL = 299900;
const AHORRO_PCT = Math.round((1 - PRECIO_ANUAL / (PRECIO_MENSUAL * 12)) * 100);

const clp = (n: number) => `$${n.toLocaleString("es-CL")}`;

function diasRestantes(fechaTermino: string | null): number | null {
  if (!fechaTermino) return null;
  const hoy = new Date();
  const termino = new Date(`${fechaTermino}T00:00:00`);
  const diff = Math.ceil((termino.getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86_400_000);
  return diff;
}

export default function PlanPage() {
  const { usuario } = useConfiguracion();
  const dias = diasRestantes(usuario.empresa.prueba_termina_en);
  const enPrueba = usuario.empresa.plan === "trial";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Plan" subtitle="Tu plan actual y las opciones disponibles" />

      {enPrueba ? (
        <Card className="border-brand/40 bg-brand-soft">
          <p className="text-sm font-semibold text-brand">Período de prueba</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {dias != null && dias >= 0 ? `${dias} ${dias === 1 ? "día restante" : "días restantes"}` : "Tu prueba terminó"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {dias != null && dias >= 0
              ? "Elige un plan abajo para seguir usando Bitácora sin interrupciones."
              : "Elige un plan para reactivar tu cuenta."}
          </p>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-muted">Plan actual</p>
          <p className="mt-1 text-2xl font-bold capitalize text-foreground">{usuario.empresa.plan}</p>
        </Card>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <p className="text-sm font-semibold text-foreground">Mensual</p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {clp(PRECIO_MENSUAL)} <span className="text-sm font-normal text-muted">/ mes</span>
          </p>
          <p className="mt-1 text-xs text-muted">Facturado cada mes</p>
          <ul className="mt-5 flex flex-col gap-2.5">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                <IconCheck className="h-4 w-4 shrink-0 text-success" />
                {f}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="relative border-brand ring-2 ring-brand">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground">
            Más Popular
          </span>
          <p className="text-sm font-semibold text-brand">Anual</p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {clp(PRECIO_ANUAL)} <span className="text-sm font-normal text-muted">/ año</span>
          </p>
          <p className="mt-1 text-xs font-medium text-success">Ahorra {AHORRO_PCT}% vs. mensual</p>
          <ul className="mt-5 flex flex-col gap-2.5">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                <IconCheck className="h-4 w-4 shrink-0 text-success" />
                {f}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Métodos de pago aceptados</h2>
        <div className="flex gap-4 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <IconCreditCard className="h-4 w-4" /> Tarjeta
          </span>
          <span className="flex items-center gap-1.5">
            <IconWallet className="h-4 w-4" /> Transferencia
          </span>
        </div>
        <p className="mt-3 text-xs text-muted">
          La pasarela de pago se conecta desde{" "}
          <a href="/dashboard/configuracion/integraciones" className="font-medium text-brand hover:underline">
            Integraciones
          </a>{" "}
          — mientras tanto, esta pantalla es informativa.
        </p>
      </Card>
    </div>
  );
}
