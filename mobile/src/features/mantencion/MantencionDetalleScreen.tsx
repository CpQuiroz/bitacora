import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ItemChecklistMantencion } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, ErrorState, LoadingScreen, Text } from "../../components/ui";
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

// Detalle de un registro ya creado — checklist + fotos (agregar/
// eliminar). El registro en sí sigue inmutable; solo las fotos de
// respaldo se pueden completar/corregir después (2026-09-11).
export function MantencionDetalleScreen({ route, navigation }: NativeStackScreenProps<MasStackParamList, "MantencionDetalle">) {
  const t = useTema();
  const { equipoId, registroId } = route.params;
  const [detalle, setDetalle] = useState<DetalleMantencion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Detalle de mantención" });
  }, [navigation]);

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

  if (!detalle && !error) return <LoadingScreen />;
  if (error && !detalle) return <ErrorState mensaje={error} onReintentar={() => void cargar()} />;
  if (!detalle) return null;

  const secciones = agruparPorSeccion(detalle.checklist ?? []);
  const quien = detalle.origen === "externo" ? (detalle.proveedor?.nombre ?? "Taller externo") : (detalle.responsable?.nombre ?? "—");

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colores.bg }} contentContainerStyle={{ padding: t.espacio(4), gap: t.espacio(4) }}>
      <View style={{ gap: 4 }}>
        <Text mono variante="caption" tono="muted">
          {fechaCorta(detalle.fecha)}
          {detalle.folio != null ? ` · N° ${String(detalle.folio).padStart(4, "0")}` : ""}
        </Text>
        <Text weight="semibold">{detalle.tipo === "programa" ? "Programa de mantención" : "Chequeo diario"}</Text>
        <Text variante="caption" tono="muted">
          {detalle.origen === "externo" ? "Taller externo" : "Interno"} · {quien}
          {detalle.kilometraje != null ? ` · ${detalle.kilometraje.toLocaleString("es-CL")} km` : ""}
          {detalle.horas_motor != null ? ` · ${detalle.horas_motor.toLocaleString("es-CL")} h` : ""}
        </Text>
        {detalle.observaciones ? <Text variante="caption">{detalle.observaciones}</Text> : null}
      </View>

      <View style={{ gap: t.espacio(3) }}>
        <Text weight="semibold">Checklist</Text>
        {secciones.map(({ seccion, items }) => (
          <View key={seccion} style={{ gap: 4 }}>
            <Text variante="caption" weight="bold" tono="muted" style={{ textTransform: "uppercase", letterSpacing: 0.4 }}>
              {seccion}
            </Text>
            {items.map((it, i) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2 }}>
                <Text style={{ flex: 1 }}>{it.item}</Text>
                <View
                  style={{
                    paddingHorizontal: t.espacio(2),
                    paddingVertical: 2,
                    borderRadius: 999,
                    backgroundColor: it.respuesta === "no" ? t.colores.dangerSoft : it.respuesta === "si" ? t.colores.successSoft : t.colores.border,
                  }}
                >
                  <Text variante="caption" weight="bold" style={{ color: it.respuesta === "no" ? t.colores.danger : it.respuesta === "si" ? t.colores.success : t.colores.muted }}>
                    {respuestaTexto[it.respuesta]}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>

      <View style={{ gap: t.espacio(2) }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text weight="semibold">Fotos de respaldo</Text>
          <Button titulo="Agregar" variante="secundario" fullWidth={false} icono={<Ionicons name="camera-outline" size={16} color={t.colores.brand} />} cargando={subiendo} onPress={agregarFoto} />
        </View>
        {detalle.fotos.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espacio(2) }}>
            {detalle.fotos.map((f) => (
              <View key={f.id} style={{ width: 96, height: 96 }}>
                <Image source={{ uri: f.url }} style={{ width: 96, height: 96, borderRadius: t.radio.md, backgroundColor: t.colores.border }} />
                <Pressable
                  onPress={() => confirmarEliminar(f.id)}
                  disabled={eliminandoId === f.id}
                  style={{
                    position: "absolute",
                    right: -6,
                    top: -6,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: t.colores.danger,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: eliminandoId === f.id ? 0.6 : 1,
                  }}
                >
                  <Ionicons name="trash-outline" size={14} color={t.colores.brandForeground} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text variante="caption" tono="muted">
            Todavía no hay fotos de respaldo.
          </Text>
        )}
      </View>

      {error ? (
        <Text variante="caption" tono="danger">
          {error}
        </Text>
      ) : null}
    </ScrollView>
  );
}
