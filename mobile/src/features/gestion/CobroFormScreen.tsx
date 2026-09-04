import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Cliente, MedioPago } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, LoadingScreen, Text } from "../../components/ui";
import { InputMonto } from "../../components/InputMonto";
import { SelectorCliente } from "../../components/SelectorCliente";
import { useRed } from "../../services/sync/NetworkProvider";
import { listarClientes } from "../../services/clientes";
import { crearCobro, type BorradorCobro } from "../../services/cobros";
import type { GestionStackParamList } from "../../shell/navigation/types";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function clave(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fechaLarga(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

const MEDIOS: { v: MedioPago | ""; label: string }[] = [
  { v: "", label: "Sin definir" },
  { v: "transferencia", label: "Transferencia" },
  { v: "efectivo", label: "Efectivo" },
  { v: "webpay", label: "Webpay" },
  { v: "flow", label: "Flow" },
  { v: "mercadopago", label: "MercadoPago" },
];

const VENC_OPCIONES = [
  { dias: 0, label: "Hoy" },
  { dias: 15, label: "15 días" },
  { dias: 30, label: "30 días" },
  { dias: 60, label: "60 días" },
];

export function CobroFormScreen({ navigation }: NativeStackScreenProps<GestionStackParamList, "CobroForm">) {
  const t = useTema();
  const { enLinea } = useRed();
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [guardando, setGuardando] = useState(false);

  const hoy = useMemo(() => new Date(), []);
  const [b, setB] = useState<BorradorCobro>({
    cliente_id: "",
    monto: "",
    fecha_emision: clave(hoy),
    fecha_vencimiento: clave(new Date(hoy.getTime() + 30 * 86400000)),
    medio_pago: "",
  });
  const set = <K extends keyof BorradorCobro>(k: K, v: BorradorCobro[K]) => setB((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    listarClientes()
      .then((r) => setClientes(r.clientes.filter((c) => c.activo)))
      .catch(() => setClientes([]));
  }, []);

  function setVencDias(dias: number) {
    set("fecha_vencimiento", clave(new Date(hoy.getTime() + dias * 86400000)));
  }

  async function guardar() {
    if (!b.cliente_id) return Alert.alert("Falta el cliente", "Elige un cliente.");
    if (!(Number(b.monto.replace(/\D/g, "")) > 0)) return Alert.alert("Falta el monto", "Ingresa el monto del cobro.");
    if (!enLinea) return Alert.alert("Sin conexión", "Necesitas conexión para crear un cobro.");

    setGuardando(true);
    const r = await crearCobro(b);
    setGuardando(false);
    if (!r.ok) return Alert.alert("No se pudo crear", r.error);
    Alert.alert("Cobro creado", "Quedó como pendiente.", [{ text: "Listo", onPress: () => navigation.goBack() }]);
  }

  if (clientes === null) return <LoadingScreen />;

  const vencDiasActual = Math.round((new Date(b.fecha_vencimiento).getTime() - new Date(b.fecha_emision).getTime()) / 86400000);

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4), paddingBottom: t.espacio(8) }}
        keyboardShouldPersistTaps="handled"
      >
        <SelectorCliente
          valor={b.cliente_id}
          onElegir={(id) => set("cliente_id", id)}
          clientes={clientes}
          onClienteCreado={(c) => setClientes((prev) => [...(prev ?? []), c])}
        />

        <InputMonto valor={b.monto} onChangeText={(v) => set("monto", v)} />

        <View style={{ gap: t.espacio(1.5) }}>
          <Text variante="etiqueta" tono="muted">
            Vence en
          </Text>
          <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
            {VENC_OPCIONES.map((o) => {
              const activo = o.dias === vencDiasActual;
              return (
                <Pressable
                  key={o.dias}
                  onPress={() => setVencDias(o.dias)}
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
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text variante="caption" tono="muted">
            Vence el {fechaLarga(b.fecha_vencimiento)}
          </Text>
        </View>

        <View style={{ gap: t.espacio(1.5) }}>
          <Text variante="etiqueta" tono="muted">
            Medio de pago previsto (opcional)
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espacio(2) }}>
            {MEDIOS.map((m) => {
              const activo = b.medio_pago === m.v;
              return (
                <Pressable
                  key={m.label}
                  onPress={() => set("medio_pago", m.v)}
                  style={{
                    minHeight: 40,
                    justifyContent: "center",
                    paddingHorizontal: t.espacio(3.5),
                    borderRadius: t.radio.md,
                    backgroundColor: activo ? t.colores.brand : t.colores.surfaceAlt,
                  }}
                >
                  <Text variante="caption" weight="semibold" tono={activo ? "inverso" : "muted"}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
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
        <Button titulo="Crear cobro" tamano="lg" onPress={guardar} cargando={guardando} />
      </View>
    </View>
  );
}
