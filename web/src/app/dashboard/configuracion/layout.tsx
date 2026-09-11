"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Box, Briefcase, Calendar, ClipboardCheck, CreditCard, Layers, Paperclip, Plug, Shield, Tag, User, Users, Wallet, Wrench } from "lucide-react";
import type { Modulo } from "@bitacora/shared";
import { puedeVerModulo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell } from "@/components/DashboardShell";
import { ConfiguracionContext, type UsuarioConEmpresa } from "./ConfiguracionContext";

// modulo: null = visible para cualquier rol autenticado (ajustes
// personales, no de la empresa). El resto usa la misma matriz de
// permisos de Gestión y Control (packages/shared/src/permisos.ts) — una
// sola fuente de verdad en vez de un flag soloAdmin repetido acá.
const SECCIONES: { valor: string; label: string; icon: typeof User; modulo: Modulo | null; href?: string }[] = [
  { valor: "cuenta", label: "Cuenta", icon: User, modulo: null },
  { valor: "empresa", label: "Empresa", icon: Briefcase, modulo: "configuracion" },
  { valor: "equipo", label: "Personas", icon: Users, modulo: "gestion_control", href: "/dashboard/personas" },
  { valor: "perfiles", label: "Perfiles y permisos", icon: Shield, modulo: "gestion_control" },
  { valor: "plan", label: "Plan", icon: CreditCard, modulo: "configuracion" },
  { valor: "plantillas", label: "Plantillas", icon: Paperclip, modulo: "configuracion" },
  { valor: "checklists", label: "Checklists", icon: ClipboardCheck, modulo: "configuracion" },
  { valor: "tipos-os", label: "Tipos de OS", icon: Tag, modulo: "configuracion" },
  { valor: "tipos-trabajo", label: "Tipos de Trabajo", icon: Wrench, modulo: "configuracion" },
  { valor: "integraciones", label: "Integraciones", icon: Plug, modulo: "configuracion" },
  { valor: "inventario", label: "Inventario", icon: Box, modulo: "configuracion" },
  { valor: "categorias-gastos", label: "Categorías de Gastos", icon: Wallet, modulo: "configuracion" },
  { valor: "centros-costo", label: "Centros de Costo", icon: Layers, modulo: "configuracion" },
  // Remuneraciones dejó de ser grupo del sidebar: sus parámetros (tope
  // imponible, UF, tasas AFP…) se tocan un par de veces al año.
  { valor: "parametros-remuneracion", label: "Parámetros de remuneración", icon: CreditCard, modulo: "remuneraciones", href: "/dashboard/remuneraciones/parametros" },
  { valor: "tipos-documento", label: "Tipos de Documento", icon: Paperclip, modulo: "flota" },
  { valor: "agenda-pro", label: "Reserva online", icon: Calendar, modulo: "agenda_pro" },
  { valor: "notificaciones", label: "Notificaciones", icon: Bell, modulo: "configuracion" },
  { valor: "seguridad", label: "Seguridad", icon: Shield, modulo: null },
];

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function ConfiguracionLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [usuario, setUsuario] = useState<UsuarioConEmpresa | null>(null);
  const [modulosDeshabilitados, setModulosDeshabilitados] = useState<Modulo[]>([]);
  const [modulosVisibles, setModulosVisibles] = useState<Modulo[] | null>(null);

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
    setModulosDeshabilitados(body.modulos_deshabilitados ?? []);
    if (Array.isArray(body.modulos_visibles)) setModulosVisibles(body.modulos_visibles);
  }, [router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!usuario) return null;

  const moduloVisible = (m: Modulo) =>
    modulosVisibles !== null
      ? modulosVisibles.includes(m)
      : puedeVerModulo(usuario.rol, m) && !modulosDeshabilitados.includes(m);

  const secciones = SECCIONES.filter((s) => s.modulo === null || moduloVisible(s.modulo));

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
      <div className="grid gap-ds-6 lg:grid-cols-[14rem_1fr]">
        <nav className="flex gap-ds-1 overflow-x-auto pb-ds-2 lg:flex-col lg:overflow-visible lg:pb-0">
          {secciones.map((s) => {
            const href = s.href ?? `/dashboard/configuracion/${s.valor}`;
            const activo = pathname.startsWith(href);
            return (
              <Link
                key={s.valor}
                href={href}
                className={`flex shrink-0 items-center gap-2.5 rounded-ds-md px-ds-3 py-2 font-ds-body text-ds-small font-medium transition-colors ${
                  activo ? "bg-ds-brand/[0.08] text-ds-brand" : "text-ds-text/60 hover:bg-ds-brand/[0.08] hover:text-ds-brand"
                }`}
              >
                <s.icon size={16} strokeWidth={2.75} className="shrink-0" />
                <span className="whitespace-nowrap">{s.label}</span>
              </Link>
            );
          })}
        </nav>

        <ConfiguracionContext.Provider value={{ usuario, recargar: cargar }}>
          <div className="min-w-0">{children}</div>
        </ConfiguracionContext.Provider>
      </div>
    </DashboardShell>
  );
}
