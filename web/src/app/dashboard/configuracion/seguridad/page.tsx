"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { Button, Card, ErrorText, Input, Label, PageHeader } from "@/components/ui";
import { IconShield } from "@/components/icons";
import { useConfiguracion } from "../ConfiguracionContext";

function detectarNavegador(userAgent: string): string {
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Edg")) return "Edge";
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Safari")) return "Safari";
  return "Navegador desconocido";
}
function detectarSO(userAgent: string): string {
  if (userAgent.includes("Mac OS")) return "macOS";
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("iPhone") || userAgent.includes("iPad")) return "iOS";
  if (userAgent.includes("Linux")) return "Linux";
  return "SO desconocido";
}

export default function SeguridadPage() {
  const { usuario } = useConfiguracion();
  const router = useRouter();

  const [sesion, setSesion] = useState<{ navegador: string; so: string; actualizado: string | null } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      setSesion({
        navegador: detectarNavegador(ua),
        so: detectarSO(ua),
        actualizado: data.user?.updated_at ?? null,
      });
    });
  }, []);

  const [confirmacion, setConfirmacion] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  async function onEliminarCuenta() {
    setErrorEliminar(null);
    if (confirmacion !== usuario.empresa.nombre) {
      setErrorEliminar("El nombre no coincide");
      return;
    }
    setEliminando(true);
    const res = await apiFetch("/api/empresa", { method: "DELETE", body: JSON.stringify({ confirmar: confirmacion }) });
    setEliminando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorEliminar(body.error ?? "No se pudo eliminar la cuenta");
      return;
    }
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Seguridad" subtitle="Sesiones activas y zona de peligro" />

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Contraseña</h2>
        <p className="text-sm text-muted">
          El cambio de contraseña está en{" "}
          <Link href="/dashboard/configuracion/cuenta" className="font-medium text-brand hover:underline">
            Cuenta
          </Link>
          {sesion?.actualizado && ` — tu cuenta se actualizó por última vez el ${new Date(sesion.actualizado).toLocaleDateString("es-CL")}.`}
        </p>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Sesiones activas</h2>
        {sesion && (
          <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
            <div>
              <p className="font-medium text-foreground">
                {sesion.navegador} · {sesion.so}
              </p>
              <p className="text-xs text-muted">Ahora</p>
            </div>
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">Sesión actual</span>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          Por ahora solo se muestra tu sesión actual — el rastreo de otros dispositivos todavía no está implementado.
        </p>
      </Card>

      {usuario.rol === "admin" && (
        <Card className="border-danger/40">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-danger">
            <IconShield className="h-4 w-4" />
            Zona de peligro
          </h2>
          <p className="mb-4 text-sm text-muted">
            Eliminar la cuenta borra <strong>permanentemente</strong> a {usuario.empresa.nombre} — clientes, cotizaciones,
            órdenes de servicio, cobranzas y todo lo demás. Esta acción no se puede deshacer.
          </p>
          <Label>Escribe &ldquo;{usuario.empresa.nombre}&rdquo; para confirmar</Label>
          <Input type="text" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} className="max-w-sm" />
          {errorEliminar && (
            <div className="mt-3">
              <ErrorText>{errorEliminar}</ErrorText>
            </div>
          )}
          <Button
            type="button"
            variant="danger"
            onClick={onEliminarCuenta}
            disabled={eliminando || confirmacion !== usuario.empresa.nombre}
            className="mt-4"
          >
            {eliminando ? "Eliminando…" : "Eliminar cuenta"}
          </Button>
        </Card>
      )}
    </div>
  );
}
