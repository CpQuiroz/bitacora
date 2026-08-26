"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { supabase } from "@/lib/supabase";
import {
  IconBriefcase,
  IconLogOut,
  IconMapPin,
  IconReceipt,
  IconRoute,
  IconSparkle,
  IconUsers,
} from "./icons";

const NAV = [
  { href: "/dashboard/trabajos", label: "Trabajos", icon: IconBriefcase },
  { href: "/dashboard/clientes", label: "Clientes", icon: IconMapPin },
  { href: "/dashboard/rutas", label: "Rutas", icon: IconRoute },
  { href: "/dashboard/facturas", label: "Facturas", icon: IconReceipt },
  { href: "/dashboard/informe", label: "Informe IA", icon: IconSparkle },
];

export type UsuarioShell = {
  nombre: string;
  rol: string;
  empresaNombre: string;
  empresaLogoUrl: string | null;
};

export function DashboardShell({
  usuario,
  children,
}: {
  usuario: UsuarioShell;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const nav = usuario.rol === "admin" ? [...NAV, { href: "/dashboard/equipo", label: "Equipo", icon: IconUsers }] : NAV;

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/dashboard" className="shrink-0">
            <Logo markClassName="h-7 w-7" />
          </Link>
          <nav className="hidden flex-1 items-center gap-1 sm:flex">
            {nav.map((item) => {
              const activo = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activo
                      ? "bg-brand-soft text-brand"
                      : "text-muted hover:bg-brand-soft hover:text-brand"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            {usuario.empresaLogoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={usuario.empresaLogoUrl}
                alt={`Logo de ${usuario.empresaNombre}`}
                className="h-8 w-8 rounded-lg border border-border object-cover"
              />
            )}
            <div className="hidden text-right text-sm sm:block">
              <p className="font-medium text-foreground">{usuario.nombre}</p>
              <p className="text-xs text-muted capitalize">{usuario.rol}</p>
            </div>
            <button
              onClick={cerrarSesion}
              title="Cerrar sesión"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-brand-soft hover:text-brand"
            >
              <IconLogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-1.5 sm:hidden">
          {nav.map((item) => {
            const activo = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                  activo ? "bg-brand-soft text-brand" : "text-muted"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
