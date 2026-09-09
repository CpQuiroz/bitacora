# PDF de OS — Fase 2 (IMPLEMENTADA)

Fase 1: helpers de `pdfEstilo.ts`, bloques en caja, campos personalizados,
checklist y horas de check-in/out en el PDF de OS + rediseño visual del Informe
IA de negocio.

Fase 2: **implementada** — migración `98_pdf_os_fase2.sql` + commits
`ded5bd9`..`f06317f`. Falta la confirmación en un dispositivo real de que la
subida multipart de fotos anda (el bug del 413 se corrigió en `fb1de1b`..
`5a27004`, APK ≥ 1.9.3).

El detalle de abajo queda como referencia de lo que se hizo.

---

## 1. Categorización de fotos

**Objetivo:** galería del PDF agrupada por categoría con pie de foto, como el
informe de referencia ("equipo a intervenir", "antes", "durante", "después").

**Migración (aditiva):**

```sql
-- analisis_fotos ya guarda la KEY de Storage en foto_url. Solo se agrega
-- la categoría; texto libre acotado, sin enum a nivel DB para no cerrar
-- la lista antes de validarla en terreno.
alter table analisis_fotos add column categoria text;
-- opcional, si se decide fijar el set:
-- check (categoria is null or categoria in ('equipo','antes','durante','despues'))
```

**Backend:**
- `POST /api/trabajos/:id/fotos` (multipart, `trabajos.ts`) — aceptar un campo
  de texto `categoria` junto al archivo, guardarlo en la fila. Igual que se hizo
  con `item` en `registro_mantencion_fotos` para mantención.
- `armarDatosPdf` — traer `categoria` en el `select` de `analisis_fotos` y
  pasar `fotos: { url, categoria }[]` en vez de `fotoUrls: string[]`.
- `generarPdfOS` — agrupar por `categoria` (las sin categoría van al final como
  "Otras"), un `tituloBarra` por grupo, y el pie de cada foto = `resumen` de la
  IA si existe, si no el nombre/índice.

**App móvil:** selector de categoría en la pantalla de fotos de la OS
(`mobile/src/features/trabajos/components/FotosSection.tsx`) — un chip/segmented
por foto antes de encolarla. La cola de sync manda `categoria` como campo de
texto del multipart (ya soporta campos de texto junto al archivo).

**Alcance:** 1 migración + `trabajos.ts` (endpoint fotos + `armarDatosPdf`) +
`generarPdfOS.ts` + 1 pantalla móvil.

---

## 2. Firma del técnico (además de la del cliente)

**Objetivo:** dos bloques de firma separados en el PDF (técnico y cliente), cada
uno con nombre + documento debajo. El helper `bloqueFirma()` de `generarPdfOS.ts`
ya está preparado para renderizar un bloque por firmante — falta el dato.

**Migración (aditiva):**

```sql
alter table ordenes_servicio
  add column firma_tecnico_url text,
  add column tecnico_firmante_nombre text,
  add column tecnico_firmante_documento text;
```

**Backend:**
- Endpoint análogo a `POST /api/trabajos/:id/firma` pero para el técnico
  (`.../firma-tecnico`), con el mismo guard `trabajoBloqueado` (no se puede
  firmar una OS ya finalizada) y `subirFirma` de `storage.ts`.
- Definir el orden en el flujo de cierre: ¿el técnico firma antes de pasarle el
  dispositivo al cliente, o después? Propuesta: paso previo — el técnico firma,
  luego el cliente. `estado_os` no cambia con la firma del técnico; sigue siendo
  `/finalizar` (firma del cliente) el que congela la OS.
- `armarDatosPdf` — traer las 3 columnas nuevas.
- `generarPdfOS` — segunda llamada a `bloqueFirma()` con los datos del técnico,
  arriba de la del cliente. Si `firma_tecnico_url` es null, no se dibuja
  (compatible con OS viejas).

**App móvil:** paso nuevo en el cierre de la OS
(`mobile/src/features/trabajos/components/CierreFirma.tsx` — reutilizar
`LienzoFirma`) que capture la firma del técnico + su nombre/RUT antes de la del
cliente.

**Alcance:** 1 migración + `trabajos.ts` (endpoint + `armarDatosPdf`) +
`generarPdfOS.ts` (segundo `bloqueFirma`) + flujo de cierre móvil.

---

## Nota sobre el cache del PDF

El PDF de OS solo se cachea (`ordenes_servicio.pdf_url`) una vez que la OS queda
firmada por el cliente (`firma_url` presente), y esa fila es inmutable después.
Todo el contenido de Fase 2 (fotos categorizadas, firma del técnico) existe antes
de ese momento, así que la lógica de "cuándo se regenera" no cambia.
