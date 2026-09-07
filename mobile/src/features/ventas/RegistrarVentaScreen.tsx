import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Modal, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CatalogoItem, MedioPagoVenta, Servicio, TipoLineaVenta, TipoPack } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, Text } from "../../components/ui";
import { pesos } from "../../lib/plata";
import type { TrabajosStackParamList } from "../../shell/navigation/types";
import { useAuth } from "../auth/AuthContext";
import { listarServicios } from "../../services/servicios";
import { listarTiposPack } from "../../services/tiposPack";
import { crearVenta, listarProductos, type LineaBorrador } from "../../services/ventas";

const IVA_TASA = 0.19;

const ETIQUETA_TIPO: Record<TipoLineaVenta, { texto: string; caja: "agendado" | "enProceso" | "firmada" }> = {
  servicio: { texto: "SERVICIO", caja: "agendado" },
  producto: { texto: "PRODUCTO", caja: "enProceso" },
  pack: { texto: "PACK", caja: "firmada" },
};

const MEDIOS: { k: MedioPagoVenta; t: string }[] = [
  { k: "efectivo", t: "Efectivo" },
  { k: "transferencia", t: "Transferencia" },
  { k: "tarjeta", t: "Tarjeta" },
];

type LineaLocal = LineaBorrador & { detalle?: string; maxCantidad?: number };

