import { Router, type Request } from "express";
import { extraerDatosGuia } from "../claude";
import { supabase } from "../supabase";
import { subirFotoGuia } from "../storage";
import { env } from "../env";
import { ah } from "../asyncHandler";
import {
  descargarMediaWhatsapp,
  enviarMensajeWhatsapp,
  extraerMensajes,
  normalizarTelefono,
  verificarFirmaWebhook,
  type MensajeEntranteWhatsapp,
} from "../whatsapp";

export const whatsappRouter = Router();

type RequestConRawBody = Request & { rawBody?: Buffer };

// Verificación del webhook (una sola vez, al configurarlo en Meta:
// developers.facebook.com → tu app → WhatsApp → Configuration).
whatsappRouter.get("/webhook", (req, res) => {
  const modo = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (modo === "subscribe" && env.WHATSAPP_VERIFY_TOKEN && token === env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
});

async function yaProcesado(mensajeId: string): Promise<boolean> {
  const { error } = await supabase.from("whatsapp_mensajes_procesados").insert({ id: mensajeId });
  // Choca con la PK si ya existía — eso es exactamente la señal de "ya procesado".
  return Boolean(error);
}

async function buscarChofer(telefonoNormalizado: string) {
  const { data } = await supabase
    .from("usuarios")
    .select("id, empresa_id, telefono")
    .eq("rol", "colaborador")
    .not("telefono", "is", null);
  return (data ?? []).find((u) => normalizarTelefono(u.telefono) === telefonoNormalizado) ?? null;
}

async function manejarFoto(chofer: { id: string; empresa_id: string }, mensaje: MensajeEntranteWhatsapp, desde: string) {
  if (!mensaje.image) return;
  const media = await descargarMediaWhatsapp(mensaje.image.id);
  if (!media) {
    await enviarMensajeWhatsapp(desde, "No pude descargar la foto, ¿la puedes mandar de nuevo?");
    return;
  }

  const mimeType = media.mimeType === "image/png" ? "image/png" : media.mimeType === "image/webp" ? "image/webp" : "image/jpeg";

  let datos;
  try {
    datos = await extraerDatosGuia(media.buffer.toString("base64"), mimeType);
  } catch (err) {
    // Falla de la API de Claude (rate limit, red, etc.) — no de
    // extracción. Sin este mensaje el conductor queda esperando una
    // respuesta que nunca llega.
    console.error("Error llamando a extraerDatosGuia:", err);
    await enviarMensajeWhatsapp(desde, "Tuve un problema leyendo la foto, intenta mandarla de nuevo en un momento.");
    return;
  }

  // Ningún campo se pudo leer — probablemente la foto está borrosa,
  // cortada o no es una guía de despacho. Mejor pedir una foto más
  // clara que crear un viaje "todo por confirmar" que alguien de
  // oficina tenga que reconstruir a mano.
  if (!datos.numero_guia && !datos.origen && !datos.destino && !datos.cliente_nombre) {
    await enviarMensajeWhatsapp(
      desde,
      "No logré leer los datos de la guía en esa foto 📄 ¿Puedes mandarla de nuevo con mejor luz y que se vea completa?"
    );
    return;
  }

  let clienteId: string | null = null;
  let clienteNombre = datos.cliente_nombre?.trim() || "Por confirmar";
  if (datos.cliente_nombre) {
    const { data: match } = await supabase
      .from("clientes")
      .select("id, nombre")
      .eq("empresa_id", chofer.empresa_id)
      .ilike("nombre", `%${datos.cliente_nombre.trim()}%`)
      .limit(1)
      .maybeSingle();
    if (match) {
      clienteId = match.id;
      clienteNombre = match.nombre;
    }
  }

  const fotoKey = await subirFotoGuia(chofer.empresa_id, media.buffer, mimeType);
  const fecha = mensaje.timestamp ? new Date(Number(mensaje.timestamp) * 1000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("viajes").insert({
    empresa_id: chofer.empresa_id,
    fecha,
    numero_guia: datos.numero_guia?.trim() || "Por confirmar",
    cliente: clienteNombre,
    cliente_id: clienteId,
    chofer_id: chofer.id,
    origen: datos.origen?.trim() || "Por confirmar",
    destino: datos.destino?.trim() || "Por confirmar",
    estado: "borrador",
    origen_captura: "whatsapp",
    foto_guia_url: fotoKey,
  });

  if (error) {
    console.error("Error creando viaje desde WhatsApp:", error);
    await enviarMensajeWhatsapp(desde, "Recibí la foto pero hubo un problema guardando el viaje. Avísale al encargado.");
    return;
  }

  await enviarMensajeWhatsapp(
    desde,
    `Recibí la guía Nº ${datos.numero_guia ?? "(a confirmar)"} (${datos.origen ?? "origen a confirmar"} → ${datos.destino ?? "destino a confirmar"}).\n\nAhora mándame los kilómetros inicial y final del viaje, ej: 45230 / 45410`
  );
}

async function manejarTexto(chofer: { id: string; empresa_id: string }, mensaje: MensajeEntranteWhatsapp, desde: string) {
  const texto = mensaje.text?.body ?? "";
  const match = texto.match(/(\d{2,7})\D+(\d{2,7})/);

  const { data: pendiente } = await supabase
    .from("viajes")
    .select("id, numero_guia")
    .eq("chofer_id", chofer.id)
    .eq("origen_captura", "whatsapp")
    .is("km_inicial", null)
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!match) {
    await enviarMensajeWhatsapp(
      desde,
      pendiente
        ? "No entendí los kilómetros — mándalos como dos números, ej: 45230 / 45410"
        : "Para registrar un viaje, primero mándame una foto de la guía de despacho 📄"
    );
    return;
  }

  if (!pendiente) {
    await enviarMensajeWhatsapp(desde, "Primero mándame la foto de la guía, después te pido los kilómetros.");
    return;
  }

  const { error } = await supabase
    .from("viajes")
    .update({ km_inicial: Number(match[1]), km_final: Number(match[2]) })
    .eq("id", pendiente.id);

  if (error) {
    console.error("Error guardando km desde WhatsApp:", error);
    await enviarMensajeWhatsapp(desde, "Hubo un problema guardando los kilómetros, intenta de nuevo.");
    return;
  }

  await enviarMensajeWhatsapp(
    desde,
    `Listo ✅ Viaje (guía Nº ${pendiente.numero_guia}) registrado como borrador — el encargado lo va a revisar y confirmar.`
  );
}

whatsappRouter.post(
  "/webhook",
  ah<RequestConRawBody>(async (req, res) => {
    if (env.WHATSAPP_APP_SECRET) {
      const firmaValida = verificarFirmaWebhook(req.rawBody ?? Buffer.from(""), req.header("x-hub-signature-256"));
      if (!firmaValida) {
        res.sendStatus(403);
        return;
      }
    } else {
      console.warn("WHATSAPP_APP_SECRET no configurado — se omite la verificación de firma del webhook");
    }

    // Siempre 200 rápido: si Meta no recibe 200, reintenta agresivo y
    // puede llegar a desactivar el webhook.
    res.sendStatus(200);

    try {
      const mensajes = extraerMensajes(req.body);
      for (const mensaje of mensajes) {
        if (await yaProcesado(mensaje.id)) continue;

        const desde = mensaje.from;
        const chofer = await buscarChofer(normalizarTelefono(desde));
        if (!chofer) {
          console.warn("Mensaje de WhatsApp de un número no registrado como chofer:", desde);
          continue;
        }

        if (mensaje.type === "image") {
          await manejarFoto(chofer, mensaje, desde);
        } else if (mensaje.type === "text") {
          await manejarTexto(chofer, mensaje, desde);
        }
      }
    } catch (err) {
      console.error("Error procesando webhook de WhatsApp:", err);
    }
  })
);
