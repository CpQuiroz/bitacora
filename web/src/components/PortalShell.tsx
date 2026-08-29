"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { cerrarSesionPortal } from "@/lib/portalApi";
import { IconCalendar, IconClipboardCheck, IconHome, IconLogOut, IconReceipt, IconWallet } from "./icons";

const NAV = [
  { href: "/portal", label: "Inicio", icon: IconHome },
  { href: "/portal/ordenes", label: "OS", icon: IconClipboardCheck },
  { href: "/portal/citas", label: "Citas", icon: IconCalendar },
  { href: "/portal/cotizaciones", label: "Cotizaciones", icon: IconReceipt },
  { href: "/portal/cobros", label: "Cobros", icon: IconWallet },
];

// Portal de Cliente: identidad externa, sin cuenta de Bitácora — por
// eso este layout es propio, sin DashboardShell (nada de sidebar ni
// del negocio interno). Mobile-first: nav de pestañas fija abajo,
// pensado para abrirse desde el link del correo en el celular.
export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  function salir() {
    cerrarSesionPortal();
    router.replace("/portal/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/80 px-4 py-3 backdrop-blur">
        <Link href="/portal" className="flex items-center gap-2">
          <Logo markClassName="h-7 w-7" />
          <span className="text-sm font-semibold text-foreground">Mi portal</span>
        </Link>
        <button type="button" onClick={salir} className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-danger">
          <IconLogOut className="h-4 w-4" />
          Salir
        </button>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-md">
          {NAV.map((item) => {
            const activo = item.href === "/portal" ? pathname === "/portal" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  activo ? "text-brand" : "text-muted"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
