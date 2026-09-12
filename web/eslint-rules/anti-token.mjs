// ============================================================
// Regla local de ESLint: prohíbe colores hex/rgb literales y valores
// arbitrarios de Tailwind en píxeles fuera de @bitacora/design-tokens
// (docs/design-system.md, Paso 7 — sistema de diseño, tarea #8).
//
// OJO: esto es un complemento a scripts/check-colores.mjs (el gate
// real de verificar.sh/CI), no un reemplazo ni un port exacto. Sirve
// para que el error salga en el editor/PR, antes de llegar a
// verificar.sh — el criterio es similar pero no idéntico (esta regla
// solo mira Literal/TemplateElement del AST, no el texto crudo del
// archivo). El baseline y la lista de exentos son la misma
// (scripts/colores-permitidos.json) para no mantener 2 fuentes de
// verdad de "qué archivo está eximido y por qué".
//
// Alcance: solo web (mobile no tiene ESLint configurado hoy — ver
// trabajo_list.json tarea #8, decisión 2026-09-12).
// ============================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const AQUI = fileURLToPath(import.meta.url);
const RAIZ = join(AQUI, "..", "..", ".."); // web/eslint-rules/anti-token.mjs -> raíz del repo
const permitidos = JSON.parse(readFileSync(join(RAIZ, "scripts", "colores-permitidos.json"), "utf8"));
const EXENTOS = new Set(Object.keys(permitidos.archivos_exentos));

// 6/8 dígitos hex: siempre es un color, en cualquier posición dentro
// del string (cubre className="bg-[#f5f5f5]" y también un literal que
// sea íntegramente el color).
const RE_HEX_6_8 = /#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/;
// 3/4 dígitos: solo cuenta si el literal ES el color completo (nada
// antes del "#" dentro del string) o si el "#" viene pegado a un
// delimitador propio del string (ej. "bg-[#fff]", el "[" es texto de
// la className) — así "problema #142 con la impresora" no cuenta.
function tieneHex34Real(valor) {
  const re = /#[0-9a-fA-F]{3,4}\b/g;
  let m;
  while ((m = re.exec(valor))) {
    const antes = valor[m.index - 1];
    if (antes === undefined || "[('\"`".includes(antes)) return true;
  }
  return false;
}
const RE_RGB = /\brgba?\(\s*\d/;
// Solo utilidades de ESPACIADO (margin/padding/gap/space/inset) con
// valor arbitrario en px: "p-[13px]", "gap-x-[7px]", "mt-[3px]" — ahí
// sí existe una escala de tokens que se está saltando (Paso 5, "aire
// por escala"). Deliberadamente NO marca "text-[11px]" ni
// "rounded-[32px]": son valores arbitrarios de Tailwind pero de
// tamaño/radio, no de espaciado — y esos dos en particular son
// convenciones ya establecidas del sistema de diseño (microtipografía
// y la forma "pill"), no algo que lo esté evadiendo. Confirmado
// probando la versión amplia primero: marcaba 109 sitios, casi todos
// esos dos patrones legítimos — se acotó a antes de sumarla al lint.
const RE_TW_ESPACIADO_PX = /\b(?:-?m[trblxy]?|-?p[trblxy]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xy])?|top|right|bottom|left)-\[-?\d+(?:\.\d+)?px\]/;

function motivoLiteral(valor) {
  if (typeof valor !== "string") return null;
  if (RE_HEX_6_8.test(valor) || tieneHex34Real(valor)) {
    return "color hex literal — usá un token de @bitacora/design-tokens";
  }
  if (RE_RGB.test(valor)) {
    return "color rgb()/rgba() literal — usá un token de @bitacora/design-tokens";
  }
  if (RE_TW_ESPACIADO_PX.test(valor)) {
    return "espaciado arbitrario de Tailwind en px — usá la escala del sistema de diseño (p-4, gap-2…)";
  }
  return null;
}

const antiToken = {
  rules: {
    "no-literal-color-or-px": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Prohíbe colores hex/rgb y valores arbitrarios de Tailwind en px fuera de packages/design-tokens.",
        },
        schema: [],
        messages: {
          literal: "{{motivo}} (ver docs/design-system.md; exentos con motivo en scripts/colores-permitidos.json)",
        },
      },
      create(context) {
        const rel = relative(RAIZ, context.filename).replaceAll("\\", "/");
        if (EXENTOS.has(rel)) return {};

        function revisar(node, valor) {
          const motivo = motivoLiteral(valor);
          if (motivo) context.report({ node, messageId: "literal", data: { motivo } });
        }

        return {
          Literal(node) {
            revisar(node, node.value);
          },
          TemplateElement(node) {
            revisar(node, node.value.raw);
          },
        };
      },
    },
  },
};

export default antiToken;
