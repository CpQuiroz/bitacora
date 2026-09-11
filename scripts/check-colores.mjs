#!/usr/bin/env node
/**
 * check-colores.mjs — alarma anti-degradación del sistema de diseño.
 *
 * Falla si aparecen colores literales (#hex, rgb(), rgba()) en el código
 * de UI fuera de packages/design-tokens. Mientras dura la migración
 * (Paso 6) se tolera un BASELINE de literales preexistentes: el chequeo
 * falla solo si el total SUBE. Cuando el baseline llegue a 0 y se borre
 * Faena, pasa a estricto.
 *
 * Exentos: archivos de datos-color (paletas que elige el usuario),
 * previews de PDF y assets SVG — ver scripts/colores-permitidos.json.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(fileURLToPath(import.meta.url), "..", "..");
const permitidos = JSON.parse(readFileSync(join(RAIZ, "scripts", "colores-permitidos.json"), "utf8"));
const EXENTOS = new Set(Object.keys(permitidos.archivos_exentos));

// Literales de UI preexistentes (todos en pantallas Faena — scrims de
// modal, divisores sobre bloques oscuros, fondo "hoy", texto sobre el
// header navy). Se van con la migración del Paso 6. Bajá este número
// cada vez que una pantalla migrada elimine los suyos; a 0 pasa a estricto.
const BASELINE = 14;

const RAICES = ["web/src", "mobile/src", "packages/shared/src"];
const SALTAR_ARCHIVO = [
  /\.test\.[tj]sx?$/,
  /\/generated\.ts$/,
  /mobile\/src\/theme\/tokens\.ts$/, // paleta Faena — se borra con la migración
  /mobile\/src\/theme\/color\.ts$/, // #ffffff/#111111 de las utilidades de contraste
];

// 6/8 dígitos: siempre color. 3/4 dígitos: solo si vienen pegados a una
// comilla o corchete (así "OS #142 desde el celular" no cuenta).
const RE_HEX = /#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b|(?<=["'`[(])#[0-9a-fA-F]{3,4}\b/g;
const RE_RGB = /\brgba?\(\s*\d/g;

function listar(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...listar(p));
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

// Quita comentarios de línea y de bloque para no contar hex que están
// en un comentario o en texto (ej. "#142 desde el celular").
function sinComentarios(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

let total = 0;
const hallazgos = [];

for (const raiz of RAICES) {
  const abs = join(RAIZ, raiz);
  let archivos;
  try {
    archivos = listar(abs);
  } catch {
    continue;
  }
  for (const archivo of archivos) {
    const rel = relative(RAIZ, archivo).replaceAll("\\", "/");
    if (SALTAR_ARCHIVO.some((re) => re.test(rel))) continue;
    if (EXENTOS.has(rel)) continue;

    const src = sinComentarios(readFileSync(archivo, "utf8"));
    src.split("\n").forEach((linea, i) => {
      const m = [...linea.matchAll(RE_HEX), ...linea.matchAll(RE_RGB)];
      for (const hit of m) {
        total++;
        hallazgos.push(`${rel}:${i + 1}  ${linea.trim().slice(0, 90)}`);
      }
    });
  }
}

if (total > BASELINE) {
  console.error(`✗ colores literales: ${total} (baseline ${BASELINE}). Nuevos literales — usá tokens de @bitacora/design-tokens o agregá el archivo a scripts/colores-permitidos.json con motivo.`);
  for (const h of hallazgos.slice(-25)) console.error("  " + h);
  process.exit(1);
} else if (total < BASELINE) {
  console.log(`✓ colores literales: ${total} (baseline ${BASELINE}) — bajó. Actualizá BASELINE en scripts/check-colores.mjs a ${total}.`);
} else {
  console.log(`✓ colores literales: ${total} (baseline). Ningún literal nuevo.`);
}
