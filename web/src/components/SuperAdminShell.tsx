"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { cerrarSesionSuperAdmin } from "@/lib/superadminApi";
import { IconLogOut } from "./icons";

// Panel de Super-Admin: identidad de plataforma, sin nada compartido
// con DashboardShell ni con PortalShell — layout propio, mínimo.
export function SuperAdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();

  function salir() {
    cerrarSesionSuperAdmin();
    router.replace("/superadmin/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/80 px-6 py-3 backdrop-blur">
        <Link href="/superadmin" className="flex items-center gap-2">
          <Logo markClassName="h-7 w-7" />
          <span className="text-sm font-semibold text-foreground">Panel de Super-Admin</span>
        </Link>
        <button type="button" onClick={salir} className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-danger">
          <IconLogOut className="h-4 w-4" />
          Salir
        </button>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
