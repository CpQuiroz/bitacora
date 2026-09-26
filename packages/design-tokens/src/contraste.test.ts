// Tarea 154: contraste WCAG AA (4,5:1 texto normal) de los tokens de color.
// Si alguien cambia un color en tokens.json y baja de AA, esto falla (corre
// en ./verificar.sh y en CI).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AA_TEXTO_NORMAL, contraste, marcaLegible, textoSobreFondo } from "./contraste";
import { tinteSuave, tonoFuerte } from "./mezcla";

const tokens = JSON.parse(readFileSync(join(__dirname, "..", "tokens.json"), "utf8"));
const PALETAS = ["color", "colorDark", "colorTaller", "colorConfianza"] as const;

function exigir(nombre: string, texto: string, fondo: string) {
  const r = contraste(texto, fondo);
  assert.ok(r >= AA_TEXTO_NORMAL, `${nombre}: ${texto} sobre ${fondo} = ${r.toFixed(2)} (< ${AA_TEXTO_NORMAL})`);
}

test("la función de contraste da los valores WCAG conocidos", () => {
  assert.equal(Math.round(contraste("#000000", "#ffffff")), 21);
  assert.equal(contraste("#777777", "#777777"), 1);
  assert.ok(Math.abs(contraste("#ffffff", "#c67139") - 3.61) < 0.01);
});

for (const p of PALETAS) {
  test(`${p}: texto y texto secundario cumplen AA sobre fondo y tarjeta`, () => {
    const c = tokens[p];
    for (const fondo of ["bg", "surface"] as const) {
      exigir(`${p}.text/${fondo}`, c.text, c[fondo]);
      exigir(`${p}.textSecondary/${fondo}`, c.textSecondary, c[fondo]);
    }
  });

  test(`${p}: el botón primario (marca por defecto) cumple AA`, () => {
    const { fondo, texto } = marcaLegible(tokens[p].accent);
    exigir(`${p}.botón`, texto, fondo);
  });

  test(`${p}: el tono fuerte de la marca sobre su tinte suave cumple AA (botón mobile, tags)`, () => {
    const base = tokens[p].accent;
    exigir(`${p}.fuerte/suave`, tonoFuerte(base), tinteSuave(base));
  });
}

test("semánticos (peligro y advertencia) cumplen AA en claro y oscuro", () => {
  exigir("danger/bg", tokens.semantic.danger, tokens.color.bg);
  exigir("warning/bg", tokens.semantic.warning, tokens.color.bg);
  exigir("dark.danger/bg", tokens.semanticDark.danger, tokens.colorDark.bg);
  exigir("dark.warning/bg", tokens.semanticDark.warning, tokens.colorDark.bg);
});

test("cualquier color de marca queda legible (texto u oscurecido)", () => {
  for (const color of ["#c67139", "#d1580f", "#2563a6", "#ffd500", "#7dd3fc", "#16a34a", "#e11d48", "#111111", "#ffffff"]) {
    const { fondo, texto } = marcaLegible(color);
    exigir(`marca ${color}`, texto, fondo);
  }
  assert.equal(textoSobreFondo("#c67139"), "#1a1a1a");
  assert.equal(marcaLegible("#2563a6").fondo, "#2563a6");
  assert.notEqual(marcaLegible("#d1580f").fondo, "#d1580f");
});

// El backend no puede importar design-tokens (su imagen de Docker solo trae
// packages/shared): usa una copia de la regla en shared. Deben coincidir.
import { textoSobreMarca } from "../../shared/src/contraste";

test("textoSobreMarca (shared) coincide con textoSobreFondo", () => {
  const muestras = ["#c67139", "#d1580f", "#4338ca", "#0d9488", "#ffcc00", "#777777", "#000000", "#ffffff", "#e11d48", "#16a34a", "#fff", "#7f7f7f"];
  for (let i = 0; i < 256; i += 17) muestras.push(`#${i.toString(16).padStart(2, "0")}${(255 - i).toString(16).padStart(2, "0")}80`);
  for (const m of muestras) assert.equal(textoSobreMarca(m), textoSobreFondo(m), m);
});
