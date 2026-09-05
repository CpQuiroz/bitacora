"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Reemplazado por la ficha única /dashboard/personas — se deja este
// redirect por si queda algún link viejo.
export default function ColaboradoresRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/personas");
  }, [router]);
  return null;
}
