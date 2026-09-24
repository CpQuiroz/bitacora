import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { File } from "expo-file-system";
import { apiFetch, TIMEOUT_MULTIPART_MS } from "../api";
import { borrarFoto, fotoExiste } from "../../lib/fotoCola";
import { preferencias } from "../../lib/preferencias";

// Una acción con archivo que sube una foto (no crea el recurso). Se
// procesan al final y, si el archivo ya no está, se marcan fallidas sin
// reintentar para siempre.
const ES_SUBIDA_DE_FOTO = (a: { etiqueta: string }) =>
  a.etiqueta === "Foto" || a.etiqueta === "Foto de la guía" || a.etiqueta === "Foto de viaje" || a.etiqueta === "Foto de levantamiento";

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
export const MAX_INTENTOS = 6;
// Una acción que lleva más de esto sin poder enviarse se marca fallida
// (aunque los fallos hayan sido "sin señal") — así deja de aparecer como
// "sin sincronizar" para siempre y el usuario la puede descartar.
const VENCE_MS = 24 * 60 * 60 * 1000;

export type ArchivoCola = { uri: string; name: string; type: string; campo: string };

export type AccionPendiente = {
  id: string;
  etiqueta: string; // texto para la UI: "Check-in", "Firma del cliente"…
  recurso: string; // clave para agrupar en la UI, ej. "trabajo:<id>" o "viajes"
  path: string;
  method: "POST" | "PATCH";
  body?: unknown; // campos de texto; si no hay archivo(s) se manda como JSON
  archivo?: ArchivoCola; // multipart, un archivo (sube una foto suelta)
  archivos?: ArchivoCola[]; // multipart, varios archivos (ej. registro de mantención)
  creadoEn: number;
  intentos: number;
  ultimoError?: string;
  fallida?: boolean; // agotó los reintentos — necesita acción del usuario
  // Cuándo arrancó el intento más reciente que tiene archivo(s). Un
  // fetch de FormData que "timeoutea" del lado del cliente NO se puede
  // abortar de verdad en RN (ver api.ts) — el request original sigue
  // viajando. Sin este campo, un reconectar/foreground disparaba un
  // reintento mientras el intento anterior todavía podía estar en
  // camino, apilando subidas concurrentes de la MISMA foto hasta que
  // ninguna terminaba nunca. Bug real (2026-09-11): "se quedó
  // sincronizando" y el registro nunca se creó.
  ultimoIntentoEn?: number;
  // true SOLO mientras el intento en curso pudo haber quedado viajando
  // en segundo plano (timeout del lado del cliente, ver api.ts) — se
  // limpia en cuanto llega una respuesta HTTP real (éxito o error) o un
  // fallo de red normal, casos en los que el fetch ya terminó de verdad
  // y no hay nada "en vuelo". Bug real (2026-09-11, v2): con solo
  // `ultimoIntentoEn`, CUALQUIER intento fallido (no solo un timeout)
  // dejaba bloqueado el botón "Reintentar ahora" hasta 90s después,
  // sin ningún aviso — el usuario tocaba sincronizar y "no pasaba nada".
  intentoEnVuelo?: boolean;
};

// Todos los archivos de una acción (unifica archivo + archivos).
function archivosDe(a: AccionPendiente): ArchivoCola[] {
  return a.archivos && a.archivos.length ? a.archivos : a.archivo ? [a.archivo] : [];
}

type Listener = (cola: AccionPendiente[]) => void;

