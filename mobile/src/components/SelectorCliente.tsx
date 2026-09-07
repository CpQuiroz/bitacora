import { useState } from "react";
import type { Cliente } from "@bitacora/shared";
import { PickerBuscable } from "./ui";
import { HojaCrearCliente } from "./HojaCrearCliente";

/**
 * Selector de cliente con búsqueda + "＋ Nuevo cliente": abre la hoja
 * emergente `HojaCrearCliente` (bottom sheet, no pantalla completa) y al
 * crearlo lo deja seleccionado.
 */
export function SelectorCliente({
  etiqueta = "Cliente",
  valor,
  onElegir,
  clientes,
  onClienteCreado,
}: {
  etiqueta?: string;
  valor: string;
  onElegir: (id: string) => void;
  clientes: Pick<Cliente, "id" | "nombre">[];
  onClienteCreado: (c: Cliente) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombreInicial, setNombreInicial] = useState("");

  return (
    <>
      <PickerBuscable
        etiqueta={etiqueta}
        placeholder="Elegir cliente"
        valor={valor}
        opciones={clientes.map((c) => ({ id: c.id, label: c.nombre }))}
        onElegir={onElegir}
        alCrear={(texto) => {
          setNombreInicial(texto);
          setAbierto(true);
        }}
        etiquetaCrear="Nuevo cliente"
      />

      <HojaCrearCliente
        visible={abierto}
        nombreInicial={nombreInicial}
        onCerrar={() => setAbierto(false)}
        onCreado={(c) => {
          onClienteCreado(c);
          onElegir(c.id);
          setAbierto(false);
        }}
      />
    </>
  );
}
