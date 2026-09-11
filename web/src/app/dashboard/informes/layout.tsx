"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, ClipboardCheck, Receipt, Tag, Users, Wallet, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell } from "@/components/DashboardShell";
import { Button, Input } from "@bitacora/ui/web";
import { PERIODOS, resolverPeriodo, type PeriodoValor } from "@/lib/periodo";
import { InformesContext, type UsuarioConEmpresa } from "./InformesContext";

const TABS = [
  { valor: "vision-general", label: "Visión General", icon: BarChart3 },
  { valor: "financiero", label: "Financiero", icon: Wallet },
  { valor: "ventas", label: "Ventas", icon: Tag },
  { valor: "operaciones", label: "Operaciones", icon: ClipboardCheck },
  { valor: "servicios", label: "Servicios", icon: Wrench },
  { valor: "clientes", label: "Clientes", icon: Users },
  { valor: "gastos", label: "Gastos", icon: Receipt },
];

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function InformesLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [usuario, setUsuario] = useState<UsuarioConEmpresa | null>(null);

  const [periodo, setPeriodo] = useState<PeriodoValor>("30d");
  const [desdePersonalizado, setDesdePersonalizado] = useState("");
  const [hastaPersonalizado, setHastaPersonalizado] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportCsv, setExportCsv] = useState<(() => void) | null>(null);
  // useState trata un valor función como una función actualizadora, no
  // como el nuevo estado — hay que envolverla para que se guarde tal cual.
  const registrarExportCsv = useCallback((fn: (() => void) | null) => {
    setExportCsv(() => fn);
  }, []);

  const cargar = useCallback(async () => {
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
    if (!body.usuario) {
      router.replace("/onboarding");
      return;
    }
    setUsuario(body.usuario);
  }, [router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const { desde, hasta } = useMemo(
    () => resolverPeriodo(periodo, desdePersonalizado, hastaPersonalizado),
    [periodo, desdePersonalizado, hastaPersonalizado]
  );

  if (!usuario) return null;

  return (
    <DashboardShell
      usuario={{
        nombre: usuario.nombre,
        rol: usuario.rol,
        empresaNombre: usuario.empresa.nombre,
        empresaLogoUrl: usuario.empresa.logo_url,
        colorPrimario: usuario.empresa.color_primario,
        colorPrimarioForeground: usuario.empresa.color_primario_foreground,
        colorSecundario: usuario.empresa.color_secundario,
        fuente: usuario.empresa.fuente,
        moneda: usuario.empresa.moneda,
      }}
    >
      <p className="ds-heading text-ds-h2 text-ds-text">Informes</p>
      <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Análisis detallado de tu negocio</p>

      <nav className="mt-ds-6 flex gap-ds-1 overflow-x-auto border-b border-ds-divider pb-px print:hidden">
        {TABS.map((t) => {
          const href = `/dashboard/informes/${t.valor}`;
          const activo = pathname.startsWith(href);
          return (
            <Link
              key={t.valor}
              href={href}
              className={`flex shrink-0 items-center gap-ds-2 whitespace-nowrap border-b-2 px-ds-3 py-2.5 font-ds-body text-ds-small font-medium transition-colors ${
                activo ? "border-ds-brand text-ds-brand" : "border-transparent text-ds-text/60 hover:text-ds-text"
              }`}
            >
              <t.icon size={16} strokeWidth={2.75} className="shrink-0" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-ds-4 flex flex-wrap items-center gap-ds-2 print:hidden">
        {PERIODOS.map((p) => (
          <button
            key={p.valor}
            type="button"
            onClick={() => setPeriodo(p.valor)}
            className={`rounded-ds-pill border px-ds-3 py-1 font-ds-body text-ds-caption font-medium transition-colors ${
              periodo === p.valor ? "border-ds-brand bg-ds-brand/[0.08] text-ds-brand" : "border-ds-divider text-ds-text/70 hover:border-ds-text/30"
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
        <div className="ml-auto flex gap-ds-2 print:hidden">
          {!pathname.endsWith("/vision-general") && (
            <>
              <Button variante="secundario" deshabilitado={!exportCsv} onPress={() => exportCsv?.()}>
                CSV
              </Button>
              <Button variante="secundario" onPress={() => window.print()}>
                PDF
              </Button>
            </>
          )}
          <Button variante="secundario" onPress={() => setRefreshKey((k) => k + 1)}>
            Actualizar
          </Button>
        </div>
      </div>

      {periodo === "personalizado" && (
        <div className="mt-ds-3 flex flex-wrap items-end gap-ds-3 print:hidden">
          <FechaCampo etiqueta="Desde" valor={desdePersonalizado} onCambio={setDesdePersonalizado} />
          <FechaCampo etiqueta="Hasta" valor={hastaPersonalizado} onCambio={setHastaPersonalizado} />
        </div>
      )}

      <InformesContext.Provider
        value={{
          usuario,
          periodo,
          desde,
          hasta,
          refreshKey,
          cambiarPeriodo: setPeriodo,
          cambiarRangoPersonalizado: (d, h) => {
            setDesdePersonalizado(d);
            setHastaPersonalizado(h);
          },
          actualizar: () => setRefreshKey((k) => k + 1),
          registrarExportCsv,
        }}
      >
        <div className="mt-ds-6">{children}</div>
      </InformesContext.Provider>
    </DashboardShell>
  );
}

// Input nativo type="date" — ver el mismo helper en rutas/nueva/page.tsx.
function FechaCampo({ etiqueta, valor, onCambio }: { etiqueta: string; valor: string; onCambio: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-ds-1">
      <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">{etiqueta}</label>
      <input
        type="date"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="h-11 w-full rounded-ds-md border border-ds-divider bg-ds-surface px-ds-3 font-ds-body text-ds-body text-ds-text transition-colors hover:border-ds-text/30 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
      />
    </div>
  );
}
