"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { Button } from "@bitacora/ui/web";
import { descargarCSV } from "@/lib/exportCsv";
import { apiFetch } from "@/lib/api";
import { Modal } from "./Modal";

export type ColumnaImport = {
  /** Clave que espera el endpoint (ej. "rut"). */
  clave: string;
  /** Encabezado en español que ve la persona en la plantilla/CSV. */
  etiqueta: string;
  ejemplo: string;
  requerido?: boolean;
};

type ResultadoImport = { creados: number; errores: { fila: number; motivo: string }[]; omitidos: { fila: number; motivo: string }[] };

// Modal genérico de importación CSV (18-sep-2026) — mismo flujo para
// Clientes/Catálogo/Equipos/Proveedores, solo cambian `columnas` y
// `endpoint`. Parseo 100% client-side (papaparse) — se manda un JSON ya
// estructurado al backend, no el CSV crudo (evita sumar un parser de
// CSV también ahí). La validación real (RUT, duplicados, campos
// obligatorios) vive en el endpoint — este modal no la duplica, solo
// muestra lo que el backend devuelve fila por fila.
export function ImportarCsvModal({
  abierto,
  onCerrar,
  titulo,
  nombreArchivoPlantilla,
  endpoint,
  columnas,
  onImportado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  nombreArchivoPlantilla: string;
  endpoint: string;
  columnas: ColumnaImport[];
  onImportado: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filas, setFilas] = useState<Record<string, string>[] | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [errorParseo, setErrorParseo] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  function limpiar() {
    setFilas(null);
    setNombreArchivo("");
    setErrorParseo(null);
    setResultado(null);
    setErrorEnvio(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function cerrar() {
    limpiar();
    onCerrar();
  }

  function descargarPlantilla() {
    descargarCSV(nombreArchivoPlantilla, [Object.fromEntries(columnas.map((c) => [c.etiqueta, c.ejemplo]))]);
  }

  function onElegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setErrorParseo(null);
    setResultado(null);
    setNombreArchivo(archivo.name);
    Papa.parse<Record<string, string>>(archivo, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => {
        if (r.data.length === 0) {
          setErrorParseo("El archivo no tiene filas de datos (¿solo tiene el encabezado?)");
          setFilas(null);
          return;
        }
        setFilas(r.data);
      },
      error: (err) => setErrorParseo(err.message),
    });
  }

  async function confirmar() {
    if (!filas) return;
    setSubiendo(true);
    setErrorEnvio(null);
    // Traduce los encabezados en español (los de la plantilla) a las
    // claves que espera el endpoint.
    const cuerpo = filas.map((f) => Object.fromEntries(columnas.map((c) => [c.clave, f[c.etiqueta] ?? ""])));
    const res = await apiFetch(endpoint, { method: "POST", body: JSON.stringify({ filas: cuerpo }) });
    setSubiendo(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorEnvio(body.error ?? "No se pudo importar el archivo");
      return;
    }
    const data: ResultadoImport = await res.json();
    setResultado(data);
    if (data.creados > 0) onImportado();
  }

  return (
    <Modal open={abierto} onClose={cerrar} title={titulo} wide>
      <div className="flex flex-col gap-ds-4">
        {!resultado ? (
          <>
            <div>
              <p className="font-ds-body text-ds-small text-ds-text/70">
                Primero descarga la plantilla para respetar las columnas que espera el sistema, complétala en Excel/Sheets, y subila.
              </p>
              <div className="mt-ds-3">
                <Button variante="secundario" onPress={descargarPlantilla}>
                  Descargar plantilla CSV
                </Button>
              </div>
            </div>

            <div className="rounded-ds-md border border-dashed border-ds-divider p-ds-4 text-center">
              <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onElegirArchivo} className="hidden" id="input-csv-import" />
              <label htmlFor="input-csv-import" className="inline-flex cursor-pointer items-center gap-ds-2 font-ds-body text-ds-small font-medium text-ds-brand">
                <Upload size={16} strokeWidth={2.75} />
                {nombreArchivo || "Elegir archivo CSV"}
              </label>
            </div>

            {errorParseo ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorParseo}</p> : null}
            {errorEnvio ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorEnvio}</p> : null}

            {filas ? (
              <p className="font-ds-body text-ds-small text-ds-text">
                Se detectaron <b>{filas.length}</b> fila{filas.length === 1 ? "" : "s"}. La validación (campos obligatorios, RUT, duplicados) se hace al confirmar.
              </p>
            ) : null}

            <div className="flex gap-ds-2">
              <Button onPress={confirmar} deshabilitado={!filas} cargando={subiendo}>
                Confirmar importación
              </Button>
              <Button variante="ghost" onPress={cerrar}>
                Cancelar
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-ds-2">
              <CheckCircle2 size={20} strokeWidth={2.75} className="text-ds-accent2-800" />
              <p className="font-ds-body text-ds-small font-semibold text-ds-text">
                {resultado.creados} {resultado.creados === 1 ? "fila creada" : "filas creadas"}
              </p>
            </div>

            {resultado.omitidos.length > 0 ? (
              <div>
                <p className="mb-ds-2 flex items-center gap-ds-2 font-ds-body text-ds-small font-medium text-ds-text/70">
                  <AlertTriangle size={16} strokeWidth={2.75} />
                  {resultado.omitidos.length} omitida{resultado.omitidos.length === 1 ? "" : "s"} (ya existían)
                </p>
                <ul className="flex flex-col gap-1 font-ds-body text-ds-caption text-ds-text/70">
                  {resultado.omitidos.map((o, i) => (
                    <li key={i}>
                      Fila {o.fila}: {o.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {resultado.errores.length > 0 ? (
              <div>
                <p className="mb-ds-2 flex items-center gap-ds-2 font-ds-body text-ds-small font-medium text-ds-accent-700">
                  <AlertTriangle size={16} strokeWidth={2.75} />
                  {resultado.errores.length} con error
                </p>
                <ul className="flex flex-col gap-1 font-ds-body text-ds-caption text-ds-accent-700">
                  {resultado.errores.map((e, i) => (
                    <li key={i}>
                      Fila {e.fila}: {e.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex gap-ds-2">
              <Button variante="secundario" onPress={limpiar}>
                Importar otro archivo
              </Button>
              <Button variante="ghost" onPress={cerrar}>
                Cerrar
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
