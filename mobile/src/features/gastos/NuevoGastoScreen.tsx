import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CategoriaGasto, CentroCosto, EstadoGasto, Proveedor, Trabajo } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, Card, Input, LoadingScreen, PickerBuscable, Text } from "../../components/ui";
import { InputMonto } from "../../components/InputMonto";
import { useRed } from "../../services/sync/NetworkProvider";
import { comprimirImagen } from "../../lib/imagen";
import { listarTrabajos } from "../../services/trabajos";
import {
  crearGasto,
  encolarGasto,
  listarCategoriasGasto,
  listarCentrosCosto,
  listarProveedores,
  type BorradorGasto,
  type Foto,
} from "../../services/gastos";
import type { GestionStackParamList } from "../../shell/navigation/types";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function clave(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ESTADOS: { valor: EstadoGasto; label: string }[] = [
  { valor: "pendiente", label: "Pendiente" },
  { valor: "pagado", label: "Pagado" },
];

const VACIO: BorradorGasto = {
  descripcion: "",
  monto: "",
  categoria_gasto_id: "",
  centro_costo_id: "",
  proveedor_id: "",
  trabajo_id: "",
  fecha: clave(new Date()),
  estado: "pendiente",
  fecha_pago: clave(new Date()),
};

function DiasChips({ valor, onElegir }: { valor: string; onElegir: (k: string) => void }) {
  const t = useTema();
  const dias = useMemo(() => {
    const hoy = new Date();
    const base =
      valor < clave(hoy) ? new Date(valor + "T00:00:00") : new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 7);
    return Array.from({ length: 45 }, (_, i) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + i));
  }, [valor]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.espacio(2) }}>
      {dias.map((d) => {
        const k = clave(d);
        const activo = k === valor;
        return (
          <Pressable
            key={k}
            onPress={() => onElegir(k)}
            style={{
              minWidth: 56,
              minHeight: 60,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: t.radio.md,
              paddingHorizontal: t.espacio(2),
              backgroundColor: activo ? t.colores.brand : t.colores.surface,
              borderWidth: 1,
              borderColor: activo ? t.colores.brand : t.colores.border,
            }}
          >
            <Text variante="caption" tono={activo ? "inverso" : "muted"}>
              {DIAS[d.getDay()]}
            </Text>
            <Text variante="subtitulo" tono={activo ? "inverso" : "normal"}>
              {d.getDate()}
            </Text>
            <Text variante="caption" tono={activo ? "inverso" : "muted"}>
              {MESES[d.getMonth()]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function NuevoGastoScreen({ navigation }: NativeStackScreenProps<GestionStackParamList, "GastoForm">) {
  const t = useTema();
  const { enLinea } = useRed();
  const [categorias, setCategorias] = useState<CategoriaGasto[] | null>(null);
  const [centros, setCentros] = useState<CentroCosto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [foto, setFoto] = useState<Foto | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [b, setB] = useState<BorradorGasto>(VACIO);
  const set = <K extends keyof BorradorGasto>(k: K, v: BorradorGasto[K]) => setB((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    navigation.setOptions({ title: "Nuevo gasto" });
  }, [navigation]);

  useEffect(() => {
    Promise.all([listarCategoriasGasto(), listarCentrosCosto(), listarProveedores(), listarTrabajos(true)]).then(
      ([cats, cc, prov, trab]) => {
        setCategorias(cats);
        setCentros(cc);
        setProveedores(prov.filter((p) => p.activo));
        setTrabajos(trab.trabajos);
      }
    );
  }, []);

  async function adjuntarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return Alert.alert("Permiso necesario", "Necesitamos la cámara para la foto del comprobante.");
    const r = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (r.canceled) return;
    const a = r.assets[0];
    const uri = await comprimirImagen(a.uri, a.width);
    setFoto({ uri, name: a.fileName ?? `comprobante-${Date.now()}.jpg`, type: a.mimeType ?? "image/jpeg" });
  }

  async function guardar() {
    if (!b.categoria_gasto_id) return Alert.alert("Falta la categoría", "Elige una categoría de gasto.");
    if (!(Number(b.monto || 0) > 0)) return Alert.alert("Falta el monto", "Ingresa el monto del gasto.");

    const volver = () => navigation.goBack();
    setGuardando(true);

    if (enLinea) {
      const r = await crearGasto(b, foto ?? undefined);
      if (r.ok) {
        setGuardando(false);
        return Alert.alert(
          "Gasto registrado",
          r.comprobantePendiente ? "El comprobante se está subiendo y se reintenta solo si falla." : "Listo.",
          [{ text: "Listo", onPress: volver }]
        );
      }
      if (!r.reintentable) {
        setGuardando(false);
        return Alert.alert("No se pudo registrar", r.error);
      }
      await encolarGasto(b, foto ?? undefined);
      setGuardando(false);
      return Alert.alert(
        "Se reintentará solo",
        "No se pudo enviar ahora (conexión o servidor). Lo guardamos y se reenvía cuando haya señal.",
        [{ text: "Listo", onPress: volver }]
      );
    }

    await encolarGasto(b, foto ?? undefined);
    setGuardando(false);
    Alert.alert("Guardado sin conexión", "Se enviará cuando vuelvas a tener señal.", [{ text: "Listo", onPress: volver }]);
  }

  if (categorias === null) return <LoadingScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4), paddingBottom: t.espacio(8) }}
        keyboardShouldPersistTaps="handled"
      >
        <InputMonto valor={b.monto} onChangeText={(v) => set("monto", v)} />

        <PickerBuscable
          etiqueta="Categoría"
          placeholder="Elegir categoría"
          valor={b.categoria_gasto_id}
          opciones={categorias.map((c) => ({ id: c.id, label: c.nombre }))}
          onElegir={(id) => set("categoria_gasto_id", id)}
        />

        {centros.length > 0 ? (
          <PickerBuscable
            etiqueta="Centro de costo (opcional)"
            placeholder="Sin centro de costo"
            opcionVacia="Sin centro de costo"
            valor={b.centro_costo_id}
            opciones={centros.map((c) => ({ id: c.id, label: c.nombre }))}
            onElegir={(id) => set("centro_costo_id", id)}
          />
        ) : null}

        {proveedores.length > 0 ? (
          <PickerBuscable
            etiqueta="Proveedor (opcional)"
            placeholder="Sin proveedor"
            opcionVacia="Sin proveedor"
            valor={b.proveedor_id}
            opciones={proveedores.map((p) => ({ id: p.id, label: p.nombre }))}
            onElegir={(id) => set("proveedor_id", id)}
          />
        ) : null}

        {trabajos.length > 0 ? (
          <PickerBuscable
            etiqueta="Orden de Servicio (opcional)"
            placeholder="Sin vincular"
            opcionVacia="Sin vincular"
            valor={b.trabajo_id}
            opciones={trabajos.map((tr) => ({ id: tr.id, label: tr.cliente, sublabel: tr.fecha }))}
            onElegir={(id) => set("trabajo_id", id)}
          />
        ) : null}

        <Input
          etiqueta="Descripción (opcional)"
          placeholder="Ej. Bencina camión 3"
          value={b.descripcion}
          onChangeText={(v) => set("descripcion", v)}
        />

        <View style={{ gap: t.espacio(1.5) }}>
          <Text variante="etiqueta" tono="muted">
            Fecha
          </Text>
          <DiasChips valor={b.fecha} onElegir={(k) => set("fecha", k)} />
        </View>

        <View style={{ gap: t.espacio(1.5) }}>
          <Text variante="etiqueta" tono="muted">
            Estado
          </Text>
          <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
            {ESTADOS.map((e) => {
              const activo = e.valor === b.estado;
              return (
                <Pressable
                  key={e.valor}
                  onPress={() => set("estado", e.valor)}
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
                    {e.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {b.estado === "pagado" ? (
          <View style={{ gap: t.espacio(1.5) }}>
            <Text variante="etiqueta" tono="muted">
              Fecha de pago
            </Text>
            <DiasChips valor={b.fecha_pago} onElegir={(k) => set("fecha_pago", k)} />
          </View>
        ) : null}

        <Card plano style={{ gap: t.espacio(2) }}>
          <Text variante="etiqueta" tono="muted">
            Comprobante (opcional)
          </Text>
          <Button
            titulo={foto ? "Cambiar foto ✓" : "Tomar foto del comprobante"}
            variante={foto ? "secundario" : "primario"}
            onPress={adjuntarFoto}
          />
        </Card>
      </ScrollView>

      <View
        style={{
          padding: t.espacio(4),
          paddingBottom: t.espacio(6),
          borderTopWidth: 1,
          borderTopColor: t.colores.border,
          backgroundColor: t.colores.surface,
        }}
      >
        <Button titulo="Registrar gasto" tamano="lg" onPress={guardar} cargando={guardando} />
      </View>
    </View>
  );
}