let cola: AccionPendiente[] = [];
let cargada = false;
let procesando = false;
// Cuándo arrancó el `procesando = true` actual. Bug real (14-sep-2026):
// "Reintentar ahora" aparecía pero no hacía nada, sin error visible —
// causa real: `procesando` es una bandera module-level que solo se
// limpia en el `finally` de este mismo procesar(); si el `await` de
// `ejecutar(a)` se cuelga sin resolver NI rechazar nunca (un fetch de
// verdad "colgado" — plausible en algunos dispositivos/Android aunque
// el AbortController debería evitarlo, ver api.ts), ese `finally` nunca
// corre y `procesando` queda en `true` para siempre: cualquier llamada
// futura a procesar() (reintentar manual, reconectar, foreground) entra
// al primer `if (procesando) return;` y no hace absolutamente nada,
// sin ningún aviso. Techo de seguridad: pasado este tiempo, un
// `procesando` viejo se considera trancado y NO bloquea un intento
// nuevo — ningún fetch real (multipart incluido) debería tardar más
// que esto.
let procesandoDesde: number | null = null;
const PROCESANDO_MAX_MS = TIMEOUT_MULTIPART_MS + 30000;
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
  const archivos = archivosDe(a);
  if (archivos.length > 0) {
    const fd = new FormData();
    for (const f of archivos) {
      // Causa REAL encontrada (14-sep-2026, tarea 20/29, diagnosticada con
      // un botón de prueba en Perfil): el objeto {uri,name,type} —
      // convención vieja de React Native para FormData — ya NO es válido.
      // El fetch propio de Expo (activo ahora, reemplaza el fetch global
      // — ver node_modules/expo/src/winter/fetch/convertFormData.ts)
      // exige un Blob/File real (algo con .bytes() o instanceof Blob) y
      // rechaza ese objeto con "Unsupported FormDataPart implementation"
      // — un error SÍNCRONO, casi instantáneo (1-9ms), NO un cuelgue.
      // Por qué se veía como "cuelgue" / "0 intentos para siempre": el
      // catch de más abajo solo incrementa `intentos` en la rama de
      // timeout — un error normal (no-timeout) cae en la rama que solo
      // guarda `ultimoError` sin tocar `intentos` (ver más abajo, mismo
      // archivo) — indistinguible en la UI de "nunca se intentó".
      // `File` (expo-file-system) SÍ implementa Blob (.bytes(), .type,
      // .name derivados del archivo real) — pasa la validación nueva.
      fd.append(f.campo, new File(f.uri));
    }
    if (a.body && typeof a.body === "object") {
      for (const [k, v] of Object.entries(a.body as Record<string, unknown>)) {
        if (v === undefined || v === null) continue;
        fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
      }
    }
    // Más margen para las fotos: la petición despierta al backend en
    // Render (cold start ~30–60s) además de subir la imagen.
    return apiFetch(a.path, { method: a.method, body: fd }, TIMEOUT_MULTIPART_MS);
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

// Diagnóstico (14-sep-2026): "Reintentar ahora" no mostraba NUNCA ningún
// efecto en un caso real reportado, ni siquiera un error — ni para una
// foto nueva ni para dos acciones sin foto (JSON puro) que llevaban
// >15 h en la cola con 0 intentos. Cualquier error que escape del try
// principal de procesar() (no el catch por-acción, que ya existía) se
// convertía en una promesa rechazada sin capturar — en un build de
// release, React Native se la traga en silencio, sin log ni Alert ni
// nada visible. Este catch la registra para poder mostrarla desde
// Perfil/NetworkProvider en vez de perderla.
let ultimoErrorProcesar: string | null = null;
export function ultimoErrorGlobal(): string | null {
  return ultimoErrorProcesar;
}

/** Intenta vaciar la cola. Se llama al encolar, al reconectar y al foreground. */
export async function procesar(): Promise<void> {
  await asegurarCargada();
  if (procesando) {
    const trancado = procesandoDesde != null && Date.now() - procesandoDesde > PROCESANDO_MAX_MS;
    if (!trancado) return;
    // Se pasó del techo — algo quedó colgado de verdad. No lo dejamos
    // bloqueado para siempre: seguimos igual, como si no hubiera nada
    // en curso. Si el fetch viejo total sigue viajando en el fondo, en
    // el peor caso corre en paralelo con este intento nuevo (mismo
    // riesgo que ya existe documentado para multipart) — preferible a
    // "Reintentar ahora" sin ningún efecto para siempre.
  }
  const cola0 = cola.filter((a) => !a.fallida);
  if (cola0.length === 0) {
    cancelarAutoReintento();
    return;
  }
  procesando = true;
  procesandoDesde = Date.now();
  try {
    // "Subir fotos solo con WiFi": en datos móviles se saltan las
    // subidas de foto (quedan en la cola para el próximo pase con WiFi).
    let subirFotos = true;
    if (preferencias().fotosSoloWifi) {
      try {
        subirFotos = (await NetInfo.fetch()).type === "wifi";
      } catch {
        subirFotos = true;
      }
    }

    // Las fotos (subida + análisis con IA) son lo más lento y lo menos
    // crítico: NUNCA deben bloquear el guardado del avance (check-in/out,
    // formulario, firma, finalizar). Se procesan al final, respetando el
    // orden FIFO dentro de cada grupo.
    const ordenadas = [
      ...cola0.filter((a) => !ES_SUBIDA_DE_FOTO(a)),
      ...(subirFotos ? cola0.filter((a) => ES_SUBIDA_DE_FOTO(a)) : []),
    ];
    for (const a of ordenadas) {
      if (a.fallida) continue;
      // La foto ya no está en el teléfono (el SO limpió el archivo antes
      // de que pudiéramos subirla) — reintentar no la trae de vuelta.
      if (archivosDe(a).some((f) => !fotoExiste(f.uri))) {
        a.fallida = true;
        a.ultimoError = "Una foto ya no está en el teléfono — vuelve a sacarla y a guardar";
        await persistir();
        continue;
      }
      // El intento anterior con archivo(s) puede seguir viajando de
      // verdad (fetch de FormData no cancelable) aunque ya haya
      // "timeouteado" para nosotros — no lanzar otro en paralelo. Solo
      // aplica mientras `intentoEnVuelo` sigue true (timeout del
      // cliente sin respuesta real todavía); un intento que ya recibió
      // una respuesta HTTP o un error de red se puede reintentar al
      // toque, sin esperar.
      if (archivosDe(a).length > 0 && a.intentoEnVuelo && a.ultimoIntentoEn && Date.now() - a.ultimoIntentoEn < TIMEOUT_MULTIPART_MS) {
        continue;
      }
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
        if (archivosDe(a).length > 0) {
          a.ultimoIntentoEn = Date.now();
          a.intentoEnVuelo = true;
        }
        const res = await ejecutar(a);
        // Llegó una respuesta HTTP real: el fetch terminó de verdad, ya
        // no hay nada "en vuelo" para esta acción.
        a.intentoEnVuelo = false;
        if (res.ok || res.status === 409 || res.status === 404) {
          // 2xx = hecho. 409/404 = el servidor rechazó algo ya resuelto
          // (ej. OS ya finalizada) — no tiene sentido reintentar.
          for (const f of archivosDe(a)) borrarFoto(f.uri);
          cola = cola.filter((x) => x.id !== a.id);
          reintentoIntento = 0; // algo salió: el backoff vuelve a empezar corto
          await persistir();
        } else if (res.status === 401 || res.status === 403) {
          // Sesión vencida, sin permiso o tope del plan — reintentar solo
          // no lo va a arreglar. Un 403 trae el motivo real del backend
          // (ej. code "LIMITE_PLAN": "Llegaste al límite de órdenes…"):
          // se muestra ese texto; queda fallida y se puede reintentar
          // desde Perfil cuando se libere cupo o se suba de plan.
          const body = res.status === 403 ? await res.json().catch(() => ({})) : {};
          a.fallida = true;
          a.ultimoError =
            res.status === 401
              ? "Tu sesión venció — sal y vuelve a entrar"
              : (body as { error?: string }).error ?? "Tu rol no tiene permiso para esto";
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
        const detalle = e instanceof Error ? e.message : String(e);
        if (esTimeout) {
          a.intentos += 1;
          a.ultimoError = "El servidor no respondió a tiempo";
          if (a.intentos >= MAX_INTENTOS) a.fallida = true;
          // NO se limpia intentoEnVuelo: es justo el caso en que el
          // fetch original puede seguir viajando de verdad.
        } else if (archivosDe(a).some((f) => !fotoExiste(f.uri))) {
          // El fetch no pudo leer el archivo — ya no está.
          a.fallida = true;
          a.ultimoError = "Una foto ya no está en el teléfono — vuelve a sacarla y a guardar";
          a.intentoEnVuelo = false;
        } else {
          // Guardrail: dejamos el error real (no solo "Sin conexión") —
          // si esto vuelve a fallar, que se sepa por qué sin adivinar.
          a.ultimoError = detalle && detalle !== "Network request failed" ? `Sin conexión — ${detalle.slice(0, 100)}` : "Sin conexión";
          // Un error de red normal (no timeout) significa que el fetch
          // ya terminó (rechazado), no que sigue viajando.
          a.intentoEnVuelo = false;
        }
        await persistir();
        if (a.fallida) continue;
        break;
      }
    }
    ultimoErrorProcesar = null; // pasada completa sin excepciones — limpio el diagnóstico
  } catch (e) {
    // Ver el comentario sobre ultimoErrorProcesar más arriba — sin esto,
    // un error que escape de la lógica de esta función (no el catch
    // por-acción de más arriba) desaparecía sin dejar rastro.
    ultimoErrorProcesar = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    throw e;
  } finally {
    procesando = false;
    procesandoDesde = null;
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
  // El reintento manual reinicia el reloj de 24 h — si no, el escape
  // hatch la volvía a marcar fallida al instante (creadoEn ya vencido) y
  // "Reintentar" no hacía nada visible.
  a.creadoEn = Date.now();
  await persistir();
  void procesar();
}

export async function descartar(id: string): Promise<void> {
  await asegurarCargada();
  const a = cola.find((x) => x.id === id);
  if (a) for (const f of archivosDe(a)) borrarFoto(f.uri);
  cola = cola.filter((x) => x.id !== id);
  await persistir();
}

/** Vacía la cola entera — para cuando quedó algo trancado que el usuario
 * ya no necesita. */
export async function descartarTodo(): Promise<void> {
  await asegurarCargada();
  for (const a of cola) for (const f of archivosDe(a)) borrarFoto(f.uri);
  cola = [];
  cancelarAutoReintento();
  await persistir();
}
