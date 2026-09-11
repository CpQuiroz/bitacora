"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import type { AccesoUsuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { Button, Card, Input, LoadingState, Table } from "@bitacora/ui/web";
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

type EstadoMfa = { activado: boolean; metodo: "totp" | "email" | null };

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function SeguridadPage() {
  const { usuario } = useConfiguracion();
  const router = useRouter();

  const mfaObligatoria = usuario.rol === "admin" || usuario.rol === "supervisor";
  const [mfa, setMfa] = useState<EstadoMfa | null>(null);
  const [modoActivacion, setModoActivacion] = useState<"totp" | "email" | null>(null);
  const [secretoTotp, setSecretoTotp] = useState<{ secreto: string; otpauthUri: string } | null>(null);
  const [copiadoSecreto, setCopiadoSecreto] = useState(false);
  const [codigoActivar, setCodigoActivar] = useState("");
  const [codigoEmailEnviado, setCodigoEmailEnviado] = useState(false);
  const [cargandoMfa, setCargandoMfa] = useState(false);
  const [errorMfa, setErrorMfa] = useState<string | null>(null);
  const [avisoMfa, setAvisoMfa] = useState<string | null>(null);
  const [desactivando, setDesactivando] = useState(false);

  useEffect(() => {
    apiFetch("/api/usuarios/me/mfa").then(async (res) => {
      if (res.ok) setMfa(await res.json());
    });
  }, []);

  function cerrarActivacion() {
    setModoActivacion(null);
    setSecretoTotp(null);
    setCodigoActivar("");
    setCodigoEmailEnviado(false);
    setErrorMfa(null);
    setAvisoMfa(null);
  }

  async function abrirActivacionTotp() {
    setErrorMfa(null);
    setModoActivacion("totp");
    setCargandoMfa(true);
    const res = await apiFetch("/api/usuarios/me/mfa/totp/iniciar", { method: "POST" });
    setCargandoMfa(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorMfa(body.error ?? "No se pudo generar el código");
      return;
    }
    setSecretoTotp(await res.json());
  }

  function copiarSecreto() {
    if (!secretoTotp) return;
    navigator.clipboard.writeText(secretoTotp.secreto).then(() => {
      setCopiadoSecreto(true);
      setTimeout(() => setCopiadoSecreto(false), 2000);
    });
  }

  async function confirmarTotp() {
    setErrorMfa(null);
    setCargandoMfa(true);
    const res = await apiFetch("/api/usuarios/me/mfa/totp/confirmar", {
      method: "POST",
      body: JSON.stringify({ codigo: codigoActivar }),
    });
    setCargandoMfa(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorMfa(body.error ?? "Código incorrecto");
      return;
    }
    setMfa({ activado: true, metodo: "totp" });
    cerrarActivacion();
  }

  async function abrirActivacionEmail() {
    setErrorMfa(null);
    setModoActivacion("email");
    setCargandoMfa(true);
    const res = await apiFetch("/api/usuarios/me/mfa/email/iniciar", { method: "POST" });
    setCargandoMfa(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorMfa(body.error ?? "No se pudo enviar el código");
      return;
    }
    setCodigoEmailEnviado(true);
    setAvisoMfa("Te enviamos un código a tu correo.");
  }

  async function confirmarEmail() {
    setErrorMfa(null);
    setCargandoMfa(true);
    const res = await apiFetch("/api/usuarios/me/mfa/email/confirmar", {
      method: "POST",
      body: JSON.stringify({ codigo: codigoActivar }),
    });
    setCargandoMfa(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorMfa(body.error ?? "Código incorrecto");
      return;
    }
    setMfa({ activado: true, metodo: "email" });
    cerrarActivacion();
  }

  async function onDesactivarMfa() {
    if (!confirm("¿Desactivar la verificación en dos pasos?")) return;
    setDesactivando(true);
    const res = await apiFetch("/api/usuarios/me/mfa/desactivar", { method: "POST" });
    setDesactivando(false);
    if (res.ok) setMfa({ activado: false, metodo: null });
  }

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
    <div className="flex flex-col gap-ds-6">
      <div>
        <p className="ds-heading text-ds-h3 text-ds-text">Seguridad</p>
        <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Sesiones activas y zona de peligro</p>
      </div>

      <Card>
        <p className="mb-ds-2 font-ds-body text-ds-small font-semibold text-ds-text">Contraseña</p>
        <p className="font-ds-body text-ds-small text-ds-text/70">
          El cambio de contraseña está en{" "}
          <Link href="/dashboard/configuracion/cuenta" className="font-medium text-ds-brand hover:underline">
            Cuenta
          </Link>
          {sesion?.actualizado && ` — tu cuenta se actualizó por última vez el ${new Date(sesion.actualizado).toLocaleDateString("es-CL")}.`}
        </p>
      </Card>

      <Card>
        <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Sesiones activas</p>
        {sesion && (
          <div className="flex items-center justify-between rounded-ds-lg border border-ds-divider p-ds-3 font-ds-body text-ds-small">
            <div>
              <p className="font-medium text-ds-text">
                {sesion.navegador} · {sesion.so}
              </p>
              <p className="font-ds-body text-ds-caption text-ds-text/60">Ahora</p>
            </div>
            <span className="rounded-ds-pill bg-ds-brand/[0.08] px-2.5 py-0.5 text-ds-caption font-medium text-ds-brand">Sesión actual</span>
          </div>
        )}
        <p className="mt-ds-3 font-ds-body text-ds-caption text-ds-text/60">
          Esta es la única sesión que podemos identificar individualmente — Supabase no expone un listado de
          dispositivos activos, pero puedes cerrar cualquier otra sesión abierta con tu cuenta (otro navegador, otro
          celular) sin necesidad de saber cuál es.
        </p>
        {errorCerrarOtras ? <p className="mt-ds-3 font-ds-body text-ds-small text-ds-accent-700">{errorCerrarOtras}</p> : null}
        {avisoCerrarOtras ? <p className="mt-ds-3 font-ds-body text-ds-small font-medium text-ds-accent2-800">{avisoCerrarOtras}</p> : null}
        <div className="mt-ds-4">
          <Button variante="secundario" onPress={onCerrarOtrasSesiones} cargando={cerrandoOtras}>
            Cerrar sesión en otros dispositivos
          </Button>
        </div>
      </Card>

      <Card>
        <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Historial de accesos</p>
        <Table
          filas={accesos ?? []}
          claveFila={(a) => a.id}
          cargando={accesos === null}
          columnas={[
            { encabezado: "Fecha", celda: (a) => new Date(a.creado_en).toLocaleString("es-CL") },
            { encabezado: "IP", celda: (a) => a.ip ?? "—" },
            { encabezado: "Dispositivo", celda: (a) => (a.user_agent ? `${detectarNavegador(a.user_agent)} · ${detectarSO(a.user_agent)}` : "—") },
          ]}
          vacio={{ titulo: "Todavía no hay accesos registrados." }}
        />
      </Card>

      <Card>
        <p className="font-ds-body text-ds-small font-semibold text-ds-text">Autenticación de dos factores</p>
        <p className="mb-ds-4 mt-ds-1 font-ds-body text-ds-caption text-ds-text/60">
          Un paso extra al iniciar sesión — con una app de autenticación (Google Authenticator, Authy...) o con un
          código que te mandamos por correo.
        </p>

        {mfaObligatoria && !mfa?.activado && (
          <p className="mb-ds-4 rounded-ds-lg bg-ds-accent-100 px-ds-3 py-ds-2 font-ds-body text-ds-caption text-ds-accent-800">
            Tu rol requiere tenerla activa — mientras no la actives, el resto de la app queda bloqueado salvo esta
            página.
          </p>
        )}

        {mfa === null ? (
          <LoadingState />
        ) : mfa.activado ? (
          <div className="flex items-center justify-between rounded-ds-lg border border-ds-divider p-ds-3 font-ds-body text-ds-small">
            <p className="font-medium text-ds-text">Activa — {mfa.metodo === "totp" ? "app de autenticación" : "código por correo"}</p>
            <Button variante="secundario" onPress={onDesactivarMfa} cargando={desactivando}>
              Desactivar
            </Button>
          </div>
        ) : modoActivacion === null ? (
          <div className="flex flex-wrap gap-ds-2">
            <Button variante="secundario" onPress={abrirActivacionTotp}>
              Con app de autenticación
            </Button>
            <Button variante="secundario" onPress={abrirActivacionEmail}>
              Con código por correo
            </Button>
          </div>
        ) : modoActivacion === "totp" ? (
          <div className="flex flex-col gap-ds-3">
            {secretoTotp ? (
              <>
                <p className="font-ds-body text-ds-small text-ds-text/70">
                  Escanea o abre este link con tu app de autenticación, o ingresa el código manualmente:
                </p>
                <a href={secretoTotp.otpauthUri} className="break-all font-ds-body text-ds-small font-medium text-ds-brand hover:underline">
                  {secretoTotp.otpauthUri}
                </a>
                <div className="flex items-center gap-ds-2">
                  <code className="rounded-ds-lg border border-ds-divider bg-ds-surface px-ds-3 py-ds-2 font-mono text-ds-small tracking-widest text-ds-text">
                    {secretoTotp.secreto}
                  </code>
                  <Button variante="ghost" onPress={copiarSecreto}>
                    {copiadoSecreto ? "Copiado" : "Copiar"}
                  </Button>
                </div>
                <div className="max-w-[10rem]">
                  <Input
                    etiqueta="Código de la app"
                    tipo="codigo"
                    maxLongitud={6}
                    valor={codigoActivar}
                    onCambio={(v) => setCodigoActivar(v.replace(/\D/g, ""))}
                  />
                </div>
              </>
            ) : (
              <p className="font-ds-body text-ds-small text-ds-text/70">Generando…</p>
            )}
            {errorMfa ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorMfa}</p> : null}
            <div className="flex gap-ds-2">
              <Button onPress={confirmarTotp} cargando={cargandoMfa} deshabilitado={codigoActivar.length !== 6}>
                Confirmar y activar
              </Button>
              <Button variante="ghost" onPress={cerrarActivacion}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-ds-3">
            {avisoMfa ? <p className="font-ds-body text-ds-small font-medium text-ds-accent2-800">{avisoMfa}</p> : null}
            {codigoEmailEnviado && (
              <div className="max-w-[10rem]">
                <Input
                  etiqueta="Código que te llegó por correo"
                  tipo="codigo"
                  maxLongitud={6}
                  valor={codigoActivar}
                  onCambio={(v) => setCodigoActivar(v.replace(/\D/g, ""))}
                />
              </div>
            )}
            {errorMfa ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorMfa}</p> : null}
            <div className="flex gap-ds-2">
              {codigoEmailEnviado ? (
                <Button onPress={confirmarEmail} cargando={cargandoMfa} deshabilitado={codigoActivar.length !== 6}>
                  Confirmar y activar
                </Button>
              ) : (
                <Button deshabilitado>Enviando…</Button>
              )}
              <Button variante="ghost" onPress={cerrarActivacion}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Card>

      {usuario.rol === "admin" && (
        <Card>
          <div className="rounded-ds-md border border-ds-accent-700 bg-ds-accent-100 p-ds-4">
            <p className="mb-ds-2 flex items-center gap-2 font-ds-body text-ds-small font-semibold text-ds-accent-700">
              <Shield size={16} strokeWidth={2.75} />
              Zona de peligro
            </p>
            <p className="mb-ds-4 font-ds-body text-ds-small text-ds-text/70">
              Eliminar la cuenta borra <strong>permanentemente</strong> a {usuario.empresa.nombre} — clientes, cotizaciones,
              órdenes de servicio, cobranzas y todo lo demás. Esta acción no se puede deshacer.
            </p>
            <div className="max-w-sm">
              <Input etiqueta={`Escribe "${usuario.empresa.nombre}" para confirmar`} valor={confirmacion} onCambio={setConfirmacion} />
            </div>
            {errorEliminar ? <p className="mt-ds-3 font-ds-body text-ds-small text-ds-accent-700">{errorEliminar}</p> : null}
            <div className="mt-ds-4">
              <Button variante="peligro" onPress={onEliminarCuenta} cargando={eliminando} deshabilitado={confirmacion !== usuario.empresa.nombre}>
                Eliminar cuenta
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
