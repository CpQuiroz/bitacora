"use client";

import { useState } from "react";
import type { Cliente } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, ErrorText, Input, Label } from "./ui";
import { Combobox } from "./Combobox";

// Selector de Cliente con búsqueda + creación inline real: si no
// existe, se crea en la base ahí mismo y queda seleccionado — a
// diferencia de ComboboxResponsable, donde "crear" dispara una
// invitación y el campo se deja como estaba (ver ese componente para
// el porqué).
export function ComboboxCliente({
  value,
  onChange,
  clientes,
  onClienteCreado,
  opcionVacia,
  placeholder = "Selecciona un cliente",
}: {
  value: string;
  onChange: (id: string) => void;
  clientes: Cliente[];
  onClienteCreado: (cliente: Cliente) => void;
  // Etiqueta de la opción "sin cliente" — si se omite, no se ofrece
  // (el campo queda obligatorio, como en Nueva OS).
  opcionVacia?: string;
  placeholder?: string;
}) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function iniciarCreacion(texto: string) {
    setNombre(texto);
    setDireccion("");
    setTelefono("");
    setCorreo("");
    setError(null);
    setCreando(true);
  }

  function cancelar() {
    setCreando(false);
    setError(null);
  }

  async function guardar() {
    if (!nombre.trim() || !direccion.trim()) {
      setError("Falta nombre o dirección");
      return;
    }
    setError(null);
    setGuardando(true);
    const res = await apiFetch("/api/clientes", {
      method: "POST",
      body: JSON.stringify({
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        telefono: telefono.trim() || undefined,
        correo: correo.trim() || undefined,
      }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear el cliente");
      return;
    }
    const nuevo: Cliente = await res.json();
    onClienteCreado(nuevo);
    onChange(nuevo.id);
    setCreando(false);
  }

  if (creando) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <div>
          <Label>Nombre</Label>
          <Input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <Label>Dirección</Label>
          <Input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Teléfono (opcional)</Label>
            <Input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div>
            <Label>Correo (opcional)</Label>
            <Input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </div>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex gap-2">
          <Button type="button" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Crear cliente"}
          </Button>
          <Button type="button" variant="ghost" onClick={cancelar}>
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
        ...(opcionVacia ? [{ id: "", label: opcionVacia }] : []),
        ...clientes.map((c) => ({ id: c.id, label: c.nombre })),
      ]}
      placeholder={placeholder}
      etiquetaCrear={(texto) => `+ Crear cliente "${texto}"`}
      onCrear={iniciarCreacion}
    />
  );
}
