"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// "Facturas" pasó a llamarse "Cobros", con cliente real (cliente_id),
// medio de pago y link de pago de pasarela — ahora vive dentro del
// grupo "Financiero" del sidebar (/dashboard/financiero/cobros). Se
// deja este redirect por si queda algún link viejo.
export default function FacturasRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/financiero/cobros");
  }, [router]);
  return null;
}
