import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Modal, Pressable, ScrollView, View } from "react-native";
import { ArrowLeft, Minus, Plus, X } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CatalogoItem, MedioPagoVenta, Servicio, TipoLineaVenta, TipoPack } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, ScreenHeader, Tag, Texto, type TonoTag, useMarca } from "@bitacora/ui/native";
import { pesos } from "../../lib/plata";
import type { TrabajosStackParamList } from "../../shell/navigation/types";
import { useAuth } from "../auth/AuthContext";
import { listarServicios } from "../../services/servicios";
import { listarTiposPack } from "../../services/tiposPack";
import { crearVenta, listarProductos, type LineaBorrador } from "../../services/ventas";

const IVA_TASA = 0.19;

const ETIQUETA_TIPO: Record<TipoLineaVenta, { texto: string; tono: TonoTag }> = {
  servicio: { texto: "SERVICIO", tono: "accent" },
  producto: { texto: "PRODUCTO", tono: "neutral" },
  pack: { texto: "PACK", tono: "accent2" },
};

const MEDIOS: { k: MedioPagoVenta; t: string }[] = [
  { k: "efectivo", t: "Efectivo" },
  { k: "transferencia", t: "Transferencia" },
  { k: "tarjeta", t: "Tarjeta" },
];

type LineaLocal = LineaBorrador & { detalle?: string; maxCantidad?: number };

