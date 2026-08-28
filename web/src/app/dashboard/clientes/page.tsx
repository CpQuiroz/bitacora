"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Reemplazado por /dashboard/registros/clientes (el grupo "Registros"
// del sidebar) — se deja este redirect por si queda algún link viejo.
export default function ClientesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/registros/clientes");
  }, [router]);
  return null;
}
