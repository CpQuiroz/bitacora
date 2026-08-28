"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Reemplazado por el módulo de Configuración con submenú
// (/dashboard/configuracion/*) — se deja este redirect por si queda
// algún link viejo apuntando acá.
export default function AjustesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/configuracion/cuenta");
  }, [router]);
  return null;
}
