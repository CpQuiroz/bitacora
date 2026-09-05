"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

// Reemplazado por la ficha única /dashboard/personas/[id] — se deja este
// redirect por si queda algún link viejo (ej. avisos de documentos).
export default function ColaboradorFlotaDetalleRedirectPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  useEffect(() => {
    router.replace(`/dashboard/personas/${params.id}`);
  }, [router, params.id]);
  return null;
}
