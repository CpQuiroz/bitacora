"use client";

import { useState } from "react";
import type { Cliente } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Input } from "@bitacora/ui/web";
import { Combobox } from "./Combobox";

// Selector de Cliente con búsqueda + creación inline real: si no
// existe, se crea en la base ahí mismo y queda seleccionado — a
// diferencia de ComboboxResponsable, donde "crear" dispara una
// invitación y el campo se deja como estaba (ver ese componente para
// el porqué).
//
// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export function ComboboxCliente({
  value,
  onChange,
  clientes,
  onClienteCreado,
  opcionVacia,
  placeholder = "Selecciona un cliente",
  gestionHref,
  gestionLabel,
}: {
  value: string;
  onChange: (id: string) => void;
  clientes: Cliente[];
  onClienteCreado: (cliente: Cliente) => void;
  // Etiqueta de la opción "sin cliente" — si se omite, no se ofrece
  // (el campo queda obligatorio, como en Nueva OS).
  opcionVacia?: string;
  placeholder?: string;
  gestionHref?: string;
  gestionLabel?: string;
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
      <div className="flex flex-col gap-ds-2 rounded-ds-md border border-ds-divider p-ds-3">
        <Input etiqueta="Nombre" valor={nombre} onCambio={setNombre} />
        <Input etiqueta="Dirección" valor={direccion} onCambio={setDireccion} />
        <div className="grid grid-cols-2 gap-ds-2">
          <Input etiqueta="Teléfono (opcional)" valor={telefono} onCambio={setTelefono} />
          <Input etiqueta="Correo (opcional)" tipo="email" valor={correo} onCambio={setCorreo} />
        </div>
        {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
        <div className="flex gap-ds-2">
          <Button onPress={guardar} cargando={guardando}>
            Crear cliente
          </Button>
          <Button variante="ghost" onPress={cancelar}>
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
      gestionHref={gestionHref}
      gestionLabel={gestionLabel}
    />
  );
}
