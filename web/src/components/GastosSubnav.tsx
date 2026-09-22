"use client";

import Link from "next/link";

const TABS = [
  { href: "/dashboard/gastos", label: "Gastos" },
  { href: "/dashboard/rendiciones", label: "Rendiciones" },
] as const;

// Rendiciones (fondo por rendir / caja chica) es una subsección de
// Gastos, no un módulo aparte — este switcher minimalista reemplaza el
// ítem de nav propio que tenía antes (ver DashboardShell).
export function GastosSubnav({ activo }: { activo: "gastos" | "rendiciones" }) {
  return (
    <div className="mb-ds-6 flex flex-wrap gap-ds-2">
      {TABS.map((tab) => {
        const seleccionado = (tab.label === "Gastos" ? "gastos" : "rendiciones") === activo;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-ds-pill border px-ds-3 py-1 font-ds-body text-ds-caption font-medium transition-colors ${
              seleccionado ? "border-transparent bg-ds-brand text-ds-brand-foreground" : "border-ds-divider text-ds-text/70 hover:bg-ds-brand/[0.08]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
