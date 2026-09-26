#!/usr/bin/env node
/**
 * check-dialogos-nativos.mjs — feedback unificado (tarea 156).
 *
 *   web:    nada de confirm() / alert() / prompt() del navegador → usar
 *           useConfirmar(), useToast() o useDeshacer() de @bitacora/ui/web.
 *   mobile: nada de Alert.alert → useConfirmar(), useToast() o
 *           useDeshacer() de @bitacora/ui/native. Excepción: alertas que
 *           piden una decisión que no encaja en el diálogo, marcadas con
 *           `// alerta-nativa: <motivo>` en la línea anterior.
 *
 * Exenta: la pestaña Hoy de mobile (congelada).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(fileURLToPath(import.meta.url), "..", "..");
const EXENTOS = [/^mobile\/src\/features\/hoy\//, /\.test\.tsx?$/];
const REGLAS = [
  { raiz: "web/src", re: /(?<![\w.])(?:window\.)?(?:confirm|alert|prompt)\(/, usar: "useConfirmar() / useToast()" },
  { raiz: "mobile/src", re: /\bAlert\.alert\(/, usar: "useConfirmar() / useToast() (o `// alerta-nativa: motivo`)", marca: /\/\/ alerta-nativa: \S/ },
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
for (const { raiz, re, usar, marca } of REGLAS) {
  for (const ruta of archivos(join(RAIZ, raiz))) {
    const rel = relative(RAIZ, ruta);
    if (EXENTOS.some((x) => x.test(rel))) continue;
    const lineas = readFileSync(ruta, "utf8").split("\n");
    lineas.forEach((linea, i) => {
      const codigo = linea.replace(/\/\/.*$/, "");
      if (!re.test(codigo)) return;
      if (marca && (marca.test(lineas[i - 1] ?? "") || marca.test(linea))) return;
      hallazgos.push(`${rel}:${i + 1}  → ${usar}`);
    });
  }
}

if (hallazgos.length) {
  console.log("[FAIL]  diálogos nativos del navegador/sistema:");
  for (const h of hallazgos) console.log("        " + h);
  process.exit(1);
}
console.log("[OK]    sin confirm()/alert()/prompt() ni Alert.alert sueltos");
