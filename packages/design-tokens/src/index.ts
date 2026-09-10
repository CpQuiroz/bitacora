/**
 * @bitacora/design-tokens — fuente única de valores de diseño.
 *
 * Web: importá `@bitacora/design-tokens/tokens.css` en globals.css.
 * Expo / RN / TS: `import { tokens } from "@bitacora/design-tokens"`.
 *
 * Los valores viven en tokens.json; `src/generated.ts` y `tokens.css`
 * se regeneran con `npm run gen -w packages/design-tokens`.
 */
export { tokens, fontStack, type Tokens } from "./generated";
export { oscurecerOklch } from "./oklch";