// Sistema visual móvil v2 (tarea 31) — pantalla PUSH (Stack la registra
// sin `presentation: "modal"`), mismo patrón que ClienteDetalleScreen:
// ScreenHeader propio con `accion` de volver (header nativo apagado en
// ClientesStack.tsx/TrabajosStack.tsx) + pie fijo con el botón primario.
// Sin AsistenteButton (es un formulario, no una raíz de tab).
export function RegistrarVentaScreen({ route, navigation }: NativeStackScreenProps<TrabajosStackParamList, "RegistrarVenta">) {
  const marca = useMarca();
  const auth = useAuth();
  const puedeEditarPrecio = auth.fase === "listo" && auth.acciones.includes("facturar");

  const { origenTipo, origenId, clienteNombre, clienteRut, folio, heredado } = route.params;

  const [lineas, setLineas] = useState<LineaLocal[]>(
    heredado
      ? [{ tipo: "servicio", referencia_id: heredado.referencia_id, nombre: heredado.nombre, cantidad: 1, precio_unitario: heredado.precio, heredada: true, detalle: "Heredado de la OS" }]
      : []
  );
  const [medio, setMedio] = useState<MedioPagoVenta | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [picker, setPicker] = useState<TipoLineaVenta | null>(null);

  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [productos, setProductos] = useState<CatalogoItem[]>([]);
  const [packs, setPacks] = useState<TipoPack[]>([]);

  useEffect(() => {
    void listarServicios().then(setServicios);
    void listarProductos().then(setProductos);
    void listarTiposPack().then(setPacks);
  }, []);

  const neto = useMemo(() => lineas.reduce((s, l) => s + Math.round(l.precio_unitario * l.cantidad), 0), [lineas]);
  const iva = Math.round(neto * IVA_TASA);
  const total = neto + iva;

  function setCantidad(i: number, delta: number) {
    setLineas((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l;
        const nueva = Math.max(1, l.cantidad + delta);
        if (l.maxCantidad != null && nueva > l.maxCantidad) return l;
        return { ...l, cantidad: nueva };
      })
    );
  }

  function quitar(i: number) {
    setLineas((prev) => prev.filter((_, idx) => idx !== i));
  }

  function agregarDesdePicker(item: Servicio | CatalogoItem | TipoPack) {
    if (!picker) return;
    if (picker === "servicio") {
      const s = item as Servicio;
      setLineas((p) => [...p, { tipo: "servicio", referencia_id: s.id, nombre: s.nombre, cantidad: 1, precio_unitario: s.precio }]);
    } else if (picker === "producto") {
      const c = item as CatalogoItem;
      const stock = c.stock_actual ?? 0;
      setLineas((p) => [
        ...p,
        { tipo: "producto", referencia_id: c.id, nombre: c.nombre, cantidad: 1, precio_unitario: c.precio_base, detalle: `Stock: ${stock} disponibles`, maxCantidad: stock },
      ]);
    } else {
      const tp = item as TipoPack;
      setLineas((p) => [
        ...p,
        {
          tipo: "pack",
          referencia_id: tp.id,
          nombre: tp.nombre,
          cantidad: 1,
          precio_unitario: tp.precio ?? 0,
          detalle: `Se cobra completo · queda con ${tp.cantidad_sesiones} sesiones`,
        },
      ]);
    }
    setPicker(null);
  }

  async function confirmar() {
    if (lineas.length === 0) return Alert.alert("Venta vacía", "Agrega al menos una línea.");
    if (!medio) return Alert.alert("Falta el medio de pago", "Elige efectivo, transferencia o tarjeta.");
    setGuardando(true);
    const r = await crearVenta({
      origen_tipo: origenTipo,
      origen_id: origenId,
      medio_pago: medio,
      lineas: lineas.map((l) => ({ tipo: l.tipo, referencia_id: l.referencia_id, nombre: l.nombre, cantidad: l.cantidad, precio_unitario: l.precio_unitario, heredada: l.heredada })),
    });
    setGuardando(false);
    if (r.ok) {
      Alert.alert("Venta registrada", `Total ${pesos(r.venta.total)} — pagada.`, [{ text: "Listo", onPress: () => navigation.goBack() }]);
    } else {
      Alert.alert("No se pudo registrar", r.error);
    }
  }

  const opcionesPicker: (Servicio | CatalogoItem | TipoPack)[] =
    picker === "servicio" ? servicios : picker === "producto" ? productos.filter((p) => (p.stock_actual ?? 0) > 0) : packs;

  const iniciales = clienteNombre
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader titulo="Registrar venta" accion={volver} />
      <ScrollView contentContainerStyle={{ padding: tokens.space["6"], gap: tokens.space["4"], paddingBottom: 220 }}>
        <View style={{ gap: tokens.space["2"] }}>
          <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`}>
            {origenTipo === "os" ? `Desde OS N° ${folio ?? "—"}` : "Desde una cita"}
          </Texto>
          <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space["3"] }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: tokens.color.accent2Ramp["200"], alignItems: "center", justifyContent: "center" }}>
              <Texto tamano={tokens.size.small} color={tokens.color.accent2Ramp["800"]} peso="semibold">
                {iniciales}
              </Texto>
            </View>
            <View style={{ flex: 1 }}>
              <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold">
                {clienteNombre}
              </Texto>
              {clienteRut ? (
                <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`}>
                  {clienteRut}
                </Texto>
              ) : null}
            </View>
          </View>
        </View>

        {/* Líneas */}
        <View style={{ gap: tokens.space["3"] }}>
          {lineas.map((l, i) => {
            const et = ETIQUETA_TIPO[l.tipo];
            return (
              <View key={i} style={{ borderWidth: 1, borderColor: tokens.color.divider, borderRadius: tokens.radius.md, padding: tokens.space["3"], gap: tokens.space["2"] }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space["2"] }}>
                  <Tag tono={et.tono}>{et.texto}</Tag>
                  <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold" style={{ flex: 1 }} numberOfLines={1}>
                    {l.nombre}
                  </Texto>
                  <Pressable onPress={() => quitar(i)} hitSlop={8}>
                    <X size={18} color={`${tokens.color.text}66`} />
                  </Pressable>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space["2"] }}>
                  {l.tipo !== "pack" ? (
                    <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: tokens.color.divider, borderRadius: tokens.radius.sm }}>
                      <Pressable onPress={() => setCantidad(i, -1)} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
                        <Minus size={16} color={tokens.color.text} />
                      </Pressable>
                      <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold" style={{ width: 28, textAlign: "center", fontVariant: ["tabular-nums"] }}>
                        {l.cantidad}
                      </Texto>
                      <Pressable onPress={() => setCantidad(i, 1)} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
                        <Plus size={16} color={tokens.color.text} />
                      </Pressable>
                    </View>
                  ) : null}
                  <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} style={{ flex: 1, fontVariant: ["tabular-nums"] }}>
                    × {pesos(l.precio_unitario)}
                  </Texto>
                  <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold" style={{ fontVariant: ["tabular-nums"] }}>
                    {pesos(l.precio_unitario * l.cantidad)}
                  </Texto>
                </View>

                {l.detalle ? (
                  <Texto tamano={tokens.size.caption} color={`${tokens.color.text}66`}>
                    {l.detalle}
                  </Texto>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Agregar */}
        <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
          {(["servicio", "producto", "pack"] as TipoLineaVenta[]).map((tp) => (
            <Pressable
              key={tp}
              onPress={() => setPicker(tp)}
              style={{
                flex: 1,
                minHeight: 44,
                borderWidth: 1.5,
                borderStyle: "dashed",
                borderColor: tokens.color.divider,
                borderRadius: tokens.radius.md,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 4,
              }}
            >
              <Plus size={14} color={`${tokens.color.text}99`} />
              <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} peso="semibold">
                {ETIQUETA_TIPO[tp].texto[0] + ETIQUETA_TIPO[tp].texto.slice(1).toLowerCase()}
              </Texto>
            </Pressable>
          ))}
        </View>

        {!puedeEditarPrecio ? (
          <Texto tamano={tokens.size.caption} color={`${tokens.color.text}66`}>
            Los precios vienen del catálogo. Solo un perfil de administración puede editarlos.
          </Texto>
        ) : null}

        {/* Medio de pago */}
        <View style={{ gap: tokens.space["2"] }}>
          <Texto tamano={tokens.size.micro} color={`${tokens.color.text}99`} peso="semibold" style={{ textTransform: "uppercase", letterSpacing: 1 }}>
            Medio de pago
          </Texto>
          <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
            {MEDIOS.map((m) => {
              const activo = medio === m.k;
              return (
                <Pressable
                  key={m.k}
                  onPress={() => setMedio(m.k)}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: tokens.radius.md,
                    backgroundColor: activo ? marca.suave : tokens.color.surface,
                    borderWidth: 1,
                    borderColor: activo ? marca.base : tokens.color.divider,
                  }}
                >
                  <Texto tamano={tokens.size.caption} color={activo ? marca.fuerte : `${tokens.color.text}99`} peso="semibold">
                    {m.t}
                  </Texto>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Pie fijo */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: tokens.color.surface,
          borderTopWidth: 1,
          borderTopColor: tokens.color.divider,
          padding: tokens.space["4"],
          gap: tokens.space["2"],
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`}>
            Neto
          </Texto>
          <Texto tamano={tokens.size.caption} color={tokens.color.text} style={{ fontVariant: ["tabular-nums"] }}>
            {pesos(neto)}
          </Texto>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`}>
            IVA 19%
          </Texto>
          <Texto tamano={tokens.size.caption} color={tokens.color.text} style={{ fontVariant: ["tabular-nums"] }}>
            {pesos(iva)}
          </Texto>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderTopWidth: 1, borderTopColor: tokens.color.divider, paddingTop: tokens.space["2"] }}>
          <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold">
            Total
          </Texto>
          <Texto tamano={26} color={tokens.color.text} peso="semibold" style={{ fontVariant: ["tabular-nums"] }}>
            {pesos(total)}
          </Texto>
        </View>
        <Button bloque tamano="lg" onPress={confirmar} cargando={guardando}>
          Cobrar y marcar pagada
        </Button>
      </View>

      {/* Picker */}
      <Modal visible={picker != null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <View style={{ flex: 1, backgroundColor: `${tokens.color.neutral["900"]}66`, justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: tokens.color.surface, borderTopLeftRadius: tokens.radius.lg, borderTopRightRadius: tokens.radius.lg, maxHeight: "70%", padding: tokens.space["6"] }}>
            <Texto tamano={tokens.size.h5} color={tokens.color.text} peso="semibold" style={{ marginBottom: tokens.space["3"] }}>
              {picker ? ETIQUETA_TIPO[picker].texto[0] + ETIQUETA_TIPO[picker].texto.slice(1).toLowerCase() : ""}
            </Texto>
            <FlatList
              data={opcionesPicker}
              keyExtractor={(it) => it.id}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: tokens.color.divider }} />}
              ListEmptyComponent={
                <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`}>
                  Nada en el catálogo para agregar.
                </Texto>
              }
              renderItem={({ item }) => {
                const precio = picker === "producto" ? (item as CatalogoItem).precio_base : (item as Servicio | TipoPack).precio ?? 0;
                const sub = picker === "producto" ? `Stock ${(item as CatalogoItem).stock_actual ?? 0}` : picker === "pack" ? `${(item as TipoPack).cantidad_sesiones} sesiones` : null;
                return (
                  <Pressable onPress={() => agregarDesdePicker(item)} style={{ paddingVertical: tokens.space["3"], flexDirection: "row", justifyContent: "space-between", gap: tokens.space["3"] }}>
                    <View style={{ flex: 1 }}>
                      <Texto tamano={tokens.size.body} color={tokens.color.text}>
                        {item.nombre}
                      </Texto>
                      {sub ? (
                        <Texto tamano={tokens.size.caption} color={`${tokens.color.text}66`}>
                          {sub}
                        </Texto>
                      ) : null}
                    </View>
                    <Texto tamano={tokens.size.body} color={`${tokens.color.text}99`} style={{ fontVariant: ["tabular-nums"] }}>
                      {pesos(precio)}
                    </Texto>
                  </Pressable>
                );
              }}
            />
            <View style={{ marginTop: tokens.space["3"] }}>
              <Button variante="secundario" bloque onPress={() => setPicker(null)}>
                Cerrar
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
