#!/usr/bin/env node
/**
 * check-controles-web.mjs — tope para controles hechos a mano en la web
 * (tarea 157, ronda 5 de la auditoría UX).
 *
 * <button>, <input>, <select>, <textarea> crudos y tamaños de letra
 * sueltos (text-[13px]) saltan el sistema de diseño (@bitacora/ui y la
 * escala text-ds-*). Todavía quedan muchos, así que no se prohíben: el
 * total no puede SUBIR respecto de scripts/controles-web-baseline.json.
 * Cuando baje, actualizá el baseline con `--actualizar`.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(fileURLToPath(import.meta.url), "..", "..");
const RUTA_BASELINE = join(RAIZ, "scripts", "controles-web-baseline.json");
const MEDIDAS = {
  button: /<button\b/g,
  input: /<input\b/g,
  "select/textarea": /<(?:select|textarea)\b/g,
  "text-[Npx]": /text-\[[0-9.]+(?:px|rem)\]/g,
};

function* archivos(dir) {
  for (const nombre of readdirSync(dir)) {
    if (nombre === "node_modules") continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) yield* archivos(ruta);
    else if (/\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre)) yield ruta;
  }
}

const conteo = Object.fromEntries(Object.keys(MEDIDAS).map((k) => [k, 0]));
for (const ruta of archivos(join(RAIZ, "web/src"))) {
  const src = readFileSync(ruta, "utf8");
  for (const [k, re] of Object.entries(MEDIDAS)) conteo[k] += (src.match(re) ?? []).length;
}

if (process.argv.includes("--actualizar")) {
  writeFileSync(RUTA_BASELINE, JSON.stringify(conteo, null, 2) + "\n");
  console.log("[OK]    baseline actualizado:", JSON.stringify(conteo));
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(RUTA_BASELINE, "utf8"));
const suben = Object.keys(conteo).filter((k) => conteo[k] > (baseline[k] ?? 0));
if (suben.length) {
  console.log("[FAIL]  controles hechos a mano en web/src subieron (usá @bitacora/ui y text-ds-*):");
  for (const k of suben) console.log(`        ${k}: ${conteo[k]} (tope ${baseline[k]})`);
  process.exit(1);
}
const bajan = Object.keys(conteo).filter((k) => conteo[k] < baseline[k]);
console.log(
  `[OK]    controles web dentro del tope (${Object.entries(conteo).map(([k, v]) => `${k} ${v}`).join(", ")})` +
    (bajan.length ? " — bajaron: corré `node scripts/check-controles-web.mjs --actualizar`" : "")
);
