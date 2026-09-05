"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Reemplazado por la ficha única /dashboard/personas (pestaña "Datos
// laborales" de cada persona) — se deja este redirect por si queda algún
// link viejo.
export default function DatosLaboralesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/personas");
  }, [router]);
  return null;
}
