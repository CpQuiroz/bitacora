import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Image, Modal, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CatalogoItem, EstadoLevantamiento } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, ErrorState, Input, LoadingScreen, Text } from "../../components/ui";
import { elegirFotos } from "../../lib/imagen";
import { useRed } from "../../services/sync/NetworkProvider";
import {
  completarLevantamiento,
  encolarCompletarLevantamiento,
  encolarFotoLevantamiento,
  listarCatalogo,
  obtenerDetalleLevantamiento,
  subirFotoLevantamiento,
  type DetalleLevantamiento,
} from "../../services/levantamientos";
import type { MasStackParamList } from "../../shell/navigation/types";

const ETIQUETA_ESTADO: Record<EstadoLevantamiento, string> = {
  creado: "Creado",
  asignado: "Por completar",
  en_terreno: "En terreno",
  completado_tecnico: "Completado — esperando cotización",
  cotizado_externo: "Cotizado — esperando aprobación",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

type MaterialLocal = { catalogo_item_id: string; cantidad: number; nombre: string; unidad: string };

// El técnico completa lo observado en terreno + materiales + fotos.
// Cotizar (fuera de Bitácora) y aprobar/rechazar es exclusivo de la web
// (Admin) — acá no hay esos botones, a propósito.
export function LevantamientoDetalleScreen({ route }: NativeStackScreenProps<MasStackParamList, "LevantamientoDetalle">) {
  const t = useTema();
  const { enLinea, pendientes } = useRed();
  const { id } = route.params;
  const fotosEnCola = pendientes.filter((a) => a.recurso === `levantamiento:${id}` && a.etiqueta === "Foto de levantamiento");
  const [detalle, setDetalle] = useState<DetalleLevantamiento | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [materiales, setMateriales] = useState<MaterialLocal[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [pickerAbierto, setPickerAbierto] = useState(false);
  const [catalogo, setCatalogo] = useState<CatalogoItem[] | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const r = await obtenerDetalleLevantamiento(id);
    if (r.error || !r.detalle) {
      setError(r.error ?? "No se pudo cargar el detalle");
      return;
    }
    setDetalle(r.detalle);
    setDescripcion(r.detalle.descripcion_tecnico ?? "");
    setMateriales(
      r.detalle.materiales.map((m) => ({
        catalogo_item_id: m.catalogo_item_id,
        cantidad: m.cantidad,
        nombre: m.catalogo_item?.nombre ?? "Ítem eliminado",
        unidad: m.catalogo_item?.unidad ?? "",
      }))
    );
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Cuando una foto sale de la cola (se subió o falló para siempre),
  // recargamos para reemplazar el placeholder por la real o quitarlo.
  useEffect(() => {
    void cargar();
  }, [fotosEnCola.length, cargar]);

  const editable = detalle != null && detalle.estado !== "aprobado" && detalle.estado !== "rechazado";

  async function abrirPicker() {
    setPickerAbierto(true);
    if (!catalogo) setCatalogo(await listarCatalogo());
  }

  function agregarMaterial(item: CatalogoItem) {
    setMateriales((prev) => {
      const ya = prev.find((m) => m.catalogo_item_id === item.id);
      if (ya) return prev.map((m) => (m.catalogo_item_id === item.id ? { ...m, cantidad: m.cantidad + 1 } : m));
      return [...prev, { catalogo_item_id: item.id, cantidad: 1, nombre: item.nombre, unidad: item.unidad }];
    });
    setPickerAbierto(false);
  }

  function cambiarCantidad(catalogoItemId: string, delta: number) {
    setMateriales((prev) =>
      prev.map((m) => (m.catalogo_item_id === catalogoItemId ? { ...m, cantidad: Math.max(1, m.cantidad + delta) } : m)).filter((m) => m.cantidad > 0)
    );
  }

  function quitarMaterial(catalogoItemId: string) {
    setMateriales((prev) => prev.filter((m) => m.catalogo_item_id !== catalogoItemId));
  }

  async function guardar() {
    setGuardando(true);
    const datos = {
      descripcion_tecnico: descripcion,
      materiales: materiales.map((m) => ({ catalogo_item_id: m.catalogo_item_id, cantidad: m.cantidad })),
    };

    if (enLinea) {
      const res = await completarLevantamiento(id, datos);
      if (res.ok) {
        setGuardando(false);
        Alert.alert("Guardado", "El levantamiento quedó completado.", [{ text: "Listo" }]);
        return void cargar();
      }
      if (!res.reintentable) {
        setGuardando(false);
        return Alert.alert("No se pudo guardar", res.error);
      }
    }

    await encolarCompletarLevantamiento(id, datos);
    setGuardando(false);
    Alert.alert(
      enLinea ? "Se reintentará solo" : "Guardado sin conexión",
      "Quedó guardado en el teléfono y se envía a la oficina cuando haya señal.",
      [{ text: "Listo" }]
    );
  }

  async function agregarFoto() {
    const [elegida] = await elegirFotos();
    if (!elegida) return;

    if (enLinea) {
      setSubiendoFoto(true);
      const res = await subirFotoLevantamiento(id, elegida);
      setSubiendoFoto(false);
      if (res.ok) return void cargar();
    }

    await encolarFotoLevantamiento(id, elegida);
  }

  if (!detalle && !error) return <LoadingScreen />;
  if (error && !detalle) return <ErrorState mensaje={error} onReintentar={() => void cargar()} />;
  if (!detalle) return null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colores.bg }} contentContainerStyle={{ padding: t.espacio(4), gap: t.espacio(4), paddingBottom: t.espacio(10) }}>
      <View style={{ gap: 4 }}>
        <Text weight="semibold" variante="subtitulo">
          {detalle.cliente?.nombre ?? "Cliente"}
        </Text>
        <Text variante="caption" tono="muted">
          {ETIQUETA_ESTADO[detalle.estado]}
        </Text>
      </View>

      {detalle.descripcion_requerimiento ? (
        <View style={{ gap: 4 }}>
          <Text variante="etiqueta" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
            Qué pidió evaluar la oficina
          </Text>
          <Text variante="cuerpo">{detalle.descripcion_requerimiento}</Text>
        </View>
      ) : null}

      <Input
        etiqueta="Lo que observaste en terreno"
        value={descripcion}
        onChangeText={setDescripcion}
        editable={editable}
        multiline
        style={{ minHeight: 96 }}
        placeholder="Ej.: instalación en mal estado, requiere cambiar cableado y 2 enchufes…"
      />

      <View style={{ gap: t.espacio(2) }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text weight="semibold">Materiales</Text>
          {editable ? (
            <Pressable onPress={abrirPicker} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="add-circle-outline" size={18} color={t.colores.brand} />
              <Text variante="caption" weight="bold" style={{ color: t.colores.brand }}>
                Agregar
              </Text>
            </Pressable>
          ) : null}
        </View>
        {materiales.length === 0 ? (
          <Text variante="caption" tono="muted">
            Sin materiales indicados todavía.
          </Text>
        ) : (
          materiales.map((m) => (
            <View
              key={m.catalogo_item_id}
              style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2), borderWidth: 1, borderColor: t.colores.border, borderRadius: t.radio.md, padding: t.espacio(2.5) }}
            >
              <Text style={{ flex: 1 }} numberOfLines={1}>
                {m.nombre}
              </Text>
              {editable ? (
                <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: t.colores.border, borderRadius: t.radio.sm }}>
                  <Pressable onPress={() => cambiarCantidad(m.catalogo_item_id, -1)} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="remove" size={15} color={t.colores.foreground} />
                  </Pressable>
                  <Text mono weight="semibold" style={{ width: 32, textAlign: "center" }}>
                    {m.cantidad}
                  </Text>
                  <Pressable onPress={() => cambiarCantidad(m.catalogo_item_id, 1)} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="add" size={15} color={t.colores.foreground} />
                  </Pressable>
                </View>
              ) : (
                <Text mono variante="caption" tono="muted">
                  {m.cantidad} {m.unidad}
                </Text>
              )}
              {editable ? (
                <Pressable onPress={() => quitarMaterial(m.catalogo_item_id)} hitSlop={8}>
                  <Ionicons name="close" size={18} color={t.colores.faint} />
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </View>

      {editable ? <Button titulo="Guardar levantamiento" tamano="lg" onPress={guardar} cargando={guardando} /> : null}

      <View style={{ gap: t.espacio(2) }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text weight="semibold">Fotos</Text>
          {editable ? (
            <Button titulo="Agregar" variante="secundario" tamano="md" icono={<Ionicons name="camera-outline" size={16} color={t.colores.brand} />} cargando={subiendoFoto} onPress={agregarFoto} />
          ) : null}
        </View>
        {detalle.fotos.length === 0 && fotosEnCola.length === 0 ? (
          <Text variante="caption" tono="muted">
            Sin fotos todavía.
          </Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espacio(2) }}>
            {detalle.fotos.map((f) => (
              <Image key={f.id} source={{ uri: f.url }} style={{ width: 88, height: 88, borderRadius: t.radio.md, backgroundColor: t.colores.surfaceAlt }} />
            ))}
            {fotosEnCola.map((a) => (
              <View
                key={a.id}
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: t.radio.md,
                  backgroundColor: t.colores.surfaceAlt,
                  borderWidth: 1,
                  borderColor: t.colores.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={a.fallida ? "alert-circle-outline" : "sync"} size={20} color={a.fallida ? t.colores.danger : t.colores.accent} />
              </View>
            ))}
          </View>
        )}
      </View>

      {detalle.referencia_externa ? (
        <View style={{ gap: 4 }}>
          <Text variante="etiqueta" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
            Referencia de la cotización
          </Text>
          <Text variante="cuerpo">{detalle.referencia_externa}</Text>
        </View>
      ) : null}

      <Modal visible={pickerAbierto} transparent animationType="slide" onRequestClose={() => setPickerAbierto(false)}>
        <View style={{ flex: 1, backgroundColor: t.colores.overlay, justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: t.colores.surface, borderTopLeftRadius: 14, borderTopRightRadius: 14, maxHeight: "70%", padding: t.espacio(5) }}>
            <Text variante="subtitulo" style={{ marginBottom: t.espacio(3) }}>
              Elegir del catálogo
            </Text>
            {catalogo === null ? (
              <LoadingScreen />
            ) : (
              <FlatList
                data={catalogo}
                keyExtractor={(it) => it.id}
                ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: t.colores.border }} />}
                ListEmptyComponent={
                  <Text variante="caption" tono="muted">
                    Sin ítems en el catálogo.
                  </Text>
                }
                renderItem={({ item }) => (
                  <Pressable onPress={() => agregarMaterial(item)} style={{ paddingVertical: t.espacio(3) }}>
                    <Text>{item.nombre}</Text>
                    <Text variante="caption" tono="faint">
                      {item.unidad}
                    </Text>
                  </Pressable>
                )}
              />
            )}
            <Button titulo="Cerrar" variante="secundario" onPress={() => setPickerAbierto(false)} style={{ marginTop: t.espacio(3) }} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