export function RegistrarVentaScreen({ route, navigation }: NativeStackScreenProps<TrabajosStackParamList, "RegistrarVenta">) {
  const t = useTema();
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

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <ScrollView contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4), paddingBottom: 220 }}>
        <View style={{ gap: t.espacio(2) }}>
          <Text mono variante="caption" tono="muted">
            {origenTipo === "os" ? `Desde OS N° ${folio ?? "—"}` : "Desde una cita"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(3) }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colores.brandSoft, alignItems: "center", justifyContent: "center" }}>
              <Text weight="bold" tono="brand">
                {iniciales}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text weight="semibold">{clienteNombre}</Text>
              {clienteRut ? (
                <Text mono variante="caption" tono="muted">
                  {clienteRut}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Líneas */}
        <View style={{ gap: t.espacio(3) }}>
          {lineas.map((l, i) => {
            const et = ETIQUETA_TIPO[l.tipo];
            const caja = t.estado[et.caja];
            return (
              <View key={i} style={{ borderWidth: 1, borderColor: t.colores.border, borderRadius: t.radio.md, padding: t.espacio(3), gap: t.espacio(2) }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2) }}>
                  <Text mono weight="bold" style={{ fontSize: 9.5, letterSpacing: 0.5, color: caja.fg, backgroundColor: caja.bg, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3 }}>
                    {et.texto}
                  </Text>
                  <Text weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
                    {l.nombre}
                  </Text>
                  <Pressable onPress={() => quitar(i)} hitSlop={8}>
                    <Ionicons name="close" size={18} color={t.colores.faint} />
                  </Pressable>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2) }}>
                  {l.tipo !== "pack" ? (
                    <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: t.colores.border, borderRadius: t.radio.sm }}>
                      <Pressable onPress={() => setCantidad(i, -1)} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="remove" size={16} color={t.colores.foreground} />
                      </Pressable>
                      <Text mono weight="semibold" style={{ width: 28, textAlign: "center" }}>
                        {l.cantidad}
                      </Text>
                      <Pressable onPress={() => setCantidad(i, 1)} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="add" size={16} color={t.colores.foreground} />
                      </Pressable>
                    </View>
                  ) : null}
                  <Text mono variante="caption" tono="muted" style={{ flex: 1 }}>
                    × {pesos(l.precio_unitario)}
                  </Text>
                  <Text mono weight="semibold">
                    {pesos(l.precio_unitario * l.cantidad)}
                  </Text>
                </View>

                {l.detalle ? (
                  <Text variante="caption" tono="faint">
                    {l.detalle}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Agregar */}
        <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
          {(["servicio", "producto", "pack"] as TipoLineaVenta[]).map((tp) => (
            <Pressable
              key={tp}
              onPress={() => setPicker(tp)}
              style={{
                flex: 1,
                minHeight: 44,
                borderWidth: 1.5,
                borderStyle: "dashed",
                borderColor: t.colores.borderStrong,
                borderRadius: t.radio.md,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 4,
              }}
            >
              <Ionicons name="add" size={14} color={t.colores.muted} />
              <Text variante="caption" weight="semibold" tono="muted">
                {ETIQUETA_TIPO[tp].texto[0] + ETIQUETA_TIPO[tp].texto.slice(1).toLowerCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        {!puedeEditarPrecio ? (
          <Text variante="caption" tono="faint">
            Los precios vienen del catálogo. Solo un perfil de administración puede editarlos.
          </Text>
        ) : null}

        {/* Medio de pago */}
        <View style={{ gap: t.espacio(2) }}>
          <Text variante="etiqueta" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
            Medio de pago
          </Text>
          <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
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
                    borderRadius: t.radio.md,
                    backgroundColor: activo ? t.colores.brand : t.colores.surface,
                    borderWidth: 1,
                    borderColor: activo ? t.colores.brand : t.colores.border,
                  }}
                >
                  <Text variante="caption" weight="semibold" tono={activo ? "inverso" : "muted"}>
                    {m.t}
                  </Text>
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
          backgroundColor: t.colores.surface,
          borderTopWidth: 1,
          borderTopColor: t.colores.border,
          padding: t.espacio(5),
          gap: t.espacio(2),
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text variante="caption" tono="muted">
            Neto
          </Text>
          <Text mono variante="caption">
            {pesos(neto)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text variante="caption" tono="muted">
            IVA 19%
          </Text>
          <Text mono variante="caption">
            {pesos(iva)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderTopWidth: 1, borderTopColor: t.colores.border, paddingTop: t.espacio(2) }}>
          <Text weight="semibold">Total</Text>
          <Text mono weight="semibold" style={{ fontSize: 26 }}>
            {pesos(total)}
          </Text>
        </View>
        <Button titulo="Cobrar y marcar pagada" tamano="lg" onPress={confirmar} cargando={guardando} />
      </View>

      {/* Picker */}
      <Modal visible={picker != null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <View style={{ flex: 1, backgroundColor: t.colores.overlay, justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: t.colores.surface, borderTopLeftRadius: 14, borderTopRightRadius: 14, maxHeight: "70%", padding: t.espacio(5) }}>
            <Text variante="subtitulo" style={{ marginBottom: t.espacio(3) }}>
              {picker ? ETIQUETA_TIPO[picker].texto[0] + ETIQUETA_TIPO[picker].texto.slice(1).toLowerCase() : ""}
            </Text>
            <FlatList
              data={opcionesPicker}
              keyExtractor={(it) => it.id}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: t.colores.border }} />}
              ListEmptyComponent={
                <Text variante="caption" tono="muted">
                  Nada en el catálogo para agregar.
                </Text>
              }
              renderItem={({ item }) => {
                const precio = picker === "producto" ? (item as CatalogoItem).precio_base : (item as Servicio | TipoPack).precio ?? 0;
                const sub = picker === "producto" ? `Stock ${(item as CatalogoItem).stock_actual ?? 0}` : picker === "pack" ? `${(item as TipoPack).cantidad_sesiones} sesiones` : null;
                return (
                  <Pressable onPress={() => agregarDesdePicker(item)} style={{ paddingVertical: t.espacio(3), flexDirection: "row", justifyContent: "space-between", gap: t.espacio(3) }}>
                    <View style={{ flex: 1 }}>
                      <Text>{item.nombre}</Text>
                      {sub ? (
                        <Text variante="caption" tono="faint">
                          {sub}
                        </Text>
                      ) : null}
                    </View>
                    <Text mono tono="muted">
                      {pesos(precio)}
                    </Text>
                  </Pressable>
                );
              }}
            />
            <Button titulo="Cerrar" variante="secundario" onPress={() => setPicker(null)} style={{ marginTop: t.espacio(3) }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
