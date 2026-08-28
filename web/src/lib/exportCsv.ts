// Exportación CSV 100% client-side — arma el archivo a partir de los
// datos que ya están en pantalla (respeta el período visible, sin
// pedirle nada nuevo al backend) y dispara la descarga.
export function descargarCSV(nombreArchivo: string, filas: Record<string, string | number>[]) {
  if (filas.length === 0) return;
  const columnas = Object.keys(filas[0]);
  const escapar = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [columnas.join(","), ...filas.map((f) => columnas.map((c) => escapar(f[c])).join(","))];
  // BOM al inicio para que Excel detecte UTF-8 y no rompa tildes/ñ.
  const blob = new Blob(["﻿" + lineas.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}
