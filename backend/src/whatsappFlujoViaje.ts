// ============================================================
// BITÁCORA — Flujo conversacional "nuevo viaje" del bot de WhatsApp.
//
// State machine simple: el chofer escribe "nuevo viaje" y el bot le va
// pidiendo un dato por mensaje (cliente → guía → origen → destino →
// vehículo → km → monto → IVA → confirmación). El progreso vive en la
// tabla whatsapp_conversaciones, con el teléfono como key (una
// conversación por chofer, aisladas entre sí).
//
// Este módulo NO llama a enviarMensajeWhatsapp: cada handler devuelve
// los textos a responder (string[]) y el webhook los manda. Así el
// endpoint /_simular puede probar el flujo completo sin credenciales
// de Meta.
// ============================================================
import type { PasoConversacionWhatsapp } from "@bitacora/shared";
import { supabase } from "./supabase";
import { calcularMontos } from "./viajesMontos";

type Chofer = { id: string; empresa_id: string };

type Candidato = { id: string; label: string };

type Datos = {
  cliente_id?: string;
  cliente_nombre?: string;
  numero_guia?: string;
  origen?: string;
  destino?: string;
  equipo_id?: string | null;
  equipo_label?: string | null;
  km_inicial?: number | null;
  km_final?: number | null;
  subtotal?: number;
  aplica_iva?: boolean;
  candidatos?: Candidato[];
};

const MAX_CANDIDATOS = 8;

// ------------------------------------------------------------
// Normalización y comandos
// ------------------------------------------------------------
// Rango de marcas diacríticas combinantes (U+0300–U+036F) — construido
// con RegExp() para no meter caracteres combinantes en el fuente.
const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

function norm(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .trim()
    .toLowerCase();
}

function esCancelar(t: string): boolean {
  return ["cancelar", "cancela", "cancelo", "anular", "salir", "parar"].includes(norm(t));
}

function esTrigger(t: string): boolean {
  const n = norm(t);
  return (
    n === "nuevo viaje" ||
    n === "nuevoviaje" ||
    n === "nuevo" ||
    n === "viaje" ||
    n === "registrar viaje" ||
    n === "cargar viaje" ||
    n.startsWith("nuevo viaje")
  );
}

function esSi(t: string): boolean {
  return ["si", "s", "sí", "yes", "ya", "dale", "ok", "oka", "okay", "confirmo", "confirmar", "listo"].includes(norm(t));
}

function esNo(t: string): boolean {
  return ["no", "n", "nel", "nop", "negativo"].includes(norm(t));
}

function esOmitir(t: string): boolean {
  const n = norm(t);
  return ["-", "--", "x", "no", "no aplica", "na", "n/a", "ninguno", "ninguna", "omitir", "saltar", "sin"].includes(n);
}

