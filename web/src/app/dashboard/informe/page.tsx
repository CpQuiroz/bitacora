"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell } from "@/components/DashboardShell";
import { Button, Card, ErrorText, PageHeader } from "@/components/ui";
import { IconSparkle } from "@/components/icons";

export default function InformePage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<{ nombre: string; rol: string; empresaNombre: string } | null>(null);
  const [informe, setInforme] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const res = await apiFetch("/api/me");
      if (res.ok) {
        const { usuario: u } = await res.json();
        if (u) setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "" });
      }
    })();
  }, [router]);

  async function generar() {
    setError(null);
    setCargando(true);
    const res = await apiFetch("/api/informe", { method: "POST" });
    setCargando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo generar el informe");
      return;
    }
    const body = await res.json();
    setInforme(body.informe);
  }

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <PageHeader
        title="Informe con IA"
        subtitle="Un resumen ejecutivo generado por Claude a partir de tus datos reales"
      />

      <Card className="my-6">
        <p className="text-sm text-muted">
          Actividad reciente, estado de facturación, riesgos y una recomendación
          concreta — generado en segundos.
        </p>
        <Button onClick={generar} disabled={cargando} className="mt-4">
          <IconSparkle className="h-4 w-4" />
          {cargando ? "Generando…" : "Generar informe"}
        </Button>
        {error && (
          <div className="mt-4">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
      </Card>

      {informe && (
        <Card>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
            {informe}
          </pre>
        </Card>
      )}
    </DashboardShell>
  );
}
