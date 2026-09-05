import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { AgendaProConfig, AgendaProHorario } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Text } from "../../components/ui";
import { formatearDuracion, fueraDeAnticipacion, generarSlots, sumarMinutos } from "../../lib/horario";

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function clave(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Bloque de hora — único bloque enmarcado de Nueva reserva (tema
 * cosmetología). Cabecera oscura con mes + tira de 6 días, cuerpo blanco
 * con franjas mañana/tarde. El rango de horarios sale del horario de
 * atención del negocio (agenda_pro_config/horarios) — un día sin
 * horario configurado no ofrece slots.
 */
export function SelectorHoraCosmetologia({
  fecha,
  hora,
  duracionMin,
  config,
  horarios,
  ocupadas,
  onCambiarFecha,
  onCambiarHora,
}: {
  fecha: string;
  hora: string;
  duracionMin: number;
  config: AgendaProConfig | null;
  horarios: AgendaProHorario[];
  ocupadas: Set<string>;
  onCambiarFecha: (f: string) => void;
  onCambiarHora: (h: string) => void;
}) {
  const t = useTema();

  const dias = useMemo(() => {
    const hoy = new Date();
    const base = fecha < clave(hoy) ? new Date(`${fecha}T00:00:00`) : hoy;
    return Array.from({ length: 6 }, (_, i) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + i));
  }, [fecha]);

  const { manana, tarde } = useMemo(() => {
    const d = new Date(`${fecha}T00:00:00`);
    const horario = horarios.find((h) => h.dia_semana === d.getDay());
    if (!horario || !config) return { manana: [] as string[], tarde: [] as string[] };
    const todos = generarSlots(horario.hora_inicio.slice(0, 5), horario.hora_fin.slice(0, 5), config.duracion_slot_min).filter(
      (h) => !fueraDeAnticipacion(fecha, h, config.anticipacion_min_horas)
    );
    return { manana: todos.filter((h) => h < "13:00"), tarde: todos.filter((h) => h >= "13:00") };
  }, [fecha, horarios, config]);

  const mesLabel = MESES[new Date(`${fecha}T00:00:00`).getMonth()];
  const horaFin = hora ? sumarMinutos(hora, duracionMin) : null;

  function Franja({ titulo, horas }: { titulo: string; horas: string[] }) {
    if (horas.length === 0) return null;
    return (
      <View style={{ gap: t.espacio(2) }}>
        <Text variante="etiqueta" tono="muted">
          {titulo}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espacio(2) }}>
          {horas.map((h) => {
            const ocupado = ocupadas.has(h);
            const elegido = h === hora;
            return (
              <Pressable
                key={h}
                disabled={ocupado}
                onPress={() => onCambiarHora(h)}
                style={{
                  minWidth: 66,
                  height: 42,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: t.radio.md,
                  paddingHorizontal: t.espacio(2),
                  backgroundColor: elegido ? t.colores.brand : ocupado ? t.colores.surfaceAlt : t.colores.surface,
                  borderWidth: elegido ? 0 : 1,
                  borderColor: t.colores.border,
                  opacity: ocupado ? 0.5 : 1,
                }}
              >
                <Text
                  variante={elegido ? "cifra" : "cuerpo"}
                  tono={elegido ? "inverso" : ocupado ? "faint" : "normal"}
                  style={[ocupado ? { textDecorationLine: "line-through" } : null, elegido ? { fontSize: 16 } : null]}
                >
                  {h}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={{ borderWidth: 1, borderColor: t.colores.border, borderRadius: t.radio.lg, overflow: "hidden" }}>
      {/* Cabecera oscura: mes + tira de 6 días */}
      <View style={{ backgroundColor: t.colores.foreground, padding: t.espacio(4), gap: t.espacio(3) }}>
        <Text variante="etiqueta" tono="inverso" style={{ opacity: 0.85, textTransform: "capitalize" }}>
          {mesLabel}
        </Text>
        <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
          {dias.map((d) => {
            const k = clave(d);
            const activo = k === fecha;
            return (
              <Pressable
                key={k}
                onPress={() => onCambiarFecha(k)}
                style={{
                  flex: 1,
                  alignItems: "center",
                  paddingVertical: t.espacio(2),
                  borderRadius: t.radio.md,
                  backgroundColor: activo ? t.colores.bg : "transparent",
                }}
              >
                <Text variante="caption" tono={activo ? "muted" : "inverso"} style={activo ? undefined : { opacity: 0.7 }}>
                  {DIAS_CORTOS[d.getDay()]}
                </Text>
                <Text variante="cifra" tono={activo ? "normal" : "inverso"} style={{ fontSize: 18 }}>
                  {d.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Cuerpo blanco: franjas mañana/tarde */}
      <View style={{ backgroundColor: t.colores.surface, padding: t.espacio(4), gap: t.espacio(4) }}>
        {manana.length === 0 && tarde.length === 0 ? (
          <Text variante="cuerpo" tono="muted">
            Sin horario de atención configurado para este día.
          </Text>
        ) : (
          <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
            <View style={{ gap: t.espacio(4) }}>
              <Franja titulo="Mañana" horas={manana} />
              <Franja titulo="Tarde" horas={tarde} />
            </View>
          </ScrollView>
        )}

        {hora ? (
          <View style={{ borderTopWidth: 1, borderTopColor: t.colores.border, paddingTop: t.espacio(3) }}>
            <Text variante="etiqueta" tono="muted">
              Termina {horaFin} · {formatearDuracion(duracionMin)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
