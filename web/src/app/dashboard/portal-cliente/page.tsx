"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Empresa } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Card, LoadingState } from "@bitacora/ui/web";

// Destino "Portal del cliente" (grupo CLIENTES). El portal ya existe
// (/portal/login → el cliente entra con su RUT + código por correo).
// Acá el admin copia el link, previsualiza, y elige qué secciones se le
// muestran al cliente (columnas portal_muestra_* de empresas, migración 93).

type SeccionKey = "portal_muestra_ordenes" | "portal_muestra_citas" | "portal_muestra_cotizaciones" | "portal_muestra_cobros";

const SECCIONES: { key: SeccionKey; titulo: string; desc: string }[] = [
  { key: "portal_muestra_ordenes", titulo: "Órdenes de servicio", desc: "Sus visitas y OS, con el PDF firmado cuando está listo." },
  { key: "portal_muestra_citas", titulo: "Citas", desc: "Sus citas agendadas, con opción de confirmar o cancelar." },
  { key: "portal_muestra_cotizaciones", titulo: "Cotizaciones", desc: "Las cotizaciones que le enviaste, con aprobar o rechazar." },
  { key: "portal_muestra_cobros", titulo: "Cobros", desc: "Sus facturas y el estado de pago de cada una." },
];

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function PortalClientePage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [puede, setPuede] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<SeccionKey | null>(null);
  const [copiado, setCopiado] = useState(false);

  const linkPortal = typeof window !== "undefined" ? `${window.location.origin}/portal/login` : "/portal/login";

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const res = await apiFetch("/api/me");
      if (!res.ok) {
        router.replace("/login");
        return;
      }
      const body = await res.json();
      const u = body.usuario;
      if (!u) return;
      setUsuario({
        nombre: u.nombre,
        rol: u.rol,
        empresaNombre: u.empresa?.nombre ?? "",
        empresaLogoUrl: u.empresa?.logo_url ?? null,
        colorPrimario: u.empresa?.color_primario ?? null,
        colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null,
        colorSecundario: u.empresa?.color_secundario ?? null,
        fuente: u.empresa?.fuente ?? null,
        moneda: u.empresa?.moneda ?? "CLP",
      });
      setEmpresa(u.empresa ?? null);
      const visibles: string[] = Array.isArray(body.modulos_visibles) ? body.modulos_visibles : [];
      setPuede(visibles.includes("configuracion"));
    })();
  }, [router]);

  async function alternar(key: SeccionKey) {
    if (!empresa || guardando) return;
    const nuevo = !empresa[key];
    setEmpresa({ ...empresa, [key]: nuevo });
    setGuardando(key);
    setError(null);
    setAviso(null);
    const res = await apiFetch("/api/empresa", { method: "PATCH", body: JSON.stringify({ [key]: nuevo }) });
    setGuardando(null);
    if (!res.ok) {
      setEmpresa({ ...empresa, [key]: !nuevo });
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "No se pudo guardar");
      return;
    }
    setAviso("Cambio guardado — ya aplica en el portal.");
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(linkPortal);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No se pudo copiar — copia el link a mano.");
    }
  }

  if (!usuario) return null;
  if (!puede) {
    return (
      <DashboardShell usuario={usuario}>
        <div className="mx-auto max-w-md">
          <Card>
            <p className="ds-heading text-ds-h4 text-ds-text">Sin autorización</p>
            <p className="mt-ds-2 font-ds-body text-ds-small text-ds-text/70">
              Solo un administrador puede configurar el portal del cliente.
            </p>
          </Card>
        </div>
      </DashboardShell>
    );
  }
  if (!empresa) {
    return (
      <DashboardShell usuario={usuario}>
        <LoadingState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell usuario={usuario}>
      <p className="ds-heading text-ds-h2 text-ds-text">Portal del cliente</p>
      <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
        La superficie que ve el cliente final: sus citas, órdenes, cotizaciones y cobros
      </p>

      {error ? <p className="mt-ds-4 font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
      {aviso ? <p className="mt-ds-4 font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}

      <div className="mt-ds-6">
        <Card>
          <p className="font-ds-body text-ds-small font-semibold text-ds-text">Link para compartir</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
            Mándaselo a tus clientes. Entran con su RUT y un código que les llega por correo — no necesitan crear cuenta. El link es
            el mismo para todos.
          </p>
          <div className="mt-ds-3 flex flex-wrap items-center gap-ds-2">
            <input
              readOnly
              value={linkPortal}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-ds-md border border-ds-divider bg-ds-text/[0.04] px-ds-3 py-2 font-mono text-ds-small text-ds-text"
            />
            <button
              type="button"
              onClick={copiar}
              className="shrink-0 rounded-ds-md border border-ds-divider px-ds-3 py-2 font-ds-body text-ds-small font-medium text-ds-brand hover:bg-ds-brand/[0.08]"
            >
              {copiado ? "Copiado ✓" : "Copiar"}
            </button>
            <a
              href={linkPortal}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-ds-md border border-ds-divider px-ds-3 py-2 font-ds-body text-ds-small font-medium text-ds-text/60 hover:text-ds-text"
            >
              Abrir
            </a>
          </div>
        </Card>
      </div>

      <div className="mt-ds-6">
        <Card>
          <p className="font-ds-body text-ds-small font-semibold text-ds-text">Qué secciones ve el cliente</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
            Apaga las que no quieras mostrar. El cambio aplica de inmediato: una sección apagada desaparece del portal y su
            información deja de estar disponible ahí.
          </p>
          <div className="mt-ds-4 flex flex-col divide-y divide-ds-divider">
            {SECCIONES.map((s) => {
              const on = Boolean(empresa[s.key]);
              return (
                <div key={s.key} className="flex items-start justify-between gap-ds-4 py-ds-4 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-ds-body text-ds-small font-medium text-ds-text">{s.titulo}</p>
                    <p className="mt-0.5 font-ds-body text-ds-caption text-ds-text/60">{s.desc}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={s.titulo}
                    disabled={guardando === s.key}
                    onClick={() => alternar(s.key)}
                    className={`relative h-6 w-11 shrink-0 rounded-ds-pill transition-colors ${on ? "bg-ds-brand" : "bg-ds-divider"} ${
                      guardando === s.key ? "opacity-50" : ""
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-ds-pill bg-white shadow transition-transform ${
                        on ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mt-ds-6">
        <Card>
          <p className="font-ds-body text-ds-small font-semibold text-ds-text">Previsualización</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Así se ve la pantalla de acceso al portal.</p>
          <div className="mt-ds-4 overflow-hidden rounded-ds-md border border-ds-divider" style={{ maxWidth: 420 }}>
            <iframe title="Vista previa del portal" src="/portal/login" className="h-[560px] w-full" />
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
