"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Pestaña vieja "Gastos en OS", unificada en /informes/gastos con el
// selector "Por Orden de Servicio" — se mantiene esta ruta solo para no
// romper enlaces guardados o reportes generados que apunten acá.
export default function RedirectGastosOs() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/informes/gastos?agrupacion=os");
  }, [router]);
  return null;
}
