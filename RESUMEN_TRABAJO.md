# Resumen de trabajo — Combobox de búsqueda + crear (Cliente/Responsable)

Rama: `feat/combobox-buscar-crear` (4 commits, no mergeada a `main`, sin
push a ningún remoto).

## Qué se hizo

**Componentes nuevos, compartidos** (`web/src/components/`):

- `Combobox.tsx` — primitivo genérico de búsqueda con teclado (escribir
  para filtrar, flechas para navegar, Enter para elegir/crear, clic
  afuera o Escape para cerrar). Sin librería nueva — a mano sobre el
  design system propio (`ui.tsx`), ya que el proyecto no usa
  Radix/shadcn.
- `ComboboxCliente.tsx` — envuelve el primitivo con la lógica de
  "crear cliente real": `POST /api/clientes` (nombre prellenado con lo
  buscado, dirección obligatoria, teléfono/correo opcionales) y deja
  el cliente nuevo seleccionado.
- `ComboboxResponsable.tsx` — envuelve el primitivo con la lógica de
  "invitar colaborador": mismo `POST /api/usuarios/invitar` que ya
  usa Gestión y Control (nombre/correo/rol), reutilizando la misma
  traducción de errores en español ya corregida en una tanda anterior.
  A propósito **no** deja al invitado seleccionado — no tiene cuenta
  activa hasta que acepte — y muestra el aviso pedido ("Invitación
  enviada a [correo]. Podrás asignarlo como responsable una vez que
  acepte la invitación.").
- `web/src/lib/roles.ts` — etiquetas de `Rol` en español,
  centralizadas (estaban duplicadas en Nueva OS y en Gestión y
  Control).

**Formularios con el patrón ya aplicado:**

1. Agenda → "Nueva tarea" (Cliente y Responsable).
2. Trabajos → "Nuevo trabajo" (selector de "Cliente guardado" que
   prellena el campo de texto libre + dirección, y Responsable).
3. Órdenes de Servicio → "Nueva OS" — acá el formulario **ya tenía**
   su propio flujo de "+ Nuevo cliente" e "invitar colaborador"
   (construido en una tanda anterior); se reemplazó por los
   componentes compartidos para no mantener dos implementaciones del
   mismo patrón. De paso corrigió una inconsistencia real que tenía
   ese flujo viejo: dejaba al colaborador recién invitado
   auto-seleccionado como responsable pese a no tener cuenta activa —
   ahora, como en los otros dos formularios, el campo queda como
   estaba.

## Verificado en vivo

Con una empresa/cliente/usuario de prueba desechables (ya borrados):
búsqueda y filtrado por texto, selección con clic, selección con
teclado (flecha + Enter), creación de cliente nuevo con
auto-selección, envío del formulario completo hasta crear la OS. El
flujo de invitar colaborador se probó hasta el punto de envío — en
este ambiente de desarrollo `RESEND_API_KEY` no está configurada, así
que el envío real de la invitación falla, pero con el mensaje correcto
en español ("El envío de correos no está configurado en este
ambiente.") en vez de un error crudo — mismo comportamiento ya
conocido y documentado en tandas anteriores, no es un bug nuevo. El
formulario de invitación se queda abierto para reintentar en vez de
perderse, que es el comportamiento esperado ante un error.

## Encontré más lugares con el mismo problema, no los cubrí

El encargo pedía específicamente estos 3 formularios. Buscando
`cliente_id`/`responsable_id` en el resto del dashboard encontré otros
`<select>` planos con el mismo patrón (buscar/crear) que podrían
beneficiarse del mismo tratamiento, pero no los toqué por estar fuera
del alcance pedido:

- `web/src/app/dashboard/financiero/cotizaciones/nueva/page.tsx` —
  selector de Cliente (línea ~138), sin búsqueda ni creación inline.
- `web/src/app/dashboard/viajes/page.tsx` — selector de Cliente en
  "Nuevo viaje" (línea ~379).
- `web/src/app/dashboard/agenda/paquetes/page.tsx` — selector de
  Cliente al crear un paquete de sesiones (línea ~137).
- `web/src/app/dashboard/rutas/nueva/page.tsx` — selector de
  Responsable (línea ~342) y de Cliente (línea ~485) al armar una
  ruta.

Los componentes ya están listos y son genéricos — aplicarlos a estos
4 lugares debería ser mecánico (mismo patrón que en Agenda/Trabajos),
si querés que los cubra en una siguiente tanda.

## Nada quedó con TODO de decisión pendiente

Todas las decisiones del encargo estaban resueltas en el propio
documento (qué campos, qué mensaje mostrar, qué no auto-seleccionar) —
no hubo que dejar ningún `// TODO: decisión pendiente` en esta tanda.
