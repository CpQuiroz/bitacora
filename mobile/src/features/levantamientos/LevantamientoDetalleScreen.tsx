import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Image, Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AlertCircle, ArrowLeft, Camera, Minus, Plus, RefreshCw, X } from "lucide-react-native";
import type { CatalogoItem, EstadoLevantamiento } from "@bitacora/shared";
import { formatearFolio } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Dialog, ErrorState, LoadingState, ScreenHeader, Textarea, Texto, useMarca } from "@bitacora/ui/native";
import { elegirFotos } from "../../lib/imagen";
import { useRed } from "../../services/sync/NetworkProvider";
import {
  completarLevantamiento,
  encolarCompletarLevantamiento,
  encolarFotoLevantamiento,
  listarCatalogo,
  obtenerDetalleLevantamiento,
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

// Sistema visual móvil v2 (14-sep-2026) — migración del sistema viejo
// (useTema/Ionicons/components-ui) al nuevo: ScreenHeader propio con
// `accion`=volver (mismo criterio que LevantamientosListScreen, ya
// migrada), Textarea en vez de Input multiline (el contrato nuevo de
// Input no tiene esa prop), Dialog (bottom sheet) en vez del Modal a
// mano para el picker de catálogo. El técnico completa lo observado en
// terreno + materiales + fotos. Cotizar (fuera de Bitácora) y aprobar/
// rechazar es exclusivo de la web (Admin) — acá no hay esos botones, a
// propósito.
export function LevantamientoDetalleScreen({ route, navigation }: NativeStackScreenProps<MasStackParamList, "LevantamientoDetalle">) {
  const marca = useMarca();
  const { enLinea, pendientes } = useRed();
  const { id } = route.params;
  const fotosEnCola = pendientes.filter((a) => a.recurso === `levantamiento:${id}` && a.etiqueta === "Foto de levantamiento");
  const [detalle, setDetalle] = useState<DetalleLevantamiento | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [materiales, setMateriales] = useState<MaterialLocal[]>([]);
  const [guardando, setGuardando] = useState(false);
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

  // Siempre por la cola, nunca un intento inline antes — mismo bug real
  // (14-sep-2026) encontrado y corregido en services/viajes.ts
  // (crearViaje): un intento inline con la foto que "timeoutea" en el
  // celular no se puede cancelar de verdad en RN, y si igual la
  // encolábamos como respaldo quedaban dos subidas de la MISMA foto
  // viajando a la vez. El placeholder en `fotosEnCola` ya da feedback
  // inmediato — no hace falta el intento inline para que se sienta rápido.
  async function agregarFoto() {
    const [elegida] = await elegirFotos();
    if (!elegida) return;
    await encolarFotoLevantamiento(id, elegida);
  }

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  if (!detalle && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Levantamiento" accion={volver} />
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }
  if (error && !detalle) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Levantamiento" accion={volver} />
        <ErrorState mensaje={error} onReintentar={() => void cargar()} />
      </View>
    );
  }
  if (!detalle) return null;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader
        antetitulo={`${formatearFolio("LEV", detalle.folio) ? `${formatearFolio("LEV", detalle.folio)} · ` : ""}${ETIQUETA_ESTADO[detalle.estado]}`}
        titulo={detalle.cliente?.nombre ?? "Cliente"}
        accion={volver}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] * 2 }}>
        {detalle.descripcion_requerimiento ? (
          <View style={{ gap: 4 }}>
            <Texto tamano={tokens.size.micro} color={tokens.color.accent2Ramp["800"]} peso="semibold" style={{ textTransform: "uppercase", letterSpacing: 1.3 }}>
              Qué pidió evaluar la oficina
            </Texto>
            <Texto tamano={tokens.size.body} color={tokens.color.text}>
              {detalle.descripcion_requerimiento}
            </Texto>
          </View>
        ) : null}

        <Textarea
          etiqueta="Lo que observaste en terreno"
          valor={descripcion}
          onCambio={setDescripcion}
          deshabilitado={!editable}
          filas={5}
          placeholder="Ej.: instalación en mal estado, requiere cambiar cableado y 2 enchufes…"
        />

        <View style={{ gap: tokens.space["2"] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold">
              Materiales
            </Texto>
            {editable ? (
              <Pressable onPress={abrirPicker} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Plus size={16} strokeWidth={2.5} color={marca.base} />
                <Texto tamano={tokens.size.caption} color={marca.base} peso="semibold">
                  Agregar
                </Texto>
              </Pressable>
            ) : null}
          </View>
          {materiales.length === 0 ? (
            <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`}>
              Sin materiales indicados todavía.
            </Texto>
          ) : (
            materiales.map((m) => (
              <View
                key={m.catalogo_item_id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: tokens.space["2"],
                  borderWidth: 1,
                  borderColor: tokens.color.divider,
                  borderRadius: tokens.radius.md,
                  padding: tokens.space["3"],
                }}
              >
                <Texto tamano={tokens.size.body} color={tokens.color.text} style={{ flex: 1 }} numberOfLines={1}>
                  {m.nombre}
                </Texto>
                {editable ? (
                  <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: tokens.color.divider, borderRadius: tokens.radius.sm }}>
                    <Pressable onPress={() => cambiarCantidad(m.catalogo_item_id, -1)} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
                      <Minus size={15} strokeWidth={2.5} color={tokens.color.text} />
                    </Pressable>
                    <Texto tamano={tokens.size.small} color={tokens.color.text} peso="semibold" style={{ width: 32, textAlign: "center", fontVariant: ["tabular-nums"] }}>
                      {m.cantidad}
                    </Texto>
                    <Pressable onPress={() => cambiarCantidad(m.catalogo_item_id, 1)} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
                      <Plus size={15} strokeWidth={2.5} color={tokens.color.text} />
                    </Pressable>
                  </View>
                ) : (
                  <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} style={{ fontVariant: ["tabular-nums"] }}>
                    {m.cantidad} {m.unidad}
                  </Texto>
                )}
                {editable ? (
                  <Pressable onPress={() => quitarMaterial(m.catalogo_item_id)} hitSlop={8}>
                    <X size={18} strokeWidth={2.5} color={`${tokens.color.text}66`} />
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </View>

        {editable ? (
          <Button tamano="lg" bloque onPress={guardar} cargando={guardando}>
            Guardar levantamiento
          </Button>
        ) : null}

        <View style={{ gap: tokens.space["2"] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold">
              Fotos
            </Texto>
            {editable ? (
              <Button variante="secundario" iconoIzq={<Camera size={16} strokeWidth={2.5} color={tokens.color.text} />} onPress={agregarFoto}>
                Agregar
              </Button>
            ) : null}
          </View>
          {detalle.fotos.length === 0 && fotosEnCola.length === 0 ? (
            <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`}>
              Sin fotos todavía.
            </Texto>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] }}>
              {detalle.fotos.map((f) => (
                <Image key={f.id} source={{ uri: f.url }} style={{ width: 88, height: 88, borderRadius: tokens.radius.md, backgroundColor: tokens.color.neutral["200"] }} />
              ))}
              {fotosEnCola.map((a) => (
                <View
                  key={a.id}
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: tokens.radius.md,
                    backgroundColor: tokens.color.neutral["200"],
                    borderWidth: 1,
                    borderColor: tokens.color.divider,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {a.fallida ? (
                    <AlertCircle size={20} strokeWidth={2.5} color={tokens.color.accentRamp["700"]} />
                  ) : (
                    <RefreshCw size={20} strokeWidth={2.5} color={marca.base} />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {detalle.referencia_externa ? (
          <View style={{ gap: 4 }}>
            <Texto tamano={tokens.size.micro} color={tokens.color.accent2Ramp["800"]} peso="semibold" style={{ textTransform: "uppercase", letterSpacing: 1.3 }}>
              Referencia de la cotización
            </Texto>
            <Texto tamano={tokens.size.body} color={tokens.color.text}>
              {detalle.referencia_externa}
            </Texto>
          </View>
        ) : null}
      </ScrollView>

      <Dialog abierto={pickerAbierto} onCerrar={() => setPickerAbierto(false)} titulo="Elegir del catálogo">
        {catalogo === null ? (
          <LoadingState />
        ) : (
          <View style={{ maxHeight: 420 }}>
            <FlatList
              data={catalogo}
              keyExtractor={(it) => it.id}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: tokens.color.divider }} />}
              ListEmptyComponent={
                <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`}>
                  Sin ítems en el catálogo.
                </Texto>
              }
              renderItem={({ item }) => (
                <Pressable onPress={() => agregarMaterial(item)} style={{ paddingVertical: tokens.space["3"] }}>
                  <Texto tamano={tokens.size.body} color={tokens.color.text}>
                    {item.nombre}
                  </Texto>
                  <Texto tamano={tokens.size.caption} color={`${tokens.color.text}66`}>
                    {item.unidad}
                  </Texto>
                </Pressable>
              )}
            />
          </View>
        )}
      </Dialog>
    </View>
  );
}
