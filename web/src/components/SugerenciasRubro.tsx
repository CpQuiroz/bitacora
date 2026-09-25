"use client";

import { useEffect, useState } from "react";
import type { SugerenciaRubro, TipoSugerenciaRubro } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";

// Sugerencias del rubro de la empresa (tarea 144): una empresa nueva parte
// sin servicios ni tipos de pack; estos chips precargan el formulario de
// creación con un clic. Se ocultan las que ya existen (por nombre).
export function SugerenciasRubro({
  tipo,
  existentes,
  onElegir,
}: {
  tipo: TipoSugerenciaRubro;
  existentes: string[];
  onElegir: (s: SugerenciaRubro) => void;
}) {
  const [sugerencias, setSugerencias] = useState<SugerenciaRubro[]>([]);

  useEffect(() => {
    let vigente = true;
    apiFetch("/api/sugerencias-rubro").then(async (res) => {
      if (!res.ok || !vigente) return;
      const todas: SugerenciaRubro[] = await res.json().catch(() => []);
      if (vigente) setSugerencias(todas.filter((s) => s.tipo_sugerencia === tipo));
    });
    return () => {
      vigente = false;
    };
  }, [tipo]);

  const yaHay = new Set(existentes.map((n) => n.trim().toLowerCase()));
  const pendientes = sugerencias.filter((s) => !yaHay.has(s.valor.trim().toLowerCase()));
  if (pendientes.length === 0) return null;

  return (
    <div className="flex flex-col gap-ds-2">
      <p className="font-ds-body text-ds-caption font-medium text-ds-text/70">Sugeridos para tu rubro — clic para completar el formulario:</p>
      <div className="flex flex-wrap gap-ds-2">
        {pendientes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onElegir(s)}
            className="rounded-ds-pill border border-ds-divider px-ds-3 py-1 font-ds-body text-ds-caption font-medium text-ds-text hover:border-ds-brand"
          >
            {s.valor}
          </button>
        ))}
      </div>
    </div>
  );
}
