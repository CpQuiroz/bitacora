"use client";

import { useId } from "react";
import { sugerirTipoViatico, type ConfigViaticos, type TipoViatico } from "@bitacora/shared";
import { Select } from "@bitacora/ui/web";
import { InputMonto } from "@/components/InputMonto";

// Viático del chofer en el formulario de un viaje (tarea 137). Interno:
// solo Admin/Supervisor lo ven; se registra como gasto "Viáticos" y no
// sale en el cobro. Sugiere local/interregional según la Región
// Metropolitana y precarga el monto por defecto de la empresa.
type Props = {
  tipo: TipoViatico | "";
  monto: string;
  onCambio: (tipo: TipoViatico | "", monto: string) => void;
  origen: string;
  destino: string;
  config: ConfigViaticos | null;
  moneda?: string;
  deshabilitado?: boolean;
};

const ETIQUETA: Record<TipoViatico, string> = { local: "Local (dentro de la RM)", interregional: "Interregional" };

function montoPorDefecto(tipo: TipoViatico, config: ConfigViaticos | null): string {
  const v = tipo === "local" ? config?.viatico_local_monto : config?.viatico_interregional_monto;
  return v != null ? String(Math.round(Number(v))) : "";
}

export function CampoViatico({ tipo, monto, onCambio, origen, destino, config, moneda, deshabilitado }: Props) {
  const uid = useId();
  const sugerido = origen && destino ? sugerirTipoViatico(origen, destino) : null;

  function cambiarTipo(nuevo: string) {
    const t = (nuevo || "") as TipoViatico | "";
    if (!t) {
      onCambio("", "");
      return;
    }
    // Si el monto estaba vacío o era el por defecto del otro tipo, se
    // reemplaza por el por defecto del tipo elegido.
    const otro: TipoViatico = t === "local" ? "interregional" : "local";
    const reemplazar = !monto || monto === montoPorDefecto(otro, config);
    onCambio(t, reemplazar ? montoPorDefecto(t, config) : monto);
  }

  return (
    <>
      <Select
        etiqueta="Viático del chofer (interno)"
        valor={tipo}
        onCambio={cambiarTipo}
        deshabilitado={deshabilitado}
        opciones={[
          { valor: "", etiqueta: "Sin viático" },
          { valor: "local", etiqueta: ETIQUETA.local },
          { valor: "interregional", etiqueta: ETIQUETA.interregional },
        ]}
        ayuda={sugerido ? `Sugerido: ${ETIQUETA[sugerido].toLowerCase()}` : "Se registra como gasto “Viáticos”; no sale en el cobro."}
      />
      {tipo ? (
        <div className="flex flex-col gap-ds-1">
          <label htmlFor={`${uid}-monto`} className="font-ds-body text-ds-caption font-medium text-ds-text/70">Monto del viático</label>
          <InputMonto id={`${uid}-monto`} required value={monto} onChange={(m) => onCambio(tipo, m)} moneda={moneda} disabled={deshabilitado} />
        </div>
      ) : null}
    </>
  );
}
