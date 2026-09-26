"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut, User } from "lucide-react";
import { Logo } from "./Logo";
import { cerrarSesionSuperAdmin, obtenerTokenSuperAdmin, superadminFetch } from "@/lib/superadminApi";
import { escucharTemaSuperAdmin, guardarTemaSuperAdmin, leerTemaSuperAdmin, type TemaSuperAdmin } from "@/lib/superadminTema";

const NAV = [
  { href: "/superadmin/resumen", label: "Resumen" },
  { href: "/superadmin/salud", label: "Salud" },
  { href: "/superadmin", label: "Empresas" },
  { href: "/superadmin/roles", label: "Roles" },
];

// Panel de Super-Admin: identidad de plataforma, sin nada compartido
// con DashboardShell ni con PortalShell — layout propio, mínimo.
//
// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export function SuperAdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // Estilo propio del Super-Admin (Mi cuenta > Estilo). Arranca en
  // "faena" para que el primer render coincida con el del servidor, y
  // enseguida toma la copia local + el valor real de su cuenta.
  const [tema, setTema] = useState<TemaSuperAdmin>("faena");

  useEffect(() => {
    setTema(leerTemaSuperAdmin());
    const dejar = escucharTemaSuperAdmin(setTema);
    if (obtenerTokenSuperAdmin()) {
      void (async () => {
        const res = await superadminFetch("/api/superadmin/me");
        if (!res.ok) return;
        const yo: { tema?: TemaSuperAdmin } = await res.json();
        if (yo.tema) guardarTemaSuperAdmin(yo.tema);
      })();
    }
    return dejar;
  }, []);

  function salir() {
    cerrarSesionSuperAdmin();
    router.replace("/superadmin/login");
  }

  // "Empresas" queda activo también en las fichas /superadmin/empresas/[id].
  function activo(href: string) {
    if (href === "/superadmin") return pathname === "/superadmin" || pathname.startsWith("/superadmin/empresas");
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="min-h-screen bg-ds-bg" data-tema={tema}>
      <header className="sticky top-0 z-10 border-b border-ds-divider bg-ds-surface/80 backdrop-blur">
        <div className="flex items-center justify-between px-ds-6 py-ds-3">
          <Link href="/superadmin/resumen" className="flex items-center gap-ds-2">
            <Logo markClassName="h-7 w-7" />
            <span className="font-ds-body text-ds-small font-semibold text-ds-text">Panel de Super-Admin</span>
          </Link>
          <div className="flex items-center gap-ds-4">
            <Link href="/superadmin/cuenta" className="flex items-center gap-1.5 font-ds-body text-ds-caption font-medium text-ds-text-secondary hover:text-ds-text">
              <User size={16} strokeWidth={2.75} />
              Mi cuenta
            </Link>
            <button type="button" onClick={salir} className="flex items-center gap-1.5 font-ds-body text-ds-caption font-medium text-ds-text-secondary hover:text-ds-accent-700">
              <LogOut size={16} strokeWidth={2.75} />
              Salir
            </button>
          </div>
        </div>
        <nav className="flex gap-ds-1 px-ds-6">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`border-b-2 px-ds-3 py-2 font-ds-body text-ds-small font-medium transition-colors ${
                activo(item.href) ? "border-ds-brand text-ds-text" : "border-transparent text-ds-text-secondary hover:text-ds-text"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-ds-6 py-ds-10">{children}</main>
    </div>
  );
}
