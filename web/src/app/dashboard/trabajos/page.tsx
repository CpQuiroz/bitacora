"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// La lista de Trabajos se fusionó con Órdenes de servicio: una sola
// lista con filtro "con documento / sin documento" (/dashboard/ordenes).
// El alta rápida vive en el botón "Nueva OS" de esa página.
export default function TrabajosRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/ordenes");
  }, [router]);
  return null;
}
