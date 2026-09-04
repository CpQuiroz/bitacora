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

const STORAGE_KEY = "sync:cola:v3";
const STORAGE_KEY_VIEJO = "sync:cola:v2";
const MAX_INTENTOS = 6;
// Una acción que lleva más de esto sin poder enviarse se marca fallida
// (aunque los fallos hayan sido "sin señal") — así deja de aparecer como
// "sin sincronizar" para siempre y el usuario la puede descartar.
const VENCE_MS = 24 * 60 * 60 * 1000;

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
    if (raw) {
      cola = JSON.parse(raw) as AccionPendiente[];
    } else {
      // Migración v2 → v3: nos quedamos solo con lo reciente (< 6 h). Una
      // acción que sobrevivió una actualización de la app casi siempre
      // estaba trancada — arrastrarla solo repite el problema.
      const viejo = await AsyncStorage.getItem(STORAGE_KEY_VIEJO);
      const previas = viejo ? (JSON.parse(viejo) as AccionPendiente[]) : [];
      cola = previas.filter((a) => Date.now() - (a.creadoEn ?? 0) < 6 * 60 * 60 * 1000 && !a.fallida);
      await AsyncStorage.removeItem(STORAGE_KEY_VIEJO).catch(() => {});
      if (cola.length) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cola)).catch(() => {});
    }
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
    // Más margen para las fotos: la petición despierta al backend en
    // Render (cold start ~30–60s) además de subir la imagen.
    return apiFetch(a.path, { method: a.method, body: fd }, 45000);
  }
  return apiFetch(a.path, { method: a.method, body: JSON.stringify(a.body ?? {}) }, 30000);
}

// Auto-reintento con backoff: sin esto, una acción que falla por señal
// (o por un cold start que superó el timeout) se queda "pegada" hasta
// que el usuario mande la app a segundo plano y la vuelva a abrir. Con
// esto la cola se reintenta sola cada 5s, 10s, 20s… hasta 60s.
let reintentoTimer: ReturnType<typeof setTimeout> | null = null;
let reintentoIntento = 0;

function cancelarAutoReintento() {
  if (reintentoTimer) {
    clearTimeout(reintentoTimer);
    reintentoTimer = null;
  }
  reintentoIntento = 0;
}

function programarAutoReintento() {
  if (reintentoTimer) return;
  const espera = Math.min(5000 * 2 ** reintentoIntento, 60000);
  reintentoIntento += 1;
  reintentoTimer = setTimeout(() => {
    reintentoTimer = null;
    void procesar();
  }, espera);
}

/** Intenta vaciar la cola. Se llama al encolar, al reconectar y al foreground. */
export async function procesar(): Promise<void> {
  await asegurarCargada();
  if (procesando) return;
  const cola0 = cola.filter((a) => !a.fallida);
  if (cola0.length === 0) {
    cancelarAutoReintento();
    return;
  }
  procesando = true;
  try {
    // Las fotos (subida + análisis con IA) son lo más lento y lo menos
    // crítico: NUNCA deben bloquear el guardado del avance (check-in/out,
    // formulario, firma, finalizar). Se procesan al final, respetando el
    // orden FIFO dentro de cada grupo.
    const ordenadas = [
      ...cola0.filter((a) => a.etiqueta !== "Foto"),
      ...cola0.filter((a) => a.etiqueta === "Foto"),
    ];
    for (const a of ordenadas) {
      if (a.fallida) continue;
      // Escape hatch: una acción trancada más de 24 h se marca fallida
      // (quede como quede la señal) para que deje de aparecer como "sin
      // sincronizar" y el usuario la pueda descartar desde Perfil.
      if (Date.now() - (a.creadoEn ?? 0) > VENCE_MS) {
        a.fallida = true;
        a.ultimoError = a.ultimoError ?? "No se pudo enviar en 24 h";
        await persistir();
        continue;
      }
      try {
        const res = await ejecutar(a);
        if (res.ok || res.status === 409 || res.status === 404) {
          // 2xx = hecho. 409/404 = el servidor rechazó algo ya resuelto
          // (ej. OS ya finalizada) — no tiene sentido reintentar.
          cola = cola.filter((x) => x.id !== a.id);
          reintentoIntento = 0; // algo salió: el backoff vuelve a empezar corto
          await persistir();
        } else if (res.status === 401 || res.status === 403) {
          // Sesión vencida o sin permiso — reintentar no lo va a arreglar.
          a.fallida = true;
          a.ultimoError = res.status === 401 ? "Tu sesión venció — sal y vuelve a entrar" : "Tu rol no tiene permiso para esto";
          await persistir();
          continue;
        } else {
          const body = await res.json().catch(() => ({}));
          a.intentos += 1;
          a.ultimoError = (body as { error?: string }).error ?? `Error ${res.status}`;
          if (a.intentos >= MAX_INTENTOS) a.fallida = true;
          await persistir();
          // Un error del servidor es de ESA acción — seguimos con las
          // demás en vez de congelar toda la cola detrás de una acción
          // problemática.
          continue;
        }
      } catch (e) {
        // Timeout (el server no respondió a tiempo) SÍ cuenta como
        // intento: si pasa MAX_INTENTOS veces, la acción se marca fallida
        // en vez de reintentar para siempre. Un "sin señal" seco no
        // cuenta (el escape hatch de 24 h la cubre igual).
        const esTimeout = e instanceof Error && e.name === "AbortError";
        if (esTimeout) {
          a.intentos += 1;
          a.ultimoError = "El servidor no respondió a tiempo";
          if (a.intentos >= MAX_INTENTOS) a.fallida = true;
        } else {
          a.ultimoError = "Sin conexión";
        }
        await persistir();
        if (a.fallida) continue;
        break;
      }
    }
  } finally {
    procesando = false;
    // Si quedan acciones activas (por señal o cold start), que la cola
    // se reintente sola en vez de quedarse esperando un evento externo.
    if (cola.some((a) => !a.fallida)) programarAutoReintento();
    else cancelarAutoReintento();
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

/** Vacía la cola entera — para cuando quedó algo trancado que el usuario
 * ya no necesita. */
export async function descartarTodo(): Promise<void> {
  await asegurarCargada();
  cola = [];
  cancelarAutoReintento();
  await persistir();
}
