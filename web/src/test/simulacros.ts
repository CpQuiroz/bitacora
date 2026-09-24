// Ayudas para las pruebas de pantallas de la web (tarea 127). Cada prueba
// declara qué responde la API por ruta; lo no declarado responde 404.
export type RespuestasApi = Record<string, unknown | ((init?: RequestInit) => unknown)>;

export function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });
}

// La clave es la ruta sin query ("/api/me") o "MÉTODO ruta" ("PATCH /api/trabajos/t1").
export function apiFetchSimulado(respuestas: RespuestasApi) {
  return async (ruta: string, init?: RequestInit): Promise<Response> => {
    const sinQuery = ruta.split("?")[0]!;
    const metodo = (init?.method ?? "GET").toUpperCase();
    const valor = respuestas[`${metodo} ${sinQuery}`] ?? (metodo === "GET" ? respuestas[sinQuery] : undefined);
    if (valor === undefined) return respuesta({ error: `sin simulacro para ${metodo} ${sinQuery}` }, 404);
    const cuerpo = typeof valor === "function" ? (valor as (i?: RequestInit) => unknown)(init) : valor;
    return cuerpo instanceof Response ? cuerpo : respuesta(cuerpo);
  };
}

export const ME_ADMIN = {
  usuario: {
    id: "u1",
    nombre: "Admin QA",
    rol: "admin",
    empresa: { id: "e1", nombre: "Empresa QA", plan: "pro", moneda: "CLP", tema: "faena" },
  },
  modulos_visibles: ["ordenes_servicio", "agenda", "viajes", "financiero", "configuracion"],
  modulos_deshabilitados: [],
  acciones: [],
};
