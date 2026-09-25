"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Box, Briefcase, Calendar, ClipboardCheck, CreditCard, Flag, Layers, Paperclip, Plug, Share2, Shield, Tag, Truck, User, Users, Wallet, LayoutGrid } from "lucide-react";
import type { Modulo } from "@bitacora/shared";
import { INTEGRACIONES_VISIBLES, puedeVerModulo } from "@bitacora/shared";
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
  // Tarea 124, etapa 3: elegir secciones dentro del tope del plan.
  { valor: "modulos", label: "Módulos", icon: LayoutGrid, modulo: "configuracion" },
  { valor: "plantillas", label: "Plantillas", icon: Paperclip, modulo: "configuracion" },
  { valor: "checklists", label: "Checklists", icon: ClipboardCheck, modulo: "configuracion" },
  { valor: "tipos-os-trabajo", label: "Tipos de OS/Trabajo", icon: Tag, modulo: "configuracion" },
  // Tarea 144: oculta mientras INTEGRACIONES_VISIBLES sea false.
  ...(INTEGRACIONES_VISIBLES ? [{ valor: "integraciones", label: "Integraciones", icon: Plug, modulo: "configuracion" as Modulo }] : []),
  { valor: "inventario", label: "Inventario", icon: Box, modulo: "configuracion" },
  { valor: "categorias-gastos", label: "Categorías de Gastos", icon: Wallet, modulo: "configuracion" },
  { valor: "centros-costo", label: "Centros de Costo", icon: Layers, modulo: "configuracion" },
  { valor: "cotizacion-etapas", label: "Etapas de Cotización", icon: Flag, modulo: "configuracion" },
  // Tarea 137: montos por defecto del viático del chofer.
  { valor: "viajes", label: "Viajes", icon: Truck, modulo: "viajes" },
  // Remuneraciones dejó de ser grupo del sidebar: sus parámetros (tope
  // imponible, UF, tasas AFP…) se tocan un par de veces al año.
  { valor: "parametros-remuneracion", label: "Parámetros de remuneración", icon: CreditCard, modulo: "remuneraciones", href: "/dashboard/remuneraciones/parametros" },
  { valor: "tipos-documento", label: "Tipos de Documento", icon: Paperclip, modulo: "flota" },
  { valor: "agenda-pro", label: "Reserva online", icon: Calendar, modulo: "agenda_pro" },
  { valor: "portal-cliente", label: "Portal del cliente", icon: Share2, modulo: "configuracion", href: "/dashboard/portal-cliente" },
  { valor: "notificaciones", label: "Notificaciones", icon: Bell, modulo: "configuracion" },
  { valor: "seguridad", label: "Seguridad", icon: Shield, modulo: null },
];

// Tarea 144: con la prueba vencida solo quedan Plan, Módulos (para caber
// en el tope del plan), Mi cuenta y Seguridad.
const SECCIONES_CON_PRUEBA_VENCIDA = ["cuenta", "plan", "modulos", "seguridad"];

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function ConfiguracionLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [usuario, setUsuario] = useState<UsuarioConEmpresa | null>(null);
  const [modulosDeshabilitados, setModulosDeshabilitados] = useState<Modulo[]>([]);
  const [modulosVisibles, setModulosVisibles] = useState<Modulo[] | null>(null);
  const [pruebaVencida, setPruebaVencida] = useState(false);

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
    setPruebaVencida(Boolean(body.prueba_vencida));
  }, [router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!usuario) return null;

  const moduloVisible = (m: Modulo) =>
    modulosVisibles !== null
      ? modulosVisibles.includes(m)
      : puedeVerModulo(usuario.rol, m) && !modulosDeshabilitados.includes(m);

  const secciones = SECCIONES.filter(
    (s) => (s.modulo === null || moduloVisible(s.modulo)) && (!pruebaVencida || SECCIONES_CON_PRUEBA_VENCIDA.includes(s.valor))
  );

  return (
    <DashboardShell
      usuario={{
        nombre: usuario.nombre,
        rol: usuario.rol,
        empresaNombre: usuario.empresa.nombre,
        empresaLogoUrl: usuario.empresa.logo_url,
        colorPrimario: usuario.empresa.color_primario,
        tema: usuario.empresa.tema,
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
