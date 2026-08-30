"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Pestaña vieja "Gastos por Categoría", unificada en /informes/gastos —
// se mantiene esta ruta solo para no romper enlaces guardados.
export default function RedirectGastosCategoria() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/informes/gastos?agrupacion=categoria");
  }, [router]);
  return null;
}
