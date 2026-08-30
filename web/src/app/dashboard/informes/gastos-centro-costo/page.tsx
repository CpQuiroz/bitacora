"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Pestaña vieja "Gastos por Centro de Costo", unificada en
// /informes/gastos — se mantiene esta ruta solo para no romper enlaces
// guardados.
export default function RedirectGastosCentroCosto() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/informes/gastos?agrupacion=centro_costo");
  }, [router]);
  return null;
}
