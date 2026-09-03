"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button, ErrorText, Input, Select } from "./ui";

const VALOR_CREAR = "__crear__";

export function SelectCrear<T extends { id: string; nombre: string }>({
  value,
  onChange,
  opciones,
  endpoint,
  placeholder,
  etiquetaCrear,
  onCreado,
  gestionHref,
  gestionLabel,
}: {
  value: string;
  onChange: (id: string) => void;
  opciones: T[];
  endpoint: string;
  placeholder: string;
  etiquetaCrear: string;
  onCreado: (nueva: T) => void;
  // Enlace a la pantalla de gestión de esta entidad (abre pestaña nueva).
  gestionHref?: string;
  gestionLabel?: string;
}) {
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardarNueva() {
    if (!nombreNuevo.trim()) {
      setError("Falta el nombre");
      return;
    }
    setError(null);
    setGuardando(true);
    const res = await apiFetch(endpoint, { method: "POST", body: JSON.stringify({ nombre: nombreNuevo.trim() }) });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear");
      return;
    }
    const creada = (await res.json()) as T;
    onCreado(creada);
    onChange(creada.id);
    setCreando(false);
    setNombreNuevo("");
  }

  if (creando) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <Input
            type="text"
            autoFocus
            placeholder={etiquetaCrear}
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                guardarNueva();
              }
            }}
          />
          <Button type="button" onClick={guardarNueva} disabled={guardando} className="shrink-0">
            {guardando ? "…" : "Crear"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="shrink-0"
            onClick={() => {
              setCreando(false);
              setNombreNuevo("");
              setError(null);
            }}
          >
            Cancelar
          </Button>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Select
        value={value}
        onChange={(e) => {
          if (e.target.value === VALOR_CREAR) {
            setCreando(true);
            return;
          }
          onChange(e.target.value);
        }}
      >
        <option value="">{placeholder}</option>
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nombre}
          </option>
        ))}
        <option value={VALOR_CREAR}>{etiquetaCrear}</option>
      </Select>
      {gestionHref && (
        <a
          href={gestionHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs font-medium text-muted transition-colors hover:text-brand"
        >
          {gestionLabel ?? "Gestionar →"}
        </a>
      )}
    </div>
  );
}
