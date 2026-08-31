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
export function crearLimitadorConcurrencia(maxSimultaneas: number) {
  let enCurso = 0;
  const cola: (() => void)[] = [];

  async function adquirir(): Promise<void> {
    if (enCurso < maxSimultaneas) {
      enCurso++;
      return;
    }
    await new Promise<void>((resolve) => cola.push(resolve));
  }

  function liberar(): void {
    const siguiente = cola.shift();
    if (siguiente) siguiente();
    else enCurso--;
  }

  return async function limitar<T>(tarea: () => Promise<T>): Promise<T> {
    await adquirir();
    try {
      return await tarea();
    } finally {
      liberar();
    }
  };
}
