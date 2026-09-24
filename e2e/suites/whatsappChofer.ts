// Tarea 141: usuarios.telefono_sufijo (columna generada) + búsqueda del chofer por WhatsApp.
// Portada al repo (tarea 127): corre dentro de la empresa E2E aislada.
import { supabase } from "../../backend/src/supabase";
import { elegirChofer } from "../../backend/src/whatsapp";
import type { Ctx } from "../entorno";

export async function whatsappChofer(ctx: Ctx): Promise<void> {
  const { check } = ctx;
  // Número al azar para no chocar con teléfonos de otras empresas de DEV.
  const abonado = String(10000000 + Math.floor(Math.random() * 89999999));
  const id = ctx.u.chofer.id;
  const { data: antes } = await supabase.from("usuarios").select("telefono").eq("id", id).single();
  await supabase.from("usuarios").update({ telefono: `+56 9 ${abonado}` }).eq("id", id);
  const { data: u } = await supabase.from("usuarios").select("telefono_sufijo").eq("id", id).single();
  check("141-1 la columna generada guarda los últimos 8 dígitos", u?.telefono_sufijo === abonado, JSON.stringify(u));
  const buscar = async (norm: string) => {
    const { data } = await supabase.from("usuarios").select("id, empresa_id, telefono").eq("rol", "colaborador").eq("telefono_sufijo", norm.slice(-8));
    return elegirChofer(data ?? [], norm);
  };
  check("141-2 encuentra al chofer con el número completo", (await buscar(`569${abonado}`))?.id === id, "");
  check("141-3 encuentra al chofer sin el 9 móvil", (await buscar(`56${abonado}`))?.id === id, "");
  check("141-4 un número desconocido no encuentra a nadie", (await buscar("56911112222")) === null, "");
  await supabase.from("usuarios").update({ telefono: "123" }).eq("id", id);
  const { data: corto } = await supabase.from("usuarios").select("telefono_sufijo").eq("id", id).single();
  check("141-5 teléfono de menos de 8 dígitos → sin sufijo", corto?.telefono_sufijo === null, JSON.stringify(corto));
  await supabase.from("usuarios").update({ telefono: antes?.telefono ?? null }).eq("id", id);
}
