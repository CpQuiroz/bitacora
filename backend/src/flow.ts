// ============================================================
// BITÁCORA — Cliente delgado de la API REST de Flow (suscripción B2B a
// empresas clientes, cobro recurrente mensual). A diferencia de
// whatsapp.ts, acá las funciones SÍ propagan el error (nunca lo tragan)
// — hay dinero de por medio, quien llama decide qué hacer.
//
// Autenticación: cada request va firmado con HMAC-SHA256 sobre los
// parámetros ordenados alfabéticamente y concatenados "clave+valor",
// usando FLOW_SECRET_KEY. La firma va como parámetro "s".
//
// Confirmación de eventos (reemplaza a "verificar firma de webhook" de
// otros proveedores): Flow NO firma el POST que llega a nuestra
// confirmationUrl — solo manda un "token". Nosotros llamamos de vuelta
// a la API de Flow (firmando la petición con nuestra propia
// FLOW_SECRET_KEY) para obtener el estado verdadero del evento. Es la
// verificación real: nunca confiamos en el body del POST entrante, solo
// en lo que la propia API de Flow nos confirma cuando se lo pedimos
// nosotros. Ver consultarEstadoPago().
// ============================================================
import crypto from "node:crypto";
import { env } from "./env";

function requiereCredenciales(): { apiKey: string; secretKey: string } {
  if (!env.FLOW_API_KEY || !env.FLOW_SECRET_KEY) {
    throw new Error("Flow no está configurado (falta FLOW_API_KEY/FLOW_SECRET_KEY)");
  }
  return { apiKey: env.FLOW_API_KEY, secretKey: env.FLOW_SECRET_KEY };
}

function firmarParametros(params: Record<string, string>, secretKey: string): string {
  const claves = Object.keys(params).sort();
  const concatenado = claves.map((k) => `${k}${params[k]}`).join("");
  return crypto.createHmac("sha256", secretKey).update(concatenado).digest("hex");
}

async function llamarFlow<T = Record<string, unknown>>(
  metodo: "GET" | "POST",
  ruta: string,
  params: Record<string, string | number | undefined>
): Promise<T> {
  const { apiKey, secretKey } = requiereCredenciales();
  const limpios: Record<string, string> = { apiKey };
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) limpios[k] = String(v);
  }
  const s = firmarParametros(limpios, secretKey);
  const body = new URLSearchParams({ ...limpios, s });

  const url = `${env.FLOW_API_URL}/${ruta}`;
  const res = await fetch(metodo === "GET" ? `${url}?${body.toString()}` : url, {
    method: metodo,
    headers: metodo === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : undefined,
    body: metodo === "POST" ? body.toString() : undefined,
    signal: AbortSignal.timeout(15_000),
  });

  const texto = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(texto);
  } catch {
    throw new Error(`Flow (${ruta}) respondió algo no-JSON (status ${res.status}): ${texto.slice(0, 300)}`);
  }
  if (!res.ok) {
    const mensaje = (data as { message?: string })?.message ?? texto;
    throw new Error(`Flow (${ruta}) respondió ${res.status}: ${mensaje}`);
  }
  return data as T;
}

// ---------- Customer ----------

export async function crearClienteFlow(email: string, nombre: string, externalId: string): Promise<{ customerId: string }> {
  const data = await llamarFlow<{ customerId: string }>("POST", "customer/create", {
    email,
    name: nombre,
    externalId,
  });
  return data;
}

export async function consultarCliente(customerId: string): Promise<{ creditCardType?: string; last4CardDigits?: string; registerDate?: string | null }> {
  return llamarFlow("GET", "customer/get", { customerId });
}

// Devuelve la URL de Flow donde el usuario ingresa su tarjeta (nunca pasa
// por nuestro backend) + un token para luego consultar el resultado.
export async function linkRegistroTarjeta(customerId: string, urlRetorno: string): Promise<{ url: string; token: string }> {
  const data = await llamarFlow<{ url: string; token: string }>("POST", "customer/register", {
    customerId,
    url_return: urlRetorno,
  });
  return data;
}

export async function consultarRegistroTarjeta(token: string): Promise<{ status: string; customerId: string; creditCardType?: string; last4CardDigits?: string }> {
  return llamarFlow("GET", "customer/getRegisterStatus", { token });
}

// ---------- Subscription ----------

// El Plan mensual ($ / ciclo / reintentos / días de prueba) NO se crea por
// API — confirmado contra el sandbox: plan/create, plan/get y plan/list no
// existen (dan "No services available", el mismo error que una ruta
// inventada). Se crea UNA VEZ desde el panel web de Flow (Planes de
// Suscripción) y su id se guarda en FLOW_PLAN_ID_BASICO/FLOW_PLAN_ID_PRO — acá solo se referencia.
export async function suscribirAPlan(customerId: string, planId: string): Promise<{ subscriptionId: string }> {
  return llamarFlow("POST", "subscription/create", { customerId, planId });
}

export async function cancelarSuscripcionFlow(subscriptionId: string): Promise<void> {
  await llamarFlow("POST", "subscription/cancel", { subscriptionId });
}

export async function consultarSuscripcion(subscriptionId: string): Promise<Record<string, unknown>> {
  return llamarFlow("GET", "subscription/get", { subscriptionId });
}

// ---------- Confirmación de pagos (llamada desde el webhook) ----------

export async function consultarEstadoPago(token: string): Promise<Record<string, unknown>> {
  return llamarFlow("GET", "payment/getStatus", { token });
}
