"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// "Presupuestos" pasó a ser "Cotizaciones", con ítems de línea desde
// el Catálogo, IVA y número correlativo — ahora vive dentro del grupo
// "Financiero" del sidebar (/dashboard/financiero/cotizaciones). Se
// deja este redirect por si queda algún link viejo.
export default function PresupuestosRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/financiero/cotizaciones");
  }, [router]);
  return null;
}
