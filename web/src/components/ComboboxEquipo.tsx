"use client";

import { useState } from "react";
import type { Equipo } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, ErrorText, Input, Label, Select } from "./ui";
import { Combobox } from "./Combobox";

const CATEGORIAS = ["Vehículo", "Maquinaria", "Herramienta", "Otro"];

// Selector de Equipo/activo con búsqueda + creación inline real: si no
// existe, se crea en la base ahí mismo (nombre + categoría, asociado al
// cliente indicado) y queda seleccionado. Mismo criterio que
// ComboboxCliente.
export function ComboboxEquipo({
  value,
  onChange,
  equipos,
  clienteId,
  onEquipoCreado,
  opcionVacia = "Sin equipo específico",
  placeholder = "Selecciona un equipo",
}: {
  value: string;
  onChange: (id: string) => void;
  equipos: Equipo[];
  // Cliente al que se asocia un equipo nuevo. Si es "", el equipo se
  // crea como activo propio de la empresa.
  clienteId: string;
  onEquipoCreado: (equipo: Equipo) => void;
  opcionVacia?: string;
  placeholder?: string;
}) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("Maquinaria");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function iniciarCreacion(texto: string) {
    setNombre(texto);
    setCategoria("Maquinaria");
    setError(null);
    setCreando(true);
  }

  async function guardar() {
    if (!nombre.trim()) {
      setError("Falta el nombre");
      return;
    }
    setError(null);
    setGuardando(true);
    const res = await apiFetch("/api/equipos", {
      method: "POST",
      body: JSON.stringify({
        nombre: nombre.trim(),
        categoria,
        cliente_id: clienteId || null,
      }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear el equipo");
      return;
    }
    const nuevo: Equipo = await res.json();
    onEquipoCreado(nuevo);
    onChange(nuevo.id);
    setCreando(false);
  }

  if (creando) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <div>
          <Label>Nombre del equipo</Label>
          <Input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <Label>Categoría</Label>
          <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex gap-2">
          <Button type="button" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Crear equipo"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setCreando(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Combobox
      value={value}
      onChange={onChange}
      opciones={[
        { id: "", label: opcionVacia },
        ...equipos.map((e) => ({ id: e.id, label: e.nombre })),
      ]}
      placeholder={placeholder}
      etiquetaCrear={(texto) => `+ Crear equipo "${texto}"`}
      onCrear={iniciarCreacion}
    />
  );
}
