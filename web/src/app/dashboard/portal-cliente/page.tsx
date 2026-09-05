"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { Card, PageHeader } from "@/components/ui";
import { useUsuarioShell } from "@/lib/useUsuarioShell";

// Destino "Portal del cliente" (grupo CLIENTES). El portal ya existe
// (/portal: citas, órdenes, cotizaciones, cobros con acceso propio del
// cliente) pero nunca tuvo un lugar en el dashboard. PASO 5 completa
// esta página con: link para compartir, previsualización y los
// interruptores de qué secciones se le muestran al cliente.
export default function PortalClientePage() {
  const { usuario } = useUsuarioShell();
  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <PageHeader
        title="Portal del cliente"
        subtitle="La superficie que ve el cliente final: sus citas, órdenes, cotizaciones y cobros"
      />
      <Card className="mt-6">
        <p className="text-sm text-muted">
          En preparación. Acá vas a poder copiar el link para compartir con tus clientes, previsualizar lo que ven, y elegir qué
          secciones mostrarles.
        </p>
      </Card>
    </DashboardShell>
  );
}
