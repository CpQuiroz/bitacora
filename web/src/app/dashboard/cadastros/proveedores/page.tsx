"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// "Cadastros" era portugués colado por error — el grupo pasó a
// llamarse "Registros" (/dashboard/registros/*). Se deja este
// redirect por si queda algún link viejo.
export default function CadastrosProveedoresRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/registros/proveedores");
  }, [router]);
  return null;
}
