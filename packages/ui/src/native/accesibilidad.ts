// Accesibilidad base (tarea 155).
//
// Tope del tamaño de letra del sistema: se respeta la letra grande del
// teléfono hasta 1,4× y de ahí no crece más, para que las pantallas no se
// rompan (textos que se salen de botones, filas de altura fija).
export const ESCALA_FUENTE_MAX = 1.4;

// Zona táctil mínima (44 pt, guía de Apple/WCAG 2.5.8). Para acciones de
// solo texto que miden ~20 pt de alto: hitSlop que completa hasta 44.
export const HIT_SLOP_TEXTO = { top: 12, bottom: 12, left: 8, right: 8 } as const;
