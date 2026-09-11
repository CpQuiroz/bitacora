"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Modulo, Rol } from "@bitacora/shared";
import { puedeVerModulo } from "@bitacora/shared";
import { AsistenteChat } from "./AsistenteChat";
import { Logo } from "./Logo";
import { NotificacionesBell } from "./NotificacionesBell";
import { supabase } from "@/lib/supabase";
import { apiFetch, API_URL } from "@/lib/api";
import { limpiarImpersonacion, obtenerImpersonacion } from "@/lib/impersonacion";
import { asegurarFuenteCargada, fuenteDe } from "@/lib/fuentes";
import {
  Box,
  Briefcase,
  Calendar,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  HelpCircle,
  Home,
  Layers,
  LogOut,
  MapPin,
  Menu,
  Paperclip,
  Receipt,
  Route,
  Settings,
  Share2,
  Sparkles,
  Tag,
  Truck,
  User,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

type NavLeaf = { href: string; label: string };
type NavItem =
  | { href: string; label: string; icon: typeof Home; modulo: Modulo | null; modulos?: Modulo[]; children?: undefined }
  | { label: string; icon: typeof Home; children: NavLeaf[]; modulo: Modulo | null; modulos?: Modulo[]; href?: undefined };
type NavGroup = { titulo: string; items: NavItem[] };

// modulo: null = siempre visible (la página misma decide qué mostrarle a
// cada rol, ej. Visión general). Todo lo demás se filtra con
// puedeVerModulo. Grupos ordenados por frecuencia de uso (PASO 4 de la
// reestructuración) — un grupo entero se oculta si ningún ítem suyo es
// visible para el rol actual. Un grupo con un solo ítem visible se
// muestra como link suelto, sin encabezado.
const NAV_GROUPS: NavGroup[] = [
  {
    titulo: "Hoy",
    items: [{ href: "/dashboard", label: "Visión general", icon: Home, modulo: null }],
  },
  {
    titulo: "Operación",
    items: [
      { href: "/dashboard/agenda", label: "Agenda", icon: Calendar, modulo: "agenda" },
      // Una sola lista: trabajos y OS son la misma fila. El filtro
      // "con documento / sin documento" y el alta rápida ("Nueva OS")
      // viven dentro de la página.
      { href: "/dashboard/ordenes", label: "Órdenes de servicio", icon: ClipboardCheck, modulo: "ordenes_servicio" },
      // Módulos apagables, cada uno con su propio gate.
      { href: "/dashboard/rutas", label: "Rutas", icon: Route, modulo: "rutas" },
      { href: "/dashboard/viajes", label: "Viajes", icon: Truck, modulo: "viajes" },
    ],
  },
  {
    titulo: "Clientes",
    items: [
      { href: "/dashboard/registros/clientes", label: "Clientes", icon: MapPin, modulo: "registros" },
      // Un pack es una relación comercial con el cliente, no una pieza de
      // la operación diaria.
      { href: "/dashboard/agenda/paquetes", label: "Packs de sesiones", icon: Box, modulo: "agenda_pro" },
      { href: "/dashboard/portal-cliente", label: "Portal del cliente", icon: Share2, modulo: "configuracion" },
    ],
  },
  {
    titulo: "Dinero",
    items: [
      { href: "/dashboard/financiero/cotizaciones", label: "Cotizaciones", icon: Tag, modulo: "financiero" },
      { href: "/dashboard/financiero/cobros", label: "Cobros", icon: Receipt, modulo: "financiero" },
      { href: "/dashboard/gastos", label: "Gastos", icon: Wallet, modulo: "financiero" },
      // Remuneraciones deja de ser grupo de primer nivel: se usa una vez
      // al mes. Parámetros de remuneración pasa a Configuración.
      { href: "/dashboard/remuneraciones", label: "Liquidaciones", icon: CreditCard, modulo: "remuneraciones" },
    ],
  },
  {
    titulo: "Recursos",
    items: [
      { href: "/dashboard/registros/equipos", label: "Equipos", icon: Wrench, modulo: "registros" },
      { href: "/dashboard/registros/inventario", label: "Inventario", icon: Layers, modulo: "registros" },
      { href: "/dashboard/registros/catalogo", label: "Catálogo", icon: Tag, modulo: "registros" },
      { href: "/dashboard/registros/proveedores", label: "Proveedores", icon: Briefcase, modulo: "registros" },
    ],
  },
  {
    titulo: "Equipo",
    items: [
      // Ficha única de cada persona (identidad + acceso + datos laborales
      // + documentos) — reemplaza Flota → Colaboradores, Grupo y usuario y
      // Remuneraciones → Datos del equipo. Cada pestaña conserva su gate;
      // el ítem se muestra si el rol ve cualquiera.
      {
        href: "/dashboard/personas",
        label: "Personas",
        icon: Users,
        modulo: null,
        modulos: ["gestion_control", "flota", "remuneraciones"],
      },
      { href: "/dashboard/flota/documentos-por-vencer", label: "Documentos", icon: Paperclip, modulo: "flota" },
    ],
  },
  {
    titulo: "Informes",
    items: [
      // "Generar con IA" se fusiona: es una acción sobre los informes,
      // no un lugar aparte (se entra desde el dashboard y desde Informes).
      { href: "/dashboard/informes", label: "Informes", icon: Sparkles, modulo: "informes" },
    ],
  },
  {
    titulo: "Configuración",
    items: [{ href: "/dashboard/configuracion/cuenta", label: "Configuración", icon: Settings, modulo: null }],
  },
];

export type UsuarioShell = {
  nombre: string;
  rol: Rol;
  empresaNombre: string;
  empresaLogoUrl: string | null;
  colorPrimario?: string | null;
  colorPrimarioForeground?: string | null;
  colorSecundario?: string | null;
  fuente?: string | null;
  moneda?: string;
};

const CLAVE_COLAPSADO = "bitacora:sidebar-colapsado";

function iniciales(nombre: string) {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function DashboardShell({ usuario, children }: { usuario: UsuarioShell; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [colapsado, setColapsado] = useState(false);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<string>>(new Set());
  const [modulosDeshabilitados, setModulosDeshabilitados] = useState<Modulo[]>([]);
  // Módulos que este usuario realmente ve (rol ∩ contratados − deshabilitados),
  // resueltos por el backend desde la tabla `roles` (migración 71). null =
  // todavía no cargó → se usa el fallback sync puedeVerModulo.
  const [modulosVisibles, setModulosVisibles] = useState<Modulo[] | null>(null);
  const [impersonando, setImpersonando] = useState(false);
  const [consentimientoPendiente, setConsentimientoPendiente] = useState(false);
  const [aceptandoConsentimiento, setAceptandoConsentimiento] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.localStorage.getItem(CLAVE_COLAPSADO) === "1") setColapsado(true);
  }, []);

  // Etapa 5: qué módulos están desactivados para esta empresa (aparte
  // del rol) — fetch propio, independiente del que ya hizo la página
  // que renderiza este shell, para no tener que propagar el dato por
  // props a las ~30 páginas que construyen UsuarioShell.
  useEffect(() => {
    (async () => {
      const res = await apiFetch("/api/me");
      if (res.ok) {
        const body = await res.json();
        setModulosDeshabilitados(body.modulos_deshabilitados ?? []);
        if (Array.isArray(body.modulos_visibles)) setModulosVisibles(body.modulos_visibles);
        // La verdad la tiene el servidor: si NO viene impersonacion pero
        // hay un token guardado, quedó viejo/vencido — limpiarlo.
        if (body.impersonacion) setImpersonando(true);
        else if (obtenerImpersonacion()) limpiarImpersonacion();
        setConsentimientoPendiente(Boolean(body.consentimiento_pendiente));
      }
    })();
  }, []);

  async function aceptarConsentimiento() {
    setAceptandoConsentimiento(true);
    const res = await apiFetch("/api/consentimiento", { method: "POST" });
    setAceptandoConsentimiento(false);
    if (res.ok) setConsentimientoPendiente(false);
  }

  // Cuando se cumplen los 30 min, salir solo (el backend ya rechaza el
  // token vencido — esto es para que la UI no se quede colgada).
  useEffect(() => {
    if (!impersonando) return;
    const imp = obtenerImpersonacion();
    if (!imp) return;
    const t = setTimeout(() => {
      limpiarImpersonacion();
      window.location.href = "/superadmin";
    }, Math.max(0, imp.expira - Date.now()));
    return () => clearTimeout(t);
  }, [impersonando]);

  async function salirImpersonacion() {
    const imp = obtenerImpersonacion();
    if (imp) {
      await fetch(`${API_URL}/api/superadmin/impersonar/finalizar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${imp.token}` },
      }).catch(() => {});
    }
    limpiarImpersonacion();
    // Navegación completa: resetea todo el estado del dashboard y vuelve
    // al panel, que lee su propia sesión de super-admin (sin re-login).
    window.location.href = "/superadmin";
  }

  useEffect(() => {
    asegurarFuenteCargada(usuario.fuente);
  }, [usuario.fuente]);

  // admin/supervisor están obligados a tener 2FA activo (backend lo
  // exige en requiereEmpresa) — mismo criterio que modulosDeshabilitados
  // arriba: fetch propio acá, para no propagar el dato por props a las
  // ~30 páginas que construyen UsuarioShell. Si todavía no lo activó,
  // lo manda directo a Configuración > Seguridad a configurarlo.
  useEffect(() => {
    if (usuario.rol !== "admin" && usuario.rol !== "supervisor") return;
    if (pathname === "/dashboard/configuracion/seguridad") return;
    (async () => {
      const res = await apiFetch("/api/usuarios/me/mfa");
      if (!res.ok) return;
      const { activado } = await res.json();
      if (!activado) router.replace("/dashboard/configuracion/seguridad");
    })();
  }, [usuario.rol, pathname, router]);

  // Trial vencido sin plan elegido (backend lo exige en requiereEmpresa,
  // código TRIAL_VENCIDO) — mismo criterio que el gate de 2FA de arriba:
  // fetch propio acá contra una ruta exceptuada del gate (/api/plan), en
  // vez de propagar el dato por props. Lo manda a Configuración > Plan.
  useEffect(() => {
    if (pathname === "/dashboard/configuracion/plan") return;
    (async () => {
      const res = await apiFetch("/api/plan");
      if (!res.ok) return;
      const body = await res.json().catch(() => ({}));
      if (body.trialVencido) router.replace("/dashboard/configuracion/plan");
    })();
  }, [pathname, router]);

  useEffect(() => {
    setGruposAbiertos((prev) => {
      const next = new Set(prev);
      for (const item of NAV_GROUPS.flatMap((g) => g.items)) {
        if (item.children?.some((c) => pathname.startsWith(c.href))) next.add(item.label);
      }
      return next;
    });
  }, [pathname]);

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownAbierto(false);
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, []);

  function alternarColapsado() {
    setColapsado((prev) => {
      const next = !prev;
      window.localStorage.setItem(CLAVE_COLAPSADO, next ? "1" : "0");
      return next;
    });
  }

  function alternarGrupo(label: string) {
    setGruposAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const fuenteInfo = fuenteDe(usuario.fuente);
  const temaStyle: CSSProperties = {
    // font-family (no solo la custom property) para que el valor local
    // de --font-sans efectivamente se aplique acá y herede hacia abajo —
    // solo sobreescribir la variable no alcanza porque <body> ya resolvió
    // la suya con el valor de :root, más arriba en el árbol.
    fontFamily: "var(--font-sans)",
    // Color de la empresa:
    // · --accent  → sistema viejo "Faena" (en migración, se retira con él).
    // · --ds-brand → sistema nuevo. Pisa el fallback de tokens.css; los
    //   derivados --ds-brand-hover/pressed se recalculan solos en OKLCH
    //   dentro de este scope porque referencian var(--ds-brand).
    ...(usuario.colorPrimario
      ? {
          "--accent": usuario.colorPrimario,
          "--ds-brand": usuario.colorPrimario,
          ...(usuario.colorPrimarioForeground
            ? { "--ds-brand-foreground": usuario.colorPrimarioForeground }
            : {}),
        }
      : {}),
    ...(usuario.fuente && usuario.fuente !== "sistema" ? { "--font-sans": fuenteInfo.pila } : {}),
  } as CSSProperties;

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // Fuente de verdad: `modulos_visibles` de /api/me (rol dinámico ∩
  // contratados). Mientras carga se usa el fallback sync sobre los roles
  // de sistema para no parpadear una navegación vacía.
  const moduloVisible = (m: Modulo) =>
    modulosVisibles !== null
      ? modulosVisibles.includes(m)
      : puedeVerModulo(usuario.rol, m) && !modulosDeshabilitados.includes(m);

  // Un grupo entero se oculta si, tras filtrar por módulo, no le queda
  // ningún ítem visible (ej. "Datos" para un rol contador) — nunca se
  // muestra un encabezado de sección flotando sin nada debajo.
  const gruposVisibles = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) =>
      item.modulos ? item.modulos.some(moduloVisible) : item.modulo === null || moduloVisible(item.modulo)
    ),
  })).filter((g) => g.items.length > 0);

  function esActivoLeaf(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    // Configuración enlaza a /cuenta pero debe verse activo en cualquiera
    // de sus subsecciones (seguridad, empresa, plantillas, etc.).
    if (href === "/dashboard/configuracion/cuenta") return pathname.startsWith("/dashboard/configuracion");
    return pathname.startsWith(href);
  }

  function renderNav(compacto: boolean) {
    return (
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
        {gruposVisibles.map((grupo, i) =>
          compacto ? (
            <div key={grupo.titulo} className={i > 0 ? "mt-2 border-t border-ds-divider pt-2" : ""}>
              {renderItems(grupo.items, compacto)}
            </div>
          ) : grupo.items.length === 1 ? (
            // Grupo con un solo ítem visible (roles acotados, ej. contador/
            // colaborador) — se muestra como link suelto, sin encabezado de
            // sección, para no dejar un título flotando sobre una sola línea.
            <div key={grupo.titulo} className={i > 0 ? "pt-4" : "pt-1"}>
              {renderItems(grupo.items, compacto)}
            </div>
          ) : (
            <div key={grupo.titulo}>
              <p
                className={`px-3 pb-1 font-ds-body text-[11px] font-semibold uppercase tracking-[0.12em] text-ds-text/60 ${
                  i > 0 ? "pt-4" : "pt-1"
                }`}
              >
                {grupo.titulo}
              </p>
              {renderItems(grupo.items, compacto)}
            </div>
          )
        )}
      </nav>
    );
  }

  function renderItems(items: NavItem[], compacto: boolean) {
    return (
      <div className="flex flex-col gap-0.5">
        {items.map((item) => {
          if (item.children) {
            const activo = item.children.some((c) => pathname.startsWith(c.href));
            const abierto = !compacto && (gruposAbiertos.has(item.label) || activo);
            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => alternarGrupo(item.label)}
                  title={compacto ? item.label : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 font-ds-body text-sm font-medium transition-colors ${
                    activo ? "bg-ds-brand text-ds-brand-foreground" : "text-ds-text/70 hover:bg-ds-text/[0.06] hover:text-ds-text"
                  }`}
                >
                  <item.icon size={18} strokeWidth={2.75} className="shrink-0" />
                  {!compacto && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronRight size={14} strokeWidth={2.75} className={`shrink-0 transition-transform ${abierto ? "rotate-90" : ""}`} />
                    </>
                  )}
                </button>
                {abierto && (
                  <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-ds-divider pl-3">
                    {item.children.map((c) => {
                      const activoHijo = pathname.startsWith(c.href);
                      return (
                        <Link
                          key={c.href}
                          href={c.href}
                          onClick={() => setMenuMovilAbierto(false)}
                          className={`rounded-lg px-3 py-1.5 font-ds-body text-sm transition-colors ${
                            activoHijo ? "font-medium text-ds-brand" : "text-ds-text/70 hover:text-ds-brand"
                          }`}
                        >
                          {c.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          const activo = esActivoLeaf(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuMovilAbierto(false)}
              title={compacto ? item.label : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 font-ds-body text-sm font-medium transition-colors ${
                activo ? "bg-ds-brand text-ds-brand-foreground" : "text-ds-text/70 hover:bg-ds-text/[0.06] hover:text-ds-text"
              }`}
            >
              <item.icon size={18} strokeWidth={2.75} className="shrink-0" />
              {!compacto && item.label}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {impersonando && (
        <div className="fixed inset-x-0 top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ds-accent-700 px-4 py-2 text-center font-ds-body text-xs font-medium text-white print:hidden">
          <span>
            Estás viendo Bitácora como <strong>{usuario.nombre}</strong> — sesión de impersonación de Super-Admin (solo debug, acciones
            destructivas bloqueadas).
          </span>
          <button
            type="button"
            onClick={salirImpersonacion}
            className="rounded bg-white/20 px-2 py-0.5 font-semibold hover:bg-white/30"
          >
            Salir de impersonación
          </button>
        </div>
      )}
      {consentimientoPendiente && !impersonando && (
        <div className="fixed inset-x-0 top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ds-accent2-700 px-4 py-2 text-center font-ds-body text-xs font-medium text-white print:hidden">
          <span>
            Actualizamos la Política de Privacidad y los Términos.{" "}
            <a href="/privacidad" target="_blank" className="underline">Revisar</a>.
          </span>
          <button
            type="button"
            onClick={aceptarConsentimiento}
            disabled={aceptandoConsentimiento}
            className="rounded bg-white/20 px-2 py-0.5 font-semibold hover:bg-white/30 disabled:opacity-60"
          >
            {aceptandoConsentimiento ? "Guardando…" : "Aceptar"}
          </button>
        </div>
      )}
      <div className={`flex min-h-screen bg-ds-bg ${impersonando || (consentimientoPendiente && !impersonando) ? "pt-9" : ""}`} style={temaStyle}>
      {/* Sidebar de escritorio */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-ds-divider bg-ds-surface transition-[width] duration-150 print:hidden sm:flex ${
          colapsado ? "w-[68px]" : "w-64"
        }`}
      >
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2 border-b border-ds-divider px-4 py-4">
          {usuario.empresaLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={usuario.empresaLogoUrl} alt={usuario.empresaNombre} className="h-8 w-8 shrink-0 rounded-lg object-cover" />
          ) : (
            <Logo markClassName="h-8 w-8 shrink-0" />
          )}
          {!colapsado && <span className="truncate font-ds-body text-sm font-semibold text-ds-text">{usuario.empresaNombre}</span>}
        </Link>

        {renderNav(colapsado)}

        <button
          type="button"
          onClick={alternarColapsado}
          className="flex items-center justify-center gap-2 border-t border-ds-divider py-2.5 font-ds-body text-xs font-medium text-ds-text/60 transition-colors hover:bg-ds-brand/[0.08] hover:text-ds-brand"
        >
          <ChevronRight size={14} strokeWidth={2.75} className={`transition-transform ${colapsado ? "" : "rotate-180"}`} />
          {!colapsado && "Contraer"}
        </button>
      </aside>

      {/* Drawer móvil */}
      {menuMovilAbierto && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <div className="absolute inset-0 bg-ds-text/40" onClick={() => setMenuMovilAbierto(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-ds-surface shadow-ds-lg">
            <Link href="/dashboard" onClick={() => setMenuMovilAbierto(false)} className="flex items-center gap-2 border-b border-ds-divider px-4 py-4">
              {usuario.empresaLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={usuario.empresaLogoUrl} alt={usuario.empresaNombre} className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <Logo markClassName="h-8 w-8" />
              )}
              <span className="truncate font-ds-body text-sm font-semibold text-ds-text">{usuario.empresaNombre}</span>
            </Link>
            {renderNav(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-ds-divider bg-ds-surface px-4 py-3 print:hidden sm:px-6">
          <button
            type="button"
            onClick={() => setMenuMovilAbierto(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ds-text/60 hover:bg-ds-brand/[0.08] hover:text-ds-brand sm:hidden"
          >
            <Menu size={20} strokeWidth={2.75} />
          </button>

          <div className="ml-auto">
            <NotificacionesBell />
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownAbierto((v) => !v)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-ds-brand/[0.08]"
            >
              <span className="hidden text-right font-ds-body text-sm sm:block">
                <span className="block font-medium text-ds-text">{usuario.nombre}</span>
                <span className="block text-[10px] uppercase tracking-[0.08em] text-ds-text/60">{usuario.rol}</span>
              </span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ds-brand font-ds-body text-xs font-semibold text-ds-brand-foreground">
                {iniciales(usuario.nombre)}
              </span>
            </button>

            {dropdownAbierto && (
              <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-lg border border-ds-divider bg-ds-surface py-1 shadow-ds-md">
                <Link
                  href="/dashboard/perfil"
                  onClick={() => setDropdownAbierto(false)}
                  className="flex items-center gap-2 px-4 py-2 font-ds-body text-sm text-ds-text hover:bg-ds-brand/[0.08] hover:text-ds-brand"
                >
                  <User size={16} strokeWidth={2.75} />
                  Perfil
                </Link>
                <Link
                  href="/dashboard/configuracion/cuenta"
                  onClick={() => setDropdownAbierto(false)}
                  className="flex items-center gap-2 px-4 py-2 font-ds-body text-sm text-ds-text hover:bg-ds-brand/[0.08] hover:text-ds-brand"
                >
                  <Settings size={16} strokeWidth={2.75} />
                  Configuración
                </Link>
                <Link
                  href="/dashboard/ayuda"
                  onClick={() => setDropdownAbierto(false)}
                  className="flex items-center gap-2 px-4 py-2 font-ds-body text-sm text-ds-text hover:bg-ds-brand/[0.08] hover:text-ds-brand"
                >
                  <HelpCircle size={16} strokeWidth={2.75} />
                  Ayuda
                </Link>
                <div className="my-1 border-t border-ds-divider" />
                <button
                  type="button"
                  onClick={cerrarSesion}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left font-ds-body text-sm text-ds-accent-700 hover:bg-ds-accent-100"
                >
                  <LogOut size={16} strokeWidth={2.75} />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1">
          <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
        </main>
      </div>

      {moduloVisible("asistente") && <AsistenteChat />}
      </div>
    </>
  );
}
