"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// "Cadastros" era portugués colado por error — el grupo pasó a
// llamarse "Registros" (/dashboard/registros/*). Se deja este
// redirect por si queda algún link viejo.
export default function CadastrosClientesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/registros/clientes");
  }, [router]);
  return null;
}
