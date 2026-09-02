import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "../api";

// Cola de acciones pendientes. Toda mutación desde el campo (check-in/out,
// guardar datos, firma, foto, finalizar, registrar viaje) se encola,
// se intenta al toque, y si falla por falta de señal se reintenta al
// reconectar o al volver al foreground.
//
// v1 "liviano": sin resolución de conflictos. La última escritura gana.

const STORAGE_KEY = "sync:cola:v1";
const MAX_INTENTOS = 10;

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
  listeners.forEach((l) => l(cola));
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
  l(cola);
  return () => listeners.delete(l);
}

export async function encolar(a: Omit<AccionPendiente, "id" | "creadoEn" | "intentos">): Promise<void> {
  await asegurarCargada();
  cola.push({ ...a, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, creadoEn: Date.now(), intentos: 0 });
  await persistir();
  void procesar();
}

export async function pendientes(): Promise<AccionPendiente[]> {
  await asegurarCargada();
  return cola;
}

export function pendientesDe(cola: AccionPendiente[], recurso: string): AccionPendiente[] {
  return cola.filter((a) => a.recurso === recurso);
}

async function ejecutar(a: AccionPendiente): Promise<Response> {
  if (a.archivo) {
    const fd = new FormData();
    fd.append(a.archivo.campo, { uri: a.archivo.uri, name: a.archivo.name, type: a.archivo.type } as unknown as Blob);
    if (a.body && typeof a.body === "object") {
      for (const [k, v] of Object.entries(a.body as Record<string, unknown>)) fd.append(k, String(v));
    }
    return apiFetch(a.path, { method: a.method, body: fd });
  }
  return apiFetch(a.path, { method: a.method, body: JSON.stringify(a.body ?? {}) });
}

/** Intenta vaciar la cola. Se llama al encolar, al reconectar y al foreground. */
export async function procesar(): Promise<void> {
  await asegurarCargada();
  if (procesando || cola.length === 0) return;
  procesando = true;
  try {
    // Copia estable: procesamos en orden FIFO.
    for (const a of [...cola]) {
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
          if (a.intentos >= MAX_INTENTOS) cola = cola.filter((x) => x.id !== a.id);
          await persistir();
        }
      } catch {
        // Sin señal — cortamos y reintentamos después.
        a.intentos += 1;
        a.ultimoError = "Sin conexión";
        await persistir();
        break;
      }
    }
  } finally {
    procesando = false;
  }
}

export async function descartar(id: string): Promise<void> {
  await asegurarCargada();
  cola = cola.filter((a) => a.id !== id);
  await persistir();
}
