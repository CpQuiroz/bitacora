import { useCallback, useState } from "react";

// Ítems con borrado pendiente de "Deshacer" (tarea 156). Se filtran al
// renderizar en vez de sacarlos del estado: así una recarga de la lista
// (la de otro borrado que ya terminó, o una programada) no hace
// reaparecer los que todavía esperan sus 5 s. Mismo patrón que mobile.
export function useOcultos() {
  const [ocultos, setOcultos] = useState<ReadonlySet<string>>(() => new Set());
  const ocultar = useCallback((id: string) => setOcultos((s) => new Set(s).add(id)), []);
  const mostrar = useCallback(
    (id: string) =>
      setOcultos((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      }),
    []
  );
  const filtrar = useCallback(<T extends { id: string }>(lista: T[]): T[] => lista.filter((x) => !ocultos.has(x.id)), [ocultos]);
  return { ocultar, mostrar, filtrar };
}
