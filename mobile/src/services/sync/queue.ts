import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "../api";

// Cola de acciones pendientes. Toda mutación desde el campo (check-in/out,
// guardar datos, firma, foto, finalizar, registrar viaje) se encola,
// se intenta al toque, y si falla por falta de señal se reintenta al
// reconectar o al volver al foreground.
//
// v1 "liviano": sin resolución de conflictos. La última escritura gana.
// Una acción que falla MAX_INTENTOS veces NO se borra: queda marcada
// "fallida" y visible en Perfil para que el usuario la reintente o la
// descarte a mano (nunca se pierde trabajo del usuario en silencio).

const STORAGE_KEY = "sync:cola:v2";
const MAX_INTENTOS = 6;

export type AccionPendiente = {
  id: string;
  etiqueta: string; // texto para la UI: "Check-in", "Firma del cliente"…
  recurso: string; // clave para agrupar en la UI, ej. "trabajo:<id>" o "viajes"
  path: string;
  method: "POST" | "PATCH";
  body?: unknown; // cuerpo JSON (si no hay archivo)
  archivo?: { uri: string; name: string; type: string; campo: string }; // multipart
  creadoEn: number;
  intentos: number;
  ultimoError?: string;
  fallida?: boolean; // agotó los reintentos — necesita acción del usuario
};

type Listener = (cola: AccionPendiente[]) => void;

let cola: AccionPendiente[] = [];
let cargada = false;
let procesando = false;
const listeners = new Set<Listener>();

async function persistir() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cola));
  } catch {
    /* best-effort */
  }
  listeners.forEach((l) => l([...cola]));
}

async function asegurarCargada() {
  if (cargada) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cola = raw ? (JSON.parse(raw) as AccionPendiente[]) : [];
  } catch {
    cola = [];
  }
  cargada = true;
}

export function suscribir(l: Listener): () => void {
  listeners.add(l);
  l([...cola]);
  return () => {
    listeners.delete(l);
  };
}

export async function encolar(a: Omit<AccionPendiente, "id" | "creadoEn" | "intentos">): Promise<void> {
  await asegurarCargada();
  cola.push({ ...a, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, creadoEn: Date.now(), intentos: 0 });
  await persistir();
  void procesar();
}

export async function pendientes(): Promise<AccionPendiente[]> {
  await asegurarCargada();
  return [...cola];
}

/** Acciones activas (no fallidas) — es el conteo que ve el usuario como "por sincronizar". */
export function activas(c: AccionPendiente[]): AccionPendiente[] {
  return c.filter((a) => !a.fallida);
}
export function fallidas(c: AccionPendiente[]): AccionPendiente[] {
  return c.filter((a) => a.fallida);
}

async function ejecutar(a: AccionPendiente): Promise<Response> {
  if (a.archivo) {
    const fd = new FormData();
    fd.append(a.archivo.campo, { uri: a.archivo.uri, name: a.archivo.name, type: a.archivo.type } as unknown as Blob);
    if (a.body && typeof a.body === "object") {
      for (const [k, v] of Object.entries(a.body as Record<string, unknown>)) fd.append(k, String(v));
    }
    return apiFetch(a.path, { method: a.method, body: fd }, 30000);
  }
  return apiFetch(a.path, { method: a.method, body: JSON.stringify(a.body ?? {}) }, 30000);
}

/** Intenta vaciar la cola. Se llama al encolar, al reconectar y al foreground. */
export async function procesar(): Promise<void> {
  await asegurarCargada();
  if (procesando) return;
  const cola0 = cola.filter((a) => !a.fallida);
  if (cola0.length === 0) return;
  procesando = true;
  try {
    // FIFO por orden de creación.
    for (const a of cola0) {
      if (a.fallida) continue;
      try {
        const res = await ejecutar(a);
        if (res.ok || res.status === 409 || res.status === 404) {
          // 2xx = hecho. 409/404 = el servidor rechazó algo ya resuelto
          // (ej. OS ya finalizada) — no tiene sentido reintentar.
          cola = cola.filter((x) => x.id !== a.id);
          await persistir();
        } else {
          const body = await res.json().catch(() => ({}));
          a.intentos += 1;
          a.ultimoError = (body as { error?: string }).error ?? `Error ${res.status}`;
          if (a.intentos >= MAX_INTENTOS) a.fallida = true;
          await persistir();
          if (a.fallida) continue;
          // Un error del servidor (400/422/500) casi nunca se arregla
          // reintentando en loop — cortamos y que el resto lo intente
          // en la próxima pasada.
          break;
        }
      } catch {
        // Sin señal — cortamos y reintentamos después. No cuenta como
        // intento fallido (no llegó al servidor).
        a.ultimoError = "Sin conexión";
        await persistir();
        break;
      }
    }
  } finally {
    procesando = false;
  }
}

/** Reintenta una acción que había quedado como fallida. */
export async function reintentar(id: string): Promise<void> {
  await asegurarCargada();
  const a = cola.find((x) => x.id === id);
  if (!a) return;
  a.fallida = false;
  a.intentos = 0;
  a.ultimoError = undefined;
  await persistir();
  void procesar();
}

export async function descartar(id: string): Promise<void> {
  await asegurarCargada();
  cola = cola.filter((a) => a.id !== id);
  await persistir();
}
