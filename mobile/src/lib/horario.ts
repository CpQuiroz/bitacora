// Helpers de fecha/hora para las pantallas de reserva (Detalle y Nueva
// reserva, tema cosmetología) — nada de esto vive en el backend porque
// son puramente de presentación (la duración/hora_fin real siempre se
// deriva de hora+duracion_min, nunca se guarda).

/** "HH:MM" + minutos → "HH:MM" (con wrap de día, sin acarrear la fecha). */
export function sumarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(":").map(Number);
  const total = ((h * 60 + m + minutos) % (24 * 60) + 24 * 60) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** 90 → "1 h 30 min"; 60 → "1 hora"; 45 → "45 min". */
export function formatearDuracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  const textoHoras = `${horas} ${horas === 1 ? "hora" : "horas"}`;
  return resto === 0 ? textoHoras : `${textoHoras} ${resto} min`;
}

/** "2026-09-05" → "viernes 5 de septiembre". */
export function formatearFechaLarga(fechaISO: string): string {
  const d = new Date(`${fechaISO}T00:00:00`);
  const texto = d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "2026-09-05" → "05-09". */
export function formatearFechaCorta(fechaISO: string): string {
  const d = new Date(`${fechaISO}T00:00:00`);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-09-05" → "05-09-2026". */
export function formatearFechaCompleta(fechaISO: string): string {
  const d = new Date(`${fechaISO}T00:00:00`);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

/** "09:00", "18:00", 30 → ["09:00", "09:30", ..., "17:30"] (excluye horaFin). */
export function generarSlots(horaInicio: string, horaFin: string, pasoMin: number): string[] {
  const slots: string[] = [];
  const [hi, mi] = horaInicio.split(":").map(Number);
  const [hf, mf] = horaFin.split(":").map(Number);
  let actual = hi * 60 + mi;
  const fin = hf * 60 + mf;
  while (actual < fin) {
    slots.push(`${String(Math.floor(actual / 60)).padStart(2, "0")}:${String(actual % 60).padStart(2, "0")}`);
    actual += pasoMin;
  }
  return slots;
}

/** true si `fecha`+`hora` cae antes de "ahora + anticipacionHoras". */
export function fueraDeAnticipacion(fecha: string, hora: string, anticipacionHoras: number, ahora: Date = new Date()): boolean {
  const momento = new Date(`${fecha}T${hora}:00`);
  const limite = new Date(ahora.getTime() + anticipacionHoras * 60 * 60 * 1000);
  return momento < limite;
}
