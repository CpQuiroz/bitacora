# Sesión actual

- **Tarea en curso:** 8 — sistema_diseno (Paso 4 en curso: Button + campos hechos)
- **Inicio:** 2026-09-09
- **Agente:** Claude Sonnet 5 (directo)

## Decisiones confirmadas por la usuaria

- 2026-09-09: reemplazar Faena por crema/Caprasimo. Lucide en ambos.
  Caprasimo solo headings+lg. Storybook web + /dev/ui mobile.
- 2026-09-10: coexistencia web = namespace `ds-`. API de Button en español
  confirmada ("va así"). "sigue derecho" = continuar sin pausar por grupo.

## Estado por paso

- Paso 0-3: ✅ (`28c7f49`, `748611f`, `35bfa4f`)
- Paso 4 — `packages/ui`: 🔶 en curso
  - `Button` ✅ (`627abc5`)
  - `Input` / `Textarea` / `Select` / `DatePicker` ✅ (este commit)
    - Piezas compartidas de campo en `web/campo.ts` (LABEL/error/ayuda/foco)
      y `native/campo.tsx` (`<Campo>` wrapper) + `native/Texto.tsx` (texto
      interno mínimo de las primitivas, NO el `<Text>` de la app).
    - `Select` nativo: hoja modal simple (sin buscador).
    - `DatePicker` nativo: mismo patrón que `mobile/components/ui/SelectorHora.tsx`
      (Android diálogo nativo que se cierra solo; iOS modal propio con
      Listo/Cancelar). Usa `@react-native-community/datetimepicker`
      (ya era dependencia de mobile, no se agregó nada).
  - Verificado: tsc `ui`/`mobile`/`web` verde. Tailwind CLI compiló TODAS
    las clases reales (`bg-ds-surface`, `border-ds-accent-700`,
    `caret-color:var(--ds-brand)`, `rounded-ds-md`, `text-ds-text/70`,
    etc.) — ojo, el `@source` de prueba tenía que incluir `.ts` además de
    `.tsx` (los helpers de campo son `.ts`); Next por defecto sí escanea
    ambos. `./verificar.sh` verde, 19 literales (baseline, sin cambios).

## Próximo paso

Card → Tag/Badge/StatusBadge (unificar los 5 mapas dominio→color
detectados en el audit) → Table (solo web) → Dialog/Sheet →
Empty/Loading/ErrorState (skeletons, no spinner) → Toast.

## Pendiente / notas generales

- Falta `next build` real + verificación visual (Pasos 1-4). Sin
  Storybook todavía (Paso 7) para ver los componentes renderizados.
- eslint web roto (tarea #1) — bloquea regla ESLint del Paso 7.
- Lucide no agregado todavía.
