import { View } from "react-native";
import type { EstadoTarea } from "@bitacora/shared";
import { CAMINO_ESTADOS_TAREA, ETIQUETA_ESTADO_TAREA, grupoDeEstadoTarea, pasoDelRielTarea } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, Text } from "../../components/ui";

const ETIQUETAS_CAMINO = CAMINO_ESTADOS_TAREA.map((e) => ETIQUETA_ESTADO_TAREA[e]);

function Riel({ paso }: { paso: 0 | 1 | 2 }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {ETIQUETAS_CAMINO.map((etiqueta, i) => {
        const recorrido = i < paso;
        const activo = i === paso;
        const tamanoPunto = activo ? 16 : 12;
        return (
          <View key={etiqueta} style={{ flex: i < ETIQUETAS_CAMINO.length - 1 ? 1 : undefined, alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
              <View
                style={{
                  width: activo ? tamanoPunto + 12 : tamanoPunto,
                  height: activo ? tamanoPunto + 12 : tamanoPunto,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: activo ? t.colores.brandSoft : "transparent",
                  marginLeft: i === 0 ? 0 : -6,
                }}
              >
                <View
                  style={{
                    width: tamanoPunto,
                    height: tamanoPunto,
                    borderRadius: 999,
                    backgroundColor: recorrido || activo ? t.colores.brand : "transparent",
                    borderWidth: recorrido || activo ? 0 : 1.5,
                    borderColor: t.colores.border,
                  }}
                />
              </View>
              {i < ETIQUETAS_CAMINO.length - 1 ? (
                <View style={{ flex: 1, height: 2, backgroundColor: i < paso ? t.colores.brand : t.colores.border }} />
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Estados de cita en 3+2 (rediseño Agenda Pro) — riel de progreso para
 * Reservado→Confirmado→Asistió, con No asistió/Cancelado como salidas
 * aparte. Usa tokens del tema (brand/brandSoft/success) así que se ve
 * bien tanto con Faena como con el tema cosmetología (vino/eucalipto).
 *
 * Si el estado ya es una salida, no tiene sentido mostrar el riel (no
 * se sabe hasta dónde llegó el camino) — se muestra solo el resultado.
 */
export function EstadoCitaRiel({
  estado,
  activa,
  cargando = false,
  onConfirmar,
  onNoAsistio,
  onCancelar,
}: {
  estado: EstadoTarea;
  activa: boolean;
  cargando?: boolean;
  onConfirmar?: () => void;
  onNoAsistio: () => void;
  onCancelar: () => void;
}) {
  const t = useTema();
  const grupo = grupoDeEstadoTarea(estado);

  if (grupo === "salida") {
    const esNoAsistio = estado === "no_asistio";
    return (
      <View style={{ gap: t.espacio(1) }}>
        <Text variante="etiqueta" tono="muted">
          Estado
        </Text>
        <Text variante="subtitulo" tono={esNoAsistio ? "danger" : "muted"}>
          {ETIQUETA_ESTADO_TAREA[estado]}
        </Text>
      </View>
    );
  }

  const paso = pasoDelRielTarea(estado) ?? 0;

  return (
    <View style={{ gap: t.espacio(3) }}>
      <View style={{ gap: t.espacio(2) }}>
        <Riel paso={paso} />
        <View style={{ flexDirection: "row" }}>
          {ETIQUETAS_CAMINO.map((etiqueta, i) => (
            <View key={etiqueta} style={{ flex: 1, alignItems: i === 0 ? "flex-start" : i === ETIQUETAS_CAMINO.length - 1 ? "flex-end" : "center" }}>
              <Text variante="caption" weight={i === paso ? "semibold" : "regular"} tono={i === paso ? "brand" : "muted"}>
                {etiqueta}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {activa && estado === "pendiente" && onConfirmar ? (
        <Button titulo="Confirmar cita" variante="secundario" onPress={onConfirmar} cargando={cargando} />
      ) : null}

      {activa ? (
        <View style={{ gap: t.espacio(2.5) }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2) }}>
            <View style={{ flex: 1, height: 1, backgroundColor: t.colores.border }} />
            <Text variante="caption" tono="muted">
              o cerrar como
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: t.colores.border }} />
          </View>
          <View style={{ flexDirection: "row", gap: t.espacio(2.5) }}>
            <Button titulo="No asistió" variante="secundario" onPress={onNoAsistio} cargando={cargando} style={{ flex: 1 }} />
            <Button titulo="Cancelado" variante="secundario" onPress={onCancelar} cargando={cargando} style={{ flex: 1 }} />
          </View>
          <Text variante="caption" tono="muted" style={{ textAlign: "center" }}>
            Asistió y No asistió descuentan 1 sesión del pack. Cancelado no.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
