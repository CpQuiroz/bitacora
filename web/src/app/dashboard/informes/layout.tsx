"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell } from "@/components/DashboardShell";
import { Button, Input, PageHeader } from "@/components/ui";
import { PERIODOS, resolverPeriodo, type PeriodoValor } from "@/lib/periodo";
import { IconChartBar, IconClipboardCheck, IconReceipt, IconTag, IconUsers, IconWallet, IconWrench } from "@/components/icons";
import { InformesContext, type UsuarioConEmpresa } from "./InformesContext";

const TABS = [
  { valor: "vision-general", label: "Visión General", icon: IconChartBar },
  { valor: "financiero", label: "Financiero", icon: IconWallet },
  { valor: "ventas", label: "Ventas", icon: IconTag },
  { valor: "operaciones", label: "Operaciones", icon: IconClipboardCheck },
  { valor: "servicios", label: "Servicios", icon: IconWrench },
  { valor: "clientes", label: "Clientes", icon: IconUsers },
  { valor: "gastos", label: "Gastos", icon: IconReceipt },
];

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
      <PageHeader title="Informes" subtitle="Análisis detallado de tu negocio" />

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-border pb-px print:hidden">
        {TABS.map((t) => {
          const href = `/dashboard/informes/${t.valor}`;
          const activo = pathname.startsWith(href);
          return (
            <Link
              key={t.valor}
              href={href}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                activo ? "border-brand text-brand" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4 shrink-0" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
        {PERIODOS.map((p) => (
          <button
            key={p.valor}
            type="button"
            onClick={() => setPeriodo(p.valor)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              periodo === p.valor ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:border-muted-soft"
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
        <div className="ml-auto flex gap-2 print:hidden">
          {!pathname.endsWith("/vision-general") && (
            <>
              <Button type="button" variant="outline" disabled={!exportCsv} onClick={() => exportCsv?.()}>
                CSV
              </Button>
              <Button type="button" variant="outline" onClick={() => window.print()}>
                PDF
              </Button>
            </>
          )}
          <Button type="button" variant="outline" onClick={() => setRefreshKey((k) => k + 1)}>
            Actualizar
          </Button>
        </div>
      </div>

      {periodo === "personalizado" && (
        <div className="mt-3 flex flex-wrap items-end gap-3 print:hidden">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Desde</label>
            <Input type="date" value={desdePersonalizado} onChange={(e) => setDesdePersonalizado(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Hasta</label>
            <Input type="date" value={hastaPersonalizado} onChange={(e) => setHastaPersonalizado(e.target.value)} />
          </div>
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
        <div className="mt-6">{children}</div>
      </InformesContext.Provider>
    </DashboardShell>
  );
}
