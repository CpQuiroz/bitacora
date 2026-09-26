#!/usr/bin/env node
/**
 * check-contraste.mjs — que el texto secundario hecho con opacidad no
 * vuelva (tarea 154). Con 40–60 % de opacidad el texto queda bajo 4,5:1
 * (WCAG AA); se usa el token sólido:
 *   web:    text-ds-text-secondary        (no text-ds-text/40|50|60)
 *   mobile: tokens.color.textSecondary    (no `${tokens.color.text}66|80|99`)
 * El contraste de los tokens en sí lo prueba
 * packages/design-tokens/src/contraste.test.ts.
 *
 * Exentas: las pestañas Agenda y Hoy de mobile (congeladas; migrarlas
 * cuando se descongelen y sacarlas de acá).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(fileURLToPath(import.meta.url), "..", "..");
const RAICES = ["web/src", "packages/ui/src", "mobile/src"];
const EXENTOS = [/^mobile\/src\/features\/(hoy|agenda)\//];
const PROHIBIDOS = [
  [/(?<![\w-])text-ds-text\/(?:40|50|60)(?![\w/])/g, "text-ds-text-secondary"],
  [/\$\{tokens\.color\.text\}(?:66|80|99)\b/g, "tokens.color.textSecondary"],
  [/tokens\.color\.text \+ "(?:66|80|99)"/g, "tokens.color.textSecondary"],
];

function* archivos(dir) {
  for (const nombre of readdirSync(dir)) {
    if (nombre === "node_modules") continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) yield* archivos(ruta);
    else if (/\.[tj]sx?$/.test(nombre)) yield ruta;
  }
}

const hallazgos = [];
for (const raiz of RAICES) {
  for (const ruta of archivos(join(RAIZ, raiz))) {
    const rel = relative(RAIZ, ruta);
    if (EXENTOS.some((re) => re.test(rel))) continue;
    readFileSync(ruta, "utf8").split("\n").forEach((linea, i) => {
      for (const [re, usar] of PROHIBIDOS) {
        for (const m of linea.matchAll(re)) hallazgos.push(`${rel}:${i + 1}  ${m[0]}  → usá ${usar}`);
      }
    });
  }
}

if (hallazgos.length) {
  console.log("[FAIL]  texto secundario con opacidad (no llega a AA):");
  for (const h of hallazgos) console.log("        " + h);
  process.exit(1);
}
console.log("[OK]    texto secundario con token sólido (sin opacidades bajo AA)");
