"use client";

import Link from "next/link";

const TABS = [
  { href: "/dashboard/gastos", label: "Gastos", clave: "gastos" },
  { href: "/dashboard/rendiciones", label: "Rendiciones", clave: "rendiciones" },
  // Tarea 137: viáticos de los choferes (solo gestión; el backend lo exige).
  { href: "/dashboard/viaticos", label: "Viáticos", clave: "viaticos" },
] as const;

// Rendiciones (fondo por rendir / caja chica) es una subsección de
// Gastos, no un módulo aparte — este switcher minimalista reemplaza el
// ítem de nav propio que tenía antes (ver DashboardShell).
export function GastosSubnav({ activo, rol }: { activo: (typeof TABS)[number]["clave"]; rol?: string }) {
  return (
    <div className="mb-ds-6 flex flex-wrap gap-ds-2">
      {TABS.filter((tab) => tab.clave !== "viaticos" || rol !== "colaborador").map((tab) => {
        const seleccionado = tab.clave === activo;
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
