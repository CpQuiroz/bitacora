// ============================================================
// Semáforo simple en memoria — sin dependencia externa (p-limit),
// para no disparar más de N tareas simultáneas. Uso actual: capar
// cuántas llamadas a Claude salen a la vez (ver claude.ts), para que
// un pico de varias empresas a la vez no choque con los rate limits
// propios de la cuenta de Anthropic.
//
// El cupo se transfiere directo de una tarea que termina a la
// siguiente en cola (nunca decrementa-y-vuelve-a-incrementar) — evita
// una carrera donde una tarea nueva "cuela" un cupo entre que se
// libera y que la de la cola lo toma.
// ============================================================
export class EsperaEnColaExcedida extends Error {
  // El handler global de errores (server.ts) usa `.status` para devolver
  // un 4xx/5xx "esperado" sin loguearlo como bug.
  status = 503;
  constructor() {
    super("El servidor está con mucha carga generando informes. Reintenta en unos minutos.");
    this.name = "EsperaEnColaExcedida";
  }
}

export function crearLimitadorConcurrencia(maxSimultaneas: number) {
  let enCurso = 0;
  const cola: (() => void)[] = [];

  function adquirir(maxEsperaMs?: number): Promise<void> {
    if (enCurso < maxSimultaneas) {
      enCurso++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const cupo = () => {
        if (timer) clearTimeout(timer);
        resolve();
      };
      cola.push(cupo);
      if (maxEsperaMs != null) {
        timer = setTimeout(() => {
          const i = cola.indexOf(cupo);
          if (i !== -1) cola.splice(i, 1); // salir de la cola sin tomar cupo
          reject(new EsperaEnColaExcedida());
        }, maxEsperaMs);
      }
    });
  }

  function liberar(): void {
    const siguiente = cola.shift();
    if (siguiente) siguiente();
    else enCurso--;
  }

  return async function limitar<T>(tarea: () => Promise<T>, maxEsperaMs?: number): Promise<T> {
    await adquirir(maxEsperaMs);
    try {
      return await tarea();
    } finally {
      liberar();
    }
  };
}
