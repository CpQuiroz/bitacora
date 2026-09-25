"use client";

import { createContext, useContext } from "react";
import type { Empresa, Usuario } from "@bitacora/shared";

export type UsuarioConEmpresa = Usuario & { empresa: Empresa };

export type ConfiguracionContextValue = {
  usuario: UsuarioConEmpresa;
  recargar: () => Promise<void>;
  // Tarea 144: prueba vencida — ocultar acciones que el backend rechaza.
  pruebaVencida: boolean;
};

export const ConfiguracionContext = createContext<ConfiguracionContextValue | null>(null);

export function useConfiguracion(): ConfiguracionContextValue {
  const ctx = useContext(ConfiguracionContext);
  if (!ctx) throw new Error("useConfiguracion debe usarse dentro de /dashboard/configuracion");
  return ctx;
}
