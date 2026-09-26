import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, View } from "react-native";
import { ArrowLeft, Camera, Trash2 } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ItemChecklistMantencion } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, ErrorState, LoadingState, ScreenHeader, StatusBadge, Texto, type TonoEstado } from "@bitacora/ui/native";
import { elegirFotos } from "../../lib/imagen";
import type { MasStackParamList } from "../../shell/navigation/types";
import {
  eliminarFotoDeRegistro,
  obtenerDetalleRegistro,
  respuestaTexto,
  subirFotoARegistro,
  type DetalleMantencion,
} from "../../services/mantencion";

const fechaCorta = (iso: string) => {
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return d && m ? `${d} ${meses[m - 1]} ${y}` : iso;
};

// Agrupa el checklist por sección, respetando el orden de aparición.
function agruparPorSeccion(items: ItemChecklistMantencion[]) {
  const orden: string[] = [];
  const porSeccion = new Map<string, ItemChecklistMantencion[]>();
  for (const it of items) {
    if (!porSeccion.has(it.seccion)) {
      porSeccion.set(it.seccion, []);
      orden.push(it.seccion);
    }
    porSeccion.get(it.seccion)!.push(it);
  }
  return orden.map((seccion) => ({ seccion, items: porSeccion.get(seccion)! }));
}

// Mismo criterio que "con_novedades"/"ok" en MantencionHistorialScreen
// (ya migrada): "no" necesita atención → en_progreso; "sí" está bien →
// completado; "N/A" no es ninguno de los dos → cerrado (tono neutro).
const TONO_RESPUESTA: Record<string, TonoEstado> = { no: "en_progreso", si: "completado", na: "cerrado" };

// Detalle de un registro ya creado — checklist + fotos (agregar/
// eliminar). El registro en sí sigue inmutable; solo las fotos de
// respaldo se pueden completar/corregir después (2026-09-11).
//
// Sistema visual móvil v2 (14-sep-2026) — migración del sistema viejo
// (useTema/Ionicons/navigation.setOptions para el título) al nuevo:
// ScreenHeader propio con `accion`=volver (mismo patrón que
// MantencionHistorialScreen, ya migrada, en el mismo directorio) +
// StatusBadge para cada respuesta del checklist en vez del pill de
// color a mano.
export function MantencionDetalleScreen({ route, navigation }: NativeStackScreenProps<MasStackParamList, "MantencionDetalle">) {
  const { equipoId, registroId } = route.params;
  const [detalle, setDetalle] = useState<DetalleMantencion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const r = await obtenerDetalleRegistro(equipoId, registroId);
    if (r.error || !r.detalle) {
      setError(r.error ?? "No se pudo cargar el detalle");
      return;
    }
    setDetalle(r.detalle);
  }, [equipoId, registroId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function agregarFoto() {
    const [elegida] = await elegirFotos();
    if (!elegida) return;
    setSubiendo(true);
    const res = await subirFotoARegistro(equipoId, registroId, elegida, null);
    setSubiendo(false);
    if (!res.ok) {
      Alert.alert("No se pudo subir la foto", res.error);
      return;
    }
    void cargar();
  }

  function confirmarEliminar(fotoId: string) {
    Alert.alert("Eliminar foto", "¿Eliminar esta foto de respaldo?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          setEliminandoId(fotoId);
          const res = await eliminarFotoDeRegistro(equipoId, registroId, fotoId);
          setEliminandoId(null);
          if (!res.ok) {
            Alert.alert("No se pudo eliminar", res.error);
            return;
          }
          void cargar();
        },
      },
    ]);
  }

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  if (!detalle && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Detalle de mantención" accion={volver} />
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }
  if (error && !detalle) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Detalle de mantención" accion={volver} />
        <ErrorState mensaje={error} onReintentar={() => void cargar()} />
      </View>
    );
  }
  if (!detalle) return null;

  const secciones = agruparPorSeccion(detalle.checklist ?? []);
  const quien = detalle.origen === "externo" ? (detalle.proveedor?.nombre ?? "Taller externo") : (detalle.responsable?.nombre ?? "—");

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader titulo="Detalle de mantención" accion={volver} />
      <ScrollView contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] }}>
        <View style={{ gap: 4 }}>
          <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary} style={{ fontVariant: ["tabular-nums"] }}>
            {fechaCorta(detalle.fecha)}
            {detalle.folio != null ? ` · N° ${String(detalle.folio).padStart(4, "0")}` : ""}
          </Texto>
          <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold">
            {detalle.tipo === "programa" ? "Mantención Flota" : "Checklist diario"}
          </Texto>
          <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
            {detalle.origen === "externo" ? "Taller externo" : "Interno"} · {quien}
            {detalle.kilometraje != null ? ` · ${detalle.kilometraje.toLocaleString("es-CL")} km` : ""}
            {detalle.horas_motor != null ? ` · ${detalle.horas_motor.toLocaleString("es-CL")} h` : ""}
          </Texto>
          {detalle.observaciones ? (
            <Texto tamano={tokens.size.small} color={tokens.color.text}>
              {detalle.observaciones}
            </Texto>
          ) : null}
        </View>

        <View style={{ gap: tokens.space["3"] }}>
          <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold">
            Checklist
          </Texto>
          {secciones.map(({ seccion, items }) => (
            <View key={seccion} style={{ gap: 4 }}>
              <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary} peso="semibold" style={{ textTransform: "uppercase", letterSpacing: 0.4 }}>
                {seccion}
              </Texto>
              {items.map((it, i) => (
                <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2 }}>
                  <Texto tamano={tokens.size.body} color={tokens.color.text} style={{ flex: 1 }}>
                    {it.item}
                  </Texto>
                  <StatusBadge estado={it.respuesta} etiqueta={respuestaTexto[it.respuesta]} tonoForzado={TONO_RESPUESTA[it.respuesta]} />
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={{ gap: tokens.space["2"] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold">
              Fotos de respaldo
            </Texto>
            <Button variante="secundario" iconoIzq={<Camera size={16} strokeWidth={2.5} color={tokens.color.text} />} cargando={subiendo} onPress={agregarFoto}>
              Agregar
            </Button>
          </View>
          {detalle.fotos.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] }}>
              {detalle.fotos.map((f) => (
                <View key={f.id} style={{ width: 96, height: 96 }}>
                  <Image source={{ uri: f.url }} style={{ width: 96, height: 96, borderRadius: tokens.radius.md, backgroundColor: tokens.color.neutral["200"] }} />
                  <Pressable accessibilityRole="button" accessibilityLabel="Eliminar foto"
                    onPress={() => confirmarEliminar(f.id)}
                    disabled={eliminandoId === f.id}
                    style={{
                      position: "absolute",
                      right: -6,
                      top: -6,
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: tokens.color.accentRamp["700"],
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: eliminandoId === f.id ? 0.6 : 1,
                    }}
                  >
                    <Trash2 size={14} strokeWidth={2.5} color={tokens.color.neutral["100"]} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
              Todavía no hay fotos de respaldo.
            </Texto>
          )}
        </View>

        {error ? (
          <Texto tamano={tokens.size.caption} color={tokens.color.accentRamp["700"]}>
            {error}
          </Texto>
        ) : null}
      </ScrollView>
    </View>
  );
}
