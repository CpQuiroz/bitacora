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
import { hayConversacionActiva, manejarConversacionViaje, type ImagenEntrante } from "../whatsappFlujoViaje";

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
    datos = await extraerDatosGuia(chofer.empresa_id, media.buffer.toString("base64"), mimeType);
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
  const telefono = normalizarTelefono(desde);

  // Flujo conversacional "nuevo viaje" — tiene prioridad. Devuelve null
  // si no hay conversación activa y el texto no es un disparador; ahí se
  // sigue con el manejo legado (foto de guía + km) de abajo.
  const respuestasFlujo = await manejarConversacionViaje(chofer, telefono, texto);
  if (respuestasFlujo) {
    for (const respuesta of respuestasFlujo) await enviarMensajeWhatsapp(desde, respuesta);
    return;
  }

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
    const ayuda = env.WHATSAPP_OCR_GUIA_ACTIVO
      ? "No te entendí 🤔\n\nPara registrar un viaje, escribe *hola* y te voy pidiendo los datos.\nO mándame una foto de la guía de despacho 📄 y la leo yo."
      : "No te entendí 🤔\n\nPara registrar un viaje, escribe *hola* y te voy pidiendo los datos, incluida la foto de la guía 📷";
    await enviarMensajeWhatsapp(
      desde,
      pendiente ? "No entendí los kilómetros — mándalos como dos números, ej: 45230 / 45410" : ayuda
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
          const telefono = normalizarTelefono(desde);
          if (await hayConversacionActiva(telefono)) {
            // Descarga la imagen y se la pasa al flujo — él decide si es
            // el paso "foto" (la guarda) o no (avisa que ahí no toca).
            const media = mensaje.image ? await descargarMediaWhatsapp(mensaje.image.id) : null;
            if (!media) {
              await enviarMensajeWhatsapp(desde, "No pude descargar la foto, ¿la puedes mandar de nuevo?");
            } else {
              const mimeType = media.mimeType === "image/png" ? "image/png" : media.mimeType === "image/webp" ? "image/webp" : "image/jpeg";
              const imagen: ImagenEntrante = { buffer: media.buffer, mimeType };
              const respuestas = await manejarConversacionViaje(chofer, telefono, "", imagen);
              for (const r of respuestas ?? []) await enviarMensajeWhatsapp(desde, r);
            }
          } else if (env.WHATSAPP_OCR_GUIA_ACTIVO) {
            // OCR de foto suelta — apagado por defecto (ver env.ts).
            await manejarFoto(chofer, mensaje, desde);
          } else {
            await enviarMensajeWhatsapp(
              desde,
              "Para registrar un viaje escribe *hola* y te voy pidiendo los datos, incluida la foto de la guía 📷"
            );
          }
        } else if (mensaje.type === "text") {
          await manejarTexto(chofer, mensaje, desde);
        }
      }
    } catch (err) {
      console.error("Error procesando webhook de WhatsApp:", err);
    }
  })
);

// ------------------------------------------------------------
// Simulador — SOLO fuera de producción. Simula un mensaje entrante y
// devuelve las respuestas que el bot mandaría, sin pasar por Meta ni
// necesitar credenciales. Para probar el flujo "nuevo viaje" de punta
// a punta.
//
//   curl -s localhost:8080/api/whatsapp/_simular \
//     -H 'content-type: application/json' \
//     -d '{"telefono":"+56 9 1234 5678","texto":"hola"}'
//
// Para simular que el chofer manda la foto de la guía, pasa
// "imagen": true (usa un JPEG de prueba de 1x1 y lo sube al bucket
// "anexos" como lo haría el flujo real).
//
// Mantén el mismo "telefono" entre llamadas para continuar la misma
// conversación (el estado vive en whatsapp_conversaciones).
// ------------------------------------------------------------
const JPEG_PRUEBA_1PX = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64"
);

if (process.env.NODE_ENV !== "production") {
  whatsappRouter.post(
    "/_simular",
    ah(async (req, res) => {
      const { telefono, texto, imagen } = (req.body ?? {}) as { telefono?: unknown; texto?: unknown; imagen?: unknown };
      const conImagen = imagen === true || imagen === "true";
      if (typeof telefono !== "string" || (typeof texto !== "string" && !conImagen)) {
        res.status(400).json({ error: 'Manda { "telefono": "...", "texto": "..." } — o "imagen": true para simular la foto de la guía' });
        return;
      }
      const tel = normalizarTelefono(telefono);
      const chofer = await buscarChofer(tel);
      if (!chofer) {
        res.json({
          telefono: tel,
          chofer: null,
          respuestas: [
            "(número no vinculado a ningún usuario con rol colaborador — en producción el bot solo lo loguea y no responde)",
          ],
        });
        return;
      }
      const imagenSim: ImagenEntrante | null = conImagen ? { buffer: JPEG_PRUEBA_1PX, mimeType: "image/jpeg" } : null;
      const respuestas = await manejarConversacionViaje(chofer, tel, typeof texto === "string" ? texto : "", imagenSim);
      res.json({
        telefono: tel,
        chofer: { id: chofer.id, empresa_id: chofer.empresa_id },
        tomado_por_flujo: respuestas !== null,
        respuestas:
          respuestas ?? [
            "(el flujo conversacional no tomó el mensaje — en producción caería al manejo legado de foto de guía + km)",
          ],
      });
    })
  );
}
