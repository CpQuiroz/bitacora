"use client";

import { useState } from "react";
import type { Equipo } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Input, Select } from "@bitacora/ui/web";
import { Combobox } from "./Combobox";

const CATEGORIAS = ["Vehículo", "Maquinaria", "Herramienta", "Otro"];

// Selector de Equipo/activo con búsqueda + creación inline real: si no
// existe, se crea en la base ahí mismo (nombre + categoría, asociado al
// cliente indicado) y queda seleccionado. Mismo criterio que
// ComboboxCliente.
//
// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
      <div className="flex flex-col gap-ds-2 rounded-ds-md border border-ds-divider p-ds-3">
        <Input etiqueta="Nombre del equipo" valor={nombre} onCambio={setNombre} />
        <Select etiqueta="Categoría" valor={categoria} onCambio={setCategoria} opciones={CATEGORIAS.map((c) => ({ valor: c, etiqueta: c }))} />
        {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
        <div className="flex gap-ds-2">
          <Button onPress={guardar} cargando={guardando}>
            Crear equipo
          </Button>
          <Button variante="ghost" onPress={() => setCreando(false)}>
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
