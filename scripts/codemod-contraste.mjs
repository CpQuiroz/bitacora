#!/usr/bin/env node
/**
 * codemod-contraste.mjs — script de UNA sola vez (tarea 154, 26-sep-2026).
 *
 * Reemplaza el texto secundario hecho con opacidad sobre el color de texto
 * (40–60 %: no llega a 4,5:1 sobre fondo ni superficie) por el token sólido
 * de texto secundario, que sí llega en los cuatro temas:
 *   web:    text-ds-text/40|50|60           → text-ds-text-secondary
 *   mobile: `${tokens.color.text}66|80|99`  → tokens.color.textSecondary
 *           tokens.color.text + "66|80|99"  → tokens.color.textSecondary
 * 70 % o más ya pasa AA y no se toca. Las pestañas Agenda y Hoy de mobile
 * están congeladas y se saltan. Que no vuelvan lo vigila
 * scripts/check-contraste.mjs (en verificar.sh).
 *
 * Uso: node scripts/codemod-contraste.mjs [--aplicar]   (sin flag: simula)
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(fileURLToPath(import.meta.url), "..", "..");
const APLICAR = process.argv.includes("--aplicar");
const RAICES = ["web/src", "packages/ui/src", "mobile/src"];
const CONGELADOS = [/^mobile\/src\/features\/(hoy|agenda)\//];

const REEMPLAZOS = [
  [/(?<![\w-])text-ds-text\/(?:40|50|60)(?![\w/])/g, "text-ds-text-secondary"],
  [/`\$\{tokens\.color\.text\}(?:66|80|99)`/g, "tokens.color.textSecondary"],
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

let total = 0;
for (const raiz of RAICES) {
  for (const ruta of archivos(join(RAIZ, raiz))) {
    const rel = relative(RAIZ, ruta);
    if (CONGELADOS.some((re) => re.test(rel))) continue;
    const original = readFileSync(ruta, "utf8");
    let nuevo = original;
    let n = 0;
    for (const [re, por] of REEMPLAZOS) nuevo = nuevo.replace(re, () => (n++, por));
    if (n === 0) continue;
    total += n;
    console.log(`${String(n).padStart(4)}  ${rel}`);
    if (APLICAR) writeFileSync(ruta, nuevo);
  }
}
console.log(`${APLICAR ? "Aplicados" : "Simulados"}: ${total} reemplazos.`);
