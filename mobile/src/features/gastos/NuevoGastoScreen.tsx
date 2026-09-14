import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, View } from "react-native";
import { Camera } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CategoriaGasto, CentroCosto, EstadoGasto, Proveedor, Trabajo } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Input, LoadingState, Texto, useMarca } from "@bitacora/ui/native";
import { PickerBuscable } from "../../components/ui";
import { InputMonto } from "../../components/InputMonto";
import { useRed } from "../../services/sync/NetworkProvider";
import { elegirFotos } from "../../lib/imagen";
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
import type { MasStackParamList } from "../../shell/navigation/types";

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
  const marca = useMarca();
  const dias = useMemo(() => {
    const hoy = new Date();
    const base =
      valor < clave(hoy) ? new Date(valor + "T00:00:00") : new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 7);
    return Array.from({ length: 45 }, (_, i) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + i));
  }, [valor]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: tokens.space["2"] }}>
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
              borderRadius: tokens.radius.md,
              paddingHorizontal: tokens.space["2"],
              backgroundColor: activo ? marca.base : tokens.color.surface,
              borderWidth: 1,
              borderColor: activo ? marca.base : tokens.color.divider,
            }}
          >
            <Texto tamano={tokens.size.caption} color={activo ? marca.foreground : `${tokens.color.text}99`}>
              {DIAS[d.getDay()]}
            </Texto>
            <Texto tamano={tokens.size.h5} peso="semibold" color={activo ? marca.foreground : tokens.color.text}>
              {d.getDate()}
            </Texto>
            <Texto tamano={tokens.size.caption} color={activo ? marca.foreground : `${tokens.color.text}99`}>
              {MESES[d.getMonth()]}
            </Texto>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Sistema visual móvil v2 — pantalla MODAL: sin ScreenHeader propio (el
// título nativo del stack, "Nuevo gasto", ya lo pone MasStack), solo se
// recolorea el contenido. `InputMonto` y `PickerBuscable` no tienen
// todavía equivalente v2 — quedan tal cual (gap conocido), el resto del
// contenido pasa a tokens/Texto/Button/Input de @bitacora/ui/native.
export function NuevoGastoScreen({ navigation }: NativeStackScreenProps<MasStackParamList, "GastoForm">) {
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
    const [elegida] = await elegirFotos({ titulo: "Foto del comprobante" });
    if (elegida) setFoto(elegida);
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

  if (categorias === null) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg, padding: tokens.space["4"] }}>
        <LoadingState />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] }}
        keyboardShouldPersistTaps="handled"
      >
        {/* La foto de la boleta arriba, grande */}
        {foto ? (
          <View style={{ gap: tokens.space["2"] }}>
            <Image source={{ uri: foto.uri }} style={{ width: "100%", height: 220, borderRadius: tokens.radius.md, backgroundColor: tokens.color.surface }} resizeMode="cover" />
            <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
              <View style={{ flex: 1 }}>
                <Button variante="secundario" bloque onPress={adjuntarFoto}>
                  Cambiar
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button variante="peligro" bloque onPress={() => setFoto(null)}>
                  Quitar
                </Button>
              </View>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={adjuntarFoto}
            style={{
              height: 160,
              borderRadius: tokens.radius.md,
              borderWidth: 1.5,
              borderStyle: "dashed",
              borderColor: tokens.color.divider,
              alignItems: "center",
              justifyContent: "center",
              gap: tokens.space["2"],
            }}
          >
            <Camera size={28} strokeWidth={2} color={`${tokens.color.text}99`} />
            <Texto tamano={tokens.size.small} peso="semibold" color={`${tokens.color.text}99`}>
              Foto de la boleta
            </Texto>
          </Pressable>
        )}

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
          valor={b.descripcion}
          onCambio={(v) => set("descripcion", v)}
        />

        <View style={{ gap: tokens.space["1"] * 1.5 }}>
          <Texto tamano={tokens.size.small} peso="medium" color={`${tokens.color.text}99`}>
            Fecha
          </Texto>
          <DiasChips valor={b.fecha} onElegir={(k) => set("fecha", k)} />
        </View>

        <View style={{ gap: tokens.space["1"] * 1.5 }}>
          <Texto tamano={tokens.size.small} peso="medium" color={`${tokens.color.text}99`}>
            Estado
          </Texto>
          <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
            {ESTADOS.map((e) => {
              const activo = e.valor === b.estado;
              return (
                <EstadoChip key={e.valor} activo={activo} label={e.label} onPress={() => set("estado", e.valor)} />
              );
            })}
          </View>
        </View>

        {b.estado === "pagado" ? (
          <View style={{ gap: tokens.space["1"] * 1.5 }}>
            <Texto tamano={tokens.size.small} peso="medium" color={`${tokens.color.text}99`}>
              Fecha de pago
            </Texto>
            <DiasChips valor={b.fecha_pago} onElegir={(k) => set("fecha_pago", k)} />
          </View>
        ) : null}

      </ScrollView>

      <View
        style={{
          padding: tokens.space["4"],
          borderTopWidth: 1,
          borderTopColor: tokens.color.divider,
          backgroundColor: tokens.color.surface,
        }}
      >
        <Button tamano="lg" bloque onPress={guardar} cargando={guardando}>
          Registrar gasto
        </Button>
      </View>
    </View>
  );
}

function EstadoChip({ activo, label, onPress }: { activo: boolean; label: string; onPress: () => void }) {
  const marca = useMarca();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: tokens.radius.md,
        backgroundColor: activo ? marca.base : tokens.color.surface,
        borderWidth: 1,
        borderColor: activo ? marca.base : tokens.color.divider,
      }}
    >
      <Texto tamano={tokens.size.caption} peso="semibold" color={activo ? marca.foreground : `${tokens.color.text}99`}>
        {label}
      </Texto>
    </Pressable>
  );
}
