"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AccesoUsuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { Button, Card, ErrorText, Input, Label, PageHeader, SuccessText } from "@/components/ui";
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

  const [cerrandoOtras, setCerrandoOtras] = useState(false);
  const [avisoCerrarOtras, setAvisoCerrarOtras] = useState<string | null>(null);
  const [errorCerrarOtras, setErrorCerrarOtras] = useState<string | null>(null);

  async function onCerrarOtrasSesiones() {
    setErrorCerrarOtras(null);
    setAvisoCerrarOtras(null);
    setCerrandoOtras(true);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setCerrandoOtras(false);
    if (error) {
      setErrorCerrarOtras(error.message);
      return;
    }
    setAvisoCerrarOtras("Se cerró la sesión en tus otros dispositivos");
  }

  const [accesos, setAccesos] = useState<AccesoUsuario[] | null>(null);
  useEffect(() => {
    apiFetch("/api/usuarios/me/accesos").then(async (res) => {
      if (res.ok) setAccesos(await res.json());
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
          Esta es la única sesión que podemos identificar individualmente — Supabase no expone un listado de
          dispositivos activos, pero puedes cerrar cualquier otra sesión abierta con tu cuenta (otro navegador, otro
          celular) sin necesidad de saber cuál es.
        </p>
        {errorCerrarOtras && (
          <div className="mt-3">
            <ErrorText>{errorCerrarOtras}</ErrorText>
          </div>
        )}
        {avisoCerrarOtras && (
          <div className="mt-3">
            <SuccessText>{avisoCerrarOtras}</SuccessText>
          </div>
        )}
        <Button type="button" variant="outline" onClick={onCerrarOtrasSesiones} disabled={cerrandoOtras} className="mt-4">
          {cerrandoOtras ? "Cerrando…" : "Cerrar sesión en otros dispositivos"}
        </Button>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Historial de accesos</h2>
        {accesos === null && <p className="text-sm text-muted">Cargando…</p>}
        {accesos?.length === 0 && <p className="text-sm text-muted">Todavía no hay accesos registrados.</p>}
        {accesos && accesos.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="py-2 pr-4 font-medium">Fecha</th>
                  <th className="py-2 pr-4 font-medium">IP</th>
                  <th className="py-2 font-medium">Dispositivo</th>
                </tr>
              </thead>
              <tbody>
                {accesos.map((a) => (
                  <tr key={a.id} className="border-b border-border text-muted last:border-0">
                    <td className="py-2 pr-4">{new Date(a.creado_en).toLocaleString("es-CL")}</td>
                    <td className="py-2 pr-4">{a.ip ?? "—"}</td>
                    <td className="py-2">{a.user_agent ? `${detectarNavegador(a.user_agent)} · ${detectarSO(a.user_agent)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Autenticación de dos factores</h2>
            <p className="mt-1 text-xs text-muted">Próximamente — un paso extra de verificación al iniciar sesión.</p>
          </div>
          <span
            role="switch"
            aria-checked={false}
            aria-disabled="true"
            className="relative h-6 w-11 shrink-0 cursor-not-allowed rounded-full bg-border opacity-60"
          >
            <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow" />
          </span>
        </div>
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
