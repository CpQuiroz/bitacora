"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// "Mis Documentos" se fusionó con Perfil (mismo contenido — documentos del
// colaborador logueado — ya vivía duplicado en la ficha de Flota). Se deja
// este redirect en vez de borrar la ruta para no romper un enlace guardado.
export default function MisDocumentosPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/perfil");
  }, [router]);
  return null;
}
