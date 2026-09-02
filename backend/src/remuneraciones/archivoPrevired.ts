// ============================================================
// BITÁCORA — Archivo de carga previsional PREVIRED (formato plano).
//
// Genera el archivo que el usuario descarga y SUBE a previred.cl para
// revisar el total y pagar. Bitácora NO paga: solo arma el archivo.
//
// FORMATO: 105 campos por línea, separados por ";", sin encabezado, un
// registro por trabajador. Referencia: Previred → "Descripción de
// Registros del Archivo Plano de Pago Previsional".
//
// ⚠️ BORRADOR — antes del primer archivo real, el contador debe validar
// campo por campo con el validador de Previred (gratis en el portal).
// Los códigos de institución (AFP, Isapre) y algunas posiciones pueden
// necesitar ajuste. La lista de campos vive abajo, ordenada y comentada,
// para que corregir sea directo.
// ============================================================
import { AFP_CHILE, CODIGO_FONASA, type DatosLaborales, type Liquidacion } from "@bitacora/shared";

export type FilaPrevired = {
  liquidacion: Liquidacion;
  datos: DatosLaborales;
  usuario: { nombre: string; rut: string | null };
};

const dvRut = (rut: string): { numero: string; dv: string } => {
  const limpio = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  return { numero: limpio.slice(0, -1), dv: limpio.slice(-1) };
};

const codigoAfp = (afp: string | null): string => AFP_CHILE.find((a) => a.afp === afp)?.codigoPrevired ?? "00";

function partirNombre(datos: DatosLaborales, nombreCompleto: string): { paterno: string; materno: string; nombres: string } {
  if (datos.apellido_paterno) {
    return { paterno: datos.apellido_paterno, materno: datos.apellido_materno ?? "", nombres: nombreCompleto };
  }
  // Heurística: últimas 2 palabras = apellidos.
  const p = nombreCompleto.trim().split(/\s+/);
  if (p.length >= 3) return { paterno: p[p.length - 2], materno: p[p.length - 1], nombres: p.slice(0, -2).join(" ") };
  if (p.length === 2) return { paterno: p[1], materno: "", nombres: p[0] };
  return { paterno: nombreCompleto, materno: "", nombres: "" };
}

// Un registro Previred = 105 campos. Devolvemos el arreglo en orden;
// `unir()` lo pega con ";". Los campos que no aplican van "" o "0".
function registro(f: FilaPrevired, periodo: string): string[] {
  const L = f.liquidacion;
  const D = f.datos;
  const { numero, dv } = f.usuario.rut ? dvRut(f.usuario.rut) : { numero: "", dv: "" };
  const { paterno, materno, nombres } = partirNombre(D, f.usuario.nombre);
  const [anio, mes] = periodo.split("-");
  const per = `${mes}${anio}`; // MMAAAA
  const afpCod = codigoAfp(D.afp);
  const saludCod = D.sistema_salud === "isapre" ? D.codigo_isapre ?? "" : CODIGO_FONASA;
  const rentaImp = String(L.base_imponible);
  const cero = "0";

  const campos: string[] = new Array(105).fill(cero);
  const set = (pos: number, val: string | number) => {
    campos[pos - 1] = String(val ?? "");
  };

  // ── Identificación (1-15) ──
  set(1, numero); // RUT sin DV
  set(2, dv);
  set(3, paterno);
  set(4, materno);
  set(5, nombres);
  set(6, ""); // sexo (M/F) — pendiente de cargar
  set(7, "CL"); // nacionalidad
  set(8, "1"); // tipo de pago: 1 = remuneraciones
  set(9, per); // período desde MMAAAA
  set(10, per); // período hasta
  set(11, ""); // región prestación de servicios
  set(12, ""); // comuna
  set(13, String(L.dias_trabajados));
  set(14, "0"); // tipo de línea: 0 = normal
  set(15, "0"); // código movimiento de personal: 0 = sin movimiento

  // ── Asignación familiar (18-25) ──
  set(18, "D"); // tramo asignación familiar (D = sin derecho) — pendiente si la empresa la paga
  set(19, String(D.cargas_familiares || 0));
  set(22, String(L.asignacion_familiar || 0));

  // ── AFP (26-37 aprox.) ──
  set(26, afpCod);
  set(27, rentaImp); // renta imponible AFP
  set(28, String(L.cotizacion_afp)); // cotización obligatoria 10%
  set(29, String(L.aporte_sis)); // aporte SIS (empleador)
  set(30, String(L.comision_afp)); // comisión AFP
  set(34, cero); // cuenta de ahorro voluntario

  // ── Ex-Caja / IPS (INP) — no aplica, todos AFP ──
  set(45, "0000"); // código ex-caja

  // ── Salud (FONASA / Isapre) (50-63 aprox.) ──
  set(50, saludCod); // código institución de salud
  set(51, ""); // número FUN (Isapre)
  set(52, rentaImp); // renta imponible salud
  set(53, D.sistema_salud === "isapre" && D.plan_isapre_uf ? "UF" : "$"); // moneda del plan pactado
  set(54, D.sistema_salud === "isapre" && D.plan_isapre_uf ? String(D.plan_isapre_uf) : "0"); // cotización pactada
  set(55, String(L.cotizacion_salud)); // cotización obligatoria 7%
  set(56, String(L.salud_adicional)); // cotización adicional Isapre

  // ── CCAF (Caja de Compensación) (70-80 aprox.) — sin CCAF ──
  set(70, "0"); // código CCAF

  // ── Mutual / ISL (85-90 aprox.) ──
  set(85, "0"); // código mutual — pendiente de cargar por empresa
  set(86, rentaImp); // renta imponible mutual
  set(87, String(L.aporte_mutual)); // cotización accidentes del trabajo (empleador)

  // ── Seguro de cesantía / AFC (95-100 aprox.) ──
  set(95, rentaImp); // renta imponible AFC
  set(96, String(L.cotizacion_afc)); // aporte trabajador 0,6%
  set(97, String(L.aporte_afc_empleador)); // aporte empleador 2,4% / 3%

  return campos;
}

export function generarArchivoPrevired(filas: FilaPrevired[], periodo: string): string {
  return filas.map((f) => registro(f, periodo).join(";")).join("\r\n") + "\r\n";
}
