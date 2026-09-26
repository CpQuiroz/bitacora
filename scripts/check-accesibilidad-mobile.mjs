#!/usr/bin/env node
/**
 * check-accesibilidad-mobile.mjs — botones sin nombre para el lector de
 * pantalla (tarea 155). Falla si un <Pressable> de mobile no tiene
 * accessibilityLabel y adentro no hay texto (solo un ícono o una imagen):
 * TalkBack/VoiceOver lo anuncia como "botón" a secas.
 * Heurístico (regex, no AST): si da un falso positivo, agregá igual un
 * accessibilityLabel — nunca sobra.
 *
 * Exenta: la pestaña Hoy (congelada).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(fileURLToPath(import.meta.url), "..", "..");
const RAICES = ["mobile/src", "packages/ui/src/native"];
const EXENTOS = [/^mobile\/src\/features\/hoy\//, /\.test\.tsx$/];
const CON_TEXTO = /<(Texto|Text|Cifra)\b|\{(children|contenido)\}/;

function* archivos(dir) {
  for (const nombre of readdirSync(dir)) {
    if (nombre === "node_modules") continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) yield* archivos(ruta);
    else if (nombre.endsWith(".tsx")) yield ruta;
  }
}

const hallazgos = [];
for (const raiz of RAICES) {
  for (const ruta of archivos(join(RAIZ, raiz))) {
    const rel = relative(RAIZ, ruta);
    if (EXENTOS.some((re) => re.test(rel))) continue;
    const src = readFileSync(ruta, "utf8");
    for (const m of src.matchAll(/<Pressable\b([^>]*?)>([\s\S]*?)<\/Pressable>/g)) {
      const [, attrs, cuerpo] = m;
      if (/accessibilityLabel|accessible=\{false\}/.test(attrs) || CON_TEXTO.test(cuerpo)) continue;
      hallazgos.push(`${rel}:${src.slice(0, m.index).split("\n").length}`);
    }
  }
}

if (hallazgos.length) {
  console.log("[FAIL]  botones de mobile sin nombre para el lector de pantalla (agregá accessibilityLabel):");
  for (const h of hallazgos) console.log("        " + h);
  process.exit(1);
}
console.log("[OK]    botones de mobile con nombre accesible");
