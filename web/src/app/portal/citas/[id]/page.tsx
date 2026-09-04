"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { Badge, Button, Card, ErrorText, SuccessText, WarningText } from "@/components/ui";
import { IconChevronLeft } from "@/components/icons";
import { EstadoCargando } from "@/components/estados";
import { obtenerTokenPortal, portalFetch } from "@/lib/portalApi";

type CitaDetalle = {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hora: string | null;
  estado: string;
  advertencia_cancelacion: { ventana_horas: number; descuenta_si_cancela_ahora: boolean } | null;
};

export default function PortalCitaDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [cita, setCita] = useState<CitaDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decidiendo, setDecidiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function cargar() {
    const res = await portalFetch(`/api/portal/datos/citas/${params.id}`);
    if (res.status === 401) {
      router.replace("/portal/login");
      return;
    }
    if (!res.ok) {
      setError("No se pudo cargar esta cita");
      return;
    }
    setCita(await res.json());
  }

  useEffect(() => {
    if (!obtenerTokenPortal()) {
      router.replace("/portal/login");
      return;
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function decidir(accion: "confirmar" | "cancelar") {
    if (accion === "cancelar" && cita?.advertencia_cancelacion?.descuenta_si_cancela_ahora) {
      const horas = cita.advertencia_cancelacion.ventana_horas;
      const confirmado = confirm(
        `Esta cancelación es con menos de ${horas} horas de anticipación y se descontará del paquete de todas formas. ¿Confirmas?`
      );
      if (!confirmado) return;
    }
    setDecidiendo(true);
    setError(null);
    const res = await portalFetch(`/api/portal/datos/citas/${params.id}/${accion}`, { method: "POST" });
    setDecidiendo(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo registrar tu respuesta");
      return;
    }
    setAviso(accion === "confirmar" ? "Confirmaste tu cita — te esperamos." : "Cancelaste tu cita.");
    cargar();
  }

  return (
    <PortalShell>
      <Link href="/portal/citas" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Mis Citas
      </Link>

      {error && <ErrorText>{error}</ErrorText>}
      {!cita && !error && <EstadoCargando />}

      {cita && (
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-foreground">{cita.titulo}</h1>
              <Badge value={cita.estado} />
            </div>
            <p className="mt-2 text-sm text-foreground">
              {new Date(`${cita.fecha}T00:00:00`).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              {cita.hora ? ` · ${cita.hora}` : ""}
            </p>
            {cita.descripcion && <p className="mt-3 text-sm text-muted">{cita.descripcion}</p>}
          </Card>

          {aviso && <SuccessText>{aviso}</SuccessText>}

          {cita.advertencia_cancelacion?.descuenta_si_cancela_ahora && (
            <WarningText>
              Estás a menos de {cita.advertencia_cancelacion.ventana_horas} horas de la cita — si cancelas ahora, la sesión se
              descontará igual de tu paquete.
            </WarningText>
          )}

          {cita.estado === "pendiente" && (
            <div className="flex gap-3">
              <Button type="button" onClick={() => decidir("confirmar")} disabled={decidiendo} className="flex-1">
                Confirmar
              </Button>
              <Button type="button" variant="outline" onClick={() => decidir("cancelar")} disabled={decidiendo} className="flex-1">
                Cancelar
              </Button>
            </div>
          )}
          {cita.estado === "confirmada" && (
            <Button type="button" variant="outline" onClick={() => decidir("cancelar")} disabled={decidiendo}>
              Cancelar cita
            </Button>
          )}
        </div>
      )}
    </PortalShell>
  );
}
