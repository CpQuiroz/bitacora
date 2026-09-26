/** Devuelve `item` a `lista` en su posición original (Deshacer, tarea 156). No duplica. */
export function reponer<T extends { id: string }>(lista: T[], item: T, indice: number): T[] {
  if (lista.some((x) => x.id === item.id)) return lista;
  const copia = [...lista];
  copia.splice(Math.min(Math.max(indice, 0), copia.length), 0, item);
  return copia;
}
