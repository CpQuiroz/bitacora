"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { cerrarSesionSuperAdmin } from "@/lib/superadminApi";
import { IconLogOut, IconUser } from "./icons";

const NAV = [
  { href: "/superadmin/resumen", label: "Resumen" },
  { href: "/superadmin", label: "Empresas" },
  { href: "/superadmin/roles", label: "Roles" },
];

// Panel de Super-Admin: identidad de plataforma, sin nada compartido
// con DashboardShell ni con PortalShell — layout propio, mínimo.
export function SuperAdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-3">
          <Link href="/superadmin/resumen" className="flex items-center gap-2">
            <Logo markClassName="h-7 w-7" />
            <span className="text-sm font-semibold text-foreground">Panel de Super-Admin</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/superadmin/cuenta" className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground">
              <IconUser className="h-4 w-4" />
              Mi cuenta
            </Link>
            <button type="button" onClick={salir} className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-danger">
              <IconLogOut className="h-4 w-4" />
              Salir
            </button>
          </div>
        </div>
        <nav className="flex gap-1 px-6">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                activo(item.href)
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
