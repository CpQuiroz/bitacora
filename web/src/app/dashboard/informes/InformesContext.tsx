"use client";

import { createContext, useContext } from "react";
import type { Empresa, Usuario } from "@bitacora/shared";
import type { PeriodoValor } from "@/lib/periodo";

export type UsuarioConEmpresa = Usuario & { empresa: Empresa };

export type InformesContextValue = {
  usuario: UsuarioConEmpresa;
  periodo: PeriodoValor;
  desde: string;
  hasta: string;
  refreshKey: number;
  cambiarPeriodo: (p: PeriodoValor) => void;
  cambiarRangoPersonalizado: (desde: string, hasta: string) => void;
  actualizar: () => void;
  // Cada pestaña (excepto Visión General) registra acá su propia
  // función de exportación CSV — el botón "CSV" de la barra
  // compartida solo la ejecuta, sin saber nada de la forma de los
  // datos de esa pestaña en particular.
  registrarExportCsv: (fn: (() => void) | null) => void;
};

export const InformesContext = createContext<InformesContextValue | null>(null);

export function useInformes(): InformesContextValue {
  const ctx = useContext(InformesContext);
  if (!ctx) throw new Error("useInformes debe usarse dentro de /dashboard/informes");
  return ctx;
}
