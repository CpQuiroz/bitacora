"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Modulo } from "@bitacora/shared";
import { puedeVerModulo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell } from "@/components/DashboardShell";
import {
  IconBell,
  IconBox,
  IconBriefcase,
  IconClipboardCheck,
  IconCreditCard,
  IconLayers,
  IconPaperclip,
  IconPlug,
  IconShield,
  IconTag,
  IconUser,
  IconUsers,
  IconWallet,
  IconWrench,
} from "@/components/icons";
import { ConfiguracionContext, type UsuarioConEmpresa } from "./ConfiguracionContext";

// modulo: null = visible para cualquier rol autenticado (ajustes
// personales, no de la empresa). El resto usa la misma matriz de
// permisos de Gestión y Control (packages/shared/src/permisos.ts) — una
// sola fuente de verdad en vez de un flag soloAdmin repetido acá.
const SECCIONES: { valor: string; label: string; icon: typeof IconUser; modulo: Modulo | null; href?: string }[] = [
  { valor: "cuenta", label: "Cuenta", icon: IconUser, modulo: null },
  { valor: "empresa", label: "Empresa", icon: IconBriefcase, modulo: "configuracion" },
  { valor: "equipo", label: "Equipo", icon: IconUsers, modulo: "gestion_control", href: "/dashboard/equipo" },
  { valor: "plan", label: "Plan", icon: IconCreditCard, modulo: "configuracion" },
  { valor: "plantillas", label: "Plantillas", icon: IconPaperclip, modulo: "configuracion" },
  { valor: "checklists", label: "Checklists", icon: IconClipboardCheck, modulo: "configuracion" },
  { valor: "tipos-os", label: "Tipos de OS", icon: IconTag, modulo: "configuracion" },
  { valor: "tipos-trabajo", label: "Tipos de Trabajo", icon: IconWrench, modulo: "configuracion" },
  { valor: "integraciones", label: "Integraciones", icon: IconPlug, modulo: "configuracion" },
  { valor: "inventario", label: "Inventario", icon: IconBox, modulo: "configuracion" },
  { valor: "categorias-gastos", label: "Categorías de Gastos", icon: IconWallet, modulo: "configuracion" },
  { valor: "centros-costo", label: "Centros de Costo", icon: IconLayers, modulo: "configuracion" },
  { valor: "tipos-documento", label: "Tipos de Documento", icon: IconPaperclip, modulo: "flota" },
  { valor: "notificaciones", label: "Notificaciones", icon: IconBell, modulo: "configuracion" },
  { valor: "seguridad", label: "Seguridad", icon: IconShield, modulo: null },
];

export default function ConfiguracionLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [usuario, setUsuario] = useState<UsuarioConEmpresa | null>(null);
  const [modulosDeshabilitados, setModulosDeshabilitados] = useState<Modulo[]>([]);

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
  }, [router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!usuario) return null;

  const secciones = SECCIONES.filter(
    (s) => s.modulo === null || (puedeVerModulo(usuario.rol, s.modulo) && !modulosDeshabilitados.includes(s.modulo))
  );

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
      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <nav className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
          {secciones.map((s) => {
            const href = s.href ?? `/dashboard/configuracion/${s.valor}`;
            const activo = pathname.startsWith(href);
            return (
              <Link
                key={s.valor}
                href={href}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activo ? "bg-brand-soft text-brand" : "text-muted hover:bg-brand-soft hover:text-brand"
                }`}
              >
                <s.icon className="h-4 w-4 shrink-0" />
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
