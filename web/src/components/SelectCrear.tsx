"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { ErrorText } from "./ui";
import { Combobox } from "./Combobox";

// Selector de entidad "solo nombre" (categoría de gasto, centro de
// costo, proveedor, unidad, tipo de OS, tipo de trabajo…): buscar entre
// las existentes o crear una nueva tecleando su nombre. Se construye
// sobre Combobox para que todos los selectores de entidad de la app se
// vean y se usen igual (misma caja de búsqueda que Cliente/Colaborador),
// en vez de un <select> nativo.
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
  // Prefijo del ítem "crear" del desplegable — se le agrega el nombre
  // tecleado entre comillas. Ej: "+ Crear categoría" → + Crear categoría "Peajes".
  etiquetaCrear: string;
  onCreado: (nueva: T) => void;
  // Enlace a la pantalla de gestión de esta entidad (abre pestaña nueva).
  gestionHref?: string;
  gestionLabel?: string;
}) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear(nombre: string) {
    setError(null);
    setGuardando(true);
    const res = await apiFetch(endpoint, { method: "POST", body: JSON.stringify({ nombre: nombre.trim() }) });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear");
      return;
    }
    const creada = (await res.json()) as T;
    onCreado(creada);
    onChange(creada.id);
  }

  return (
    <div className="flex flex-col gap-1">
      <Combobox
        value={value}
        onChange={onChange}
        opciones={[
          { id: "", label: placeholder },
          ...opciones.map((o) => ({ id: o.id, label: o.nombre })),
        ]}
        placeholder={placeholder}
        etiquetaCrear={(texto) => `${etiquetaCrear} "${texto}"`}
        onCrear={crear}
        gestionHref={gestionHref}
        gestionLabel={gestionLabel}
        disabled={guardando}
      />
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}
