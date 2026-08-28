"use client";

import { GastosAgrupadosView } from "../GastosAgrupadosView";

export default function InformeGastosCategoriaPage() {
  return (
    <GastosAgrupadosView
      endpoint="gastos-categoria"
      nombreDimension="Categoría"
      nombreDimensionPlural="Categorías"
      archivoCsv="informe-gastos-por-categoria"
    />
  );
}
