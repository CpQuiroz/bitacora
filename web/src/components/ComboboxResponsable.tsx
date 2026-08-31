"use client";

import { useState } from "react";
import type { Rol, Usuario } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { ROLES } from "@/lib/roles";
import { Button, ErrorText, Input, Label, Select, SuccessText } from "./ui";
import { Combobox } from "./Combobox";

// Selector de Responsable con búsqueda + invitación — a diferencia de
// ComboboxCliente, acá "crear" NO deja al colaborador seleccionado:
// invitar a alguien crea su cuenta en Supabase Auth pero no la activa
// hasta que acepte, así que no tiene sentido asignarle una tarea/OS
// todavía. El campo queda como estaba y se avisa que quedó pendiente.
export function ComboboxResponsable({
  value,
  onChange,
  equipo,
  opcionVacia,
  placeholder = "Selecciona un responsable",
}: {
  value: string;
  onChange: (id: string) => void;
  equipo: Usuario[];
  // Etiqueta de la opción "sin asignar" — si se omite, no se ofrece
  // (el campo queda obligatorio, como en Nueva OS).
  opcionVacia?: string;
  placeholder?: string;
}) {
  const [invitando, setInvitando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [rol, setRol] = useState<Rol>("colaborador");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function iniciarInvitacion(texto: string) {
    setNombre(texto);
    setCorreo("");
    setRol("colaborador");
    setError(null);
    setAviso(null);
    setInvitando(true);
  }

  function cancelar() {
    setInvitando(false);
    setError(null);
  }

  async function enviarInvitacion() {
    if (!nombre.trim() || !correo.trim()) {
      setError("Falta nombre o correo");
      return;
    }
    setError(null);
    setEnviando(true);
    const res = await apiFetch("/api/usuarios/invitar", {
      method: "POST",
      body: JSON.stringify({ email: correo.trim(), nombre: nombre.trim(), rol }),
    });
    setEnviando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo invitar al colaborador");
      return;
    }
    // A propósito: no se llama onChange ni se agrega a "equipo" — no
    // tiene cuenta activa todavía, no se puede asignar como
    // responsable hasta que acepte la invitación.
    setInvitando(false);
    setAviso(`Invitación enviada a ${correo.trim()}. Podrás asignarlo como responsable una vez que acepte la invitación.`);
  }

  if (invitando) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <div>
          <Label>Nombre</Label>
          <Input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <Label>Correo</Label>
          <Input type="email" placeholder="correo@empresa.cl" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </div>
        <div>
          <Label>Rol</Label>
          <Select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex gap-2">
          <Button type="button" onClick={enviarInvitacion} disabled={enviando}>
            {enviando ? "Invitando…" : "Invitar"}
          </Button>
          <Button type="button" variant="ghost" onClick={cancelar}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Combobox
        value={value}
        onChange={onChange}
        opciones={[
          ...(opcionVacia ? [{ id: "", label: opcionVacia }] : []),
          ...equipo.map((u) => ({ id: u.id, label: u.nombre })),
        ]}
        placeholder={placeholder}
        etiquetaCrear={(texto) => `+ Invitar a "${texto}" como colaborador`}
        onCrear={iniciarInvitacion}
      />
      {aviso && <SuccessText>{aviso}</SuccessText>}
    </div>
  );
}
