"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

// "Cadastros" era portugués colado por error — el grupo pasó a
// llamarse "Registros" (/dashboard/registros/*). Se deja este
// redirect por si queda algún link viejo.
export default function CadastrosClienteDetalleRedirectPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  useEffect(() => {
    router.replace(`/dashboard/registros/clientes/${params.id}`);
  }, [router, params.id]);
  return null;
}
