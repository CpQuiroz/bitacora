"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button, Card, ErrorText, PageHeader, SuccessText } from "@/components/ui";
import { IconBox } from "@/components/icons";
import { useConfiguracion } from "../ConfiguracionContext";

export default function InventarioPage() {
  const { usuario, recargar } = useConfiguracion();
  const [activado, setActivado] = useState(usuario.empresa.inventario_activado);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onGuardar() {
    setError(null);
    setAviso(null);
    setGuardando(true);
    const res = await apiFetch("/api/empresa", {
      method: "PATCH",
      body: JSON.stringify({ inventario_activado: activado }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar");
      return;
    }
    await recargar();
    setAviso("Configuración guardada");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Inventario" subtitle="Control de stock de productos" />
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <IconBox className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="font-medium text-foreground">Control de inventario</p>
              <p className="mt-1 max-w-md text-sm text-muted">
                Al activarlo, el sistema empieza a rastrear el saldo de tus productos — cada venta o uso descuenta stock,
                y puedes ver cuándo un producto está por agotarse.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={activado}
            onClick={() => setActivado((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${activado ? "bg-brand" : "bg-border"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                activado ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
        {error && (
          <div className="mt-4">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
        {aviso && (
          <div className="mt-4">
            <SuccessText>{aviso}</SuccessText>
          </div>
        )}
        <Button type="button" onClick={onGuardar} disabled={guardando} className="mt-4">
          {guardando ? "Guardando…" : "Guardar configuración"}
        </Button>
      </Card>
    </div>
  );
}
