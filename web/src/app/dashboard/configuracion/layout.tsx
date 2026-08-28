"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
} from "@/components/icons";
import { ConfiguracionContext, type UsuarioConEmpresa } from "./ConfiguracionContext";

const SECCIONES = [
  { valor: "cuenta", label: "Cuenta", icon: IconUser, soloAdmin: false },
  { valor: "empresa", label: "Empresa", icon: IconBriefcase, soloAdmin: true },
  { valor: "equipo", label: "Equipo", icon: IconUsers, soloAdmin: true, href: "/dashboard/equipo" },
  { valor: "plan", label: "Plan", icon: IconCreditCard, soloAdmin: true },
  { valor: "plantillas", label: "Plantillas", icon: IconPaperclip, soloAdmin: true },
  { valor: "checklists", label: "Checklists", icon: IconClipboardCheck, soloAdmin: true },
  { valor: "tipos-os", label: "Tipos de OS", icon: IconTag, soloAdmin: true },
  { valor: "integraciones", label: "Integraciones", icon: IconPlug, soloAdmin: true },
  { valor: "inventario", label: "Inventario", icon: IconBox, soloAdmin: true },
  { valor: "categorias-gastos", label: "Categorías de Gastos", icon: IconWallet, soloAdmin: true },
  { valor: "centros-costo", label: "Centros de Costo", icon: IconLayers, soloAdmin: true },
  { valor: "notificaciones", label: "Notificaciones", icon: IconBell, soloAdmin: true },
  { valor: "seguridad", label: "Seguridad", icon: IconShield, soloAdmin: false },
];

export default function ConfiguracionLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [usuario, setUsuario] = useState<UsuarioConEmpresa | null>(null);

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

  if (!usuario) return null;

  const secciones = SECCIONES.filter((s) => !s.soloAdmin || usuario.rol === "admin");

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
