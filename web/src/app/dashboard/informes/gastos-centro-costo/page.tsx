"use client";

import { GastosAgrupadosView } from "../GastosAgrupadosView";

export default function InformeGastosCentroCostoPage() {
  return (
    <GastosAgrupadosView
      endpoint="gastos-centro-costo"
      nombreDimension="Centro de Costo"
      nombreDimensionPlural="Centros de Costo"
      archivoCsv="informe-gastos-por-centro-costo"
    />
  );
}