function parseMonto(s: string): number | null {
  const limpio = (s ?? "").replace(/[^\d]/g, "");
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseKm(s: string): { inicial: number; final: number } | null {
  const m = (s ?? "").match(/(\d+(?:[.,]\d+)?)\s*(?:\/|-|a|hasta|,|;|\s)\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return null;
  const inicial = Number(m[1].replace(",", "."));
  const final = Number(m[2].replace(",", "."));
  if (!Number.isFinite(inicial) || !Number.isFinite(final)) return null;
  return { inicial, final };
}

// ------------------------------------------------------------
// Persistencia de la conversación
// ------------------------------------------------------------
async function cargarConversacion(telefono: string) {
  const { data } = await supabase.from("whatsapp_conversaciones").select("*").eq("telefono", telefono).maybeSingle();
  return data;
}

async function guardar(telefono: string, chofer: Chofer, paso: PasoConversacionWhatsapp, datos: Datos) {
  await supabase.from("whatsapp_conversaciones").upsert({
    telefono,
    empresa_id: chofer.empresa_id,
    usuario_id: chofer.id,
    flujo: "viaje",
    paso,
    datos,
    actualizado_en: new Date().toISOString(),
  });
}

async function borrar(telefono: string) {
  await supabase.from("whatsapp_conversaciones").delete().eq("telefono", telefono);
}

export async function hayConversacionActiva(telefono: string): Promise<boolean> {
  return Boolean(await cargarConversacion(telefono));
}

// ------------------------------------------------------------
// Búsquedas contra la empresa del chofer
// ------------------------------------------------------------
async function buscarClientes(empresaId: string, texto: string) {
  const t = texto.trim().replace(/[%,()]/g, "");
  const { data } = await supabase
    .from("clientes")
    .select("id, nombre")
    .eq("empresa_id", empresaId)
    .ilike("nombre", `%${t}%`)
    .order("nombre")
    .limit(MAX_CANDIDATOS);
  return data ?? [];
}

async function listarNombresClientes(empresaId: string): Promise<string[]> {
  const { data } = await supabase
    .from("clientes")
    .select("nombre")
    .eq("empresa_id", empresaId)
    .order("nombre")
    .limit(MAX_CANDIDATOS);
  return (data ?? []).map((c) => c.nombre);
}

async function buscarEquipos(empresaId: string, texto: string) {
  const t = texto.trim().replace(/[%,()]/g, "");
  const { data } = await supabase
    .from("equipos")
    .select("id, nombre, patente")
    .eq("empresa_id", empresaId)
    .or(`nombre.ilike.%${t}%,patente.ilike.%${t}%`)
    .limit(MAX_CANDIDATOS);
  return data ?? [];
}

function etiquetaEquipo(e: { nombre: string | null; patente: string | null }): string {
  if (e.patente && e.nombre) return `${e.nombre} (${e.patente})`;
  return e.patente || e.nombre || "vehículo";
}

// ------------------------------------------------------------
// Prompts
// ------------------------------------------------------------
const PROMPTS: Record<string, string> = {
  cliente: "🚚 Nuevo viaje.\n\n¿Para qué cliente es? Escribe el nombre (o parte). Escribe *cancelar* en cualquier momento para salir.",
  guia: "¿Número de la guía de despacho?",
  origen: "¿Desde dónde salió el viaje? (origen)",
  destino: "¿A dónde llegó? (destino)",
  equipo: "¿Qué vehículo usaste? Escribe la patente o el nombre. Si no aplica, escribe *-*.",
  km: "¿Kilómetros inicial y final? Ej: *45230 / 45410*. Si no los tienes, escribe *-*.",
  monto: "¿Monto del viaje en pesos? (solo el número, sin IVA)",
  iva: "¿Se aplica IVA (19%)? Responde *SI* o *NO*.",
};

function resumen(d: Datos): string {
  const subtotal = d.subtotal ?? 0;
  const aplicaIva = d.aplica_iva ?? true;
  const { iva, total } = calcularMontos(subtotal, aplicaIva);
  const hoy = new Date().toISOString().slice(0, 10);
  const kmLinea =
    d.km_inicial != null && d.km_final != null
      ? `🛣️ Km: ${d.km_inicial} → ${d.km_final} (${Math.max(0, d.km_final - d.km_inicial)} km)`
      : "🛣️ Km: sin especificar";
  return [
    "Revisa antes de guardar:",
    "",
    `👤 Cliente: ${d.cliente_nombre ?? "—"}`,
    `📄 Guía: ${d.numero_guia ?? "—"}`,
    `📍 Ruta: ${d.origen ?? "—"} → ${d.destino ?? "—"}`,
    `🚛 Vehículo: ${d.equipo_label ?? "sin especificar"}`,
    kmLinea,
    `📅 Fecha: hoy (${hoy})`,
    "",
    `💰 Monto: $${subtotal.toLocaleString("es-CL")}${aplicaIva ? ` + IVA $${iva.toLocaleString("es-CL")}` : " (sin IVA)"}`,
    `   Total: $${total.toLocaleString("es-CL")}`,
    "",
    "Responde *SI* para guardar, *NO* para descartar.",
  ].join("\n");
}

// ------------------------------------------------------------
// Alta del viaje (mismo insert que routes/viajes.ts, estado 'borrador'
// como todo lo capturado por WhatsApp — la oficina lo revisa/confirma
// en la web). IVA calculado con calcularMontos, no reimplementado.
// ------------------------------------------------------------
async function crearViaje(chofer: Chofer, d: Datos): Promise<string | null> {
  const { subtotal, iva, total } = calcularMontos(d.subtotal ?? 0, d.aplica_iva ?? true);
  const { error } = await supabase.from("viajes").insert({
    empresa_id: chofer.empresa_id,
    fecha: new Date().toISOString().slice(0, 10),
    numero_guia: d.numero_guia?.trim() || "Sin número",
    cliente: d.cliente_nombre ?? "Por confirmar",
    cliente_id: d.cliente_id ?? null,
    chofer_id: chofer.id,
    equipo_id: d.equipo_id ?? null,
    origen: d.origen?.trim() || "Por confirmar",
    destino: d.destino?.trim() || "Por confirmar",
    km_inicial: d.km_inicial ?? null,
    km_final: d.km_final ?? null,
    subtotal,
    aplica_iva: d.aplica_iva ?? true,
    iva,
    total,
    estado: "borrador",
    origen_captura: "whatsapp",
  });
  return error ? error.message : null;
}

// ------------------------------------------------------------
// Entrada principal.
//
// Devuelve:
//  - string[]  -> el flujo tomó el mensaje; son las respuestas a enviar.
//  - null      -> no hay conversación activa y el texto no es un
//                 disparador; el webhook sigue con su manejo legado
//                 (foto de guía + km).
// ------------------------------------------------------------
export async function manejarConversacionViaje(
  chofer: Chofer,
  telefono: string,
  textoCrudo: string
): Promise<string[] | null> {
  const texto = (textoCrudo ?? "").trim();
  const conv = await cargarConversacion(telefono);

  if (esCancelar(texto)) {
    if (!conv) return null;
    await borrar(telefono);
    return ["Listo, cancelé el registro del viaje. Escribe *nuevo viaje* cuando quieras empezar otro."];
  }

  if (esTrigger(texto)) {
    await guardar(telefono, chofer, "cliente", {});
    return [conv ? "Ok, empecemos de nuevo.\n\n" + PROMPTS.cliente : PROMPTS.cliente];
  }

  if (!conv) return null;

  const datos = (conv.datos ?? {}) as Datos;
  return despachar(chofer, telefono, conv.paso as PasoConversacionWhatsapp, datos, texto);
}

async function despachar(
  chofer: Chofer,
  telefono: string,
  paso: PasoConversacionWhatsapp,
  datos: Datos,
  texto: string
): Promise<string[]> {
  switch (paso) {
    // ---- Cliente -------------------------------------------------
    case "cliente": {
      if (!texto) return [PROMPTS.cliente];
      const matches = await buscarClientes(chofer.empresa_id, texto);
      if (matches.length === 0) {
        const lista = await listarNombresClientes(chofer.empresa_id);
        return [
          lista.length
            ? `No encontré ningún cliente que diga "${texto}".\n\nAlgunos clientes registrados:\n${lista
                .map((n) => `• ${n}`)
                .join("\n")}\n\nEscribe el nombre de nuevo.`
            : `No encontré ningún cliente que diga "${texto}", y no hay clientes cargados todavía. Pídele a la oficina que agregue el cliente y volvé a intentar.`,
        ];
      }
      if (matches.length === 1) {
        datos.cliente_id = matches[0].id;
        datos.cliente_nombre = matches[0].nombre;
        await guardar(telefono, chofer, "guia", datos);
        return [`Cliente: *${matches[0].nombre}* ✅`, PROMPTS.guia];
      }
      datos.candidatos = matches.map((m) => ({ id: m.id, label: m.nombre }));
      await guardar(telefono, chofer, "cliente_elegir", datos);
      return [`Encontré varios clientes. ¿Cuál?\n${matches.map((m, i) => `${i + 1}. ${m.nombre}`).join("\n")}\n\nResponde con el número.`];
    }

    case "cliente_elegir": {
      const elegido = elegirCandidato(texto, datos.candidatos ?? []);
      if (!elegido) return [`Responde con un número del 1 al ${(datos.candidatos ?? []).length}.`];
      datos.cliente_id = elegido.id;
      datos.cliente_nombre = elegido.label;
      delete datos.candidatos;
      await guardar(telefono, chofer, "guia", datos);
      return [`Cliente: *${elegido.label}* ✅`, PROMPTS.guia];
    }

    // ---- Guía / Origen / Destino --------------------------------
    case "guia": {
      if (!texto) return ["El número de guía no puede quedar vacío. " + PROMPTS.guia];
      datos.numero_guia = texto.slice(0, 60);
      await guardar(telefono, chofer, "origen", datos);
      return [PROMPTS.origen];
    }

    case "origen": {
      if (!texto) return [PROMPTS.origen];
      datos.origen = texto.slice(0, 120);
      await guardar(telefono, chofer, "destino", datos);
      return [PROMPTS.destino];
    }

    case "destino": {
      if (!texto) return [PROMPTS.destino];
      datos.destino = texto.slice(0, 120);
      await guardar(telefono, chofer, "equipo", datos);
      return [PROMPTS.equipo];
    }

    // ---- Vehículo ----------------------------------------------
    case "equipo": {
      if (esOmitir(texto)) {
        datos.equipo_id = null;
        datos.equipo_label = null;
        await guardar(telefono, chofer, "km", datos);
        return [PROMPTS.km];
      }
      const matches = await buscarEquipos(chofer.empresa_id, texto);
      if (matches.length === 0) {
        return [`No encontré ningún vehículo que diga "${texto}". Escribe la patente o el nombre exacto, o *-* para omitir.`];
      }
      if (matches.length === 1) {
        datos.equipo_id = matches[0].id;
        datos.equipo_label = etiquetaEquipo(matches[0]);
        await guardar(telefono, chofer, "km", datos);
        return [`Vehículo: *${datos.equipo_label}* ✅`, PROMPTS.km];
      }
      datos.candidatos = matches.map((m) => ({ id: m.id, label: etiquetaEquipo(m) }));
      await guardar(telefono, chofer, "equipo_elegir", datos);
      return [
        `Encontré varios vehículos. ¿Cuál?\n${datos.candidatos.map((c, i) => `${i + 1}. ${c.label}`).join("\n")}\n\nResponde con el número.`,
      ];
    }

    case "equipo_elegir": {
      const elegido = elegirCandidato(texto, datos.candidatos ?? []);
      if (!elegido) return [`Responde con un número del 1 al ${(datos.candidatos ?? []).length}, o *-* para omitir el vehículo.`];
      datos.equipo_id = elegido.id;
      datos.equipo_label = elegido.label;
      delete datos.candidatos;
      await guardar(telefono, chofer, "km", datos);
      return [`Vehículo: *${elegido.label}* ✅`, PROMPTS.km];
    }

    // ---- Km ----------------------------------------------------
    case "km": {
      if (esOmitir(texto)) {
        datos.km_inicial = null;
        datos.km_final = null;
        await guardar(telefono, chofer, "monto", datos);
        return [PROMPTS.monto];
      }
      const km = parseKm(texto);
      if (!km) return ["No entendí los kilómetros. Mándalos como dos números, ej: *45230 / 45410*. O *-* para omitir."];
      if (km.final < km.inicial) {
        return [`El km final (${km.final}) no puede ser menor al inicial (${km.inicial}). Mándalos de nuevo, ej: *45230 / 45410*.`];
      }
      datos.km_inicial = km.inicial;
      datos.km_final = km.final;
      await guardar(telefono, chofer, "monto", datos);
      return [PROMPTS.monto];
    }

    // ---- Monto / IVA -----------------------------------------
    case "monto": {
      const monto = parseMonto(texto);
      if (monto == null) return ["El monto tiene que ser un número mayor a cero, ej: *85000*."];
      datos.subtotal = monto;
      await guardar(telefono, chofer, "iva", datos);
      return [PROMPTS.iva];
    }

    case "iva": {
      if (esSi(texto)) datos.aplica_iva = true;
      else if (esNo(texto)) datos.aplica_iva = false;
      else return ["Responde *SI* o *NO*: ¿se aplica IVA (19%)?"];
      await guardar(telefono, chofer, "confirmar", datos);
      return [resumen(datos)];
    }

    // ---- Confirmación ---------------------------------------
    case "confirmar": {
      if (esSi(texto)) {
        const err = await crearViaje(chofer, datos);
        await borrar(telefono);
        if (err) {
          console.error("Error creando viaje desde el flujo de WhatsApp:", err);
          return ["Uf, hubo un problema guardando el viaje 😕 Avísale a la oficina para que lo carguen a mano."];
        }
        return [
          "✅ Viaje registrado como borrador. La oficina lo revisa y lo confirma.\n\nSi te equivocaste, escribe *nuevo viaje* para cargar otro, o avísale a la oficina para corregir este.",
        ];
      }
      if (esNo(texto)) {
        await borrar(telefono);
        return ["Ok, descarté el viaje. Escribe *nuevo viaje* para empezar de nuevo."];
      }
      return ["Responde *SI* para guardar el viaje, o *NO* para descartarlo.\n\n" + resumen(datos)];
    }

    // ---- Paso desconocido (no debería pasar) ----------------
    default: {
      await guardar(telefono, chofer, "cliente", {});
      return ["Perdí el hilo de la conversación, empecemos de nuevo.\n\n" + PROMPTS.cliente];
    }
  }
}

function elegirCandidato(texto: string, candidatos: Candidato[]): Candidato | null {
  const idx = Number((texto ?? "").replace(/\D/g, "")) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= candidatos.length) return null;
  return candidatos[idx];
}
