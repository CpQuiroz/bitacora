// Texto legible sobre el color de marca (tarea 154), para el backend: su
// imagen de Docker solo incluye packages/shared, no design-tokens. Es la
// misma regla WCAG de packages/design-tokens/src/contraste.ts
// (textoSobreFondo); un test allá verifica que ambas den lo mismo.
// Web y mobile usan marcaLegible() de design-tokens, que además oscurece el
// fondo cuando ni el blanco ni el casi negro llegan a AA.

function luminanciaWcag(hex: string): number {
  const limpio = hex.replace("#", "").trim();
  const full = limpio.length === 3 ? limpio.split("").map((c) => c + c).join("") : limpio;
  const n = parseInt(full.slice(0, 6) || "000000", 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** "#ffffff" o "#1a1a1a": el que tenga más contraste WCAG sobre `fondo`. */
export function textoSobreMarca(fondo: string): string {
  const l = luminanciaWcag(fondo);
  const conBlanco = 1.05 / (l + 0.05);
  const lOscuro = luminanciaWcag("#1a1a1a");
  const conOscuro = (l + 0.05) / (lOscuro + 0.05);
  return conBlanco >= conOscuro ? "#ffffff" : "#1a1a1a";
}
