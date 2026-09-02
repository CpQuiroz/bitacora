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
  IconBox,
  IconCalendar,
  IconChat,
  IconChevronRight,
  IconClipboardCheck,
  IconHelp,
  IconHome,
  IconLogOut,
  IconMapPin,
  IconMenu,
  IconReceipt,
  IconRoute,
  IconSettings,
  IconShield,
  IconSparkle,
  IconTag,
  IconTruck,
  IconUser,
  IconUsers,
  IconWallet,
} from "./icons";

type NavLeaf = { href: string; label: string };
type NavItem =
  | { href: string; label: string; icon: typeof IconHome; modulo: Modulo | null; children?: undefined }
  | { label: string; icon: typeof IconHome; children: NavLeaf[]; modulo: Modulo | null; href?: undefined };
type NavGroup = { titulo: string; items: NavItem[] };

// modulo: null = siempre visible (la página misma decide qué mostrarle a
// cada rol, ej. Dashboard). Todo lo demás se filtra con puedeVerModulo.
// Agrupado en bloques visuales (encabezado sutil, no acordeón) — un grupo
// entero se oculta si ningún ítem suyo es visible para el rol actual.
const NAV_GROUPS: NavGroup[] = [
  {
    titulo: "Operación",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: IconHome, modulo: null },
      { href: "/dashboard/agenda", label: "Agenda", icon: IconCalendar, modulo: "agenda" },
      // Superficie propia de Agenda Pro — solo aparece para empresas con el
      // módulo opt-in activado (ver empresa_modulos / Etapa 5). Ítem aparte
      // de "Agenda" (no anidado) para no convertir el link directo de
      // Agenda en un desplegable.
      { href: "/dashboard/agenda/paquetes", label: "Paquetes", icon: IconBox, modulo: "agenda_pro" },
      {
        label: "Órdenes de Servicio",
        icon: IconClipboardCheck,
        modulo: "ordenes_servicio",
        children: [
          // "Nueva OS" ya no vive acá — es el botón "+ Nueva OS" del
          // listado (mismo patrón que Clientes/Equipos/Catálogo).
          { href: "/dashboard/ordenes", label: "Todas las OS" },
          { href: "/dashboard/trabajos", label: "Trabajos" },
        ],
      },
      // Módulo propio "rutas" (distinto de "ordenes_servicio") — antes vivía
      // anidado dentro de Órdenes de Servicio y se gateaba con el módulo del
      // padre, no el suyo.
      { href: "/dashboard/rutas", label: "Rutas", icon: IconRoute, modulo: "rutas" },
      { href: "/dashboard/viajes", label: "Viajes", icon: IconTruck, modulo: "viajes" },
    ],
  },
  {
    titulo: "Datos",
    items: [
      {
        label: "Registros",
        icon: IconMapPin,
        modulo: "registros",
        children: [
          { href: "/dashboard/registros/clientes", label: "Clientes" },
          { href: "/dashboard/registros/equipos", label: "Equipos" },
          { href: "/dashboard/registros/catalogo", label: "Catálogo" },
          { href: "/dashboard/registros/inventario", label: "Inventario" },
          { href: "/dashboard/registros/proveedores", label: "Proveedores" },
        ],
      },
      {
        label: "Flota",
        icon: IconUsers,
        modulo: "flota",
        children: [
          { href: "/dashboard/flota/colaboradores", label: "Colaboradores" },
          { href: "/dashboard/flota/documentos-por-vencer", label: "Documentos" },
        ],
      },
    ],
  },
  {
    titulo: "Financiero",
    items: [
      { href: "/dashboard/financiero/cotizaciones", label: "Cotizaciones", icon: IconTag, modulo: "financiero" },
      { href: "/dashboard/gastos", label: "Gastos", icon: IconWallet, modulo: "financiero" },
      { href: "/dashboard/financiero/cobros", label: "Cobros", icon: IconReceipt, modulo: "financiero" },
    ],
  },
  {
    titulo: "Remuneraciones",
    items: [
      {
        label: "Remuneraciones",
        icon: IconWallet,
        modulo: "remuneraciones",
        children: [
          { href: "/dashboard/remuneraciones", label: "Liquidaciones" },
          { href: "/dashboard/remuneraciones/datos-laborales", label: "Datos del equipo" },
          { href: "/dashboard/remuneraciones/parametros", label: "Parámetros" },
        ],
      },
    ],
  },
  {
    titulo: "Análisis",
    items: [
      { href: "/dashboard/informes", label: "Informes", icon: IconSparkle, modulo: "informes" },
      { href: "/dashboard/informe", label: "Generar con IA", icon: IconChat, modulo: "informe_ia" },
    ],
  },
  {
    titulo: "Administración",
    items: [
      { href: "/dashboard/equipo", label: "Grupo y usuario", icon: IconShield, modulo: "gestion_control" },
      // "Configuración" vive en el menú del usuario (arriba a la derecha),
      // no acá.
    ],
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
  const [impersonando, setImpersonando] = useState(false);
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
        // La verdad la tiene el servidor: si NO viene impersonacion pero
        // hay un token guardado, quedó viejo/vencido — limpiarlo.
        if (body.impersonacion) setImpersonando(true);
        else if (obtenerImpersonacion()) limpiarImpersonacion();
      }
    })();
  }, []);

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
    ...(usuario.colorPrimario
      ? {
          "--brand": usuario.colorPrimario,
          "--brand-foreground": usuario.colorPrimarioForeground || "#ffffff",
          "--brand-soft": `color-mix(in srgb, ${usuario.colorPrimario} 14%, var(--surface))`,
        }
      : {}),
    ...(usuario.colorSecundario ? { "--accent": usuario.colorSecundario } : {}),
    ...(usuario.fuente && usuario.fuente !== "sistema" ? { "--font-sans": fuenteInfo.pila } : {}),
  } as CSSProperties;

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // Un grupo entero se oculta si, tras filtrar por módulo, no le queda
  // ningún ítem visible (ej. "Datos" para un rol contador) — nunca se
  // muestra un encabezado de sección flotando sin nada debajo.
  const gruposVisibles = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter(
      (item) =>
        item.modulo === null ||
        (puedeVerModulo(usuario.rol, item.modulo) && !modulosDeshabilitados.includes(item.modulo))
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
            <div key={grupo.titulo} className={i > 0 ? "mt-2 border-t border-border pt-2" : ""}>
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
              <p className={`px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted ${i > 0 ? "pt-4" : "pt-1"}`}>
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
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activo ? "bg-brand-soft text-brand" : "text-muted hover:bg-brand-soft hover:text-brand"
                  }`}
                >
                  <item.icon className="h-4.5 w-4.5 shrink-0" />
                  {!compacto && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      <IconChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${abierto ? "rotate-90" : ""}`} />
                    </>
                  )}
                </button>
                {abierto && (
                  <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-3">
                    {item.children.map((c) => {
                      const activoHijo = pathname.startsWith(c.href);
                      return (
                        <Link
                          key={c.href}
                          href={c.href}
                          onClick={() => setMenuMovilAbierto(false)}
                          className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                            activoHijo ? "font-medium text-brand" : "text-muted hover:text-brand"
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
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activo ? "bg-brand-soft text-brand" : "text-muted hover:bg-brand-soft hover:text-brand"
              }`}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
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
        <div className="fixed inset-x-0 top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-danger px-4 py-2 text-center text-xs font-medium text-white print:hidden">
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
      <div className={`flex min-h-screen bg-background ${impersonando ? "pt-9" : ""}`} style={temaStyle}>
      {/* Sidebar de escritorio */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-150 print:hidden sm:flex ${
          colapsado ? "w-[68px]" : "w-64"
        }`}
      >
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2 border-b border-border px-4 py-4">
          {usuario.empresaLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={usuario.empresaLogoUrl} alt={usuario.empresaNombre} className="h-8 w-8 shrink-0 rounded-lg object-cover" />
          ) : (
            <Logo markClassName="h-8 w-8 shrink-0" />
          )}
          {!colapsado && <span className="truncate text-sm font-semibold text-foreground">{usuario.empresaNombre}</span>}
        </Link>

        {renderNav(colapsado)}

        <button
          type="button"
          onClick={alternarColapsado}
          className="flex items-center justify-center gap-2 border-t border-border py-2.5 text-xs font-medium text-muted transition-colors hover:bg-brand-soft hover:text-brand"
        >
          <IconChevronRight className={`h-3.5 w-3.5 transition-transform ${colapsado ? "" : "rotate-180"}`} />
          {!colapsado && "Contraer"}
        </button>
      </aside>

      {/* Drawer móvil */}
      {menuMovilAbierto && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuMovilAbierto(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface shadow-xl">
            <Link href="/dashboard" onClick={() => setMenuMovilAbierto(false)} className="flex items-center gap-2 border-b border-border px-4 py-4">
              {usuario.empresaLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={usuario.empresaLogoUrl} alt={usuario.empresaNombre} className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <Logo markClassName="h-8 w-8" />
              )}
              <span className="truncate text-sm font-semibold text-foreground">{usuario.empresaNombre}</span>
            </Link>
            {renderNav(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface/80 px-4 py-3 backdrop-blur print:hidden sm:px-6">
          <button
            type="button"
            onClick={() => setMenuMovilAbierto(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-brand-soft hover:text-brand sm:hidden"
          >
            <IconMenu className="h-5 w-5" />
          </button>

          <div className="ml-auto">
            <NotificacionesBell />
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownAbierto((v) => !v)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-brand-soft"
            >
              <span className="hidden text-right text-sm sm:block">
                <span className="block font-medium text-foreground">{usuario.nombre}</span>
                <span className="block text-xs text-muted capitalize">{usuario.rol}</span>
              </span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
                {iniciales(usuario.nombre)}
              </span>
            </button>

            {dropdownAbierto && (
              <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
                <Link
                  href="/dashboard/perfil"
                  onClick={() => setDropdownAbierto(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-brand-soft hover:text-brand"
                >
                  <IconUser className="h-4 w-4" />
                  Perfil
                </Link>
                <Link
                  href="/dashboard/configuracion/cuenta"
                  onClick={() => setDropdownAbierto(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-brand-soft hover:text-brand"
                >
                  <IconSettings className="h-4 w-4" />
                  Configuración
                </Link>
                <Link
                  href="/dashboard/ayuda"
                  onClick={() => setDropdownAbierto(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-brand-soft hover:text-brand"
                >
                  <IconHelp className="h-4 w-4" />
                  Ayuda
                </Link>
                <div className="my-1 border-t border-border" />
                <button
                  type="button"
                  onClick={cerrarSesion}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-danger hover:bg-danger-soft"
                >
                  <IconLogOut className="h-4 w-4" />
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

      {puedeVerModulo(usuario.rol, "asistente") && !modulosDeshabilitados.includes("asistente") && <AsistenteChat />}
      </div>
    </>
  );
}
