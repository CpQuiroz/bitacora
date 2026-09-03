"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AuthLayout } from "@/components/AuthLayout";

function BajaAvisos() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [estado, setEstado] = useState<"cargando" | "ok" | "error">("cargando");

  useEffect(() => {
    if (!token) {
      setEstado("error");
      return;
    }
    apiFetch("/api/baja-avisos", { method: "POST", body: JSON.stringify({ token }) })
      .then((res) => setEstado(res.ok ? "ok" : "error"))
      .catch(() => setEstado("error"));
  }, [token]);

  return (
    <AuthLayout title="Baja de avisos">
      {estado === "cargando" && <p className="text-sm text-muted">Procesando…</p>}
      {estado === "ok" && (
        <p className="text-sm text-foreground">
          Listo. No vas a recibir más avisos automáticos por correo ni WhatsApp. Si
          cambias de opinión, pídele a la empresa que te vuelva a activar.
        </p>
      )}
      {estado === "error" && (
        <p className="text-sm text-danger">
          El enlace no es válido o ya expiró. Si querés dejar de recibir avisos,
          respondé el correo pidiéndolo.
        </p>
      )}
    </AuthLayout>
  );
}

export default function BajaAvisosPage() {
  return (
    <Suspense fallback={null}>
      <BajaAvisos />
    </Suspense>
  );
}
