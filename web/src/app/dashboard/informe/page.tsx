"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, ErrorText, Label, PageHeader, Textarea } from "@/components/ui";
import { IconCamera, IconSparkle } from "@/components/icons";

export default function InformePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [instrucciones, setInstrucciones] = useState("");
  const [imagenes, setImagenes] = useState<File[]>([]);
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
        if (u) setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "", empresaLogoUrl: u.empresa?.logo_url ?? null });
      }
    })();
  }, [router]);

  function agregarImagenes(e: React.ChangeEvent<HTMLInputElement>) {
    const nuevas = Array.from(e.target.files ?? []);
    setImagenes((prev) => [...prev, ...nuevas].slice(0, 5));
    if (inputRef.current) inputRef.current.value = "";
  }

  function quitarImagen(i: number) {
    setImagenes((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function generar() {
    setError(null);
    setCargando(true);
    const formData = new FormData();
    if (instrucciones.trim()) formData.append("instrucciones", instrucciones.trim());
    imagenes.forEach((img) => formData.append("imagenes", img));

    const res = await apiFetch("/api/informe", { method: "POST", body: formData });
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

        <div className="mt-4">
          <Label>Instrucciones adicionales (opcional)</Label>
          <Textarea
            rows={3}
            placeholder="ej: enfócate en Minera Los Andes, o compara con el mes pasado"
            value={instrucciones}
            onChange={(e) => setInstrucciones(e.target.value)}
          />
        </div>

        <div className="mt-4">
          <Label>Adjuntar imágenes (opcional, máx. 5)</Label>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={agregarImagenes}
            className="hidden"
            id="input-imagenes-informe"
          />
          <div className="flex flex-wrap items-center gap-2">
            {imagenes.map((img, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs text-brand"
              >
                {img.name}
                <button
                  type="button"
                  onClick={() => quitarImagen(i)}
                  className="text-brand/70 hover:text-brand"
                  aria-label={`Quitar ${img.name}`}
                >
                  ×
                </button>
              </span>
            ))}
            {imagenes.length < 5 && (
              <label htmlFor="input-imagenes-informe">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => inputRef.current?.click()}
                >
                  <IconCamera className="h-4 w-4" />
                  Agregar imagen
                </Button>
              </label>
            )}
          </div>
        </div>

        <Button onClick={generar} disabled={cargando} className="mt-5">
          <IconSparkle className="h-4 w-4" />
          {cargando ? "Generando…" : informe ? "Regenerar informe" : "Generar informe"}
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
